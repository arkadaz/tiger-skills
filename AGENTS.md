# AGENTS.md

Quick orientation for agents. The binding manual is `CLAUDE.md`; this is a short map.

## Project Overview

tiger-skills — a Claude Code plugin: grill-first harness engineering (outer loop) + code quality (inner loop). **19 skills, 5 agents.** Two workflows: the **dev pipeline** (**grill → lead → update-docs → ff-merge to dev**) and a git-free **research loop** (**/research-goal → /research-workflow**). where `tiger-lead` owns the whole build loop in one context — it plans, spawns the coders in parallel isolated worktrees, runs the Robot e2e suite for real, triages by priority, and re-plans in-context — then spawns update-docs to finalize on a clean pass. `tiger-security` / `tiger-reviewer` are standalone-only.

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
7. **One writer per field-group**; each writer commits what it owns (see CLAUDE.md). The lead may APPEND `source:e2e` cases but never edits grill's agreed cases.

## Pipeline & Agents (3)

The old planner (`tiger-architect`) and verifier (`tiger-e2e`) were separate agents that lost all context at the handoff — every fix round paid a cold re-recon twice and the verifier re-derived coverage from scratch, so the loop ran long and UI cases got missed. They are **merged into `tiger-lead`** (one context): the planner IS the verifier, so it knows every acceptance check and UI path it planned — the loop is short and UI coverage complete. The lead also holds the Write tool the old e2e agent lacked (the root cause of stubbed UI keyword bodies).

| Agent | Model | Role |
|---|---|---|
| `tiger-lead` | opus | Merged plan+verify+orchestrator, one context: validates scope, writes the board PLAN (scope + tasks) + phase pointer + acceptance-criteria status, sole author of `tiger/CODEBASE_MAP.md`, **spawns the `tiger-code-generator` coders** (parallel isolated worktrees per wave), authors `e2e_keywords.resource` + runs the robot suite for real (Playwright for UI) + triages by priority + owns `refs/notes/e2e`, bounded in-context delta re-plan on HIGH/MEDIUM. Never writes product code, never edits grill's cases, never closes the board |
| `tiger-code-generator` | sonnet | TDD build per task; reuse + simplify + comment-free; one commit per task. **Spawned by the lead** |
| `tiger-update-docs` | opus | Refreshes markdown docs + README, closes the board, rebases + ff-merges to `dev`. **Spawned by the lead on PASS** |

`tiger-security` / `tiger-reviewer` remain standalone on-demand **skills** (secrets/vuln audit → `refs/notes/security`; code/test quality audit → `refs/notes/review`) with **no owned agent** — NOT in the loop, never spawned by the workflow.

## Artifacts (all markdown except the robot suite)

- `tiger/features/<id>/feature.md` — merged spec + decisions + business context; frontmatter is the gate.
- `tiger/features/<id>/e2e_testcases.robot` (grill cases) + `e2e_keywords.resource` (lead) + `evidence/`.
- `tiger/CODEBASE_MAP.md` — structural map (lead-owned; compact, optional mermaid).
- `tiger/business.md` — cumulative product catalog. `tiger/release_docs.md` — changelog.
- `feature_list.json` (schema v2 board) + `progress.md` (session log). Memory lives in git, not hidden agent state.

## Directory Map

```
skills/                         19 skills, FLAT (skills/tiger-* + skills/research-goal):
├── tiger-grill/                inline interview → feature.md + broad robot e2e + approval (NOT a subagent)
├── tiger-{lead,code-generator,update-docs}/            in-loop stages
├── tiger-{security,reviewer}/                          standalone skills (no owned agent)
├── tiger-docs-{feature,business,e2e,codemap,release,readme}/  6 doc-writer references (no owned agents)
├── tiger-code-quality/         design principles + SIMPLIFY (loaded by lead/code-gen/reviewer)
├── tiger-{caveman,ponytail}/   say-less + write-less economy skills (loaded by lead/code-gen)
└── research-goal/ + tiger-{researcher,novelty-critic,experiment-log}/  research loop: /research-goal gate + iteration agent + novelty veto + experiment writer
agents/                         5 subagents (tiger-lead, tiger-code-generator, tiger-update-docs, tiger-researcher, tiger-novelty-critic; frontmatter: name/description/model/tools)
workflows/tiger-workflow-dev.js slim spine — bootstrap → tiger-lead → /tiger-workflow-dev when installed
workflows/research-workflow.js  git-free research spine — bootstrap → tiger-researcher loop → /research-workflow when installed
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
- **Single writer of the map + global docs** — only `tiger-update-docs` refreshes the global docs and closes the board; only `tiger-lead` authors `CODEBASE_MAP.md`.
- **Separate doer from checker** — the generator never writes its own e2e or judges its own work; the lead authors and runs it, grading code its coders wrote, not its own.
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
