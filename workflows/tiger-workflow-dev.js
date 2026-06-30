// .claude/workflows/tiger-workflow-dev.js
//
// Deterministic Tiger spine (v6). Runs ONE already-approved feature (grill happened first):
//   bootstrap (sonnet) — discover the approved in-progress feature from the board, verify the
//       feature.md approval token, resolve today + the dev trunk. (This is why no args are needed.)
//     → architect (opus) — recon + blueprint + per-task plan + CODEBASE_MAP.md + board plan commit
//     → per dependency WAVE of tasks[]:
//         • 1 task        → solo code generator (sonnet): TDD + simplify + ONE commit on feature/<id>
//         • N disjoint    → parallel generators in ISOLATED WORKTREES → serial integrator cherry-picks
//     → e2e (opus) ONCE after every wave — the single quality gate. Authors keyword bodies, runs the
//         robot suite + acceptance checks for real, APPENDS new cases it thinks of, triages by
//         PRIORITY (HIGH+MEDIUM block → re-plan; LOW logged). CHANGES → back to the ARCHITECT to
//         re-plan delta tasks → rebuild → re-e2e; ≤MAX_STUCK no-progress / MAX_E2E_ROUNDS cap → blocked.
//     → update docs (opus) — refresh CODEBASE_MAP.md/business.md/release_docs.md/README, close the
//         board, rebase onto dev, fast-forward merge to dev. NEVER touches main (dev→main is manual).
//
// Branch model: main is the protected release branch the workflow NEVER touches; dev is the
// integration trunk; feature/<id> is cut from dev (grill cut it) and fast-forward merged back to dev.
// No in-loop security/reviewer (standalone skills). Models mirror the agent frontmatter; pass
// proModel/fastModel (or "inherit") for non-Anthropic backends. Launch: /tiger-workflow-dev (no args).

export const meta = {
  name: "tiger-workflow-dev",
  description:
    "Run ONE human-approved Tiger feature through the v6 pipeline. bootstrap (sonnet) discovers the approved feature from feature_list.json (clocking it in automatically if it was never started — so a freshly grilled+approved feature 'just works') and re-checks the feature.md approval token, so a bare /tiger-workflow-dev needs no args. architect (opus) plans + writes tasks[] + CODEBASE_MAP.md; tasks build in dependency waves (file-disjoint tasks in parallel isolated worktrees, then a serial integrator). After every wave, e2e (opus) is the single gate: it runs the robot suite + acceptance checks for real, adds more cases, triages by priority (HIGH+MEDIUM block → architect re-plan → rebuild → re-e2e, bounded; LOW logged). update-docs (opus) refreshes the markdown docs + README, closes the board, rebases onto dev and fast-forward merges to dev. The workflow never touches main; dev→main is a manual human step. Overrides: featureId, specFile, projectDir, today, proModel, fastModel.",
  phases: [
    { title: "bootstrap", detail: "discover the approved feature + dev trunk + today", model: "sonnet" },
    { title: "architect", detail: "recon + blueprint + per-task plan + board commit", model: "opus" },
    { title: "build", detail: "code generators: parallel per-task worktrees per wave", model: "sonnet" },
    { title: "integrate", detail: "cherry-pick disjoint branches onto feature/<id> + board commit", model: "sonnet" },
    { title: "e2e", detail: "single bug-priority robot gate; HIGH+MEDIUM re-plan, LOW logged", model: "opus" },
    { title: "replan", detail: "e2e failure → architect re-plans blockers as delta tasks → rebuild", model: "opus" },
    { title: "finalize", detail: "update docs, close board, rebase + fast-forward merge to dev", model: "opus" },
  ],
};

const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");

const MAX_STUCK = 2;
const MAX_E2E_ROUNDS = 6;
const LOOP_HEADROOM = 60000;
const hasLoopBudget = () => budget.remaining() > LOOP_HEADROOM;

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
const spawn = (key, prompt, phaseName, extra = {}) =>
  agent(prompt, {
    ...(AG[key] ? { agentType: AG[key] } : {}),
    phase: phaseName,
    ...(MODEL_FOR[key] ? { model: MODEL_FOR[key] } : {}),
    ...extra,
  });

// Machine verdicts — parse the token off a line that BEGINS with TOKEN:, take the last match,
// fail CLOSED (absent/garbled ⇒ CHANGES, never a false PASS).
const upper = (r) => String(r || "").toUpperCase();
const lastTokenLine = (report, token) => {
  const re = new RegExp("(?:^|\\n)[^\\S\\n]*" + token.toUpperCase() + ":[^\\S\\n]*([^\\n]*)", "g");
  let m, last = null;
  const s = upper(report);
  while ((m = re.exec(s)) !== null) last = m[1];
  return last;
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
const e2eBlockers = (report) => {
  const line = lastTokenLine(report, "E2E_BLOCKERS") || "";
  const grab = (k) => {
    const m = line.match(new RegExp(k + "\\s*=\\s*(\\d+)"));
    return m ? +m[1] : 0;
  };
  return { high: grab("HIGH"), medium: grab("MEDIUM"), low: grab("LOW") };
};
const digest = (report, max = 1800) => {
  const t = String(report || "");
  if (t.length <= max) return t;
  const head = Math.min(700, Math.floor(max / 2));
  return t.slice(0, head) + "\n…[handoff trimmed — disk state is authoritative]…\n" + t.slice(-(max - head));
};

// Shared prompt fragments reused across stage prompts. Declared up front, BEFORE the first stage
// prompt that interpolates them — a const referenced above its own declaration line throws a
// ReferenceError (temporal dead zone), which is exactly how the architect prompt used to crash.
// Stages read + patch the board through the Python helper (installed as tiger/board.py) instead of
// dumping and hand-rewriting the whole JSON; it preserves every other field and fails closed on a
// broken invariant. Read: summary|get|current|in-progress. Patch: set-phase/set-status/set-current/
// set-task/set-ac/add-learning/approve/add-task/add-feature.
const BOARD_TOOL =
  "Read the board with `python3 tiger/board.py summary` (or `get <id> [field]`) and patch ONLY your " +
  "fields with `python3 tiger/board.py` (set-phase/set-status/set-current/set-task/set-ac/add-learning/" +
  "add-task) — never dump or hand-rewrite the whole feature_list.json. It validates invariants on every write.";

const QUALITY_RULES =
  `Write to the tiger-code-quality principles (single responsibility, DRY, encapsulate what varies, ` +
  `asserted pre/postconditions, no train-wreck chains, no placeholders/broad catches/silent fallbacks). ` +
  `After GREEN run a SIMPLIFY pass: make the code the shortest readable version that still passes, apply ` +
  `best practices, delete dead code, and remove ALL comments — generated code carries NO comments (no #, ` +
  `no //, no inline or block comments, no narration docstrings; only a shebang or a required lint/type ` +
  `pragma may remain). Re-run tests; they MUST stay GREEN; then commit. There is no in-loop reviewer — ` +
  `your tests + clean, comment-free design ARE the quality bar before the e2e gate.`;

// ── BOOTSTRAP — discover the feature + dev trunk ──────────────────────────────
const BOOTSTRAP_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["abort"],
  properties: {
    featureId: { type: "string" },
    featureTitle: { type: "string" },
    specFile: { type: "string", description: "Path to the feature.md doc." },
    projectDir: { type: "string" },
    today: { type: "string", description: "YYYY-MM-DD from `date +%F` — never invented." },
    branchBase: { type: "string", description: "The integration trunk — `dev`." },
    phase: { type: "string" },
    approved: { type: "boolean" },
    abort: { type: ["string", "null"] },
  },
};

phase("bootstrap");
const boot = await spawn(
  "bootstrap",
  `You are the DISCOVERY PREFLIGHT for the Tiger dev workflow. Do NOT plan, code, or commit — read
   the board, resolve the build context, return it. Work in the current project directory.

   Optional caller hints (use only if non-empty; else discover):
     featureId="${argStr("featureId")}"  specFile="${argStr("specFile")}"  today="${argStr("today")}"  projectDir="${argStr("projectDir")}"

   STEPS:
   1. projectDir = hint else \`pwd\`. today = hint else \`date +%F\`.
   2. Read feature_list.json. A feature is APPROVED when its feature.md frontmatter 'tiger-status:' value
      is exactly "approved" — READ the file and compare the trimmed value (tolerate surrounding whitespace
      or quotes); "awaiting_review" / "approved (pending)" are NOT approved. Choose the feature to BUILD,
      first match wins, skipping any already "passing": (a) the featureId hint if present AND approved;
      (b) current_feature if set AND approved; (c) the single "in_progress" feature, if approved; (d) the
      single APPROVED feature on the board whatever its status — the autonomous path for a freshly
      grilled+approved feature that was simply never clocked in ("let the agent do itself").
   2b. AUTONOMOUS CLOCK-IN (don't make the human do it): if the chosen approved feature is not yet
      "in_progress" and NO other feature is in_progress, clock it in yourself —
        python3 tiger/board.py set-status <id> in_progress && python3 tiger/board.py set-current <id>
        git add feature_list.json && git commit -m "chore(board): clock in <id> (phase: plan)"
      board.py refuses a WIP>1 write. If a DIFFERENT feature is already in_progress, abort:
      "WIP>1 — feature <other> is in_progress; finish or clock it out before building <id>".
   3. featureTitle = that feature's title. specFile = the specFile hint, else its spec_file, else
      "tiger/features/<id>/feature.md".
   4. APPROVAL GATE (kept strict — the ONE human gate; never build an unapproved feature). If NO feature
      is approved: board has feature(s) but none approved → abort "feature <id> exists but is not approved
      — run tiger-grill to finish and approve it"; empty board → abort "no feature on the board — run
      tiger-grill to create and approve one". Set approved=true only for the chosen, token-approved feature.
   5. branchBase = "dev" (the integration trunk; main is the protected release branch the workflow
      never touches). Confirm dev exists: \`git rev-parse --verify dev\` (or \`origin/dev\`). If it does
      not exist but main does, create it: \`git branch dev main\`. If neither exists, abort: "no dev
      branch and no main to create it from — run /tiger-skills:install first".
   6. (Features already "passing" are skipped in step 2 — nothing to build there.)

   Return the structured object. abort=null ONLY when a single APPROVED feature is ready (now in_progress)
   on dev; otherwise put the precise, human-actionable reason in abort.`,
  "bootstrap",
  { schema: BOOTSTRAP_SCHEMA }
);

if (boot === null || boot === undefined) {
  return {
    aborted:
      "bootstrap agent died at spawn (returned null) — backend/API incompatibility, not a board " +
      "problem. Pass proModel/fastModel matching your backend's exact model names (or \"inherit\").",
    passed: false,
  };
}
if (boot.abort) {
  return {
    aborted: boot.abort,
    howToFix:
      "Finish the conversational gates first: run tiger-grill until tiger/features/<id>/feature.md + " +
      "e2e_testcases.robot exist and feature.md frontmatter has 'tiger-status: approved'; ensure WIP=1 " +
      "and that a dev branch exists (run /tiger-skills:install). Then re-run /tiger-workflow-dev.",
    passed: false,
  };
}

const F = {
  id: boot.featureId,
  title: boot.featureTitle || boot.featureId,
  spec: boot.specFile || `tiger/features/${boot.featureId}/feature.md`,
  dir: boot.projectDir || ".",
  today: boot.today || "",
  base: boot.branchBase || "dev",
};
if (!F.id) {
  return { aborted: "bootstrap returned no featureId and no abort reason — cannot proceed.", passed: false };
}
log(`bootstrap: feature ${F.id} ("${F.title}"), doc ${F.spec}, base ${F.base}, today ${F.today}. Approved ✓.`);

// ── ARCHITECT ─────────────────────────────────────────────────────────────────
const BLUEPRINT_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["blueprintText", "tasks", "acceptanceChecks"],
  properties: {
    blueprintText: { type: "string", description: "Scope Map → Component Design → Build Sequence → Metric Plan → Risks." },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        required: ["id", "title"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          files: { type: "array", items: { type: "string" }, description: "Exact files this task writes. File-disjoint tasks build in parallel; no files[] ⇒ runs alone." },
          depends_on: { type: "array", items: { type: "string" } },
          context: { type: "string", description: "Per-task brief for a parallel generator that has only the board: WHERE the code lives, WHICH existing code to reuse (file:line), HOW it connects, the one behavior to satisfy. Distilled from CODEBASE_MAP.md (generators never read the map)." },
          verification: { type: "string", description: "The task's own RED→GREEN test command." },
        },
      },
    },
    acceptanceChecks: {
      type: "array",
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
   Feature id: ${F.id}   Title: ${F.title}
   Feature doc: ${F.spec}  (READ IT FULLY, plus the sibling e2e_testcases.robot — requirements,
   CAN/CANNOT, the metric, decisions, business context, and the agreed e2e cases all live there.)
   Codemap: read tiger/CODEBASE_MAP.md if it exists (your structural input). If missing, bootstrap it
   from tiger/templates/CODEBASE_MAP.md as compact markdown mapping the real codebase.
   Project: ${F.dir}   Trunk: ${F.base}   Today: ${F.today}

   SAFETY NET (idempotent): ensure the feature branch off ${F.base}, never commit onto ${F.base} or main:
     git checkout -b feature/${F.id} ${F.base} 2>/dev/null || git checkout feature/${F.id}

   Phases: recon → blueprint → per-task plan → board enrichment.
     • Recon: verify the doc's scope claims against the real codebase (cite file:line).
     • Blueprint: Scope Map (MODIFY / READ-ONLY / METRIC), Component Design to the tiger-code-quality
       principles, the phased task breakdown.
     • Acceptance checks (non-degenerate): one runnable command per criterion; RUN each now and confirm RED.
   PARALLEL-BUILD INPUT (load-bearing): file-disjoint tasks build concurrently, each generator in its own
   worktree seeing ONLY the board. YOU are the sole reader of CODEBASE_MAP.md, so distil its relevant
   structure into each task's context. Every task MUST carry: accurate depends_on; precise files[] (its
   write scope); a concrete context brief; its own verification command.
   GRILL created this entry (WHY/SPECIFY, status: in_progress, phase: plan). ENRICH in place — add
   scope_map.modify/read_only + tasks[] + RED-proven acceptance_criteria commands. Do NOT rewrite grill's
   fields, keep phase: plan, links reciprocal + acyclic.
   ${BOARD_TOOL}
   Then COMMIT:
     git add feature_list.json tiger/CODEBASE_MAP.md && git commit -m "chore(board): ${F.id} plan — scope + tasks (phase: plan)"
   This is your ONLY commit — never code, never a git note, never a phase move past plan.
   RETURN the structured blueprint (blueprintText, tasks[], acceptanceChecks[], metric).`,
  "architect",
  { schema: BLUEPRINT_SCHEMA }
);

if (blueprint === null || blueprint === undefined) {
  return {
    feature: F.id,
    aborted:
      "tiger-architect died at spawn (returned null) — backend/API incompatibility. Pass " +
      "proModel/fastModel matching your backend's model names (or \"inherit\"), then re-run.",
    passed: false,
  };
}

const BP = blueprint.blueprintText || "(no prose blueprint — read feature_list.json on disk)";
const TASKS = Array.isArray(blueprint.tasks) ? blueprint.tasks : [];
const CHECKS = Array.isArray(blueprint.acceptanceChecks) ? blueprint.acceptanceChecks : [];
const tasksTotal = TASKS.length;

// Dependency-wave packing (pure, in-script).
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
    const pool = ready.length ? ready : remaining;
    const wave = [];
    let claimed = [];
    for (const t of pool) {
      const f = filesOf(t);
      if (!intersects(f, claimed)) {
        wave.push(t);
        claimed = claimed.concat(f);
      }
      if (claimed.includes("*")) break;
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
  `${parallelTasks} parallel. ${CHECKS.length} acceptance check(s). ` +
  `e2e loop: failure → architect re-plan; ≤${MAX_STUCK} no-progress / ${MAX_E2E_ROUNDS}-round cap → blocked.`
);

// ── Prompt builders ─────────────────────────────────────────────────────────
const sanitize = (s) => String(s).replace(/[^a-zA-Z0-9_.-]/g, "-");
const waveBranch = (task, waveNum) => `feature/${F.id}-w${waveNum}-${sanitize(task.id)}`;

const waveWorktreePrompt = (task, waveNum) =>
  `Implement ONE task with strict TDD as the Tiger Code Generator — PARALLEL WAVE ${waveNum}, worktree mode.
   Feature id: ${F.id}   Feature doc: ${F.spec}   Project: ${F.dir}
   Task ${task.id} — "${task.title || ""}"
   Write scope (the ONLY files you commit): ${JSON.stringify(filesOf(task))}
   Build brief (where/how, from the architect): ${task.context || "(none — read feature_list.json tasks[])"}
   Verification: ${task.verification || "(none — write the test that proves this task)"}

   YOU ARE IN AN ISOLATED WORKTREE. Base your task branch on the feature tip (do NOT \`git checkout
   feature/${F.id}\` — it is live in the main worktree):
     git checkout -b ${waveBranch(task, waveNum)} feature/${F.id}
   Full TDD: failing test → CONFIRM RED → minimal implementation → CONFIRM GREEN → SIMPLIFY → re-verify
   GREEN → full project verification (./init.sh or equivalent). Commit ONLY your code + test files, ONE commit:
     git add ${filesOf(task).map((f) => (f === "*" ? "-A" : `'${f}'`)).join(" ")}
     git commit -m "<type>(<scope>): <task ${task.id} summary>"
   NEVER edit feature_list.json or progress.md, NEVER attach notes, NEVER move the phase (the integrator
   records the board serially). Read feature_list.json for your task's context (the architect distilled the
   structure into it) and the feature doc — that IS your structural input; you do NOT read CODEBASE_MAP.md.
   Architect blueprint (context only): ${digest(BP, 700)}
   ${QUALITY_RULES}
   END with EXACTLY these three lines, last:
     TASK ${task.id}: <GREEN|RED|BLOCKED>
     BRANCH: ${waveBranch(task, waveNum)}
     COMMIT: <sha, or NONE>`;

const integratorPrompt = (wave, waveNum, editSummaries) =>
  `Integrate PARALLEL WAVE ${waveNum} of feature ${F.id} as the Tiger Code Generator (integration role).
   ${wave.length} tasks were built in isolated worktrees, each on its own branch. Write NO new code —
   cherry-pick their disjoint commits onto feature/${F.id} and record the board. Project: ${F.dir}
   Wave branches, in dependency order:
   ${wave.map((t, i) => `     ${i + 1}. task ${t.id} → ${waveBranch(t, waveNum)} — files ${JSON.stringify(filesOf(t))}`).join("\n")}
   Handoffs (verify against the refs on disk):
   ${digest(editSummaries.map((s, i) => `[${wave[i] ? wave[i].id : i}] ${s}`).join("\n---\n"), 1200)}

   STEPS:
     1) git checkout feature/${F.id}    (you are in the MAIN checkout)
     2) For each wave branch that EXISTS (git rev-parse --verify <branch>):
          git cherry-pick <branch's commit(s)>      # disjoint files → clean
        Skip a missing branch (its generator failed) and note the task not done. A real conflict ⇒
        git cherry-pick --abort and report which task (the files[] were not truly disjoint); never hand-merge.
     3) Run ./init.sh (or equivalent) ONCE on the integrated tip — the authoritative GREEN. Fix only the
        minimal integration cause; if still red, report it.
     4) ONE board commit: flip each integrated task's tasks[].status to done with evidence; append progress.md.
        ${BOARD_TOOL}
          git add feature_list.json progress.md
          git commit -m "chore(board): ${F.id} wave ${waveNum} — integrate ${wave.length} task(s)"
     5) Optional: git branch -D <each integrated branch>.
   You own code integration + task-status + progress.md — NEVER the phase pointer, acceptance_criteria, or notes.
   END with this line, last:
     TASKS_DONE: <doneCount>/<totalCount>`;

const soloGenPrompt = (task, waveNum) =>
  `Implement ONE task with TDD as the Tiger Code Generator — wave ${waveNum} (solo).
   Feature id: ${F.id}   Feature doc: ${F.spec}   Project: ${F.dir}
   Task ${task.id} — "${task.title || ""}"
   Write scope: ${JSON.stringify(filesOf(task))}
   Build brief (where/how): ${task.context || "(none — read feature_list.json tasks[])"}

   Read feature_list.json (the architect's tasks[]/scope_map + your task context ARE your instructions
   and structural input) and the feature doc; you do NOT read CODEBASE_MAP.md.
   Architect blueprint (context only): ${digest(BP, 800)}
   Ensure the branch: git checkout feature/${F.id} (never commit onto ${F.base} or main).
   TDD on THIS task: failing test → CONFIRM RED → minimal implementation → CONFIRM GREEN → SIMPLIFY →
   re-verify GREEN → ./init.sh. Respect the scope_map. Land EXACTLY ONE commit on feature/${F.id}; flip
   this task's tasks[].status to done and append progress.md.
   ${BOARD_TOOL}
   You own code, commits, task-status, progress.md — NEVER the phase pointer, acceptance_criteria, or notes.
   ${QUALITY_RULES}
   END with this line, last:
     TASKS_DONE: <doneCount>/<totalCount>`;

const replanPrompt = (findings, replanRound) =>
  `RE-PLAN round ${replanRound} of feature ${F.id} as the Tiger Architect. The e2e gate found open
   HIGH/MEDIUM defects — fix them the RIGHT way: treat the blockers as a PLAN GAP and close it with new tasks.
   Feature id: ${F.id}   Feature doc: ${F.spec}   Project: ${F.dir}   Trunk: ${F.base}
   Ensure the branch: git checkout feature/${F.id} (never commit onto ${F.base} or main).
   --- open e2e blockers (priority-ordered) ---
   ${findings}
   --- end blockers ---
   FIRST recon + REFRESH tiger/CODEBASE_MAP.md (you are its sole reader): the build landed real modules,
   so update the markdown map to the ACTUAL current structure — the delta generators build from the board
   context ALONE, so any structure they need you must distil into their context.
   THEN diagnose the root scope gap and ADD/revise tasks[] that close it. Every new task gets a NEW UNIQUE
   id suffixed "-r${replanRound}", an accurate files[], depends_on, a concrete context brief, and its own
   verification. Add/repair the matching acceptance_criteria checks and prove each fails RED now. Do NOT
   rewrite grill's fields, keep phase: plan, links reciprocal + acyclic.
   ${BOARD_TOOL}
   Then COMMIT:
     git add feature_list.json tiger/CODEBASE_MAP.md && git commit -m "chore(board): ${F.id} re-plan r${replanRound} — delta tasks (phase: plan)"
   RETURN the structured blueprint where tasks[] is ONLY the NEW/REVISED delta tasks (never the done ones).`;

const e2ePrompt = (round) =>
  `Verify feature ${F.id} end-to-end by REAL execution as the Tiger E2E gate (round ${round}). You did NOT
   write the code. This is the SINGLE quality gate — no separate security/reviewer before you. Every task is
   landed. Prove the whole feature works and triage every defect by priority.
   Project: ${F.dir}   Feature doc: ${F.spec}   Today: ${F.today}

   PHASE 0 — AUTHOR THE KEYWORDS: the agreed cases in tiger/features/${F.id}/e2e_testcases.robot carry
   Given/When/Then names + priority tags but no bodies. WRITE tiger/features/${F.id}/e2e_keywords.resource
   (instantiate from tiger/templates/e2e_keywords.resource if absent) — one keyword per name, REAL commands
   (Browser/Playwright for UI, Process/OperatingSystem otherwise), each asserting the real Then against the
   feature doc. NO comments in the bodies. You own the resource; you NEVER edit grill's agreed cases.
   PHASE 1 — EXPAND COVERAGE: think of scenarios the agreed cases miss (more boundary/adversarial/error/
   concurrency/permission paths) and APPEND them as new cases to e2e_testcases.robot, each tagged
   [Tags] source:e2e plus one priority tag. Keep adding while meaningful uncovered behavior remains.
   PHASE 2 — EXECUTE (real): robot --outputdir tiger/features/${F.id}/evidence tiger/features/${F.id}/e2e_testcases.robot
   (install if missing: pip install robotframework; UI: pip install robotframework-browser && rfbrowser init).
   Robot's exit code = failed-case count; output.xml/report.html ARE the evidence. ALSO run the architect's
   acceptance checks (${digest(JSON.stringify(CHECKS), 1000)}) as real processes; capture exit + stdout/stderr.
   Re-run after appending cases so all cases (agreed + yours) executed this round.
   PHASE 3 — TRIAGE: HIGH = a failing priority:high/critical/smoke case, a failed acceptance check, a
   confirmed abuse/data-loss, or the core JTBD broken; MEDIUM = a failing priority:medium case / wrong
   non-critical path / edge miss; LOW = cosmetic. Each defect gets a "where to solve": file:line + what
   diverged + the fix.
   PHASE 4 — RECORD:
     • git notes --ref=e2e add -f -m "grade: <pass|changes|blocked>
       blockers: high=<n> medium=<n> low=<n>
       fixes (priority-ordered):
       - [HIGH] <case/check — file:line — diverged — fix>
       - [MEDIUM] ...
       - [LOW] <logged>" <generator-commit>
     • Update the board (${BOARD_TOOL}): set the phase pointer + acceptance_criteria status from evidence.
       On PASS (zero HIGH + zero MEDIUM, all tasks done) set phase: validate, every AC done; record LOW
       defects via add-learning + progress.md; leave status: in_progress (update-docs closes the board).
     • COMMIT: git add feature_list.json progress.md tiger/features/${F.id}/e2e_testcases.robot tiger/features/${F.id}/e2e_keywords.resource && git commit -m "chore(board): ${F.id} phase -> <phase> (e2e: <grade>)"
   END with EXACTLY these four lines, last:
     TIGER_E2E: <PASS|CHANGES|BLOCKED>
     E2E_BLOCKERS: high=<n> medium=<n> low=<n>
     FEATURE_COMPLETE: <YES|NO>
     TASKS_DONE: <doneCount>/<totalCount>
   PASS only on ZERO HIGH + ZERO MEDIUM with every task done, on fresh evidence. Any HIGH/MEDIUM ⇒ CHANGES.
   Unfixable (doc contradiction, wedged env, unrunnable case) ⇒ BLOCKED.`;

// ── BUILD ─────────────────────────────────────────────────────────────────────
let outcome = "PASS";
let round = 0;
let lastE2e = "";

const buildWaves = async (waves, prefix) => {
  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w];
    const waveNum = w + 1;
    const bph = `${prefix}-w${waveNum}`;
    if (wave.length === 1) {
      phase(bph);
      await spawn("generator", soloGenPrompt(wave[0], waveNum), bph);
    } else {
      phase(bph);
      const builds = await parallel(
        wave.map((t) => () => spawn("generator", waveWorktreePrompt(t, waveNum), bph, { isolation: "worktree" }))
      );
      const buildSummaries = builds.map((b) => digest(b || "(worktree agent returned nothing)", 500));
      const iph = `${prefix}-integrate-w${waveNum}`;
      phase(iph);
      await spawn("generator", integratorPrompt(wave, waveNum, buildSummaries), iph);
    }
    if (!hasLoopBudget()) return false;
  }
  return true;
};

if (!(await buildWaves(WAVES, "build"))) {
  outcome = "BLOCKED";
  log("token budget headroom exhausted during the initial build — stopping; state durable on disk.");
}

// ── E2E gate + bounded re-plan loop ─────────────────────────────────────────────
if (outcome === "PASS") {
  let stuck = 0;
  let prevHM = Infinity;
  let prevDone = -1;
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

if (outcome === "BLOCKED") {
  phase("finalize");
  await spawn(
    "e2e",
    `Feature ${F.id} is BLOCKED after bounded retries (orchestrator stop). As the board's loop-phase
     owner, ensure feature_list.json says phase: blocked, status: in_progress, current_feature: ${F.id};
     append the priority-ordered blocking fix list to progress.md; then commit:
       git add feature_list.json progress.md && git commit -m "chore(board): ${F.id} phase -> blocked"
     Project: ${F.dir}. If the board already says blocked and is committed, verify and do nothing.
     END with: TIGER_E2E: BLOCKED`,
    "finalize"
  );
}

// ── FINALIZE (only on PASS) — docs, close board, rebase + fast-forward merge to dev ──
let finStatus = "n/a (not PASS)";
if (outcome === "PASS") {
  phase("finalize");
  const docsReport = await spawn(
    "docs",
    `Close out feature ${F.id} as the Tiger Update Docs stage. The loop passed: every task is green and
     the e2e gate reported ZERO HIGH and ZERO MEDIUM defects (LOW logged as known issues).
     Project: ${F.dir}   Feature doc: ${F.spec}   Trunk: ${F.base}   Today: ${F.today}

     You LOAD the focused tiger-docs-* writer skills — do not spawn sub-agents.
     1) REFRESH every project-global doc (bootstrap from tiger/templates/ if missing), each via its writer:
        • tiger/CODEBASE_MAP.md (tiger-docs-codemap) — markdown map incl. what this feature changed, the
          per-workflow walkthrough, and the business glossary (code values). Stable mermaid node ids.
        • tiger/business.md (tiger-docs-business) — merge this feature's business context into the catalog.
        • tiger/release_docs.md (tiger-docs-release) — add the user-facing entry under [Unreleased]; record
          any LOW e2e defects under "Known issues".
        • README.md (tiger-docs-readme) — refresh surgically/additively.
     2) CLOSE the board (${BOARD_TOOL}): status: passing, phase: passing, current_feature: null. Carry
        the LOW known-issues into learning.* via add-learning.
     3) COMMIT docs + board (ONE commit): git add tiger/CODEBASE_MAP.md tiger/business.md tiger/release_docs.md README.md feature_list.json progress.md &&
        git commit -m "docs(tiger): ${F.id} close-out — codemap/business/release/README refresh (phase: passing)"
     4) REBASE feature/${F.id} onto ${F.base} (NEVER resolve a conflict yourself):
          git fetch origin ${F.base} 2>/dev/null || echo '(no remote, local ${F.base})'
          TARGET=${F.base}; git rev-parse --verify origin/${F.base} >/dev/null 2>&1 && TARGET=origin/${F.base}
          git rebase "$TARGET" || { git rebase --abort 2>/dev/null; echo 'REBASE CONFLICT — aborted'; }
        On conflict: abort, REOPEN the board honestly (phase: blocked, status: in_progress,
        current_feature: ${F.id}, reason 'rebase conflict onto ${F.base}' in progress.md, commit chore(board)) and stop.
     5) Clean rebase → FAST-FORWARD MERGE to dev (the kit never touches main):
          git checkout ${F.base} && git merge --ff-only feature/${F.id}
        If a remote exists: git push origin ${F.base}. dev→main is a MANUAL human step — do NOT merge to
        main, do NOT open an MR. Report NO_REMOTE_MERGED when there is no remote.
     END with EXACTLY one of these as the LAST line:
       FINALIZE_STATUS: MERGED_TO_DEV
       FINALIZE_STATUS: NO_REMOTE_MERGED
       FINALIZE_STATUS: REBASE_CONFLICT`,
    "finalize"
  );
  finStatus = finalizeStatus(docsReport) || "UNKNOWN";
  if (finStatus === "REBASE_CONFLICT") outcome = "BLOCKED";
}

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
  inspect: "open tiger/*.md; resume = git log + git notes --ref=e2e + board phase",
};
