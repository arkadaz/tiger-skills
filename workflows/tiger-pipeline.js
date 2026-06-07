// .claude/workflows/tiger-pipeline.js
//
// Deterministic tiger-skills pipeline — the conductor's GATES 5–12b expressed
// as a fixed, git-committed orchestration script instead of a plan the
// conductor re-improvises each run. Runs ONE already-approved feature through
// the 12-agent pipeline:
//
//   explore → plan → [architect?] → persist-tasks
//           → generate (FAN-OUT: one generator per independent task, in waves)
//           → e2e-author (dedicated opus e2e-engineer writes the user-flow E2E)
//           → execute (full suite + mandatory E2E)
//           → (heal + regression test → regenerate → e2e-refresh → re-execute){≤3}
//           → review cluster: reviewer ‖ correctness-reviewer ‖ [security-reviewer]  (PARALLEL)
//           → (fix → e2e-refresh → re-execute → re-review){≤3} → track
//           → map (cartographer refreshes CODEBASE_MAP.md — architecture + code-flow
//                  diagrams + function chains — so the NEXT run's explorer reads a map)
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
//   v4.9.1 HARDENING: file keys are CANONICALIZED before the disjointness check (two
//   spellings of one path can't share a wave); a dependency CYCLE degrades to strictly
//   sequential solo waves (never an unfiltered parallel wave); gate verdicts parse the
//   LAST status token (fail-closed); every threaded handoff is digest()ed so it stays
//   bounded; heal/review loops require budget HEADROOM so the run always reaches track;
//   NO generator runs git (uniform commit policy — the conductor commits after the run).
//   v4.10.1: MODEL ROUTING IS OPT-IN — by default no model is forced and every agent
//   inherits the session/subagent default (CLAUDE_CODE_SUBAGENT_MODEL honored), so the
//   pipeline runs unchanged on non-Anthropic backends; pass proModel/fastModel to pin.
//   v4.10.2: SPAWN CANARY — if the first agent (explorer) dies at the API level the run
//   aborts immediately with a diagnostic, instead of cascading dozens of doomed spawns
//   through the heal/review loops on a backend that rejects subagent requests.
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
//     when opts.model is omitted the agent inherits the session/subagent default
//     (CLAUDE_CODE_SUBAGENT_MODEL when set, else the session's model). Since v4.10.1
//     that INHERIT is the DEFAULT — the script forces no model name — and per-agent
//     routing (MODEL_FOR) activates only when args.proModel/fastModel are passed.
//     See MODEL ROUTING below for why (non-Anthropic backends reject guessed names).
//   - No fs/shell/Date.now()/Math.random() in the script itself — all I/O happens
//     inside agent prompts (explorer reads, scribe writes state, executor runs tests).
// Launch with /workflows (or save into .claude/workflows/). Start scoped — a run
// spawns many agents and costs far more tokens than a normal turn.

// meta MUST be the first statement and a PURE literal — no vars, no template
// strings, no calls inside it. The runtime reads it before executing anything.
export const meta = {
  name: "tiger-pipeline",
  description: "Run one approved feature through the tiger-skills GATES 5-12b agent pipeline: explorer, planner, code-architect, scribe, generator(s), e2e-engineer, executor, healer, reviewers, cartographer. Generation fans out one generator per independent task (waves); the GATE 11 review cluster (quality+correctness+security) runs in parallel. The opus e2e-engineer authors the user-flow E2E after generate (GATE 7b) and re-runs after every fix; the opus cartographer refreshes CODEBASE_MAP.md after track (GATE 12b). Deterministic and resumable; human grill/spec-approval happens before this runs.",
  // Loop/wave phases get a 1-based suffix at runtime — generation waves emit
  // `generate-w1`, `generate-w2`, …; heal-loop phases `heal-1`, `regenerate-1`, …;
  // review-fix-loop phases `review-fix-1`, … The base titles are all listed here so
  // the declared timeline matches what /workflows shows. (meta stays a pure literal.)
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
    { title: "regenerate" },
    { title: "e2e-refresh" },
    { title: "re-execute" },
    { title: "review-quality" },
    { title: "review-correctness" },
    { title: "review-security" },
    { title: "review-fix" },
    { title: "e2e-refresh-review" },
    { title: "re-execute-review" },
    { title: "track" },
    { title: "map" },
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
//   proModel,         // optional string — PIN the model for every agent (see MODEL ROUTING).
//                     //        UNSET by default ⇒ no model is sent; every agent INHERITS the
//                     //        session/subagent default (CLAUDE_CODE_SUBAGENT_MODEL honored) —
//                     //        the safe choice on any non-Anthropic backend. On an Anthropic
//                     //        session pass e.g. "opus" to pin the strong tier explicitly.
//   fastModel,        // optional string — model for the mechanical agents (explorer, generator,
//                     //        executor, scribe). Falls back to proModel; only meaningful when
//                     //        a pin is set. Pass it to split tiers deliberately.
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

// Each heal/review iteration spawns ~4 agents, and the token budget is a HARD ceiling —
// agent() THROWS once it is spent — so entering another iteration on fumes would kill
// the run mid-loop and lose the GATE 12 track + final summary. Require real headroom
// instead of merely "not yet zero". (remaining() is Infinity when no target is set.)
const LOOP_HEADROOM = 50000; // output tokens one loop iteration safely needs
const hasLoopBudget = () => budget.remaining() > LOOP_HEADROOM;

// phase(title) is a bare marker in the runtime; step() sets the current phase and
// then awaits the gate's work, so the sequential calls below read as one line each.
let CURRENT_PHASE = "init";
const step = async (name, thunk) => {
  CURRENT_PHASE = name;
  phase(name);
  return await thunk();
};

// ── MODEL ROUTING (OPT-IN since v4.10.1) ──────────────────────────────────────
// Per the docs: "Every agent in a workflow uses your session's model unless the
// script routes a stage to a different one." agentType picks an agent's prompt +
// tools but NOT its model — the subagent's frontmatter `model:` is ignored here.
// By DEFAULT this script routes NOTHING: every agent INHERITS the session/subagent
// default — the model your session runs on, or CLAUDE_CODE_SUBAGENT_MODEL when set.
// That is the backend-agnostic path: a hardcoded name like "opus" is rejected at
// request time by a non-Anthropic backend, and even a correct backend name can clash
// with that backend's reasoning/effort parameter handling — inheriting avoids both.
//   • Non-Anthropic backend (recommended): leave proModel unset and set
//     CLAUDE_CODE_SUBAGENT_MODEL=<exact model name, incl. any variant suffix>.
//   • Pin tiers explicitly (e.g. guarantee the strong tier on an Anthropic session
//     whose main loop runs a faster model): pass proModel — and optionally fastModel
//     to split tiers — then MODEL_FOR routes every stage as before.
const PRO = args.proModel || null; // null ⇒ inherit (no model sent with any agent)
const FAST = args.fastModel || PRO; // mechanical agents; falls back to PRO
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
  "tiger-skills:cartographer": PRO, // the map is the reference every future run trusts — never downgrade it
};

// Single swap-point for the subagent selector. One agent = one call.
// Real signature: agent(prompt, opts) — opts.agentType picks the named subagent,
// opts.phase groups it, and opts.model is sent ONLY when routing was requested via
// args (otherwise the agent inherits the session/subagent default — never a guessed
// name a foreign backend would reject). Pass phaseName explicitly inside
// parallel()/pipeline(); it defaults to the sequential CURRENT_PHASE.
const run = (subagentType, prompt, phaseName) => {
  const opts = { agentType: subagentType, phase: phaseName || CURRENT_PHASE };
  const m = MODEL_FOR[subagentType] || PRO;
  if (m) opts.model = m;
  return agent(prompt, opts);
};

// Each gate agent already emits a proof line; we ALSO ask the gate-deciding
// agents (executor, reviewer) to end with a machine-readable status token so
// the loop conditions below are robust rather than fuzzy string-sniffing.
// The parser takes the LAST occurrence of the token — the prompts demand it be the
// final line — so a report that merely QUOTES the approved form earlier (e.g. a
// reviewer echoing "'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'" while
// concluding CHANGES) can never false-approve a gate. Ambiguity fails CLOSED.
const lastVerdict = (report, token) => {
  const s = String(report || "").toUpperCase();
  const at = s.lastIndexOf(token + ":");
  const m = at >= 0 ? s.slice(at + token.length + 1).match(/[A-Z]+/) : null;
  return m ? m[0] : "";
};
const passed = (report) => lastVerdict(report, "PIPELINE_STATUS") === "PASS";
const approved = (report) => lastVerdict(report, "REVIEW_VERDICT") === "APPROVED";
const correctnessOk = (report) => lastVerdict(report, "CORRECTNESS_VERDICT") === "APPROVED";
const securityOk = (report) => lastVerdict(report, "SECURITY_VERDICT") === "APPROVED";

// Bounded handoff digest — keep the head (proof line + summary) and the tail (the
// Board Update block) of an agent report and trim the middle, so every handoff the
// orchestrator threads into later prompts is O(1) per task instead of growing with
// each task's full output. Pure string ops — replay-deterministic. Downstream agents
// re-read the repo for anything trimmed; the Board Update survives in the kept tail.
const digest = (report, max = 2000) => {
  const t = String(report || "");
  if (t.length <= max) return t;
  const head = Math.min(700, Math.floor(max / 2)); // guard: stays correct even if a future call passes a small max
  return t.slice(0, head) +
    "\n…[handoff trimmed — full report stays in that agent's own context]…\n" +
    t.slice(-(max - head));
};

// ── GATE 5a — EXPLORE (read-only recon; builds the Type Inventory) ───────────
const recon = await step("explore", () =>
  run("tiger-skills:explorer",
    `Recon the codebase for ${F.id}: ${F.title}.
     Project directory: ${F.dir}. Spec file: ${F.spec} (read it).
     If ${F.dir}/CODEBASE_MAP.md exists, read it FIRST — it is the maintained map
     (architecture, code flows, function inventory with inputs/outputs). Use it as your
     starting reference, VERIFY the parts this feature touches, and report any drift.
     Produce a Recon Report: Type Inventory (existing types/functions/constants
     with file:line), Module Map, Existing Patterns, Integration Points,
     Already Exists — Do NOT Duplicate, Risks. You are read-only.
     Begin with the proof line: 'Type Inventory built: YES — N existing types catalogued'.`)
);

// ── CANARY — fail fast on a backend-level spawn failure ──────────────────────
// agent() returns null when a subagent dies on a terminal API error after retries.
// If the very FIRST agent can't spawn, every later spawn will fail the same way
// (same session/backend settings) — so abort NOW with a diagnostic instead of
// cascading 30+ doomed spawns through the heal and review loops. Typical causes on
// non-Anthropic backends: a rejected model name, or an invalid thinking-vs-effort
// parameter combination on subagent calls (see workflows/README.md → Troubleshooting).
if (recon === null || recon === undefined) {
  return {
    feature: F.id,
    aborted: "explorer died at spawn (agent returned null) — backend/API incompatibility, " +
      "not a code problem. Known case: backends that reject reasoning_effort together with " +
      "a disabled thinking config — the Workflow RUNTIME builds those request params; " +
      "neither this script nor the plugin can change them. Options: " +
      "(1) remove ALL effort settings (CLAUDE_CODE_EFFORT_LEVEL env var AND effortLevel in " +
      "settings), restart, re-run — no effort param means no conflict; " +
      "(2) skip the Workflow runtime entirely: ask the conductor to run GATES 5-12b " +
      "conversationally for this feature (tiger-skills harness-engineering skill) — the same " +
      "12 agents spawn via the Agent tool, which honors their frontmatter model/effort; " +
      "(3) also confirm CLAUDE_CODE_SUBAGENT_MODEL is your backend's exact model name; " +
      "(4) report the runtime issue via /feedback. " +
      "No code was written or changed; feature state untouched.",
    passed: false,
    approved: false,
  };
}

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
          files: { type: "array", items: { type: "string" }, description: "EVERY file this task creates or edits (repo-relative). The scheduler uses this to keep parallel tasks disjoint; if unsure, list the file — an empty list makes the task run alone." },
          depends_on: { type: "array", items: { type: "string" }, description: "ids of tasks that must finish first — INCLUDING any task whose new/changed file this task reads (read-after-write), so the scheduler never runs them concurrently" },
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
     'blueprintText', and a 'tasks' array. The pipeline runs file-disjoint, dependency-ready
     tasks in PARALLEL, so two fields are SAFETY-CRITICAL, not bookkeeping:
       • 'files' — EVERY file the task creates or edits. If two tasks could write the same file,
         they must NOT both be parallelizable: list the shared file in both. When unsure, list it.
       • 'depends_on' — every task that must finish first, INCLUDING any task whose new/changed
         output this task reads (read-after-write). This is what stops a generator from reading a
         file another generator is still writing.
     Understating either lets two generators collide on the same file. Set 'architectConsulted'
     to 'code-architect consulted: YES/NO — <reason>'.`,
    { agentType: "tiger-skills:planner", phase: "plan", model: MODEL_FOR["tiger-skills:planner"], schema: BLUEPRINT_SCHEMA }
  )
);
// Same canary for the planner: a null here means it died at the API level (the
// explorer's success makes a pure backend failure unlikely, but a dead planner ⇒ no
// blueprint and no tasks[] — generating from a placeholder string would be garbage).
if (blueprint === null || blueprint === undefined) {
  return {
    feature: F.id,
    aborted: "planner died at spawn (agent returned null) after a successful explore — " +
      "transient API failure or backend incompatibility. Re-run the workflow; if it " +
      "recurs, see workflows/README.md → Troubleshooting. No code was written or changed.",
    passed: false,
    approved: false,
  };
}
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
//   SAME-FILE SAFETY: (1) depends_on serializes read-after-write across waves; (2) within a
//   wave the file sets are disjoint AFTER canonicalization (separators, ./, .., case — two
//   spellings of one physical file can never share a wave); (3) a task with no declared
//   files runs ALONE; (4) the state files (feature_list.json, progress.md) are written ONLY
//   by the scribe, never by a generator; (5) a dependency CYCLE degrades to one-task-per-wave
//   — strictly sequential, never an unfiltered parallel wave. So no two concurrent agents
//   ever read+write the same file (as strong as the planner's files[] declarations, which is
//   why the planner prompt marks them SAFETY-CRITICAL and an undeclared task runs alone).
//   MEMORY: parallel generators are told to return CONCISE handoffs (summary + Board Update,
//   no file dumps), and the orchestrator additionally digest()s every handoff it threads
//   onward — head + Board Update tail kept, middle trimmed — so the accumulated handoff is
//   STRUCTURALLY bounded per task, not merely bounded by instruction. Downstream agents
//   re-read the repo for anything trimmed.
// Canonicalize a planner-declared path into the KEY used for the disjointness check, so
// the same physical file under different spellings — 'src/foo.ts', 'src\\foo.ts',
// './src/foo.ts', 'src/../src/foo.ts', case variants — COLLIDES instead of slipping into
// one wave as "disjoint". Pure string ops (no fs/path module), replay-deterministic.
// Lowercasing over-merges on case-SENSITIVE filesystems, but a false conflict only
// over-serializes (runs sequentially — never corrupts); a false disjoint would. The raw
// t.files spellings still go to the generator prompts untouched.
const normFile = (f) => {
  const out = [];
  for (const seg of String(f).trim().replace(/\\/g, "/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else out.push(".."); }
    else out.push(seg);
  }
  return out.join("/").toLowerCase();
};

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
    // Cycle/odd deps ⇒ each remaining task becomes its OWN solo wave: the consumer runs a
    // length-1 wave sequentially, so cycle members that share a file can never collide.
    // (Pushing them as ONE wave would hit the parallel() branch with NO disjointness check.)
    if (!ready.length) { remaining.forEach((t) => waves.push([t])); break; }
    const wave = [];
    const used = new Set();
    for (const t of ready) {
      // Canonicalize FIRST. No declared files, or ANY degenerate path that canonicalizes
      // to '' ('.', '/', 'x/..' — i.e. "the whole tree") ⇒ the footprint is unprovable,
      // and one degenerate entry taints the WHOLE set (the task may touch anything), so
      // fail toward serialization, never toward a possible collision.
      const keys = (t.files || []).map(normFile);
      if (keys.length === 0 || keys.some((k) => !k)) {
        // Unknown file footprint — we can't PROVE it won't touch another task's file,
        // so it is never run alongside anything. Take it alone (empty wave) or defer it
        // behind the tasks already in this wave; either way it ends up a solo wave.
        if (wave.length === 0) wave.push(t);
        break;
      }
      if (keys.some((k) => used.has(k))) continue; // shares a physical file with a wave member ⇒ defer to a later wave
      keys.forEach((k) => used.add(k));
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
     • WRITE ONLY these files: ${(t.files || []).join(", ") || "(only the files this task owns)"}.
       Do not write, and do not READ for editing, any file outside that set — another generator
       may be mid-write on it, so a read could see a half-written file.
     • NEVER touch the shared state files feature_list.json or progress.md — those are the
       scribe's alone; emit a Board Update instead. (Two generators writing them = corruption.)
     • Do NOT run git (no add/commit). Do NOT run installs/formatters that rewrite other files.
     • Do NOT edit shared manifests or barrels (package.json, lockfiles, index/mod/__init__).
     • If you MUST add a dependency or change a shared file, do NOT edit it — list the exact change
       under a 'SHARED-FILE CHANGES NEEDED' heading for the integrate step to apply.
   Before writing: invoke code-quality-language; build a Type Inventory; no placeholders; add this task's unit tests.
   Begin with: 'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
   End with a CONCISE Board Update for ${t.id} — task id, files written, unit pass/fail counts, and any
   'SHARED-FILE CHANGES NEEDED'. Do NOT paste file contents or diffs; the executor and reviewers read the
   repo directly, so keep the handoff to a short summary.`;

// Solo prompt — one task alone in a wave, or the whole-blueprint fallback. The commit
// policy is UNIFORM across solo and parallel generators: no git inside the pipeline —
// the conductor commits after the run, so a half-finished wave is never committed.
const soloPrompt = (scope) =>
  `Implement ${scope} with TDD and the code-quality rules.
   Blueprint: ${BP}
   Architecture notes: ${architecture}
   Project directory: ${F.dir}.
   Do NOT run git (no add/commit) — the conductor commits after the pipeline completes.
   NEVER write feature_list.json or progress.md (the scribe's alone) — emit a Board Update instead.
   Before writing: invoke code-quality-language; build a Type Inventory; no placeholders.
   Produce a Generator Handoff (task IDs, files, Layer 1+2 results) ending with a
   Board Update. Begin with:
   'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.`;

let handoff;
const FAN_OUT = args.sequentialGenerate !== true && TASKS.length >= 2;
if (!FAN_OUT) {
  // Single task, no structured tasks, or forced sequential ⇒ original whole-blueprint generate.
  handoff = digest(await step("generate", () =>
    run("tiger-skills:generator", soloPrompt("this blueprint"))
  ));
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
      handoffs.push(digest(await step(ph, () =>
        run("tiger-skills:generator",
          soloPrompt(`ONLY task ${t.id} — "${t.title}" — from the blueprint (files: ${(t.files || []).join(", ")})`),
          ph)
      )));
    } else {
      // Parallel wave — file-disjoint, no worktrees, write-only. BARRIER: collect all
      // before integrating, because integrate consumes every handoff's deferred changes.
      const results = await parallel(
        wave.map((t) => () =>
          run("tiger-skills:generator", parallelTaskPrompt(t), ph).then((h) => ({ id: t.id, handoff: h }))
        )
      );
      const good = results.filter(Boolean);
      // A dead generator (null) means its task is UNBUILT — say so loudly instead of
      // letting the gap surface only as a confusing executor failure two gates later.
      const dead = wave.filter((t) => !good.some((g) => g.id === t.id));
      if (dead.length)
        log(`generate wave ${i + 1}: ${dead.length} generator(s) died (${dead.map((t) => t.id).join(", ")}) — ` +
            `their tasks are unbuilt; the executor will report FAIL and the heal loop picks them up`);
      handoffs.push(...good.map((g) => `[task ${g.id}]\n${digest(g.handoff)}`));
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
      handoffs.push(`[integrate wave ${i + 1}]\n${digest(integrated)}`);
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
let e2e = digest(await step("e2e-author", () =>
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
));

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
while (!passed(evidence) && heals < MAX_HEAL && hasLoopBudget()) {
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
  handoff = digest(await step("regenerate-" + heals, () =>
    run("tiger-skills:generator",
      `Apply these fixes and ADD the prescribed regression test, nothing more: ${fix}
       Blueprint: ${BP}. Project directory: ${F.dir}.
       Do NOT run git; never write feature_list.json or progress.md (the scribe's alone).
       Before writing: invoke code-quality-language. Begin with:
       'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
       End with a Board Update.`)
  ));
  // E2E refresh — the code changed, so re-author/extend the user-flow E2E (and add an E2E
  // regression flow if the bug was user-visible) BEFORE re-executing, so "write E2E every
  // time" holds and the full re-run confirms the fix broke nothing end to end.
  e2e = digest(await step("e2e-refresh-" + heals, () =>
    run("tiger-skills:e2e-engineer",
      `Code changed via a fix. Update/extend the END-TO-END user-flow tests so they still
       drive the real workflow and cover the fixed behavior; add an E2E regression flow if the
       bug was user-visible. Do NOT modify feature logic — tests/config only.
       Fix applied: ${fix}. Generator handoff: ${handoff}. Spec file: ${F.spec}.
       Project directory: ${F.dir}. Invoke e2e-authoring. Begin with:
       'e2e-authoring invoked: YES — stack: <playwright|...>, flows covered: N, ACs asserted: X/Y'.`)
  ));
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
// SAME-FILE SAFETY: reviewers are read-only on the source, so concurrent READS never
// conflict; the only risk is racing on shared BUILD artifacts (test cache, coverage, SAST
// output). PAR tells each to lean on the executor's fresh evidence and not re-run the full
// suite concurrently — read-only/scoped checks only.
const reviewCluster = async (qPrompt, cPrompt, sPrompt) => {
  const PAR =
    `\n   You run CONCURRENTLY with the other reviewers — work from the source you READ and the
     executor evidence already provided; do NOT re-run the full build/test suite (it races the
     other reviewers on shared artifacts). Scoped, read-only checks are fine.`;
  const thunks = [
    () => run("tiger-skills:reviewer", qPrompt + PAR, "review-quality"),
    () => run("tiger-skills:correctness-reviewer", cPrompt + PAR, "review-correctness"),
    SECURITY_TRIGGER
      ? () => run("tiger-skills:security-reviewer", sPrompt + PAR, "review-security")
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

while (!clusterApproved() && reviews < MAX_REVIEW && hasLoopBudget()) {
  reviews++;
  const findings =
    `QUALITY:\n${qVerdict}\n\nCORRECTNESS:\n${cVerdict}\n\nSECURITY:\n${sVerdict}`;
  handoff = digest(await step("review-fix-" + reviews, () =>
    run("tiger-skills:generator",
      `Fix ONLY the reviewers' BLOCKING/MAJOR/CRITICAL/HIGH findings, and ADD any missing
       unit / regression / per-acceptance-criterion tests they named (the e2e-engineer adds
       any missing E2E next): ${findings}
       Blueprint: ${BP}. Project directory: ${F.dir}.
       Do NOT run git; never write feature_list.json or progress.md (the scribe's alone).
       Before writing: invoke code-quality-language. Begin with:
       'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
       End with a Board Update.`)
  ));
  // E2E refresh — re-author/extend the user-flow E2E for the changed behavior and add any
  // E2E flow the reviewers said was missing, BEFORE re-executing.
  e2e = digest(await step("e2e-refresh-review-" + reviews, () =>
    run("tiger-skills:e2e-engineer",
      `Review fixes changed the code. Update/extend the END-TO-END user-flow tests and add any
       E2E flow the reviewers named as missing (one asserting flow per acceptance criterion).
       Do NOT modify feature logic — tests/config only. Reviewer findings: ${findings}
       Generator handoff: ${handoff}. Spec file: ${F.spec}. Project directory: ${F.dir}.
       Invoke e2e-authoring. Begin with:
       'e2e-authoring invoked: YES — stack: <playwright|...>, flows covered: N, ACs asserted: X/Y'.`)
  ));
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
     Generator Board Updates (from the final handoff): ${handoff}
     E2E engineer Board Update: ${e2e}
     Final executor evidence: ${evidence}
     Final review cluster verdicts —
       quality: ${qVerdict}
       correctness: ${cVerdict}
       security: ${sVerdict}
     Validate JSON after writing. End with:
     'feature_list.json valid after write: YES — applied N deltas'.`)
);

// ── GATE 12b — MAP (cartographer refreshes CODEBASE_MAP.md) ──────────────────
// The cartographer is the SINGLE WRITER of CODEBASE_MAP.md — the living map (Mermaid
// architecture + code-flow diagrams, function chains with real input/output types) that
// the NEXT run's explorer reads first instead of re-discovering the repo. It runs after
// track on every pass (pass or fail — code changed either way), and after every other
// agent has finished, so map reads never race a map write.
const mapped = await step("map", () =>
  run("tiger-skills:cartographer",
    `Feature ${F.id}: ${F.title} just finished a pipeline run
     (executor verdict: ${passed(evidence) ? "PASS" : "FAIL — code still changed, map it anyway"}).
     Update ${F.dir}/CODEBASE_MAP.md — create it if missing — so it matches the code as of ${F.today}:
     re-trace the code flows this feature added or changed (the function chain from each entry
     point — every hop's REAL input/output types and file:line, read from the code, not guessed),
     update the Mermaid architecture + flow diagrams AND their step tables together, refresh the
     function/type inventory, prune entries whose code was deleted, and spot-check unchanged
     anchors for drift.
     Files changed (from the final handoffs): ${handoff}
     E2E entry points driven: ${e2e}
     Write ONLY CODEBASE_MAP.md — never feature code, never feature_list.json/progress.md.
     Do NOT run git. End with:
     'codebase-map updated: YES — flows traced: N, symbols verified: S, diagrams: D, pruned: P'.`)
);

// The orchestrator returns a compact summary — EVERY field is a scalar; the heavy
// intermediate reports stayed in each agent's own context, not the main session.
return {
  feature: F.id,
  tasks: TASKS.length,
  generation: FAN_OUT ? "fan-out (waves)" : "sequential",
  passed: passed(evidence),
  e2eAuthored: /e2e-authoring invoked:\s*YES/i.test(String(e2e || "")),
  approved: clusterApproved(),
  qualityApproved: approved(qVerdict),
  correctnessApproved: correctnessOk(cVerdict),
  securityReviewed: SECURITY_TRIGGER,
  securityApproved: securityOk(sVerdict),
  heals,
  reviews,
  track: /valid after write:\s*YES/i.test(String(tracked || "")),
  mapUpdated: /codebase-map updated:\s*YES/i.test(String(mapped || "")),
};
