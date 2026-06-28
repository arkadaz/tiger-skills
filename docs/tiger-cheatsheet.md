# Tiger Cheatsheet

## Setup
- `/tiger-skills:install` — set up AND migrate a project: workflow, rm guard, `board.py`, markdown templates, born `main` + `dev`. Idempotent; converts old HTML artifacts to v6 markdown.

## Run a feature
1. `tiger-grill` — interview (one question at a time), write `tiger/features/<id>/feature.md` + a broad `e2e_testcases.robot`, create the board entry, cut `feature/<id>` from `dev`. On your explicit yes it flips `tiger-status: approved`.
2. `/tiger-workflow-dev` — no args; auto-discovers the approved in-progress feature and runs architect → generators → e2e → update-docs, then fast-forward merges to `dev`.
3. You cut the release: `dev → main` manually.

## Stages (skills; each forks to its agent)
| Skill | Does |
|---|---|
| `tiger-grill` | the only human gate — spec + e2e cases + board entry |
| `tiger-architect` | plan, board PLAN fields, `tiger/CODEBASE_MAP.md` |
| `tiger-code-generator` | TDD + simplify + no-comments build of one task |
| `tiger-e2e` | single gate: run + add cases + triage by priority |
| `tiger-update-docs` | refresh markdown docs, close board, ff-merge to dev |
| `tiger-security` / `tiger-reviewer` | standalone, on-demand gates (not in the loop) |

## Board (never hand-edit the JSON — use the helper)
```
python3 tiger/board.py summary | current | in-progress | get <id> [field]
python3 tiger/board.py set-phase|set-status|set-task|set-ac|add-learning|approve|add-task|add-feature …
```

## Resume after an interruption
`git log` + `git notes --ref=e2e` + `python3 tiger/board.py summary` — state lives in git + the board, not hidden agent memory.
