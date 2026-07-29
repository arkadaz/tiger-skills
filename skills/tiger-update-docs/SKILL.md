---
name: tiger-update-docs
description: Final stage — the ONE agent that refreshes every project-global doc by LOADING the tiger-docs writer skill (codemap section → tiger/CODEBASE_MAP.md, business → the cumulative tiger/business.md catalog keyed by feature id, release → tiger/release_docs.md, README → README.md), then closes the board with the atomic `board.py close <id>` (status/phase: passing, current_feature: null in one write — the ONLY stage allowed to), commits docs + README + board in ONE commit, rebases feature/<id> onto dev and FAST-FORWARD MERGES it to dev (never touches main). Use on "update the docs", "refresh the codemap", "write the changelog/release notes", "update the README", "close out the feature", "land on dev", or when the loop finishes green and the feature needs finalizing — even standalone.
context: fork
agent: tiger-skills:tiger-update-docs
---

# Tiger Update Docs — Close-Out & Finalize

Last stage. Make the AI's work human-readable (refresh global markdown docs + README), declare the feature done (the only stage that may close the board), and land the branch on the `dev` integration trunk. The kit NEVER touches `main` — `dev → main` is a manual human step.

## When to use
- "update the docs", "refresh the codemap", "changelog/release notes", "update the README", "close out the feature", "land on dev" — or the workflow's PASS handoff after the lead's verify.
- In-workflow: full close-out + rebase + ff-merge to dev. Standalone: docs refresh only, no board close-out, no merge.

## Contract

Full procedure: agents/tiger-update-docs.md — this skill is the contract + how to run it.

**One agent that LOADS the `tiger-docs` writer skill** (no sub-agents): its codemap / business / release / README sections. Loaded there it does NOT commit — you make the one close-out commit.

**Gate before touching the board** (read `feature_list.json` FIRST). Close ONLY when all true from fresh e2e evidence:
- `phase: validate` (e2e full-pass: zero HIGH, zero MEDIUM),
- every `acceptance_criteria[]` `status: done` with evidence,
- every `tasks[]` complete.

Anything less → refresh docs you safely can, report what's missing, STOP. Do not close, do not merge.

**Ownership — you write, then commit, exactly these (all markdown):**

| Artifact | Rule |
|---|---|
| `tiger/CODEBASE_MAP.md` | Refresh from real diff (`git diff dev...HEAD`); STABLE node ids; append Recent-changes row. Fenced mermaid, no CDN. |
| `tiger/business.md` | CUMULATIVE per-feature catalog keyed by id (`001 — …`, `002 — …`) incl. each feature's code glossary. Append THIS feature's entry; NEVER drop/restate a prior entry — only extend. |
| `tiger/release_docs.md` | Append entry under `[Unreleased]`; User-facing then Internal bands; categories Added/Changed/Deprecated/Removed/Fixed/Security (omit empty). LOW e2e defects → **Known issues** line (read from `git notes --ref=e2e`). |
| `README.md` | Surgical + additive; touched sections only; preserve human voice. |
| `feature_list.json` | Close-out (below). |
| `progress.md` | Append close-out note. |

**Board I/O via `tiger/board.py` only** — read current state first (`python3 tiger/board.py current` / `get <id>`), then close out with the ATOMIC `python3 tiger/board.py close <id>` (status + phase `passing` + `current_feature: null` in ONE validated write — a `set-status` + `set-current` pair is REFUSED in both orders, because WIP=1 and current_feature consistency are checked together), plus `add-learning <id> <bucket> "…"`; each patch preserves every other field and fails closed. Never dump or hand-rewrite the whole `feature_list.json`.

**Board close-out (your EXCLUSIVE window):** set `status: passing`, `phase: passing`, `current_feature: null` (all three agree). Fill `validation.*` + `learning.{technical,product,process,harness_updates}` from real signal (e2e note, fix-up rounds). RECORD harness lessons — never edit `CLAUDE.md` yourself. Preserve WIP=1 + reciprocal acyclic links; run `scripts/validate-board.py` if present, stop on failure.

**Never:** rewrite grill/lead/code-gen fields; edit code/tests; add/move git notes; touch `main`; open an MR. The board chain is lead (init + loop phase) → you (passing); only you set `current_feature: null`.

**One commit:** `docs(tiger): <id> close-out — codemap/business/release/README refresh (phase: passing)` adding the six files above. Code already landed as the generator's commits — don't re-commit code.

**Rebase onto `dev`, never auto-resolve:** rebase `feature/<id>` onto `dev` (fetch first when a remote exists). On conflict `git rebase --abort` (NEVER `--continue`), reopen board to `phase: blocked`/`status: in_progress`/`current_feature: <id>`, note the reason, commit `chore(board): <id> phase -> blocked (rebase conflict)`, STOP. Human resolves.

**Fast-forward merge to `dev`, NEVER touch main:** clean rebase → `git checkout dev && git merge --ff-only feature/<id>`; push `dev` if `origin` exists. The kit never merges to `main` and never opens an MR — promoting `dev → main` is a manual human decision.

**Final token (workflow reads the LAST occurrence — emit cleanly, nothing after):**

```
FINALIZE_STATUS: MERGED_TO_DEV
FINALIZE_STATUS: NO_REMOTE_MERGED
FINALIZE_STATUS: REBASE_CONFLICT
```
`MERGED_TO_DEV` = clean rebase, ff-merged to `dev`, pushed. `NO_REMOTE_MERGED` = clean rebase, ff-merged to local `dev`, no remote. `REBASE_CONFLICT` = aborted, board reopened to blocked, stopped.

## Works with
lead (PASS handoff, `phase: validate`) → **update-docs** (refresh + close + ff-merge to `dev`) → human promotes `dev → main`. Last stage; no downstream agent.

## Git interactions
- **Reads:** `git log dev..HEAD`, `git diff dev...HEAD`, `git notes --ref=e2e`, touched files, `feature_list.json`, `progress.md`, feature `tiger/features/<id>/feature.md`, global `tiger/*.md`, `git fetch`/`rev-parse` for the rebase target.
- **Writes:** one docs+board commit (six files); on conflict one `chore(board): … blocked` commit then stop; on a clean rebase ff-merge to `dev` + push `dev` (remote only).
- **Never:** touch `main`, open an MR, run a release, add/move a git note, edit code/tests, rewrite another stage's fields.

## Standalone use
Forks into the `tiger-skills:tiger-update-docs` subagent. Refresh the docs you own (codemap / business / release / README, per the `tiger-docs` sections) from current repo state; may commit `docs(tiger): refresh codemap/business/release/README`. Do NOT close the board (no `passing`, no `current_feature: null`), do not rebase, do not merge — close-out is pipeline-only because it needs fresh e2e full-pass evidence. State which artifacts you refreshed and that the board was untouched.

## References
- `docs/tiger-git-best-practice.md` — rebase/ff-merge rules, never-auto-resolve, one-writer-per-file commit scopes.
