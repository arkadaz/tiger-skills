// .claude/workflows/tiger-workflow-dev.js
//
// Deterministic Tiger spine (v9.1). Runs ONE already-approved feature (grill happened first).
// The WORKFLOW is the conductor — it spawns every agent itself (lead PLAN, coders + integrator,
// lead VERIFY, update-docs). NOT because a subagent can't nest-spawn (it CAN — Claude Code
// v2.1.172+, Agent tool to depth 5), but because deterministic orchestration GUARANTEES every step
// runs and keeps each agent's context bounded to one phase. A single agent conducting a whole large
// feature in one window forgets steps (spawning a coder, the finalize) as its context fills; the
// workflow never forgets. Spawning lives here, at level 1.
// There is NO separate bootstrap spawn: the lead's PLAN spawn does the discovery + gating itself
// (STEP 0 — the same hard gates its manual applies standalone), saving one cold spawn per run:
//     lead PLAN (opus, ADAPTIVE) — STEP 0: discover the newest approved feature from the board,
//       re-check the feature.md approval token, reconcile WIP, resolve today + the dev trunk
//       (abort fail-closed if any gate fails). Then recon + blueprint from spec.md (the detailed
//       grilled requirements) + board PLAN (scope_map + tasks[]) + RED-proven acceptance checks +
//       CODEBASE_MAP.md + the feature's e2e suite (the lead AUTHORS e2e_testcases.robot itself,
//       covering every case it judges can happen). Then it decides buildMode:
//       inline (the DEFAULT — small/typical feature) ⇒ it built + verified the whole feature in
//       this one warm context and returns a grade — the workflow skips straight to finalize.
//       waves (genuinely large/parallelizable) ⇒ it returns dependency WAVES built below.
//     → the WORKFLOW builds the waves (waves mode only): a 1-task wave = one solo coder on
//       feature/<id>; a ≥2-task wave = file-disjoint tiger-code-generator coders CONCURRENTLY in
//       isolated worktrees + one integrator that cherry-picks onto feature/<id> + records the board.
//     → lead VERIFY (opus, waves mode) — authors the keyword layer + runs the Robot suite over the
//       WHOLE tiger/features/ folder (regression, Playwright for UI) + every acceptance check for
//       real, triages by priority; on HIGH/MEDIUM it writes DELTA tasks and returns them; the
//       workflow rebuilds and re-verifies, bounded by a hard round cap.
//     → on a clean pass the WORKFLOW spawns tiger-update-docs to close the board + ff-merge to dev.
//
// Branch model: main is protected (never touched); dev is the integration trunk; feature/<id> is
// cut from dev and fast-forward merged back by update-docs. tiger-review stays standalone.
// Models mirror the agent frontmatter; pass proModel/fastModel (or "inherit") for non-Anthropic
// backends. Launch: /tiger-workflow-dev (no args).

export const meta = {
  name: "tiger-workflow-dev",
  description:
    "Run ONE human-approved Tiger feature through the v9.1 pipeline. The WORKFLOW is the conductor — it spawns every agent (lead PLAN, coders + integrator, lead VERIFY, update-docs). NOT because a subagent can't nest-spawn (it can, Claude Code v2.1.172+, depth 5), but because deterministic orchestration guarantees every step runs and keeps each agent's context bounded to one phase — a single agent conducting a large feature in one window forgets steps as it fills. NO separate bootstrap spawn: lead PLAN (opus) starts by discovering the newest approved feature from feature_list.json itself (clocking it in automatically), re-checking the feature.md approval token, reconciling WIP, and resolving today + the dev trunk — so a bare /tiger-workflow-dev needs no args and pays one fewer cold spawn. It then recons + plans from spec.md (the detailed grilled requirements), writes tasks[] + CODEBASE_MAP.md + RED-proven acceptance checks, AUTHORS the feature's broad e2e_testcases.robot itself (boundary/typical/adversarial/error, priority-tagged — covering everything it judges can happen), then adaptively decides buildMode: DEFAULT inline — it builds + verifies the feature in one warm context (fastest — no cold coder spawns; doer=checker held to the pre-committed suite + RED acceptance checks) and returns a grade; waves for a genuinely large feature — the WORKFLOW builds each wave with file-disjoint tiger-code-generator coders in isolated worktrees + an integrator (1-task wave = solo), then lead VERIFY (opus) runs the Robot suite over the WHOLE tiger/features/ folder (regression, Playwright for UI) + acceptance checks, triages by priority (HIGH+MEDIUM → delta tasks → rebuild → re-verify, bounded; a regression in a shipped feature is HIGH; LOW logged). On a clean pass the workflow spawns tiger-update-docs to refresh docs + README, close the board, and fast-forward merge to dev. Never touches main. Overrides: featureId, specFile, projectDir, today, proModel, fastModel.",
  phases: [
    { title: "plan", detail: "lead: discover + gate the feature, recon + board PLAN + e2e suite + acceptance checks; DEFAULT builds+verifies inline", model: "opus" },
    { title: "build", detail: "waves mode only: workflow builds dependency waves — parallel worktree coders + integrator", model: "sonnet" },
    { title: "verify", detail: "waves mode only: lead runs robot tiger/features/ + acceptance checks + triage", model: "opus" },
    { title: "finalize", detail: "workflow spawns update-docs: close board + ff-merge to dev", model: "opus" },
  ],
};

const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");

const pick = (v, dflt) => (v === "inherit" ? null : v || dflt);
const PRO = pick(A.proModel, "opus");
const FAST = pick(A.fastModel, "sonnet");
const MODEL_FOR = { lead: PRO, code: FAST, docs: PRO };
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
const finalizeStatus = (report) => lastToken(report, "FINALIZE_STATUS");
// E2E_BLOCKERS / TIGER_LEAD token lines remain in the lead's report for the human log; the
// conductor reads the structured returns below.

// Stages read + patch the board through the Python helper (installed as tiger/board.py) instead of
// dumping and hand-rewriting the whole JSON; it preserves every other field and fails closed on a
// broken invariant.
const BOARD_TOOL =
  "Read the board with `python3 tiger/board.py summary` (or `get <id> [field]`) and patch ONLY your " +
  "fields with `python3 tiger/board.py` (set-phase/set-status/set-current/set-task/set-ac/add-learning/" +
  "add-task) — never dump or hand-rewrite the whole feature_list.json. It validates invariants on every write.";

// lead PLAN is ADAPTIVE and does its own DISCOVERY (no separate bootstrap spawn).
// abort != null ⇒ a gate failed (no approved feature / no dev trunk) and nothing was planned.
// buildMode="inline" (the DEFAULT) ⇒ the lead already built + verified this feature in the plan
// spawn (one warm context, no separate coders); it returns a verify grade + blocker counts.
// buildMode="waves" ⇒ the lead returns dependency WAVES (file-disjoint task ids per wave, built
// concurrently in isolated worktrees; waves run in order) for the conductor to build.
const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["abort"],
  properties: {
    abort: { type: ["string", "null"], description: "null when planned; else the precise human-actionable gate failure" },
    featureId: { type: "string" },
    featureTitle: { type: "string" },
    today: { type: "string", description: "YYYY-MM-DD from `date +%F` — never invented." },
    branchBase: { type: "string", description: "The integration trunk — `dev`." },
    buildMode: { type: "string", description: '"inline" (lead already built+verified — the default) | "waves" (conductor builds)' },
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

const cleanWaves = (ws) =>
  (Array.isArray(ws) ? ws : [])
    .map((w) => (Array.isArray(w) ? w.filter((t) => typeof t === "string" && t.trim()) : []))
    .filter((w) => w.length > 0);
const wavesStr = (ws) => ws.map((w) => "[" + w.join(",") + "]").join(" ") || "(none)";
const spawnDiedMsg = (who) =>
  who + " died at spawn (returned null) — backend/API incompatibility. Pass proModel/fastModel " +
  "matching your backend's model names (or \"inherit\"), then re-run.";

// ── PLAN — the lead discovers + gates the feature ITSELF (no bootstrap spawn), then recons +
// plans + authors the e2e suite; DEFAULT builds inline. The lead does NOT spawn the coders
// this workflow (not the lead) spawns them in waves mode, deterministically — so a large-feature
// lead never has to remember to, and its context stays bounded to planning + verifying.
phase("plan");
const plan = await spawn(
  "lead",
  `MODE: PLAN (adaptive). You are the Tiger Lead. You are the FIRST spawn of this workflow — there is
   no bootstrap; YOU discover and gate the feature (STEP 0), then plan it. Work in the current project
   directory.

   Optional caller hints (use only if non-empty; else discover):
     featureId="${argStr("featureId")}"  specFile="${argStr("specFile")}"  today="${argStr("today")}"  projectDir="${argStr("projectDir")}"

   STEP 0 — DISCOVER + GATE (before any planning; on ANY failure RETURN {abort:"<precise reason>"} and STOP):
   1. projectDir = hint else \`pwd\`. today = hint else \`date +%F\` (never invented).
   2. Read the board (\`python3 tiger/board.py summary\`). Pick the feature to BUILD by RECENCY — the
      NEWEST approved, non-passing feature — NEVER re-pin to an old stuck feature just because it is
      current_feature/in_progress:
        (a) the featureId hint, if present AND its feature.md token is approved (explicit human override);
        (b) else \`python3 tiger/board.py newest-approved\` (\`candidates\` shows the oldest→newest queue).
      APPROVED means the feature.md frontmatter 'tiger-status:' value is exactly "approved" — READ the
      chosen feature's file and compare the trimmed value (tolerate surrounding whitespace/quotes);
      "awaiting_review" / "approved (pending)" are NOT approved. If the newest fails the file-token
      re-check, drop it and take the next-newest candidate.
   3. WIP RECONCILIATION — auto-switch to the newest. Let N = the chosen feature and
      O = \`python3 tiger/board.py in-progress\`:
        • O empty or O == N → ensure N is clocked in: if N is not "in_progress",
            python3 tiger/board.py set-status <N> in_progress && python3 tiger/board.py set-current <N>
            git add feature_list.json && git commit -m "chore(board): clock in <N> (phase: plan)"
        • O != N (an OLDER feature is in_progress while newer approved N waits) → PARK O, switch to N
          (state is in git; resume O later with featureId=<O>):
            python3 tiger/board.py set-status <O> blocked && python3 tiger/board.py set-current null
            python3 tiger/board.py set-status <N> in_progress && python3 tiger/board.py set-current <N>
            append the switch to progress.md; git add feature_list.json progress.md &&
            git commit -m "chore(board): park <O> (blocked), switch to newer approved <N>"
          If the featureId hint explicitly names O, build O instead (the human asked for it).
      board.py refuses any WIP>1 write, so run the park BEFORE the clock-in as ordered above.
   4. APPROVAL GATE (strict — the ONE human gate). No approved, non-passing feature: board has
      feature(s) but none approved → abort "feature(s) exist but none is approved — run tiger-grill to
      finish and approve one"; empty board → abort "no feature on the board — run tiger-grill to create
      and approve one"; board helper missing → abort "tiger/board.py missing — run /tiger-skills:install".
   5. branchBase = "dev". Confirm dev exists: \`git rev-parse --verify dev\` (or \`origin/dev\`). If it
      does not exist but main does: \`git branch dev main\`. If neither exists, abort: "no dev branch and
      no main to create it from — run /tiger-skills:install first".
   Then include featureId, featureTitle, today, branchBase in your final RETURN (abort=null), and use
   <id> = the discovered featureId everywhere below.

   SAFETY NET (idempotent): ensure the feature branch off dev, never commit onto dev or main:
     git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>

   INPUTS: READ FULLY tiger/features/<id>/spec.md — the detailed grilled requirements; it is the SOURCE
   OF TRUTH for behavior (exact FRs, business rules, error table, testable ACs). Also read feature.md
   (metric + decisions + business context). If spec.md is missing (an old feature), feature.md is the
   contract. Codemap: tiger/CODEBASE_MAP.md (bootstrap from tiger/templates/CODEBASE_MAP.md if missing).

   PLAN (always — Phase A of agents/tiger-lead.md):
   • Recon the real code yourself (do NOT spawn scouts — keep your context focused on this feature); verify spec.md's
     scope claims at file:line.
   • Board PLAN: scope_map + tasks[] (exact files[], depends_on, a COMPLETE context packet, its own
     verification) + RED-proven acceptance_criteria commands. ${BOARD_TOOL}
   • AUTHOR tiger/features/<id>/e2e_testcases.robot NOW, before any code — YOU own the e2e cases:
     derive a BROAD suite from spec.md covering everything you judge can happen (several boundary +
     typical + adversarial cases, every error path in spec.md's table, ≥1 case per AC and per business
     rule, real-browser cases for any UI), each case tagged exactly one priority:high|medium|low.
     This pre-committed suite is the objective gate that keeps the inline path honest.
   • Refresh CODEBASE_MAP.md. Commit: chore(board): <id> plan — scope + tasks + e2e suite (phase: plan).

   THEN DECIDE buildMode:
   • buildMode="inline" — THE DEFAULT. Unless this feature genuinely earns waves, BUILD IT YOURSELF NOW
     in this same warm context (fastest — no cold coder spawns). Per task: strict TDD (RED → GREEN →
     SIMPLIFY, strip all comments), commit on feature/<id>, flip tasks[].status, append progress.md.
     Then VERIFY for real (Phase C): author tiger/features/<id>/e2e_keywords.resource (comment-free),
     run the WHOLE folder (robot --outputdir tiger/evidence tiger/features/) + every acceptance check as
     a real process, UI in a real browser (Playwright); triage by priority; FIX HIGH/MEDIUM inline until
     green; attach refs/notes/e2e to the code commit; set the board phase. Doer=checker is held honest by
     the suite you pre-committed before building + the RED-proven acceptance checks. RETURN
     buildMode="inline", grade (PASS only with zero HIGH and zero MEDIUM on fresh evidence and all tasks
     done, else BLOCKED), high/medium/low, tasksDone/tasksTotal. Do NOT return waves.
   • buildMode="waves" — ONLY for a feature that is genuinely large (several file-disjoint tasks where
     parallel coders beat one warm context) or carries real cross-cutting integration/security risk:
     do NOT build. RETURN buildMode="waves" and waves = dependency-ordered WAVES, each an array of
     FILE-DISJOINT task ids (no shared files[]) built CONCURRENTLY in isolated worktrees by independent
     coders (doer≠checker) + a separate VERIFY; a wave's depends_on must be satisfied by EARLIER waves.
   planCommitted true once the plan commit landed.`,
  "plan",
  { schema: PLAN_SCHEMA }
);
if (plan === null || plan === undefined) {
  return { aborted: spawnDiedMsg("tiger-lead (plan)"), passed: false };
}
if (plan.abort) {
  return {
    aborted: plan.abort,
    howToFix:
      "Finish the conversational gates first: run tiger-grill until tiger/features/<id>/spec.md + " +
      "feature.md exist and feature.md frontmatter has 'tiger-status: approved'; ensure WIP=1 " +
      "and that a dev branch exists (run /tiger-skills:install). Then re-run /tiger-workflow-dev.",
    passed: false,
  };
}

const F = {
  id: plan.featureId,
  title: plan.featureTitle || plan.featureId,
  today: plan.today || "",
  base: plan.branchBase || "dev",
};
if (!F.id) {
  return { aborted: "lead PLAN returned no featureId and no abort reason — cannot proceed.", passed: false };
}
log(`plan: feature ${F.id} ("${F.title}"), base ${F.base}, today ${F.today}. Approved ✓ (lead-discovered, no bootstrap).`);

const spawnDied = (who) => ({ feature: F.id, aborted: spawnDiedMsg(who), passed: false });

// Build ONE dependency wave: a 1-task wave is a solo coder on feature/<id>; a ≥2-task wave builds its
// file-disjoint coders CONCURRENTLY in isolated worktrees, then one integrator cherry-picks the wave
// onto feature/<id> and records the board. All spawns are workflow-level — the deterministic conductor
// owns them so the sequence is guaranteed (the lead COULD nest-spawn, but we keep its context bounded).
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

// ── BUILD ⇄ VERIFY — inline (already built + verified in PLAN), or the wave loop ──
const buildMode = String(plan.buildMode || "waves").trim().toLowerCase() === "inline" ? "inline" : "waves";
let verify = null, grade = "CHANGES", round = 0;

if (buildMode === "inline") {
  round = 1;
  grade = String(plan.grade || "BLOCKED").toUpperCase();
  if (grade !== "PASS" && grade !== "BLOCKED") grade = "BLOCKED";
  log(
    `plan: buildMode=inline — the lead built + verified the feature in ONE warm context. ` +
    `grade=${grade}, tasksDone=${plan.tasksDone ?? "?"}/${plan.tasksTotal ?? "?"}, ` +
    `blockers high=${plan.high || 0} medium=${plan.medium || 0} low=${plan.low || 0}.`
  );
} else {
  let waves = cleanWaves(plan.waves);
  log(`plan: buildMode=waves — ${waves.length} wave(s), ${waves.reduce((n, w) => n + w.length, 0)} task(s) — ${wavesStr(waves)}.`);
  while (round < MAX_ROUNDS) {
    round += 1;

    await buildWaves(waves, round);

    // VERIFY: the lead authors/extends the keyword layer + runs the WHOLE folder + acceptance checks.
    phase(`verify r${round}`);
    verify = await spawn(
      "lead",
      `MODE: VERIFY (round ${round} of ${MAX_ROUNDS}). You are the Tiger Lead VERIFYING feature ${F.id}
       on branch feature/${F.id}. The coders built this round's tasks and flipped their board status.
       Judge behavior against tiger/features/${F.id}/spec.md (the detailed requirements — the source of
       truth). Do Phase C of agents/tiger-lead.md for REAL (Iron Law — no claim without fresh execution):
         • Author/extend tiger/features/${F.id}/e2e_keywords.resource (comment-free real bodies) for YOUR
           suite (you authored the cases at PLAN time; extend the suite once per round as new risks
           surface — never delete/weaken a case to go green).
         • Run the WHOLE folder as a regression: robot --outputdir tiger/evidence tiger/features/ (EVERY
           feature's suite), plus every acceptance_criteria check as a real process. UI IS NOT OPTIONAL:
           drive any page/app in a real browser (robotframework-browser → Playwright). Fast probes may use
           robot tiger/features/${F.id}/e2e_testcases.robot; the verdict rests on the full-folder run.
         • Triage by priority (HIGH+MEDIUM block, LOW logged). A case of an already-PASSING other feature
           that regresses is HIGH — fix until green regardless of its tag. Consolidate proven cross-feature
           duplication (recorded in progress.md + the note); a shipped feature's APPROVED behavior is never
           silently changed — that is a spec conflict → grade BLOCKED. Attach refs/notes/e2e to the code
           commit; flip acceptance_criteria status from fresh evidence; record LOW in learning.*; set the
           board phase from the grade.
       ON GRADE = CHANGES: do the Phase D delta re-plan — write the delta tasks[] to the board (NEW ids
       suffixed -r${round}, each with exact files[]/depends_on/context/verification, proven RED now),
       commit chore(board): ${F.id} re-plan r${round}, and RETURN them grouped as deltaWaves
       (file-disjoint, dependency-ordered; most deltas fit ONE solo-coder wave). You do NOT spawn coders
       and you do NOT close the board to passing.
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
     tiger/CODEBASE_MAP.md, tiger/business.md, tiger/release_docs.md and the project README.md (per the
     tiger-docs writer sections); log any LOW e2e defects as known issues; close the board
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
// E2E_BLOCKERS counts surface here for the run log either way.
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
