---
name: tiger-update-docs
description: Final stage — the ONE agent that refreshes every project-global doc by LOADING the tiger-docs-* writer skills (codemap → tiger/codemap.html, business → the cumulative tiger/business.html catalog keyed by feature id, release → tiger/release_docs.html, readme → README.md), then closes the board (status/phase: passing, current_feature: null — the ONLY stage allowed to), commits docs + README + board in ONE commit, rebases feature/<id> onto main, and on a clean rebase opens the MR (never merges). Use on "update the docs", "refresh the codemap", "write the changelog/release notes", "update the README", "close out the feature", "open the MR", or when the loop finishes green and the feature needs finalizing — even standalone.
context: fork
agent: tiger-development-kit:tiger-update-docs
---

# TIGER Update Docs — Close-Out & Finalize

Last stage. Make the AI's work human-readable (refresh global docs + README), declare the feature done (the only stage that may close the board), and put the branch in front of the human as an open MR. Never merge.

## When to use
- "update the docs", "refresh the codemap", "changelog/release notes", "update the README", "close out the feature", "open the MR" — or the workflow's PASS handoff after e2e.
- In-workflow: full close-out + rebase + MR. Standalone: docs refresh only, no board close-out.

## Contract

Full procedure: agents/tiger-update-docs.md — this skill is the contract + how to run it.

**One agent that LOADS docs-* writers** (no sub-agents): codemap / business / release / readme. Loaded here they do NOT commit — you make the one close-out commit.

**Gate before touching the board** (read `feature_list.json` FIRST). Close ONLY when all true from fresh e2e evidence:
- `phase: validate` (e2e full-pass: zero HIGH, zero MEDIUM),
- every `acceptance_criteria[]` `status: done` with evidence,
- every `tasks[]` complete.

Anything less → refresh docs you safely can, report what's missing, STOP. Do not close.

**Ownership — you write, then commit, exactly these:**

| Artifact | Rule |
|---|---|
| `tiger/codemap.html` | Refresh from real diff; STABLE node ids; append Recent-Changes row. Mermaid CDN allowed. |
| `tiger/business.html` | CUMULATIVE per-feature catalog keyed by id (`001 — …`, `002 — …`). Append THIS feature's entry; NEVER drop/restate a prior entry — only extend. |
| `tiger/release_docs.html` | Append entry under `[Unreleased]`; User-facing then Internal bands; categories Added/Changed/Deprecated/Removed/Fixed/Security (omit empty). LOW e2e defects → **Known issues** line (read from `git notes --ref=e2e`). |
| `README.md` | Surgical + additive; touched sections only; preserve human voice. |
| `feature_list.json` | Close-out (below). |
| `progress.md` | Append close-out note. |

**Board close-out (your EXCLUSIVE window):** set `status: passing`, `phase: passing`, `current_feature: null` (all three agree). Fill `validation.*` + `learning.{technical,product,process,harness_updates}` from real signal (e2e note, fix-up rounds). RECORD harness lessons — never edit `CLAUDE.md` yourself. Preserve WIP=1 + reciprocal acyclic links; run `scripts/validate-board.py` if present, stop on failure.

**Never:** rewrite grill/architect/code-gen/e2e fields; edit code/tests; add/move git notes; push to `main`; merge or squash-merge; run a release. The board chain is architect (init) → e2e (loop phase) → you (passing); only you set `current_feature: null`.

**One commit:** `docs(tiger): <id> close-out — codemap/business/release/README refresh (phase: passing)` adding the six files above. Code already landed as the generator's commits — don't re-commit code.

**Rebase onto MAIN, never auto-resolve:** rebase `feature/<id>` onto `origin/main` (fallback local `main`). On conflict `git rebase --abort` (NEVER `--continue`), reopen board to `phase: blocked`/`status: in_progress`/`current_feature: <id>`, note the reason, commit `chore(board): <id> phase -> blocked (rebase conflict)`, STOP. Human resolves.

**MR, never merge:** clean rebase + `origin` exists → push `feature/<id>` + OPEN MR targeting `main` (via `PULL_REQUEST_TEMPLATE.md`). Clean rebase + no remote → branch local-ready. Human squash-merges.

**Final token (workflow reads the LAST occurrence — emit cleanly, nothing after):**

```
FINALIZE_STATUS: MERGED_READY
FINALIZE_STATUS: NO_REMOTE_READY
FINALIZE_STATUS: REBASE_CONFLICT
```
`MERGED_READY` = clean rebase, pushed, MR opened. `NO_REMOTE_READY` = clean rebase, no remote. `REBASE_CONFLICT` = aborted, board reopened to blocked, stopped.

## Works with
e2e (PASS handoff, `phase: validate`) → **update-docs** (refresh + close + MR) → human squash-merge onto main. Last stage; no downstream agent.

## Git interactions
- **Reads:** `git log main..HEAD`, `git diff main...HEAD`, `git notes --ref=e2e`, touched files, `feature_list.json`, `progress.md`, feature `tiger/features/<id>/*.html`, global `tiger/*.html`, `git fetch`/`rev-parse` for rebase target.
- **Writes:** one docs+board commit (six files); on conflict one `chore(board): … blocked` commit then stop; push `feature/<id>` + open MR (clean rebase + remote only).
- **Never:** push to `main`, merge/squash-merge, run a release, add/move a git note, edit code/tests, rewrite another stage's fields.

## Standalone use
Forks into the `tiger-development-kit:tiger-update-docs` subagent. Refresh the docs you own (codemap / business / release / README, loading the matching docs-* skills) from current repo state; may commit `docs(tiger): refresh codemap/business/release/README`. Do NOT close the board (no `passing`, no `current_feature: null`), do not rebase, do not open an MR — close-out is pipeline-only because it needs fresh e2e full-pass evidence. State which artifacts you refreshed and that the board was untouched.

## References
- Keep a Changelog 1.1.0 — categories, `[Unreleased]`-on-top, ISO dates: https://keepachangelog.com/en/1.1.0/
- C4 container model — codemap altitude: https://c4model.com/diagrams/container
- Mermaid — `flowchart`+`subgraph`, v11 CDN: https://mermaid.js.org/intro/getting-started.html
- `docs/tiger-git-best-practice.md` — rebase/MR rules, never-auto-resolve, one-writer-per-file commit scopes.
