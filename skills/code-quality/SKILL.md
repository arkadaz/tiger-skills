---
name: code-quality
description: Enforce code quality when writing, reviewing, refactoring, or auditing Python code. Use this skill whenever the user mentions code quality, clean code, design principles, software design, SOLID, refactoring, code review, wants to improve code, or asks about writing well-designed code. Also use when the user says "make this better", "improve this", "clean up this code", or any variation suggesting code improvement. This skill is rigid — its rules must be followed, not negotiated.
---

# Code Quality

Enforces design principles from *Software Design for Python Programmers* by Ronald Mak, plus Python-specific rules for types, logging, and clean code.

## Five Non-Negotiables

1. **Explore before implement.** Search the codebase for existing code before writing new.
2. **Types first.** Concrete types, Pydantic at boundaries. Never `dict` or `Any`.
3. **Lint and type-check every change.** `ruff check` + `mypy --strict` after every step.
4. **Logs always.** `logging` module, structured. Never `print()`.
5. **No water.** No dead code, no redundant comments, no unused variables.

## Reference Files

Load these as needed based on the task:

| Reference | When to Load |
|-----------|-------------|
| [references/design-principles.md](references/design-principles.md) | When reviewing or writing code — all 13 principles with violation signals and fixes |
| [references/design-patterns.md](references/design-patterns.md) | When architecture patterns are needed — 13 patterns with when to apply |
| [references/python-rules.md](references/python-rules.md) | Always — Pydantic, logging, enums, linting, no magic try/except, explore-before-implement |
| [references/review-agent.md](references/review-agent.md) | After implementing non-trivial code — spawn an independent review agent |

## Quick Start

1. Read [references/python-rules.md](references/python-rules.md) — always loaded
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
