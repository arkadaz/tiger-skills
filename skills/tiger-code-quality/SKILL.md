---
name: tiger-code-quality
description: The build discipline for the Tiger loop in ONE reference — the design principles for well-built code (Single Responsibility, Open-Closed, Liskov, DRY, Encapsulate What Varies, Code to the Interface, Composition over Inheritance, Factory, Delegation, Least Knowledge, Least Astonishment, Pre/Postcondition, Class Invariant, Lazy Evaluation, No Comments) plus the SIMPLIFY pass, the WRITE-LESS lazy-senior ladder (YAGNI → repo util → stdlib → native platform → installed dep → one line → minimal) with the delete-list audit, and the SAY-LESS terse-handoff style for agent-to-agent messages (fragments, no filler; code/paths/commands kept EXACT). Absorbs the former tiger-caveman and tiger-ponytail skills. Loaded by tiger-lead, tiger-code-generator, tiger-researcher, and tiger-review. Use whenever designing, writing, refactoring, or reviewing code, writing an in-loop handoff/packet/report, or when asked about SOLID, code smells, "make it lazy", or "make it terse".
---

# Code Quality — design well · write less · say less

Read-only reference loaded by the loop agents (lead, code-generator, researcher, review). Three disciplines, one economy: well-designed code, the least of it, described in the fewest tokens. **None of the three ever cuts safety or rigor** — the Iron Law (no claim without fresh evidence), acceptance checks, trust-boundary validation, error handling, security/authz, accessibility, and spec-required behavior always bind.

## A. Design principles (apply as a checklist; cite principle + file:line)

A principle is binding only when it applies — cite it when it bites, mark N/A when it doesn't. Over-applying is itself a smell. Severity: Class Invariant / Liskov violations → *major*; leaked internals / duplicated rules → *major* or *minor* by blast radius; DRY nit → *minor*. When two principles conflict, pick the one that serves the reader and note the trade-off. Report only at file:line — never on stylistic hunch.

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

### Simplicity & clarity

| Principle | Smell → Fix |
|---|---|
| **No comments — names and structure carry meaning** | Any comment in generated code (`#`, `//`, block, narration docstring) → delete it; rename the symbol or extract a well-named function. Only a shebang or a required lint/type pragma may remain. |

**The SIMPLIFY pass** — the code generator runs it after GREEN, before commit (`RED → GREEN → SIMPLIFY → re-verify GREEN → commit`): rewrite to the **smallest readable version that still passes** — apply these principles, delete dead code, inline needless indirection, strip ALL comments. Re-run the tests; they must stay GREEN.

## B. Write less — the lazy-senior ladder (run AFTER understanding the problem)

The best code is the code you never wrote. Stop at the FIRST rung that holds:

1. **YAGNI** — does this need to exist? Delete the requirement before building it. No speculative abstraction, no scaffolding "for later", no config nobody asked for.
2. **A repo util** — grep the codebase (or read the work packet); reuse an existing helper/type/constant/service.
3. **Stdlib** — a built-in over a hand-rolled loop.
4. **Native platform** — CSS over JS, a DB constraint over app validation, a framework primitive over a bespoke one.
5. **Installed dependency** — reuse the lockfile before adding a dep.
6. **One line** — if a one-liner is correct and clear, ship it.
7. **Minimal** — only now, the least code that satisfies the task + its test. Boring over clever; deletion over addition.

**Delete-list (the lead's verify audit).** While tests are green, scan the diff (`git diff <base>..HEAD`) for: needless abstraction, speculative generality, config nobody asked for, a hand-rolled loop the stdlib/a repo util already does, dead code, a whole task an existing utility made unnecessary. Each becomes a finding (usually MEDIUM/LOW) the fix round trims. Green tests are necessary, not sufficient — the shortest correct diff is the target.

**NEVER on the chopping block (lazy ≠ negligent):** trust-boundary/input validation, error handling that prevents data loss, security/authz, accessibility, and any spec-required behavior. Cut plumbing, never safety.

## C. Say less — terse agent-to-agent handoffs

Applies to every in-loop handoff: work packets, coder/update-docs/panel spawn prompts, `git notes`, `progress.md` appends, and final reports. Compress the *style*, never the substance.

- **Fragments, not sentences.** Drop "I will now…", "Let me…", hedges, restating the ask, summaries of what you just did.
- **Signal only.** One fact per line. Tables/bullets over prose. Cut adjectives and throat-clearing.
- **Keep EXACT** (never compress): code, file paths, commands, identifiers, test names, error strings, `file:line`, machine token lines.
- **Structure survives.** Required token lines, board fields, and note formats stay verbatim — terseness trims narration around the contract, not the contract.

## Works with

Loaded by `tiger-lead` (plan design + verify delete-list + terse packets), `tiger-code-generator` (ladder before writing, SIMPLIFY before commit, terse reports), `tiger-researcher` (minimal methods, terse cards), and `tiger-review` (audit checklist). No pipeline stage of its own; no git writes.

## Standalone use

Invoke directly to review a diff/design against the principles, to "make it lazy" (delete-list a diff), or to "make it terse" (compress a handoff). Reports only — writes nothing, commits nothing, owns no subagent.
