# Spec: Catch real-use bugs — adversarial correctness review, mandatory E2E + regression testing, trigger-based security review

**Feature ID:** behavior-verification
**Status:** `approved`
**Grilled on:** 2026-06-05
**Approved by:** gta_35121@hotmail.com on 2026-06-05 (four design forks chosen via structured choices)

## Problem Statement

The pipeline's checkers verify *structure* (16 design principles + 11 tooling rules) and *the-tests-that-already-exist* (lint + whatever tests the generator wrote), but nothing verifies the code is *behaviorally correct*: agents ship code that passes its tests yet is full of bugs in real use, bug fixes silently break other parts, and no end-to-end workflow tests exist to catch either — so review passes too easily and a security review does not exist at all.

## User Stories

- As a user, I want an independent agent to adversarially trace the code's flow and prove each acceptance criterion with a real test, so a clean-but-wrong implementation cannot pass review.
- As a user, I want every user-facing feature to ship with an end-to-end test of the real workflow (plus supporting unit tests), so bugs that only appear when I actually run the program get caught.
- As a user, I want every bug fix to add a failing-first regression test and re-run the full unit + E2E suite, so fixing one thing can't quietly break another.
- As a user, I want a security review to run whenever the change touches a security-sensitive surface, so injection/secrets/authz flaws are caught before merge.

## Behavior

### Happy Path

1. A non-trivial feature reaches the review stage (GATE 11) → the conductor spawns a **Review Cluster**: the existing `reviewer` (quality), a new `correctness-reviewer` (always, for non-trivial), and a new `security-reviewer` (only if a security trigger fires).
2. `correctness-reviewer` invokes `code-correctness-review` and produces: a control-flow trace (happy path + every error/early-return path), a data-flow check, an edge-case enumeration (empty/null/boundary/large/duplicate/unordered/concurrent), a logic-bug hunt, and an **AC ↔ test map** naming the specific test that proves each acceptance criterion.
3. `correctness-reviewer` confirms an **E2E test of the real user workflow exists** and passed; if it is missing → **BLOCKING**.
4. `security-reviewer` (when triggered) invokes `security-review` and reports findings by category with CRITICAL/HIGH/MEDIUM/LOW severity.
5. All three verdicts aggregate. Any BLOCKING / CRITICAL / HIGH loops back to the generator (max 3 loops, the existing GATE 11 mechanism). When all reviewers approve → GATE 12 (track).
6. Earlier, at GATE 7/8: the **generator** writes the E2E workflow test first (red), then unit tests, then code (green); the **executor** runs all three verify layers including the now-mandatory E2E, runs the **full** suite (not fail-fast-and-stop) so regressions surface, and rejects a handoff with no E2E test or with acceptance criteria not covered by a test.
7. On any failure → the **healer** adds a failing-first regression test (E2E for user-visible bugs), prescribes the fix, and re-runs the **full** unit + E2E suite to confirm nothing else broke → **Success: real behavior verified, regressions caught, security surface checked.**

### Error Cases

| Trigger | Response |
|---------|----------|
| User-facing feature handed off with no E2E test of the workflow | Executor rejects the handoff; correctness-reviewer marks BLOCKING |
| An acceptance criterion has no test that proves it | Correctness-reviewer files a finding; verdict ≠ APPROVED |
| A fix makes a previously-passing test fail (regression) | Full-suite re-run catches it; executor escalates to healer |
| Security trigger fires but `security-review` was not invoked (no proof line) | Conductor rejects the review and re-spawns the security-reviewer |
| Any reviewer omits its proof line | Conductor rejects that review and re-spawns the agent |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Trivial change (typo, doc, config value) | Review cluster skipped; E2E not required; gates marked `skipped (trivial)` |
| Non-user-facing internal refactor (behavior-preserving) | E2E uses the existing suite as the regression guard; no new E2E required, but the full suite must stay green |
| No security-sensitive surface in the diff | Security gate marked `skipped (no security-sensitive surface)`; no security-reviewer spawned |
| Project has no E2E harness yet | Generator creates the minimal E2E scaffold for the project's stack as part of the first user-facing feature; correctness-reviewer verifies it runs |
| This plugin itself (markdown/JS/bash, no runnable app) | `./init.sh` is the E2E analog; the E2E/regression mandate is a pipeline policy applied to whatever target codebase the harness runs on |

## Constraints

- **Must not break:** the existing 13-gate sequence, the 8-agent pipeline, the Board Update / single-writer (scribe) model, proof-of-invocation, WIP=1, or `./init.sh` passing.
- **Gate numbering stays 0–13:** the two new reviewers join GATE 11 as a *cluster* rather than renumbering downstream gates.
- **Environment:** Claude Code plugin; hooks are prompt-injection markdown auto-discovered from `hooks/`; AGENTS.md must stay ≤150 lines (init.sh enforces).
- **Patterns to follow:** existing agent frontmatter (name/description/model/tools); existing skill frontmatter (name/description); the "mandatory skill invocation + proof line" pattern; the reviewer's verdict/Board Update format; the verify skill's layered pipeline + completion gate.
- **Dependencies:** builds on `harness-enforcement` (gates, proof lines, Board Update) and `code-quality-language` (the quality reviewer it sits beside).

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Correctness check | Harden existing reviewer / Dedicated adversarial agent / Agent + executor test-adequacy | **Dedicated adversarial agent** | Separate context + opus red-team mindset; on-brand with "separate doer from checker" (user choice) |
| Test mandate | Unit only / Unit + E2E / E2E focus | **Unit + E2E, focus on E2E** | E2E of the real user workflow is what catches real-use bugs and regressions (user choice) |
| Regression safety | None / Re-run failing test / Failing-first regression test + full-suite re-run | **Failing-first regression test + full-suite re-run** | Directly fixes "fix one thing, break another" |
| Security check | Fold into reviewer / Separate agent always-on / Separate agent trigger-based | **Separate agent + skill, trigger-based** | Independent context; runs only on security-sensitive surface to control cost (user choice) |
| Gate placement | Renumber gates / GATE 11 review cluster | **GATE 11 review cluster** | No disruptive renumber across many files; one fix loop |
| New names | — | agents `correctness-reviewer`, `security-reviewer`; skills `code-correctness-review`, `security-review` | Parallel to existing `*-reviewer` agents and `code-quality-review` skill |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | A `correctness-reviewer` agent (opus) exists; its report begins with `correctness-review invoked: YES — paths traced: P, edge cases: E, logic findings: K, ACs proven by test: X/Y` and contains a control-flow trace, edge-case enumeration, logic-bug hunt, and AC↔test map | `agents/correctness-reviewer.md` has valid frontmatter and the proof line + required sections |
| 2 | A `code-correctness-review` skill exists defining the adversarial protocol, the checklist, and the proof line | `skills/code-correctness-review/SKILL.md` has valid frontmatter (name=code-correctness-review) |
| 3 | `harness-engineering-verify` makes Layer 3 (E2E) mandatory for user-facing features and the completion gate requires E2E evidence | verify SKILL.md states E2E is required (not optional) for user-visible behavior |
| 4 | The generator writes unit + E2E (E2E-first for the workflow) and cannot hand off a user-facing feature without an E2E test; the executor runs the full suite (not fail-fast-stop) and rejects missing-E2E / AC-uncovered handoffs | `agents/generator.md` + `agents/executor.md` updated with these rules |
| 5 | The healer adds a failing-first regression test on every fix (E2E for user-visible bugs) and re-runs the full unit + E2E suite after the fix | `agents/healer.md` updated with the regression-test + full-suite-rerun rule |
| 6 | A `security-reviewer` agent (opus) + `security-review` skill exist, trigger-based, with a trigger table, category checklist, severity model, and proof line `security-review invoked: YES — N categories checked, C critical, H high` | `agents/security-reviewer.md` + `skills/security-review/SKILL.md` exist with the above |
| 7 | Conductor GATE 11 runs the review cluster (quality + correctness always for non-trivial; security when triggers fire); proof-of-invocation table + agents-at-a-glance list all 10 agents; `hooks/pre-agent-spawn.md` lists all 10 | `skills/harness-engineering/SKILL.md` + hook updated |
| 8 | plugin.json lists 15 skills at v4.7.0; marketplace.json, AGENTS.md, README, and `workflows/tiger-pipeline.js` updated; `./init.sh` passes with 10 agents + 15 skills | `./init.sh` reports 0 failures; counts match |

## Out of Scope (Explicitly)

- Companion `code-correctness-fix` / `security-fix` skills — the generator and healer fix issues; `code-quality-fix` patterns are reused. Deferred.
- A numeric code-coverage threshold gate — we mandate AC-mapped + E2E tests, not a coverage percentage.
- Bundling a SAST / dependency-CVE scanner — the security review is reasoning-based and may call a scanner if the target project already has one, but none is shipped.
- Runtime (command-based) hooks — this plugin uses prompt-injection hooks.
- Resolving the pre-existing `code-quality-review` cross-file count inconsistency (tracked as `code-quality-rewrite`).

## Open Questions

- None. Names in Key Decisions are proposed defaults — say so at approval if you want different ones.
