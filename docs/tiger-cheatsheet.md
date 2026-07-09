# Tiger Cheatsheet

## Setup
- `/tiger-skills:install` — set up AND migrate a project: workflows, rm guard, `board.py` + `research.py`, markdown templates, born `main` + `dev`. Idempotent; refreshes plugin-owned copies (old kept as `*.bak`).

## Run a feature
1. `tiger-grill` — interview (one question at a time, deep), write `tiger/features/<id>/spec.md` (detailed, agent-facing) + `feature.md` (human summary), create the board entry, cut `feature/<id>` from `dev`. On your explicit yes it flips `tiger-status: approved`.
2. `/tiger-workflow-dev` — no args; the lead itself discovers the newest approved feature (no bootstrap spawn), plans from spec.md, authors the e2e suite, DEFAULT builds + verifies inline (waves of parallel coders for large features), then update-docs fast-forward merges to `dev`.
3. You cut the release: `dev → main` manually.

## Stages (skills)
| Skill | Does |
|---|---|
| `tiger-grill` | the only human gate — spec.md + feature.md + board entry |
| `tiger-lead` | plan + author e2e + build (inline default) + verify + bounded re-plan, one context |
| `tiger-code-generator` | TDD + simplify + no-comments build of one task (waves mode) |
| `tiger-update-docs` | refresh markdown docs, close board, ff-merge to dev |
| `tiger-review` | standalone, on-demand quality + security gate (not in the loop) |
| `tiger-docs` / `tiger-code-quality` | loadable references: artifact writing rules / design + write-less + say-less |

## Board (never hand-edit the JSON — use the helper)
```
python3 tiger/board.py summary | current | in-progress | get <id> [field]
python3 tiger/board.py set-phase|set-status|set-task|set-ac|add-learning|approve|add-task|add-feature …
```

## Resume after an interruption
`git log` + `git notes --ref=e2e` + `python3 tiger/board.py summary` — state lives in git + the board, not hidden agent memory.

## Research loop (git-free)
`/research-goal` (grill + approve a goal) → `/research-workflow` (autonomous novelty-gated experiments) → `research/<goalId>/REPORT.md`.
