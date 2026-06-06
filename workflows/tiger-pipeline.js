// .claude/workflows/tiger-pipeline.js
//
// Deterministic tiger-skills pipeline — the conductor's GATES 5–12 expressed
// as a fixed, git-committed orchestration script instead of a plan the
// conductor re-improvises each run. Runs ONE already-approved feature through
// the 11-agent pipeline:
//
//   explore → plan → [architect?] → persist-tasks
//           → generate (FAN-OUT: one generator per independent task, in waves)
//           → e2e-author (dedicated opus e2e-engineer writes the user-flow E2E)
//           → execute (full suite + mandatory E2E)
//           → (heal + regression test → regenerate → e2e-refresh → re-execute){≤3}
//           → review cluster: reviewer ‖ correctness-reviewer ‖ [security-reviewer]  (PARALLEL)
//           → (fix → e2e-refresh → re-execute → re-review){≤3} → track
//
// ── BOUNDARY ────────────────────────────────────────────────────────────────
// Human-in-the-loop gates are NOT in here. GATE 0 (bootstrap), GATE 1 (grill +
// human spec approval), GATES 2–4 (ledger, clock-in, scope/WIP=1) stay in the
// conversational layer. This workflow assumes: the four harness files exist,
// the feature has a HUMAN-approved spec, and exactly one feature is in_progress.
// It encodes only the mechanical, reproducible part.
//
// ── PARALLELISM (v4.9.0) ──────────────────────────────────────────────────────
// Two stages fan out where the work is genuinely independent:
//   • REVIEW CLUSTER (GATE 11) — quality + correctness + security read the SAME
//     diff; they have no data dependency, so they run concurrently (first pass AND
//     every re-review in the loop). Latency ≈ the slowest single reviewer, not the sum.
//   • GENERATION (GATE 7) — the planner returns a structured tasks[] with depends_on
//     and files. We schedule it into dependency-respecting WAVES; within a wave only
//     FILE-DISJOINT tasks run together, each as its own generator, in parallel. They
//     write only their own files and DEFER any shared-file change (deps, barrels) to a
//     short sequential integrate step, so parallel writers never collide — no worktrees
//     needed (per the runtime's "worktrees only when writes would actually conflict").
//     A feature whose tasks are a single chain degrades cleanly to the old sequential
//     path (each wave has one task). Force sequential with args.sequentialGenerate=true.
//
// ── API — the documented dynamic-workflow runtime (Claude Code ≥ 2.1.154) ──────
// Matched to https://code.claude.com/docs/en/workflows and the Workflow runtime:
//   - meta is `export const meta = {…}` (a PURE literal, the first statement) — NOT meta(…).
//   - agent(prompt, opts) — a named subagent is selected via opts.agentType (see run()).
//   - phase(title) is a BARE void marker; agents that follow are grouped under it.
//     We wrap it in step(name, thunk) so the sequential gate calls below read cleanly.
//     INSIDE parallel()/pipeline() we pass opts.phase EXPLICITLY (never the CURRENT_PHASE
//     global), because concurrent agents would otherwise race on that single variable.
//   - parallel(thunks) is a BARRIER that returns results in order; a thrown/dead thunk
//     becomes null in the array, so we filter/guard. Used for the review cluster and waves.
//   - schema — agent(prompt,{schema}) forces validated structured output; the planner
//     uses it so the script gets a real tasks[] to schedule, not prose to regex.
//   - MODEL — opts.agentType picks the subagent's PROMPT + TOOLS, but NOT its model.
//     The Workflow runtime does NOT read the subagent's frontmatter `model:` field;
//     when opts.model is omitted the agent inherits the SESSION'S main-loop model.
//     So the per-agent model is routed explicitly below (see MODEL_FOR). Without it, a
//     session on a fast/"flash" model runs ALL agents on flash, including the pro ones.
//   - No fs/shell/Date.now()/Math.random() in the script itself — all I/O happens
//     inside agent prompts (explorer reads, scribe writes state, executor runs tests).
// Launch with /workflows (or save into .claude/workflows/). Start scoped — a run
// spawns many agents and costs far more tokens than a normal turn.

// meta MUST be the first statement and a PURE literal — no vars, no template
// strings, no calls inside it. The runtime reads it before executing anything.
export const meta = {
  name: "tiger-pipeline",
  description: "Run one approved feature through the tiger-skills GATES 5-12 agent pipeline: explorer, planner, code-architect, scribe, generator(s), e2e-engineer, executor, healer, reviewers. Generation fans out one generator per independent task (waves); the GATE 11 review cluster (quality+correctness+security) runs in parallel. The opus e2e-engineer authors the user-flow E2E after generate (GATE 7b) and re-runs after every fix. Deterministic and resumable; human grill/spec-approval happens before this runs.",
  phases: [
    { title: "explore" },
    { title: "plan" },
    { title: "architect" },
    { title: "persist-tasks" },
    { title: "generate" },
    { title: "integrate" },
    { title: "e2e-author" },
    { title: "execute" },
    { title: "heal" },
    { title: "review-quality" },
    { title: "review-correctness" },
    { title: "review-security" },
    { title: "track" },
  ],
};

// ── Inputs (passed in — never discovered with fs, never Date.now()) ──────────
// args: {
//   featureId, featureTitle, specFile, projectDir,
//   today,            // ISO date string — determinism rule: pass time IN
//   newModule,        // bool — GATE 6 architect trigger
//   spans3PlusFiles,  // bool — GATE 6 architect trigger
//   newPattern,       // bool — GATE 6 architect trigger
//   structuralRisk,   // bool — GATE 6 architect trigger (planner flagged it)
//   securitySensitive // bool — GATE 11c security-reviewer trigger (auth, untrusted input,
//                     //        query/command building, network/file I/O, deserialization,
//                     //        crypto/secrets, or a new dependency). Passed IN, not sniffed.
//   proModel,         // optional string — model for EVERY agent by default (see MODEL below).
//                     //        Defaults to "opus". On a non-Anthropic backend pass your strong
//                     //        model's name, e.g. "deepseek-v4-pro[1m]".
//   fastModel,        // optional string — model for the mechanical agents (explorer, generator,
//                     //        executor, scribe). DEFAULTS TO proModel, so out of the box every
//                     //        agent runs on the pro tier. Pass e.g. "deepseek-v4-flash" only if
//                     //        you want to downgrade the mechanical agents to a cheaper model.
//   sequentialGenerate // optional bool — force the old single-generator path (no fan-out).
// }
const F = {
  id: args.featureId,
  title: args.featureTitle,
  spec: args.specFile,
  dir: args.projectDir,
  today: args.today,
};
const ARCHITECT_TRIGGER =
  args.newModule === true ||
  args.spans3PlusFiles === true ||
  args.newPattern === true ||
  args.structuralRisk === true;

// GATE 11c — security review runs only when this flag is set. Passed IN so the
// run is deterministic (the same args always produce the same gate set), rather
// than the script sniffing the diff and varying run to run.
const SECURITY_TRIGGER = args.securitySensitive === true;

const MAX_HEAL = 3; // GATE 9 cap — matches the conductor's "max 3 healing loops"
const MAX_REVIEW = 3; // GATE 11 cap — matches "max 3 loops, then escalate"

// phase(title) is a bare marker in the runtime; step() sets the current phase and
// then awaits the gate's work, so the sequential calls below read as one line each.
let CURRENT_PHASE = "init";
const step = async (name, thunk) => {
  CURRENT_PHASE = name;
  phase(name);
  return await thunk();
};

// ── MODEL ROUTING ─────────────────────────────────────────────────────────────
// Per the docs: "Every agent in a workflow uses your session's model unless the
// script routes a stage to a different one." agentType picks an agent's prompt +
// tools but NOT its model — the subagent's frontmatter `model:` is ignored here.
// So we route each stage explicitly. By DEFAULT every agent runs on the same (pro)
// model — FAST falls back to PRO — so quality is uniform; pass fastModel only if you
// deliberately want the mechanical agents on a cheaper tier. Both knobs are args, so
// a non-Anthropic backend (e.g. DeepSeek) can name its concrete models.
const PRO = args.proModel || "opus"; // the strong tier — used for every agent by default
const FAST = args.fastModel || PRO; // mechanical agents; defaults to PRO ⇒ "all agents on pro"
const MODEL_FOR = {
  "tiger-skills:explorer": FAST,
  "tiger-skills:planner": PRO,
  "tiger-skills:code-architect": PRO,
  "tiger-skills:scribe": FAST,
  "tiger-skills:generator": FAST,
  "tiger-skills:e2e-engineer": PRO,
  "tiger-skills:executor": FAST,
  "tiger-skills:healer": PRO,
  "tiger-skills:reviewer": PRO,
  "tiger-skills:correctness-reviewer": PRO,
  "tiger-skills:security-reviewer": PRO,
};

// Single swap-point for the subagent selector. One agent = one call.
// Real signature: agent(prompt, opts) — opts.agentType picks the named subagent,
// opts.model routes the stage to its tier, and opts.phase groups it. Pass phaseName
// explicitly inside parallel()/pipeline(); it defaults to the sequential CURRENT_PHASE.
const run = (subagentType, prompt, phaseName) =>
  agent(prompt, {
    agentType: subagentType,
    phase: phaseName || CURRENT_PHASE,
    model: MODEL_FOR[subagentType] || PRO,
  });

// Each gate agent already emits a proof line; we ALSO ask the gate-deciding
// agents (executor, reviewer) to end with a machine-readable status token so
// the loop conditions below are robust rather than fuzzy string-sniffing.
const passed = (report) => /PIPELINE_STATUS:\s*PASS/i.test(String(report || ""));
const approved = (report) => /REVIEW_VERDICT:\s*APPROVED/i.test(String(report || ""));
const correctnessOk = (report) => /CORRECTNESS_VERDICT:\s*APPROVED/i.test(String(report || ""));
const securityOk = (report) => /SECURITY_VERDICT:\s*APPROVED/i.test(String(report || ""));

// ── GATE 5a — EXPLORE (read-only recon; builds the Type Inventory) ───────────
const recon = await step("explore", () =>
  run("tiger-skills:explorer",
    `Recon the codebase for ${F.id}: ${F.title}.
     Project directory: ${F.dir}. Spec file: ${F.spec} (read it).
     Produce a Recon Report: Type Inventory (existing types/functions/constants
     with file:line), Module Map, Existing Patterns, Integration Points,
     Already Exists — Do NOT Duplicate, Risks. You are read-only.
     Begin with the proof line: 'Type Inventory built: YES — N existing types catalogued'.`)
);

// ── GATE 5b — PLAN (structured blueprint: prose + a machine-readable tasks[]) ──
// schema makes the planner return validated JSON, so the script can SCHEDULE the
// tasks into parallel waves instead of regex-ing prose. blueprintText carries the
// full prose blueprint downstream agents still want.
const BLUEPRINT_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["blueprintText", "tasks", "architectConsulted"],
  properties: {
    architectConsulted: { type: "string", description: "code-architect consulted: YES/NO — <reason>" },
    blueprintText: { type: "string", description: "Full prose blueprint: Context → Task Breakdown → Execution Phases → Risks" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        required: ["id", "title", "files", "depends_on"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          agent: { type: "string" },
          files: { type: "array", items: { type: "string" }, description: "every file this task creates or edits — used to keep parallel tasks disjoint" },
          depends_on: { type: "array", items: { type: "string" }, description: "ids of tasks that must finish first" },
          verification: { type: "string" },
        },
      },
    },
  },
};
const blueprint = await step("plan", () =>
  agent(
    `Plan the implementation for ${F.id}: ${F.title}.
     Spec file: ${F.spec} (read it for decisions + acceptance criteria).
     Recon Report (do NOT re-explore): ${recon}
     Project directory: ${F.dir}.
     Produce the prose blueprint (Context → Task Breakdown → Execution Phases → Risks) in
     'blueprintText', and a 'tasks' array where each task lists EVERY file it touches in
     'files' and its prerequisite task ids in 'depends_on'. Accurate files/depends_on matter:
     the pipeline runs file-disjoint, dependency-ready tasks in PARALLEL, so understating a
     shared file or a dependency can cause two generators to collide. Set 'architectConsulted'
     to 'code-architect consulted: YES/NO — <reason>'.`,
    { agentType: "tiger-skills:planner", phase: "plan", model: MODEL_FOR["tiger-skills:planner"], schema: BLUEPRINT_SCHEMA }
  )
);
const BP = (blueprint && blueprint.blueprintText) || String(blueprint || "(planner produced no blueprint)");
const TASKS = (blueprint && Array.isArray(blueprint.tasks)) ? blueprint.tasks : [];

// ── GATE 6 — ARCHITECT (only when a trigger fires — a deterministic boolean) ─
let architecture = "(architect gate skipped — no structural trigger)";
if (ARCHITECT_TRIGGER) {
  architecture = await step("architect", () =>
    run("tiger-skills:code-architect",
      `Review the architecture for this blueprint:
       ${BP}
       FIRST invoke code-quality-audit, THEN map findings to patterns.
       Produce: Summary → Violations (file:line) → Pattern Recommendations → Verdict.
       Begin with: 'code-quality-audit invoked: YES — N principles checked, M violations'.`)
  );
}

// ── GATE 5c — PERSIST tasks[] (scribe is the single writer; I/O lives here) ──
await step("persist-tasks", () =>
  run("tiger-skills:scribe",
    `Apply this Board Update to ${F.dir}/feature_list.json for ${F.id}:
     write the planner's task breakdown into the feature's tasks[].
     Tasks (JSON): ${JSON.stringify(TASKS)}
     Validate the JSON after writing (Windows: PowerShell ConvertFrom-Json; never bare python).
     End with: 'feature_list.json valid after write: YES — applied N deltas'.`)
);

// ── GATE 7 — GENERATE (fan-out: one generator per independent task, in waves) ──
// Schedule TASKS into dependency-respecting waves; within a wave keep only
// file-disjoint tasks so parallel generators never write the same file. Tasks that
// share a file (or whose deps aren't met yet) fall to a later wave — i.e. run later,
// after the integrate step has folded the prior wave in.
const buildWaves = (tasks) => {
  const byId = {};
  tasks.forEach((t) => { byId[t.id] = t; });
  const done = new Set();
  const waves = [];
  let remaining = tasks.slice();
  let guard = 0;
  while (remaining.length && guard++ < tasks.length + 2) {
    const ready = remaining.filter((t) =>
      (t.depends_on || []).every((d) => done.has(d) || !byId[d]) // unknown dep ⇒ treat as satisfied
    );
    if (!ready.length) { waves.push(remaining.slice()); break; } // cycle/odd deps ⇒ run the rest sequentially
    const wave = [];
    const used = new Set();
    for (const t of ready) {
      const files = t.files || [];
      if (files.length && files.some((f) => used.has(f))) continue; // shares a file ⇒ defer to next wave
      files.forEach((f) => used.add(f));
      wave.push(t);
    }
    wave.forEach((t) => done.add(t.id));
    waves.push(wave);
    remaining = remaining.filter((t) => !done.has(t.id));
  }
  return waves;
};

// Per-task prompt when generators run SIDE BY SIDE — write only your own files,
// run no git, and defer shared-file edits to the integrate step.
const parallelTaskPrompt = (t) =>
  `Implement ONLY task ${t.id} — "${t.title}" — from the blueprint, nothing else.
   Blueprint (context): ${BP}
   Architecture notes: ${architecture}
   Project directory: ${F.dir}.
   PARALLEL-SAFE RULES — other generators are writing OTHER files at the same time:
     • Touch ONLY these files: ${(t.files || []).join(", ") || "(only the files this task owns)"}.
     • Do NOT run git (no add/commit). Do NOT run installs/formatters that rewrite other files.
     • Do NOT edit shared manifests or barrels (package.json, lockfiles, index/mod/__init__).
     • If you MUST add a dependency or change a shared file, do NOT edit it — list the exact change
       under a 'SHARED-FILE CHANGES NEEDED' heading for the integrate step to apply.
   Before writing: invoke code-quality-language; build a Type Inventory; no placeholders; add this task's unit tests.
   Begin with: 'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
   End with a Board Update for ${t.id} (files written, unit results) + any 'SHARED-FILE CHANGES NEEDED'.`;

// Solo prompt — one task alone in a wave, or the whole-blueprint fallback. git allowed.
const soloPrompt = (scope) =>
  `Implement ${scope} with TDD and the code-quality rules.
   Blueprint: ${BP}
   Architecture notes: ${architecture}
   Project directory: ${F.dir}.
   Before writing: invoke code-quality-language; build a Type Inventory; no placeholders.
   Produce a Generator Handoff (task IDs + commits, files, Layer 1+2 results) ending with a
   Board Update. Begin with:
   'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.`;

let handoff;
const FAN_OUT = args.sequentialGenerate !== true && TASKS.length >= 2;
if (!FAN_OUT) {
  // Single task, no structured tasks, or forced sequential ⇒ original whole-blueprint generate.
  handoff = await step("generate", () =>
    run("tiger-skills:generator", soloPrompt("this blueprint"))
  );
} else {
  const waves = buildWaves(TASKS);
  log(`generate: ${TASKS.length} tasks scheduled into ${waves.length} wave(s) — ` +
      `${waves.map((w) => w.length).join("+")} (parallel where the wave has >1 task)`);
  const handoffs = [];
  for (let i = 0; i < waves.length; i++) {
    const wave = waves[i];
    const ph = `generate-w${i + 1}`;
    if (wave.length === 1) {
      const t = wave[0];
      handoffs.push(await step(ph, () =>
        run("tiger-skills:generator",
          soloPrompt(`ONLY task ${t.id} — "${t.title}" — from the blueprint (files: ${(t.files || []).join(", ")})`),
          ph)
      ));
    } else {
      // Parallel wave — file-disjoint, no worktrees, write-only. BARRIER: collect all
      // before integrating, because integrate consumes every handoff's deferred changes.
      const results = await parallel(
        wave.map((t) => () =>
          run("tiger-skills:generator", parallelTaskPrompt(t), ph).then((h) => ({ id: t.id, handoff: h }))
        )
      );
      const good = results.filter(Boolean);
      handoffs.push(...good.map((g) => `[task ${g.id}]\n${g.handoff}`));
      // Sequential integrate: apply only the deferred shared-file changes so the
      // independently-built modules connect, then confirm the tree still builds.
      const integrated = await step("integrate", () =>
        run("tiger-skills:generator",
          `Integrate generation wave ${i + 1} for ${F.id} in ${F.dir}. ${good.length} generators built their
           own files in parallel and DEFERRED shared-file changes. From their handoffs below, apply ONLY the
           'SHARED-FILE CHANGES NEEDED' (add dependencies, wire barrels/exports, shared types) — do NOT
           re-implement task logic. Then confirm the project still builds (static/import check).
           Generator handoffs: ${good.map((g) => `[task ${g.id}]\n${g.handoff}`).join("\n\n")}
           Begin with: 'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
           End with a Board Update listing the shared files you changed (or 'none needed').`,
          "integrate")
      );
      handoffs.push(`[integrate wave ${i + 1}]\n${integrated}`);
    }
  }
  handoff = handoffs.join("\n\n");
}

// ── GATE 7b — E2E AUTHOR (dedicated opus e2e-engineer, runs AFTER generate) ──
// The feature code now exists, so its real entry points (URL / CLI / API) exist too.
// A dedicated agent — NOT the generator — authors the Playwright/E2E logic that drives
// the actual user flow, one asserting flow per acceptance criterion. This runs on EVERY
// pipeline pass, and is re-run after EVERY fix below (heal + review loops), so "nothing
// broke" is always re-confirmed by an end-to-end test of the real workflow.
let e2e = await step("e2e-author", () =>
  run("tiger-skills:e2e-engineer",
    `The feature code for ${F.id}: ${F.title} is now written. Author its END-TO-END
     user-flow tests — do NOT modify feature logic, only add tests/config.
     Prior generator handoff (the code that exists): ${handoff}
     Spec file: ${F.spec} (read it — each acceptance criterion's user-visible outcome
     becomes an E2E assertion). Project directory: ${F.dir}.
     Invoke e2e-authoring (it applies harness-engineering-verify Layer 3). Use the project's
     E2E stack; if none exists yet, scaffold Playwright (playwright.config.*, tests/e2e/).
     Drive the REAL entry point end to end and assert the visible outcome — never a stub.
     Cover the happy path PLUS the spec's error and edge cases, one flow per acceptance
     criterion. End with a Board Update listing the E2E files added. Begin with:
     'e2e-authoring invoked: YES — stack: <playwright|...>, flows covered: N, ACs asserted: X/Y'.`)
);

// ── GATE 8 — EXECUTE ─────────────────────────────────────────────────────────
let evidence = await step("execute", () =>
  run("tiger-skills:executor",
    `Verify independently. Generator handoff: ${handoff}
     E2E authored at GATE 7b by the e2e-engineer: ${e2e}
     Project directory: ${F.dir}.
     Invoke harness-engineering-verify; run static → FULL unit suite (no early stop)
     → E2E (mandatory for user-visible behavior — run the e2e-engineer's user-flow tests);
     fresh evidence from THIS run only.
     REJECT the handoff (report FAIL) if a user-facing feature has no E2E test of its
     workflow, or if any acceptance criterion has no asserting test.
     Begin with: 'harness-engineering-verify invoked: YES — layers run: 1,2,3'.
     END your report with exactly one line: 'PIPELINE_STATUS: PASS' or 'PIPELINE_STATUS: FAIL'.`)
);

// ── GATE 9 — HEAL loop (guarded: counter AND budget — determinism rule) ──────
// Fixes are single-task and sequential (a fix to one bug is not independent work),
// so the generator here is NOT fanned out.
let heals = 0;
while (!passed(evidence) && heals < MAX_HEAL && budget.remaining() > 0) {
  heals++;
  const fix = await step("heal-" + heals, () =>
    run("tiger-skills:healer",
      `Diagnose and prescribe a fix. Executor escalation: ${evidence}
       Blueprint: ${BP}. Project directory: ${F.dir}.
       Invoke harness-engineering-diagnose; classify to one of five layers; give exact
       file:line fix instructions AND a MANDATORY failing-first regression test (fails on the
       broken code, passes after the fix; E2E if the bug was user-visible). Begin with:
       'harness-engineering-diagnose invoked: YES — layer: <X>'.`)
  );
  handoff = await step("regenerate-" + heals, () =>
    run("tiger-skills:generator",
      `Apply these fixes and ADD the prescribed regression test, nothing more: ${fix}
       Blueprint: ${BP}. Project directory: ${F.dir}. End with a Board Update.`)
  );
  // E2E refresh — the code changed, so re-author/extend the user-flow E2E (and add an E2E
  // regression flow if the bug was user-visible) BEFORE re-executing, so "write E2E every
  // time" holds and the full re-run confirms the fix broke nothing end to end.
  e2e = await step("e2e-refresh-" + heals, () =>
    run("tiger-skills:e2e-engineer",
      `Code changed via a fix. Update/extend the END-TO-END user-flow tests so they still
       drive the real workflow and cover the fixed behavior; add an E2E regression flow if the
       bug was user-visible. Do NOT modify feature logic — tests/config only.
       Fix applied: ${fix}. Generator handoff: ${handoff}. Spec file: ${F.spec}.
       Project directory: ${F.dir}. Invoke e2e-authoring. Begin with:
       'e2e-authoring invoked: YES — stack: <playwright|...>, flows covered: N, ACs asserted: X/Y'.`)
  );
  evidence = await step("re-execute-" + heals, () =>
    run("tiger-skills:executor",
      `Re-verify. Generator handoff: ${handoff}. E2E refreshed by the e2e-engineer: ${e2e}
       Project directory: ${F.dir}.
       Run the FULL suite (no early stop) + the E2E workflow test, so a fix that broke another
       part is caught and the new regression test is confirmed green. Fresh evidence only.
       END with one line: 'PIPELINE_STATUS: PASS' or 'PIPELINE_STATUS: FAIL'.`)
  );
}

// ── GATE 11 — REVIEW CLUSTER (three independent checkers, run IN PARALLEL) ─────
// Quality + correctness run ALWAYS; security runs only when SECURITY_TRIGGER is set.
// The three reviewers read the same diff and don't depend on each other, so they run
// concurrently — first pass and every re-review. A dead agent ⇒ null ⇒ treated as
// CHANGES (never a false APPROVE), so the loop escalates rather than rubber-stamps.
const reviewCluster = async (qPrompt, cPrompt, sPrompt) => {
  const thunks = [
    () => run("tiger-skills:reviewer", qPrompt, "review-quality"),
    () => run("tiger-skills:correctness-reviewer", cPrompt, "review-correctness"),
    SECURITY_TRIGGER
      ? () => run("tiger-skills:security-reviewer", sPrompt, "review-security")
      : () => Promise.resolve("SECURITY_VERDICT: APPROVED (skipped — no security-sensitive surface)"),
  ];
  const [q, c, s] = await parallel(thunks);
  return {
    q: q || "REVIEW_VERDICT: CHANGES (quality reviewer did not return)",
    c: c || "CORRECTNESS_VERDICT: CHANGES (correctness reviewer did not return)",
    s: s || "SECURITY_VERDICT: CHANGES (security reviewer did not return)",
  };
};

let reviews = 0;
let { q: qVerdict, c: cVerdict, s: sVerdict } = await reviewCluster(
  `Review independently — you did NOT write this code.
   Handoff/diff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
   FIRST invoke code-quality-review and harness-engineering-review.
   Begin with: 'code-quality-review invoked: YES — 27 items checked, K BLOCKING, M MAJOR'.
   END with one line: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'.`,
  `Adversarially review correctness — assume the code is WRONG and prove it. You did NOT write it.
   Handoff/diff: ${handoff}. Spec: ${F.spec} (read it for acceptance criteria).
   Executor evidence: ${evidence}. Project directory: ${F.dir}.
   FIRST invoke code-correctness-review. Trace control + data flow, enumerate edge cases,
   hunt logic bugs, build the AC-to-test map, and verify an E2E test of the user workflow exists
   (missing E2E for a user-facing feature = BLOCKING).
   Begin with: 'correctness-review invoked: YES — paths traced: P, edge cases: E, logic findings: K, ACs proven by test: X/Y'.
   END with one line: 'CORRECTNESS_VERDICT: APPROVED' or 'CORRECTNESS_VERDICT: CHANGES'.`,
  `Security review — you did NOT write this code.
   Handoff/diff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
   FIRST invoke security-review; audit the 12 categories; run the project's SAST/dep-audit if present.
   Begin with: 'security-review invoked: YES — N categories checked, C critical, H high'.
   END with one line: 'SECURITY_VERDICT: APPROVED' or 'SECURITY_VERDICT: CHANGES'.`
);

const clusterApproved = () =>
  approved(qVerdict) && correctnessOk(cVerdict) && securityOk(sVerdict);

while (!clusterApproved() && reviews < MAX_REVIEW && budget.remaining() > 0) {
  reviews++;
  const findings =
    `QUALITY:\n${qVerdict}\n\nCORRECTNESS:\n${cVerdict}\n\nSECURITY:\n${sVerdict}`;
  handoff = await step("review-fix-" + reviews, () =>
    run("tiger-skills:generator",
      `Fix ONLY the reviewers' BLOCKING/MAJOR/CRITICAL/HIGH findings, and ADD any missing
       unit / regression / per-acceptance-criterion tests they named (the e2e-engineer adds
       any missing E2E next): ${findings}
       Blueprint: ${BP}. Project directory: ${F.dir}. End with a Board Update.`)
  );
  // E2E refresh — re-author/extend the user-flow E2E for the changed behavior and add any
  // E2E flow the reviewers said was missing, BEFORE re-executing.
  e2e = await step("e2e-refresh-review-" + reviews, () =>
    run("tiger-skills:e2e-engineer",
      `Review fixes changed the code. Update/extend the END-TO-END user-flow tests and add any
       E2E flow the reviewers named as missing (one asserting flow per acceptance criterion).
       Do NOT modify feature logic — tests/config only. Reviewer findings: ${findings}
       Generator handoff: ${handoff}. Spec file: ${F.spec}. Project directory: ${F.dir}.
       Invoke e2e-authoring. Begin with:
       'e2e-authoring invoked: YES — stack: <playwright|...>, flows covered: N, ACs asserted: X/Y'.`)
  );
  // Re-verify BEFORE re-reviewing so a regression introduced by the fix surfaces.
  evidence = await step("re-execute-review-" + reviews, () =>
    run("tiger-skills:executor",
      `Re-verify after review fixes. Generator handoff: ${handoff}.
       E2E refreshed by the e2e-engineer: ${e2e}. Project directory: ${F.dir}.
       Run the FULL suite (no early stop) + the E2E workflow test. Fresh evidence only.
       END with one line: 'PIPELINE_STATUS: PASS' or 'PIPELINE_STATUS: FAIL'.`)
  );
  // Re-review cluster — same three checkers, again in parallel.
  ({ q: qVerdict, c: cVerdict, s: sVerdict } = await reviewCluster(
    `Re-review quality. Handoff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
     END with one line: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'.`,
    `Re-review correctness. Handoff: ${handoff}. Spec: ${F.spec}.
     Executor evidence: ${evidence}. Project directory: ${F.dir}.
     END with one line: 'CORRECTNESS_VERDICT: APPROVED' or 'CORRECTNESS_VERDICT: CHANGES'.`,
    `Re-review security. Handoff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
     END with one line: 'SECURITY_VERDICT: APPROVED' or 'SECURITY_VERDICT: CHANGES'.`
  ));
}

// ── GATE 12 — TRACK (scribe writes final state; feature passes only if earned) ─
const tracked = await step("track", () =>
  run("tiger-skills:scribe",
    `Apply the accumulated Board Updates to ${F.dir}/feature_list.json and progress.md.
     Flip remaining tasks[] and acceptance_criteria with evidence. Set ${F.id} to
     'passing' ONLY if every task passes AND every criterion is done AND evidence exists;
     otherwise leave it in_progress/blocked and say why. Record date ${F.today}.
     Final executor evidence: ${evidence}
     Final review cluster verdicts —
       quality: ${qVerdict}
       correctness: ${cVerdict}
       security: ${sVerdict}
     Validate JSON after writing. End with:
     'feature_list.json valid after write: YES — applied N deltas'.`)
);

// The orchestrator returns a compact summary — the heavy intermediate reports
// stayed in each agent's own context, not the main session.
return {
  feature: F.id,
  tasks: TASKS.length,
  generation: FAN_OUT ? "fan-out (waves)" : "sequential",
  passed: passed(evidence),
  e2eAuthored: e2e,
  approved: clusterApproved(),
  qualityApproved: approved(qVerdict),
  correctnessApproved: correctnessOk(cVerdict),
  securityReviewed: SECURITY_TRIGGER,
  securityApproved: securityOk(sVerdict),
  heals,
  reviews,
  track: tracked,
};
