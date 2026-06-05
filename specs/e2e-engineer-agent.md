# Spec: Dedicated E2E engineer agent — author + re-run the user-flow E2E every pass to confirm nothing broke

**Feature ID:** e2e-engineer-agent
**Status:** `approved`
**Grilled on:** 2026-06-06
**Approved by:** gta_35121@hotmail.com on 2026-06-06 (design chosen this session via structured choices: agent name = `e2e-engineer`, scope = full harness integration, model = **opus**, plus a dedicated `e2e-authoring` skill; and the explicit requirement that the workflow "write E2E every time to confirm nothing broke").

## Problem Statement

E2E authoring was the generator's side job and only happened up front, before the real entry points existed. There was no dedicated owner ensuring a real user-flow end-to-end test is (re)written and re-run on **every** pipeline pass and **after every fix** — so a fix could pass unit tests while silently breaking the user's actual workflow, and "nothing broke" was a hope, not a verified fact.

## User Stories

- As a user, I want a dedicated agent that, after the feature is built, authors an end-to-end test of my real workflow against the real entry point, so a clean-but-broken implementation is caught.
- As a user, I want that E2E re-authored and re-run after every fix (heal and review loops), so fixing one thing can't quietly break the user flow.
- As a user, I want this to be a first-class, reusable part of the harness — its own skill + agent, wired into the deterministic workflow — not a one-off prompt.

## Behavior

### Happy Path

1. GATE 7 (generate): the **generator** writes the feature + unit tests (TDD at the unit level) and hands off. It no longer authors the E2E itself.
2. GATE 7b (NEW): the conductor spawns the **`e2e-engineer`** (opus). It invokes **`e2e-authoring`**, reads the spec's acceptance criteria, drives the **real** entry point (URL/CLI/API), scaffolds Playwright (or the stack's E2E harness) if the project has none, and authors one asserting flow per acceptance criterion covering happy + error + edge. It modifies no feature logic. Proof line: `e2e-authoring invoked: YES — stack: <X>, flows covered: N, ACs asserted: X/Y`.
3. GATE 8 (execute): the **executor** runs the full unit suite (no fail-fast) + the e2e-engineer's user-flow E2E as Layer 3.
4. On any failure → GATE 9 heal: the healer prescribes a fix + failing-first regression test, the generator applies it, **the e2e-engineer is re-spawned to extend the E2E for the changed behavior**, then the executor re-runs the full unit + E2E suite.
5. GATE 11 review cluster, then any review-fix loop: after the generator applies review fixes, **the e2e-engineer re-authors the affected E2E**, then the executor re-runs the full suite before the re-review.
6. GATE 12 track: the feature passes only when every task passes and every criterion is done.

### Error Cases

| Trigger | Response |
|---------|----------|
| User-facing feature reaches GATE 8 with no E2E flow of the workflow | Executor rejects; correctness-reviewer marks BLOCKING (unchanged rules) |
| e2e-engineer omits its proof line | Conductor rejects the handoff and re-spawns it |
| A flow can't be written because the feature exposes no hook | e2e-engineer files a finding (does NOT patch feature logic); executor/healer handle it |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Trivial change (typo/doc/config) | GATE 7b skipped (trivial); no E2E required |
| Internal refactor (behavior-preserving) | Existing E2E suite is the regression guard; e2e-engineer re-runs nothing new but confirms the suite still drives the flow |
| Project has no E2E harness | e2e-engineer scaffolds the minimal stack harness (Playwright config + tests/e2e/) once, on the first user-facing feature |
| This plugin itself (no runnable app) | `./init.sh` is the E2E analog; the mandate is a pipeline policy applied to whatever target codebase the harness runs on |

## Relationship to `behavior-verification`

This **supersedes** `behavior-verification`'s clause that the **generator** authors the E2E. The generator now writes the feature + unit tests; the **`e2e-engineer`** authors the user-flow E2E at GATE 7b. The executor's reject-if-no-E2E rule and the correctness-reviewer's BLOCKING-if-missing-E2E rule **remain unchanged** — only the *author* of the E2E moves to the dedicated agent, and the E2E is now refreshed on every fix loop.

## Constraints

- **Must not break:** the gate sequence numbering (GATE 7b is a sub-gate; gates 8–13 keep their numbers), WIP=1, the Board Update / single-writer (scribe) model, proof-of-invocation, or `./init.sh` passing.
- **Environment:** Claude Code plugin; agents auto-discovered from `agents/`, skills listed in `plugin.json` autoDiscovery; AGENTS.md ≤150 lines.
- **Patterns to follow:** existing agent frontmatter (name/description/model/tools); existing skill frontmatter (name/description); the "mandatory skill + proof line" pattern (the e2e-engineer ↔ e2e-authoring pairing mirrors generator ↔ code-quality-language and the reviewers ↔ their skills); the deterministic `tiger-pipeline.js` style.

## Key Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Who authors E2E | **Dedicated `e2e-engineer` agent**, not the generator | Separation of concerns; author ≠ judge; user choice ("must be a new agent") |
| Model | **opus** | Mapping a spec's user flow into real-entry-point assertions is full-system reasoning (user choice) |
| Skill | **New `e2e-authoring` skill** (agent invokes it) | First-class, reusable; matches the per-agent mandatory-skill pattern (user choice: "skills and agent") |
| Scope | **Full harness integration** | Keep the 11-agent harness truthful and init.sh-clean (user choice) |
| E2E cadence | **Author every run + re-author/re-run after every fix** | "Write E2E every time to confirm nothing broke" (user requirement) |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `agents/e2e-engineer.md` exists (model=opus), invokes `e2e-authoring`, begins with `e2e-authoring invoked: YES — stack: <X>, flows covered: N, ACs asserted: X/Y`, and has the required sections | agent file has valid frontmatter + proof line + sections |
| 2 | `skills/e2e-authoring/SKILL.md` exists (name=e2e-authoring) defining the protocol, the real-entry-point Iron Rule, the Playwright scaffold, the AC↔flow map, and the proof line | skill file has valid frontmatter |
| 3 | Conductor SKILL.md adds **GATE 7b** spawning `e2e-engineer` between GENERATE and EXECUTE, plus a proof-of-invocation row and an agents-at-a-glance row (11 agents) | grep the SKILL.md |
| 4 | `workflows/tiger-pipeline.js` calls `tiger-skills:e2e-engineer` at GATE 7b and re-runs it in the heal loop and the review-fix loop before each re-execute; `node --check` passes | grep + node --check |
| 5 | `agents/generator.md` updated: writes feature + unit tests, hands E2E authoring to the e2e-engineer | grep the generator file |
| 6 | `hooks/pre-agent-spawn.md` lists all 11 agents incl. `e2e-engineer`; `plugin.json` v4.8.0 with 16 skills (adds `skills/e2e-authoring/`); marketplace/README/AGENTS/workflows-README updated to 16 skills / 11 agents | grep the files |
| 7 | `./init.sh` passes; Layer 3 reports 11 agents, Layer 2 reports 16 skills; `feature_list.json` has `e2e-engineer-agent` in_progress, `behavior-verification` flipped to passing with reciprocal links, WIP=1 preserved | `./init.sh` reports 0 failures |

## Out of Scope (Explicitly)

- A separate `e2e-fix` skill — the generator/healer fix issues; the e2e-engineer authors tests only.
- Bundling a specific Playwright version or browser binaries — the scaffold is generated for the target project's stack.
- Fixing the API-signature assumptions still flagged `[ASSUMED]` in `tiger-pipeline.js` (tracked separately).

## Open Questions

- None. Names finalized this session (`e2e-engineer`, `e2e-authoring`).
