// .claude/workflows/tiger-pipeline.js
//
// Tiger Pipeline — the ORIGINAL linear flow, adapted to the skills + a git worktree.
// One feature at a time, exactly as sketched:
//
//   grill (human, before this runs)
//     → architect (code planning: where the code goes)
//     → generator  — in a git WORKTREE branched from DEV: code + unit tests
//     → VALIDATE in the worktree (= DEV + feature): reviewer + security → e2e + FULL suite
//          ── any not pass ──> back to the generator (fix IN THE WORKTREE) → re-validate
//     → fast-forward merge the green branch to DEV (main stays protected)
//     → update docs (CODEBASE_MAP.md, feature_list.json, business.html, release_docs.html)
//
// One validate loop, up to 5 tries, then escalate. The worktree already holds all of DEV, so the e2e there IS an
// integration test; fast-forwarding a green branch onto an unchanged DEV can't break it (no post-merge re-test).
// No scheduler and no batch-planner —
// the architect does the code planning, and several features are just this same flow run one after another,
// each in its own worktree.
//
// RUNTIME RULES: meta is the first statement and a pure literal; the script does no filesystem, shell, clock,
// or randomness work itself (all I/O is inside agent prompts; the date is passed in via args); parallel() is a
// barrier and a dead thunk becomes null, so results are filtered; the reader uses a schema.

export const meta = {
  name: "tiger-pipeline",
  description: "Run approved features through the linear tiger-skills flow, one at a time, each in its own git worktree branched from the integration branch (default 'dev' — main stays protected): architect (code planning) → generator (worktree: code + unit tests) → VALIDATE in the worktree (reviewer + security → e2e + FULL suite; any not-pass loops back to the generator to fix in the worktree, up to 5 tries) → fast-forward merge the green branch to dev → update docs (CODEBASE_MAP.md, feature_list.json, business.html, release_docs.html). The worktree already holds all of dev, so the e2e there is an integration test; promoting dev → main is a separate release step. Grill + human spec approval happen before this runs. ARGS: {projectDir, today, + optional featureIds[], integrationBranch (default 'dev'), proModel, fastModel}.",
  phases: [
    { title: "read-backlog" },
    { title: "architect" },
    { title: "generate" },
    { title: "review" },
    { title: "e2e" },
    { title: "fix" },
    { title: "merge" },
    { title: "update-docs" },
  ],
};

// ── PREFLIGHT ────────────────────────────────────────────────────────────────
const A = args || {};
const MISSING = ["projectDir", "today"].filter((k) => typeof A[k] !== "string" || A[k].trim() === "");
if (MISSING.length) {
  return {
    aborted: "missing required args: " + MISSING.join(", ") + " — nothing ran: no agent spawned, no file touched.",
    howToLaunch:
      "Re-launch /tiger-pipeline with args: projectDir (absolute path to the target repo), today (YYYY-MM-DD, " +
      "passed in). Optional: featureIds (array — restrict to specific approved features; default = every ready, " +
      "approved, not-yet-passing feature, in priority order), integrationBranch (default 'dev' — main stays " +
      "protected), proModel/fastModel (pin models — leave unset to inherit the session/subagent default). " +
      "Grill + human spec approval come first. See workflows/README.md.",
    passed: false,
  };
}

const DIR = A.projectDir;
const TODAY = A.today;
const ONLY = Array.isArray(A.featureIds) && A.featureIds.length ? A.featureIds : null;
const DEV = (typeof A.integrationBranch === "string" && A.integrationBranch.trim()) ? A.integrationBranch.trim() : "dev"; // integration branch — main stays protected

// The review loop and the e2e loop EACH retry up to MAX_TRIES, then escalate. The token budget is a second
// backstop (agent() throws once spent), so a genuinely stuck feature stops gracefully either way.
const MAX_TRIES = 5;
const LOOP_HEADROOM = 50000;
const hasLoopBudget = () => budget.remaining() > LOOP_HEADROOM;

// ── MODEL ROUTING (opt-in; leave unset to inherit the session/subagent default) ──
const PRO = A.proModel || null;
const FAST = A.fastModel || PRO;
const MODEL_FOR = {
  "tiger-skills:code-architect": PRO,
  "tiger-skills:generator": FAST,
  "tiger-skills:reviewer": PRO,
  "tiger-skills:security-reviewer": PRO,
  "tiger-skills:executor": PRO,
  "tiger-skills:cartographer": PRO,
};

let CURRENT_PHASE = "init";
const step = async (name, thunk) => { CURRENT_PHASE = name; phase(name); return await thunk(); };

const callAgent = (type, prompt, ph, schema) => {
  const o = { phase: ph || CURRENT_PHASE };
  if (type) o.agentType = type;
  const m = (type && MODEL_FOR[type]) || PRO;
  if (m) o.model = m;
  if (schema) o.schema = schema;
  return agent(prompt, o);
};

// Verdicts — take the LAST occurrence of the token (the prompts demand it be the final line); ambiguity fails CLOSED.
const lastVerdict = (report, token) => {
  const s = String(report || "").toUpperCase();
  const at = s.lastIndexOf(token + ":");
  const m = at >= 0 ? s.slice(at + token.length + 1).match(/[A-Z]+/) : null;
  return m ? m[0] : "";
};
const passed = (r) => lastVerdict(r, "PIPELINE_STATUS") === "PASS";
const approved = (r) => lastVerdict(r, "REVIEW_VERDICT") === "APPROVED";
const securityOk = (r) => lastVerdict(r, "SECURITY_VERDICT") === "APPROVED";

const digest = (report, max = 2000) => {
  const t = String(report || "");
  if (t.length <= max) return t;
  const head = Math.min(700, Math.floor(max / 2));
  return t.slice(0, head) + "\n…[trimmed — full report stays in that agent's own context]…\n" + t.slice(-(max - head));
};

// ── READ THE BACKLOG ─────────────────────────────────────────────────────────
const BACKLOG_SCHEMA = {
  type: "object", additionalProperties: true, required: ["features"],
  properties: {
    features: {
      type: "array",
      items: {
        type: "object", additionalProperties: true, required: ["id", "title"],
        properties: {
          id: { type: "string" }, title: { type: "string" },
          specFile: { type: "string" }, adrFile: { type: "string" }, e2eCasesFile: { type: "string" },
          status: { type: "string" }, securitySensitive: { type: "boolean" },
        },
      },
    },
  },
};
const backlog = await step("read-backlog", () =>
  callAgent(null,
    `Read ${DIR}/feature_list.json and return, in priority order, the features that are READY TO BUILD: status
     'not_started', 'in_progress', or 'blocked' (NOT 'passing'), AND with a human-approved spec (spec_file present).
     ${ONLY ? "Restrict to these ids: " + ONLY.join(", ") + "." : ""}
     For each return: id, title, specFile (spec_file), adrFile (adr_file if present), e2eCasesFile
     (e2e_cases_file if present), status, securitySensitive. Read-only — modify nothing.`,
    "read-backlog", BACKLOG_SCHEMA)
);

// CANARY — if the first agent can't spawn, every later spawn fails the same way.
if (backlog === null || backlog === undefined) {
  return {
    aborted: "backlog reader died at spawn (agent returned null) — backend/API incompatibility, not a code " +
      "problem. PROVEN FIX: run the bundled repair proxy (node tools/anthropic-compat-proxy.js) in its own " +
      "terminal, then relaunch with ANTHROPIC_BASE_URL=http://127.0.0.1:8787; confirm CLAUDE_CODE_SUBAGENT_MODEL " +
      "is your backend's exact model name. See workflows/README.md -> Troubleshooting. No code written.",
    passed: false,
  };
}

let FEATURES = (backlog.features || []).filter((f) => f && f.id && f.status !== "passing");
if (ONLY) FEATURES = FEATURES.filter((f) => ONLY.includes(f.id));
if (!FEATURES.length) {
  return { aborted: "no ready features (approved + not 'passing'). Grill and approve a spec first, or pass featureIds.", passed: false, features: 0 };
}

// ── PER-FEATURE PROMPTS ──────────────────────────────────────────────────────
const WT = (id) => `${DIR}/.tiger-wt/${id}`; // this feature's isolated worktree

const archPrompt = (f) =>
  `Plan the code for feature ${f.id}: ${f.title} (read-only — no code yet). Project: ${DIR}.
   Read ${DIR}/CODEBASE_MAP.md FIRST (where code lives + existing types/functions), then the feature's docs:
   ${f.specFile || "specs/" + f.id + ".md"}${f.adrFile ? ", " + f.adrFile : ""}${f.e2eCasesFile ? ", " + f.e2eCasesFile : ""}.
   FIRST invoke code-quality-audit. Produce the CODE PLAN: WHERE each new file/module goes, which existing
   patterns to follow, and the task breakdown the generator will implement.
   Begin: 'code-quality-audit invoked: YES — N principles checked, M violations'.`;

const genPrompt = (f, plan) =>
  `Implement feature ${f.id}: ${f.title} in an ISOLATED git worktree branched from ${DEV} (the integration branch —
   main stays protected and untouched).
   From ${DIR}, ensure ${DEV} exists, then create the worktree + feature branch off it:
     git show-ref --verify --quiet refs/heads/${DEV} || git branch ${DEV}
     git worktree add .tiger-wt/${f.id} -b tiger/${f.id} ${DEV}
   Then work INSIDE ${WT(f.id)} (it already holds all of ${DEV} + your feature, so it IS the integrated codebase):
     - implement the feature + UNIT tests, following the code plan below
     - run the unit tests and make them pass
     - git add -A  &&  git commit -m "feat(${f.id}): ${f.title}"
   Code plan: ${digest(plan)}
   Spec: ${f.specFile || "specs/" + f.id + ".md"}. Invoke code-quality-language; build a Type Inventory; no placeholders.
   KEEP THE CODE SIMPLE AND READABLE — write the simplest logic that works: small flat functions, clear names,
   shallow nesting, early returns. NO clever one-liners, deep nesting, or hard-to-follow constructs. Readability over cleverness.
   No E2E here (the e2e step owns that). Begin: 'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
   End with a Board Update (files written, unit pass/fail).`;

const reviewerPrompt = (f) =>
  `Review feature ${f.id}: ${f.title} INDEPENDENTLY — you did NOT write it. Quality + correctness + unit tests.
   The code is in the git worktree ${WT(f.id)} (branch tiger/${f.id}). Spec: ${f.specFile || "specs/" + f.id + ".md"}.
   FIRST invoke code-quality-review (the 27 items); trace the control + data paths; confirm every acceptance
   criterion has a unit test (a user-facing AC with no test = BLOCKING).
   Begin: 'code-quality-review invoked: YES — 27 items checked, K BLOCKING, M MAJOR'.
   END with one line: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'.`;

const securityPrompt = (f) =>
  `Security review of feature ${f.id}: ${f.title} — you did NOT write it. Code in worktree ${WT(f.id)}.
   FIRST invoke security-review; audit the 12 categories (auth, secrets/API keys, injection, etc.); run the
   project's SAST/dep-audit if present. Spec: ${f.specFile || "specs/" + f.id + ".md"}.
   Begin: 'security-review invoked: YES — N categories checked, C critical, H high'.
   END with one line: 'SECURITY_VERDICT: APPROVED' or 'SECURITY_VERDICT: CHANGES'.`;

const e2ePrompt = (f) =>
  `Run the END-TO-END / integration test for feature ${f.id}: ${f.title}. You OWN the E2E. Run it IN THE WORKTREE
   ${WT(f.id)} — it holds all of ${DEV} + this feature, so this IS the integrated codebase (exactly what ${DEV}
   becomes after the merge).
   Invoke e2e-authoring: START from the cases in ${f.e2eCasesFile || "the feature's e2e_testcases.md"}, then THINK
   FOR YOURSELF — add edge/error cases grill missed — drive the REAL entry point (URL/CLI/API); scaffold Playwright
   if the project has none. Invoke harness-engineering-verify; run static → FULL unit suite (ALL features, no early
   stop, so a regression in ANY existing feature surfaces here, before merge) → E2E. If you add cases, write them
   back into the feature's e2e_testcases.md.
   Begin: 'harness-engineering-verify invoked: YES — layers run: 1,2,3'.
   END with one line: 'PIPELINE_STATUS: PASS' or 'PIPELINE_STATUS: FAIL'.`;

const fixPrompt = (f, who, findings) =>
  `${who} did NOT pass for feature ${f.id}: ${f.title}. Fix it IN THE WORKTREE ${WT(f.id)} — you are the generator.
   In one pass: diagnose the root cause, add a failing-first regression test if it is a bug (E2E flow if the bug
   is user-visible), apply the fix, run the tests, and commit there (git add -A && git commit -m "fix(${f.id}): ...").
   Keep the fix SIMPLE and READABLE — the smallest clear change, no clever logic.
   Findings: ${digest(findings)}
   Invoke code-quality-language. Begin: 'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
   End with a Board Update.`;

const mergePrompt = (f) =>
  `Feature ${f.id}: ${f.title} is FULLY GREEN in its worktree (review + security + e2e + full suite all passed).
   Promote it to ${DEV} with a FAST-FORWARD — ${DEV} has not moved since the worktree branched, so this replays the
   exact commits you already tested (no conflict, no re-test needed). From ${DIR}:
     git checkout ${DEV}
     git merge --ff-only tiger/${f.id}
   If --ff-only is refused (${DEV} moved unexpectedly), do a normal merge, RESOLVE any conflict (keep the correct
   combined behavior), and re-run the unit suite to confirm green. Then remove the worktree:
     git worktree remove .tiger-wt/${f.id} --force
   Do NOT touch main — promoting ${DEV} → main is a separate release step.
   Begin: 'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'.
   End with a Board Update (promoted to ${DEV}; fast-forward, or 'resolved conflict').`;

const docsPrompt = (f) =>
  `Feature ${f.id}: ${f.title} merged to ${DEV}. Update the docs for project ${DIR} (date ${TODAY}):
   1. CODEBASE_MAP.md — re-trace the flows this feature added/changed (function chains, real input/output types,
      file:line), update the Mermaid architecture + flow diagrams and their step tables, refresh the function/type
      inventory, prune deleted code. Create the file if missing.
   2. feature_list.json — set ${f.id} to 'passing' (it passed review + security + e2e on ${DEV}), flip its
      acceptance_criteria done=true with evidence, record date ${TODAY}. Update progress.md.
   3. release_docs.html — invoke tiger-skills:doc-release; prepend a release entry for ${f.id} in user language.
   4. business.html — invoke tiger-skills:doc-business; refresh it for ${f.id}.
   Validate feature_list.json after writing (Windows: PowerShell ConvertFrom-Json; never bare python). Do NOT run git.
   End: 'feature_list.json valid after write: YES'.`;

// ── THE LINEAR FLOW, ONE FEATURE AT A TIME ───────────────────────────────────
const results = [];
for (const f of FEATURES) {
  if (!hasLoopBudget()) { results.push({ id: f.id, passed: false, reason: "out of budget before starting" }); continue; }
  const id = f.id;

  // architect (code planning)
  const plan = await step(`architect:${id}`, () => callAgent("tiger-skills:code-architect", archPrompt(f), `architect:${id}`));

  // generator — build in the worktree
  const build = await step(`generate:${id}`, () => callAgent("tiger-skills:generator", genPrompt(f, plan), `generate:${id}`));
  if (build === null || build === undefined) { results.push({ id, passed: false, reason: "generator died at spawn" }); continue; }

  // VALIDATE loop (ALL in the worktree = DEV + feature): reviewer + security → e2e + full suite.
  // Any not-pass → generator fixes IN THE WORKTREE → re-validate (so an e2e-fix is re-reviewed). One loop, ≤MAX_TRIES.
  let green = false;
  let tries = 0;
  while (!green && tries < MAX_TRIES && hasLoopBudget()) {
    tries++;
    const [rev, sec] = await parallel([
      () => callAgent("tiger-skills:reviewer", reviewerPrompt(f), `review:${id}`),
      f.securitySensitive === true
        ? () => callAgent("tiger-skills:security-reviewer", securityPrompt(f), `review:${id}`)
        : () => Promise.resolve("SECURITY_VERDICT: APPROVED (no security-sensitive surface)"),
    ]);
    if (!approved(rev) || !securityOk(sec)) {
      await step(`fix:${id}-${tries}`, () => callAgent("tiger-skills:generator", fixPrompt(f, "Reviewer/Security", `REVIEW:\n${rev}\n\nSECURITY:\n${sec}`), `fix:${id}`));
      continue;
    }
    const e2e = await step(`e2e:${id}`, () => callAgent("tiger-skills:executor", e2ePrompt(f), `e2e:${id}`));
    if (!passed(e2e)) {
      await step(`fix:${id}-${tries}`, () => callAgent("tiger-skills:generator", fixPrompt(f, "E2E", e2e), `fix:${id}`));
      continue;
    }
    green = true;
  }
  if (!green) { results.push({ id, passed: false, reason: "did not pass review+e2e within " + MAX_TRIES + " tries (NOT merged — " + DEV + " untouched)" }); continue; }

  // PROMOTE the green worktree branch to DEV (fast-forward; main stays protected), then update docs.
  await step(`merge:${id}`, () => callAgent("tiger-skills:generator", mergePrompt(f), `merge:${id}`));
  await step(`update-docs:${id}`, () => callAgent("tiger-skills:cartographer", docsPrompt(f), `update-docs:${id}`));
  results.push({ id, passed: true });
}

return {
  features: FEATURES.length,
  passedCount: results.filter((r) => r.passed).length,
  passedIds: results.filter((r) => r.passed).map((r) => r.id),
  results,
};
