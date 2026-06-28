# Tiger Git Best Practice

The branch model and commit discipline every stage follows.

## Branches
- `main` — protected release branch. **The workflow and build stages NEVER touch it.**
- `dev` — integration trunk. Everything integrates here.
- `feature/<id>` — one per feature, cut **from `dev`** by grill (`git checkout -b feature/<id> dev`).
- `dev → main` is a **manual human step** (cut a release); the kit never does it.

## Who commits what (one writer per field-group)
| Stage | Commits |
|---|---|
| grill | `feature.md` + `e2e_testcases.robot` + the board entry, on `feature/<id>` |
| architect | board PLAN fields + `tiger/CODEBASE_MAP.md` — `chore(board): <id> plan` |
| code generator | code + tests + `tasks[].status` + `progress.md` — one semantic commit per task |
| e2e | `refs/notes/e2e` grade + board phase/AC + the robot files — `chore(board): <id> phase -> …` |
| update-docs | docs + README + board close-out (one commit), then rebase + **ff-merge to `dev`** |

## Rules
- Conventional commits: `type(scope): summary` (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`).
- One semantic change per commit. Parallel worktree generators commit only their own files (never the board).
- Patch the board with `tiger/board.py`, never by hand-rewriting the JSON.
- Always leave the board committed (so "resume from `git log` + `git notes` + board phase" works).
- update-docs rebases `feature/<id>` onto `dev` then `git merge --ff-only`; on a conflict it aborts, reopens the board to `blocked`, and stops — it never auto-resolves.
- The grades are git notes: `refs/notes/e2e` (in-loop), `refs/notes/security` / `refs/notes/review` (standalone gates only).
