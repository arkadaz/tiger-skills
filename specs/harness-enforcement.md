# Spec: Make the workflow mechanical — gates, live ledger, kanban tasks, agent evidence

**Feature ID:** harness-enforcement
**Status:** `approved`
**Grilled on:** 2026-06-03
**Approved by:** gta_35121@hotmail.com on 2026-06-03 (two design forks chosen via structured choices)

## Problem Statement

The harness was documented but not enforced: it dropped steps mid-run, `feature_list.json` was too flat to hold a plan or link tickets, invoking `harness-engineering` did not trigger grill, and the agents skipped their required skills (e.g. design-principle review).

## User Stories

- As a user, I want invoking the harness on a new feature to grill me first, so I never get unplanned code.
- As a user, I want the plan persisted as linked kanban tickets, so nothing is lost between steps.
- As a user, I want each agent to prove it did its job (e.g. ran the design audit), so quality gates aren't skipped.

## Behavior

### Happy Path

1. User makes a build request → **Spec Gate** fires: no approved spec → `harness-engineering:grill` runs → spec written → human approves → feature added to `feature_list.json`.
2. Conductor creates a **live phase ledger** and ticks each gate.
3. Planner produces a blueprint → conductor **persists its `tasks[]`** into the feature.
4. For non-trivial features the **code-architect runs `code-quality:audit`** and emits a proof line; generator/executor/healer likewise emit proof lines.
5. Conductor flips `tasks[]` and `acceptance_criteria` to done with evidence → feature `passing` only when all are done → **Success**.

### Error Cases

| Trigger | Response |
|---------|----------|
| Build request, no approved spec | Grill is invoked; planning/coding blocked until approval |
| Agent handoff missing its proof line | Conductor rejects it and re-spawns the agent |
| Dangling / cyclic feature link | `./init.sh` Layer 6 fails |
| Task with invalid status or non-sibling dep | `./init.sh` Layer 6 fails |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Bug fix / question / one-line edit | Spec Gate skipped; no grill |
| Trivial change | Architect gate marked `skipped (reason)` on the ledger |
| Empty `tasks[]` (pre-planner) | Allowed; planner fills it, conductor persists |

## Constraints

- **Must not break:** existing sub-skills, the agent pipeline, `./init.sh` passing.
- **Environment:** Claude Code plugin; hooks are prompt-injection markdown files auto-discovered from `hooks/`.
- **Patterns to follow:** existing hook frontmatter style; conductor-as-single-writer of `feature_list.json`.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Kanban depth | Tasks+links / Full hierarchy / Links only | **Tasks + links** | Persists the blueprint and links tickets without a heavy epic/story/board layer |
| Enforcement | Gates+ledger+hooks / Gates+ledger / Wording only | **Gates + ledger + hooks** | Strictest; mechanical at conductor, agent, and hook level |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Build request + no spec triggers grill before planning | Conductor GATE 1 + `hooks/spec-gate.md` present |
| 2 | Features support `depends_on`/`blocks`/`tasks[]`/`acceptance_criteria`, validated | `./init.sh` Layer 6 passes |
| 3 | Conductor keeps a live ledger and persists the planner's tasks | Conductor GATE 2 + GATE 5 text |
| 4 | Each agent has a mandatory skill gate + proof line | Each agent file contains its proof line |
| 5 | `./init.sh` passes | 0 failures |

## Out of Scope (Explicitly)

- Full epic/story hierarchy and a separate board file.
- Runtime (command-based) hooks — this plugin uses prompt-injection hooks.
- Resolving the code-quality cross-file count inconsistency (tracked as `code-quality-rewrite`).

## Amendment — 2026-06-04 — Agent expansion (approved by gta_35121@hotmail.com)

The pipeline grew from 5 agents to 8 so the agents genuinely *operate* the new machinery rather than just feeding it:

- **explorer** (sonnet, read-only) — GATE 5a recon; builds the Type Inventory for the planner.
- **reviewer** (opus) — GATE 11 independent check; runs `code-quality:review`; promotes review from a skill to a true separate-context checker.
- **scribe** (sonnet) — the **single writer** of `feature_list.json` + `progress.md`; every other agent emits a `Board Update` it applies, enforcing the kanban invariants.

Decision: `integrator` (commit/PR/release) was offered and **declined** — the conductor keeps GATE 12–13.

Added acceptance criteria AC6–AC8 and tasks T10–T15 cover this amendment.

## Open Questions

- None.
