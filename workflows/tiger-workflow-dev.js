// .claude/workflows/tiger-workflow-dev.js
//
// Deterministic Tiger spine (v10 — "coders build, the architect merges").
// Runs ONE already-approved feature (grill happened first). The WORKFLOW is the conductor: it spawns
// every agent itself so no step can be forgotten and every agent's context stays bounded to one phase.
//
// ROLES: tiger-lead = the ARCHITECT (plans, owns the e2e layer, MERGES every coder worktree, gates
// quality — modes PLAN / E2E-PROVISION / INTEGRATE / VERIFY, writes no product code). tiger-code-generator
// = the BUILDER (always spawned, always one task in an isolated worktree, code+tests only on its own
// branch — it never touches the primary checkout, the board, progress.md or notes, so N coders run
// concurrently with zero write races). tiger-update-docs = the CLOSER (docs, board close-out, ff-merge).
//
// SPINE: plan (lead PLAN discovers + gates the feature, recons ONCE, writes complete per-task packets —
// with an ABUSE corpus at every trust boundary — authors the WHOLE e2e layer before any code exists, and
// returns file-disjoint WAVES; a PROVISION spawn makes the Robot/Playwright runtime ready CONCURRENTLY,
// touching no file) → build (concurrent worktree coders per wave, nothing waiting on an install) →
// integrate (after each non-final wave the lead cherry-picks it, re-verifies the tip, audits the diff,
// repairs failed packets and re-queues them once; a tip that is not green stops the round) → verify (the
// lead merges the final wave, warm-starts from its verify journal, runs the WHOLE tiger/features/ folder
// as a regression + every acceptance check for real, and on a confirmed boundary defect extends the suite
// by the whole EQUIVALENCE CLASS; HIGH/MEDIUM ⇒ delta waves ⇒ rebuild, bounded by a round cap AND a
// no-progress detector) → finalize (update-docs ff-merges to dev; main is never touched).
//
// CONTEXT MANAGEMENT: exploration is paid ONCE by the lead and pushed down as packets; a coder reads
// exactly one task (`board.py task <id> <task>`), opens the files that task names, runs ONE bounded reuse
// check before writing new code, and reports a PACKET GAP instead of inventing an interface; every coder
// returns a STRUCTURED report the conductor threads into the architect's merge prompt; the lead keeps a
// verify journal on disk so a cold re-spawn resumes. Stage prompts stay lean on purpose — each agent
// already loads its own manual (agents/tiger-*.md) and the project CLAUDE.md, so these prompts carry the
// run-specific facts, the order of steps, and the return contract, not a re-teaching of the procedure.
//
// Requires: a project where `worktree.baseRef` is "head" (install sets it) — otherwise subagent worktrees
// branch from the repo's DEFAULT branch. The coders create their branch explicitly from feature/<id>, so
// the run survives either way, but "head" keeps the isolated checkouts on the feature's own work.
//
// Models mirror the agent frontmatter (proModel/fastModel/mechModel, or "inherit"). Reasoning effort is
// OPT-IN and omitted by default — {"effort":"high"} or per-stage {"planEffort":"xhigh"}; see effortOf.
// Launch: /tiger-workflow-dev (no args).

export const meta = {
  name: "tiger-workflow-dev",
  description:
    "Run ONE human-approved Tiger feature through the v10 pipeline: coders build, the architect merges. The WORKFLOW is the conductor — it spawns every agent, so every step is guaranteed and each context stays bounded to one phase. NO bootstrap spawn: lead PLAN (opus) discovers the newest approved feature from feature_list.json itself, re-checks the feature.md approval token, reconciles WIP, resolves today + the dev trunk, then recons ONCE and plans from spec.md — writing tasks[] whose context packets inline the exact code to REUSE, RED-proven acceptance checks, tiger/CODEBASE_MAP.md, and the feature's broad e2e_testcases.robot (boundary/typical/adversarial/error, priority-tagged) before any code exists — and returns dependency WAVES of file-disjoint tasks. The workflow then builds every wave with tiger-code-generator coders (sonnet, strict TDD, reuse-before-build, simplify + no comments) running CONCURRENTLY in isolated git worktrees, one task each, code/tests only on their own branch; during the first wave the lead authors the Robot keyword layer and provisions Playwright in parallel, so the e2e runtime is warm before the gate. The ARCHITECT does every merge: after each non-final wave it cherry-picks that wave onto feature/<id>, re-runs the project verification, audits the diff for reuse/quality/scope, repairs the packet of any failed task and re-queues it once. lead VERIFY (opus) merges the final wave, runs the WHOLE tiger/features/ folder as a regression plus every acceptance check for real (real browser for UI), audits code quality, and triages by priority — HIGH/MEDIUM become delta tasks rebuilt by fresh coders, bounded by a round cap and a no-progress detector. On a clean pass the workflow spawns tiger-update-docs to refresh the docs + README, close the board, and fast-forward merge to dev. Never touches main. Overrides: featureId, specFile, projectDir, today, proModel, fastModel, mechModel, and OPT-IN reasoning effort — effort for every stage or planEffort/provisionEffort/codeEffort/integrateEffort/verifyEffort/docsEffort per stage (omitted entirely unless asked, because the runtime pairs effort with thinking:disabled and some Anthropic-compatible backends reject that combination outright).",
  phases: [
    { title: "plan", detail: "lead: discover + gate, recon once, board packets + acceptance checks + e2e suite + waves", model: "opus" },
    { title: "build", detail: "parallel worktree coders (one task each) + the lead's e2e harness in the first wave", model: "sonnet" },
    { title: "integrate", detail: "lead: cherry-pick the wave, re-verify, quality audit, repair packets", model: "opus" },
    { title: "verify", detail: "lead: merge the final wave, run robot tiger/features/ + acceptance checks, triage", model: "opus" },
    { title: "finalize", detail: "update-docs: docs + README + board close-out + ff-merge to dev", model: "opus" },
  ],
};

const A = args || {};
const argStr = (k) => (typeof A[k] === "string" && A[k].trim() ? A[k].trim() : "");

const pick = (v, dflt) => (v === "inherit" ? null : v || dflt);
const PRO = pick(A.proModel, "opus");
const FAST = pick(A.fastModel, "sonnet");
// MECH = the mechanical tier, used only where there is no judgement to make: installing the e2e runtime.
// Every merge, audit and grade stays on PRO — INTEGRATE rewrites a failed task's packet so a fresh coder
// can build blind, which is architect recon, not mechanics.
const MECH = pick(A.mechModel, FAST);
const LEAD = "tiger-skills:tiger-lead";
// One row per STAGE, not per agent: plan / integrate / verify / provision are all the SAME lead agent
// definition, but each is a separate tuning point for model tier and reasoning effort.
const AG = { plan: LEAD, provision: LEAD, integrate: LEAD, verify: LEAD, code: "tiger-skills:tiger-code-generator", docs: "tiger-skills:tiger-update-docs" };
const MODEL_FOR = { plan: PRO, provision: MECH, integrate: PRO, verify: PRO, code: FAST, docs: PRO };

// ── Reasoning effort — OPT-IN, and omitted entirely by default ──────────────────
// The runtime hardcodes thinking:disabled on subagent requests while propagating the session effort,
// and some Anthropic-compatible backends reject that exact combination — every agent then dies at
// spawn. So this workflow sends NO effort field unless you ask for one, and a default run behaves
// exactly as it always has.
//   /tiger-workflow-dev {"effort":"high"}                          — every stage
//   /tiger-workflow-dev {"planEffort":"xhigh","provisionEffort":"low"}  — per stage (wins over "effort")
// Where it pays: raising PLAN buys enumeration quality, and one fix round costs ~700s, so that is the
// lever worth testing; provision and docs are mechanical and are where lowering it is free. Cheapening
// integrate or verify trades away the only independent judgement in the loop — don't.
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const effortOf = (stage) => {
  const v = argStr(stage + "Effort") || argStr("effort");
  return EFFORTS.has(v) ? { effort: v } : {}; // an unknown value is DROPPED, never sent
};
const MAX_ROUNDS = 3;
const MAX_WAVE_WIDTH = 6; // wider waves are split into sequential sub-waves; nothing is ever dropped
const CLIP = 240; // agent-authored strings are clipped before they re-enter another prompt
const CLIP_SHORT = 96; // per-field clip inside a multi-coder digest — 6 coders x 5 fields must stay small
const MAX_DIGEST = 6; // reports shown in one prompt; the rest collapse to a count

const spawn = (stage, prompt, phaseName, extra = {}) =>
  agent(prompt, {
    ...(AG[stage] ? { agentType: AG[stage] } : {}),
    phase: phaseName,
    ...(MODEL_FOR[stage] ? { model: MODEL_FOR[stage] } : {}),
    ...effortOf(stage),
    ...extra,
  });
// A thunk inside parallel() must never reject: one rejection would abort the whole wave and escape the
// run. Every spawn in a batch goes through this — a dead agent becomes null and is triaged downstream.
const safe = (p) => p.then((r) => r).catch(() => null);

// Machine verdicts — parse the token off a line that BEGINS with TOKEN:, take the last match,
// fail CLOSED (absent/garbled ⇒ the safe verdict, never a false PASS).
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
// The lead still ends its report with TIGER_LEAD / E2E_BLOCKERS / TASKS_DONE lines for the human log;
// the conductor drives off the structured returns below.

const clip = (v, n = CLIP) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s.length > n ? s.slice(0, n) + "…" : s;
};
const idList = (v) =>
  (Array.isArray(v) ? v : []).map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean);
// An optional numeric field: absent/garbled must stay UNKNOWN, never silently become 0 — a 0 would
// make the no-progress detector see a converging round as stuck.
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Stages read + patch the board through the Python helper (installed as tiger/board.py) instead of
// dumping and hand-rewriting the whole JSON; it preserves every other field and fails closed on a
// broken invariant.
// Every agent here loads a manual that already specifies board access in full, so the prompt carries a
// reminder, not a re-teaching — restated rules are paid again, uncached, in every spawn.
const BOARD_TOOL =
  "Board I/O through `python3 tiger/board.py` ONLY (read: summary / get / task <id> <task>; move status " +
  "AND current_feature together with the ATOMIC switch / park / close) — never hand-edit feature_list.json.";

// ── Schemas the conductor reads ─────────────────────────────────────────────────
// PLAN does its own DISCOVERY (no bootstrap spawn). abort != null ⇒ a gate failed and nothing was
// planned. Otherwise it returns dependency WAVES: each wave = file-disjoint task ids built concurrently.
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
    waves: {
      type: "array",
      items: { type: "array", items: { type: "string" } },
      description: "REQUIRED when tasks exist: dependency-ordered waves; each wave = FILE-DISJOINT task ids built in parallel",
    },
    uiFeature: { type: "boolean", description: "true when the deliverable is something a user opens/clicks (a real browser is mandatory at verify)" },
    tasksTotal: { type: "number" },
    verifyCmd: { type: "string", description: "the project's own verification one-liner (./init.sh or equivalent)" },
    assumptions: { type: "array", items: { type: "string" }, description: "interfaces the keyword layer assumes and VERIFY must re-check against the built code" },
    setupCmd: { type: "string", description: "what makes a FRESH checkout runnable (npm ci | pip install -r requirements.txt | cargo fetch | none) — a coder worktree has tracked files only" },
    planCommitted: { type: "boolean" },
    note: { type: "string" },
  },
};
// Every coder returns this — the conductor threads it into the architect's merge prompt.
const CODER_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["task", "status"],
  properties: {
    task: { type: "string" },
    status: { type: "string", description: "GREEN (committed, verified) | RED (built, not green) | BLOCKED (packet gap / env)" },
    branch: { type: "string" },
    commit: { type: "string" },
    filesTouched: { type: "array", items: { type: "string" } },
    reused: { type: "string", description: "what existing repo util / stdlib / platform feature was reused instead of new code" },
    packetGap: { type: "string", description: "the EXACT fact the packet was missing, when BLOCKED" },
    verification: { type: "string", description: "the command run + observed exit" },
    note: { type: "string" },
  },
};
// INTEGRATE = the architect merging one wave.
const INTEGRATE_SCHEMA = {
  type: "object",
  additionalProperties: true,
  // verificationGreen is REQUIRED: the conductor stops the round on a tip that is not green, so an
  // omitted field would halt a healthy run. Requiring it means only a genuinely broken return does.
  required: ["integrated", "verificationGreen"],
  properties: {
    integrated: { type: "array", items: { type: "string" } },
    failed: { type: "array", items: { type: "string" } },
    retry: { type: "array", items: { type: "string" }, description: "task ids whose packet you REPAIRED — rebuild them now (once)" },
    qualityFindings: { type: "array", items: { type: "string" } },
    verificationGreen: { type: "boolean", description: "did the integrated tip pass the project verification? false stops the round and sends what is known to the gate" },
    note: { type: "string" },
  },
};
// VERIFY = the gate: grade + blocker counts + (on CHANGES) the delta waves to rebuild.
const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["grade", "high", "medium", "tasksDone", "tasksTotal"],
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
// E2E-PROVISION = the e2e runtime, made ready in parallel with PLAN (the keyword layer is PLAN's).
const HARNESS_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["ready"],
  properties: {
    ready: { type: "boolean", description: "robot is importable and runnable" },
    browser: { type: "boolean", description: "a real browser driver is installed (required when uiFeature)" },
    dryrun: { type: "string", description: "clean | failed | skipped" },
    assumptions: { type: "array", items: { type: "string" }, description: "unused by PROVISION; PLAN returns the assumed interfaces" },
    note: { type: "string" },
  },
};

// Waves arrive as agent-authored JSON: tolerate the flat single-wave form, drop blanks, drop a task id
// that already built in an earlier wave, and split an over-wide wave into sequential sub-waves
// (file-disjoint ⇒ splitting is always safe, and it bounds each merge's blast radius).
const chunk = (ids) => {
  const out = [];
  for (let k = 0; k < ids.length; k += MAX_WAVE_WIDTH) out.push(ids.slice(k, k + MAX_WAVE_WIDTH));
  return out;
};
const cleanWaves = (ws) => {
  let waves = Array.isArray(ws) ? ws : [];
  if (waves.length && waves.every((w) => typeof w === "string")) waves = [waves];
  const seen = new Set();
  const out = [];
  for (const w of waves) {
    const ids = [];
    for (const id of idList(w)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    out.push(...chunk(ids));
  }
  return out;
};
const wavesStr = (ws) => ws.map((w) => "[" + w.join(",") + "]").join(" ") || "(none)";
const countWide = (ws) => (Array.isArray(ws) ? ws : []).filter((w) => Array.isArray(w) && w.length > MAX_WAVE_WIDTH).length;
const spawnDiedMsg = (who) =>
  who + " died at spawn (returned null) — backend/API incompatibility. Pass proModel/fastModel " +
  "matching your backend's model names (or \"inherit\"), then re-run.";

// ── PROVISION — the e2e RUNTIME, made ready CONCURRENTLY with PLAN ──
// It writes nothing in the repo (pip installs land in the environment), so it cannot race PLAN's commits
// or a later cherry-pick, and it needs no feature id — which is why it can start at t=0 instead of
// blocking a build wave. The keyword layer itself is authored by PLAN, before any code exists.
const provisionPrompt = () =>
  `MODE: E2E-PROVISION. You are the Tiger Lead making the e2e RUNTIME ready while the plan is being
   written. This spawn is ENVIRONMENT ONLY: install and verify, and do NOT create, edit, commit or stage
   ANY file in the repository — another agent is writing the plan in this checkout right now.

   1. \`python3 -c "import robot; print(robot.version.VERSION)"\` — if it fails, \`pip install robotframework\`
      and re-check. Report the version you actually observed.
   2. A real browser is mandatory for any UI deliverable, so unless the caller set TIGER_NO_BROWSER=1:
      \`python3 -c "import Browser"\` — if it fails, \`pip install robotframework-browser && rfbrowser init\`
      (this downloads Playwright; paying it here, off the critical path, is the point of this spawn) and
      re-check. If it cannot be installed, say so plainly — never report ready when it is not.
   3. Record the facts the gate would otherwise re-derive: the exact interpreter that has robot, whether
      \`robot\` is on PATH or must be run as \`python3 -m robot\`, and the browser driver state.
   4. Verify you left the tree untouched: \`git status --porcelain\` must show exactly what it showed when
      you started (report it if not).

   RETURN: ready (robot importable), browser (a real browser driver is installed and initialised),
   dryrun: "n/a" (PLAN owns the keyword layer and its dryrun), note (the runtime facts from step 3 —
   interpreter path, invocation form, driver state; the verifier reads this instead of probing again).`;

// ── PLAN — the lead discovers + gates the feature ITSELF, recons ONCE, and hands down waves ──
phase("plan");
// PLAN and PROVISION run CONCURRENTLY: the runtime install needs no feature id and writes nothing in
// the repo, so it costs zero critical path here — where it used to hold the first build wave's barrier
// open for minutes after the coders had already finished.
const [plan, provision] = await parallel([
  () => safe(spawn(
  "plan",
  `MODE: PLAN. You are the Tiger Lead — the ARCHITECT — and the FIRST spawn of this run. Follow your
   manual (agents/tiger-lead.md); this prompt carries what is specific to THIS run, the order of steps,
   and the return contract. You write NO product code: independent coders build every task from the
   packets you write, in isolated worktrees, and YOU merge their work later.

   Caller hints (use only if non-empty; else discover):
     featureId="${argStr("featureId")}"  specFile="${argStr("specFile")}"  today="${argStr("today")}"  projectDir="${argStr("projectDir")}"

   STEP 0 — DISCOVER + GATE (manual § Hard gates 1–5; do this BEFORE any planning):
   • Pick the feature by RECENCY — the NEWEST approved, non-passing one (\`python3 tiger/board.py
     newest-approved\`; \`candidates\` shows the oldest→newest queue) — never re-pin to an old stuck
     feature just because it is current_feature. A featureId hint overrides, if its token is approved.
   • APPROVAL = the chosen feature.md frontmatter 'tiger-status:' value is exactly "approved" (READ the
     file; tolerate surrounding whitespace/quotes). "awaiting_review" / "approved (pending)" are NOT.
     If the newest fails this re-check, drop it and take the next-newest candidate.
   • WIP: clock the chosen feature in with the ATOMIC \`python3 tiger/board.py switch <id>\` — it parks any
     other in_progress feature (→ blocked) and sets status + current_feature in ONE validated write.
     (Do NOT try set-status + set-current: WIP=1 and "current_feature == the in_progress feature" are
     checked together, so every two-step ordering is refused.) Record the switch in progress.md; commit
     the board.
   • today = hint else \`date +%F\` (never invented). branchBase = "dev"; create dev from main if missing.
   • ANY gate failure ⇒ RETURN {abort:"<precise, human-actionable reason>"} and STOP, planning nothing:
     none approved → "feature(s) exist but none is approved — run tiger-grill"; empty board → "no
     feature on the board — run tiger-grill"; no board helper → "tiger/board.py missing — run
     /tiger-skills:install"; no dev and no main → "run /tiger-skills:install first".
   • Then: git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>

   THEN PLAN (manual § MODE PLAN), in this order:
   1. READ tiger/features/<id>/spec.md FULLY — the detailed grilled requirements are the behavior
      contract (feature.md is the human summary, and the fallback contract on an old feature without
      spec.md). Then tiger/CODEBASE_MAP.md (bootstrap from tiger/templates/ if missing).
   2. RECON the real tree yourself, targeted — you are the ONLY agent that will explore this codebase
      for this feature — and build the REUSE INVENTORY (every existing util/type/service that already
      does part of this job, with its exact signature and file:line).
   3. scope_map + tasks[], each with exact files[] (its write scope), depends_on, its own runnable
      verification, and a COMPLETE context packet:
        WHERE / REUSE (the signature INLINED + file:line) / EXEMPLAR (file:line of the closest existing
        implementation to imitate) / INTERFACES (inlined) / CONNECTS (file:line) / CONVENTIONS (only
        where this module DEVIATES from CLAUDE.md — every coder already loads CLAUDE.md, do not restate
        it) / TEST + its RED command / BEHAVIOR (concrete input→output from spec.md).
      Self-test each: "could a coder that opens NOTHING but the files I named build this?"
      • ABUSE — MANDATORY for any task whose files[] contain a TRUST BOUNDARY (where caller-controlled
        data first enters: an HTTP/RPC handler, argv/stdin, a file/env/queue/socket read, or ANY
        deserialization of caller data). INSTANTIATE the standing hostile-input taxonomy in your manual
        (§ The standing hostile-input taxonomy) field by field — enumerate, do not brainstorm — as a
        corpus table: | field | declared type | hostile value | expected status/error |. Cover it in the
        suite with ONE data-driven [Template] case per boundary (one argument row per corpus entry), not
        one case per row. Instantiate the
        magnitude row TWICE: once for what comes IN, once for the RESULT going OUT. Plus the two
        invariants from that section, as tests the coder must keep green. Do this even when spec.md is
        silent on errors. The corpus rows and the e2e suite are ONE enumeration (step 5a).
   4. RED-prove every acceptance_criteria[].verification NOW; record the observed failure.
   5. AUTHOR THE WHOLE E2E LAYER — BEFORE any code exists. Both files, in this order:
      a. tiger/features/<id>/e2e_testcases.robot — broad, from spec.md: boundary + typical + adversarial
         cases, every error path, ≥1 per AC and per business rule, a real-browser case for any UI,
         exactly one priority:high|medium|low tag each, PLUS the ABUSE corpus you wrote in step 3 as ONE
         data-driven [Template] case per boundary — one argument row per corpus entry, priority:high.
      b. tiger/features/<id>/e2e_keywords.resource — a REAL, comment-free body for every keyword the
         suite names, written against the interfaces you just pinned. A \`No Operation\` / \`Log\`-only body
         is a defect, not a stub. Then prove the wiring: \`robot --dryrun --outputdir tiger/evidence
         tiger/features/<id>/\` must resolve every keyword. If robot is not importable yet (a concurrent
         spawn is installing it), skip the dryrun and say so in \`note\` — do NOT wait on it.
      Authoring the keywords now, with no implementation to bend them toward, is what makes the gate a
      pre-commitment rather than a description of whatever got built.
   6. Refresh CODEBASE_MAP.md. Commit EVERYTHING you wrote — the board, the codemap and BOTH e2e files
      (an uncommitted keyword layer is lost to the coders' cherry-picks):
      chore(board): <id> plan — scope + tasks + e2e suite (phase: plan).
   ${BOARD_TOOL}

   RETURN THE WAVES — the conductor builds them; you never spawn coders:
   • waves = dependency-ordered arrays of task ids. Every id inside ONE wave must have DISJOINT files[]
     (two tasks touching the same file can never share a wave — the merge would conflict and drop work),
     and every depends_on must be satisfied by an EARLIER wave.
   • MAXIMISE WAVE WIDTH — width is wall-clock. Prefer CONTRACT-FIRST decomposition: pin the interface
     between two tasks in the plan and inline it into BOTH packets so producer and consumer build
     concurrently. A dependency that exists only because you did not pin a type is not a real one; a
     chain of 1-task waves is a planning smell.
   • One task = one behavior + its test, in the smallest coherent file set.
   • waves must cover EVERY not-done task you wrote. Returning tasks with no waves builds nothing.
   Also return featureId, featureTitle, today, branchBase, uiFeature (does a user open/click the
   deliverable?), tasksTotal, verifyCmd (the project's own verification one-liner), setupCmd (what makes
   a FRESH checkout runnable — the coders build in worktrees that contain TRACKED FILES ONLY, so
   node_modules/.venv/target are absent; give the exact install command, or "none"), assumptions (the
   interfaces your keyword layer assumes, for VERIFY to re-check against the built code), planCommitted.`,
  "plan",
  { schema: PLAN_SCHEMA }
  )),
  () => safe(spawn("provision", provisionPrompt(), "plan", { schema: HARNESS_SCHEMA })),
]);
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
  ui: plan.uiFeature === true,
  verifyCmd: clip(plan.verifyCmd) || "./init.sh",
  setupCmd: clip(plan.setupCmd),
};
if (!F.id) {
  return { aborted: "lead PLAN returned no featureId and no abort reason — cannot proceed.", passed: false };
}
log(`plan: feature ${F.id} ("${F.title}"), base ${F.base}, today ${F.today}, ui=${F.ui}. Approved ✓ (lead-discovered, no bootstrap).`);

const spawnDied = (who) => ({ feature: F.id, aborted: spawnDiedMsg(who), passed: false });

// ── The BUILDER: one coder, one task, one isolated worktree, code+tests only ──
// Uniform mode — there is no primary-checkout path for a coder. The primary checkout belongs to the
// architect alone, so a coder can never race the harness or the merge, and no coder writes the board.
const coderPrompt = (tid, round, waveNo) =>
  `WORKTREE CODER. Build EXACTLY ONE task — "${tid}" — of feature ${F.id}, in your own isolated git
   worktree. Round ${round}, wave ${waveNo}. Sibling coders are building this wave's other tasks right
   now; the ARCHITECT cherry-picks every branch afterwards. Follow your manual
   (agents/tiger-code-generator.md); this prompt carries the run-specific facts.
   ${round > 1
     ? `This is a FIX round: "${tid}" is a delta task the architect wrote after the gate found defects. Its
   packet is the repaired, AUTHORITATIVE instruction — build exactly it. Do not go read the e2e note or
   hunt for other findings; anything else that matters is already in the packet.`
     : ""}

   1. BRANCH (yours alone; never check out feature/${F.id} itself):
        git checkout -b feature/${F.id}-r${round}w${waveNo}-${tid} feature/${F.id}
      If git rejects that name, replace every character outside [A-Za-z0-9._-] with "-" and RETURN the
      branch you actually created, exactly — the architect cherry-picks what you report.
   2. PACKET — your ONLY board read, and your instructions:
        python3 tiger/board.py task ${F.id} ${tid}
      If it fails because the task id is not on the board, STOP: RETURN status="BLOCKED",
      packetGap="task ${tid} is not on the board". (Only if it fails as an UNKNOWN SUBCOMMAND — an old
      installed board.py — fall back to \`python3 tiger/board.py get ${F.id}\` and read ONLY your own
      task entry from it.) Open the files the packet names (its files[], its REUSE and EXEMPLAR pointers,
      plus tiger/features/${F.id}/spec.md when you need the exact rule). Do NOT sweep the tree to "get
      oriented" — the architect already paid that cost for all of us.
   2b. MAKE THE WORKTREE RUNNABLE FIRST. A git worktree contains TRACKED FILES ONLY — node_modules/,
      .venv/, target/, vendor/ and every build cache are absent, so an unbootstrapped test run fails on a
      missing module, which is NOT a valid RED. Run the project's own setup${F.setupCmd ? ` — ${F.setupCmd}` : " (npm ci / pip install -r requirements.txt / cargo fetch / whatever this repo uses)"} BEFORE the RED
      command. If setup itself fails, RETURN status="BLOCKED" with the exact error — never fake a RED.
   2c. If your packet carries an ABUSE section, its corpus rows are TESTS YOU MUST WRITE and keep green —
      part of this task, not a suggestion, and usually where the real defect hides. No corpus row may
      produce an unhandled exception or a 5xx (validate the type at the boundary; a blanket catch-all is
      a FORBIDDEN way to pass), and every success body must round-trip a STRICT parser. If you cannot
      satisfy a row, RETURN status="RED" with the row — never delete it.
   3. REUSE BEFORE YOU BUILD (ladder — stop at the first rung that works): YAGNI → the repo utility your
      packet names → the standard library → a native platform feature → an already-installed dependency
      → minimal new code. ONE bounded reuse check is sanctioned and expected: before you write a new
      helper, grep the directories your packet names for one that already exists. Re-implementing
      something the repo or stdlib already provides is a DEFECT the architect's audit sends back even
      when your test is green. Report what you reused.
   4. PACKET GAP > guessing. If an INTERFACE or BEHAVIOR fact you need is missing and not in the files
      the packet names, STOP: commit nothing, RETURN status="BLOCKED" and packetGap="<the exact missing
      fact>". Never invent an interface; never reconstruct one by reading the tree. That gap is the
      architect's bug to fix once, for every future coder. (A file you need that is not in files[] is a
      packet gap too, not permission to widen your scope.)
   5. STRICT TDD: write the ONE failing test → run the packet's RED command → confirm it fails for the
      RIGHT reason (missing behavior, not an import error) → minimal implementation → GREEN → SIMPLIFY
      (shortest readable form, delete dead code, STRIP EVERY COMMENT — generated code is comment-free)
      → re-run GREEN → run the task's own \`verification\`, recording the command and its exit code.
      A red test means fix the CODE. Never weaken, loosen, skip, or delete a test to go green; correct a
      test only where it genuinely contradicts spec.md, and say so in your return.
   6. SELF-CHECK before committing — every line must hold: \`git status --porcelain\` (it lists UNTRACKED
      files too — \`git diff --name-only\` would miss the new module and test you just created) shows only
      your files[] + its test file; zero comments in what you wrote (shebang / required pragma excepted);
      no placeholder, TODO, broad catch-all or silent fallback; read_only untouched; no test weakened.
   7. COMMIT ONCE — code + tests ONLY, on YOUR branch: \`<type>(<scope>): <subject>\`. Never touch
      feature_list.json, progress.md, git notes, or another task's files; never push, rebase, or merge.
      The architect records the board from the evidence you report.

   RETURN: task, status (GREEN|RED|BLOCKED), branch, commit, filesTouched, reused (what existing code
   you used instead of writing new), packetGap (when BLOCKED), verification (command + observed exit),
   note. Report honestly — a false GREEN is caught at the gate and costs a whole round.`;

const STATUS_RE = /^(GREEN|RED|BLOCKED)\b/;
const normalizeCoder = (tid, r) => {
  if (!r || typeof r !== "object") {
    return { task: tid, status: "DIED", branch: "", commit: "", reused: "", packetGap: "", verification: "" };
  }
  // Anchored: a garbled status ("NOT GREEN yet") must never read as GREEN and enter the merge list.
  const m = upper(r.status).trim().match(STATUS_RE);
  return {
    task: (typeof r.task === "string" && r.task.trim()) || tid,
    status: m ? m[1] : "UNKNOWN",
    branch: clip(r.branch),
    commit: clip(r.commit),
    reused: clip(r.reused),
    packetGap: clip(r.packetGap),
    verification: clip(r.verification),
  };
};

// Every field here is agent-authored and re-enters another agent's prompt, so the digest is bounded
// twice — per field and per row. A 6-wide wave of chatty coders would otherwise push the verify prompt
// past the ~8191-char limit that kills a subagent spawn on Windows.
const fitDigest = (d, budget) =>
  d.length <= budget ? d : d.slice(0, Math.max(0, budget - 74)) + "\n" + "… (digest truncated — confirm the rest with git branch --list)";
const coderDigest = (reports, budget) => {
  if (!reports.length) return "     (no coder reports — treat every task of this wave as unbuilt)";
  const line = (r) =>
    `     - ${r.task}: ${r.status}` +
    (r.branch ? ` | branch ${r.branch}` : "") +
    (r.commit ? ` | commit ${clip(r.commit, 12)}` : "") +
    (r.verification ? ` | verified: ${clip(r.verification, CLIP_SHORT)}` : "") +
    (r.reused ? ` | reused: ${clip(r.reused, CLIP_SHORT)}` : "") +
    (r.packetGap ? ` | PACKET GAP: ${clip(r.packetGap, CLIP_SHORT)}` : "");
  const shown = reports.slice(0, MAX_DIGEST).map(line);
  const rest = reports.length - shown.length;
  if (rest > 0) shown.push(`     - (+${rest} more coder report(s) — read their branches with git log)`);
  return fitDigest(shown.join("\n"), budget);
};

// ── The ARCHITECT merging ONE wave (every non-final wave) ──
const integratePrompt = (round, waveNo, wave, reports) =>
  `MODE: INTEGRATE (round ${round}, wave ${waveNo}). You are the Tiger Lead — the ARCHITECT and the ONLY
   writer of feature/${F.id}. This wave's coders built in isolated worktrees and committed on their own
   branches. Merge, prove, audit, repair — so the next wave builds on integrated, audited code instead of
   compounding a mistake. Manual: agents/tiger-lead.md § MODE INTEGRATE.

   Wave tasks: ${wave.join(", ")}
   Coder reports (trust the branch/commit; re-derive everything else yourself):
${coderDigest(reports, 2400)}

   1. MERGE. \`git checkout feature/${F.id}\`, then \`git rev-parse HEAD\` and WRITE THAT SHA DOWN — every
      shell command you run is a FRESH shell, so a \`BEFORE=...\` variable is empty in the next call; paste
      the literal sha into the diffs in step 3. For each GREEN report, cherry-pick the branch's WHOLE
      range so a coder that landed two commits does not lose one:
        \`git cherry-pick $(git merge-base feature/${F.id} <branch>)..<branch>\`
      (confirm the branches with \`git branch --list "feature/${F.id}-r${round}w${waveNo}-*"\`.)
      File-disjoint tasks apply cleanly. A REAL conflict means the plan's files[] were NOT disjoint —
      your bug: \`git cherry-pick --abort\`, leave that task not done, re-scope the files in the board,
      and list it in failed[]. NEVER hand-merge. A RED/BLOCKED/DIED coder has nothing to pick → failed[].
   2. RE-VERIFY THE INTEGRATED TIP for real (Iron Law — fresh execution): \`${F.verifyCmd}\` plus each
      integrated task's own \`verification\`. Individually-green tasks still break each other; that is
      what this catches. Fix ONLY the minimal integration cause yourself (an import, a wiring line, a
      rename); anything larger becomes a delta task at the gate.
   3. QUALITY AUDIT of this wave's diff (\`git diff <the sha from step 1>..HEAD\` — if it prints nothing,
      your sha is wrong; fix it before claiming the wave is clean):
      • REUSE — did a coder re-implement something the repo or stdlib already provides? Name the
        existing symbol. This is the finding that matters most.
      • COMMENTS — generated code is comment-free: \`git diff <the same sha>..HEAD | grep -nE '^\\+\\s*(#|//)'\`
        (shebang / required pragma excepted). Strip what slipped through.
      • SCOPE — every added path inside its task's files[]; read_only untouched.
      • WRITE-LESS — dead code, speculative abstraction, hand-rolled stdlib, needless indirection.
      • TESTS — nothing weakened, skipped, or deleted to go green.
      Fix trivia yourself in a SIMPLIFY commit (tests stay green); structural findings become delta tasks.
      Safety, validation, and authz are NEVER on the delete-list.
   4. REPAIR THE PACKETS. For every failed task and every PACKET GAP above, rewrite that task's context
      packet on the board so a fresh coder can build it blind — INLINE the missing signature/type/call
      site, do not merely restate the gap — and return it in retry[] (it rebuilds immediately, once).
   5. RECORD. \`python3 tiger/board.py set-task ${F.id} <task> done --evidence "<the fresh command + exit
      you observed>"\` for each INTEGRATED task (you are the board writer for the coders); append
      progress.md; ONE commit: \`chore(board): ${F.id} r${round} wave ${waveNo} — integrate\`.
   ${BOARD_TOOL}
   Do NOT run the full e2e folder here — that is the gate, after the last wave. Keep this tight.

   RETURN: integrated[], failed[], retry[] (ids whose packet you repaired), qualityFindings[] (one line
   each), verificationGreen, note.`;

// ── The GATE — the architect merges the final wave, then verifies the whole folder for real ──
const verifyPrompt = (round, waveNo, wave, reports, harnessNote, unbuilt, tipRed) =>
  `MODE: VERIFY (round ${round} of ${MAX_ROUNDS}). You are the Tiger Lead — the ARCHITECT and the single
   quality gate for feature ${F.id} on branch feature/${F.id}. You merge the LAST wave yourself, then
   prove the whole feature by REAL execution. Iron Law: no claim without a command you ran THIS session
   and the exit code you read — "should pass", a prior round, and reading code are never evidence.
   Manual: agents/tiger-lead.md § MODE VERIFY.
   Run facts (already established — do not re-derive): project verification = \`${F.verifyCmd}\`; this
   feature ${F.ui ? "HAS a UI deliverable, so at least one case MUST drive a real browser" : "has no UI deliverable"};
   integration trunk = ${F.base}.

   Final wave (${wave.length ? `w${waveNo}` : "none"}): ${wave.length ? wave.join(", ") : "(nothing was built this round)"}
   Coder reports:
${coderDigest(reports, 1200)}
   ${unbuilt.length ? `Tasks known NOT built earlier this round (packet repaired, failed integration, or skipped after a red tip): ${unbuilt.join(", ")}` : ""}
   ${tipRed}
   ${harnessNote}

   STEP 1 — MERGE THE FINAL WAVE. \`git checkout feature/${F.id}\`; cherry-pick each GREEN branch above with
   its whole range — \`git cherry-pick $(git merge-base feature/${F.id} <branch>)..<branch>\` —
   ${wave.length ? `(confirm with \`git branch --list "feature/${F.id}-r${round}w${waveNo}-*"\` — earlier waves of this round are already merged, do not re-pick them)` : ""}.
   A real conflict ⇒ the files[] were not disjoint: abort that pick, the task is unbuilt and becomes a
   delta task. Record each integrated task with \`python3 tiger/board.py set-task ${F.id} <task> done
   --evidence "<fresh cmd + exit>"\`; a coder that reported RED/BLOCKED/DIED leaves its task not done.

   STEP 2 — WARM START. If tiger/features/${F.id}/verify_notes.md exists, read it FIRST — your own
   journal from the previous round (environment facts, cases already proven, what was flaky, what to
   check first). Use it to skip re-DISCOVERY, never to skip re-EXECUTION.

   STEP 3 — THE GATE, every item, every round:
     • Repair the keyword layer where the built code diverged from the assumptions above, and EXTEND the
       suite this round: ONE deliberate pass for the highest-value gap it still misses (a boundary, an
       abuse input, an error path, a UI state) — PLUS, whenever you CONFIRM a defect at a trust boundary,
       the whole EQUIVALENCE CLASS of that defect, not just the input that caught it. A wrong-type
       operand implies every wrong type on every field of that handler; a non-finite result implies every
       operation that can produce one; an over-range int implies the other numeric fields. Enumerate the
       class and add a case per row. Finding one sibling hole per round instead of the whole family is
       exactly what turns one fix round into three. You own these cases: never delete or weaken one to go
       green; correct a case only where it contradicts spec.md, and call that out in the note.
     • \`robot --outputdir tiger/evidence tiger/features/\` — EVERY feature's suite, a regression over the
       WHOLE folder. output.xml / report.html ARE the evidence. (\`--rerunfailed\` / a single suite are
       fine for fast probes; the PASS verdict rests on one clean full-folder run.)
     • Every acceptance_criteria[] check as a real OS process. Run the ones that do NOT start a server in
       ONE bash turn so you pay one round-trip, not one per check — each with its own timeout, no \`set -e\`:
         \`timeout 60 <cmd1>; echo "AC <id1> EXIT=$?"; timeout 60 <cmd2>; echo "AC <id2> EXIT=$?"; …\`
       then read each EXIT line. Any check that starts a server or a browser keeps its own turn with an
       explicit teardown. The Iron Law is satisfied by running the command and reading its exit — batching
       the round-trips does not weaken it; skipping a check does.
     • UI IS NOT OPTIONAL: if a user opens or clicks the deliverable, at least one case must drive it in
       a real browser (Playwright) — never a grep of the HTML. A UI deliverable never really driven is
       an automatic CHANGES.
     • DISTRUST YOUR OWN PLAN: you wrote these checks, so attack them. For each key behavior ask "would
       the laziest wrong implementation also pass this?" — if yes, derive a diverging input from spec.md,
       run it, judge against the spec. Any attacker-controllable input gets ≥1 abuse input; a confirmed
       vulnerability is HIGH.
     • Tear down every server/browser you start, in every exit path.

   STEP 4 — QUALITY AUDIT of the feature diff (\`git diff ${F.base}...HEAD\`) through the five lenses in
   your manual § MODE VERIFY${round > 1 ? " — audit THIS round's delta commits FIRST, then skim the rest: a fix that opens a sibling hole is the classic way a round 2 becomes a round 3" : ""}. Behaviour-safe findings are MEDIUM.

   STEP 5 — TRIAGE (manual's table): HIGH = failing priority:high/smoke case, any failed acceptance
   check, confirmed abuse/data-loss, core JTBD broken, build won't run, a UI deliverable never really
   driven, or ANY REGRESSION in an already-passing OTHER feature (fix until green regardless of its tag).
   MEDIUM = failing priority:medium case, wrong non-critical path, missed spec edge, a structural quality
   finding. LOW = failing priority:low case, cosmetic. HIGH and MEDIUM block; LOW is logged only.

   STEP 6 — RECORD: flip each acceptance_criteria[].status from fresh evidence; set the board phase from
   the grade; record LOW defects in learning.* + progress.md; attach refs/notes/e2e to the latest CODE
   commit (grade + "blockers: high=<n> medium=<n> low=<n>" + the priority-ordered fixes); rewrite
   tiger/features/${F.id}/verify_notes.md as the journal for the NEXT round; commit board + suite +
   journal. ${BOARD_TOOL}

   ON GRADE = CHANGES — the delta re-plan is the ONLY way work gets rebuilt: write delta tasks[] to the
   board with NEW ids suffixed -r${round}, each with exact files[], depends_on, a COMPLETE repaired
   context packet (inline the code to reuse — the fixer explores nothing either) and its own verification
   proven RED now. For a trust-boundary defect the delta packet MUST carry the whole equivalence class in
   its ABUSE section and its \`verification\` MUST assert the CLASS, not the single input that caught it —
   a fix proven against one row leaves its siblings live and buys you another round; commit \`chore(board): ${F.id} re-plan r${round}\`; RETURN them grouped as deltaWaves
   (file-disjoint, dependency-ordered, as WIDE as the file sets allow). You do NOT spawn coders and you
   do NOT close the board to passing.

   RETURN: grade (PASS|CHANGES|BLOCKED), high, medium, low, tasksDone, tasksTotal, deltaWaves ([] unless
   CHANGES), reason. Report the counts as real numbers — the conductor's no-progress detector reads them.
   PASS requires zero HIGH and zero MEDIUM on fresh full-folder evidence with every task done. End your
   report with the token lines (TIGER_LEAD / E2E_BLOCKERS / FEATURE_COMPLETE / TASKS_DONE /
   FINALIZE_STATUS: n/a) for the human log.`;

// ── BUILD ⇄ VERIFY — every task is built by a coder; the architect merges and grades ──
let waves = cleanWaves(plan.waves);
if (countWide(plan.waves)) {
  log(`plan: ${countWide(plan.waves)} wave(s) wider than ${MAX_WAVE_WIDTH} split into sequential sub-waves (nothing dropped).`);
}
const plannedTasks = num(plan.tasksTotal) || 0;
if (waves.length === 0 && plannedTasks > 0) {
  return {
    feature: F.id,
    aborted:
      `lead PLAN wrote ${plannedTasks} task(s) but returned no waves — nothing could be built, so the run ` +
      "stopped instead of gating an empty branch.",
    howToFix:
      "The plan is committed on feature/" + F.id + "; re-run /tiger-workflow-dev (the lead re-plans and must " +
      "return dependency-ordered waves of file-disjoint task ids covering every not-done task).",
    passed: false,
  };
}
log(
  `plan: ${waves.length} wave(s), ${waves.reduce((n, w) => n + w.length, 0)} task(s) — ${wavesStr(waves)}. ` +
  `Every task builds in its own worktree coder; the architect merges.`
);

const asm = idList(plan.assumptions).map((a) => clip(a, 80)).filter(Boolean).slice(0, 4);
const harnessNote = provision && typeof provision === "object"
  ? `e2e runtime (provisioned in parallel with PLAN): robot=${provision.ready === true}, browser=${provision.browser === true}. ` +
    `${clip(provision.note, 200)}` +
    (asm.length ? ` PLAN assumed these interfaces in the keyword layer — re-check each against the built code: ${asm.join("; ")}.` : "")
  : "The e2e runtime was NOT provisioned (that spawn failed): verify `import robot` yourself, install " +
    "robotframework (+ robotframework-browser && rfbrowser init for UI) BEFORE the folder run, and treat " +
    "the keyword layer PLAN committed as unproven until your first real run." +
    (asm.length ? ` PLAN assumed these interfaces: ${asm.join("; ")}.` : "");
log(`plan: e2e runtime robot=${provision && provision.ready === true} browser=${provision && provision.browser === true} (provisioned concurrently with PLAN).`);
const retried = new Set();
let verify = null, grade = "CHANGES", round = 0, prev = null, coders = 0;

while (round < MAX_ROUNDS) {
  round += 1;
  let finalWave = [], finalReports = [], finalWaveNo = 0, tipRed = "";
  const unbuilt = [];

  let i = 0;
  while (i < waves.length) {
    const wave = waves[i];
    const waveNo = i + 1;
    const isLast = i === waves.length - 1;
    const ph = `build r${round} w${waveNo}`;
    phase(ph);

    // The coders of a wave run CONCURRENTLY (file-disjoint ⇒ no write races); during the very first wave
    // the architect's e2e harness runs alongside them in the primary checkout, off the critical path.
    const thunks = wave.map((tid) => () => safe(spawn("code", coderPrompt(tid, round, waveNo), ph, { isolation: "worktree", schema: CODER_SCHEMA })));
    coders += wave.length;
    const raw = (await parallel(thunks)) || [];
    const reports = wave.map((tid, k) => normalizeCoder(tid, raw[k]));
    const green = reports.filter((r) => r.status === "GREEN").length;
    log(`  r${round} w${waveNo}: ${green}/${wave.length} coders GREEN — ${reports.map((r) => r.task + ":" + r.status).join(", ")}`);
    const gaps = reports.filter((r) => r.packetGap);
    if (gaps.length) log(`  r${round} w${waveNo}: ${gaps.length} packet gap(s) → the architect repairs the packet and re-queues: ${gaps.map((g) => g.task).join(", ")}`);

    if (isLast) {
      finalWave = wave;
      finalReports = reports;
      finalWaveNo = waveNo;
      i += 1;
      continue;
    }

    // Non-final wave ⇒ the architect merges it now, so the next wave builds on integrated, audited code.
    const iph = `integrate r${round} w${waveNo}`;
    phase(iph);
    const integ = await spawn("integrate", integratePrompt(round, waveNo, wave, reports), iph, { schema: INTEGRATE_SCHEMA });
    if (integ === null || integ === undefined) return spawnDied("tiger-lead (integrate)");
    const done = idList(integ.integrated);
    const failed = idList(integ.failed);
    const findings = idList(integ.qualityFindings).map(clip).filter(Boolean);
    log(
      `  integrate r${round} w${waveNo}: ${done.length} merged${failed.length ? `, ${failed.length} failed (${failed.join(", ")})` : ""}` +
      `, verification ${integ.verificationGreen === true ? "green" : "NOT green"}` +
      (findings.length ? ` — quality: ${findings.slice(0, 3).join(" | ")}` : "")
    );
    // Anything this wave did not land is carried to the gate prompt, so the verifier never has to
    // rediscover from the board that an earlier wave left work behind.
    failed.forEach((t) => { if (!unbuilt.includes(t)) unbuilt.push(t); });
    if (integ.verificationGreen !== true) {
      // Stop the round here: later waves would branch off a red feature/<id> and pile fresh work on
      // top of a broken tip. Hand the gate what is known and let it triage from real evidence.
      tipRed = `Integration tip was NOT green after r${round} w${waveNo}${integ.note ? ` (${clip(integ.note)})` : ""} — the remaining waves were NOT built; treat every task not listed as integrated as unbuilt.`;
      waves.slice(i + 1).forEach((w) => w.forEach((t) => { if (!unbuilt.includes(t)) unbuilt.push(t); }));
      log(`  integrate r${round} w${waveNo}: tip NOT green → skipping the remaining ${waves.length - i - 1} wave(s) and going straight to the gate.`);
      break;
    }
    const retry = idList(integ.retry).filter((t) => !retried.has(t));
    if (retry.length) {
      const queued = chunk(retry);
      retry.forEach((t) => retried.add(t));
      waves.splice(i + 1, 0, ...queued);
      log(`  integrate r${round} w${waveNo}: re-queued ${retry.length} repaired task(s) in ${queued.length} wave(s) — ${retry.join(", ")} (one retry each)`);
    }
    i += 1;
  }

  phase(`verify r${round}`);
  verify = await spawn(
    "verify",
    verifyPrompt(round, finalWaveNo, finalWave, finalReports, harnessNote, unbuilt, tipRed),
    `verify r${round}`,
    { schema: VERIFY_SCHEMA }
  );
  if (verify === null || verify === undefined) return spawnDied("tiger-lead (verify)");

  grade = String(verify.grade || "CHANGES").toUpperCase();
  if (grade !== "PASS" && grade !== "BLOCKED") grade = "CHANGES";
  const b = { high: num(verify.high), medium: num(verify.medium), low: num(verify.low) };
  const done = num(verify.tasksDone);
  const totalNow = num(verify.tasksTotal);
  const block = b.high === null || b.medium === null ? null : b.high + b.medium;
  // PASS is the one verdict that closes the board and lands code on dev, so the conductor re-derives it
  // instead of trusting the word: a "PASS" carrying blockers or unfinished tasks contradicts its own
  // numbers and is demoted, exactly like every other fail-closed check in this file.
  if (grade === "PASS" && ((block !== null && block > 0) || (totalNow !== null && done !== null && done < totalNow))) {
    log(
      `verify r${round}: returned PASS but its own numbers say otherwise (blockers=${block ?? "?"}, ` +
      `tasksDone=${done ?? "?"}/${totalNow ?? "?"}) → demoted to CHANGES.`
    );
    grade = "CHANGES";
  }
  log(
    `verify r${round}: ${grade} — tasksDone=${verify.tasksDone ?? "?"}/${verify.tasksTotal ?? "?"}, ` +
    `blockers high=${b.high ?? "?"} medium=${b.medium ?? "?"} low=${b.low ?? "?"}.` + (verify.reason ? ` ${clip(verify.reason)}` : "")
  );

  if (grade === "PASS" || grade === "BLOCKED") break;

  // No-progress detector: a round that completed no task AND cleared no blocker will not converge —
  // stop paying for it. Unknown counts are never treated as zero, so a garbled return cannot force it.
  const score = done === null || block === null ? null : { done, block };
  if (prev && score && score.done <= prev.done && score.block >= prev.block) {
    grade = "BLOCKED";
    log(`verify r${round}: no progress vs r${round - 1} (tasksDone ${prev.done}→${score.done}, blockers ${prev.block}→${score.block}) → BLOCKED (needs a human).`);
    break;
  }
  if (score) prev = score;

  waves = cleanWaves(verify.deltaWaves);
  if (waves.length === 0) {
    grade = "BLOCKED";
    log(`verify r${round}: CHANGES but no delta waves returned → BLOCKED (needs a human).`);
    break;
  }
  log(`re-plan r${round}: ${waves.length} delta wave(s) — ${wavesStr(waves)}.`);
}
if (grade !== "PASS" && grade !== "BLOCKED") {
  grade = "BLOCKED";
  log(`round cap (${MAX_ROUNDS}) reached without PASS → BLOCKED.`);
}

// ── FINALIZE — on PASS the workflow spawns update-docs to close out + ff-merge to dev ──
let finStatus = "n/a (not PASS)";
if (grade === "PASS") {
  phase("finalize");
  const docs = await spawn(
    "docs",
    `You are tiger-update-docs finalizing feature ${F.id} on branch feature/${F.id} (it PASSED the gate:
     zero HIGH, zero MEDIUM on fresh full-folder evidence). today=${F.today}. Do your full procedure
     (agents/tiger-update-docs.md): refresh tiger/CODEBASE_MAP.md, tiger/business.md,
     tiger/release_docs.md and the project README.md (per the tiger-docs writer sections); log any LOW
     e2e defects as known issues; close the board with the ATOMIC \`python3 tiger/board.py close ${F.id}\`
     (status: passing, phase: passing, current_feature: null in ONE validated write — a set-status +
     set-current pair is refused in both orders, because those invariants are checked together; you are
     the ONLY stage allowed to close); commit docs + README + board in ONE commit; rebase
     feature/${F.id} onto ${F.base} and, on a clean rebase, FAST-FORWARD MERGE it to ${F.base}. NEVER
     touch main, never open an MR, never edit code.
     ${BOARD_TOOL}
     END with: FINALIZE_STATUS: <MERGED_TO_DEV|NO_REMOTE_MERGED|REBASE_CONFLICT>.`,
    "finalize"
  );
  if (docs === null || docs === undefined) return spawnDied("tiger-update-docs");
  finStatus = finalizeStatus(docs) || "UNKNOWN";
}

const bugs = verify
  ? { high: num(verify.high) || 0, medium: num(verify.medium) || 0, low: num(verify.low) || 0 }
  : { high: 0, medium: 0, low: 0 };
const total = verify ? num(verify.tasksTotal) || 0 : 0;
const done = verify ? num(verify.tasksDone) || 0 : 0;
// PASS is only PASS if update-docs actually landed the branch: an allow-list, not a deny-list, so a
// garbled or missing FINALIZE_STATUS fails closed instead of reporting a merge that never happened.
const MERGED = finStatus === "MERGED_TO_DEV" || finStatus === "NO_REMOTE_MERGED";
if (grade === "PASS" && !MERGED) {
  log(`finalize: status "${finStatus}" is not a confirmed merge — reporting CHANGES, not PASS (the branch is intact; re-run to finish).`);
}
const outcome = grade === "PASS" && MERGED ? "PASS" : grade === "BLOCKED" ? "BLOCKED" : "CHANGES";

log(
  `done: ${outcome} — tasksDone=${done}/${total}, coders spawned=${coders}, blockers high=${bugs.high} ` +
  `medium=${bugs.medium} low=${bugs.low}, finalize=${finStatus}, rounds=${round}.`
);

return {
  feature: F.id,
  title: F.title,
  base: F.base,
  tasks: total,
  tasksDone: done,
  coders,
  e2eBlockers: bugs,
  outcome,
  featureComplete: outcome === "PASS",
  finalize: finStatus,
  rounds: round,
  passed: outcome === "PASS",
  inspect: "open tiger/*.md; resume = git log + git notes --ref=e2e + board phase",
};
