// .claude/workflows/tiger-workflow-dev.js
//
// Deterministic Tiger spine (v6). Runs ONE already-approved feature (grill happened first).
// The heavy inner loop lives inside ONE merged agent now — the workflow just discovers the
// feature and launches the lead:
//   bootstrap (sonnet) — discover the approved in-progress feature from the board, verify the
//       feature.md approval token, resolve today + the dev trunk. (This is why no args are needed.)
//     → lead (opus) — the merged architect + e2e gate that ALSO spawns the coders. In a single
//       context it: recons + writes the blueprint + board PLAN + RED-proven acceptance checks +
//       CODEBASE_MAP.md; SPAWNS tiger-code-generator subagents itself (parallel, file-disjoint
//       git worktrees, dependency waves) to build; AUTHORS + runs the Robot suite for real
//       (Playwright for UI, Process/OS otherwise) and triages by priority; on HIGH/MEDIUM it
//       re-plans the delta + re-spawns coders in the SAME context (no cold re-recon), bounded by
//       a hard round cap; and on a clean pass spawns tiger-update-docs to close the board and
//       fast-forward merge to dev. Keeping planner+verifier+orchestrator in one context is what
//       makes the loop short and UI coverage complete — the two pains the old split caused.
//
// Branch model: main is the protected release branch the workflow NEVER touches; dev is the
// integration trunk; feature/<id> is cut from dev (grill cut it) and fast-forward merged back to
// dev (update-docs, which the lead spawns). No in-loop security/reviewer (standalone skills).
// Models mirror the agent frontmatter; pass proModel/fastModel (or "inherit") for non-Anthropic
// backends. Launch: /tiger-workflow-dev (no args).

export const meta = {
  name: "tiger-workflow-dev",
  description:
    "Run ONE human-approved Tiger feature through the v6 pipeline. bootstrap (sonnet) discovers the approved feature from feature_list.json (clocking it in automatically if it was never started — so a freshly grilled+approved feature 'just works') and re-checks the feature.md approval token, so a bare /tiger-workflow-dev needs no args. Then lead (opus) — the merged architect + e2e gate — owns the whole build in a single context: it plans + writes tasks[] + CODEBASE_MAP.md, SPAWNS tiger-code-generator subagents itself (parallel isolated worktrees per dependency wave), AUTHORS + runs the Robot suite for real (Playwright for UI) and triages by priority (HIGH+MEDIUM re-plan the delta in-context → rebuild → re-verify, bounded; LOW logged), and on a clean pass spawns tiger-update-docs to refresh the markdown docs + README, close the board, and fast-forward merge to dev. The workflow never touches main; dev→main is a manual human step. Overrides: featureId, specFile, projectDir, today, proModel, fastModel.",
  phases: [
    { title: "bootstrap", detail: "discover the approved feature + dev trunk + today", model: "sonnet" },
    { title: "lead", detail: "merged plan + spawn coders + verify + bounded re-plan + finalize", model: "opus" },
  ],
};

const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");

const pick = (v, dflt) => (v === "inherit" ? null : v || dflt);
const PRO = pick(A.proModel, "opus");
const FAST = pick(A.fastModel, "sonnet");
const MODEL_FOR = { bootstrap: FAST, lead: PRO };
const AG = {
  lead: "tiger-skills:tiger-lead",
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

// ── LEAD — the merged plan + build + verify + finalize, one context ─────────────
// The whole inner loop (recon → blueprint → board PLAN → spawn coders in dependency-wave worktrees →
// integrate → author + run the Robot suite for real, incl. Playwright UI → priority triage →
// bounded in-context re-plan/rebuild on HIGH/MEDIUM → spawn update-docs on PASS) lives in the lead.
phase("lead");
const lead = await spawn(
  "lead",
  `Drive feature ${F.id} from plan to a graded verdict as the Tiger Lead — the merged architect + e2e
   gate that ALSO spawns the coders. You own the whole loop in ONE context; keep planner+verifier
   together so the loop stays short and UI coverage stays complete.
   Feature id: ${F.id}   Title: ${F.title}
   Feature doc: ${F.spec}  (READ IT FULLY, plus the sibling e2e_testcases.robot — requirements,
   CAN/CANNOT, the metric, decisions, business context, and the agreed e2e cases all live there.)
   Codemap: read tiger/CODEBASE_MAP.md if it exists; bootstrap it from tiger/templates/CODEBASE_MAP.md if missing.
   Project: ${F.dir}   Trunk: ${F.base}   Today: ${F.today}
   Coder model hint (pass to the tiger-code-generator subagents you spawn): ${FAST}

   SAFETY NET (idempotent): ensure the feature branch off ${F.base}, never commit onto ${F.base} or main:
     git checkout -b feature/${F.id} ${F.base} 2>/dev/null || git checkout feature/${F.id}

   Run your full procedure (agents/tiger-lead.md):
     A) RECON + PLAN — verify the doc's scope against the real code (file:line); write the blueprint,
        the board PLAN (scope_map + tasks[] each with exact files[]/depends_on/context/verification),
        RED-proven acceptance_criteria commands, and CODEBASE_MAP.md. Commit the board plan.
     B) BUILD — SPAWN tiger-code-generator subagents YOURSELF (subagent_type "tiger-skills:tiger-code-generator",
        isolation "worktree"): pack tasks[] into dependency waves, build file-disjoint tasks in parallel
        (emit the wave's coders in one message), then integrate the disjoint branches onto feature/${F.id}
        and record the board per wave. A 1-task wave is one solo coder.
     C) VERIFY — author tiger/features/${F.id}/e2e_keywords.resource (comment-free real bodies) and run
        the agreed robot suite + every acceptance check for REAL. UI IS NOT OPTIONAL: drive any page/app
        in a real browser (pip install robotframework-browser && rfbrowser init → Playwright); a UI
        deliverable never really driven is an automatic CHANGES. Do ONE bounded coverage-expansion pass
        per round (append the highest-value source:e2e cases, re-run). Triage by priority; set the board
        phase; attach refs/notes/e2e to the coders' code commit.
     D) BOUNDED FIX LOOP — on HIGH/MEDIUM, re-plan ONLY the delta tasks (ids suffixed -r<round>) in the
        SAME context (no cold re-recon), rebuild the delta waves, re-verify. Stop → blocked after 3 rounds,
        a no-progress round, or a genuinely unfixable defect.
     E) FINALIZE — on PASS spawn tiger-update-docs (subagent_type "tiger-skills:tiger-update-docs") to
        refresh the docs + README, close the board to passing, and fast-forward merge to ${F.base}; surface
        its FINALIZE_STATUS. On BLOCKED, ensure phase: blocked + the fix list in progress.md and stop.
   ${BOARD_TOOL}
   You NEVER write product code (your coders do), NEVER edit grill's agreed e2e cases or feature.md, and
   NEVER close the board to passing or merge yourself (update-docs owns that).
   END with EXACTLY these five lines, in order, last:
     TIGER_LEAD: <PASS|CHANGES|BLOCKED>
     E2E_BLOCKERS: high=<n> medium=<n> low=<n>
     FEATURE_COMPLETE: <YES|NO>
     TASKS_DONE: <doneCount>/<totalCount>
     FINALIZE_STATUS: <MERGED_TO_DEV|NO_REMOTE_MERGED|REBASE_CONFLICT|n/a>`,
  "lead"
);

if (lead === null || lead === undefined) {
  return {
    feature: F.id,
    aborted:
      "tiger-lead died at spawn (returned null) — backend/API incompatibility. Pass " +
      "proModel/fastModel matching your backend's model names (or \"inherit\"), then re-run.",
    passed: false,
  };
}

const verdict = leadVerdict(lead);
const bugs = e2eBlockers(lead);
const { done, total } = tasksProgress(lead);
const finStatus = verdict === "PASS" ? finalizeStatus(lead) || "UNKNOWN" : "n/a (not PASS)";
const outcome = verdict === "PASS" && finStatus !== "REBASE_CONFLICT" ? "PASS" : verdict === "BLOCKED" ? "BLOCKED" : verdict;

log(
  `lead: ${outcome} — tasksDone=${done}/${total}, blockers high=${bugs.high} medium=${bugs.medium} ` +
  `low=${bugs.low}, finalize=${finStatus}.`
);

return {
  feature: F.id,
  title: F.title,
  base: F.base,
  tasks: total,
  e2eBlockers: bugs,
  outcome,
  featureComplete: outcome === "PASS" && featureComplete(lead),
  finalize: finStatus,
  passed: outcome === "PASS",
  inspect: "open tiger/*.md; resume = git log + git notes --ref=e2e + board phase",
};
