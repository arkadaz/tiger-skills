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
| grill | `spec.md` + `feature.md` + the board entry, on `feature/<id>` (grill writes no e2e — the lead does) |
| lead PLAN | board PLAN fields + `tiger/CODEBASE_MAP.md` + `e2e_testcases.robot` — `chore(board): <id> plan` |
| lead E2E-PROVISION | nothing — environment only, it commits no file |
| code generator | code + tests ONLY — one semantic commit on its own branch `feature/<id>-r<round>w<wave>-<task>`; never the board, `progress.md`, or notes |
| lead INTEGRATE | the wave's cherry-picks + integration/SIMPLIFY fixes + `tasks[].status` + `progress.md` — `chore(board): <id> r<N> wave <W> — integrate` |
| lead VERIFY | the final wave's cherry-picks + `refs/notes/e2e` grade + board phase/AC + suite/keyword edits + `verify_notes.md` — `chore(board): <id> phase -> …` |
| update-docs | docs + README + board close-out (one commit), then rebase + **ff-merge to `dev`** |

## Rules
- Conventional commits: `type(scope): summary` (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`).
- One semantic change per commit. Worktree coders commit only their own code + tests, on their own per-task branch — never the board, `progress.md`, or notes (the architect records those when it merges the wave).
- Patch the board with `tiger/board.py`, never by hand-rewriting the JSON.
- Always leave the board committed (so "resume from `git log` + `git notes` + board phase" works).
- update-docs rebases `feature/<id>` onto `dev` then `git merge --ff-only`; on a conflict it aborts, reopens the board to `blocked`, and stops — it never auto-resolves.
- The grades are git notes: `refs/notes/e2e` (in-loop), `refs/notes/security` / `refs/notes/review` (standalone gates only).
