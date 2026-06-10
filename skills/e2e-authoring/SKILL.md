---
name: e2e-authoring
description: Author end-to-end tests that drive the real user flow — runs AFTER the feature is written. Map each acceptance criterion to an asserting flow against the real entry point (URL/CLI/API), scaffold the E2E harness (e.g. Playwright) when the project has none, cover happy + error + edge, and never stub the workflow. Use whenever a user-facing feature needs an E2E test of its real workflow, or to (re)author E2E after a fix to confirm nothing broke. This skill is rigid — its rules must be followed, not negotiated.
---

# E2E Authoring — Prove the User's Workflow

From walkinglabs Lecture 10: *Why End-to-End Testing Changes Results*. Unit tests can all pass while the assembled program is broken in real use. This skill is how you write the test that catches that — an end-to-end test that drives the **real entry point** and asserts the **user-visible outcome** of the spec's workflow.

It is invoked by the `executor` agent (the e2e / verify step) and applies the **Layer 3** definition from `harness-engineering-verify`. It runs **after** the feature code is written, when the real entry points exist.

## The Iron Rule

**Drive the real entry point. Never stub the workflow.**

An E2E test that mocks away the unit under test, asserts a tautology, or only checks "no exception" is **not** an E2E test — it proves nothing and counts as no coverage. The test must reach the system the way a user does (a URL, a CLI command, an API call) and assert what the user would observe.

## When to use

- A user-facing feature was built — the executor authors its user-flow E2E before verifying.
- A fix landed (the generator fix loop) — **re-author/extend** the E2E for the changed behavior and add an E2E regression flow if the bug was user-visible, so the full re-run confirms nothing broke.
- The project has no E2E harness yet — scaffold the minimal one for its stack as part of the first user-facing feature.

## The Protocol

### 1. Reconstruct the user flow from the spec — not the code

Read `specs/<feature-id>.md`. The **user-visible behavior** and each **acceptance criterion** are the flows you must assert. Derive expectations from the spec, never from the implementation you are testing.

### 2. Find the real entry point

The URL, route, CLI command, or API endpoint a real user hits. Read the generator's handoff for what was built and where it is wired.

### 3. Scaffold the harness if the project has none

Create the minimal E2E setup for the project's stack, once:

| Stack | Minimal scaffold | Run command |
|-------|------------------|-------------|
| Web UI | `playwright.config.*` + `tests/e2e/` | `npx playwright test` |
| HTTP API (Node) | supertest / the framework's test client | `npm run test:e2e` |
| Python service | a `pytest` `e2e` marker + a client/driver fixture | `pytest -m e2e` |
| CLI | spawn the built binary, assert stdout/exit code | the project's e2e target |
| Rust | a `tests/` integration dir driving the real binary | `cargo test` |

Default to **Playwright** for anything with a browser-driven UI.

### 4. Author one asserting flow per acceptance criterion

For each AC, write a flow that drives the real entry point, performs the user's steps, and **asserts the visible outcome**. Name the test after the behavior it proves. Keep flows independent.

### 5. Cover errors and edges from the spec

Not just the happy path — the spec's Error Cases and Edge Cases tables become E2E flows too (invalid input, the empty/boundary case, the failure the user can trigger).

### 6. Tests and test config only

Never modify feature logic to make a flow pass. If a flow cannot be written because the feature is wrong or exposes no hook for it, that is a **finding** that fails verification (back to the generator) — surface it, do not patch the feature.

## The AC ↔ Flow Map

Every acceptance criterion maps to a named flow (or a finding):

```
AC1 → tests/e2e/checkout.spec.ts :: "completes checkout and shows confirmation" — asserts the confirmation page
AC2 → tests/e2e/checkout.spec.ts :: "rejects an empty cart with an error banner"
AC3 → (no flow yet — feature exposes no order-status route) → FINDING
```

## Proof line (mandatory)

The agent invoking this skill (the `executor`) must begin its report with:

```
e2e-authoring invoked: YES — stack: <playwright|pytest-e2e|supertest|…>, flows covered: N, ACs asserted: X/Y
```

The counts must be real. `flows covered: 0` or `ACs asserted: 0/Y` is rejected and the agent is re-spawned.

## Write E2E every time

E2E authoring is not a one-shot up-front step. It runs on **every pipeline pass** and is **re-run after every fix**:

- The executor authors it against the just-built feature (in the worktree).
- After each heal-loop fix and each review-fix, re-author/extend the affected flows, then the executor re-runs the **full** unit + E2E suite.

This is what makes "the fix didn't break anything" a verified fact instead of a hope.

## Completion checklist

```
E2E AUTHORING DONE — all must be TRUE:
1. The test drives the REAL entry point (URL/CLI/API), not a stub      → name it
2. Every acceptance criterion maps to a named asserting flow           → AC↔flow map
3. The spec's error + edge cases each have a flow                      → list them
4. The harness was scaffolded if the project had none                 → files added
5. No feature logic was modified — tests + config only                → confirm
6. The proof line is emitted with real counts                         → e2e-authoring invoked: YES …
```

If any item is FALSE, you are not done.
