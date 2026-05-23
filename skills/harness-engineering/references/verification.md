# Verification Pipeline

Every feature must pass three verification layers. Skipping any required layer = not complete.

## Three-Layer Termination Check

| Layer | What It Checks | Required For | Command (default) |
|-------|---------------|-------------|-------------------|
| **1 — Static** | Lint + type check | Every change | `ruff check src/` + `mypy src/ --strict` |
| **2 — Runtime** | Unit + integration tests | Every change | `pytest tests/ -x` |
| **3 — System** | E2E tests, smoke test | Cross-component changes | `pytest tests/ -x -m e2e` |

### Layer 1: Static Analysis

**What:** Linter finds code style issues, potential bugs, and complexity problems. Type checker verifies that types are used correctly across the codebase.

**Why first:** Static analysis is instant (seconds) and catches a large class of bugs before any code runs. Fixing a type error at runtime is orders of magnitude more expensive than at lint time.

**Failure pattern:**
```
src/api/orders.py:45: error: Argument "total" to "OrderResponse" has incompatible type "float"; expected "Decimal"
src/services/pricing.py:78: error: Missing return statement
```
Fix each error from top to bottom. Top errors often cause cascading errors below.

### Layer 2: Runtime Tests

**What:** Unit tests (single function/class in isolation) + integration tests (multiple components together, but with test databases/stubs).

**Why second:** Tests verify behavior. But if types are wrong, tests often fail with confusing errors. Fix types first, then run tests.

**Failure pattern:**
```
FAILED tests/test_order_service.py::test_create_order_with_promo - AssertionError: Expected Money('90.00'), got Money('100.00')
```
The discount wasn't applied. Check promo code logic, then fix and re-run.

### Layer 3: System Tests

**What:** End-to-end tests that exercise the full stack — real HTTP requests, real database (test instance), real external service stubs.

**When required:** Any change that:
- Modifies an API endpoint signature or behavior
- Changes database schema or queries
- Touches authentication/authorization
- Affects message queue producers or consumers
- Changes how external services are called

**When optional:** Pure refactoring (no behavior change), documentation-only changes, test-only changes.

### Sequence Is Mandatory

Do NOT proceed to layer 2 if layer 1 fails. Do NOT proceed to layer 3 if layer 2 fails.

**Why this order matters:**
- Layer 1 failures make Layer 2 failures hard to diagnose (is it a type error or a logic error?)
- Layer 2 failures make Layer 3 failures unpredictable (the integration surface is already broken)
- Skipping layers creates "fix it later" debt that compounds

## Definition of Done

Place this verbatim in every project's AGENTS.md:

```
## Definition of Done
A feature is complete ONLY when:
1. Static analysis passes (ruff check + mypy --strict, zero errors)
2. All tests pass (unit + integration + E2E if cross-component)
3. Verification evidence is recorded (test output saved or linked)
4. Code is committed with a clean, descriptive message
5. docs/GRAPH.md is updated with new code flow paths
6. docs/codebase-map.md is updated if files were added/changed/removed
7. PROGRESS.md reflects the new state (feature marked passing)
8. Session exit checklist passes (all 8 items)
```

## Worker ≠ Checker

The agent that writes code CANNOT be the sole judge of whether it works. This is a systematic bias — agents over-rate their own output.

The checker is:
1. **Layer 1 tools** (ruff, mypy) — mechanical, no judgment involved
2. **Layer 2 tests** (pytest) — pass/fail, no interpretation needed
3. **Layer 3 tests** (E2E) — system-level verification
4. **Review agent** (from code-quality skill) — independent code audit

**There is no "looks right to me" layer.** Verification is objective or it doesn't count.

## Verification Evidence

For every feature, save evidence that verification passed:

```markdown
### F03: User Preferences Endpoint — Verification Evidence
- **Layer 1:** ruff: 0 errors, mypy: 0 errors (2026-05-24 14:30)
- **Layer 2:** pytest: 12 passed, 0 failed (2026-05-24 14:32)
- **Layer 3:** E2E: 3 passed (preferences CRUD flow) (2026-05-24 14:35)
- **Review:** docs/reviews/2026-05-24-preferences-review.md — APPROVED
- **Commit:** abc1234
```

Evidence should be a file in `docs/verification/` or a section in the feature list.

## Error Messages That Help

Verification failures must tell the agent HOW to fix them, not just WHAT failed.

**Bad (WHAT only):**
```
FAILED test_create_order
```
Agent must read the test, understand the assertion, trace through code, guess what's wrong. 5-10 minutes of diagnosis.

**Good (WHAT + WHY + WHERE):**
```
FAILED tests/test_order_service.py::test_create_order_with_expired_promo

Expected: HTTP 400 with {"error": "Promo code expired"}
Got: HTTP 500 with {"error": "Internal server error"}

Root cause: services/promo.py:45 (validate_promo) raises PromoExpired exception,
but the exception handler in api/orders.py only catches ValueError, not PromoExpired.
PromoExpired inherits from DomainException, not ValueError.

Fix: Add `except PromoExpired:` handler in api/orders.py:create_order() line 67,
or change the generic handler at line 72 to catch DomainException instead of ValueError.
```
Agent reads this and fixes it in 1 minute.

### How to Write Good Error Messages

Every error message must answer three questions:
1. **What was expected vs what happened?** — concrete values, not "it didn't work"
2. **Why did it likely happen?** — trace the probable root cause
3. **Where should the fix be applied?** — file path + line number + what to change

This turns errors into a self-correcting loop instead of a diagnosis burden.
