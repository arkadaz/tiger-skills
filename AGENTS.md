# AGENTS.md

Quick orientation for agents. The binding manual is `CLAUDE.md`; this is a short map.

## Project Overview

tiger-skills — a Claude Code plugin: grill-first harness engineering (outer loop) + code quality (inner loop). **10 skills, 5 agents.** Two workflows: the **dev pipeline** (**grill → lead → update-docs → ff-merge to dev**) and a git-free **research loop** (**/research-goal → /research-workflow**). Grill writes a detailed agent-facing `spec.md` + a human `feature.md` (the approval gate). `tiger-lead` owns planning, the e2e suite, AND verification: it plans from `spec.md`, authors the broad e2e suite itself, and DEFAULT builds + verifies the feature inline in one warm context; for a genuinely large feature the lead spawns coders ITSELF (parallel isolated worktrees + an integrator; nested subagents work in Claude Code v2.1.172+), then verifies for real and re-plans the delta bounded. `tiger-review` (quality + security) is standalone-only.

## Quick Start

- `./init.sh` — run baseline validation (`scripts/validate-plugin.sh`). No build step; this is a plugin, not an app.

## Branch Model

- `main` = protected release branch; **the workflow never touches it.**
- `dev` = integration trunk. `feature/<id>` is cut from `dev`; the workflow rebases + **fast-forward merges to `dev`**.
- **`dev` → `main` is a manual human step** the kit never performs.

## Working Rules

1. **Grill first.** No plan or code without an approved spec — `tiger/features/<id>/feature.md` carrying the frontmatter line `tiger-status: approved` (it gates the detailed `spec.md` sibling too).
2. **One question at a time** during grill (recommended answer offered); dig until every requirement is spec-grade concrete.
3. **Reuse before building** (YAGNI → repo util → stdlib → platform → dep → new code). Read `tiger/CODEBASE_MAP.md` for existing structure; never duplicate an existing function/type/constant.
4. **TDD + simplify + no comments.** Builders run RED → GREEN → SIMPLIFY → re-verify → commit, and write NO comments (names carry meaning).
5. **WIP=1.** One feature `in_progress` at a time.
6. **Evidence before claims.** Fresh verification from real execution before marking anything done.
7. **One writer per field-group**; each writer commits what it owns (see CLAUDE.md). The lead authors the whole e2e layer and never deletes/weakens a case to go green.

## Pipeline & Agents (3 dev + 2 research)

The old planner (`tiger-architect`) and verifier (`tiger-e2e`) lost context at their handoff; they are **merged into `tiger-lead`**, which now also AUTHORS the e2e suite from `spec.md` at plan time — before any code exists — so the planner IS the verifier IS the suite's author: coverage stays complete, the inline fast path stays honest (graded by pre-committed cases), and the loop is short.

| Agent | Model | Role |
|---|---|---|
| `tiger-lead` | opus | Merged plan+e2e+verify: validates scope, writes the board PLAN (scope + tasks) + phase pointer + acceptance-criteria status, sole in-loop author of `tiger/CODEBASE_MAP.md`, **authors `e2e_testcases.robot` + `e2e_keywords.resource`**; DEFAULT builds + verifies inline; for large features **spawns coders itself** (parallel worktrees + an integrator) and verifies — running the robot suite for real over the WHOLE `tiger/features/` folder (Playwright for UI), triaging by priority, owning `refs/notes/e2e`, bounded delta re-plan on HIGH/MEDIUM; on PASS finalizes — inline mode: closes out (docs + board `passing` + ff-merge) itself; waves mode: spawns update-docs |
| `tiger-code-generator` | sonnet | TDD build of one task; reuse + simplify + comment-free; one commit. **Spawned by the lead in waves mode only** (solo for a 1-task wave; isolated worktree + an integrator for a multi-task wave) |
| `tiger-update-docs` | opus | Refreshes markdown docs + README (per the `tiger-docs` sections), closes the board, rebases + ff-merges to `dev`. **Spawned by the lead on PASS in waves mode** (in inline mode the lead does this close-out itself) |

`tiger-review` is the standalone on-demand **skill** (quality audit → `refs/notes/review`; security audit → `refs/notes/security`) with **no owned agent** — NOT in the loop, never spawned by the workflow. Research agents: `tiger-researcher` (opus, one iteration per fresh context) + `tiger-novelty-critic` (opus, the semantic novelty veto).

## Artifacts (all markdown except the robot suite)

- `tiger/features/<id>/spec.md` — detailed agent-facing requirements (the behavior contract).
- `tiger/features/<id>/feature.md` — human summary; frontmatter is the gate.
- `tiger/features/<id>/e2e_testcases.robot` + `e2e_keywords.resource` (both lead-authored) + `tiger/evidence/`.
- `tiger/CODEBASE_MAP.md` — structural map (lead-owned in-loop; compact, optional mermaid).
- `tiger/business.md` — cumulative product catalog. `tiger/release_docs.md` — changelog.
- `feature_list.json` (schema v2 board) + `progress.md` (session log). Memory lives in git, not hidden agent state.

## Directory Map

```
skills/                         10 skills, FLAT (skills/tiger-* + skills/research-goal):
├── tiger-grill/                inline interview → spec.md + feature.md + approval (NOT a subagent)
├── tiger-{lead,code-generator,update-docs}/   in-loop stages
├── tiger-review/               standalone quality + security gate (no owned agent)
├── tiger-docs/                 ONE doc-writer reference (spec/feature/e2e/codemap/business/release/README)
├── tiger-code-quality/         design principles + SIMPLIFY + write-less + say-less (loaded by the loop agents)
└── research-goal/ + tiger-{researcher,novelty-critic}/  research loop: /research-goal gate + iteration agent + novelty veto
agents/                         5 subagents (tiger-lead, tiger-code-generator, tiger-update-docs, tiger-researcher, tiger-novelty-critic)
workflows/tiger-workflow-dev.js thin launcher — ONE spawn: lead CONDUCT (discovers+gates, inline default / waves: spawns coders itself; on PASS spawns update-docs); /tiger-workflow-dev when installed
workflows/research-workflow.js  git-free research spine — bootstrap → tiger-researcher loop → /research-workflow when installed
templates/                      spec.md, feature.md, CODEBASE_MAP.md, business.md, release_docs.md, e2e_testcases.robot, e2e_keywords.resource, feature_list.json, research/*
commands/install.md             copies workflows/guard/templates, migrates old→new, verifies harness
hooks/                          hooks.json + tiger-session-start.sh (real JSON+script wiring)
project-hooks/tiger-block-rm.sh rm guard copied into target projects
scripts/                        validate-plugin.sh, validate-board.py, board.py, research.py, validate-research.py
docs/                           design diagram, cheatsheet, git/test best-practice, ADRs
```

## Hard Constraints

- **Spec gate** — no build without an approved `feature.md` (`tiger-status: approved`); grill first.
- **Skills independent; agents = a bundle of skills** — a skill never depends on another; an agent composes the set it needs.
- **Single writer of the map + global docs** — only `tiger-update-docs` refreshes the global docs and closes the board; only `tiger-lead` authors `CODEBASE_MAP.md` in-loop.
- **Objective gates before self-grading** — in waves mode the generator never writes its own e2e or judges its own work; in inline mode the lead is held to the suite it pre-committed BEFORE building + RED-proven acceptance checks.
- **Verify behavior, not just structure** — every feature ships with e2e of its real workflow plus unit tests; every bug fix adds a failing-first regression test.
- **rm guard installed** before any build. No placeholders in committed code. Leave clean state.

## Verification Commands

- Plugin: `.claude-plugin/plugin.json` is valid JSON; all auto-discovered paths resolve.
- Skills: every `skills/*/SKILL.md` has valid frontmatter (`name`, `description`).
- Agents: every `agents/*.md` has valid frontmatter (`name`, `description`, `model`).

## Topic Docs

- [Learn Harness Engineering](https://walkinglabs.github.io/learn-tiger-grill/en/) — the source course.
- [CLAUDE.md](CLAUDE.md) — full operating manual.
- [feature_list.json](feature_list.json) — machine-readable feature state · [progress.md](progress.md) — session log.
