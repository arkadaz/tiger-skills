---
name: tiger-code-quality
description: The 16 design principles for well-built code — Single Responsibility, Open-Closed, Liskov Substitution, DRY, Encapsulate What Varies, Code to the Interface, Favor Composition over Inheritance, Factory, Delegation, Least Knowledge / Law of Demeter, Least Astonishment, Precondition, Postcondition, Class Invariant, Lazy Evaluation. Use whenever designing components, writing or refactoring code, or reviewing a diff for design quality — or when asked "is this well designed", "review the design", "does this follow SOLID", "code smell", or any principle by name. A self-contained reference; invoke directly or load as a skill.
---

# Code Quality — 16 design principles

Read-only reference loaded by architect, code-generator, and reviewer. Apply as a review checklist: cite principle + file:line for each confirmed smell.

## When to use

Load when designing, writing/refactoring, or reviewing. Standalone: "review this for code quality", "does this follow Liskov?". No pipeline stage of its own.

## Contract

A principle is binding only when it applies — cite it when it bites, mark N/A when it doesn't. Over-applying is itself a smell (Least Astonishment / needless complexity). Severity guide: Class Invariant / Liskov violations → *major*; leaked internals / duplicated rules → *major* or *minor* by blast radius; DRY nit → *minor*. When two principles conflict, pick the one that serves the reader and note the trade-off. Report only when you can point to file:line — not on stylistic hunch.

### Structure & responsibility

| Principle | Smell → Fix |
|---|---|
| **Single Responsibility** | "and" in honest name; god class → one reason-to-change per unit; split parsing/IO/logic. |
| **DRY** | Copy-pasted blocks that drift; same constant in two places → extract at the third repetition; one source of truth per fact. |
| **Encapsulate What Varies** | `switch`/`if`-ladder on a type repeated across files → put the volatile decision behind one seam. |
| **Least Knowledge** *(Law of Demeter)* | Train-wreck chains (`a.getB().getC().doIt()`) → talk to immediate collaborators only; expose intent, not structure. |
| **Least Astonishment** | Method does more than its name says; "getter" mutates state → name for what it does; no hidden side effects. |

### Polymorphism & relationships

| Principle | Smell → Fix |
|---|---|
| **Code to the Interface** | Callers `new`-ing concretes everywhere; `instanceof`/type-switch where a virtual call belongs → depend on abstract type; inject concrete at the edge. |
| **Open-Closed** | Every new requirement edits the same core function; growing `if/elif` chain → add a subclass/strategy, not an edit. |
| **Liskov Substitution** | Override throws `NotImplemented`; subclass needs special-casing; `if type(x) == Sub` guards → subclass honors superclass contract fully. |
| **Favor Composition** | Deep inheritance trees; inheriting mostly to reuse one method → compose swappable strategies instead of "is-a". |
| **Delegation** | Class doing a neighbor's job badly; logic duplicated from another type → hold a collaborator and forward. |
| **Factory** | Scattered `new ConcreteThing(...)` across call sites; drifting construction logic → centralize creation behind one creator. |

### Contracts & state

| Principle | Smell → Fix |
|---|---|
| **Precondition** | Function silently misbehaves on bad input; undocumented assumption → state and check requirements; fail fast. |
| **Postcondition** | Return contract implied but untested; callers re-checking result defensively → guarantee and test the promise at the boundary. |
| **Class Invariant** | Public setter can produce illegal state; invariant "by convention" only → establish in constructor; every mutator preserves it. |
| **Lazy Evaluation** | Eagerly computing something often discarded; recomputing in a loop → defer/memoize costly work until first use. |

## Works with

Loaded by architect (planning), code-generator (build), and reviewer (audit). No pipeline position of its own — a reference, not a stage.

## Git interactions

None. Read-only reference — no commits, no git notes, no file writes.

## Standalone use

Invoke directly to review a diff or design against the 16 principles. Reports only — writes nothing, commits nothing, owns no subagent.

## References

- SOLID: https://en.wikipedia.org/wiki/SOLID
- Law of Demeter: https://en.wikipedia.org/wiki/Law_of_Demeter
- Design by Contract: https://en.wikipedia.org/wiki/Design_by_contract
