---
name: doc-spec
description: Author or update specs.md — the agent-facing feature specification (Markdown). Owns the canonical structure (problem, behavior, constraints, acceptance criteria, scope/dependencies) and a readability gate. Invoked by harness-engineering-grill when crystallizing a spec, and by any agent that reads or amends one. Agent-facing .md — keep it lean and scannable. This skill is rigid — follow the form exactly.
---

# doc-spec — the `specs.md` format authority

`specs.md` is the **agent-facing** contract for ONE feature: Markdown, read on every pipeline run, so keep it scannable and decoration-free. It is the **output** of the grill, never its input — write it only when every discovery dimension has closed.

One file per feature: `specs/<feature-id>.md`.

## Cheat sheet — canonical structure

```markdown
# Spec: <Feature Title>

**Feature ID:** <kebab-case-id>
**Status:** `awaiting_review`   <!-- only grill flips this to `approved`, only after a human says yes -->
**Grilled on:** YYYY-MM-DD
**Approved by:** `pending`

## Problem Statement
[One sentence: who needs what, and why.]

## User Stories
- As a [role], I want [action] so that [outcome].

## Behavior
### Happy Path
1. [User action] → [System response]
2. … → **Success: [outcome]**

### Error Cases
| Trigger | Response |
|---|---|
| [condition] | [what the user sees] |

### Edge Cases
| Scenario | Behavior |
|---|---|
| Empty / first use | … |
| Boundary (min/max) | … |
| Permission denied | … |
| Concurrency | … |

## Constraints
- **Must not break:** …
- **Performance:** … (concrete numbers — no "fast")
- **Environment:** …
- **Dependencies:** …
- **Patterns to follow:** …

## Key Decisions
| # | Decision | Chosen | ADR |
|---|---|---|---|
| 1 | [topic] | [choice] | adr.md#ADR-001 |
<!-- every non-trivial decision links to its ADR (see doc-adr) -->

## Acceptance Criteria
| AC | Criterion | E2E case |
|---|---|---|
| AC1 | [behavior] | e2e_testcases.md#AC1 |
<!-- each AC maps 1:1 to a Given/When/Then case (see doc-e2e-cases) -->

## Scope & Dependencies   <!-- POWERS PARALLEL BUILD -->
- **File footprint (rough):** `path/a`, `path/b`  <!-- mirrored to feature_list.json files[] -->
- **depends_on:** [feature ids that must be `passing` first]
- **blocks:** [feature ids this unblocks]

## Out of Scope (Explicitly)
- [deferred or excluded]

## Open Questions
- [must be empty — or have a resolution plan — before approval]
```

## The fields that power parallel build

**Scope & Dependencies is not optional.** Its file footprint + `depends_on` are mirrored into `feature_list.json` (`files[]` / `depends_on`) and are exactly what lets the scheduler run features concurrently **without worktrees**. Rule: when unsure whether a file is touched, **list it** — over-listing only serializes a feature into a later wave; under-listing risks two generators colliding on one file.

## Cross-links (single source of truth)
- **Key Decisions** → each row links to its record in `adr.md` (owned by `tiger-skills:doc-adr`).
- **Acceptance Criteria** → each AC maps 1:1 to a Given/When/Then case in `e2e_testcases.md` (owned by `tiger-skills:doc-e2e-cases`).

## Readability gate — test the form before calling it done
- [ ] Problem fits in one sentence.
- [ ] Every happy-path step is concrete (no "fast", "nice", "works with").
- [ ] Every user action has a defined error response.
- [ ] Every AC has an E2E case link; every Key Decision has an ADR link.
- [ ] Scope & Dependencies lists a file footprint and `depends_on`.
- [ ] Open Questions is empty or each has a resolution plan.
- [ ] A teammate who never saw the feature could build to this spec.
