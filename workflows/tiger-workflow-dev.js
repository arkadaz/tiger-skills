// .claude/workflows/tiger-workflow-dev.js
//
// Thin launcher for the Tiger dev pipeline (v9). Runs ONE already-approved feature (grill happened
// first). Since Claude Code v2.1.172 a subagent CAN spawn its own subagents (the Agent tool works down
// to depth 5), so the orchestration no longer lives here: this workflow makes ONE spawn — the Tiger
// Lead in CONDUCT mode — and the LEAD is the conductor. The lead discovers + gates the feature, plans
// it, authors the e2e suite, and then:
//   • DEFAULT (inline) — builds + verifies the whole feature in its own warm context, or
//   • waves (genuinely large) — spawns tiger-code-generator coders ITSELF (parallel worktrees per
//     dependency wave + an integrator) via its Agent tool,
// runs the whole-folder Robot regression, loops the bounded delta re-plan itself, and on PASS spawns
// tiger-update-docs ITSELF to close the board + fast-forward merge to dev. This workflow only reads the
// lead's final object back.
//
// Why a thin launcher: on a healthy backend it keeps the /tiger-workflow-dev entry point + a single
// resumable spawn; and because everything nests under the lead, a backend where the workflow runtime
// can't spawn is served the SAME way by invoking /tiger-lead directly (the lead runs as a normal
// main-session subagent, where nested spawning is confirmed).
//
// Branch model: main is protected (never touched); dev is the integration trunk; feature/<id> is cut
// from dev and fast-forward merged back by update-docs (spawned by the lead). tiger-review stays
// standalone. Models mirror the agent frontmatter; pass proModel/fastModel (or "inherit") for
// non-Anthropic backends. Launch: /tiger-workflow-dev (no args).

export const meta = {
  name: "tiger-workflow-dev",
  description:
    "Run ONE human-approved Tiger feature through the v9 pipeline. Thin launcher: it makes a SINGLE spawn — the Tiger Lead in CONDUCT mode — and the LEAD is the conductor (Claude Code v2.1.172+ lets a subagent spawn its own subagents down to depth 5, so orchestration moved out of the workflow). The lead discovers the newest approved feature from feature_list.json itself (clocking it in), re-checks the feature.md approval token, resolves today + the dev trunk — so a bare /tiger-workflow-dev needs no args. It then recons + plans from spec.md (the detailed grilled requirements), writes tasks[] + CODEBASE_MAP.md + RED-proven acceptance checks, AUTHORS the feature's broad e2e_testcases.robot itself (boundary/typical/adversarial/error, priority-tagged), then adaptively builds: DEFAULT inline — it builds + verifies the feature in one warm context (fastest); waves for a genuinely large feature — it spawns file-disjoint tiger-code-generator coders ITSELF in isolated worktrees + an integrator. It runs the Robot suite over the WHOLE tiger/features/ folder (regression, Playwright for UI) + acceptance checks, triages by priority (HIGH+MEDIUM → delta re-plan → rebuild → re-verify, bounded; a regression in a shipped feature is HIGH; LOW logged), and on a clean pass finalizes (inline mode: the warm lead itself; waves mode: it spawns tiger-update-docs) to refresh docs + README, close the board, and fast-forward merge to dev. Never touches main. On a backend where this runtime cannot spawn, invoke /tiger-lead directly for the identical flow. Overrides: featureId, specFile, projectDir, today, proModel, fastModel.",
  phases: [
    { title: "conduct", detail: "lead: discover + gate + plan + e2e + build (inline default / waves: spawns coders itself) + verify + finalize (spawns update-docs)", model: "opus" },
  ],
};

const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");

const pick = (v, dflt) => (v === "inherit" ? null : v || dflt);
const PRO = pick(A.proModel, "opus");
const LEAD_AGENT = "tiger-skills:tiger-lead";

// Stages read + patch the board through the Python helper (installed as tiger/board.py) instead of
// dumping and hand-rewriting the whole JSON; it preserves every other field and fails closed on a
// broken invariant.
const BOARD_TOOL =
  "Read the board with `python3 tiger/board.py summary` (or `get <id> [field]`) and patch ONLY the " +
  "owning stage's fields with `python3 tiger/board.py` (set-phase/set-status/set-current/set-task/set-ac/" +
  "add-learning/add-task) — never dump or hand-rewrite the whole feature_list.json.";

const spawnDiedMsg = (who) =>
  who + " died at spawn (returned null) — backend/API incompatibility. Pass proModel/fastModel " +
  'matching your backend\'s model names (or "inherit"), then re-run — or invoke /tiger-lead directly ' +
  "(the lead runs as a normal subagent where nested spawning is confirmed).";

// The lead conducts the whole feature and returns ONE final object. abort != null ⇒ a discovery/approval
// gate failed and nothing was built. outcome is the run verdict; finalize is what update-docs (which the
// LEAD spawns on PASS) reported back.
const LEAD_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["abort"],
  properties: {
    abort: { type: ["string", "null"], description: "null when built; else the precise human-actionable gate failure" },
    featureId: { type: "string" },
    featureTitle: { type: "string" },
    today: { type: "string", description: "YYYY-MM-DD from `date +%F` — never invented." },
    branchBase: { type: "string", description: "The integration trunk — `dev`." },
    buildMode: { type: "string", description: '"inline" (the default) | "waves" (lead spawned coders itself)' },
    outcome: { type: "string", description: "PASS | CHANGES | BLOCKED" },
    grade: { type: "string", description: "same verdict as outcome (PASS|CHANGES|BLOCKED)" },
    high: { type: "number" },
    medium: { type: "number" },
    low: { type: "number" },
    tasksDone: { type: "number" },
    tasksTotal: { type: "number" },
    finalize: { type: "string", description: "MERGED_TO_DEV | NO_REMOTE_MERGED | REBASE_CONFLICT | n/a — from the tiger-update-docs the lead spawned on PASS" },
    rounds: { type: "number" },
    note: { type: "string" },
  },
};

// ── The ONLY spawn: the lead as conductor ──────────────────────────────────────────
phase("conduct");
const lead = await agent(
  `MODE: CONDUCT. You are the Tiger Lead AND the conductor of this feature. You are the ONLY spawn of
   this workflow — there is no bootstrap and no separate coder/verify/docs spawns; a subagent CAN spawn
   its own subagents now (Claude Code v2.1.172+, depth ≤ 5) and your frontmatter carries the Agent tool,
   so YOU spawn the coders and tiger-update-docs yourself. Work in the current project directory. Do your
   full manual (agents/tiger-lead.md) end to end in this one context.

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
      chosen feature's file and compare the trimmed value; "awaiting_review" / "approved (pending)" are
      NOT approved. If the newest fails the file-token re-check, drop it and take the next-newest.
   3. WIP RECONCILIATION — auto-switch to the newest. Let N = the chosen feature and
      O = \`python3 tiger/board.py in-progress\`:
        • O empty or O == N → ensure N is clocked in (set-status <N> in_progress + set-current <N> if not
          already), commit "chore(board): clock in <N> (phase: plan)".
        • O != N (an OLDER feature is in_progress while newer approved N waits) → PARK O (set-status <O>
          blocked, set-current null), then clock in N, append the switch to progress.md, commit
          "chore(board): park <O> (blocked), switch to newer approved <N>". If the hint names O, build O.
      board.py refuses any WIP>1 write, so park BEFORE the clock-in.
   4. APPROVAL GATE (strict — the ONE human gate). No approved, non-passing feature → abort with the
      precise reason ("feature(s) exist but none is approved — run tiger-grill"; "no feature on the board
      — run tiger-grill"; "tiger/board.py missing — run /tiger-skills:install").
   5. branchBase = "dev". Confirm dev exists (\`git rev-parse --verify dev\` or \`origin/dev\`); if missing
      but main exists, \`git branch dev main\`; if neither, abort "no dev branch and no main to create it
      from — run /tiger-skills:install first". Ensure the feature branch off dev (idempotent):
      \`git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>\` — never commit onto dev/main.
   Include featureId, featureTitle, today, branchBase in your final RETURN (abort=null).

   THEN CONDUCT the feature (Phases A→E of your manual), reading tiger/features/<id>/spec.md FULLY as the
   behavior contract (feature.md is the human summary + fallback on a pre-v8 feature):
   • PLAN — recon the real code yourself (no scout spawns), board PLAN (scope_map + tasks[] with exact
     files[]/depends_on/context/verification) + RED-proven acceptance_criteria + refresh CODEBASE_MAP.md,
     and AUTHOR tiger/features/<id>/e2e_testcases.robot NOW (before any code) — a BROAD priority-tagged
     suite covering everything you judge can happen. Commit the plan.
   • BUILD (adaptive) — DEFAULT inline: build it yourself, strict TDD per task. waves (genuinely large):
     spawn tiger-code-generator coders YOURSELF (agentType tiger-skills:tiger-code-generator, sonnet) —
     file-disjoint tasks concurrently in isolated worktrees per dependency wave + an integrator; a 1-task
     wave is one solo coder on feature/<id>.
   • VERIFY — author e2e_keywords.resource, run the WHOLE tiger/features/ folder for real
     (robot --outputdir tiger/evidence tiger/features/, Playwright for any UI) + every acceptance check as
     a real process, triage by priority (HIGH+MEDIUM block; a regression in a shipped feature is HIGH; LOW
     logged), attach refs/notes/e2e. On CHANGES: delta re-plan + rebuild + re-verify yourself, bounded to
     3 rounds → BLOCKED.
   • FINALIZE — on PASS refresh docs + README, close the board (status/phase passing, current_feature
     null), and fast-forward merge feature/<id> to dev (never touch main): in INLINE mode do this close-out
     YOURSELF (you're warm — no cold spawn); in WAVES mode spawn tiger-update-docs YOURSELF (agentType
     tiger-skills:tiger-update-docs, opus) to do it and read its FINALIZE_STATUS back.
   ${BOARD_TOOL}

   RETURN the final object: abort (null on success), featureId, featureTitle, today, branchBase, buildMode
   ("inline"|"waves"), outcome/grade (PASS|CHANGES|BLOCKED), high/medium/low, tasksDone/tasksTotal,
   finalize (the update-docs FINALIZE_STATUS, or "n/a"), rounds. Also end with the token lines your manual
   specifies (TIGER_LEAD / E2E_BLOCKERS / FEATURE_COMPLETE / TASKS_DONE / FINALIZE_STATUS) for the log.`,
  {
    agentType: LEAD_AGENT,
    phase: "conduct",
    ...(PRO ? { model: PRO } : {}),
    schema: LEAD_SCHEMA,
  }
);

if (lead === null || lead === undefined) {
  return { aborted: spawnDiedMsg("tiger-lead (conduct)"), passed: false };
}
if (lead.abort) {
  return {
    aborted: lead.abort,
    howToFix:
      "Finish the conversational gates first: run tiger-grill until tiger/features/<id>/spec.md + " +
      "feature.md exist and feature.md frontmatter has 'tiger-status: approved'; ensure WIP=1 and that a " +
      "dev branch exists (run /tiger-skills:install). Then re-run /tiger-workflow-dev (or /tiger-lead).",
    passed: false,
  };
}

const F = {
  id: lead.featureId || "",
  title: lead.featureTitle || lead.featureId || "",
  today: lead.today || "",
  base: lead.branchBase || "dev",
};
if (!F.id) {
  return { aborted: "lead CONDUCT returned no featureId and no abort reason — cannot proceed.", passed: false };
}

const buildMode = String(lead.buildMode || "inline").trim().toLowerCase() === "waves" ? "waves" : "inline";
const gradeRaw = String(lead.outcome || lead.grade || "CHANGES").toUpperCase();
const grade = gradeRaw === "PASS" || gradeRaw === "BLOCKED" ? gradeRaw : "CHANGES";
const finalize = String(lead.finalize || (grade === "PASS" ? "UNKNOWN" : "n/a")).trim() || "n/a";
const bugs = { high: lead.high || 0, medium: lead.medium || 0, low: lead.low || 0 };
const done = lead.tasksDone || 0;
const total = lead.tasksTotal || 0;
const rounds = lead.rounds || 1;
const outcome = grade === "PASS" && finalize !== "REBASE_CONFLICT" ? "PASS" : grade === "BLOCKED" ? "BLOCKED" : "CHANGES";

log(
  `conduct: feature ${F.id} ("${F.title}"), base ${F.base}, today ${F.today}. Approved ✓ (lead-discovered).`
);
log(
  `done: ${outcome} (buildMode=${buildMode}) — tasksDone=${done}/${total}, blockers high=${bugs.high} ` +
  `medium=${bugs.medium} low=${bugs.low}, finalize=${finalize}, rounds=${rounds}.`
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
  finalize,
  rounds,
  passed: outcome === "PASS",
  inspect: "open tiger/*.md; resume = git log + git notes --ref=e2e + board phase; or re-run /tiger-lead",
};
