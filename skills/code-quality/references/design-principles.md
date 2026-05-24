# Design Principles

From *Software Design for Python Programmers* by Ronald Mak. Language-agnostic. Apply in priority order. For code examples, see [python/examples.md](python/examples.md) or [rust/examples.md](rust/examples.md).

## 1. Single Responsibility Principle (SRP)

Each class/struct/fn MUST have exactly one reason to change.

**Violation signals:** Class with >7 public methods, method >30 lines, struct with fields used by only half its impl blocks, name containing "And"/"Manager"/"Utils."

**Fix:** Split along responsibility boundaries so the original becomes an orchestrator that delegates to extracted classes.

## 2. Encapsulate What Varies

Code that may change MUST be isolated from code that won't.

**Violation signals:** Change to one module forces changes in another. Hardcoded values scattered across files. Feature flags spread through business logic.

**Fix:** Isolate varying behavior behind a trait or interface and inject via constructor so stable code never depends on what varies.

## 3. Principle of Least Knowledge (Law of Demeter)

A module MUST know as little as possible about other modules' internals.

**Violation signals:** `obj.a().b().c()` chains. Accessing `_private` members. Receiving an object and calling 5+ accessors on it.

**Fix:** Expose a single method on the target that does the work so callers tell it what to do instead of asking for internals.

## 4. Don't Repeat Yourself (DRY)

No duplicate code. Every piece of knowledge has one authoritative representation.

**Violation signals:** Same 3+ lines in two places. Copy-pasted validation. Similar if/else chains in multiple functions.

**Fix:** Extract shared code into a single function, parameterizing the differences.

## 5. Open-Closed Principle (OCP)

Open for extension, closed for modification.

**Violation signals:** Adding a feature requires editing existing code. Long match/if-else chains dispatching on type/kind/format.

**Fix:** Define a stable trait or interface, then add new behavior via new implementations registered through a factory without editing existing code.

## 6. Code to the Interface

Depend on abstractions, not concrete types.

**Violation signals:** Variable typed as concrete struct/class. `isinstance()`/`match` on concrete types to decide behavior. Constructor creates dependencies directly.

**Fix:** Define a trait or Protocol, inject the implementation, and let polymorphism choose behavior at runtime.

## 7. Liskov Substitution Principle (LSP)

A subtype MUST be usable wherever its supertype is expected.

**Violation signals:** Subtype raises `NotImplementedError`/`unimplemented!()`. Subtype changes semantics of inherited method. Caller has `isinstance` checks for specific subtypes.

**Fix:** If a subtype cannot fully substitute its supertype, use composition instead of inheritance.

## 8. Favor Composition over Inheritance

HAS-A is usually better than IS-A.

**Violation signals:** Deep inheritance chains (3+ levels). Subtypes that only add fields. Subtypes overriding most methods. Rust note: no implementation inheritance exists — this is the default.

**Fix:** Hold an instance of the collaborator and delegate to it so behaviors remain swappable at runtime.

## 9. Principle of Least Astonishment

Code MUST NOT surprise its users.

**Violation signals:** Function named `get_x` modifies state. Returns `None`/`Option::None` without name indicating it. Off-by-one errors. Function does more than its name says.

**Fix:** Name functions for exactly what they do, include side effects in the name, and prefix nullable returns with `find_` or `maybe_`.

## 10. Lazy Evaluation

Defer expensive work until the result is actually needed.

**Violation signals:** Constructor does heavy computation. Property/computed field recalculates on every access. Eager loading when subset is used.

**Fix:** Cache results on first access, use iterators or generators for sequences, and defer loading until the value is actually needed.

## 11. Class Invariant, Precondition, Postcondition

- **Precondition:** What MUST be true before calling a function.
- **Postcondition:** What MUST be true after it returns.
- **Invariant:** What MUST remain true across all state changes.

**Violation signals:** Object constructed in invalid state. Setter allows invalid transitions. Function validates what the caller should have validated.

**Fix:** Assert preconditions and postconditions at function entry and exit, and verify invariants in every mutating method.

## 12. Delegation Principle

Delegate tasks to the module best suited to perform them.

**Violation signals:** Module doing work that belongs to another. Reaching into another object's data.

**Fix:** Move the work into the module that owns the data and call the delegate from the original site.

## 13. Factory Principle

Encapsulate object creation in a dedicated factory.

**Violation signals:** if/else chains returning different concrete types scattered through code. Caller knows which concrete type to instantiate.

**Fix:** Create a factory function or struct with a registry so the caller passes a key and receives the correct implementation.
