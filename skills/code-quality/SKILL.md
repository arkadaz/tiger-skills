---
name: code-quality
description: Enforce code quality when writing, reviewing, refactoring, or auditing code in ANY language. Based on 16 design principles and 13 design patterns from Software Design for Python Programmers by Ronald Mak. Use when the user mentions code quality, clean code, design principles, SOLID, refactoring, code review, or wants to improve code. Supports Python and Rust with language-specific rules. This skill is rigid — its rules must be followed, not negotiated.
---

# Code Quality

Based on *Software Design for Python Programmers* by Ronald Mak (Manning Publications, 2026). Language-agnostic principles with Python and Rust enforcement rules.

## How This Skill Works — Router Model

This skill is a **router**. Load the principles here, then invoke sub-skills for specific tasks:

| Sub-Skill | Use When |
|-----------|----------|
| `code-quality:review` | Reviewing a diff for quality violations — independent review agent |
| `code-quality:audit` | Auditing existing code for design principle violations |
| `code-quality:fix` | Fixing specific violations with known fix patterns |
| `code-quality:python` | Python-specific rules — types, DI, enums, naming, logging, project structure |
| `code-quality:rust` | Rust-specific rules — traits, ownership, error handling, module structure |

## 16 Design Principles

| # | Principle | Summary |
|---|-----------|---------|
| 1 | **Single Responsibility** | Each class/module has exactly one reason to change |
| 2 | **Encapsulate What Varies** | Isolate code that can change from code that won't |
| 3 | **Least Knowledge** (Law of Demeter) | Expose only what others need |
| 4 | **Don't Repeat Yourself (DRY)** | No duplicate code — one authoritative representation |
| 5 | **Open-Closed** | Open for extension, closed for modification |
| 6 | **Code to the Interface** | Depend on abstractions, not concretions |
| 7 | **Liskov Substitution** | Subtypes must fully substitute their supertypes |
| 8 | **Composition over Inheritance** | HAS-A over IS-A |
| 9 | **Least Astonishment** | No surprises — behavior matches name |
| 10 | **Lazy Evaluation** | Defer expensive work until needed |
| 11 | **Class Invariant** | Condition must remain true across state changes |
| 12 | **Precondition** | What must be true before calling |
| 13 | **Postcondition** | What must be true after returning |
| 14 | **Delegation** | Delegate tasks to the best-suited class |
| 15 | **Factory** | Encapsulate object creation |
| 16 | **Defensive Programming** | Guard against invalid states at every boundary |

## 13 Design Patterns

| Category | Pattern | When |
|----------|---------|------|
| Behavioral | **Template Method** | Fixed algorithm steps, some vary by context |
| Behavioral | **Strategy** | Multiple interchangeable algorithms |
| Behavioral | **Observer** | One produces data, many consume it |
| Behavioral | **State** | Object behavior depends on its state |
| Behavioral | **Visitor** | Different algorithms on a collection of mixed types |
| Behavioral | **Iterator** | Traverse collections without exposing implementation |
| Creational | **Factory Method** | Subclass decides what to create |
| Creational | **Abstract Factory** | Families of related objects |
| Creational | **Singleton** | At most one instance |
| Structural | **Adapter** | Incompatible interfaces need to work together |
| Structural | **Facade** | Complex subsystem needs simple interface |
| Structural | **Composite** | Part-whole hierarchy, treat uniformly |
| Structural | **Decorator** | Add responsibilities dynamically at runtime |

## Five Non-Negotiables

1. **Explore before implement** — read existing code, docs, and types first
2. **Types first** — every type annotation fully parameterized, no `Any` in business logic
3. **Lint and type-check every change** — zero errors tolerated
4. **Logs always** — never `print()` for operational output
5. **No water** — every line earns its place

## Language Routing

- `.py` files → invoke `code-quality:python`
- `.rs` files → invoke `code-quality:rust`
- Mixed project → invoke both
- Design/architecture questions → invoke `code-quality:audit`
- Reviewing a diff → invoke `code-quality:review`
- Fixing violations → invoke `code-quality:fix`

## Reference Files

| Reference | When |
|-----------|------|
| [references/design-principles.md](references/design-principles.md) | Full principle details with violation signals and fix patterns |
| [references/design-patterns.md](references/design-patterns.md) | Pattern selection guide and one-liner cheat sheet |
| [references/review-agent.md](references/review-agent.md) | Independent review agent spawn instructions |
| [references/python/rules.md](references/python/rules.md) | Python — types, DI, enums, naming, logging, project structure |
| [references/rust/rules.md](references/rust/rules.md) | Rust — traits, ownership, error handling, module structure |
