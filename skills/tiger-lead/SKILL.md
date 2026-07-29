---
name: tiger-lead
description: The ARCHITECT of the Tiger pipeline — plans an approved feature, owns its whole e2e layer, MERGES every coder's worktree, and grades the result. Driven by the /tiger-workflow-dev conductor in four modes. PLAN — discover + gate the feature itself, recon the codebase ONCE and distil it into per-task work packets whose REUSE section inlines the exact existing code to call, RED-proven acceptance checks, tiger/CODEBASE_MAP.md, and the WHOLE e2e layer — cases AND keyword bodies, plus an ABUSE corpus per trust boundary — authored before any code exists (boundary/typical/adversarial/error, ≥1 per AC and business rule, one priority tag each), then return dependency WAVES of file-disjoint task ids, as wide as contract-first decomposition allows. E2E-PROVISION — in parallel with PLAN, make the Robot/Playwright runtime ready (environment only, no repo writes), so no build wave ever waits on an install. INTEGRATE — after each non-final wave, cherry-pick that wave onto feature/<id>, re-run the project verification, audit the diff for reuse/comments/scope/dead code, repair the packet of any failed task and re-queue it, record tasks[].status. VERIFY — merge the final wave, warm-start from the verify journal, run the WHOLE tiger/features/ folder as a regression plus every acceptance check for real (a real browser for any UI), audit quality, triage by priority (HIGH/MEDIUM block; a regression in a shipped feature is HIGH; LOW logged), and on CHANGES write delta tasks with repaired packets and return them as deltaWaves. Use whenever the user wants to build, implement, or ship an already-approved feature, plan-and-build it, run the full loop, or resume a feature after grill — even if they never say "lead". Requires an approved feature.md (run tiger-grill first when missing).
context: fork
agent: tiger-skills:tiger-lead
---

# Tiger Lead — the architect: plan → merge → gate

Owns the plan, the e2e layer, every merge, and the gate of one approved feature. The **coders build**: independent `tiger-code-generator` spawns, one task each, in isolated git worktrees, from the packets the lead wrote. The lead writes no product code — it cherry-picks the coders' branches, audits what landed, and grades it by real execution.

Pipeline: grill (spec.md + feature.md + approval) → **lead PLAN** (packets + acceptance checks + e2e suite + waves) → **coders build each wave in parallel worktrees** (the lead's **E2E-PROVISION** ran alongside PLAN) → **lead INTEGRATE** per non-final wave → **lead VERIFY** (merges the last wave + the full gate) → bounded re-plan loop → **update-docs** → ff-merge to `dev`. (`dev → main` is a manual human step.)

Full procedure: `agents/tiger-lead.md`. This skill is the contract + how to run it.

## When to use

- After `tiger-grill` approves a feature — to build and ship it (the full loop).
- Spawned by `/tiger-workflow-dev` as its FIRST spawn — the lead discovers + gates the feature itself (newest-approved, WIP reconciliation, dev trunk); or invoke directly to run the loop yourself.
- Standalone: plan-and-build one approved feature without the workflow.

## Contract

**Hard gates — refuse if any fails:**
1. Approval token: `grep -Eq '^tiger-status:[[:space:]]*approved[[:space:]]*$' tiger/features/<id>/feature.md` — non-zero exit → stop ("run tiger-grill").
2. WIP = 1: only one `in_progress` feature; `current_feature` must match. Run `scripts/validate-board.py` when present.
3. Branch (idempotent, before any commit): `git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>` — cut from `dev`, never commit onto `dev` or `main`.

**Source of truth:** `tiger/features/<id>/spec.md` — the detailed grilled requirements (FRs with worked examples, business rules with exact values, error tables, testable ACs). Plan, test, and grade against it; `feature.md` is the human summary + gate token (and the fallback contract on an old feature with no spec.md).

**Board access — through `tiger/board.py` only:** read first (`summary` / `get <id>` / `task <id> <task>`), then patch only your fields. Never dump or hand-rewrite `feature_list.json`.

### MODE PLAN — recon once, hand down complete packets
- Recon the codebase yourself (`file:line` for every entity the spec names; no scout spawns) and build a **REUSE INVENTORY**: every existing repo utility/type/service that already does part of this job, with its exact signature. You are the only agent that will explore — a coder cannot reuse what you did not hand it.
- Blueprint: Scope Map → Reuse Inventory → Component Design (to `tiger-code-quality`) → Build Sequence → Metric Plan → Risks.
- Board PLAN: `scope_map.modify/read_only`, `tasks[]` — each with exact `files[]`, `depends_on`, its own `verification`, and a **complete `context` packet** (WHERE / REUSE inlined / INTERFACES / CONNECTS / CONVENTIONS / TEST + RED command / BEHAVIOR). Self-test each: "could a coder that opens NOTHING but the files I named build this?"
- **Author BOTH e2e files NOW, before any code** — `e2e_testcases.robot` and `e2e_keywords.resource` (per the `tiger-docs` e2e section): a BROAD suite from spec.md — several boundary/typical/adversarial cases, every error path, ≥1 per AC and per business rule, real-browser cases for any UI, exactly one `priority:high|medium|low` tag each. Written before an implementation exists to bend it, it is what makes the gate objective. Extend it in later rounds; never delete/weaken a case to go green.
- Acceptance checks: non-degenerate, match the project runtime, abuse check on untrusted input, proven RED now. Commit `chore(board): <id> plan — scope + tasks + e2e suite (phase: plan)`.
- **Return the WAVES:** dependency-ordered arrays of task ids whose `files[]` are DISJOINT within a wave. **Width is wall-clock** — prefer contract-first decomposition (pin the interface, inline it into both packets) over serial chains. Also return `uiFeature`, `tasksTotal`, `verifyCmd`.

### MODE E2E-PROVISION — the runtime, ready beside the plan
Runs concurrently with PLAN. Provision `robotframework` (+ `robotframework-browser && rfbrowser init` unless `TIGER_NO_BROWSER=1`) and report the runtime facts the gate would otherwise re-derive. **Environment only — it writes nothing in the repo**, because PLAN is committing in that checkout. The keyword layer belongs to PLAN.

### MODE INTEGRATE — you are the only writer of `feature/<id>`
Per non-final wave: cherry-pick each GREEN coder branch (a real conflict means the `files[]` were not disjoint — abort, re-scope, mark the task failed; never hand-merge) → re-run the project verification on the integrated tip → **quality audit the wave diff** (reuse violations first — name the existing symbol; then comments in generated code, scope leaks, dead code, weakened tests) → **repair the packet** of every failed/PACKET-GAP task and return it for one immediate retry → record `tasks[].status` with fresh evidence + one `chore(board)` commit.

### MODE VERIFY — merge the last wave, then prove the feature
- Merge the final wave, then warm-start from `tiger/features/<id>/verify_notes.md` (skip re-discovery, never re-execution).
- **UI is not optional:** any page/component/app MUST be driven in a real browser (Playwright); a UI deliverable never really driven is an automatic CHANGES.
- Run **EVERY feature's suite — a regression over the whole folder**: `robot --outputdir tiger/evidence tiger/features/`, plus every acceptance check for real (fresh evidence, Iron Law). One bounded coverage-expansion pass per round. Audit the whole feature diff for quality.
- Triage by priority (HIGH/MEDIUM block, LOW logged). **A case of an already-passing OTHER feature that regresses is HIGH — fix until green regardless of its tag.** Keep the folder coherent, but a shipped feature's APPROVED behavior is never silently changed: that is a spec conflict → `blocked`. Set the board `phase`; attach `refs/notes/e2e`; rewrite the verify journal.
- On CHANGES: write delta tasks (`-r<round>` ids) with **complete repaired packets** and RETURN them as `deltaWaves`. The conductor stops (blocked) after 3 rounds, a round that completed no task and cleared no blocker, or a CHANGES with no delta.

### Finalize
On PASS: return grade `PASS` — the **conductor spawns `tiger-update-docs`** (close board + ff-merge to `dev`). On BLOCKED: record `phase: blocked` + the fix list; stop for the human.

**Return contract.** PLAN → `{ waves, uiFeature, tasksTotal, verifyCmd, setupCmd, assumptions }`; E2E-PROVISION → `{ ready, browser, note }`; INTEGRATE → `{ integrated, failed, retry, qualityFindings, verificationGreen }`; VERIFY → `{ grade, high, medium, low, tasksDone, tasksTotal, deltaWaves }`. Also END with the machine token lines (for the human log + standalone runs):

```
TIGER_LEAD: <PASS|CHANGES|BLOCKED>
E2E_BLOCKERS: high=<n> medium=<n> low=<n>
FEATURE_COMPLETE: <YES|NO>
TASKS_DONE: <doneCount>/<totalCount>
FINALIZE_STATUS: <MERGED_TO_DEV|NO_REMOTE_MERGED|REBASE_CONFLICT|n/a>
```

`grade`/`TIGER_LEAD: PASS` only when `high=0` and `medium=0` on fresh evidence with every task done. The conductor fails closed to CHANGES when the grade is absent or garbled.

## Works with

grill (spec.md + feature.md + WHY/SPECIFY board entry) → **lead PLAN** (packets + e2e suite + waves) → the workflow-conductor spawns **tiger-code-generator** coders per wave (isolated worktrees) → **lead INTEGRATE / VERIFY** (merge + gate + bounded re-plan) → the conductor spawns **tiger-update-docs** (passing close-out + ff-merge to `dev`). `tiger-review` stays standalone, human-invoked — never in the loop.

## Git interactions

- **Reads:** `feature_list.json`, `tiger/features/<id>/spec.md` + `feature.md`, the OTHER features' e2e suites (regression/dupe awareness), `tiger/CODEBASE_MAP.md`, `git log`, `git notes --ref=e2e`, the coders' branches.
- **Writes:** board PLAN + phase + `tasks[].status` + acceptance status, `tiger/CODEBASE_MAP.md`, the whole e2e layer (`e2e_testcases.robot` + `e2e_keywords.resource` + `verify_notes.md`, plus scoped cross-feature reconciliations), the folder-run report `tiger/evidence/*`, `refs/notes/e2e`, `progress.md`, and the merge/plan/verify commits on `feature/<id>` (cherry-picks, integration fixes, SIMPLIFY).
- **Never:** product code (the coders write it), edits to `spec.md`/`feature.md`, `status: passing`, null `current_feature`, notes in any other ref, commits onto `dev`/`main`, push/rebase/merge to `dev`.

## Standalone use

Invoke directly in the project: it discovers the single approved in-progress feature itself (or takes a `featureId`), resolves `today` + the `dev` trunk, and runs the whole loop (spawning coders itself if nesting is available). The approval gate is enforced standalone too. State lives in `git log` + `git notes --ref=e2e` + the board phase — resume any time.
