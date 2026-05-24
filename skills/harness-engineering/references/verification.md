# Verification Pipeline

Every feature must pass three verification layers. Skipping any required layer = not complete.

## Three-Layer Termination Check

| Layer | What It Checks | Required For | Command (default) |
|-------|---------------|-------------|-------------------|
| **1 — Static** | Lint + type check | Every change | `ruff check src/` + `mypy src/ --strict` |
| **2 — Runtime** | Unit + integration tests | Every change | `pytest tests/ -x` |
| **3 — System** | E2E tests, smoke test | Cross-component changes | `pytest tests/ -x -m e2e` |

### Layer 1: Static Analysis

Lint + type check. Every change. See code-quality [non-negotiable #3](../../code-quality/SKILL.md#five-non-negotiables-language-agnostic) for the standard.

**Failure pattern:**
```
src/api/orders.py:45: error: Argument "total" to "OrderResponse" has incompatible type "float"; expected "Decimal"
src/services/pricing.py:78: error: Missing return statement
```
Fix each error from top to bottom. Top errors often cause cascading errors below.

### Layer 2: Runtime Tests

Unit + integration tests. Every change. See code-quality [review-agent.md](../../code-quality/references/review-agent.md) for independent verification.

**Failure pattern:**
```
FAILED tests/test_order_service.py::test_create_order_with_promo - AssertionError: Expected Money('90.00'), got Money('100.00')
```
The discount wasn't applied. Check promo code logic, then fix and re-run.

### Layer 3: System Tests

**What:** End-to-end tests that exercise the full stack — real HTTP requests, real database (test instance), real external service stubs.

**When required / When optional:**

| When required | When optional |
|---------------|---------------|
| API endpoint signature or behavior changes | Pure refactoring (no behavior change) |
| Database schema or query changes | Documentation-only changes |
| Authentication/authorization changes | Test-only changes |
| Message queue producer or consumer changes | |
| Changes to how external services are called | |

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

## The Iron Law

**Never claim completion without fresh verification evidence from THIS session.**

This is the single most important rule in the entire harness. It is non-negotiable, non-overridable, and has zero exceptions. Every other rule exists to support this one.

What "fresh evidence" means:
- **Fresh** = produced in the current session, after the last code change. Not from a previous session. Not from before you edited the file.
- **Evidence** = tool output you can paste. `ruff check` output. `pytest` output. `curl` response. Screenshot. Not "I believe," not "it should work," not "the logic is sound."
- **From THIS session** = if you read a passing result from PROGRESS.md that was recorded yesterday, that is NOT fresh evidence. Run it again.

### The Gate

Before writing ANY completion claim ("done," "implemented," "passing," "ready for review"), this gate MUST pass:

```
COMPLETION GATE — all must be TRUE:
1. Layer 1 ran THIS session, AFTER last code change    → paste output
2. Layer 2 ran THIS session, AFTER last code change    → paste output
3. Layer 3 ran THIS session (if required)              → paste output
4. Every output shows ZERO failures                    → no "expected failures"
5. Evidence is recorded in verification file           → file path cited
```

If ANY item is FALSE, you are NOT done. Do not say you are done. Do not say "almost done." Do not say "done pending X." You are not done.

### Rationalization Prevention

Agents systematically rationalize skipping verification. These are the most common rationalizations and why they are ALL wrong:

| Rationalization | Why It's Wrong | What To Do Instead |
|----------------|---------------|-------------------|
| "The change is too small to break anything" | Small changes cause cascading failures. A one-character typo can crash production. | Run all three layers. It takes 30 seconds. |
| "I just ran the tests before this edit" | "Before this edit" ≠ "after this edit." You changed code. Evidence is stale. | Run again. Every time. |
| "The tests aren't related to what I changed" | You don't know that. Coupling is invisible. | Run the full suite. Let the tools decide. |
| "It's just a refactoring, behavior didn't change" | If behavior didn't change, tests will pass. If they don't, your refactoring broke something. | Run the tests. Prove it. |
| "I'll verify after the next change too" | Batching verification obscures which change broke what. | Verify after EVERY change. |
| "The linter warnings are pre-existing" | If they're pre-existing, document them. If they're new, fix them. Either way, acknowledge them explicitly. | Run `ruff check`, compare to baseline. |
| "Tests are flaky, that failure doesn't count" | Flaky tests are broken tests. Fix or quarantine them. A flaky pass is not evidence. | Fix the flake, then re-run. |
| "I'm confident in the logic" | Confidence is not evidence. Confidence is the feeling you get right before you're wrong. | Run the verification. Replace confidence with proof. |
| "The type checker is too strict here" | The type checker is exactly as strict as it should be. If `mypy --strict` says there's an error, there's an error. | Fix the type error. Do not add `# type: ignore`. |

### Red Flag Words

If you find yourself writing ANY of these words in a completion claim, STOP. You are rationalizing.

| Red Flag | Translation | Required Action |
|----------|------------|----------------|
| "should work" | "I didn't test it" | Test it |
| "probably fine" | "I didn't verify" | Verify it |
| "looks correct" | "I read it but didn't run it" | Run it |
| "minor issue" | "There's a bug I'm ignoring" | Fix the bug |
| "essentially done" | "Not actually done" | Finish it |
| "just needs" | "There's more work" | Do the work |
| "straightforward" | "I'm about to skip verification" | Don't skip |
| "no functional change" | "I didn't run the tests to confirm" | Run the tests |
| "as expected" | "I expected it to work so I didn't check" | Check it |
| "trivial" | "I'm about to skip a step" | Don't skip |

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
