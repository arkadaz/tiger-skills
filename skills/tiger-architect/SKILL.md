---
name: tiger-architect
description: Turn ONE human-approved Tiger feature into a phased build blueprint with RED-proven acceptance checks, the PLAN fields of the feature board (scope_map + tasks[]), and a bootstrapped tiger/CODEBASE_MAP.md — then land the single board-plan commit on feature/<id>. Use whenever the user wants to architect, plan, blueprint, or break down an approved feature, enrich the feature board, create a task breakdown, bootstrap the codebase map, or prepare a feature branch for the build loop — even if they never say "architect". Requires an approved feature.md (run tiger-grill first when missing). Read-only on source code; plans the work, never does it.
context: fork
agent: tiger-skills:tiger-architect
---

# Tiger Architect — recon, blueprint, board enrichment

Plans one approved feature into everything the build loop needs: blueprint verified against the real codebase, PLAN fields added to grill's board entry, and a codebase map for navigation.

Pipeline: grill → **architect** → (parallel code generators in git worktrees → integrate){per wave} → e2e → update-docs → merge to `dev`. (`dev → main` is a manual human step the kit never performs.)

Full procedure: `agents/tiger-architect.md`. This skill is the contract + how to run it.

## When to use

- After `tiger-grill` approves a feature and before any build loop runs.
- Standalone: audit/produce the plan without launching the full workflow.
- In-workflow: spawned automatically after grill approval.

## Contract

**Ownership — writes only:**
- `feature_list.json` PLAN fields: `scope_map.modify`, `scope_map.read_only`, `tasks[]`, and `acceptance_criteria[].verification` (RED-proven commands). Never rewrites grill's WHY/SPECIFY fields.
- `tiger/CODEBASE_MAP.md` (sole author/maintainer): bootstrap when missing, refresh on re-plan.
- ONE commit on `feature/<id>`: `chore(board): <id> plan — scope + tasks (phase: plan)`.

**Board access — through `tiger/board.py` only:** ALWAYS read first (`python3 tiger/board.py summary` / `get <id>`), then write your PLAN fields with patch commands (`add-task` per task; `set-*` for scope/phase) — each preserves every other field and fails closed. Never dump or hand-rewrite `feature_list.json`.

**Hard gates — refuse if any fails:**
1. Approval token: `grep -Eq '^tiger-status:[[:space:]]*approved[[:space:]]*$' tiger/features/<id>/feature.md` — non-zero exit → stop.
2. WIP = 1: only one `in_progress` feature; `current_feature` must match. Run `scripts/validate-board.py` when present.
3. Branch (idempotent, before any commit): `git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>` — cut from `dev`, never commit onto `dev` or `main`.

**Per-task `context` brief (REQUIRED on every task — the parallel generators' only map):**
```
"context": "WHERE: <module/dir per CODEBASE_MAP>. REUSE: <existing pattern/type/fn at file:line>. CONNECTS: <how it joins siblings>. BEHAVIOR: <the one behavior it must satisfy>."
```
A task without a `context` brief → block your own output until every task has one.

**`files[]` + `depends_on` drive parallelism.** List EXACT files each task writes (over-broad serializes; gaps cause cherry-pick collisions). File-disjoint tasks in the same wave build concurrently in isolated worktrees. No spurious `depends_on`.

**Acceptance checks — mandatory, non-degenerate, RED-first:**
- Match project runtime (Rust: `cargo test`, Node/TS: `npm test` / `npx vitest`, Go: `go test ./...`, CLI: binary + assert stdout/exit, service: local server + curl). Never default to Python unless the repo is Python.
- Guard runners that exit 0 on zero matched tests: pipe through `grep -q '1 passed'` or equivalent.
- Non-degenerate inputs: sum invariants need ≥2 fractional parts; half-open intervals need exact boundaries; first/last-wins needs duplicates; filters need an excluded item.
- Untrusted input → abuse check MANDATORY: path traversal, injection, oversized input.
- Run every check yourself NOW; confirm it fails RED. A check already green gates nothing.
- Align check ids with `e2e_testcases.robot` case ids where they overlap.

**Structured return (workflow schema-enforced):**
- `blueprintText`: Phase 2 prose blueprint (Scope Map → 7 design sections → Metric Plan → Risks).
- `tasks[]`: `{ id, title, files[], depends_on[], context, verification }` — mirrors the board.
- `acceptanceChecks[]`: `{ id, criterion, command, expectedExit, expectedStdout }`, every command proven RED.
- `metric`: `{ name, baseline, target, direction }` mirroring `scope_map.metric`.

**Board schema v2 — fields you fill:**

| Field | Rule |
|---|---|
| `scope_map.modify` / `read_only` | exact paths |
| `tasks[].files[]` | exact files the task writes |
| `tasks[].depends_on` | task ids, acyclic |
| `tasks[].context` | WHERE / REUSE file:line / CONNECTS / BEHAVIOR |
| `tasks[].verification` | runnable shell command |
| `acceptance_criteria[].verification` | runnable shell command, proven RED |
| `phase` | set to `plan` |

`status` ∈ `not_started|in_progress|passing|blocked`; `phase` ∈ `plan|build|validate|blocked|passing`.

**CODEBASE_MAP.md (markdown, no HTML/CDN):** Overview · System map (OPTIONAL fenced ```mermaid flowchart, GitHub-rendered, stable node ids — no CDN) · Modules table · How it works (per workflow) step-by-step · Business glossary / code values table · Recent changes. Bootstrap from `tiger/templates/CODEBASE_MAP.md`.

## Works with

grill (creates WHY/SPECIFY + commits artifacts) → **architect** (enriches PLAN + ONE commit) → code generators (parallel, isolated worktrees) → integrator → e2e (single quality gate) → update-docs (passing close-out).

## Git interactions

- **Reads:** `feature_list.json`, `tiger/features/<id>/feature.md` + sibling `e2e_testcases.robot`, `tiger/CODEBASE_MAP.md`, `docs/tiger-git-best-practice.md` when relevant.
- **Writes:** `feature_list.json` (PLAN fields only), `tiger/CODEBASE_MAP.md` (bootstrap/refresh), ONE commit on `feature/<id>`.
- **Never:** code commits, git notes (`refs/notes/*`), phase pointer past `plan`, `progress.md`, rewrites grill's artifacts.

## Standalone use

Invoke directly: provide the project directory (absolute path), feature id or `feature.md` path, and today's date (YYYY-MM-DD). The approval gate is enforced standalone too. Returns the blueprint and stops — launch `tiger-workflow-dev` (or `tiger-code-generator` standalone) to build.

Useful for: auditing the plan before a full run, planning while another feature finishes, or a human-driven build that needs only the board entry.
