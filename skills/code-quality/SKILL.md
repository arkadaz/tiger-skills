---
name: code-quality
description: Enforce code quality when writing, reviewing, refactoring, or auditing Python code. Use this skill whenever the user mentions code quality, clean code, design principles, software design, SOLID, refactoring, code review, wants to improve code, or asks about writing well-designed code. Also use when the user says "make this better", "improve this", "clean up this code", or any variation suggesting code improvement. This skill is rigid — its rules must be followed, not negotiated.
---

# Code Quality

This skill enforces code quality grounded in the design principles from *Software Design for Python Programmers* by Ronald Mak, plus practical rules for Python development. Apply it when writing new code, reviewing existing code, or refactoring.

## Core Philosophy

Code quality means: correct input/output types, no surprise behavior, no unnecessary code, every line earns its place. Before writing any implementation, you MUST understand the input types, output types, and data flow. Use Pydantic to define those types explicitly. Never wrap code in `try/except` because you're unsure what shape the data has — know the shape instead.

**The five non-negotiables:**

1. **Explore before you implement.** Before writing a single line of new code, you MUST search the codebase for existing functions, classes, or utilities that already do the same or similar thing. Use Grep and Glob to find related code. Read the files you find. If there's an existing function that does 80%+ of what you need, extend or reuse it — do NOT write a duplicate. Duplicating existing functionality is worse than useless; it creates divergence, confusion, and maintenance debt. This applies to helper functions, validators, API clients, database queries, type definitions, and constants. If you're unsure whether something exists, search harder before writing.
2. **Types first.** Every function's input and output MUST be typed with concrete types — never `dict`, `list`, or `Any` at a system boundary. Use Pydantic models at all I/O edges (API endpoints, file parsing, database reads, message queues). A docstring saying `data: dict` is worse than useless — it tells the caller nothing about the required fields. If you don't know the shape of incoming data, write exploratory code to inspect it BEFORE writing the implementation. Then define the Pydantic model. Only after you know the exact field names, types, and constraints do you write the production code.
3. **Lint and type-check on every change.** After every implementation step, you MUST run the project's linter and type checker. If the project has no linter, use `ruff check` for Python. If there's no type checker configured, use `mypy --strict`. Never leave lint or type errors behind — fix them before moving on. A clean lint and type-check run is part of the minimum bar for "done." Add the verification commands to the project's CLAUDE.md or AGENTS.md if they aren't already there.
4. **Logs always.** Every meaningful operation MUST produce a log line. Use `logging` — never `print()`. Log entry (with input values), exit (with result), and any branch that changes program state.
5. **No water.** If a line of code doesn't directly contribute to the function's purpose, delete it. No comments that say WHAT the code does (well-named identifiers already do that). No unused variables, no dead branches, no defensive checks for states that cannot happen internally.

## Design Principles (from Ronald Mak, *Software Design for Python Programmers*)

Apply these principles in order of priority. Each principle includes a **violation signal** — a pattern that, when spotted, MUST trigger a fix.

### 1. Single Responsibility Principle (SRP)
Each class and function MUST have exactly one reason to change.

**Violation signals:**
- A class with more than ~7 public methods
- A method over 30 lines
- A class name containing "And" or "Manager" or "Utils"
- Instance variables used by only half the methods

**Fix:** Split the class or function along responsibility boundaries. Each extracted piece gets a name that describes its single job.

### 2. Encapsulate What Varies Principle
Code that may change MUST be isolated from code that won't.

**Violation signals:**
- A change to one class forces changes in another
- Multiple classes import the same implementation details
- Hardcoded values scattered across files

**Fix:** Create a dedicated class for the varying behavior. Inject it via the constructor. The stable code depends only on the interface.

### 3. Principle of Least Knowledge (Law of Demeter)
A class MUST know as little as possible about other classes' implementations.

**Violation signals:**
- Method chains: `obj.a().b().c()`
- Accessing private members of another class (names starting with `_`)
- A function receives an object and immediately calls 5+ accessors on it

**Fix:** The called class should expose a single method that does the work. Delegate, don't dig.

### 4. Don't Repeat Yourself (DRY)
No duplicate code. Copy-paste is always wrong.

**Violation signals:**
- Same 3+ lines appear in two places
- Similar `if/elif/else` chains in multiple functions
- Copy-pasted test setup

**Fix:** Extract the shared code into a single function or class. Parameterize the differences.

### 5. Open-Closed Principle (OCP)
Classes MUST be open for extension but closed for modification.

**Violation signals:**
- Adding a feature requires editing an existing class (not adding a new one)
- Long `match`/`if-elif` chains that dispatch on type or kind

**Fix:** Define a stable interface. New behavior arrives as new classes implementing that interface, not as edits to existing code.

### 6. Code to the Interface Principle
Code MUST depend on abstractions, not concrete classes.

**Violation signals:**
- Variable typed as a concrete class instead of a Protocol/ABC
- `isinstance()` checks to decide behavior
- Constructor creates concrete dependencies with `new`

**Fix:** Define a Protocol or abstract base class. Inject the concrete implementation. Let polymorphism choose behavior.

### 7. Liskov Substitution Principle (LSP)
A subclass MUST be usable wherever its superclass is expected.

**Violation signals:**
- A subclass overrides a method and raises `NotImplementedError`
- A subclass changes the semantics of an inherited method
- `isinstance()` checks in caller code to special-case a subclass

**Fix:** If a subclass cannot fully substitute the superclass, it should not be a subclass. Use composition instead.

### 8. Favor Composition over Inheritance
"HAS-A" relationships are usually better than "IS-A."

**Violation signals:**
- Deep inheritance chains (3+ levels)
- Subclasses that only add state, not behavior
- Subclasses that override most methods

**Fix:** Replace inheritance with composition. The former subclass holds an instance of the former superclass and delegates to it.

### 9. Principle of Least Astonishment
Code MUST NOT surprise its users.

**Violation signals:**
- A function named `get_x` modifies state
- A function returns `None` without the name indicating it (`find` vs `get`)
- Off-by-one errors (month 1 maps to index 0)
- Function does more than its name suggests

**Fix:** Name functions for exactly what they do. If it has side effects, the name says so. If it can return `None`, use `Optional[]` and a name like `find_` or `maybe_`.

### 10. Lazy Evaluation Principle
Defer expensive work until the result is actually needed.

**Violation signals:**
- Constructor does heavy computation that might never be used
- A property getter recalculates the same value on every access
- Data loaded eagerly when only a subset is used

**Fix:** Cache computed values. Load on first access. Use generators for large sequences.

### 11. Class Invariant, Precondition, and Postcondition Principles
- **Precondition:** What MUST be true before calling a function.
- **Postcondition:** What MUST be true after the function returns.
- **Class Invariant:** What MUST remain true for every object across all state changes.

**Violation signals:**
- A function validates arguments that the caller should have validated
- An object can be constructed in an invalid state
- A setter allows invalid state transitions

**Fix:** Document preconditions with `assert` or explicit checks at function entry. Validate postconditions before return. Check invariants in every method that mutates state.

### 12. Delegation Principle
A class MUST delegate tasks to another class better suited to perform them.

**Violation signals:**
- A class doing work that belongs to another cohesive class
- Methods that reach into another object to do work on its behalf

**Fix:** Move the work into the class that owns the data. The original class calls the delegate's method.

### 13. Factory Principle
Encapsulate object creation in a dedicated factory function or method.

**Violation signals:**
- `if/elif` chains that return different concrete types scattered through the codebase
- Caller code that knows which concrete class to instantiate

**Fix:** Create a factory function. The caller passes parameters; the factory returns the right concrete object.

## Design Patterns Awareness

When you recognize one of these architecture problems, apply the corresponding pattern:

| Problem | Pattern | Key Idea |
|---------|---------|----------|
| Algorithm has fixed steps, some vary by context | Template Method | Superclass defines skeleton, subclasses fill in steps |
| Multiple interchangeable algorithms | Strategy | Encapsulate each algorithm, inject the one you need |
| Creating related families of objects | Abstract Factory | Factory per family, no mixing family members |
| Creating objects where subclass should decide which | Factory Method | Delegate instantiation to subclasses |
| Incompatible interfaces need to work together | Adapter | Wrap the adaptee to match the target interface |
| Complex subsystem needs a simple interface | Façade | One class fronts the subsystem |
| One algorithm, different sequential collections | Iterator | Encapsulate iteration, hide collection implementation |
| Different algorithms on one collection of mixed types | Visitor | Each algorithm is a visitor, nodes accept visitors |
| Publisher-subscriber / one-to-many dependency | Observer | Subject notifies observers, observers pull data |
| Object behavior depends on its state | State | Each state is a class, state transitions return next state |
| At most one instance of a class | Singleton | Controlled creation, global access point |
| Part-whole hierarchies where parts and wholes treated uniformly | Composite | Common interface for individual and composite objects |
| Add responsibilities dynamically at runtime | Decorator | Wrap objects, each wrapper adds one responsibility |

**When to apply:** If you see the "before" pattern described in the book (hardcoded behaviors, long type-checking chains, duplicated iteration logic, scattered state management), refactor to the pattern.

## Python-Specific Rules

### Pydantic for All I/O Boundaries

Every function that receives data from outside the process MUST use Pydantic models. This means:
- API request/response bodies
- File parsing (JSON, YAML, TOML, CSV with headers)
- Database query results being passed around
- Message queue payloads
- Environment variable parsing
- CLI argument parsing results

A Pydantic model defines the contract. Invalid data fails at the boundary, not deep in business logic.

**Correct:**
```python
from pydantic import BaseModel, PositiveInt

class CreateBookRequest(BaseModel):
    title: str
    author_last: str
    author_first: str
    year: PositiveInt

def create_book(req: CreateBookRequest) -> Book:
    # req is already validated — just use it
    ...
```

**Wrong:**
```python
def create_book(data: dict) -> Book:
    title = data.get("title")  # is it there? is it a string? who knows
    try:
        year = int(data.get("year", 0))
    except (TypeError, ValueError):
        year = 0  # silently swallowing garbage
    ...
```

### No Magic Try/Except

Every `try/except` block MUST have a specific exception type and a specific reason for catching it. If you're catching an exception because you're unsure what type or shape the data has, STOP — define the type with Pydantic first.

**Allowed:**
- `try: parse_json(raw) except json.JSONDecodeError: ...` — specific issue, specific handler
- `try: db.execute(query) except DatabaseError: ...` — external system failure, known exception
- Retry logic for network calls

**Forbidden:**
- `try: ... except Exception: pass` — swallowing errors silently
- `try: ... except: ...` — bare except
- `try: data["key"] except KeyError: ...` — use `.get()` or define a model instead
- Catching exceptions when you just don't know the data shape — define the shape

### Logging Rules

Use Python's `logging` module. Never `print()`.

**Every function crossing a system boundary MUST log:**
- Entry: function name, key input values (not secrets)
- Exit: function name, result summary, elapsed time if >1s
- Every state-changing branch: what changed and why

**Log levels:**
- `DEBUG`: internal state transitions, detailed data inspection
- `INFO`: completed operations, milestones ("processed 1000 records")
- `WARNING`: recoverable issues, retries, degraded operation
- `ERROR`: operation failed, but the process continues
- `CRITICAL`: process cannot continue

**Correct:**
```python
import logging
logger = logging.getLogger(__name__)

def process_order(order_id: str) -> OrderResult:
    logger.info("Processing order", extra={"order_id": order_id})
    ...
    if out_of_stock:
        logger.warning("Item out of stock, sending backorder", extra={"order_id": order_id, "sku": sku})
    ...
    logger.info("Order processed", extra={"order_id": order_id, "status": result.status})
    return result
```

### No Water Code

Every line MUST carry its weight. Delete:

- Comments that restate what the code says (`# increment i` next to `i += 1`)
- Unused imports, variables, parameters
- Dead code in `else` branches after `return`/`raise`
- Intermediate variables used exactly once (inline them unless they clarify a complex expression)
- Getters/setters that do nothing but read/write a private field with no validation (use a plain attribute or a frozen dataclass)
- `__init__` methods that only assign parameters to same-named attributes (use `@dataclass` or Pydantic)

### Enum for Known Value Sets

When a variable can only take one of a known, fixed set of values, you MUST use `enum.Enum` — never magic strings or bare integers. This applies to: status codes, categories, types, states, roles, levels, modes, and any other discriminant that drives branching logic.

**Violation signals:**
- A function returns a string like `"minor"`, `"adult"`, `"senior"` when only those three values are possible
- An `if/elif` chain tests against string literals
- A parameter documented as "one of: 'active', 'pending', 'closed'" but typed as `str`

**Correct:**
```python
from enum import Enum

class AgeCategory(Enum):
    MINOR = "minor"
    ADULT = "adult"
    SENIOR = "senior"

def categorize_age(age: int) -> AgeCategory:
    if age < 18:
        return AgeCategory.MINOR
    if age < 65:
        return AgeCategory.ADULT
    return AgeCategory.SENIOR
```

**Wrong:**
```python
def categorize_age(age: int) -> str:
    if age < 18:
        return "minor"
    if age < 65:
        return "adult"
    return "senior"
```

This prevents typos, makes invalid states unrepresentable, and gives type checkers the power to catch missing cases in `match` statements.

### Explore Before Implementing

When you don't know the shape of input data, write a short exploration script FIRST. Inspect the actual data, print types and structures, then define the Pydantic model. Never write the implementation while uncertain about what you're processing.

## Audit Checklist

When reviewing code, check each item. If any check fails, that's a violation that MUST be fixed before the code is accepted.

1. **Types:** Are all function inputs/outputs typed? Are Pydantic models used at boundaries?
2. **SRP:** Does each class/function have one reason to change?
3. **Encapsulation:** Is varying behavior isolated? Would a change in one place cascade?
4. **DRY:** Is there any duplicated code?
5. **OCP:** Can new features be added by adding classes, not editing existing ones?
6. **Interface:** Does code depend on abstractions, not concrete classes?
7. **LSP:** Can every subclass substitute its superclass without surprises?
8. **Composition:** Are there deep inheritance chains that should be composition?
9. **Surprise:** Do function names match behavior? Are there off-by-one errors?
10. **Lazy:** Is expensive work deferred until needed?
11. **Invariants:** Can objects be created in invalid states? Can setters corrupt state?
12. **Logging:** Does every meaningful operation produce a log? Are log levels appropriate?
13. **No try/except abuse:** Is every try/except specific and justified?
14. **Lint clean:** Did `ruff check` (or project linter) pass with zero issues?
15. **Type check clean:** Did `mypy --strict` (or project type checker) pass with zero errors?
16. **Enums:** Are all known value sets using `enum.Enum` instead of magic strings/ints?
17. **No water:** Can any line be deleted without changing behavior?
18. **Patterns:** Is there an architecture problem that a design pattern should solve?
19. **AGENTS.md updated:** If new conventions, commands, or architectural decisions were introduced, is AGENTS.md/CLAUDE.md updated?

## Independent Code Review

After implementing any non-trivial change, a SEPARATE review agent MUST audit the code before it is considered done. The agent that wrote the code cannot be the sole judge of its quality — agents systematically over-rate their own output.

### When to Spawn a Review Agent

Required when:
- A new class or module is created
- A function longer than 15 lines is added or modified
- A new API endpoint or public interface is introduced
- Code touches shared infrastructure (database, auth, config)
- The change spans 3+ files

Skip only for single-line fixes, typos, or configuration value changes.

### How the Review Works

1. The implementation agent finishes its work: code written, lint clean, type check clean, tests pass.
2. Spawn a review agent using the Agent tool. The review agent reads `code-quality/SKILL.md` and audits the diff against every item in the audit checklist.
3. The review agent saves findings to `docs/reviews/YYYY-MM-DD-<topic>-review.md`.
4. The implementation agent addresses every finding before marking the feature `passing`.
5. If the review finds architectural issues (SRP/OCP violations, missing interfaces), the implementation agent MUST fix them — not just note them.

### Review Report Template

```markdown
# Code Review: <feature/task>

## Summary
- Reviewed by: <agent>
- Files reviewed: <list>
- Pass rate: <N>/<19 audit items>

## Violations Found
### <Violation>
- File: `src/module/file.py:123`
- Rule: <which audit item>
- Problem: <specific issue>
- Fix: <what to do>

## Approved With Changes
- <item> — addressed in commit <hash>
```

### Review Agent Prompt

When spawning the review agent, use this structure:
```
You are a code review agent. Read the code-quality skill at <path>.
Audit the files at <list of changed files> against all 19 audit checklist items.
For each violation, cite the file, line, and which rule it breaks.
Save the review to docs/reviews/<date>-<topic>-review.md.
The implementation agent will address your findings — do NOT modify the code yourself.
```

Do NOT skip review because "the code looks fine." The review agent provides an independent check — it often catches issues the implementation agent missed.

## Implementation Guidance

When writing new code, follow this order:

1. Explore the codebase for existing functions that do the same or similar thing.
2. Define the Pydantic models for input and output.
3. Write the function signatures with full type hints.
4. Write the happy-path logic.
5. Add logging at entry, exit, and state-changing branches.
6. Add error handling only for known, specific failure modes.
7. Run `ruff check` (or the project's linter) and `mypy --strict` (or the project's type checker). Fix any issues.
8. Self-review against the audit checklist.
9. **Spawn an independent review agent** (see Independent Code Review section above). Address all findings.
10. Remove any water code.
11. If the project has an AGENTS.md or CLAUDE.md, update it with any new architectural decisions, new verification commands, or changed conventions.
