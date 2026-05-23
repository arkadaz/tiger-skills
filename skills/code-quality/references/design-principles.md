# Design Principles

From *Software Design for Python Programmers* by Ronald Mak. Language-agnostic. Apply in priority order. For code examples, see [python/examples.md](python/examples.md) or [rust/examples.md](rust/examples.md).

## 1. Single Responsibility Principle (SRP)

Each class/struct/fn MUST have exactly one reason to change.

**Violation signals:** Class with >7 public methods, method >30 lines, struct with fields used by only half its impl blocks, name containing "And"/"Manager"/"Utils."

**Fix:** Split along responsibility boundaries. The original becomes an orchestrator that delegates.

## 2. Encapsulate What Varies

Code that may change MUST be isolated from code that won't.

**Violation signals:** Change to one module forces changes in another. Hardcoded values scattered across files. Feature flags spread through business logic.

**Fix:** Dedicated module for varying behavior. Inject via constructor. Stable code depends only on trait/interface.

## 3. Principle of Least Knowledge (Law of Demeter)

A module MUST know as little as possible about other modules' internals.

**Violation signals:** `obj.a().b().c()` chains. Accessing `_private` members. Receiving an object and calling 5+ accessors on it.

**Fix:** Expose a single method that does the work. Tell, don't ask.

## 4. Don't Repeat Yourself (DRY)

No duplicate code. Every piece of knowledge has one authoritative representation.

**Violation signals:** Same 3+ lines in two places. Copy-pasted validation. Similar if/else chains in multiple functions.

**Fix:** Extract shared code. Parameterize differences.

## 5. Open-Closed Principle (OCP)

Open for extension, closed for modification.

**Violation signals:** Adding a feature requires editing existing code. Long match/if-else chains dispatching on type/kind/format.

**Fix:** Define a stable trait/interface. New behavior = new impl, registered via factory. No edits to existing.

## 6. Code to the Interface

Depend on abstractions, not concrete types.

**Violation signals:** Variable typed as concrete struct/class. `isinstance()`/`match` on concrete types to decide behavior. Constructor creates dependencies directly.

**Fix:** Define a trait/Protocol. Inject impl. Polymorphism chooses behavior at runtime.

## 7. Liskov Substitution Principle (LSP)

A subtype MUST be usable wherever its supertype is expected.

**Violation signals:** Subtype raises `NotImplementedError`/`unimplemented!()`. Subtype changes semantics of inherited method. Caller has `isinstance` checks for specific subtypes.

**Fix:** If a subtype can't fully substitute, don't subtype. Use composition.

## 8. Favor Composition over Inheritance

HAS-A is usually better than IS-A.

**Violation signals:** Deep inheritance chains (3+ levels). Subtypes that only add fields. Subtypes overriding most methods. Rust note: no implementation inheritance exists — this is the default.

**Fix:** Hold an instance of the collaborator. Delegate to it. Behaviors become swappable.

## 9. Principle of Least Astonishment

Code MUST NOT surprise its users.

**Violation signals:** Function named `get_x` modifies state. Returns `None`/`Option::None` without name indicating it. Off-by-one errors. Function does more than its name says.

**Fix:** Name for exactly what it does. Side effects in the name. Nullable returns use `find_`/`maybe_` prefix.

## 10. Lazy Evaluation

Defer expensive work until the result is actually needed.

**Violation signals:** Constructor does heavy computation. Property/computed field recalculates on every access. Eager loading when subset is used.

**Fix:** Cache on first access. Use iterators/generators. Load lazily.

## 11. Class Invariant, Precondition, Postcondition

- **Precondition:** What MUST be true before calling a function.
- **Postcondition:** What MUST be true after it returns.
- **Invariant:** What MUST remain true across all state changes.

**Violation signals:** Object constructed in invalid state. Setter allows invalid transitions. Function validates what the caller should have validated.

**Fix:** `assert!`/`debug_assert!` at entry and exit. Check invariants in every mutating method.

## 12. Delegation Principle

Delegate tasks to the module best suited to perform them.

**Violation signals:** Module doing work that belongs to another. Reaching into another object's data.

**Fix:** Move work into the module that owns the data. Call the delegate.

## 13. Factory Principle

Encapsulate object creation in a dedicated factory.

**Violation signals:** if/else chains returning different concrete types scattered through code. Caller knows which concrete type to instantiate.

**Fix:** Factory function/struct with a registry. Caller passes key; factory returns right impl.
