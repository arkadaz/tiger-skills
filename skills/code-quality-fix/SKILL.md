---
name: code-quality:fix
description: Fix specific code quality violations — apply known fix patterns for each of the 16 design principles and language-specific tooling rules. Use when a review or audit has identified violations that need fixing.
---

# Fix Code Quality Violations

Apply known fix patterns for each design principle and tooling rule violation.

## Fix Patterns by Principle

### 1. Single Responsibility
**Signal:** Class with >7 public methods, method >30 lines, name containing "And"/"Manager"/"Utils"
**Fix:** Split along responsibility boundaries. Original becomes orchestrator that delegates to extracted classes.

### 2. Encapsulate What Varies
**Signal:** Change to one module forces changes in another
**Fix:** Isolate varying behavior behind an interface/trait. Inject via constructor so stable code never depends on what varies.

### 3. Least Knowledge (Law of Demeter)
**Signal:** `obj.a().b().c()` chains, accessing `_private` members
**Fix:** Expose a single method on the target that does the work. Callers tell, don't ask.

### 4. DRY
**Signal:** Same 3+ lines in two places, copy-pasted validation
**Fix:** Extract shared code into a single function, parameterize the differences.

### 5. Open-Closed
**Signal:** Long if/else or match chains dispatching on type/kind
**Fix:** Define a stable trait/interface. Add new behavior via new implementations registered through a factory.

### 6. Code to Interface
**Signal:** Variable typed as concrete class, constructor creates dependencies directly
**Fix:** Define a trait/Protocol. Inject the implementation. Let polymorphism choose at runtime.

### 7. Liskov Substitution
**Signal:** Subtype raises NotImplementedError, changes semantics of inherited method
**Fix:** If subtype can't fully substitute, use composition instead of inheritance.

### 8. Composition over Inheritance
**Signal:** Deep inheritance (3+ levels), subtypes that only add fields
**Fix:** Hold an instance of the collaborator and delegate to it.

### 9. Least Astonishment
**Signal:** `get_x` modifies state, function does more than its name says
**Fix:** Name functions for exactly what they do. Include side effects in the name.

### 10. Lazy Evaluation
**Signal:** Constructor does heavy computation, property recalculates on every access
**Fix:** Cache results on first access. Use generators for sequences. Defer loading.

### 11. Class Invariant
**Signal:** Object constructed in invalid state, setter allows invalid transitions
**Fix:** Verify invariants in constructor and every mutating method.

### 12. Precondition
**Signal:** Function validates what caller should have validated
**Fix:** Assert preconditions at function entry. Document what callers must ensure.

### 13. Postcondition
**Signal:** Function returns without ensuring its contract
**Fix:** Assert postconditions before returning. Verify function delivered what it promised.

### 14. Delegation
**Signal:** Module doing work that belongs to another
**Fix:** Move work into the module that owns the data. Call delegate from original site.

### 15. Factory
**Signal:** if/else chains returning different concrete types scattered through code
**Fix:** Create a factory function/struct with a registry. Caller passes key, receives correct implementation.

### 16. Defensive Programming
**Signal:** No validation of constructor parameters, external data enters business logic unchecked
**Fix:** Validate all inputs at boundaries. Use Pydantic/serde at I/O boundaries. Never allow invalid state.

## Tooling Rule Fix Patterns (language-neutral)

These are the 11 tooling-rule intents. Invoke `code-quality:language` to translate each into the idiom of the language in front of you; Python and Rust examples shown.

### Types — no escape hatch where a real type exists
**Signal:** the language's "any" (`Any`/`object`, `any`, `interface{}`, `dynamic`, `Box<dyn Any>`) or an unparameterized generic where the structure is known.
**Fix:** find the real type; if none exists for known-structured data, create it first. *Py:* `dict[str,str]`, dataclass/Pydantic. *Rust:* newtype / domain struct instead of `serde_json::Value`.

### DI — inject, don't thread
**Signal:** a dependency (`driver`, `client`, `connection`, `session`) passed into every function.
**Fix:** move it to construction. *Py:* `__init__` param → `self.driver`. *Rust:* struct field / generic trait bound.

### Enums — no magic values
**Signal:** a magic string/int used in branching.
**Fix:** model the fixed set as the language's enum/sum type and use it everywhere. *Py:* `class Status(Enum)`. *Rust:* `enum Status` + exhaustive `match`.

### Naming — idiomatic for the language
**Signal:** wrong-language casing, or privacy-by-underscore where not idiomatic.
**Fix:** apply the language's style guide. *Py:* `snake_case`, no leading `_`. *Rust:* `snake_case` fns, `PascalCase` types.

### Logging — no raw stdout
**Signal:** the raw print primitive in business logic (`print`, `println!`, `console.log`, `fmt.Println`).
**Fix:** use the project's logging library with structured fields.

### Errors — no swallowing
**Signal:** catch-all/ignored errors, or crash-on-error in library code.
**Fix:** handle specifically with the language's mechanism. *Py:* specific `except`. *Rust:* propagate with `?`, no `unwrap()` in libs.

### I/O validation — parse, don't trust
**Signal:** external data flowing into logic unvalidated.
**Fix:** validate into domain types at the boundary (Pydantic / serde / zod / struct tags).

### Flat functions
**Signal:** nested function definitions / deep nesting where a flatter form exists.
**Fix:** extract to module-level / free functions; pass data as parameters.

### Lint, type-check, format
**Signal:** the project's toolchain reports errors/warnings.
**Fix:** run the repo's own linter + type checker + formatter; drive to zero.

### Module / entry hygiene
**Signal:** logic in package entry points; outward/circular imports.
**Fix:** entry points re-export only; make imports flow inward.

### No water
**Signal:** comment restating code, unused import, dead branch.
**Fix:** delete. If a line doesn't carry its weight, it doesn't belong.

## Fix Protocol

1. **Read the violation** — understand what's wrong and why
2. **Read the surrounding code** — understand context before changing
3. **Apply the fix pattern** — use the specific pattern above
4. **Verify the fix** — lint + type-check + tests still pass
5. **Commit** — one commit per fix category
