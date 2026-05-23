# Implementation Workflow

## Normal Flow (per feature)

1. **Clock in** — read PROGRESS.md, DECISIONS.md, `docs/codebase-map.md`, run `make check`
2. **Clarify** — if ANY aspect of the task is ambiguous, ask the user before proceeding
3. **Mark feature active** — update PROGRESS.md, WIP=1
4. **Explore codebase** — read `docs/codebase-map.md`, `docs/business/*.md`, search for overlapping code
5. **Write spec** — `docs/specs/YYYY-MM-DD-<topic>.md`, present to user if non-trivial
6. **Implement** — write code following code-quality skill rules
7. **Layer 1 verify** — lint + type check, fix all issues
8. **Layer 2 verify** — run tests, all must pass
9. **Layer 3 verify** — if cross-component, run E2E or manual smoke test
10. **Record evidence** — save verification output, update feature state to `passing`
11. **Update docs** — update spec with actual outcome, update `docs/business/*.md` if rules changed, update `docs/codebase-map.md` if files changed, update AGENTS.md if conventions changed
12. **Commit** — atomic commit with clean message
13. **Clock out** — session exit checklist, update PROGRESS.md

## Diagnostic Loop (when something fails)

1. What failed? (exact error, expected vs actual)
2. Which layer? (spec / context / environment / verification / state)
3. What's the fix? (clarify spec? add context? fix env? add test? record state?)
4. Apply fix to the harness so this failure class never happens again.
5. Retry.

## Anti-Patterns

**Forbidden:**
- "I'll just start coding and figure it out" — spec first
- "The requirements are clear enough" — if not 100% sure, ask
- "I'll document it later" — same session, or it won't happen
- "I'll fix the lint later" — fix now, layer 1 is always required
- "Let me also refactor X while I'm here" — WIP=1
- "Tests pass on my machine" — verification must be reproducible
- "The code looks right" — verification passes or not done
- "I'll update PROGRESS.md next session" — state decays, update now
- Starting a new feature before current reaches `passing`
- Committing without `make check`
- Implementing without exploring codebase map and business docs first

## Harness Initialization

Before any implementation on a new project, a dedicated init session creates:

1. `AGENTS.md` — router answering all five questions
2. `Makefile` — setup, test, lint, check, dev
3. `PROGRESS.md` — with initial task breakdown (≥3 tasks)
4. `DECISIONS.md` — empty template
5. `docs/features.md` — feature list with triple structure
6. `docs/codebase-map.md` — directory overview with code references
7. `docs/business/` — empty, ready for business rules
8. `docs/specs/` — empty, ready for specs

Bootstrap contract: after init, `make setup` works from scratch, ≥1 test passes, all five AGENTS.md questions answerable from repo alone.
