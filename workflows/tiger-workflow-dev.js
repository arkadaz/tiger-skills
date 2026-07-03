// .claude/workflows/tiger-workflow-dev.js
//
// Deterministic Tiger spine (v6). Runs ONE already-approved feature (grill happened first).
// The WORKFLOW is the conductor — it spawns every agent itself, because a subagent cannot spawn
// its own subagents (Claude Code caps agent nesting at one level). The old design had the lead
// spawn the coders from inside its own context; on a non-nesting runtime those level-2 spawns
// silently no-op and the lead ends up doing everything itself. So spawning lives here, at level 1:
//   bootstrap (sonnet) — discover the approved in-progress feature from the board, verify the
//       feature.md approval token, resolve today + the dev trunk. (This is why no args are needed.)
//     → lead PLAN (opus, ADAPTIVE) — recon + blueprint + board PLAN (scope_map + tasks[] each with exact
//       files[]/depends_on/context/verification) + RED-proven acceptance checks + CODEBASE_MAP.md; then it
//       DECIDES buildMode. buildMode=inline ⇒ it built + verified the whole (small) feature itself in this
//       one warm context (fastest, no cold coder spawns) and returns a grade — the workflow skips straight
//       to finalize. buildMode=waves ⇒ it returns dependency WAVES for the workflow to build below.
//     → the WORKFLOW builds the plan's dependency WAVES (waves mode only): a 1-task wave is one solo coder
//       on feature/<id>; a ≥2-task wave spawns its file-disjoint tiger-code-generator coders CONCURRENTLY
//       in isolated worktrees, then one integrator cherry-picks them onto feature/<id> + records the board.
//     → lead VERIFY (opus, waves mode) — authors the e2e keyword layer + runs the Robot suite over the WHOLE
//       tiger/features/ folder (regression, Playwright for UI) + every acceptance check for real,
//       triages by priority; on HIGH/MEDIUM it writes the DELTA tasks to the board and returns
//       their ids; the workflow rebuilds them and re-verifies, bounded by a hard round cap.
//     → on a clean pass the WORKFLOW spawns tiger-update-docs to close the board + ff-merge to dev.
//
// Branch model: main is the protected release branch the workflow NEVER touches; dev is the
// integration trunk; feature/<id> is cut from dev (grill cut it) and fast-forward merged back to
// dev (update-docs, spawned by the workflow). No in-loop security/reviewer (standalone skills).
// Models mirror the agent frontmatter; pass proModel/fastModel (or "inherit") for non-Anthropic
// backends. Launch: /tiger-workflow-dev (no args).

export const meta = {
  name: "tiger-workflow-dev",
  description:
    "Run ONE human-approved Tiger feature through the v6 pipeline. The WORKFLOW is the conductor (a subagent cannot spawn subagents, so spawning lives at workflow level). bootstrap (sonnet) discovers the approved feature from feature_list.json (clocking it in automatically if it was never started) and re-checks the feature.md approval token, so a bare /tiger-workflow-dev needs no args. Then lead PLAN (opus) recons + writes tasks[] + CODEBASE_MAP.md + RED-proven acceptance checks, then ADAPTIVELY decides buildMode: for a small low-risk feature it builds + verifies inline in one warm context (fastest — no cold coder spawns, doer=checker gated by grill's agreed e2e + RED acceptance) and returns a grade; for a larger feature it returns dependency WAVES and the WORKFLOW builds each wave — file-disjoint tiger-code-generator coders concurrently in isolated worktrees + an integrator (a 1-task wave builds solo) — then lead VERIFY (opus) authors the e2e keyword layer + runs the Robot suite over the WHOLE tiger/features/ folder (regression, Playwright for UI) + acceptance checks, triages by priority (HIGH+MEDIUM → write delta tasks → workflow rebuilds → re-verify, bounded; a regression in a shipped feature is HIGH; LOW logged). On a clean pass the workflow spawns tiger-update-docs to refresh docs + README, close the board, and fast-forward merge to dev. The workflow never touches main; dev→main is a manual human step. Overrides: featureId, specFile, projectDir, today, proModel, fastModel.",
  phases: [
    { title: "bootstrap", detail: "discover the approved feature + dev trunk + today", model: "sonnet" },
    { title: "plan", detail: "lead recon + board PLAN + acceptance checks + codemap; adaptively builds inline if small", model: "opus" },
    { title: "build", detail: "waves mode: workflow builds dependency waves — parallel worktree coders + integrator", model: "sonnet" },
    { title: "verify", detail: "waves mode: lead authors e2e keywords + runs robot tiger/features/ + triage", model: "opus" },
    { title: "finalize", detail: "workflow spawns update-docs: close board + ff-merge to dev", model: "opus" },
  ],
};

const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");

const pick = (v, dflt) => (v === "inherit" ? null : v || dflt);
const PRO = pick(A.proModel, "opus");
const FAST = pick(A.fastModel, "sonnet");
const MODEL_FOR = { bootstrap: FAST, lead: PRO, code: FAST, docs: PRO };
const AG = {
  lead: "tiger-skills:tiger-lead",
  code: "tiger-skills:tiger-code-generator",
  docs: "tiger-skills:tiger-update-docs",
};
const MAX_ROUNDS = 3;
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
const leadVerdict = (report) => {
  const v = lastToken(report, "TIGER_LEAD");
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

// Stages read + patch the board through the Python helper (installed as tiger/board.py) instead of
// dumping and hand-rewriting the whole JSON; it preserves every other field and fails closed on a
// broken invariant. Read: summary|get|current|in-progress. Patch: set-phase/set-status/set-current/
// set-task/set-ac/add-learning/approve/add-task/add-feature.
const BOARD_TOOL =
  "Read the board with `python3 tiger/board.py summary` (or `get <id> [field]`) and patch ONLY your " +
  "fields with `python3 tiger/board.py` (set-phase/set-status/set-current/set-task/set-ac/add-learning/" +
  "add-task) — never dump or hand-rewrite the whole feature_list.json. It validates invariants on every write.";

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

// lead PLAN is ADAPTIVE. buildMode="inline" ⇒ the lead already built + verified this (small) feature in
// the plan spawn (one warm context, no separate coders); it returns a verify grade + blocker counts.
// buildMode="waves" ⇒ the lead returns dependency WAVES (each a set of file-disjoint task ids that build
// concurrently in isolated worktrees; waves run in order) for the conductor to build with independent coders.
const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["buildMode"],
  properties: {
    buildMode: { type: "string", description: '"inline" (lead already built+verified) | "waves" (conductor builds)' },
    waves: {
      type: "array",
      items: { type: "array", items: { type: "string" } },
      description: "waves mode: dependency-ordered waves; each wave = file-disjoint task ids that build in parallel",
    },
    grade: { type: "string", description: "inline mode: PASS | BLOCKED (already built + verified)" },
    high: { type: "number" },
    medium: { type: "number" },
    low: { type: "number" },
    tasksDone: { type: "number" },
    tasksTotal: { type: "number" },
    planCommitted: { type: "boolean" },
    note: { type: "string" },
  },
};
// lead VERIFY returns the grade + blocker counts + (on CHANGES) the delta WAVES to rebuild.
const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["grade"],
  properties: {
    grade: { type: "string", description: "PASS | CHANGES | BLOCKED" },
    high: { type: "number" },
    medium: { type: "number" },
    low: { type: "number" },
    tasksDone: { type: "number" },
    tasksTotal: { type: "number" },
    deltaWaves: {
      type: "array",
      items: { type: "array", items: { type: "string" } },
      description: "on CHANGES: dependency-ordered waves of delta task ids just written to the board",
    },
    reason: { type: "string" },
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
   2. Read the board (\`python3 tiger/board.py summary\`). Pick the feature to BUILD by RECENCY — the
      NEWEST approved, non-passing feature (board order = creation order = "by the time the folder was
      created") — NEVER re-pin to an old stuck feature just because it is current_feature/in_progress:
        (a) the featureId hint, if present AND its feature.md token is approved (explicit human override);
        (b) else \`python3 tiger/board.py newest-approved\` — the id of the LAST approved, non-passing
            feature. (\`python3 tiger/board.py candidates\` shows the whole oldest→newest queue.)
      A feature counts as APPROVED only when its feature.md frontmatter 'tiger-status:' value is exactly
      "approved" — READ the chosen feature's file and compare the trimmed value (tolerate surrounding
      whitespace/quotes); "awaiting_review" / "approved (pending)" are NOT approved. If the newest by the
      board's spec_status fails the file-token re-check, drop it and take the next-newest candidate.
   2b. WIP RECONCILIATION — auto-switch to the newest; never stay stuck on an old feature. Let N = the
      chosen newest feature and O = \`python3 tiger/board.py in-progress\`:
        • O empty or O == N → ensure N is clocked in: if N is not yet "in_progress",
            python3 tiger/board.py set-status <N> in_progress && python3 tiger/board.py set-current <N>
            git add feature_list.json && git commit -m "chore(board): clock in <N> (phase: plan)"
        • O != N (an OLDER feature is in_progress while a NEWER approved feature N is waiting — the human
          moved on) → PARK O and switch to N (do NOT re-refactor the stale one). State is in git, so this
          is reversible — resume O later with featureId=<O>:
            python3 tiger/board.py set-status <O> blocked
            python3 tiger/board.py set-current null
            python3 tiger/board.py set-status <N> in_progress
            python3 tiger/board.py set-current <N>
            printf '\\n- %s: auto-switched from %s to newer approved %s (parked %s blocked; resume with featureId=%s)\\n' "$(date +%F)" "<O>" "<N>" "<O>" "<O>" >> progress.md
            git add feature_list.json progress.md && git commit -m "chore(board): park <O> (blocked), switch to newer approved <N>"
          If the featureId hint explicitly names O, build O instead (no switch — the human asked for it).
      board.py refuses any WIP>1 write, so run the park BEFORE the clock-in as ordered above.
   3. featureTitle = the chosen feature's title. specFile = the specFile hint, else its spec_file, else
      "tiger/features/<id>/feature.md".
   4. APPROVAL GATE (kept strict — the ONE human gate; never build an unapproved feature). If
      \`newest-approved\` is empty (no approved, non-passing feature): board has feature(s) but none
      approved → abort "feature(s) exist but none is approved — run tiger-grill to finish and approve
      one"; empty board → abort "no feature on the board — run tiger-grill to create and approve one".
      Set approved=true only for the chosen, file-token-approved feature.
   5. branchBase = "dev" (the integration trunk; main is the protected release branch the workflow
      never touches). Confirm dev exists: \`git rev-parse --verify dev\` (or \`origin/dev\`). If it does
      not exist but main does, create it: \`git branch dev main\`. If neither exists, abort: "no dev
      branch and no main to create it from — run /tiger-skills:install first".
   6. (Features already "passing" are skipped in step 2 — nothing to build there.)
   ${BOARD_TOOL}

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

const spawnDied = (who) => ({
  feature: F.id,
  aborted:
    who + " died at spawn (returned null) — backend/API incompatibility. Pass proModel/fastModel " +
    "matching your backend's model names (or \"inherit\"), then re-run.",
  passed: false,
});

const cleanWaves = (ws) =>
  (Array.isArray(ws) ? ws : [])
    .map((w) => (Array.isArray(w) ? w.filter((t) => typeof t === "string" && t.trim()) : []))
    .filter((w) => w.length > 0);
const wavesStr = (ws) => ws.map((w) => "[" + w.join(",") + "]").join(" ") || "(none)";

// ── PLAN — the lead recons + writes the board PLAN, returns dependency WAVES ──
// The lead plans and verifies, but it does NOT spawn the coders (a subagent cannot spawn subagents);
// this workflow spawns them. So the lead runs in two modes it is told explicitly: PLAN, then VERIFY.
phase("plan");
const plan = await spawn(
  "lead",
  `MODE: PLAN (adaptive). You are the Tiger Lead planning feature ${F.id}. First recon + write the board
   PLAN; THEN DECIDE how it gets built and tell the workflow via buildMode.
   Feature id: ${F.id}   Title: ${F.title}
   Feature doc: ${F.spec}  (READ IT FULLY, plus the sibling tiger/features/${F.id}/e2e_testcases.robot —
   requirements, CAN/CANNOT, the metric, decisions, business context, agreed e2e cases.)
   Codemap: read tiger/CODEBASE_MAP.md if it exists; bootstrap it from tiger/templates/CODEBASE_MAP.md if missing.
   Project: ${F.dir}   Trunk: ${F.base}   Today: ${F.today}

   SAFETY NET (idempotent): ensure the feature branch off ${F.base}, never commit onto ${F.base} or main:
     git checkout -b feature/${F.id} ${F.base} 2>/dev/null || git checkout feature/${F.id}

   PLAN (always): Do Phase A of agents/tiger-lead.md — verify the doc's scope against the real code
   (file:line); write the blueprint; the board PLAN (scope_map + tasks[] — each with exact files[],
   depends_on, a COMPLETE context work-packet, its own verification); RED-proven acceptance_criteria
   commands; and CODEBASE_MAP.md. Recon by reading files yourself — do NOT spawn scout subagents (nesting
   is unavailable). Commit the plan: chore(board): ${F.id} plan (phase: plan).
   ${BOARD_TOOL}

   THEN DECIDE buildMode (your judgment — NO hard cap; the workflow trusts your call):
   • buildMode="inline" — for a SMALL, low-risk feature (few tasks, largely linear, no risky cross-cutting
     integration): BUILD IT YOURSELF NOW in this same warm context (fastest — no cold coder spawns). Per
     task, strict TDD (RED → GREEN → SIMPLIFY, STRIP ALL COMMENTS), commit on feature/${F.id}, flip its
     tasks[].status, append progress.md. Then VERIFY for real (Phase C): author
     tiger/features/${F.id}/e2e_keywords.resource (comment-free), run the WHOLE folder
     (robot --outputdir tiger/evidence tiger/features/) + every acceptance check as a real process, UI in a
     real browser (Playwright); triage by priority; FIX HIGH/MEDIUM inline until green; attach
     refs/notes/e2e to the code commit; set the board phase. You are doer AND checker here — the objective
     gates are grill's AGREED e2e cases (you did NOT write them) + the RED-proven acceptance checks; hold
     that line honestly. RETURN buildMode="inline", grade (PASS only with zero HIGH and zero MEDIUM on
     fresh evidence and all tasks done, else BLOCKED), high/medium/low, tasksDone/tasksTotal. Do NOT return waves.
   • buildMode="waves" — for a LARGER feature (independent parallelizable tasks, real integration/security
     risk, or wide scope): do NOT build. RETURN buildMode="waves" and waves = dependency-ordered WAVES, each
     an array of FILE-DISJOINT task ids (no shared files[]) the workflow builds CONCURRENTLY in isolated
     worktrees with independent coders (doer≠checker) + a separate VERIFY; a wave's tasks must have all
     depends_on satisfied by EARLIER waves; a task that shares files with everything goes alone in its wave.
   planCommitted true once the plan commit landed.`,
  "plan",
  { schema: PLAN_SCHEMA }
);
if (plan === null || plan === undefined) return spawnDied("tiger-lead (plan)");

// Build ONE dependency wave: a 1-task wave is a solo coder on feature/<id>; a ≥2-task wave builds its
// file-disjoint coders CONCURRENTLY in isolated worktrees (each on its own branch), then a single
// integrator cherry-picks the wave branches onto feature/<id> and records the board. All spawns are
// workflow-level (level 1) — the runtime can't nest, so the lead can't do this; the conductor does.
const buildWaves = async (ws, round) => {
  for (let i = 0; i < ws.length; i++) {
    const wave = ws[i];
    const N = i + 1;
    const ph = `build r${round} w${N}`;
    phase(ph);
    if (wave.length === 1) {
      const tid = wave[0];
      const c = await spawn(
        "code",
        `SOLO mode. You are a tiger-code-generator building ONE task of feature ${F.id} on branch
         feature/${F.id}. Read your work packet from the board — python3 tiger/board.py get ${F.id} —
         find task "${tid}" and build ONLY it from its context packet + scope_map (do NOT explore the
         tree; a missing fact is a PACKET GAP to report, not a reason to grep). Strict TDD: failing test,
         confirm RED, minimal code to GREEN, SIMPLIFY (strip comments), re-verify GREEN. Commit ONCE
         (code + tests only) on feature/${F.id}. Then flip THIS task via
         python3 tiger/board.py set-task ${F.id} ${tid} done --evidence "<fresh cmd + exit>" and append
         progress.md. Do NOT touch other tasks/phase/acceptance_criteria/notes/other features.
         ${BOARD_TOOL}
         END with: TASK ${tid}: <GREEN|RED|BLOCKED> / COMMIT: <sha or none> / (PACKET GAP: <what> if blocked).`,
        ph
      );
      log(`  wave ${N} solo coder ${tid}: ${c === null ? "died (spawn null) — verify will surface the gap" : "returned"}`);
    } else {
      const rs = await parallel(
        wave.map((tid) => () =>
          spawn(
            "code",
            `PARALLEL-WORKTREE mode. You are a tiger-code-generator in an ISOLATED git worktree building
             ONE task of feature ${F.id}. Base your branch on the feature tip:
             git checkout -b feature/${F.id}-w${N}-${tid} feature/${F.id}
             Read your work packet from the board — python3 tiger/board.py get ${F.id} — find task
             "${tid}" and build ONLY it from its context packet + scope_map (do NOT explore; a missing
             fact is a PACKET GAP to report). Strict TDD: failing test, confirm RED, minimal code to
             GREEN, SIMPLIFY (strip comments), re-verify GREEN, run the full verification. Commit ONCE
             (code + tests ONLY) on your branch feature/${F.id}-w${N}-${tid}. Do NOT touch
             feature_list.json / progress.md / notes / other features (the integrator records the board).
             END with: TASK ${tid}: <GREEN|RED|BLOCKED> / BRANCH: feature/${F.id}-w${N}-${tid} / COMMIT: <sha or none> / (PACKET GAP: <what> if blocked).`,
            ph,
            { isolation: "worktree" }
          )
            .then((r) => ({ tid, ok: r !== null && r !== undefined }))
            .catch(() => ({ tid, ok: false }))
        )
      );
      const built = (rs || []).filter((r) => r && r.ok).map((r) => r.tid);
      log(`  wave ${N}: ${built.length}/${wave.length} coders built in worktrees — ${built.join(", ") || "(none)"}`);
      const integ = await spawn(
        "code",
        `INTEGRATOR mode. You are a tiger-code-generator integrating wave ${N} of feature ${F.id} onto
         feature/${F.id} (write NO product code). The wave's coders each committed on their own branch
         feature/${F.id}-w${N}-<task>. On feature/${F.id} (git checkout feature/${F.id}), cherry-pick
         each existing wave branch's commit: git branch --list "feature/${F.id}-w${N}-*" to find them,
         then git cherry-pick <branch> for each. File-disjoint tasks apply cleanly; a REAL conflict means
         the files[] were NOT disjoint → git cherry-pick --abort and mark that task NOT done (never
         hand-merge). Run ./init.sh ONCE on the integrated tip (fix only the minimal integration cause).
         Then flip each INTEGRATED task via python3 tiger/board.py set-task ${F.id} <task> done
         --evidence "<fresh cmd + exit>" and append progress.md. ONE board commit:
         chore(board): ${F.id} wave ${N} — integrate. Wave tasks: ${wave.join(", ")}.
         ${BOARD_TOOL}
         END with: INTEGRATED: <k>/${wave.length} / COMMIT: <sha>.`,
        ph
      );
      log(`  wave ${N} integrator: ${integ === null ? "died (spawn null)" : "returned"}`);
    }
  }
};

// ── BUILD ⇄ VERIFY — the lead already built INLINE (small feature), OR the workflow builds each wave
// with independent coders and the lead verifies; bounded loop. buildMode is the lead's own call. ──
const buildMode = String(plan.buildMode || "waves").trim().toLowerCase() === "inline" ? "inline" : "waves";
let verify = null, grade = "CHANGES", round = 0;

if (buildMode === "inline") {
  round = 1;
  grade = String(plan.grade || "BLOCKED").toUpperCase();
  if (grade !== "PASS" && grade !== "BLOCKED") grade = "BLOCKED";
  log(
    `plan: buildMode=inline — the lead built + verified this small feature in ONE warm context (no ` +
    `separate coders). grade=${grade}, tasksDone=${plan.tasksDone ?? "?"}/${plan.tasksTotal ?? "?"}, ` +
    `blockers high=${plan.high || 0} medium=${plan.medium || 0} low=${plan.low || 0}.`
  );
} else {
  let waves = cleanWaves(plan.waves);
  log(`plan: buildMode=waves — ${waves.length} wave(s), ${waves.reduce((n, w) => n + w.length, 0)} task(s) — ${wavesStr(waves)}.`);
  while (round < MAX_ROUNDS) {
    round += 1;

    await buildWaves(waves, round);

    // VERIFY: the lead authors the e2e keyword layer + runs the WHOLE folder + acceptance checks.
    phase(`verify r${round}`);
    verify = await spawn(
      "lead",
      `MODE: VERIFY (round ${round} of ${MAX_ROUNDS}). You are the Tiger Lead VERIFYING feature ${F.id}
       on branch feature/${F.id}. The coders have built this round's tasks and flipped their board status.
       Do Phase C of agents/tiger-lead.md for REAL (Iron Law — no claim without fresh execution):
         • Author/extend tiger/features/${F.id}/e2e_keywords.resource (comment-free real bodies) for the
           agreed cases; never edit grill's agreed cases.
         • Run the WHOLE folder as a regression: robot --outputdir tiger/evidence tiger/features/ (EVERY
           feature's suite), plus every acceptance_criteria check as a real process. UI IS NOT OPTIONAL:
           drive any page/app in a real browser (robotframework-browser → Playwright). Fast probes may use
           robot tiger/features/${F.id}/e2e_testcases.robot; the verdict rests on the full-folder run.
         • Triage by priority. A case of an already-PASSING other feature that regresses is HIGH — fix
           until green regardless of its tag. If the folder run exposes genuine DUPLICATION with a prior
           feature you MAY dedupe/reconcile that prior feature's e2e (the one scoped exception to
           never-edit-agreed-cases; a real prior-behavior change → grade BLOCKED). Attach refs/notes/e2e
           to the coders' code commit; flip acceptance_criteria status from fresh evidence; record LOW in
           learning.*; set the board phase from the grade.
       ON GRADE = CHANGES: do Phase D re-plan of ONLY the DELTA — write the delta tasks[] to the board
       (NEW ids suffixed -r${round}, each with exact files[]/depends_on/context/verification, proven RED
       now), commit chore(board): ${F.id} re-plan r${round}, and RETURN them grouped as deltaWaves
       (file-disjoint sets, dependency-ordered) so the workflow rebuilds them next round. You do NOT spawn
       coders and you do NOT close the board to passing.
       ${BOARD_TOOL}
       RETURN the structured object: grade (PASS|CHANGES|BLOCKED), high/medium/low blocker counts,
       tasksDone/tasksTotal, and deltaWaves (the delta waves on CHANGES, else []).`,
      `verify r${round}`,
      { schema: VERIFY_SCHEMA }
    );
    if (verify === null || verify === undefined) return spawnDied("tiger-lead (verify)");

    grade = String(verify.grade || "CHANGES").toUpperCase();
    if (grade !== "PASS" && grade !== "BLOCKED") grade = "CHANGES";
    const b = { high: verify.high || 0, medium: verify.medium || 0, low: verify.low || 0 };
    log(
      `verify r${round}: ${grade} — tasksDone=${verify.tasksDone ?? "?"}/${verify.tasksTotal ?? "?"}, ` +
      `blockers high=${b.high} medium=${b.medium} low=${b.low}.`
    );

    if (grade === "PASS" || grade === "BLOCKED") break;
    waves = cleanWaves(verify.deltaWaves);
    if (waves.length === 0) { grade = "BLOCKED"; log(`verify r${round}: CHANGES but no delta waves returned → BLOCKED (needs a human).`); break; }
  }
  if (grade !== "PASS" && grade !== "BLOCKED") {
    grade = "BLOCKED";
    log(`round cap (${MAX_ROUNDS}) reached without PASS → BLOCKED.`);
  }
}

// ── FINALIZE — on PASS the workflow spawns update-docs to close out + ff-merge to dev ──
let finStatus = "n/a (not PASS)";
if (grade === "PASS") {
  phase("finalize");
  const docs = await spawn(
    "docs",
    `You are tiger-update-docs finalizing feature ${F.id} on branch feature/${F.id} (it PASSED e2e:
     zero HIGH, zero MEDIUM). Do your full procedure (agents/tiger-update-docs.md): refresh
     tiger/CODEBASE_MAP.md, tiger/business.md, tiger/release_docs.md and the project README.md (loading
     the tiger-docs-* writers); log any LOW e2e defects as known issues; close the board
     (status: passing, phase: passing, current_feature: null — you are the ONLY stage allowed to);
     commit docs + README + board in ONE commit; rebase feature/${F.id} onto ${F.base} and, on a clean
     rebase, FAST-FORWARD MERGE it to ${F.base}. NEVER touch main, never open an MR, never edit code.
     ${BOARD_TOOL}
     END with: FINALIZE_STATUS: <MERGED_TO_DEV|NO_REMOTE_MERGED|REBASE_CONFLICT>.`,
    "finalize"
  );
  if (docs === null || docs === undefined) return spawnDied("tiger-update-docs");
  finStatus = finalizeStatus(docs) || "UNKNOWN";
}

// In inline mode the verify grade + counts came back on the PLAN return (verify was never spawned).
const metricSrc = buildMode === "inline" ? plan : verify;
const bugs = metricSrc ? { high: metricSrc.high || 0, medium: metricSrc.medium || 0, low: metricSrc.low || 0 } : { high: 0, medium: 0, low: 0 };
const total = metricSrc ? (metricSrc.tasksTotal || 0) : 0;
const done = metricSrc ? (metricSrc.tasksDone || 0) : 0;
const outcome = grade === "PASS" && finStatus !== "REBASE_CONFLICT" ? "PASS" : grade === "BLOCKED" ? "BLOCKED" : "CHANGES";

log(
  `done: ${outcome} (buildMode=${buildMode}) — tasksDone=${done}/${total}, blockers high=${bugs.high} ` +
  `medium=${bugs.medium} low=${bugs.low}, finalize=${finStatus}, rounds=${round}.`
);

return {
  feature: F.id,
  title: F.title,
  base: F.base,
  buildMode,
  tasks: total,
  e2eBlockers: bugs,
  outcome,
  featureComplete: outcome === "PASS",
  finalize: finStatus,
  rounds: round,
  passed: outcome === "PASS",
  inspect: "open tiger/*.md; resume = git log + git notes --ref=e2e + board phase",
};
