# Verification Pipeline

From walkinglabs Lectures 09, 10, and 11: *Why Agents Declare Victory Too Early*, *Why End-to-End Testing Changes Results*, *Why Observability Belongs Inside the Harness*.

> The gap between the agent's confidence in its output and actual correctness is the most common failure mode. — walkinglabs, Lecture 09

## The Iron Law

**Never claim completion without fresh verification evidence from THIS session.**

Agents "confidently praise their own work" (Anthropic). The only defense: verification commands that run fresh, produce pass/fail output, and are recorded as evidence.

Red flags — if you think these, STOP:
- "Should work" → test it
- "Probably fine" → verify it
- "Looks correct" → run it
- "Essentially done" → not done
- "The code is right" → the code is right when verification says so

## The Layered Verification Pipeline

Run in strict sequence. Never proceed if a layer fails.

### Layer 1 — Static Analysis

Catches type errors, lint violations, and structural issues before any code executes.

```
Python:  ruff check src/ && mypy src/ --strict
Rust:    cargo clippy -- -D warnings && cargo fmt --check
TypeScript:  tsc --noEmit && eslint src/
```

**Gate:** Zero errors. Warnings are errors.

### Layer 2 — Unit + Integration Tests

Proves individual components work and integrate correctly.

```
Python:  pytest tests/ -x -v
Rust:    cargo test
TypeScript:  vitest run
```

**Gate:** All tests pass. `-x` (fail-fast) recommended — no point running 200 tests if test #3 fails.

### Layer 3 — End-to-End / Smoke Test

Proves the system works from the user's perspective. Required for cross-component changes.

```
pytest tests/ -x -m e2e
curl http://localhost:3000/api/health
npm run test:e2e
```

**Gate:** E2E passes. Skip only if the change is truly single-component (e.g., fixing a typo in a docstring).

## The Completion Gate

ALL must be TRUE before claiming done:

```
COMPLETION GATE — all must be TRUE:
1. Layer 1 ran THIS session, AFTER last code change    → paste output
2. Layer 2 ran THIS session, AFTER last code change    → paste output
3. Layer 3 ran THIS session (if required)              → paste output
4. Every output shows ZERO failures                    → no "expected failures"
5. Evidence is recorded in feature_list.json           → with file path or paste
```

If ANY item is FALSE, you are NOT done.

## Evidence Recording

Evidence is not "I ran the tests and they passed." Evidence is:

```
Layer 1: ruff check src/ — 0 errors, 0 warnings
         mypy src/ --strict — Success: no issues found
Layer 2: pytest tests/ -x -v — 47 passed, 0 failed in 12.34s
Layer 3: pytest tests/ -x -m e2e — 8 passed, 0 failed in 45.67s
```

Record evidence in `feature_list.json`:
```json
{
  "id": "feature-001",
  "status": "passing",
  "evidence": [
    "Layer 1: ruff clean, mypy clean (2026-06-01)",
    "Layer 2: pytest 47/47 passing (2026-06-01)",
    "Layer 3: e2e 8/8 passing (2026-06-01)"
  ]
}
```

## Context Anxiety

From walkinglabs Lecture 09. Anthropic observed that when agents sense their context window running low, they:
- Rush to finish
- Skip verification
- Choose simpler solutions over optimal ones
- Declare completion without evidence

**The fix:** Verification is NOT optional. It is part of definition of done. If context is running low, the agent should commit what it has, record what remains, and let the next session continue — not rush and skip verification.

## Why End-to-End Testing Matters

From walkinglabs Lecture 10. Component tests can all pass while the system is broken:
- Migration wasn't run → tests pass (they use fresh DB), but app fails (real DB is stale)
- API contract mismatch → unit tests pass (mocked), but integration fails
- Config change → services test fine in isolation, but together they conflict

Only a full-pipeline run (Layer 3) catches these. For any change that touches multiple components, Layer 3 is NOT optional.

## Observability Inside the Harness

From walkinglabs Lecture 11. "If you can't see what the agent did, you can't fix what it broke."

The harness must make agent actions observable:
- **Commit history** — what changed, when, by whom
- **Verification output** — recorded as evidence, not ephemeral terminal output
- **State files** — updated after every session, showing progression
- **Diagnostic logs** — when something fails, record the full output

A session that produces code but leaves no observable trail is indistinguishable from a session that produced nothing.
