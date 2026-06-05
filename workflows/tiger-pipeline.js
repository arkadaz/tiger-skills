// .claude/workflows/tiger-pipeline.js
//
// Deterministic tiger-skills pipeline — the conductor's GATES 5–12 expressed
// as a fixed, git-committed orchestration script instead of a plan the
// conductor re-improvises each run. Runs ONE already-approved feature through
// the 10-agent pipeline:
//
//   explore → plan → [architect?] → persist-tasks → generate
//           → execute (full suite + mandatory E2E)
//           → (heal + regression test → regenerate → re-execute){≤3}
//           → review cluster: reviewer + correctness-reviewer + [security-reviewer]
//           → (fix → re-execute → re-review){≤3} → track
//
// ── BOUNDARY ────────────────────────────────────────────────────────────────
// Human-in-the-loop gates are NOT in here. GATE 0 (bootstrap), GATE 1 (grill +
// human spec approval), GATES 2–4 (ledger, clock-in, scope/WIP=1) stay in the
// conversational layer. This workflow assumes: the four harness files exist,
// the feature has a HUMAN-approved spec, and exactly one feature is in_progress.
// It encodes only the mechanical, reproducible part.
//
// ── UNVERIFIED API — research preview, reverse-engineered, read before trusting ─
// The workflow runtime (agent/parallel/pipeline/phase/budget) is a one-day-old
// research-preview surface not in Anthropic's public docs. Assumptions marked
// [ASSUMED] below MAY be wrong and are the first things to fix if it won't run:
//   [ASSUMED] agent() selects a named subagent via `subagent_type`. If the real
//             field differs (e.g. `agent`/`type`) change ONLY the run() helper.
//             If named selection is unsupported, embed each agent's role text in
//             the prompt instead (its .md system prompt) — behavior is the same.
//   [ASSUMED] phase(name, thunk) groups steps in the progress view and returns
//             the thunk's value. If phase() is a bare marker, drop the wrappers
//             and await the run() calls directly.
//   [ASSUMED] budget.remaining() returns a positive number while spend is left.
// Requires Claude Code ≥ 2.1.154. Launch with /workflows. Start scoped — a run
// spawns many agents and costs far more tokens than a normal turn.

// meta MUST be the first statement and a PURE literal — no vars, no template
// strings, no calls inside it. The runtime reads it before executing anything.
meta({
  name: "tiger-pipeline",
  description: "Run one approved feature through the tiger-skills GATES 5-12 agent pipeline: explorer, planner, code-architect, scribe, generator, executor, healer, reviewer. Deterministic and resumable; human grill/spec-approval happens before this runs.",
  version: "1.0.0",
});

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

// Single swap-point for the [ASSUMED] subagent selector. One agent = one call.
const run = (subagentType, prompt) => agent({ subagent_type: subagentType, prompt });

// Each gate agent already emits a proof line; we ALSO ask the gate-deciding
// agents (executor, reviewer) to end with a machine-readable status token so
// the loop conditions below are robust rather than fuzzy string-sniffing.
const passed = (report) => /PIPELINE_STATUS:\s*PASS/i.test(String(report || ""));
const approved = (report) => /REVIEW_VERDICT:\s*APPROVED/i.test(String(report || ""));
const correctnessOk = (report) => /CORRECTNESS_VERDICT:\s*APPROVED/i.test(String(report || ""));
const securityOk = (report) => /SECURITY_VERDICT:\s*APPROVED/i.test(String(report || ""));

// ── GATE 5a — EXPLORE (read-only recon; builds the Type Inventory) ───────────
const recon = await phase("explore", () =>
  run("tiger-skills:explorer",
    `Recon the codebase for ${F.id}: ${F.title}.
     Project directory: ${F.dir}. Spec file: ${F.spec} (read it).
     Produce a Recon Report: Type Inventory (existing types/functions/constants
     with file:line), Module Map, Existing Patterns, Integration Points,
     Already Exists — Do NOT Duplicate, Risks. You are read-only.
     Begin with the proof line: 'Type Inventory built: YES — N existing types catalogued'.`)
);

// ── GATE 5b — PLAN (blueprint + the persisted tasks[] JSON) ──────────────────
const blueprint = await phase("plan", () =>
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
  architecture = await phase("architect", () =>
    run("tiger-skills:code-architect",
      `Review the architecture for this blueprint:
       ${blueprint}
       FIRST invoke code-quality-audit, THEN map findings to patterns.
       Produce: Summary → Violations (file:line) → Pattern Recommendations → Verdict.
       Begin with: 'code-quality-audit invoked: YES — N principles checked, M violations'.`)
  );
}

// ── GATE 5c — PERSIST tasks[] (scribe is the single writer; I/O lives here) ──
await phase("persist-tasks", () =>
  run("tiger-skills:scribe",
    `Apply this Board Update to ${F.dir}/feature_list.json for ${F.id}:
     write the planner's 'Persisted Task Breakdown (JSON)' into the feature's tasks[].
     Blueprint: ${blueprint}
     Validate the JSON after writing (Windows: PowerShell ConvertFrom-Json; never bare python).
     End with: 'feature_list.json valid after write: YES — applied N deltas'.`)
);

// ── GATE 7 — GENERATE ────────────────────────────────────────────────────────
let handoff = await phase("generate", () =>
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

// ── GATE 8 — EXECUTE ─────────────────────────────────────────────────────────
let evidence = await phase("execute", () =>
  run("tiger-skills:executor",
    `Verify independently. Generator handoff: ${handoff}
     Project directory: ${F.dir}.
     Invoke harness-engineering-verify; run static → FULL unit suite (no early stop)
     → E2E (mandatory for user-visible behavior); fresh evidence from THIS run only.
     REJECT the handoff (report FAIL) if a user-facing feature has no E2E test of its
     workflow, or if any acceptance criterion has no asserting test.
     Begin with: 'harness-engineering-verify invoked: YES — layers run: 1,2,3'.
     END your report with exactly one line: 'PIPELINE_STATUS: PASS' or 'PIPELINE_STATUS: FAIL'.`)
);

// ── GATE 9 — HEAL loop (guarded: counter AND budget — determinism rule) ──────
let heals = 0;
while (!passed(evidence) && heals < MAX_HEAL && budget.remaining() > 0) {
  heals++;
  const fix = await phase("heal-" + heals, () =>
    run("tiger-skills:healer",
      `Diagnose and prescribe a fix. Executor escalation: ${evidence}
       Blueprint: ${blueprint}. Project directory: ${F.dir}.
       Invoke harness-engineering-diagnose; classify to one of five layers; give exact
       file:line fix instructions AND a MANDATORY failing-first regression test (fails on the
       broken code, passes after the fix; E2E if the bug was user-visible). Begin with:
       'harness-engineering-diagnose invoked: YES — layer: <X>'.`)
  );
  handoff = await phase("regenerate-" + heals, () =>
    run("tiger-skills:generator",
      `Apply these fixes and ADD the prescribed regression test, nothing more: ${fix}
       Blueprint: ${blueprint}. Project directory: ${F.dir}. End with a Board Update.`)
  );
  evidence = await phase("re-execute-" + heals, () =>
    run("tiger-skills:executor",
      `Re-verify. Generator handoff: ${handoff}. Project directory: ${F.dir}.
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
let qVerdict = await phase("review-quality", () =>
  run("tiger-skills:reviewer",
    `Review independently — you did NOT write this code.
     Handoff/diff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
     FIRST invoke code-quality-review and harness-engineering-review.
     Begin with: 'code-quality-review invoked: YES — 27 items checked, K BLOCKING, M MAJOR'.
     END with one line: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'.`)
);
let cVerdict = await phase("review-correctness", () =>
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
  ? await phase("review-security", () =>
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
  handoff = await phase("review-fix-" + reviews, () =>
    run("tiger-skills:generator",
      `Fix ONLY the reviewers' BLOCKING/MAJOR/CRITICAL/HIGH findings, and ADD any missing
       E2E / regression / per-acceptance-criterion tests they named: ${findings}
       Blueprint: ${blueprint}. Project directory: ${F.dir}. End with a Board Update.`)
  );
  // Re-verify BEFORE re-reviewing so a regression introduced by the fix surfaces.
  evidence = await phase("re-execute-review-" + reviews, () =>
    run("tiger-skills:executor",
      `Re-verify after review fixes. Generator handoff: ${handoff}. Project directory: ${F.dir}.
       Run the FULL suite (no early stop) + the E2E workflow test. Fresh evidence only.
       END with one line: 'PIPELINE_STATUS: PASS' or 'PIPELINE_STATUS: FAIL'.`)
  );
  qVerdict = await phase("re-review-quality-" + reviews, () =>
    run("tiger-skills:reviewer",
      `Re-review quality. Handoff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
       END with one line: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'.`)
  );
  cVerdict = await phase("re-review-correctness-" + reviews, () =>
    run("tiger-skills:correctness-reviewer",
      `Re-review correctness. Handoff: ${handoff}. Spec: ${F.spec}.
       Executor evidence: ${evidence}. Project directory: ${F.dir}.
       END with one line: 'CORRECTNESS_VERDICT: APPROVED' or 'CORRECTNESS_VERDICT: CHANGES'.`)
  );
  if (SECURITY_TRIGGER) {
    sVerdict = await phase("re-review-security-" + reviews, () =>
      run("tiger-skills:security-reviewer",
        `Re-review security. Handoff: ${handoff}. Spec: ${F.spec}. Project directory: ${F.dir}.
         END with one line: 'SECURITY_VERDICT: APPROVED' or 'SECURITY_VERDICT: CHANGES'.`)
    );
  }
}

// ── GATE 12 — TRACK (scribe writes final state; feature passes only if earned) ─
const tracked = await phase("track", () =>
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
  approved: clusterApproved(),
  qualityApproved: approved(qVerdict),
  correctnessApproved: correctnessOk(cVerdict),
  securityReviewed: SECURITY_TRIGGER,
  securityApproved: securityOk(sVerdict),
  heals,
  reviews,
  track: tracked,
};
