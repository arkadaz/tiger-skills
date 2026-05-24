# Independent Code Review

After implementing any non-trivial change, a SEPARATE review agent MUST audit the code. The agent that wrote the code cannot be the sole judge of its quality — agents systematically over-rate their own output (Anthropic, 2026).

## When Review Is Required

| Change Type | Review Required? |
|------------|-----------------|
| New class or module | **Yes — mandatory** |
| Function >15 lines added or modified | **Yes — mandatory** |
| New API endpoint or public interface | **Yes — mandatory** |
| Change touches shared infrastructure (DB, auth, config) | **Yes — mandatory** |
| Change spans 3+ files | **Yes — mandatory** |
| Bug fix (single line, obvious) | Optional |
| Typo / formatting / config value | No |
| Test-only change | Optional (but another agent should run them) |

## The Review Flow

```
Implementation Agent          Review Agent
─────────────────────         ─────────────
1. Writes code
2. Self-tests (lint, types, tests)
3. Commits locally
4. Spawns review agent ──────> 5. Reads code-quality SKILL.md
                               6. Reads the diff
                               7. Checks against all 19 audit items
                               8. Files violations with line references
                               9. Saves to docs/reviews/<date>-<topic>-review.md
10. Reads review findings
11. Addresses every violation
12. Re-runs verification
13. Commits fixes
14. Marks feature 'passing'
```

**Step 9 is important:** The review agent does NOT modify code. It only reports findings. The implementation agent decides how to fix each issue.

## How to Spawn the Review Agent

Use the Agent tool with this prompt:

> You are a code review agent. Read code-quality/SKILL.md and its references/ directory.
> Audit the following files against the 19-item audit checklist:
> - [list files]
> For each violation: cite file:line, name the audit item, explain what's wrong, suggest a fix.
> Save findings to `docs/reviews/YYYY-MM-DD-<topic>-review.md`. Do NOT modify code.

## Review Report Structure

Every review must follow this exact template:

```markdown
# Code Review: <feature/task name>

## Summary
- **Reviewed by:** <agent identifier>
- **Date:** <YYYY-MM-DD>
- **Files reviewed:**
  - `src/module/file.py` (N lines changed)
- **Audit score:** <passed>/19 items
- **Severity:** <CLEAN / MINOR / MAJOR / BLOCKING>

## Violations Found

### <Violation category> — <audit item #N>
- **File:** `src/module/file.py:45`
- **Severity:** <MAJOR / MINOR>
- **Problem:** <specific description of what's wrong>
- **Fix:** <concrete suggestion for how to fix>

### <Next violation> — ...

## Observations (non-blocking)
- <Something that isn't a violation but could be improved>
- <Pattern noticed across multiple files>

## Verdict
- [ ] **APPROVED** — no violations, or violations are trivial
- [ ] **APPROVED WITH CHANGES** — minor violations, can fix before merge
- [ ] **CHANGES REQUESTED** — major/blocking violations, must fix before proceeding
- [ ] **REJECTED** — fundamental architectural issues, needs redesign
```

## What the Review Agent Checks

The review agent must check all items from the [audit checklist](../SKILL.md#audit-checklist-quick-reference): 13 design principles + 12 tooling items = 25 checks total.

**CRITICAL — Type Discovery Check:** Before reviewing, the review agent MUST also run its own codebase type discovery (Grep for all type definitions in the project). When reviewing, if the agent sees `cfg: Any` or `driver: Any`, it must search whether a real type exists (e.g., `AppConfig`, `Neo4jDriver`). If a real type exists and was not used, this is a **BLOCKING** violation — not MAJOR, BLOCKING. The implementation agent skipped type discovery.

## Common Review Findings

These are the most common issues review agents catch that implementation agents miss:

- **`Any` used when a real type exists in the codebase** — e.g., `cfg: Any` when `AppConfig` is defined in `src/core/config.py`. **BLOCKING.** Search the codebase before accepting any `Any`. (Type Discovery)
- Returning `None` from a function that callers expect to always return a value (LSP / Surprise)
- Using `print()` in new code instead of `logging` (Logging)
- Catching `Exception` broadly in error handling (No bare except)
- Adding a new `elif` to a 5-branch chain instead of using a registry/Strategy pattern (OCP)
- Magic string `"pending"` instead of `OrderStatus.PENDING` (Enums)
- New function that duplicates an existing one in a different module (DRY / Explore)
- Missing type hint on a new public function (Types)
- Bare `dict`/`list`/`set`/`tuple` without type parameters — e.g., `brief: dict` instead of `brief: dict[str, str]` (Types)
- `Any` or `object` as inner type parameter — e.g., `list[dict[str, Any]]` instead of `list[EntityRow]` (Types)
- External dependency passed as function parameter (driver, client, connection, session) instead of constructor-injected (DI)
- Leading-underscore on ANY name (`_xxx`): variables, attributes, functions, methods (Naming)
- Nested functions (`def` inside `def`) instead of flat module-level functions (Flat Functions)
- Magic strings as registry/factory keys instead of enums — e.g., `"email"` instead of `NotificationMethod.EMAIL` (Enums)
- Code in `__init__.py` — re-exports, `__all__`, logic (must be empty)
- Forgetting to update `docs/codebase-map.md` after creating new files (AGENTS.md)
- Constructor directly instantiating dependencies instead of accepting injected interfaces (Interface / Composition)

## After the Review

The implementation agent MUST:
1. Read every finding
2. Fix every MAJOR and BLOCKING violation
3. Fix MINOR violations or document why they're deferred
4. Re-run the full verification pipeline after fixes
5. Commit the fixes separately from the original implementation (clean history)
6. Update the review report with a "Fixed in commit <hash>" note for each resolved finding
