---
name: tiger-docs-readme
description: Refreshes the target project's README.md after a feature ships — surgical and additive, diff-grounded. Invoke directly ("refresh the README") or loaded by tiger-update-docs at close-out.
---

# Tiger Docs — README Writer

Owns `README.md` only. Updates it to reflect what a feature shipped, derived from real diff + artifacts. Loaded by tiger-update-docs at close-out, or invoked standalone.

## When to use

- Standalone: "refresh the README for `<id>`", "update README to mention the new export command".
- In-workflow: tiger-update-docs loads this skill; do not invoke separately.

## Contract

**Inputs:** project dir (absolute), feature id, today (`YYYY-MM-DD`).
**Sources:** `tiger/features/<id>/` artifacts (spec, business, e2e) + `git diff main...HEAD --stat` + touched files.

**Write rules:**
- Surgical and additive — update only sections the feature touched (overview line, feature list, quickstart/usage, changed commands/flags/env/config). Preserve existing structure and the human's voice.
- Ground every claim in the diff/artifacts — usage examples must match commands that exist after this feature.
- Bootstrap a minimal README when none exists: project name, one-line purpose, how to run/test, feature capability.
- Plain GitHub-flavored Markdown; keep it scannable.

**Never:** touch `feature_list.json`, `tiger/*.html`, code, or git notes; close the board, rebase, push, or open an MR.

## Works with

tiger-update-docs (loads this skill) → README.md updated as part of the close-out commit.

## Git interactions

- **Standalone:** `git add README.md && git commit -m "docs(<id>): README refresh"`.
- **Loaded by tiger-update-docs:** do NOT commit — update-docs makes the single close-out commit that includes `README.md`.

## Standalone use

Invoke with project dir, feature id, today. Updates and commits only `README.md`; reports which sections changed.
