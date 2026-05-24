# Implementation Workflow

The full 14-step flow that every feature follows. Do not skip steps. Do not reorder.

## Normal Flow (per feature)

1. **Clock in** — read PROGRESS.md, DECISIONS.md, `docs/codebase-map.md`, `docs/GRAPH.md`. Run `make check`. Understand the current state and code flow BEFORE touching anything.
2. **Clarify** — if ANY aspect of the task is ambiguous (scope, I/O, files to touch, verification criteria), ask the user before proceeding. A 30-second clarification prevents a 30-minute wrong implementation.
3. **Mark feature active** — update PROGRESS.md. WIP=1: only one feature active at a time.
4. **Explore codebase** — read `docs/GRAPH.md` for the relevant flow, `docs/business/*.md` for domain rules, search for overlapping existing code with Grep/Glob.
5. **Write spec** — create `docs/specs/YYYY-MM-DD-<topic>.md`. Present to user for approval if non-trivial. Do NOT write code until spec is approved.
6. **Implement** — write the code. `→ apply code-quality`: load [code-quality](../../code-quality/SKILL.md) and follow all rules (Pydantic, logging, enums, types, no water, SRP, etc.).
7. **Layer 1 verify** — `ruff check` + `mypy --strict`. Fix all issues.
8. **Layer 2 verify** — `pytest tests/ -x`. All tests must pass.
9. **Layer 3 verify** — if cross-component changes, run E2E tests or manual smoke test.
10. **Two-stage review** — Run BOTH stages before accepting any feature as complete:
    - **Stage 1 — Spec compliance:** Does the implementation match the spec? All behaviors (happy + error), all types/fields, no scope creep, verification command ran and passed.
    - **Stage 2 — Code quality:** `→ apply code-quality`: per [review-agent.md](../../code-quality/references/review-agent.md), spawn an independent agent to audit the diff against all 19 audit items.
    - Both stages must pass. Spec compliance without quality = tech debt. Quality without spec compliance = wrong feature.
11. **Address review findings** — fix every MAJOR and BLOCKING finding from BOTH review stages. Re-run verification after fixes.
12. **Record evidence** — save verification output, update feature state to `passing`.
13. **Update docs** — update the spec with actual outcome, update `docs/GRAPH.md` with new/changed flows, update `docs/business/*.md` if rules changed, update `docs/codebase-map.md` if files changed, update AGENTS.md if conventions changed.
14. **Commit and clock out** — atomic commit with clean message. Session exit checklist. Update PROGRESS.md.

## What to Read Before Implementing

See [session-discipline.md](session-discipline.md) clock-in sequence. Minimum: PROGRESS.md -> DECISIONS.md -> codebase-map.md -> GRAPH.md -> business docs -> AGENTS.md.

## What to Update After Implementing

See [doc-first.md](doc-first.md) after-implementation checklist. Minimum: GRAPH.md -> codebase-map.md -> PROGRESS.md -> AGENTS.md.

## Diagnostic Loop (when something fails)

Never guess. Never blindly retry. Apply the diagnostic loop:

1. **What failed?** — exact error message, expected vs actual
2. **Which layer?** — one of: spec / context / environment / verification / state
3. **What's the fix?** — specific to the layer
4. **Apply the fix to the harness** — so this class of failure never happens again
5. **Retry** — run verification again from layer 1

### Layer-Specific Fixes

| Layer | Example Failure | Fix |
|-------|----------------|-----|
| **Spec** | "I built X but you wanted Y" | Clarify the feature spec. Add detail. Ask before implementing. |
| **Context** | "I used raw SQL because I didn't know about SQLAlchemy rule" | Add the rule to AGENTS.md hard constraints. |
| **Environment** | "Module not found: pydantic" | Fix dependency in pyproject.toml. Add to make setup. |
| **Verification** | "Tests pass but E2E fails because DB migration wasn't run" | Add migration step to make check. Add migration test. |
| **State** | "I re-implemented a feature that was already done" | Update PROGRESS.md more clearly. Read it at clock-in. |

## Anti-Patterns

These behaviors are FORBIDDEN. They cause the majority of agent failures:

### Implementation Anti-Patterns

- **"I'll just start coding and figure it out"** — Spec first, code second. Always.
- **"The requirements are clear enough"** — If not 100% sure, ask. Guessing is wrong.
- **"I'll document it later"** — Update docs in the same session. "Later" never comes.
- **"Let me also refactor X while I'm here"** — WIP=1. Stay on task. Refactoring is its own feature.
- **"This is a simple change, I don't need to read GRAPH.md"** — Every change has context. Read the graph.
- **"I'll stub this out and implement it later"** — No placeholders. No `pass`. No `todo!()`. No `raise NotImplementedError`. Every function is complete or it doesn't exist yet.
- **"Let me add the interface now and implement later"** — An interface without an implementation is a placeholder with extra steps. Implement now or defer the entire task.

### Verification Anti-Patterns

- **"Tests pass on my machine"** — Verification must be reproducible with `make check`.
- **"The code looks right"** — Verification passes or it's not done. No judgment calls.
- **"I'll fix the lint later"** — Layer 1 is always required. Fix it now.
- **"The failing test is probably unrelated"** — Investigate. Fix. Or document as known issue.
- **"It should work"** — "Should" is not evidence. Run the verification.
- **"No functional change"** — Then the tests will pass. Run them. Prove it.
- **"This is trivial"** — Trivial changes take 10 seconds to verify. Do it.
- **"I'm confident"** — Confidence is the feeling you get right before you're wrong. Run the tests.

### State Anti-Patterns

- **"I'll update PROGRESS.md next session"** — State decays. Update now.
- **"I don't need to read DECISIONS.md, I know what I'm doing"** — Past decisions exist for a reason.
- **Starting a new feature before current reaches `passing`** — WIP=1. Finish first.
- **Committing without running `make check`** — Broken commits cascade into broken sessions.

### Documentation Anti-Patterns

- **"I'll update GRAPH.md after the next feature too"** — Update it now while the flow is fresh in mind.
- **"The code is self-documenting"** — Code shows WHAT. GRAPH.md shows HOW IT CONNECTS. Business docs show WHY.
- **"Nobody reads the docs anyway"** — Agents read them. Every session. That's the point.

## Harness Initialization (New Projects)

Before ANY implementation on a new project, dedicate one session to harness setup. Do NOT mix init and implementation.

### Bootstrap Contract

After initialization, a fresh agent session must be able to:
1. **Start:** `make setup` works from a completely fresh clone
2. **Test:** At least one example test passes (proving the test framework is configured)
3. **See progress:** `PROGRESS.md` exists with task breakdown (≥3 tasks in triple structure)
4. **Pick up:** Clear next action in PROGRESS.md — no ambiguity

### Initialization Deliverables

Create these files in the init session:

1. **`AGENTS.md`** — Router: project overview, quick start, hard constraints, topic doc links
2. **`Makefile`** — Targets: `setup`, `test`, `lint`, `check`, `dev`, `clean`
3. **`PROGRESS.md`** — With initial task breakdown (≥3 tasks, each with triple structure)
4. **`DECISIONS.md`** — Empty template, ready for first decision
5. **`docs/GRAPH.md`** — Empty template, ready for first code flow
6. **`docs/codebase-map.md`** — Directory overview (even if mostly empty)
7. **`docs/features.md`** — Feature list with triple structure
8. **`docs/business/`** — Empty directory, ready for business rule docs
9. **`docs/specs/`** — Empty directory, ready for per-feature specs
10. **`docs/reviews/`** — Empty directory, ready for review reports
11. **`.env.example`** — All required env vars documented (no real values)
12. **Initial git commit** — Everything above, committed with message "Initialize project harness"

### Init Acceptance Checklist
```
- [ ] make setup succeeds from clean clone
- [ ] make test has ≥1 passing example test
- [ ] make check runs and reports pass (even if minimal)
- [ ] AGENTS.md answers all five entry-file questions
- [ ] PROGRESS.md has ≥3 tasks with triple structure
- [ ] GRAPH.md template exists
- [ ] codebase-map.md exists
- [ ] .env.example has all required env vars
- [ ] Everything committed
```
