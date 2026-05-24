# Session Discipline

Every session must begin with a clock-in and end with a clock-out. There is no "I'll clean up later." The next session's job is its own task, not cleaning up your mess — and it will build on chaos, making it worse.

## Why This Matters

Without session discipline, a fresh session spends 30-50% of time re-discovering state. With it, a new session is productive within 3 minutes — PROGRESS.md is machine-verifiable, DECISIONS.md preserves rationale, and AGENTS.md keeps conventions consistent.

## Clock-In (Session Start)

Execute these steps in strict order. Do not skip any.

### Step 1: Read PROGRESS.md

Understand the current state of the project:
- What's completed? (verify — don't just trust, run the verification commands)
- What's in progress? (is it actually in progress, or abandoned?)
- What are the known issues? (these are landmines — know them before you step)
- What are the next steps? (this is likely your task)

### Step 2: Read DECISIONS.md

Understand WHY past decisions were made:
- What architectural choices are locked in?
- What alternatives were rejected and why?
- What constraints are in place from past decisions?

If you don't read DECISIONS.md, you risk re-litigating settled decisions or unknowingly violating them.

### Step 3: Run make check

Confirm the repo is in a consistent state. See [verification.md](verification.md) for the 3-layer pipeline. The same checks that code-quality's [non-negotiable #3](../../code-quality/SKILL.md#five-non-negotiables-language-agnostic) enforces.

### Step 4: Handle Failures

If `make check` fails:
- Diagnose the failure BEFORE starting any new work
- If it's a pre-existing failure: document it in PROGRESS.md Known Issues and decide whether to fix it first
- If it's a regression from last session: fix it before proceeding — never build on broken foundation
- If you cannot fix it within 10 minutes: mark the feature as `blocked` and explain why in PROGRESS.md

**Never start new work with a broken build.** It's like building a second floor while the first floor is on fire.

## Clock-Out (Session End)

All 8 items must pass. If any fails, the session is NOT complete.

```
Session Exit Checklist:
- [ ] make check passes (lint + type-check + ALL tests)
- [ ] PROGRESS.md updated (completed items marked, in-progress state accurate, next steps clear)
- [ ] DECISIONS.md updated (any new architectural decisions with full rationale)
- [ ] All completed work committed with clean, descriptive messages
- [ ] No debug code, print() statements, commented-out code, or stale TODOs in the diff
- [ ] No temporary files, debug logs, scratch scripts in the working tree
- [ ] Standard startup path works (make dev or equivalent) — a fresh clone must be runnable
- [ ] AGENTS.md updated if new conventions, commands, hard constraints, or topic docs were introduced
```

### What Each Item Means

**1. make check passes:** Run the full verification suite. If any test fails, you're not done. If you're leaving a known failure, it must be documented in PROGRESS.md Known Issues with a clear reason.

**2. PROGRESS.md updated:** The next session must see exactly where you left off — not guess. Update: completed items (mark [x]), in-progress item (state + % complete + what remains), known issues (add new, remove fixed), next steps (reorder based on what makes sense next).

**3. DECISIONS.md updated:** If you made an architectural choice — technology selection, pattern adoption, interface design, data model change — record it. A decision without a rationale will be questioned and potentially reversed by the next session.

**4. Clean commits:** Each commit = one logical change. Commit message = what AND why. No "WIP" or "fixes" commits. Squash before ending the session if you have messy intermediate commits.

**5. No debug artifacts:** `console.log`, `print()`, `debugger` statements, `# TODO`, `# FIXME`, `# HACK` — all must be removed or converted to proper logging/tickets. The next session shouldn't find your debugging breadcrumbs.

**6. No temporary files:** `test_output.json`, `debug.log`, `scratch.py`, `temp_*.csv` — delete them. If a temp file is useful, it should be a proper test fixture or documentation.

**7. Startup works:** `make dev` or the equivalent must work from a clean state. If you added a dependency, did you update the lock file? If you added an env var, did you update `.env.example`?

**8. AGENTS.md updated:** New convention → add it. New verification command → add it. New topic doc → link it. Changed architecture → update the directory map. AGENTS.md rots faster than any other file because people forget to update it. Don't.

## PROGRESS.md — The Agent's Memory

This file is what replaces "hey, what were you working on yesterday?" It MUST be machine-readable and updated every session.

```markdown
# Project Progress

## Current State
- **Latest commit:** abc1234 (feat: add user preferences endpoint)
- **Branch:** main
- **Test status:** 47/47 passing
- **Lint:** passing (ruff check src/)
- **Type check:** passing (mypy src/ --strict)
- **Last updated:** 2026-05-24 16:30 UTC

## Completed
- [x] User model + database migration (commit def5678, 2026-05-23)
- [x] User registration endpoint POST /auth/register (commit ghi9012, 2026-05-23)
- [x] Auth middleware with OAuth 2.0 (commit jkl3456, 2026-05-24)
- [x] User preferences GET/PUT endpoints (commit abc1234, 2026-05-24)

## In Progress
- [ ] Pagination for GET /users list (85% — edge case: empty result set returns 500)
  - **Active since:** 2026-05-24
  - **Blocked by:** nothing
  - **Expected completion:** next session

## Known Issues
- test_pagination_edge_case fails on empty result sets (returns 500 instead of 200 with empty list)
  - **Discovered:** 2026-05-24
  - **Root cause:** `offset` calculation overflows when total_count = 0
  - **Fix location:** src/api/users.py:45 (get_users)
- Intermittent timeout on email sending in CI (test_notify_user times out ~10% of runs)
  - **Discovered:** 2026-05-23
  - **Root cause:** unknown — possibly CI network
  - **Workaround:** retry annotation on test, marked as flaky

## Next Steps (ordered by priority)
1. Fix pagination empty-result bug (test_pagination_edge_case)
2. Add "include deleted users" query parameter to GET /users
3. Add user avatar upload endpoint
4. Investigate CI email timeout (low priority — flaky test, not production issue)
```

**Key principles:**
- **Current State section is machine-checkable.** Test status, lint, type check — these aren't opinions, they're verifiable.
- **In Progress has a percentage.** Not "working on it" — "85%, edge case failing." Specific and actionable.
- **Known Issues have root cause analysis.** Not just "it's broken" — "offset overflow when total=0, fix at users.py:45."
- **Next Steps are ordered.** The top item is what the next session starts with. No prioritization debate needed.

## DECISIONS.md — The Agent's Rationale

Record every architectural decision that another session might question or reverse.

```markdown
# Architectural Decisions

## Decision: Use SQLAlchemy 2.0 async ORM
- **Date:** 2026-05-20
- **Context:** Needed to choose database access pattern for the new order service.
  Previous project used raw SQL with psycopg2. Team has mixed experience with ORMs.
- **Decision:** Use SQLAlchemy 2.0 with async session (asyncpg driver).
- **Alternatives rejected:**
  - Raw SQL (psycopg2): Rejected — type safety and composability needed for complex order queries.
  - Django ORM: Rejected — project is FastAPI, not Django; would pull in unnecessary framework.
  - SQLAlchemy 1.4 sync: Rejected — async gives better concurrency under load.
- **Constraints imposed:** All new queries must use SQLAlchemy 2.0 style (select() function, not Query object).
  Repository classes must accept async session via dependency injection.
- **Commit:** abc1234

## Decision: Pydantic at every I/O boundary
- **Date:** 2026-05-21
- **Context:** Multiple bugs traced to unvalidated dict data flowing from API layer to service layer.
  Developers spent hours debugging KeyError and TypeError in business logic.
- **Decision:** Every function receiving data from outside the process must use Pydantic models.
  API request bodies, file parsing, DB query results passed between layers, message queue payloads.
- **Alternatives rejected:**
  - Manual validation with if/raise: Rejected — scattered, inconsistent, hard to maintain.
  - Dataclasses: Rejected — no built-in validation, no EmailStr, no field_validator.
  - Marshmallow: Rejected — Pydantic is standard in FastAPI ecosystem, better IDE support.
- **Constraints imposed:** No function signature may accept `dict` or `list` at a system boundary.
  Use Pydantic BaseModel. Type-check with mypy --strict.
- **Commit:** def5678
```

**When to write a decision record:**
- Choosing between two or more libraries/frameworks
- Adopting a new architectural pattern
- Changing a data model in a way that affects multiple services
- Setting a hard constraint that future code must follow
- Rejecting a seemingly obvious approach (so the next person doesn't try it again)

**When to NOT write a decision record:**
- Trivial implementation details ("used a list, not a set")
- Standard practice for the stack ("used FastAPI dependency injection")
- Decisions that can be completely reversed with no impact
