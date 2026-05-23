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

Use the Agent tool in Claude Code:

```
You are a code review agent. Read the code-quality skill at
<path-to-skills>/code-quality/SKILL.md and its references/ directory.

Audit these files against all 19 audit checklist items:
- src/orders/service.py
- src/orders/models.py
- src/orders/api.py

For each violation:
- Cite the file path and line number
- Name the specific audit item violated
- Explain what's wrong
- Suggest how to fix it

Save your findings to docs/reviews/2026-05-24-order-service-review.md

Do NOT modify any code. Report findings only.
```

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

The review agent must check ALL 19 audit items:

1. **Types** — Pydantic at boundaries? Typed signatures on all functions?
2. **SRP** — Each class/function has exactly one reason to change?
3. **Encapsulation** — Varying behavior isolated? No change leaks?
4. **DRY** — No duplicated code blocks?
5. **OCP** — New features via new classes, not edits? No long if-elif chains?
6. **Interfaces** — Dependencies on abstractions, not concrete classes?
7. **LSP** — Subclasses fully substitute superclasses?
8. **Composition** — HAS-A over deep IS-A? No unnecessary inheritance?
9. **Surprise** — Function names match actual behavior? No hidden side effects?
10. **Lazy** — Expensive work deferred until needed? Caching where appropriate?
11. **Invariants** — Objects cannot be constructed in invalid states? Setters validate?
12. **Logging** — Structured logging at entry/exit/branches? No print()?
13. **No bare except** — Every try/except specific and justified?
14. **Lint clean** — ruff check (or project linter) passes?
15. **Type check clean** — mypy --strict (or project checker) passes?
16. **Enums** — Known value sets are enums, not magic strings?
17. **No water** — Every line earns its place? No dead code or redundant comments?
18. **Patterns** — Architecture problems solved with appropriate design patterns?
19. **AGENTS.md** — New conventions or commands documented?

## Common Review Findings

These are the most common issues review agents catch that implementation agents miss:

- Returning `None` from a function that callers expect to always return a value (LSP / Surprise)
- Using `print()` in new code instead of `logging` (Logging)
- Catching `Exception` broadly in error handling (No bare except)
- Adding a new `elif` to a 5-branch chain instead of using a registry/Strategy pattern (OCP)
- Magic string `"pending"` instead of `OrderStatus.PENDING` (Enums)
- New function that duplicates an existing one in a different module (DRY / Explore)
- Missing type hint on a new public function (Types)
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
