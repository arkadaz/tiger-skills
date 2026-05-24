---
name: code-quality
description: Enforce code quality when writing, reviewing, refactoring, or auditing code in ANY language. Use this skill whenever the user mentions code quality, clean code, design principles, software design, SOLID, refactoring, code review, wants to improve code, or asks about writing well-designed code. Supports Python and Rust with language-specific rules. Also use when the user says "make this better", "improve this", "clean up this code", or any variation suggesting code improvement. This skill is rigid — its rules must be followed, not negotiated.
---

# Code Quality

Enforces design principles from *Software Design for Python Programmers* by Ronald Mak, plus language-specific rules for types, validation, logging, and clean code. Supports **Python** and **Rust**.

## Relationship to harness-engineering

This skill is the **inner loop** — applied during implementation. Load [harness-engineering](../harness-engineering/SKILL.md) for the **outer loop** (session discipline, spec-before-code, verification pipeline). The two skills hand off at specific points:
- `→ apply code-quality` — at workflow steps 6-10 (implement, verify, review)
- `→ follow harness verification` — after implementing, run the 3-layer pipeline

## Language Detection

Detect the project language from file extensions, Cargo.toml/pyproject.toml, or user context:
- `.py`, `pyproject.toml`, `requirements.txt` → Python — load [references/python-rules.md](references/python-rules.md)
- `.rs`, `Cargo.toml` → Rust — load [references/rust-rules.md](references/rust-rules.md)
- Mixed project → load both

## Five Non-Negotiables (Language-Agnostic)

1. **Explore before implement.**
2. **Types first.** Every type annotation fully parameterized. No bare `dict`/`list`/`set`/`tuple`. Never untyped data flowing through business logic.
3. **Lint and type-check every change.** Zero errors tolerated.
4. **Logs always.** Never `print()` / `println!()` for operational output.
5. **No water.** Every line earns its place.

## Reference Files

Load these as needed based on the task:

| Reference | When to Load |
|-----------|-------------|
| [references/design-principles.md](references/design-principles.md) | When reviewing/writing — 13 principles, violation signals, fixes (language-agnostic) |
| [references/design-patterns.md](references/design-patterns.md) | When architecting — pattern selection guide + cheat sheet (language-agnostic) |
| [references/python/rules.md](references/python/rules.md) | Python projects — Pydantic, logging, enums, mypy, ruff, config, structure |
| [references/python/examples.md](references/python/examples.md) | Python projects — code examples for all 13 principles + 13 patterns |
| [references/rust/rules.md](references/rust/rules.md) | Rust projects — serde, tracing, enums, clippy, cargo, config, structure |
| [references/rust/examples.md](references/rust/examples.md) | Rust projects — code examples for all 13 principles + 13 patterns |
| [references/review-agent.md](references/review-agent.md) | After implementing — spawn an independent review agent |

## Quick Start

1. Detect language → load `references/<lang>/rules.md` + `references/<lang>/examples.md`
2. If reviewing/refactoring: read [references/design-principles.md](references/design-principles.md)
3. If architecting: read [references/design-patterns.md](references/design-patterns.md)
4. After implementing: read [references/review-agent.md](references/review-agent.md) and spawn a review agent

## Audit Checklist (Quick Reference)

When reviewing code, check all 13 [design principles](references/design-principles.md) plus these 9 tooling items:

1. Types — Pydantic/serde at boundaries, fully parameterized generics (no bare `dict`/`list`/`set`/`tuple`)
2. Enums — all fixed choice sets are enums, including factory/registry keys (no magic strings)
3. Naming — no leading-underscore on ANY name (functions, methods, variables, attributes); `__init__.py` must be empty
4. Logging — structured logging, no print()/println!()
5. No bare except — specific exceptions only
6. Lint clean — project linter passes
7. Type check clean — project type checker passes
8. No water — every line earns its place
9. Flat functions — no nested `def` inside `def`; every function at module level or class method
10. Init files — `__init__.py` present in every package directory, always empty
