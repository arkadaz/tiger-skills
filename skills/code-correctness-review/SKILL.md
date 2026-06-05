---
name: code-correctness-review
description: Adversarial correctness review — prove the code is WRONG before letting it pass. Trace every control and data path, enumerate edge cases, hunt logic bugs, and map every acceptance criterion to a real test (unit + end-to-end). Use after implementation, before claiming completion, on any non-trivial change. Tests passing is not correctness — this skill checks behavior, not structure.
---

# Code Correctness Review

The quality review (`code-quality-review`) checks how the code is *written* — types, DI, enums, SRP, DRY. This skill checks whether it is *right*. **They are different audits and both are required.** A fully-typed, lint-clean, beautifully-structured implementation can still compute the wrong answer, crash on an empty list, or leak a handle. Structure review never catches that. This one does.

> Agents write code, get the tests to pass, and declare victory — then the program is full of bugs in real use, and fixing one bug breaks another. The cause: nobody traced the actual behavior, and the tests only proved the tests pass. — the failure this skill exists to prevent.

## The Adversarial Stance

**Assume the code is wrong and prove it.** Your job is not to confirm it works — it is to find the input, path, or interaction that breaks it. A review that finds nothing must *show its work* (the paths it traced, the edge cases it tried) — "looks correct" is not a finding, it is the absence of review.

## When Correctness Review Is Required

| Change Type | Required? |
|------------|-----------|
| New function, class, or module with logic | **Yes — mandatory** |
| Any change to control flow / conditionals / loops | **Yes — mandatory** |
| Bug fix (even one line) | **Yes — and it must ship with a regression test** |
| New API endpoint or user-facing workflow | **Yes — mandatory, E2E test required** |
| Change touches money, auth, data integrity, concurrency | **Yes — mandatory** |
| Pure formatting / comments / config value | No |

## The Protocol — run every step, in order

### 1. Reconstruct intended behavior (from the spec, not the code)

Read `specs/<feature-id>.md` and the acceptance criteria. Write down, in your own words, what the code is *supposed* to do for the happy path and for every error/edge case the spec lists. **Derive expectations from the spec — never from the implementation**, or you will just rubber-stamp whatever the code happens to do.

### 2. Control-flow trace

Trace execution path by path. For each:
- **Happy path** — step through it line by line with a concrete realistic input. Does it actually produce the specified output?
- **Every error / early-return / exception path** — what triggers it, and is the response correct (not just "an error is raised")?
- **Every branch and loop** — does each `if/else`, `match`, loop bound, and `break/continue/return` do what its surroundings imply?

Count the paths you traced. That number goes in the proof line.

### 3. Data-flow trace

Follow each input from entry to use:
- Where does it come from, what transforms it, where is it consumed?
- Can it be `null`/`None`/`undefined`, empty, negative, zero, huge, malformed, or the wrong type by the time it is used?
- Is shared/mutable state read or written from more than one place? Aliasing? Stale reads?

### 4. Edge-case enumeration

For each input and boundary, try the awkward values (count how many you considered):

| Class | Probe |
|-------|-------|
| Empty | empty string / list / map / file / result set |
| Null | `null`/`None`/`nil`/`undefined` where a value is assumed |
| Boundary | 0, 1, -1, max, max+1, first, last, off-by-one |
| Size | very large input, deep nesting, long string, many items |
| Duplicate / order | repeated keys, unsorted input, reversed, already-sorted |
| Type / encoding | unicode, mixed types, locale, timezone, float precision |
| Concurrency | two callers at once, re-entrancy, partial failure mid-operation |
| External | dependency slow / down / returns error / returns garbage |

### 5. Logic-bug hunt

Actively look for each (these are what "passes tests but breaks in use" is made of):

- Off-by-one (`<` vs `<=`, `len` vs `len-1`, inclusive/exclusive ranges)
- Inverted or wrong condition (`and`/`or` swap, negation, De Morgan slip)
- Wrong operator / sign / unit (ms vs s, 0-indexed vs 1-indexed, `+` vs `-`)
- Missing return / fall-through / unhandled branch / non-exhaustive match
- Unhandled null / empty / error result from a callee
- Resource leak (file/socket/lock/connection not closed on every path, incl. error paths)
- Race condition / unsynchronized shared mutation / check-then-act
- State left inconsistent after a partial failure (no rollback / cleanup)
- Integer overflow / float rounding / precision loss
- Incorrect default / fallback that silently hides a failure

### 6. AC ↔ test map (the anti-rubber-stamp gate)

Build this table — **every acceptance criterion must be proven by a real, specific test**:

| AC | Proven by test | Verdict |
|----|----------------|---------|
| AC1 | `tests/e2e/test_checkout.py::test_happy_path` | proven |
| AC2 | — no test asserts this — | **BLOCKING** |
| AC3 | `test_x` exists but asserts only `is not None` | **MAJOR — vacuous** |

A test that does not actually assert the specified behavior (asserts a tautology, only checks "no exception", mocks away the thing under test) counts as **no test**. An AC with no proving test is a finding, regardless of how clean the code is.

### 7. E2E presence & adequacy

- Is there an **end-to-end test that exercises the real user workflow** described in the spec (not just unit tests of the pieces)? If the feature is user-facing and there is none → **BLOCKING**.
- Does the E2E test drive the actual entry point and assert the user-visible outcome — or does it stub the very thing it claims to test?

### 8. Regression check

- Does the full existing suite still pass with this change? (Confirm against the executor's evidence — full run, not fail-fast-and-stop.)
- For a bug fix: is there a new test that **fails without the fix and passes with it**? No failing-first regression test = the fix is unproven and may not address the real cause.

## Severity

| Severity | Meaning | Verdict impact |
|----------|---------|----------------|
| **BLOCKING** | A correctness bug, an unproven acceptance criterion, or a missing E2E test for a user-facing feature | → REJECTED |
| **MAJOR** | A plausible edge-case failure, a vacuous test, or a missing regression test for a fix | → CHANGES REQUESTED |
| **MINOR** | A latent risk worth noting; no demonstrated failure | → APPROVED WITH CHANGES |

## Report Template

```markdown
# Correctness Review: <feature>

correctness-review invoked: YES — paths traced: P, edge cases: E, logic findings: K, ACs proven by test: X/Y

## Behavior reconstructed (from spec)
- Happy path: <one line>
- Error/edge cases the spec requires: <list>

## Control-flow trace
- Happy path: <input → walked → produced ✓/✗>
- Error path <name>: <trigger → response ✓/✗>
- ...

## Edge cases tried
| Probe | Input | Expected | Actual / risk |
|-------|-------|----------|---------------|

## Findings
### <bug class> — `file:line` — [BLOCKING/MAJOR/MINOR]
- **Problem:** <the specific input/path that breaks, and the wrong result>
- **Fix:** <concrete change, or the test that must be added>

## AC ↔ test map
| AC | Proven by test | Verdict |
|----|----------------|---------|

## E2E & regression
- E2E for the user workflow: <test path / MISSING → BLOCKING>
- Full suite green: <yes/no, from executor evidence>
- Regression test (for fixes): <fails-without / passes-with, or MISSING>

## Verdict
- [ ] APPROVED — paths traced, every AC proven by a real test, E2E present
- [ ] APPROVED WITH CHANGES (MINOR only)
- [ ] CHANGES REQUESTED (MAJOR present)
- [ ] REJECTED (BLOCKING present)

## Board Update
- acceptance_criteria <ID> → done (evidence: <the test that proves it>)   # only ACs proven by a real test
- feature <id> → correctness verdict: <verdict>
```

## Rules

- **Assume wrong, prove it** — show the paths traced and edge cases tried; "looks correct" is not a review
- **Derive expectations from the spec**, never from the implementation under review
- **Every AC needs a real, asserting test** — vacuous / tautological / fully-mocked tests count as no test
- **User-facing feature with no E2E test of the workflow = BLOCKING**
- **A bug fix with no failing-first regression test = MAJOR** (the fix is unproven)
- **You are the checker, not the doer** — report findings and the tests that must exist; never edit the code
- **Emit the proof line** with real counts, or the conductor rejects the review and re-spawns you
