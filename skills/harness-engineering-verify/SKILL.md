---
name: harness-engineering-verify
description: Verification before completion — the Iron Law is to never claim completion without fresh verification evidence from THIS session. Run the layered pipeline (static → unit → E2E), record evidence, pass the completion gate. Use before claiming ANY work is done.
---

# Verification — Evidence Before Claims

From walkinglabs Lectures 09, 10, and 11: *Why Agents Declare Victory Too Early*, *Why End-to-End Testing Changes Results*, *Why Observability Belongs Inside the Harness*.

> The gap between the agent's confidence in its output and actual correctness is the most common failure mode. — walkinglabs, Lecture 09

## The Iron Law

**Never claim completion without fresh verification evidence from THIS session.**

Stop words — if you think these, you are about to violate the Iron Law:
- "Should work" → test it
- "Probably fine" → verify it
- "Looks correct" → run it
- "Essentially done" → not done
- "The tests should pass" → run them and find out

## The Verification Protocol

### 1. IDENTIFY — What command proves this?

Before claiming anything, identify the EXACT command that proves your claim. Not a category ("the tests") — the specific command with arguments.

```
Claim: "Feature search-001 is complete"
Command: pytest tests/ -x -k "test_search" && ruff check src/ && mypy src/ --strict
```

### 2. RUN — Execute the FULL command

Run it fresh. This session. After the last code change. No caching. No "I ran it 5 minutes ago." The command output must be from NOW.

### 3. READ — Examine the output

Read the complete output. Check exit code. Count failures. Do NOT skim. Do NOT assume "zero errors" because the last line says "done."

### 4. VERIFY — Does output confirm the claim?

Does the output actually prove what you're claiming? "0 errors, 47 passed" proves tests pass. "0 errors, 46 passed" proves something is broken. "Build succeeded" does NOT prove tests passed.

### 5. RECORD — Save evidence

Record the output. Paste it into feature_list.json evidence array. Reference the commit hash. Evidence that only exists in your context window doesn't exist for the next session.

## The Layered Pipeline

Run in strict sequence. Never skip. Never reorder. Never proceed if a layer fails.

### Layer 1 — Static Analysis

```
Python:     ruff check src/ && mypy src/ --strict
Rust:       cargo clippy -- -D warnings
TypeScript: tsc --noEmit && eslint src/
```

**Gate:** Zero errors. Warnings are errors. Do not proceed to Layer 2 with lint failures.

### Layer 2 — Unit + Integration Tests

```
Python:     pytest tests/ -x -v
Rust:       cargo test
TypeScript: vitest run
```

**Gate:** All tests pass. Use `-x` (fail-fast) **only while iterating** — the completion / post-fix run MUST be the **full suite with no early stop**, so a change that breaks a test *elsewhere* is visible. Catching that regression is the whole point: fixing one thing must not silently break another.

### Layer 3 — End-to-End / Smoke (the layer that catches real-use bugs)

```
pytest tests/ -x -m e2e
curl http://localhost:3000/api/health
npm run test:e2e
playwright test
```

An E2E test drives the **real entry point** and asserts the **user-visible outcome** of the workflow in the spec — not a stubbed-out version of it. This is the layer that catches "passed its unit tests but is buggy when I actually run it."

**Mandatory for:** any change with **user-visible behavior** — new/changed feature, API, endpoint, CLI command, user workflow, cross-component change, DB schema, config. If the user can observe it, an E2E test of that workflow is required, and a user-facing feature that ships without one is **not done**.
**Optional for:** pure-internal refactors (the existing suite is the regression guard), typos, doc/comment changes.
**Bug fixes:** ship a **regression test that fails without the fix and passes with it** — prefer an E2E test when the bug was user-visible.

## The Completion Gate

ALL must be TRUE before claiming done:

```
COMPLETION GATE:
1. Layer 1 ran THIS session, AFTER last code change       → paste output
2. Layer 2 ran THIS session — FULL suite, no early stop   → paste output
3. Layer 3 (E2E) ran THIS session — mandatory for any     → paste output
   user-visible behavior; a user-facing feature with no
   E2E test of its workflow is NOT done
4. Every acceptance criterion has a real, asserting test  → name the test per AC
5. Every output shows ZERO failures                       → no "expected failures"
6. Evidence recorded in feature_list.json                 → with commit hash
```

If ANY item is FALSE or UNKNOWN, you are NOT done. A vacuous test (asserts a tautology, only "no exception", or mocks away the unit under test) does not satisfy item 4 — it counts as no test.

## Rationalization Prevention

From walkinglabs Lecture 09. Agents rationalize skipping verification. The most common rationalizations and why they're wrong:

| Rationalization | Reality |
|----------------|---------|
| "It's just a small change" | Small changes break things. The smaller the change, the faster the verification. |
| "I already tested this manually" | Manual testing is not repeatable. The next session can't verify it. |
| "The CI will catch it" | CI is for catching issues BEFORE they affect others, not after. |
| "I'm confident it works" | Confidence is not correctness. Anthropic: agents "confidently praise their own work." |
| "I don't have time" | You don't have time NOT to verify. Unverified code breaks later and costs more to fix. |
| "The tests are slow" | Slow tests are better than broken code. Fix slow tests as a separate task. |

## Context Anxiety

Anthropic observed: when agents sense context running low, they rush, skip verification, declare done. **Don't.** If context is running low:
1. Commit what you have (working state)
2. Update progress.md with what remains
3. Let the next session continue
4. Do NOT skip verification to "finish faster"

## Evidence Format

Record in `feature_list.json` evidence array:

```json
"evidence": [
  "Layer 1: ruff 0 errors, mypy clean — commit abc1234, 2026-06-01 14:30 UTC",
  "Layer 2: pytest 47/47 passed in 12.34s — commit abc1234, 2026-06-01 14:31 UTC",
  "Layer 3: e2e 8/8 passed in 45.67s — commit abc1234, 2026-06-01 14:32 UTC"
]
```

Evidence includes: which layer, result, commit hash, timestamp. A future session (or reviewer) can verify these claims independently.
