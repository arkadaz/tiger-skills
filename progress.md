# Progress

> **TEMPLATE** — the session log + current verified status the tiger-skills harness ships as a worked example.
> Replace the placeholder content with your project's real state. State is written at the update-docs step (cartographer) / clock-out.
> Pair this with `feature_list.json` (machine-readable feature state). Convert relative dates to absolute.

## Current State
- **Latest commit:** `<hash>` (`<one-line summary>`)
- **Branch:** main
- **Verification:** `<passing|failing>` (`./init.sh` — `N/N` checks, `<YYYY-MM-DD>`)
- **Last updated:** `<YYYY-MM-DD>`

## Completed
- [x] `<feature-id>` — one line on what shipped and how it was verified. `<YYYY-MM-DD>`

## In Progress
- [ ] `feature-001` (holds the WIP=1 slot — exactly one feature in_progress)
  - **Active since:** `<YYYY-MM-DD>`
  - **Blocked by:** nothing

## Known Issues
- `<short description>` — **Discovered:** `<YYYY-MM-DD>` — **Fix location:** `<file:line>` — tracked as feature `<id>`

## Resolved This Session
- `<what you fixed and how>`

## Failure Log

> When something fails, attribute it to one of the five harness layers and record the fix, so you never fail the same way twice.

| Date | Task | Failure | Layer | Fix | Recurred? |
|------|------|---------|-------|-----|-----------|
| `<YYYY-MM-DD>` | `<task>` | `<what failed>` | Instructions / Environment / State / Scope / Verification | `<harness fix>` | No |

## Next Steps (ordered by priority)
1. `<next action>`
2. `<next action>`
