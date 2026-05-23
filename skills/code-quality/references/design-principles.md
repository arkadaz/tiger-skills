# Design Principles

From *Software Design for Python Programmers* by Ronald Mak. Apply in order of priority. Each principle includes violation signals that MUST trigger a fix.

## 1. Single Responsibility Principle (SRP)

Each class and function MUST have exactly one reason to change.

**Violation signals:** A class with >7 public methods. A method over 30 lines. Class name containing "And", "Manager", or "Utils". Instance variables used by only half the methods.

**Fix:** Split along responsibility boundaries. Each extracted piece gets a name describing its single job.

## 2. Encapsulate What Varies Principle

Code that may change MUST be isolated from code that won't.

**Violation signals:** A change to one class forces changes in another. Hardcoded values scattered across files.

**Fix:** Create a dedicated class for the varying behavior. Inject it via constructor. Stable code depends only on the interface.

## 3. Principle of Least Knowledge (Law of Demeter)

A class MUST know as little as possible about other classes' implementations.

**Violation signals:** Method chains `obj.a().b().c()`. Accessing private members of another class. A function calls 5+ accessors on a received object.

**Fix:** The called class exposes a single method that does the work. Delegate, don't dig.

## 4. Don't Repeat Yourself (DRY)

No duplicate code. Copy-paste is always wrong.

**Violation signals:** Same 3+ lines in two places. Similar `if/elif/else` chains in multiple functions.

**Fix:** Extract shared code into a single function or class. Parameterize the differences.

## 5. Open-Closed Principle (OCP)

Classes MUST be open for extension but closed for modification.

**Violation signals:** Adding a feature requires editing an existing class. Long `match`/`if-elif` chains dispatching on type or kind.

**Fix:** Define a stable interface. New behavior arrives as new classes implementing that interface.

## 6. Code to the Interface Principle

Code MUST depend on abstractions, not concrete classes.

**Violation signals:** Variable typed as concrete class instead of Protocol/ABC. `isinstance()` checks to decide behavior. Constructor creates concrete dependencies directly.

**Fix:** Define a Protocol or ABC. Inject the concrete implementation. Let polymorphism choose behavior.

## 7. Liskov Substitution Principle (LSP)

A subclass MUST be usable wherever its superclass is expected.

**Violation signals:** Subclass overrides method and raises `NotImplementedError`. Subclass changes semantics of inherited method. `isinstance()` checks in caller to special-case a subclass.

**Fix:** If a subclass cannot fully substitute, use composition instead.

## 8. Favor Composition over Inheritance

"HAS-A" relationships are usually better than "IS-A."

**Violation signals:** Deep inheritance chains (3+ levels). Subclasses that only add state, not behavior. Subclasses that override most methods.

**Fix:** Replace inheritance with composition. The former subclass holds an instance of the former superclass and delegates.

## 9. Principle of Least Astonishment

Code MUST NOT surprise its users.

**Violation signals:** Function named `get_x` modifies state. Function returns `None` without name indicating it. Off-by-one errors. Function does more than its name suggests.

**Fix:** Name functions for exactly what they do. Use `Optional[]` and names like `find_` or `maybe_` for nullable returns.

## 10. Lazy Evaluation Principle

Defer expensive work until the result is actually needed.

**Violation signals:** Constructor does heavy computation that might never be used. Property getter recalculates on every access. Data loaded eagerly when only a subset is used.

**Fix:** Cache computed values. Load on first access. Use generators for large sequences.

## 11. Class Invariant, Precondition, and Postcondition Principles

- **Precondition:** What MUST be true before calling a function.
- **Postcondition:** What MUST be true after the function returns.
- **Class Invariant:** What MUST remain true for every object across all state changes.

**Violation signals:** Function validates arguments the caller should have validated. Object constructed in invalid state. Setter allows invalid state transitions.

**Fix:** Document preconditions with `assert` or explicit checks at function entry. Validate postconditions before return. Check invariants in every mutating method.

## 12. Delegation Principle

A class MUST delegate tasks to another class better suited to perform them.

**Violation signals:** A class doing work that belongs to another cohesive class. Methods that reach into another object to do work on its behalf.

**Fix:** Move the work into the class that owns the data. The original class calls the delegate's method.

## 13. Factory Principle

Encapsulate object creation in a dedicated factory function or method.

**Violation signals:** `if/elif` chains that return different concrete types scattered through code. Caller knows which concrete class to instantiate.

**Fix:** Create a factory function. Caller passes parameters; factory returns the right concrete object.
