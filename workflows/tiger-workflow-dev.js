// .claude/workflows/tiger-workflow-dev.js
//
// Deterministic Tiger spine — the v2 pipeline (docs/dev-loop-v2.md) expressed as a saved
// dynamic workflow. Runs ONE already-approved feature (grill happened conversationally
// BEFORE this) through:
//
//   bootstrap (sonnet)  — discover the approved in-progress feature from the board,
//                         verify the approval token, resolve today + branch base. This
//                         is what makes `/tiger-workflow-dev` work with NO args.
//     → architect (opus) — recon + blueprint + per-task plan + board plan commit
//     → for each dependency WAVE of the architect's tasks[]:
//         • 1-task wave  → solo code generator (sonnet): TDD + ONE commit on feature/<id>
//         • N-task wave  → parallel( code generators in ISOLATED GIT WORKTREES, one per task:
//                            full TDD + full verify + ONE commit on a per-task branch )
//                          → integrator (sonnet): cherry-pick the disjoint branches onto
//                            feature/<id>, run the full suite once, ONE board commit
//     → e2e (opus) ONCE after every wave is built — the SINGLE quality gate. Runs the
//         grill's robot suite + the architect's acceptance checks for real and triages
//         every failure by PRIORITY: HIGH + MEDIUM block and ALWAYS return to the ARCHITECT to
//         RE-PLAN — the open blockers become delta tasks that rebuild and re-e2e (never a quick
//         patch); ≤2 no-progress rounds / 6-round cap → blocked. LOW is a non-blocking known issue.
//     → update docs (opus) — docs + README refresh → board close-out → rebase onto MAIN → MR
//
// ── WHY this shape (the v2 redesign — speed) ──────────────────────────────────
//   A. NO in-loop security/reviewer gates. The old spine ran security ∥ reviewer (opus)
//      on EVERY wave with up to 3 fix-up rounds each — the dominant cost. v2 removes them
//      from the workflow; tiger-security / tiger-reviewer remain as STANDALONE skills the
//      human invokes on demand. In-loop coverage moves to where it is cheap: the generator
//      writes to the tiger-code-quality principles + runs its own unit tests (TDD), and the
//      e2e gate triages real-execution bugs by priority.
//   B. e2e runs ONCE, after all waves land — not per wave. "End-to-end" on a half-built
//      feature is premature; this removes ~(N-1) opus e2e runs per feature.
//   C. Independent tasks in a wave build CONCURRENTLY in isolated git worktrees
//      (isolation: 'worktree'). The architect's tasks[].files prove the wave is pairwise
//      FILE-DISJOINT in-script, so each worktree generator runs its FULL natural TDD cycle
//      (RED → GREEN → full verify → commit) in parallel; integration is then cheap
//      cherry-picks of disjoint-file commits. The one rule that keeps the merge conflict-free:
//      worktree generators commit only their own code/test files, NEVER the shared board
//      (feature_list.json) or progress.md — the integrator records those serially.
//   D. NO required args. bootstrap reads the board to find the feature and resolves the date;
//      a bare `/tiger-workflow-dev` just works. Args (if given) override the discovery.
//
// ── Git contract (trunk-based on MAIN) ────────────────────────────────────────
//   • grill        → commits tiger/features/<id>/* + the board WHY/SPECIFY entry (BEFORE this)
//   • architect    → ensures feature/<id> off main; enriches the board + COMMITS it
//                    (chore(board): <id> plan …); bootstraps tiger/codemap.html if missing
//   • code gen     → ONE semantic commit per task: solo path on feature/<id>; parallel path
//                    on a per-task branch in an isolated worktree (code/tests ONLY)
//   • integrator   → cherry-picks the wave's disjoint branches onto feature/<id>, then ONE
//                    board commit (task statuses + progress.md) for the wave
//   • e2e          → git note in refs/notes/e2e (the bug-priority grade) + COMMITS the board phase
//   • update docs  → commits docs + board close-out; rebase onto MAIN → push → MR; NEVER merges
// (refs/notes/security and refs/notes/review are written ONLY when the human runs those
//  standalone gates — the workflow no longer touches them.)
//
// ── BOUNDARY — what stays conversational, before this script ──────────────────
//   • tiger-grill interviews the human one question at a time and writes
//     tiger/features/<id>/{spec,adr,business}.html + e2e_testcases.robot (a skill, inline).
//   • Explicit human approval: the anchored token <meta name="tiger-status" content="approved">
//     in spec.html — the ONLY human gate. bootstrap re-checks it and aborts if absent.
//   • WIP=1 + board invariants (scripts/validate-board.py), rm guard install, main branch.
//
// ── MODEL ROUTING ──────────────────────────────────────────────────────────────
// Mirrors each agent file's frontmatter (the declared source of truth): opus for
// architect/e2e/update-docs, sonnet for bootstrap + the code generator. Non-Anthropic
// backends reject the aliases — pass proModel/fastModel, or "inherit" to send no model.
//
// Launch by registered name (a saved workflow is its own slash command) or via
// Workflow({ name: "tiger-workflow-dev" }). No args needed once a spec is approved.

export const meta = {
  name: "tiger-workflow-dev",
  description:
    "Run ONE human-approved Tiger feature through the v2 pipeline. bootstrap (sonnet) DISCOVERS the approved in-progress feature from feature_list.json and re-checks the spec.html approval token — so a bare /tiger-workflow-dev with NO args just works; any of {featureId, specFile, projectDir, today} you pass override the discovery. Then tiger-architect (opus) blueprints + writes per-task plan into the board; the architect's tasks[] build in DEPENDENCY WAVES — independent, file-disjoint tasks build by tiger-code-generator subagents IN PARALLEL, each in its own ISOLATED GIT WORKTREE (full TDD + full verify + one commit on a per-task branch), then cherry-picked onto feature/<id> by a serial integrator. After every wave is built, tiger-e2e (opus) runs ONCE as the single quality gate: it executes the grill's e2e_testcases.robot suite + the architect's acceptance checks for real and triages every failure by PRIORITY — HIGH + MEDIUM block and ALWAYS return to the architect to RE-PLAN: the open blockers become delta tasks that rebuild through the wave machinery and re-e2e (never a quick patch), bounded by MAX_STUCK no-progress rounds + an overall round cap → blocked; LOW is logged as a non-blocking known issue. Finally tiger-update-docs (opus) refreshes codemap/business/release HTML + README, closes the board, rebases onto MAIN (trunk-based) and opens the MR (never merges). The in-loop security ∥ reviewer gates were REMOVED for speed; tiger-security / tiger-reviewer stay as standalone skills. The human gates (grill interview, spec.html approval, WIP=1, rm guard, main branch) run conversationally BEFORE this.",
  phases: [
    { title: "bootstrap", detail: "discover the approved in-progress feature from the board + branch base + today", model: "sonnet" },
    { title: "architect", detail: "recon + blueprint + per-task plan + board plan commit", model: "opus" },
    { title: "build", detail: "code generators: parallel per-task worktrees per dependency wave", model: "sonnet" },
    { title: "integrate", detail: "cherry-pick disjoint branches onto feature/<id> + board commit", model: "sonnet" },
    { title: "e2e", detail: "single bug-priority robot gate — HIGH+MEDIUM always return to the architect to re-plan, LOW logged", model: "opus" },
    { title: "replan", detail: "every e2e failure → architect re-plans the blockers as delta tasks → rebuild → re-e2e", model: "opus" },
    { title: "finalize", detail: "update docs: codemap/business/release/README refresh, board close-out, rebase onto main, MR", model: "opus" },
  ],
};

// ── Args are ALL optional now — bootstrap discovers what is missing. ───────────
const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");

// e2e loop caps — "do it right" mode: EVERY e2e CHANGES escalates straight to an architect
// RE-PLAN (delta tasks → rebuild → re-e2e). There is NO quick code-gen patch tier — a failing
// gate always returns to the architect to fix the root scope gap properly. Only a NO-PROGRESS
// re-plan round (the open HIGH+MEDIUM count didn't drop and no task landed) advances the stuck
// counter, so a feature that legitimately needs several re-plans — each closing real blockers —
// is not force-blocked; MAX_STUCK no-progress rounds OR the MAX_E2E_ROUNDS overall cap (or an
// exhausted token budget) ⇒ phase: blocked.
const MAX_STUCK = 2;
const MAX_E2E_ROUNDS = 6;
const LOOP_HEADROOM = 60000; // one e2e → re-plan + rebuild round, safely
const hasLoopBudget = () => budget.remaining() > LOOP_HEADROOM;

// Model tiers mirror the agent frontmatter. "inherit" ⇒ send no model (backend-safe).
const pick = (v, dflt) => (v === "inherit" ? null : v || dflt);
const PRO = pick(A.proModel, "opus");
const FAST = pick(A.fastModel, "sonnet");
const MODEL_FOR = { bootstrap: FAST, architect: PRO, generator: FAST, e2e: PRO, docs: PRO };
const AG = {
  architect: "tiger-skills:tiger-architect",
  generator: "tiger-skills:tiger-code-generator",
  e2e: "tiger-skills:tiger-e2e",
  docs: "tiger-skills:tiger-update-docs",
};
// bootstrap uses the default workflow subagent (it only reads the board + runs git/date);
// the named stage agents are spawned by agentType.
const spawn = (key, prompt, phaseName, extra = {}) =>
  agent(prompt, {
    ...(AG[key] ? { agentType: AG[key] } : {}),
    phase: phaseName,
    ...(MODEL_FOR[key] ? { model: MODEL_FOR[key] } : {}),
    ...extra,
  });

// ── Machine-readable verdicts — fail CLOSED ───────────────────────────────────
// Parse the token off a LINE that BEGINS with 'TOKEN:' (optionally indented), not an
// arbitrary substring. A menu echo ('TIGER_E2E: <PASS|CHANGES|BLOCKED>') never matches —
// '<' is not a bare word — and prose that merely mentions the token mid-sentence is not at
// line start, so it can't false-decide a gate. We take the LAST matching line, so a restated
// final answer wins but a quoted menu/caveat cannot. Absent/garbled ⇒ CHANGES, never a false
// PASS or BLOCKED.
const upper = (r) => String(r || "").toUpperCase();
const lastTokenLine = (report, token) => {
  // ^|\n start-of-line, optional spaces/tabs, TOKEN:, optional spaces/tabs, then the rest.
  const re = new RegExp("(?:^|\\n)[^\\S\\n]*" + token.toUpperCase() + ":[^\\S\\n]*([^\\n]*)", "g");
  let m, last = null;
  const s = upper(report);
  while ((m = re.exec(s)) !== null) last = m[1];
  return last; // null if no such line
};
const lastToken = (report, token) => {
  const line = lastTokenLine(report, token);
  const m = line == null ? null : line.match(/^([A-Z_]+)/);
  return m ? m[1] : "";
};
const verdictOf = (report, token) => {
  const v = lastToken(report, token);
  return v === "PASS" || v === "BLOCKED" ? v : "CHANGES";
};
const featureComplete = (report) => lastToken(report, "FEATURE_COMPLETE") === "YES";
const finalizeStatus = (report) => lastToken(report, "FINALIZE_STATUS");
const tasksProgress = (report) => {
  const line = lastTokenLine(report, "TASKS_DONE");
  const m = line == null ? null : line.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { done: +m[1], total: +m[2] } : { done: 0, total: 0 };
};
// e2e reports its bug counts on the E2E_BLOCKERS line; read high/medium/low from THAT line
// only (the report body + the git-note 'blockers:' line also contain 'high=' etc.).
const e2eBlockers = (report) => {
  const line = lastTokenLine(report, "E2E_BLOCKERS") || "";
  const grab = (k) => {
    const m = line.match(new RegExp(k + "\\s*=\\s*(\\d+)"));
    return m ? +m[1] : 0;
  };
  return { high: grab("HIGH"), medium: grab("MEDIUM"), low: grab("LOW") };
};
// Bounded handoff digest — O(1) per round; disk state is authoritative for anything trimmed.
const digest = (report, max = 1800) => {
  const t = String(report || "");
  if (t.length <= max) return t;
  const head = Math.min(700, Math.floor(max / 2));
  return t.slice(0, head) + "\n…[handoff trimmed — disk state is authoritative]…\n" + t.slice(-(max - head));
};

// ── PHASE: BOOTSTRAP — discover the feature from the board (fixes the arg errors) ──
const BOOTSTRAP_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["abort"],
  properties: {
    featureId: { type: "string" },
    featureTitle: { type: "string" },
    specFile: { type: "string" },
    projectDir: { type: "string" },
    today: { type: "string", description: "YYYY-MM-DD from `date +%F` — never invented." },
    branchBase: { type: "string", description: "The trunk to branch/rebase from — `main`." },
    phase: { type: "string", description: "The board's current phase pointer for this feature." },
    approved: { type: "boolean" },
    abort: { type: ["string", "null"], description: "Reason to abort, or null when everything is ready." },
  },
};

phase("bootstrap");
const boot = await spawn(
  "bootstrap",
  `You are the DISCOVERY PREFLIGHT for the Tiger dev workflow. Do NOT plan, code, or commit —
   just read the board, resolve the build context, and return it. Work in the current project
   directory (you are already in it).

   Optional caller hints (use a hint ONLY if it is non-empty; otherwise discover the value):
     featureId  = "${argStr("featureId")}"
     specFile   = "${argStr("specFile")}"
     today      = "${argStr("today")}"
     projectDir = "${argStr("projectDir")}"

   STEPS:
   1. projectDir = the hint if given, else \`pwd\`. today = the hint if given, else \`date +%F\`.
   2. Read feature_list.json (project root). Choose the feature to build, in this order:
        (a) the featureId hint, if given and present in features;
        (b) current_feature, if set;
        (c) the SINGLE feature whose status is "in_progress".
      If none of these yields exactly one feature, abort: "no single in-progress feature on the
      board — run tiger-grill to create + approve one, or pass featureId". Report its phase.
   3. featureTitle = that feature's title. specFile = the specFile hint, else its spec_file,
      else "tiger/features/<id>/spec.html".
   4. APPROVAL GATE (the only human gate): confirm spec.html carries the exact token —
        grep -q '<meta name="tiger-status" content="approved">' "<specFile>"
      Set approved accordingly. If NOT approved, abort: "spec not approved (<specFile>) — run
      tiger-grill and get the explicit human yes first".
   5. branchBase = "main" (this kit is trunk-based: feature branches off main and rebase onto
      main). Confirm main exists: \`git rev-parse --verify main\` (or \`git rev-parse --verify
      origin/main\`). If neither exists, abort: "no main branch — this kit is trunk-based; create
      main first".
   6. If the chosen feature's status is already "passing" (phase: passing), abort: "feature <id>
      is already passing — nothing to build".

   Return the structured object. Set abort to null ONLY when a single approved feature is ready
   to build on main; otherwise put the human-readable reason in abort and leave the rest best-effort.`,
  "bootstrap",
  { schema: BOOTSTRAP_SCHEMA }
);

if (boot === null || boot === undefined) {
  return {
    aborted:
      "bootstrap agent died at spawn (returned null) — backend/API incompatibility, not a board " +
      "problem. Pass proModel/fastModel matching your backend's exact model names (or \"inherit\"), " +
      "then re-run. No file was touched.",
    passed: false,
  };
}
if (boot.abort) {
  return {
    aborted: boot.abort,
    howToFix:
      "Finish the conversational gates first: run tiger-grill (one question at a time) until " +
      "tiger/features/<id>/{spec,adr,business}.html + e2e_testcases.robot exist and spec.html " +
      "carries <meta name=\"tiger-status\" content=\"approved\">; ensure WIP=1 (one in_progress " +
      "feature) and that the `main` branch exists. Then re-run /tiger-workflow-dev — no args needed.",
    passed: false,
  };
}

const F = {
  id: boot.featureId,
  title: boot.featureTitle || boot.featureId,
  spec: boot.specFile || `tiger/features/${boot.featureId}/spec.html`,
  dir: boot.projectDir || ".",
  today: boot.today || "",
  base: boot.branchBase || "main",
};
if (!F.id) {
  return { aborted: "bootstrap returned no featureId and no abort reason — cannot proceed.", passed: false };
}
log(`bootstrap: feature ${F.id} ("${F.title}"), spec ${F.spec}, base ${F.base}, today ${F.today}. Approved ✓.`);

// ── PHASE: ARCHITECT (recon → blueprint → per-task plan + board commit) ────────────
const BLUEPRINT_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["blueprintText", "tasks", "acceptanceChecks"],
  properties: {
    blueprintText: { type: "string", description: "Prose blueprint: Scope Map → Component Design → Build Sequence → Metric Plan → Risks." },
    tasks: {
      type: "array",
      description: "The persisted task breakdown written into feature_list.json tasks[].",
      items: {
        type: "object",
        additionalProperties: true,
        required: ["id", "title"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          files: {
            type: "array",
            items: { type: "string" },
            description:
              "The EXACT files this task creates or modifies (its write scope). Used to pack file-disjoint parallel build waves — tasks with overlapping files[] never run concurrently, so the integrator's cherry-pick of the per-task worktree branches stays conflict-free. An over-broad files[] serializes work that could parallelize; a file two tasks both write but one omits makes the cherry-pick collide; a missing files[] forces the task to run alone.",
          },
          depends_on: { type: "array", items: { type: "string" } },
          context: {
            type: "string",
            description:
              "The per-task build brief for the (possibly parallel, isolated-worktree) generator that has nothing but the board: WHERE this code lives (module/dir from the codemap), WHICH existing patterns/types/functions to reuse (file:line), HOW it connects to sibling tasks, and the one acceptance behavior it must satisfy. This is the 'where to do it' the parallel generators need.",
          },
          verification: {
            type: "string",
            description:
              "The task's own test command for RED→GREEN evidence. Each parallel task builds in an isolated git worktree, so a full run is fine here; the integrator runs the full suite once after the merge.",
          },
        },
      },
    },
    acceptanceChecks: {
      type: "array",
      description: "Every acceptance criterion with a concrete, non-degenerate runnable command, each proven RED now.",
      items: {
        type: "object",
        additionalProperties: true,
        required: ["id", "command"],
        properties: {
          id: { type: "string" },
          criterion: { type: "string" },
          command: { type: "string" },
          expectedExit: { type: ["integer", "string"] },
          expectedStdout: { type: "string" },
        },
      },
    },
    metric: { type: "object", additionalProperties: true },
  },
};

phase("architect");
const blueprint = await spawn(
  "architect",
  `Plan ONE approved feature end-to-end as the Tiger Architect.
   Feature id: ${F.id}
   Feature title: ${F.title}
   Spec artifact: ${F.spec}  (READ IT FULLY, plus the sibling adr.html, business.html, and the
   Robot Framework e2e_testcases.robot suite in tiger/features/${F.id}/ — requirements, CAN/CANNOT,
   the metric, and the agreed e2e cases all come from those grill artifacts.)
   Codemap: read tiger/codemap.html if it exists (your structural input). If it does NOT exist,
   bootstrap it from tiger/templates/codemap.html with a mermaid map of the real codebase first.
   Project directory: ${F.dir}
   Trunk: ${F.base}      Today: ${F.today}

   SAFETY NET (idempotent, trunk-based): before any commit, ensure the feature branch off ${F.base}
   so you never commit onto ${F.base}:
     git checkout -b feature/${F.id} ${F.base} 2>/dev/null || git checkout feature/${F.id}

   Execute your Architect phases: recon → blueprint → per-task plan → board enrichment.
     • Recon: verify the spec's scope claims against the real codebase (cite file:line).
     • Blueprint: Scope Map (MODIFY / READ-ONLY / METRIC), Component Design + Architecture
       Decision to the tiger-code-quality skill (single responsibility, code to the interface,
       composition over inheritance, encapsulate what varies), and the phased task breakdown.
     • Runnable acceptance checks (MANDATORY + NON-DEGENERATE): one concrete shell command per
       criterion; RUN each yourself now and confirm it fails RED before any code exists.
   PARALLEL-BUILD INPUT (load-bearing): the workflow builds your tasks[] in dependency waves and
   runs file-DISJOINT tasks in a wave CONCURRENTLY, each generator in its own isolated git worktree
   (it sees ONLY the board — your per-task \`context\` brief — NOT the codemap and NOT this chat; YOU are
   the sole reader of the codemap, so you MUST distill its relevant structure into each task's context).
   For that to be safe AND for each generator to know where to work, every task MUST carry:
     (a) accurate depends_on;
     (b) a precise files[] = the exact files that task writes (its MODIFY scope) — disjoint files
         across a wave are what keep the cherry-pick conflict-free; a task with no files[] runs alone;
     (c) a concrete \`context\` brief: WHERE the code lives (module/dir per the codemap), WHICH
         existing patterns/types to reuse (file:line), HOW it connects to sibling tasks, and the one
         behavior it must satisfy — this is the "where to do it" a fresh parallel generator needs;
     (d) its own \`verification\` test command (the worktree is isolated, so a full run is fine).
   GRILL ALREADY CREATED this feature's entry in feature_list.json (WHY/SPECIFY fields, status:
   in_progress, phase: plan). ENRICH it in place — add scope_map.modify/read_only and tasks[] (with
   files[], depends_on, context, verification), and make every acceptance_criteria verification a
   concrete RED-proven command. Do NOT rewrite grill's WHY/SPECIFY fields, never create a duplicate
   entry, keep phase: plan and the links reciprocal + acyclic. Then COMMIT:
     git add feature_list.json tiger/codemap.html && git commit -m "chore(board): ${F.id} plan — scope + tasks (phase: plan)"
   This is your ONLY commit — never code, never a git note, never a phase move past plan.

   RETURN the structured blueprint (blueprintText, tasks[], acceptanceChecks[], metric).`,
  "architect",
  { schema: BLUEPRINT_SCHEMA }
);

if (blueprint === null || blueprint === undefined) {
  return {
    feature: F.id,
    aborted:
      "tiger-architect died at spawn (agent returned null) — backend/API incompatibility, not a " +
      "code problem. Pass proModel/fastModel matching your backend's exact model names (or " +
      "\"inherit\"), then re-run. No file was touched beyond bootstrap (read-only).",
    passed: false,
  };
}

const BP = blueprint.blueprintText || "(no prose blueprint — read feature_list.json on disk)";
const TASKS = Array.isArray(blueprint.tasks) ? blueprint.tasks : [];
const CHECKS = Array.isArray(blueprint.acceptanceChecks) ? blueprint.acceptanceChecks : [];
const tasksTotal = TASKS.length;

// ── Dependency-wave packing (pure, in-script — no agent) ──────────────────────
// Layer tasks by satisfied depends_on, then within a ready layer GREEDILY pack a parallel
// wave of pairwise FILE-DISJOINT tasks. A task with no files[] has unknown write scope ("*")
// and runs ALONE — this is what makes the parallel path provably conflict-free.
const filesOf = (t) => {
  const f = Array.isArray(t.files) ? t.files.filter((x) => typeof x === "string" && x.trim()) : [];
  return f.length ? f : ["*"];
};
const intersects = (a, b) => {
  if (a.includes("*") || b.includes("*")) return true;
  const s = new Set(a);
  return b.some((x) => s.has(x));
};
const computeWaves = (tasks) => {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const done = new Set();
  let remaining = tasks.slice();
  const waves = [];
  let guard = 0;
  while (remaining.length && guard++ <= tasks.length + 1) {
    const ready = remaining.filter((t) =>
      (Array.isArray(t.depends_on) ? t.depends_on : []).every((d) => done.has(d) || !byId.has(d))
    );
    const pool = ready.length ? ready : remaining; // a cycle/dangling dep can't stall progress
    const wave = [];
    let claimed = [];
    for (const t of pool) {
      const f = filesOf(t);
      if (!intersects(f, claimed)) {
        wave.push(t);
        claimed = claimed.concat(f);
      }
      if (claimed.includes("*")) break; // a wildcard task monopolizes its wave
    }
    if (!wave.length) wave.push(pool[0]);
    const inWave = new Set(wave.map((t) => t.id));
    wave.forEach((t) => done.add(t.id));
    remaining = remaining.filter((t) => !inWave.has(t.id));
    waves.push(wave);
  }
  if (remaining.length) waves.push(remaining);
  return waves;
};

const WAVES = computeWaves(TASKS);
const parallelTasks = WAVES.filter((w) => w.length > 1).reduce((n, w) => n + w.length, 0);
log(
  `architect: ${tasksTotal} task(s) → ${WAVES.length} wave(s) [${WAVES.map((w) => w.length).join(", ")}], ` +
  `${parallelTasks} task(s) build in parallel. ${CHECKS.length} runnable acceptance check(s). ` +
  `e2e loop: every failure → architect re-plan + rebuild (no quick patch); ≤${MAX_STUCK} no-progress rounds / ${MAX_E2E_ROUNDS}-round cap → blocked. ` +
  `No in-loop security/reviewer gates (v2).`
);

// ── Prompt builders ───────────────────────────────────────────────────────────
const sanitize = (s) => String(s).replace(/[^a-zA-Z0-9_.-]/g, "-");
const waveBranch = (task, waveNum) => `feature/${F.id}-w${waveNum}-${sanitize(task.id)}`;

// Parallel-wave generator: ISOLATED WORKTREE, full TDD, commits CODE/TESTS ONLY on its branch.
const waveWorktreePrompt = (task, waveNum) =>
  `Implement ONE task with strict TDD as the Tiger Code Generator — PARALLEL WAVE ${waveNum}, worktree mode.
   Feature id: ${F.id}
   Spec artifact: ${F.spec}
   Project directory: ${F.dir}
   Your task id: ${task.id} — "${task.title || ""}"
   Your write scope (the ONLY files you commit): ${JSON.stringify(filesOf(task))}
   Build brief (where/how — from the architect): ${task.context || "(none — read feature_list.json tasks[] for your task)"}
   Verification: ${task.verification || "(none given — write the test that proves this task)"}

   YOU ARE IN AN ISOLATED GIT WORKTREE — a private checkout. Sibling generators build other tasks in
   their own worktrees concurrently; you cannot see or collide with them. Because of that:
     • Create your task branch BASED ON the feature tip and work there. Do NOT run
       \`git checkout feature/${F.id}\` — that branch is live in the main worktree and git forbids
       checking it out twice. Base your new branch on its ref instead:
         git checkout -b ${waveBranch(task, waveNum)} feature/${F.id}
     • Do a FULL natural TDD cycle: failing test → CONFIRM RED (right reason) → minimal
       implementation → CONFIRM GREEN → run the project's FULL verification (./init.sh or equivalent).
     • Commit ONLY your task's code + test files — ONE semantic commit:
         git add ${filesOf(task).map((f) => (f === "*" ? "-A" : `'${f}'`)).join(" ")}
         git commit -m "<type>(<scope>): <task ${task.id} summary>"
     • DO NOT touch the shared board or docs: NEVER edit feature_list.json or progress.md, NEVER attach
       git notes, NEVER move the phase. (The integrator records board state serially after the merge.)
   READ feature_list.json for your task's scope + its \`context\` brief (the architect distilled the
   relevant structure into it) and the spec artifact — that IS your structural input; you do NOT read
   the codemap. Architect blueprint (context only): ${digest(BP, 700)}
   Write to the tiger-code-quality design principles (single responsibility, DRY, encapsulate what
   varies, asserted pre/postconditions, no train-wreck chains). No placeholders, no broad catches, no
   silent fallbacks. Follow docs/tiger-unit-test-best-practice.md. There is no in-loop reviewer now —
   YOUR unit tests + clean design ARE the quality bar before the e2e gate.
   END with EXACTLY these three lines, last (machine-read):
     TASK ${task.id}: <GREEN|RED|BLOCKED>
     BRANCH: ${waveBranch(task, waveNum)}
     COMMIT: <the sha you committed, or NONE>`;

// Serial integrator (main checkout): cherry-pick the wave's disjoint branches, then ONE board commit.
const integratorPrompt = (wave, waveNum, editSummaries) =>
  `Integrate PARALLEL WAVE ${waveNum} of feature ${F.id} as the Tiger Code Generator (integration role).
   ${wave.length} tasks were just built in isolated worktrees, each on its own branch. You write NO new
   feature code — you cherry-pick their disjoint commits onto feature/${F.id} and record the board.
   Project directory: ${F.dir}
   Wave branches to integrate, in THIS dependency order:
   ${wave.map((t, i) => `     ${i + 1}. task ${t.id} → branch ${waveBranch(t, waveNum)} — files ${JSON.stringify(filesOf(t))}`).join("\n")}
   Worktree-generator handoffs (context only — verify against the refs on disk):
   ${digest(editSummaries.map((s, i) => `[${wave[i] ? wave[i].id : i}] ${s}`).join("\n---\n"), 1200)}

   STEPS, in order:
     1) git checkout feature/${F.id}    (you are in the MAIN checkout, not a worktree)
     2) For EACH wave branch above, in order, that EXISTS (git rev-parse --verify <branch>):
          git cherry-pick <branch's commit(s)>      # disjoint files → clean, linear history
        Keep each task's ONE semantic commit. If a branch is MISSING (its generator failed) skip it
        and note the task as not done — the e2e/re-plan loop recovers it. If a cherry-pick unexpectedly
        CONFLICTS (files were not truly disjoint), abort it (git cherry-pick --abort) and report which
        task so the architect's files[] can be fixed; do not hand-merge.
     3) Run the project's FULL verification ONCE on the integrated tip (./init.sh or equivalent) — the
        authoritative GREEN for the assembled wave. If it fails, fix the MINIMAL integration cause and
        re-run; if you cannot get green, report it (the e2e gate will see it anyway).
     4) ONE board commit for the wave (the integrator owns the shared files, serially):
          for each integrated task: flip its tasks[].status to done with evidence; append progress.md
          git add feature_list.json progress.md
          git commit -m "chore(board): ${F.id} wave ${waveNum} — integrate ${wave.length} task(s)"
     5) Clean up merged branches: git branch -D <each integrated branch> 2>/dev/null (optional).
   You own code integration, cherry-picks, task-status flips, progress.md — NEVER the phase pointer,
   NEVER acceptance_criteria status, NEVER git notes.
   END with this line, last (a human-readable self-report; the e2e gate, not this line, drives the loop):
     TASKS_DONE: <doneCount>/<totalCount>`;

// Solo path: a 1-task wave (or a wildcard-footprint task) — classic TDD + one commit.
const soloGenPrompt = (task, waveNum) =>
  `Implement ONE task with TDD as the Tiger Code Generator — wave ${waveNum} (solo).
   Feature id: ${F.id}
   Spec artifact: ${F.spec}
   Project directory: ${F.dir}
   Your task id: ${task.id} — "${task.title || ""}"
   Files (your write scope): ${JSON.stringify(filesOf(task))}
   Build brief (where/how — from the architect): ${task.context || "(none — read feature_list.json tasks[] for your task)"}

   READ feature_list.json (the Architect's tasks[]/scope_map + your task's \`context\` brief ARE your
   instructions and your structural input) and the spec artifact; you do NOT read the codemap.
   Architect blueprint (context only): ${digest(BP, 800)}
   Ensure the branch: git checkout feature/${F.id} (never commit onto ${F.base}).
   Do TDD on THIS task: failing test → CONFIRM RED → minimal implementation → CONFIRM GREEN →
   project verification path (./init.sh or equivalent). Respect the scope_map. Land EXACTLY ONE
   semantic commit on feature/${F.id}; flip this task's tasks[].status to done and append progress.md.
   You own code, commits, task-status flips, progress.md — NEVER the phase pointer, NEVER
   acceptance_criteria status, NEVER git notes. No placeholders, no broad catches, no silent
   fallbacks. Write to the tiger-code-quality design principles; the e2e gate executes your work for
   real. Follow docs/tiger-git-best-practice.md and docs/tiger-unit-test-best-practice.md.
   END with this line, last (a human-readable self-report; the e2e gate drives the loop):
     TASKS_DONE: <doneCount>/<totalCount>`;

// Architect RE-PLAN: in this pipeline EVERY e2e failure comes back to the architect to fix the RIGHT
// way — the open blockers are treated as a PLAN GAP, not patched ad hoc. The architect (the SOLE reader of
// the codemap) re-recons + REFRESHES tiger/codemap.html so the structure is current, then adds/revises
// tasks[] that close the gap and returns ONLY the delta tasks, which rebuild through the wave machinery
// from the per-task `context` the architect distilled (the generators never read the codemap themselves).
const replanPrompt = (findings, replanRound) =>
  `RE-PLAN round ${replanRound} of feature ${F.id} as the Tiger Architect. The e2e gate found open
   HIGH/MEDIUM defects. In this pipeline EVERY e2e failure returns to you to fix it the RIGHT way — not
   an ad-hoc patch but a proper re-plan: treat the blockers as a PLAN GAP (missing or mis-scoped work the
   original plan never covered) and close it with new tasks. Re-plan it properly.
   Feature id: ${F.id}
   Spec artifact: ${F.spec}   Project directory: ${F.dir}   Trunk: ${F.base}
   Ensure the branch: git checkout feature/${F.id} (never commit onto ${F.base}).
   --- e2e blockers the patch could NOT resolve (priority-ordered) ---
   ${findings}
   --- end blockers ---
   FIRST, RECON + REFRESH THE CODEMAP (load-bearing — you are its sole reader): the initial build and any
   prior re-plans landed REAL modules, so the structural picture has moved. Read the current built code and
   UPDATE tiger/codemap.html to reflect the ACTUAL current structure. Both your re-plan and the per-task
   \`context\` you write depend on this being accurate — the delta generators build from the board's context
   ALONE and never read the codemap, so any structure they need you must distill into their context.
   THEN diagnose the ROOT scope gap behind these blockers, and ADD (or revise) the tasks[] in
   feature_list.json that will close it. Every new task MUST carry a NEW UNIQUE id — suffix it
   "-r${replanRound}" so its parallel worktree branch never collides with already-built tasks — plus an
   accurate files[], depends_on, a concrete \`context\` brief (WHERE/WHICH/HOW distilled from the refreshed
   codemap), and its own \`verification\`. Add/repair the matching acceptance_criteria checks and prove each fails RED now.
   Do NOT rewrite grill's WHY/SPECIFY fields, never duplicate the entry, keep phase: plan and the links
   reciprocal + acyclic. Then COMMIT the board:
     git add feature_list.json tiger/codemap.html && git commit -m "chore(board): ${F.id} re-plan r${replanRound} — delta tasks for e2e gap (phase: plan)"
   RETURN the structured blueprint where tasks[] is ONLY the NEW/REVISED DELTA tasks to build now (never
   the already-done ones): blueprintText, tasks[], acceptanceChecks[], metric.`;

const e2ePrompt = (round) =>
  `Verify feature ${F.id} end-to-end by REAL execution as the Tiger E2E gate (round ${round}). You did
   NOT write the code. This is the SINGLE quality gate of the v2 pipeline — there are no separate
   security/reviewer gates before you. Every task in tasks[] is landed. Prove the whole feature works,
   and triage every defect by PRIORITY.
   Project directory: ${F.dir}
   Spec artifact: ${F.spec}
   Today: ${F.today}

   PHASE 0 — AUTHOR THE ROBOT LAYER (MANDATORY): the agreed cases in
   tiger/features/${F.id}/e2e_testcases.robot carry Given/When/Then keyword NAMES + priority tags
   (priority:high|medium|low) but no runnable bodies. WRITE tiger/features/${F.id}/e2e_keywords.resource
   (instantiate from tiger/templates/e2e_keywords.resource if absent) — implement each keyword with
   REAL commands: Playwright via the Browser library for UI cases, Process/OperatingSystem for
   CLI/API/file cases; each asserts the real Then against the spec. You own that resource; you NEVER
   edit the agreed cases next door.
   PHASE 1 — EXECUTE (MANDATORY): run the Robot Framework suite for real —
     robot --outputdir tiger/features/${F.id}/evidence tiger/features/${F.id}/e2e_testcases.robot
   (install if missing: pip install robotframework; for UI cases pip install robotframework-browser &&
   rfbrowser init). Robot's exit code = failed-case count; output.xml/report.html ARE the evidence.
   ALSO run the Architect's runnable acceptance checks in feature_list.json (cross-check:
   ${digest(JSON.stringify(CHECKS), 1000)}) as real processes; capture exit code + stdout/stderr.
   PHASE 2 — TRIAGE BY PRIORITY (the v2 gate rule): classify every failure/defect as HIGH, MEDIUM, or
   LOW per your manual (a failing priority:high or :critical/smoke case, a failed acceptance check, a
   confirmed abuse/vulnerability, data loss, or the core JTBD broken = HIGH; a failing priority:medium
   case, a wrong non-critical path, an edge-case miss = MEDIUM; cosmetic/minor = LOW). For each defect
   give a "where to solve" pointer: file:line + what diverged + the concrete fix.
   PHASE 3 — RECORD:
     • git notes --ref=e2e add -f -m "grade: <pass|changes|blocked>
       blockers: high=<n> medium=<n> low=<n>
       fixes (priority-ordered):
       - [HIGH] <case/check id — file:line — what diverged — the fix>
       - [MEDIUM] ...
       - [LOW] <logged, non-blocking>" <generator-commit>
     • Update feature_list.json: phase pointer + acceptance_criteria status from evidence. On a PASS
       (zero HIGH and zero MEDIUM, all tasks done) set phase: validate with every AC done; record any
       LOW defects in learning + progress.md as known issues; leave status: in_progress (update-docs
       owns the passing close-out).
     • COMMIT: git add feature_list.json progress.md && git commit -m "chore(board): ${F.id} phase -> <phase> (e2e: <grade>)"
   END with EXACTLY these four lines, in this order, last (machine-read):
     TIGER_E2E: <PASS|CHANGES|BLOCKED>
     E2E_BLOCKERS: high=<n> medium=<n> low=<n>
     FEATURE_COMPLETE: <YES|NO>
     TASKS_DONE: <doneCount>/<totalCount>
   PASS only when ZERO HIGH and ZERO MEDIUM defects remain AND every task is done, all on fresh
   evidence. LOW defects never block PASS — they are logged. Any HIGH/MEDIUM ⇒ CHANGES with the
   priority-ordered fix list. Unfixable (spec contradiction, wedged env, unrunnable case) ⇒ BLOCKED.`;

// ── BUILD: each dependency wave → (parallel worktrees + integrate | solo). No in-loop gates. ──
let outcome = "PASS"; // flips to BLOCKED on the first hard stop
let round = 0;
let lastE2e = "";

// buildWaves — build a list of dependency waves: a 1-task wave is one solo TDD commit; a wave of
// file-disjoint tasks builds by concurrent worktree generators, then a serial integrator cherry-picks.
// REUSED by the initial build AND by an architect re-plan's rebuild (`prefix` namespaces the phases;
// re-plan tasks carry unique "-r<round>" ids so their worktree branches never collide). Returns false
// if the token budget ran out mid-build so the caller can block.
const buildWaves = async (waves, prefix) => {
  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w];
    const waveNum = w + 1;
    const bph = `${prefix}-w${waveNum}`;
    if (wave.length === 1) {
      // Solo path — one task, classic TDD + one commit directly on feature/<id>.
      phase(bph);
      await spawn("generator", soloGenPrompt(wave[0], waveNum), bph);
    } else {
      // Parallel path — one ISOLATED WORKTREE per task, then a serial integrator cherry-picks.
      phase(bph);
      const builds = await parallel(
        wave.map((t) => () => spawn("generator", waveWorktreePrompt(t, waveNum), bph, { isolation: "worktree" }))
      );
      // A dead worktree agent (null) is non-fatal: its branch won't exist, the integrator skips it,
      // that task stays not-done, and the e2e loop recovers it.
      const buildSummaries = builds.map((b) => digest(b || "(worktree agent returned nothing)", 500));
      const iph = `${prefix}-integrate-w${waveNum}`;
      phase(iph);
      await spawn("generator", integratorPrompt(wave, waveNum, buildSummaries), iph);
    }
    if (!hasLoopBudget()) return false;
  }
  return true;
};

// Initial build of the architect's plan.
if (!(await buildWaves(WAVES, "build"))) {
  outcome = "BLOCKED";
  log("token budget headroom exhausted during the initial build — stopping; state durable on disk.");
}

// ── E2E: ONE end-of-build, bug-priority real-execution gate ────────────────────
// PASS = zero HIGH + zero MEDIUM (LOW logged). CHANGES → architect re-plan + rebuild delta → re-e2e (≤2 no-progress).
if (outcome === "PASS") {
  let stuck = 0;         // consecutive NO-PROGRESS re-plan rounds
  let prevHM = Infinity; // open HIGH+MEDIUM count last round — a drop is forward progress
  let prevDone = -1;     // tasks done last round — an increase is forward progress
  while (true) {
    phase("e2e");
    lastE2e = await spawn("e2e", e2ePrompt(round + 1), "e2e");
    const e2eVerdict = verdictOf(lastE2e, "TIGER_E2E");
    const bugs = e2eBlockers(lastE2e);

    if (e2eVerdict === "BLOCKED") {
      outcome = "BLOCKED";
      log(`e2e: BLOCKED — stopping for the human (state on disk).`);
      break;
    }
    if (e2eVerdict === "PASS" && featureComplete(lastE2e)) {
      const { done } = tasksProgress(lastE2e);
      outcome = "PASS";
      log(`e2e: PASS, tasksDone=${done}/${tasksTotal}, low(logged)=${bugs.low} — finalizing.`);
      break;
    }

    // CHANGES → ALWAYS escalate to an architect RE-PLAN (the "do it right" path: re-plan the open
    // blockers as delta tasks, rebuild through the wave machinery, re-e2e — never a quick patch).
    // Only a NO-PROGRESS round (open HIGH+MEDIUM didn't drop and no task landed) advances `stuck`,
    // so a feature needing several real re-plans isn't force-blocked; a genuinely stuck one blocks.
    const hm = bugs.high + bugs.medium;
    const { done: doneNow } = tasksProgress(lastE2e);
    const progressed = hm < prevHM || doneNow > prevDone;
    prevHM = hm;
    prevDone = doneNow;
    stuck = progressed ? 0 : stuck + 1;

    if (stuck >= MAX_STUCK || round >= MAX_E2E_ROUNDS || !hasLoopBudget()) {
      outcome = "BLOCKED";
      const why =
        stuck >= MAX_STUCK ? `${MAX_STUCK} no-progress re-plan rounds`
        : round >= MAX_E2E_ROUNDS ? `${MAX_E2E_ROUNDS}-round cap`
        : "budget headroom exhausted";
      log(`e2e: ${why} — phase: blocked (high=${bugs.high}, medium=${bugs.medium}).`);
      break;
    }
    round += 1;

    // Architect re-plans the open blockers as delta tasks; they rebuild through the wave machinery.
    const rph = `replan-${round}`;
    phase(rph);
    const replan = await spawn("architect", replanPrompt(digest(lastE2e, 1600), round), rph, { schema: BLUEPRINT_SCHEMA });
    const deltaTasks = replan && Array.isArray(replan.tasks) ? replan.tasks : [];
    if (deltaTasks.length) {
      const dWaves = computeWaves(deltaTasks);
      log(`e2e: CHANGES (high=${bugs.high}, medium=${bugs.medium}, low=${bugs.low}) → re-plan ${round}: ${deltaTasks.length} delta task(s) → ${dWaves.length} wave(s); rebuilding.`);
      if (!(await buildWaves(dWaves, `replan-${round}`))) {
        outcome = "BLOCKED";
        log(`re-plan ${round}: budget headroom exhausted mid-rebuild — phase: blocked.`);
        break;
      }
    } else {
      log(`e2e: CHANGES → re-plan ${round}: architect returned no delta tasks — re-running e2e as-is.`);
    }
  }
}

// On a non-PASS exit the board must say so durably. e2e owns the phase during the loop, so spawn it
// once more ONLY to record blocked (it may already have).
if (outcome === "BLOCKED") {
  phase("finalize");
  await spawn(
    "e2e",
    `Feature ${F.id} is BLOCKED after bounded retries (orchestrator stop). As the board's loop-phase
     owner, ensure feature_list.json says phase: blocked, status: in_progress, current_feature: ${F.id};
     append the priority-ordered blocking fix list (the open HIGH/MEDIUM defects) to progress.md; then commit:
       git add feature_list.json progress.md && git commit -m "chore(board): ${F.id} phase -> blocked"
     Project directory: ${F.dir}. If the board ALREADY says blocked and is committed, verify and do
     nothing. No code changes, no new notes.
     END with: TIGER_E2E: BLOCKED`,
    "finalize"
  );
}

// ── PHASE: FINALIZE (only on PASS) — update docs, close board, rebase onto main, MR ─────
let finStatus = "n/a (not PASS)";
if (outcome === "PASS") {
  phase("finalize");
  const docsReport = await spawn(
    "docs",
    `Close out feature ${F.id} as the Tiger Update Docs stage. The loop passed: every task is green and
     the e2e gate reported ZERO HIGH and ZERO MEDIUM defects with fresh evidence (LOW defects, if any,
     are logged as known issues).
     Project directory: ${F.dir}
     Spec artifact: ${F.spec}
     Trunk: ${F.base}      Today: ${F.today}

     You are ONE agent that LOADS the focused tiger-docs-* writer skills — do not spawn sub-agents.
     1) REFRESH every project-global doc, each by loading its writer skill (bootstrap from
        tiger/templates/ when a file is missing):
        • tiger/codemap.html  (load tiger-docs-codemap) — regenerate the mermaid map to include what
          this feature changed; stable node ids
        • tiger/business.html (load tiger-docs-business, global-merge mode) — merge
          tiger/features/${F.id}/business.html into the cumulative overview
        • tiger/release_docs.html (load tiger-docs-release) — add this feature's user-facing entry
          under [Unreleased]; record any LOW e2e defects under a "Known issues" line (keep-a-changelog)
        • README.md (load tiger-docs-readme) — refresh the project README surgically/additively
     2) CLOSE the board (your ownership window): feature_list.json → status: passing, phase: passing,
        current_feature: null. Carry the e2e gate's LOW known-issues into learning.*.
     3) COMMIT docs + board (ONE commit): git add tiger/*.html README.md feature_list.json progress.md &&
        git commit -m "docs(tiger): ${F.id} close-out — codemap/business/release/README refresh (phase: passing)"
     4) REBASE feature/${F.id} onto ${F.base} (trunk-based) — NEVER resolve a conflict yourself:
          git fetch origin ${F.base} 2>/dev/null || echo '(no remote, local ${F.base})'
          TARGET=${F.base}; git rev-parse --verify origin/${F.base} >/dev/null 2>&1 && TARGET=origin/${F.base}
          git rebase "$TARGET" || { git rebase --abort 2>/dev/null; echo 'REBASE CONFLICT — aborted'; }
        On conflict: abort (branch returns to its pre-rebase tip), then REOPEN the board honestly —
        feature_list.json phase: blocked, status: in_progress, current_feature: ${F.id}, reason
        'rebase conflict onto ${F.base}' in progress.md, commit chore(board) — and stop.
     5) Clean rebase + remote origin exists → push feature/${F.id} and OPEN the MR against ${F.base}
        (the 'ready' signal; use PULL_REQUEST_TEMPLATE.md). NEVER merge — the human squash-merges.
        Clean rebase + NO remote → skip push/MR; branch is local-ready.
     END with EXACTLY one of these as the LAST line (machine-read):
       FINALIZE_STATUS: MERGED_READY
       FINALIZE_STATUS: NO_REMOTE_READY
       FINALIZE_STATUS: REBASE_CONFLICT`,
    "finalize"
  );
  finStatus = finalizeStatus(docsReport) || "UNKNOWN";
  if (finStatus === "REBASE_CONFLICT") outcome = "BLOCKED";
}

// Compact scalar summary — everything durable is on disk (board + commits + the e2e note + HTML).
const finalBugs = e2eBlockers(lastE2e);
return {
  feature: F.id,
  title: F.title,
  base: F.base,
  tasks: tasksTotal,
  waves: WAVES.length,
  parallelTasks,
  rounds: round,
  e2eBlockers: finalBugs,
  outcome,
  featureComplete: outcome === "PASS" && featureComplete(lastE2e),
  finalize: finStatus,
  passed: outcome === "PASS",
  inspect: "open tiger/ in a browser; resume = git log + git notes --ref=e2e + board phase",
};
