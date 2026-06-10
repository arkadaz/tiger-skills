---
name: doc-adr
description: Author or append to adr.md — the agent-facing Architecture Decision Record log (Markdown, Michael Nygard format). Owns the ADR structure (Context / Decision / Consequences), the test for when a decision deserves an ADR, and a readability gate. Invoked by harness-engineering-grill when a decision crystallizes, and by code-architect/generator that read decisions. Agent-facing .md. This skill is rigid — follow the form exactly.
---

# doc-adr — the `adr.md` format authority

`adr.md` captures **why** the non-obvious choices were made, so the architect and generator inherit the reasoning instead of re-deriving (or silently overturning) it. Agent-facing Markdown. One `adr.md` per feature, holding a numbered list of ADRs (ADR-001, ADR-002, …). Format: **Michael Nygard's lightweight ADR** — one to two screens each.

Pocock's rule applies: **append an ADR only when a decision crystallizes during the grill** — capture it the moment it's made, don't batch them at the end.

## When a decision deserves an ADR (all three must hold)

1. **Hard to reverse** — meaningful cost to change course later.
2. **Surprising without context** — a future reader would ask "why on earth did they do that?"
3. **Result of a trade-off** — genuine alternatives existed.

If **any** of the three is missing, **skip the ADR** — record it as a one-line row in the spec's Key Decisions table instead. ADRs are for the choices worth a paragraph of "why", not every fork.

## Cheat sheet — canonical structure (Nygard)

```markdown
# Architecture Decisions — <Feature Title>

> One record per non-trivial, hard-to-reverse decision. Newest at the bottom.

## ADR-001: <short imperative title of the decision>

- **Status:** accepted   <!-- proposed | accepted | deprecated | superseded by ADR-0NN -->
- **Date:** YYYY-MM-DD

### Context
[The forces at play: the constraint, the conflict, the facts that made a decision necessary.
Neutral — describe the situation, not the answer.]

### Decision
[The choice, stated in active voice: "We will …". Name the alternatives considered and why
they lost in one line each.]

### Consequences
[What becomes easier AND what becomes harder. List the negative consequences too —
an ADR with only upsides is hiding something.]

---

## ADR-002: <next decision>
…
```

## Cross-links
- The spec's **Key Decisions** table (see `tiger-skills:doc-spec`) links each row to its `ADR-0NN` here.
- A later decision that overturns an earlier one sets the old ADR's status to `superseded by ADR-0NN` — never delete an ADR; supersede it (the history is the value).

## Readability gate — test the form before calling it done
- [ ] Each ADR meets all three triggers (hard-to-reverse ∧ surprising ∧ trade-off).
- [ ] Context is neutral and states the forces, not the answer.
- [ ] Decision is one active-voice sentence and names the rejected alternatives.
- [ ] Consequences list at least one downside.
- [ ] Each ADR fits on one to two screens.
- [ ] Every spec Key-Decision link resolves to a real ADR id here.
