# Claude Progress

## Current State
- **Latest commit:** 82d7a92 (Update README: deterministic workflow + install command); behavior-verification (this session) staged for commit. harness-enforcement + code-quality-language already shipped in v4.6.0.
- **Branch:** main
- **Verification:** passing (`./init.sh` — 62/62 checks, 2026-06-05)
- **Last updated:** 2026-06-05

## Completed
- [x] harness-grill — Phase 0 grill skill, now wired as GATE 1 (Spec Gate). 2026-06-02
- [x] harness-rewrite — walkinglabs 5-subsystem structure + sub-skills + references. 2026-06-01
- [x] **harness-enforcement (this session)** — converted the harness from descriptive to mechanical:
  - feature_list.json upgraded to the kanban schema (`tasks[]`, `depends_on`/`blocks`, `acceptance_criteria`, `task_status_legend`, `link_semantics`) and all entries migrated
  - conductor SKILL.md rewritten as a hard **Gate Sequence** with GATE 1 Spec Gate (grill), GATE 2 live ledger, GATE 5 persist-blueprint-into-tasks[], and a proof-of-invocation table
  - all 5 agents given a mandatory skill gate + proof line; planner emits Persisted Task Breakdown (JSON); architect runs code-quality-audit by default for non-trivial; fixed planner's contradictory "clock in yourself" rules and executor's duplicated escalation header
  - 2 new hooks: `spec-gate.md` (UserPromptSubmit) and `pre-agent-spawn.md` (PreToolUse/Agent)
  - init.sh Layer 6 added: link integrity, reciprocity, acyclicity, task validity
  - schema propagated to feature sub-skill, minimal-pack, bootstrap, grill; AGENTS.md + README updated; spec written to specs/harness-enforcement.md
  - **agent expansion (5 → 8 agents):** added explorer (GATE 5a recon), reviewer (GATE 11 independent check), scribe (single writer of feature_list.json + progress.md); wired all three into the conductor; added the Board Update contract so agents drive the board without concurrent writes; updated existing agents' diagrams to the 8-agent pipeline; plugin v4.4.0
  - **harness-enforcement → passing** (verified, init.sh 58/58 at the time); WIP slot released to code-quality-language
- [x] **code-quality-language (this session):** made code-quality language-agnostic. Same 16 principles + 13 patterns; the 11 tooling rules restated as language-neutral *intents* applied by inferring each language's idioms from the repo. Replaced code-quality:python + code-quality:rust with ONE code-quality-language skill (Python and Rust kept as the two worked examples in references/). De-Pythonized the router/audit/fix/review sub-skills; generator + conductor now invoke code-quality-language. 14 → 13 skills; plugin v4.5.0. User forks: structure=universal-only (infer per language), seed=python+rust only.
- [x] **behavior-verification (this session):** closed the "passes its tests but is buggy in real use" gap. The checkers verified structure + the-tests-that-exist, never behavior. Added: (1) **correctness-reviewer** agent + **code-correctness-review** skill — adversarial: trace every control/data path, enumerate edge cases, hunt logic bugs, prove each acceptance criterion with a real test, require an E2E test of the user workflow (missing = BLOCKING); (2) **security-reviewer** agent + **security-review** skill — trigger-based 12-category audit (injection, authz, secrets, crypto, deserialization, deps, DoS); (3) **mandatory E2E + regression**: verify makes Layer 3 mandatory for user-facing work, generator writes E2E-first then unit, executor runs the FULL suite (no fail-fast) + rejects missing-E2E/AC-uncovered handoffs, healer adds a failing-first regression test + full-suite rerun. GATE 11 is now a **review cluster** (reviewer + correctness-reviewer + [security-reviewer]); wired into the conductor, pre-agent-spawn hook, and **baked into the deterministic tiger-pipeline.js** (cluster + `securitySensitive` trigger + re-execute-after-fix). 13 → 15 skills, 8 → 10 agents; plugin v4.7.0. Spec approved by user 2026-06-05. User forks: dedicated adversarial agent; unit+E2E focus E2E; failing-first regression + full-suite rerun; security separate+trigger-based; spec-first.

## In Progress
- [ ] behavior-verification (code complete + verified, ./init.sh 62/62 green; remaining: user review + commit). Holds the WIP=1 slot.
  - **Active since:** 2026-06-05
  - **Blocked by:** nothing
- harness-enforcement + code-quality-language: passing, already committed (v4.6.0). Only behavior-verification is new this session.

## Known Issues
- **code-quality-review cross-file count inconsistency** — review SKILL.md vs references/review-agent.md disagree on item totals (should be 27 = 16+11).
  - **Discovered:** 2026-06-01 — **Fix location:** skills/code-quality-review/SKILL.md, skills/code-quality/references/review-agent.md — tracked as feature `code-quality-rewrite`
- **.mcp.json has empty mcpServers** — referenced by plugin.json autoDiscovery but contains no servers.
  - **Discovered:** 2026-06-01 — **Fix location:** .mcp.json — tracked as feature `project-cleanup`
- **harness-engineering-review vs code-quality-review overlap** — both spawn independent reviewers; "which when" still under-specified.
  - **Discovered:** 2026-06-01 — **Fix location:** the two review SKILL.md files

## Resolved This Session
- Agents now reference and are REQUIRED to invoke their sub-skills (was: soft suggestions, skipped).
- code-architect now has a defined gate (GATE 6) and runs code-quality-audit by default for non-trivial features.
- hooks now functional and complete (8 files); grill is mechanically triggered.
- feature_list.json is no longer flat — tickets link and the plan persists.

## Failure Log

| Date | Task | Failure | Layer | Fix | Recurred? |
|------|------|---------|-------|-----|-----------|
| 2026-06-05 | Output quality | Code passed its tests but was buggy in real use; bug fixes caused regressions elsewhere; no E2E workflow tests; review passed too easily; no security review | Verification | GATE 11 review cluster (adversarial correctness + trigger-based security) + mandatory E2E + full-suite run + failing-first regression test, baked into tiger-pipeline.js | No |
| 2026-06-03 | Workflow | Steps dropped mid-run (plan/state updates skipped) | Scope/State | Gate Sequence + live ledger + persist tasks[] | No |
| 2026-06-03 | Trigger | Invoking harness-engineering skipped grill | Instructions | GATE 1 Spec Gate + spec-gate hook | No |
| 2026-06-03 | Agents | Agents skipped required skills (e.g. design audit) | Instructions | Mandatory skill gate + proof line per agent | No |
| 2026-06-01 | Verification | init.sh was a no-op placeholder | Verification | Rewrote init.sh with real checks (now 6 layers) | No |

## Next Steps (ordered by priority)
1. User reviews the uncommitted work (harness-enforcement + code-quality-language + behavior-verification), then commit
2. code-quality-rewrite — fix the cross-file count inconsistency (depends_on: harness-rewrite)
3. project-cleanup — .mcp.json, final count alignment (depends_on: harness-enforcement)
4. Resolve the harness vs code-quality review overlap (now three review skills: harness-engineering-review, code-quality-review, code-correctness-review — clarify "which when")
