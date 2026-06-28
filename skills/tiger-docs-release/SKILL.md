---
name: tiger-docs-release
description: Focused writer that adds a feature's entry to tiger/release_docs.md under [Unreleased] with Keep-a-Changelog 1.1.0 discipline (markdown) — TWO audience bands (User-facing changes benefit-phrased, Internal changes technical), grouped under Added/Changed/Deprecated/Removed/Fixed/Security (empty categories omitted, Security never dropped), ISO-8601 dates, derived from the feature's artifacts and git log dev..HEAD. When the e2e gate logged LOW (non-blocking) defects, records them under a "Known issues" entry in the feature's [Unreleased] block. Bootstraps from tiger/templates/release_docs.md when missing. Owns only tiger/release_docs.md. Invoke directly ("write the release notes") or load it as one of tiger-update-docs's skills.
---

# Tiger Docs — Release Notes Writer

Appends a feature's entry to `tiger/release_docs.md` (Keep-a-Changelog 1.1.0, plain markdown). No agent — executes inline. Loaded by tiger-update-docs at close-out, or invoked standalone.

## When to use

- "Write the release notes for `<id>`" / "update the changelog" — standalone.
- Loaded automatically by tiger-update-docs at feature close-out.

## Contract

**Inputs:** project dir (absolute), feature id, today (`YYYY-MM-DD`), feature artifacts + `git log dev..HEAD --oneline`. Derive from these — never from memory.

**Writes:** one entry per feature appended under `[Unreleased]` (always the top block) in `tiger/release_docs.md`. Bootstrap from `tiger/templates/release_docs.md` if missing.

| Rule | Detail |
|---|---|
| Two audience bands (in order) | **User-facing changes** — benefit-phrased, no jargon; **Internal changes** — technical (APIs, schemas, migrations) |
| Categories per band | Added / Changed / Deprecated / Removed / Fixed / Security — omit empty; **never drop Security** |
| Dates | ISO-8601 from `today` |
| Known issues | If `refs/notes/e2e` logged LOW defects: add a `**Known issues**` sub-entry listing each by test-case name + one-line description. HIGH/MEDIUM never appear here — they block. Omit when no LOWs. |
| Style | Plain GitHub-flavored markdown; user band links down to internal anchors |

**Never writes:** `feature_list.json`, `CODEBASE_MAP.md`, `business.md`, `README.md`, code, git notes. Never closes the board, rebases, or merges.

## Works with

tiger-update-docs → **tiger-docs-release** (loaded at close-out alongside the codemap/business/readme writers).

## Git interactions

- **Standalone:** `git add tiger/release_docs.md && git commit -m "docs(tiger): <id> release notes"`
- **Loaded by tiger-update-docs:** do NOT commit — update-docs makes the single close-out commit.

## Standalone use

Invoke: "write the release notes for `<id>`". Needs project dir, feature id, today. Writes and commits only `tiger/release_docs.md`; reports the entry added.
