// .claude/workflows/tiger-pipeline.js
//
// Deterministic tiger-skills pipeline — the conductor's GATES 5–12 expressed
// as a fixed, git-committed orchestration script instead of a plan the
// conductor re-improvises each run. Runs ONE already-approved feature through
// the 11-agent pipeline:
//
//   explore → plan → [architect?] → persist-tasks → generate
//           → e2e-author (dedicated opus e2e-engineer writes the user-flow E2E)
//           → execute (full suite + mandatory E2E)
//           → (heal + regression test → regenerate → e2e-refresh → re-execute){≤3}
//           → review cluster: reviewer + correctness-reviewer + [security-reviewer]
//           → (fix → e2e-refresh → re-execute → re-review){≤3} → track
//
// ── BOUNDARY ────────────────────────────────────────────────────────────────
// Human-in-the-loop gates are NOT in here. GATE 0 (bootstrap), GATE 1 (grill +
// human spec approval), GATES 2–4 (ledger, clock-in, scope/WIP=1) stay in the
// conversational layer. This workflow assumes: the four harness files exist,
// the feature has a HUMAN-approved spec, and exactly one feature is in_progress.
// It encodes only the mechanical, reproducible part.
//
// ── API — the documented dynamic-workflow runtime (Claude Code ≥ 2.1.154) ──────
// Matched to https://code.claude.com/docs/en/workflows and the Workflow runtime:
//   - meta is `export const meta = {…}` (a PURE literal, the first statement) — NOT meta(…).
//   - agent(prompt, opts) — a named subagent is selected via opts.agentType (see run()).
//   - phase(title) is a BARE void marker; agents that follow are grouped under it.
//     We wrap it in step(name, thunk) so the sequential gate calls below read cleanly.
//   - parallel(thunks) / pipeline(items, …stages) for fan-out; budget.* for caps.
//   - MODEL — opts.agentType picks the subagent's PROMPT + TOOLS, but NOT its model.
//     The Workflow runtime does NOT read the subagent's frontmatter `model:` field;
//     when opts.model is omitted the agent inherits the SESSION'S main-loop model.
//     So the per-agent `model: opus|sonnet` set in agents/*.md is silently ignored
//     here unless we pass opts.model explicitly — without it, a session running on a
//     fast/"flash" model runs ALL 11 agents on flash, including the ones meant to be
//     the strong "pro" tier. run() therefore passes opts.model per agent (see MODEL_FOR).
//   - No fs/shell/Date.now()/Math.random() in the script itself — all I/O happens
//     inside agent prompts (explorer reads, scribe writes state, executor runs tests).
// Launch with /workflows (or save into .claude/workflows/). Start scoped — a run
// spawns many agents and costs far more tokens than a normal turn.

// meta MUST be the first statement and a PURE literal — no vars, no template
// strings, no calls inside it. The runtime reads it before executing anything.
export const meta = {
  name: "tiger-pipeline",
  description: "Run one approved feature through the tiger-skills GATES 5-12 agent pipeline: explorer, planner, code-architect, scribe, generator, e2e-engineer, executor, healer, reviewer. The opus e2e-engineer authors the user-flow E2E after generate (GATE 7b) and re-runs after every fix. Deterministic and resumable; human grill/spec-approval happens before this runs.",
  phases: [
    { title: "explore" },
    { title: "plan" },
    { title: "architect" },
    { title: "persist-tasks" },
    { title: "generate" },
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
//   proModel,         // optional string — model for the strong "pro" agents (reasoning/judgment:
//                     //        planner, architect, healer, e2e-engineer, the 3 reviewers).
//                     //        Defaults to "opus". On a non-Anthropic backend pass your strong
//                     //        model's name, e.g. "deepseek-v4-pro".
//   fastModel         // optional string — model for the mechanical agents (explorer, generator,
//                     //        executor, scribe). Defaults to "sonnet". Pass e.g.
//                     //        "deepseek-v4-flash" on a proxy whose tiers are named differently.
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

// ── MODEL ROUTING (the fix for "every agent runs on the session model") ───────
// Per the docs: "Every agent in a workflow uses your session's model unless the
// script routes a stage to a different one." agentType picks an agent's prompt +
// tools but NOT its model — the subagent's frontmatter `model:` is ignored here.
// So we route each stage explicitly, mirroring the intent declared in agents/*.md:
// the reasoning/judgment agents get the strong "pro" tier; the mechanical agents
// get the fast tier. Both tiers are overridable via args for non-Anthropic backends
// (e.g. a proxy whose tiers are named "deepseek-v4-pro" / "deepseek-v4-flash").
const PRO = args.proModel || "opus"; // strong tier: reasoning, decomposition, judgment
const FAST = args.fastModel || "sonnet"; // fast tier: mechanical traversal / generation / I/O
const MODEL_FOR = {
  "tiger-skills:explorer": FAST, // agents/explorer.md   → model: sonnet
  "tiger-skills:planner": PRO, // agents/planner.md    → model: opus
  "tiger-skills:code-architect": PRO, // agents/code-architect.md → model: opus
  "tiger-skills:scribe": FAST, // agents/scribe.md     → model: sonnet
  "tiger-skills:generator": FAST, // agents/generator.md  → model: sonnet
  "tiger-skills:e2e-engineer": PRO, // agents/e2e-engineer.md   → model: opus
  "tiger-skills:executor": FAST, // agents/executor.md   → model: sonnet
  "tiger-skills:healer": PRO, // agents/healer.md     → model: opus
  "tiger-skills:reviewer": PRO, // agents/reviewer.md   → model: opus
  "tiger-skills:correctness-reviewer": PRO, // agents/correctness-reviewer.md → model: opus
  "tiger-skills:security-reviewer": PRO, // agents/security-reviewer.md → model: opus
};

// Single swap-point for the subagent selector. One agent = one call.
// Real signature: agent(prompt, opts) — opts.agentType picks the named subagent,
// opts.phase groups it in the progress view under the current step, and opts.model
// routes the stage to its tier (without it the agent inherits the session model).
const run = (subagentType, prompt) =>
  agent(prompt, {
    agentType: subagentType,
    phase: CURRENT_PHASE,
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

// ── GATE 5b — PLAN (blueprint + the persisted tasks[] JSON) ──────────────────
const blueprint = await step("plan", () =>
  run("tiger-skills:planner",
    `Plan the implementation for ${F.id}: ${F.title}.
     Spec file: ${F.spec} (read it for decisions + acceptance criteria).
     Recon Report (do NOT re-explore): ${recon}
     Project directory: ${F.dir}.
     Produce a blueprint: Context → Task Breakdown → Execution Phases → Risks,
     ending with a 'Persisted Task Breakdown (JSON)' array — each task
     {id,title,agent,status:'not_started',files,depends_on,verification}.
     Begin with: 'code-architect consulted: YES/NO — <reason>'.`)
);

// ── GATE 6 — ARCHITECT (only when a trigger fires — a deterministic boolean) ─
let architecture = "(architect gate skipped — no structural trigger)";
if (ARCHITECT_TRIGGER) {
  architecture = await step("architect", () =>
    run("tiger-skills:code-architect",
      `Review the architecture for this blueprint:
       ${blueprint}
       FIRST invoke code-quality-audit, THEN map findings to patterns.
       Produce: Summary → Violations (file:line) → Pattern Recommendations → Verdict.
       Begin with: 'code-quality-audit invoked: YES — N principles checked, M violations'.`)
  );
}

// ── GATE 5c — PERSIST tasks[] (scribe is the single writer; I/O lives here) ──
await step("persist-tasks", () =>
  run("tiger-skills:scribe",
    `Apply this Board Update to ${F.dir}/feature_list.json for ${F.id}:
     write the planner's 'Persisted Task Breakdown (JSON)' into the feature's tasks[].
     Blueprint: ${blueprint}
     Validate the JSON after writing (Windows: PowerShell ConvertFrom-Json; never bare python).
     End with: 'feature_list.json valid after write: YES — applied N deltas'.`)
);

// ── GATE 7 — GENERATE ────────────────────────────────────────────────────────
let handoff = await step("generate", () =>
  run("tiger-skills:generator",
    `Implement this blueprint with TDD and the code-quality rules.
     Blueprint: ${blueprint}
     Architecture notes: ${architecture}
     Project directory: ${F.dir}.
     Before writing: invoke code-quality-language; build a Type Inventory; no placeholders.
     Produce a Generator Handoff (task IDs + commits, files, Layer 1+2 results) ending
     with a Board Update. Begin with:
     'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.`)
);

// ── GATE 7b — E2E AUTHOR (NEW: dedicated opus e2e-engineer, runs AFTER generate) ─
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
let heals = 0;
while (!passed(evidence) && heals < MAX_HEAL && budget.remaining() > 0) {
  heals++;
  const fix = await step("heal-" + heals, () =>
    run("tiger-skills:healer",
      `Diagnose and prescribe a fix. Executor escalation: ${evidence}
       Blueprint: ${blueprint}. Project directory: ${F.dir}.
       Invoke harness-engineering-diagnose; classify to one of five layers; give exact
       file:line fix instructions AND a MANDATORY failing-first regression test (fails on the
       broken code, passes after the fix; E2E if the bug was user-visible). Begin with:
       'harness-engineering-diagnose invoked: YES — layer: <X>'.`)
  );
  handoff = await step("regenerate-" + heals, () =>
    run("tiger-skills:generator",
      `Apply these fixes and ADD the prescribed regression test, nothing more: ${fix}
       Blueprint: ${blueprint}. Project directory: ${F.dir}. End with a Board Update.`)
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

// ── GATE 11 — REVIEW CLUSTER (three independent checkers; guarded) ────────────
// Quality + correctness run ALWAYS; security runs only when SECURITY_TRIGGER is
// set. The loop continues while ANY required reviewer is not APPROVED. After each
// round of fixes we RE-EXECUTE the full suite + E2E first, so a review fix that
// breaks another part is caught before the re-review rubber-stamps it.
let reviews = 0;
let qVerdict = await step("review-quality", () =>
  run("tiger-skills:reviewer",
    `Review independently — you did NOT write this code.
     Handoff/diff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
     FIRST invoke code-quality-review and harness-engineering-review.
     Begin with: 'code-quality-review invoked: YES — 27 items checked, K BLOCKING, M MAJOR'.
     END with one line: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'.`)
);
let cVerdict = await step("review-correctness", () =>
  run("tiger-skills:correctness-reviewer",
    `Adversarially review correctness — assume the code is WRONG and prove it. You did NOT write it.
     Handoff/diff: ${handoff}. Spec: ${F.spec} (read it for acceptance criteria).
     Executor evidence: ${evidence}. Project directory: ${F.dir}.
     FIRST invoke code-correctness-review. Trace control + data flow, enumerate edge cases,
     hunt logic bugs, build the AC-to-test map, and verify an E2E test of the user workflow exists
     (missing E2E for a user-facing feature = BLOCKING).
     Begin with: 'correctness-review invoked: YES — paths traced: P, edge cases: E, logic findings: K, ACs proven by test: X/Y'.
     END with one line: 'CORRECTNESS_VERDICT: APPROVED' or 'CORRECTNESS_VERDICT: CHANGES'.`)
);
let sVerdict = SECURITY_TRIGGER
  ? await step("review-security", () =>
      run("tiger-skills:security-reviewer",
        `Security review — you did NOT write this code.
         Handoff/diff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
         FIRST invoke security-review; audit the 12 categories; run the project's SAST/dep-audit if present.
         Begin with: 'security-review invoked: YES — N categories checked, C critical, H high'.
         END with one line: 'SECURITY_VERDICT: APPROVED' or 'SECURITY_VERDICT: CHANGES'.`))
  : "SECURITY_VERDICT: APPROVED (skipped — no security-sensitive surface)";

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
       Blueprint: ${blueprint}. Project directory: ${F.dir}. End with a Board Update.`)
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
  qVerdict = await step("re-review-quality-" + reviews, () =>
    run("tiger-skills:reviewer",
      `Re-review quality. Handoff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
       END with one line: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'.`)
  );
  cVerdict = await step("re-review-correctness-" + reviews, () =>
    run("tiger-skills:correctness-reviewer",
      `Re-review correctness. Handoff: ${handoff}. Spec: ${F.spec}.
       Executor evidence: ${evidence}. Project directory: ${F.dir}.
       END with one line: 'CORRECTNESS_VERDICT: APPROVED' or 'CORRECTNESS_VERDICT: CHANGES'.`)
  );
  if (SECURITY_TRIGGER) {
    sVerdict = await step("re-review-security-" + reviews, () =>
      run("tiger-skills:security-reviewer",
        `Re-review security. Handoff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
         END with one line: 'SECURITY_VERDICT: APPROVED' or 'SECURITY_VERDICT: CHANGES'.`)
    );
  }
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
