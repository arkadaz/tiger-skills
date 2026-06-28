# AGENTS.md

Quick orientation for agents. The binding manual is `CLAUDE.md`; this is a short map.

## Project Overview

tiger-skills — a Claude Code plugin: grill-first harness engineering (outer loop) + code quality (inner loop). **14 skills, 6 agents.** Pipeline: **grill → architect → code generators (parallel) → e2e → update-docs**, with the e2e gate as the single in-loop quality gate. `tiger-security` / `tiger-reviewer` are standalone-only.

## Quick Start

- `./init.sh` — run baseline validation (`scripts/validate-plugin.sh`). No build step; this is a plugin, not an app.

## Branch Model

- `main` = protected release branch; **the workflow never touches it.**
- `dev` = integration trunk. `feature/<id>` is cut from `dev`; the workflow rebases + **fast-forward merges to `dev`**.
- **`dev` → `main` is a manual human step** the kit never performs.

## Working Rules

1. **Grill first.** No plan or code without an approved spec — `tiger/features/<id>/feature.md` carrying the frontmatter line `tiger-status: approved`.
2. **One question at a time** during grill (recommended answer offered); dig deep.
3. **Reuse before building** (YAGNI → repo util → stdlib → platform → dep → new code). Read `tiger/CODEBASE_MAP.md` for existing structure; never duplicate an existing function/type/constant.
4. **TDD + simplify + no comments.** Generators run RED → GREEN → SIMPLIFY → re-verify → commit, and write NO comments (names carry meaning).
5. **WIP=1.** One feature `in_progress` at a time.
6. **Evidence before claims.** Fresh verification from real execution before marking anything done.
7. **One writer per field-group**; each writer commits what it owns (see CLAUDE.md). The e2e gate may APPEND `source:e2e` cases but never edits grill's agreed cases.

## Pipeline & Agents (6)

| Agent | Model | Role |
|---|---|---|
| `tiger-architect` | opus | Validates scope, writes the board PLAN (scope + tasks), sole author of `tiger/CODEBASE_MAP.md` |
| `tiger-code-generator` | sonnet | TDD build per task; reuse + simplify + comment-free; one commit per task |
| `tiger-e2e` | opus | Single gate: authors `e2e_keywords.resource`, runs the robot suite + acceptance checks, **appends new cases**, triages by priority, owns `refs/notes/e2e` + board phase |
| `tiger-update-docs` | opus | Refreshes markdown docs + README, closes the board, rebases + ff-merges to `dev` |
| `tiger-security` | opus | Standalone secrets/vuln audit → `refs/notes/security` |
| `tiger-reviewer` | opus | Standalone code/test quality audit → `refs/notes/review` |

Standalone gates are NOT spawned by the workflow.

## Artifacts (all markdown except the robot suite)

- `tiger/features/<id>/feature.md` — merged spec + decisions + business context; frontmatter is the gate.
- `tiger/features/<id>/e2e_testcases.robot` (grill cases) + `e2e_keywords.resource` (e2e gate) + `evidence/`.
- `tiger/CODEBASE_MAP.md` — structural map (architect-owned; compact, optional mermaid).
- `tiger/business.md` — cumulative product catalog. `tiger/release_docs.md` — changelog.
- `feature_list.json` (schema v2 board) + `progress.md` (session log). Memory lives in git, not hidden agent state.

## Directory Map

```
skills/                         14 skills, FLAT (skills/tiger-*):
├── tiger-grill/                inline interview → feature.md + broad robot e2e + approval (NOT a subagent)
├── tiger-{architect,code-generator,e2e,update-docs}/   in-loop stages
├── tiger-{security,reviewer}/                          standalone gates
├── tiger-docs-{feature,business,e2e,codemap,release,readme}/  6 doc-writer references (no owned agents)
└── tiger-code-quality/         design principles + SIMPLIFY (loaded by architect/code-gen/reviewer)
agents/                         6 subagents (frontmatter: name/description/model/tools)
workflows/tiger-workflow-dev.js the deterministic spine → /tiger-workflow-dev when installed
templates/                      feature.md, CODEBASE_MAP.md, business.md, release_docs.md, e2e_testcases.robot, e2e_keywords.resource, feature_list.json
commands/install.md             copies workflow/guard/templates, migrates old→new, verifies harness
hooks/                          hooks.json + tiger-session-start.sh (real JSON+script wiring)
project-hooks/tiger-block-rm.sh rm guard copied into target projects
scripts/                        validate-plugin.sh, validate-board.py
docs/                           design diagram, cheatsheet, git/test best-practice, ADRs
```

## Hard Constraints

- **Spec gate** — no build without an approved `feature.md` (`tiger-status: approved`); grill first.
- **Skills independent; agents = a bundle of skills** — a skill never depends on another; an agent composes the set it needs.
- **Single writer of the map + global docs** — only `tiger-update-docs` refreshes the global docs and closes the board; only `tiger-architect` authors `CODEBASE_MAP.md`.
- **Separate doer from checker** — the generator never writes its own e2e or judges its own work; the e2e gate authors and runs it.
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
