---
name: doc-e2e-cases
description: Author or update e2e_testcases.md — the agent-facing, tests-first E2E case list (Markdown, Given/When/Then). Owns the case structure, the one-case-per-acceptance-criterion rule, happy/error/edge coverage, and a readability gate. Seeded by harness-engineering-grill during the interview (tests-first), then extended by the verify agent at Phase E (which thinks of cases grill missed, implements them all, and writes its discoveries back here). Read by the reviewer for coverage. Agent-facing .md. This skill is rigid — follow the form exactly.
---

# doc-e2e-cases — the `e2e_testcases.md` format authority

`e2e_testcases.md` turns every acceptance criterion into a concrete **Given / When / Then** test case **before code is written**, so the build aims at a fixed target from line one (fewer correctness loops later). Agent-facing Markdown. One file per feature.

It is **prose test cases, not test code.** The **verify agent** implements these (and any it discovers) against the real entry point; the **reviewer** checks that every case is covered by a real, asserting test.

## Two writers — a round-trip (this doc is living, not one-shot)

1. **Grill seeds it (Phase A):** one Given/When/Then case per acceptance criterion, written *before* code.
2. **The verify agent completes it (Phase E):** it starts from these cases but **thinks for itself** — adding
   the edge/error and **cross-feature integration** cases grill couldn't foresee — implements them all, then
   **writes the new cases back here.** After a wave, `e2e_testcases.md` is the *complete* record of what's
   tested, not just grill's first guess.

Grill and the verify agent write at different phases (never concurrently), so there is no write conflict.

## Cheat sheet — canonical structure

```markdown
# E2E Test Cases — <Feature Title>

> One case per acceptance criterion (AC). Written BEFORE code. Every case drives the REAL
> entry point (URL / CLI / API) and asserts an observable outcome — never a stub.

## TC-AC1: <criterion title>
- **Maps to:** specs.md AC1
- **Type:** happy            <!-- happy | error | edge -->
- **Entry point:** <the real URL / CLI command / API endpoint the user hits>
- **Given** <starting state / preconditions / fixture data>
- **When** <the single user action>
- **Then** <the observable outcome the test must assert — concrete, not "it works">

## TC-AC2: <criterion title>
- **Maps to:** specs.md AC2
- **Type:** error
- **Entry point:** …
- **Given** …
- **When** <the failure trigger>
- **Then** <the exact error the user sees / the safe failure behavior>

## TC-AC3 (edge): …
```

## Coverage rule
- **Every** acceptance criterion in `specs.md` has at least one `TC-ACn` here (1:1, by id).
- Cover the spec's **happy path AND its error cases AND its boundary/edge cases** — one `Type` each. A feature with only happy-path cases is under-specified.
- Each case names the **real entry point** — if you can't name one, the behavior isn't user-observable and the AC needs sharpening (send it back to the grill).

## Cross-links
- `Maps to:` points back to the AC in `specs.md` (owned by `tiger-skills:doc-spec`).
- The **verify agent** (Phase E, via `tiger-skills:e2e-authoring`) implements each case and appends any it discovers; the **reviewer** treats a missing test for a user-facing AC as **BLOCKING**.

## Readability gate — test the form before calling it done
- [ ] Every `specs.md` AC has a matching `TC-ACn` (count them — must be equal).
- [ ] Each case has Given / When / Then, all concrete (no "works", "correct", "fast").
- [ ] Each case names a real entry point.
- [ ] Happy, error, and edge types are all represented.
- [ ] A test engineer could implement each case without asking a question.
