---
name: code-quality
description: Enforce code quality when writing, reviewing, refactoring, or auditing code in ANY language. Use this skill whenever the user mentions code quality, clean code, design principles, software design, SOLID, refactoring, code review, wants to improve code, or asks about writing well-designed code. Supports Python and Rust with language-specific rules. Also use when the user says "make this better", "improve this", "clean up this code", or any variation suggesting code improvement. This skill is rigid — its rules must be followed, not negotiated.
---

# Code Quality

Enforces design principles from *Software Design for Python Programmers* by Ronald Mak, plus language-specific rules for types, validation, logging, and clean code. Supports **Python** and **Rust**.

## Language Detection

Detect the project language from file extensions, Cargo.toml/pyproject.toml, or user context:
- `.py`, `pyproject.toml`, `requirements.txt` → Python — load [references/python-rules.md](references/python-rules.md)
- `.rs`, `Cargo.toml` → Rust — load [references/rust-rules.md](references/rust-rules.md)
- Mixed project → load both

## Five Non-Negotiables (Language-Agnostic)

1. **Explore before implement.** Search the codebase for existing code before writing new.
2. **Types first.** Use the strongest type system available. Validate at boundaries. Never untyped data flowing through business logic.
3. **Lint and type-check every change.** Run the project's linter and type checker after every step. Zero errors tolerated.
4. **Logs always.** Structured logging. Never `print()` / `println!()` for operational output.
5. **No water.** No dead code, no redundant comments, no unused variables. Every line earns its place.

## Reference Files

Load these as needed based on the task:

| Reference | When to Load |
|-----------|-------------|
| [references/design-principles.md](references/design-principles.md) | When reviewing or writing code — all 13 principles with violation signals and fixes (language-agnostic) |
| [references/design-patterns.md](references/design-patterns.md) | When architecture patterns are needed — 13 patterns with when to apply (language-agnostic) |
| [references/python-rules.md](references/python-rules.md) | Python projects — Pydantic, logging, enums, mypy, ruff, project structure |
| [references/rust-rules.md](references/rust-rules.md) | Rust projects — serde, tracing, enums, clippy, cargo, project structure |
| [references/review-agent.md](references/review-agent.md) | After implementing non-trivial code — spawn an independent review agent |

## Quick Start

1. Detect language → read [references/python-rules.md](references/python-rules.md) or [references/rust-rules.md](references/rust-rules.md)
2. If reviewing/refactoring: read [references/design-principles.md](references/design-principles.md)
3. If architecting: read [references/design-patterns.md](references/design-patterns.md)
4. After implementing: read [references/review-agent.md](references/review-agent.md) and spawn a review agent

## Audit Checklist (Quick Reference)

When reviewing code, every item must pass:
1. Types — Pydantic at boundaries, typed signatures
2. SRP — one reason to change per class/function
3. Encapsulation — varying behavior isolated
4. DRY — no duplicated code
5. OCP — new features via new classes, not edits
6. Interface — depends on abstractions, not concretes
7. LSP — subclass substitutes superclass
8. Composition — HAS-A over deep IS-A
9. Surprise — function names match behavior
10. Lazy — expensive work deferred
11. Invariants — no invalid object states
12. Logging — structured logging, no print()
13. No bare except — specific exceptions only
14. Lint clean — ruff check passes
15. Type check clean — mypy --strict passes
16. Enums — known value sets are enums
17. No water — every line earns its place
18. Patterns — appropriate design patterns used
19. AGENTS.md updated — new conventions documented
