---
name: code-quality:language
description: Language-agnostic code quality rules — the same tooling rules applied to ANY programming language by inferring that language's idioms from the codebase. Use when writing, reviewing, or auditing code in any language (Python, Rust, TypeScript, Go, Java, C#, C++, …). Replaces per-language skills with one universal rule set. This skill is rigid — its rules must be followed, not negotiated.
---

# Code Quality — Language-Agnostic Rules

The 16 design principles and 13 patterns (in `code-quality`) are universal. So are these **11 tooling rules** — they are *intents*, not syntax. This skill states each intent in language-neutral terms, then shows how to realize it in the language in front of you. **You infer the language's idioms from the repo; you do not need a hand-written profile per language.**

Python and Rust are the two worked examples throughout. Any other language follows the same intents — find its idioms with the method below.

## Step 0 — Infer the Language Profile (before any rule)

Read the repo, not the user. Determine, from manifests and existing code:

| Profile slot | How to find it | Python | Rust |
|--------------|----------------|--------|------|
| Language + version | manifest / toolchain file | `pyproject.toml`, `.python-version` | `Cargo.toml`, `rust-toolchain` |
| "Any" escape hatch (to avoid) | the type the language uses for "unknown" | `Any`, `object`, bare `dict`/`list` | `Box<dyn Any>`, `serde_json::Value` in logic |
| Enum / sum type | how fixed choice sets are modelled | `enum.Enum`, `Literal` | `enum` |
| DI idiom | how dependencies are passed | constructor (`__init__`) | struct fields + generics/`dyn` traits |
| Logging library | existing import for logs | `logging` | `tracing` / `log` |
| Error model | how failures propagate | exceptions (specific) | `Result` + `?`, `thiserror`/`anyhow` |
| I/O validation | schema lib at boundaries | Pydantic / dataclass | `serde` + `validate` |
| Lint / type / format | config files present | `ruff`, `mypy --strict` | `clippy -D warnings`, `cargo fmt` |
| Test runner | test config | `pytest` | `cargo test` |
| Module layout | existing package shape | packages + empty `__init__.py` | `mod.rs` / `lib.rs` re-exports |

For a language not shown: open its build file (`package.json`, `go.mod`, `*.csproj`, `pom.xml`, `build.gradle`, `CMakeLists.txt`, …), read its lint/format config, and read a few existing files. Match each profile slot to what the project already uses. **Never invent a tool the project doesn't use; mirror the project's choices.**

## The 11 Tooling Rules (language-neutral intents)

### 17. Types over untyped — no escape hatch where a real type exists
**Intent:** use the language's strongest static typing; never use its "anything" type when a concrete type exists or the structure is known. Discover existing types first; if none exists for known-structured data, **create the type before the signature.**
- Python: no bare `dict`/`list`; no `Any` — use `dict[str,int]`, dataclass/Pydantic/`TypedDict`/`Protocol`.
- Rust: no `Box<dyn Any>`, no `serde_json::Value` through business logic — use newtypes and domain structs.
- Any language: find its "any" (`any` in TS, `interface{}`/`any` in Go, `object`/`dynamic` in C#, `void*` in C) and replace it with a real type.

### 18. Dependency Injection — inject, don't thread
**Intent:** external dependencies (db driver, client, connection, session, queue, bucket) are injected once at construction, not passed into every function.
- Python: constructor `__init__` parameters → `self.driver`.
- Rust: struct fields, generic over traits (`OrderService<N: Notifier>`).
- Any language: the idiomatic constructor/factory/closure — never a global singleton for business deps.

### 19. Enums for fixed choice sets — no magic values
**Intent:** any fixed set (status, kind, role, mode) is a typed enum/sum type, never a magic string or int, with exhaustive handling where the language supports it.
- Python: `class Status(Enum)` / `Literal[...]`.
- Rust: `enum Status { … }` with exhaustive `match`.
- Any language: TS string-literal unions / `enum`; Go typed consts + `iota`; Java/C# `enum`/sealed types.

### 20. Naming — idiomatic for the language
**Intent:** follow the language's idiomatic casing for constants, types, functions, variables; no foreign conventions; no privacy-by-underscore unless the language is underscore-private.
- Python: `snake_case` funcs, `PascalCase` types, `SCREAMING_SNAKE` constants; **no leading underscore** (module structure is the privacy model).
- Rust: `snake_case` funcs/modules, `PascalCase` types/variants, `SCREAMING_SNAKE` consts.
- Any language: match its style guide (e.g. `camelCase` methods in TS/Java/C#). Wrong-language casing is a violation.

### 21. Structured logging — never raw stdout for operational output
**Intent:** use the project's logging/tracing library with structured fields; never the raw print primitive for operational output.
- Python: `logging` (`logger.info(..., extra={...})`), not `print()`.
- Rust: `tracing`/`log`, not `println!`.
- Any language: not `console.log` (TS), `fmt.Println` (Go), `System.out` (Java), `Console.Write` (C#).

### 22. No swallowed errors — explicit, specific handling
**Intent:** handle failures with the language's error mechanism; no catch-all that hides errors; no silent ignore; no crash-on-error in library code.
- Python: specific `except SomeError`, never bare `except:`/`except Exception:` without reason.
- Rust: propagate with `?`; no `unwrap()`/`expect()` in library code.
- Any language: TS — don't swallow in `catch {}`; Go — don't `_ = err`; check and wrap.

### 23. Validate at I/O boundaries — parse, don't trust
**Intent:** data entering the process (HTTP, files, DB rows, queues, webhooks) is parsed/validated into domain types at the edge; invalid data fails at the boundary, not deep in logic.
- Python: Pydantic models at boundaries.
- Rust: `serde` + validation at deserialization.
- Any language: zod (TS), struct tags + validation (Go), records + validation (Java/C#).

### 24. Flat functions — shallow, named, module-level
**Intent:** prefer small module-level/free functions; avoid deep nesting and nested function definitions where the language offers a flatter form.
- Python: no `def` inside `def` — extract to module level.
- Rust: free functions / methods over nested closures for non-trivial logic.

### 25. Lint + type-check + format clean — zero errors
**Intent:** run the project's linter, type checker, and formatter after every change; zero errors/warnings.
- Python: `ruff check` + `mypy --strict`.
- Rust: `cargo clippy -- -D warnings` + `cargo fmt --check`.
- Any language: `eslint`+`tsc --strict`; `golangci-lint`+`gofmt`; `dotnet format`+analyzers; etc. Read the repo's config; run what it defines.

### 26. Module / entry hygiene — entry points re-export, layers flow inward
**Intent:** package entry points carry no logic (only re-exports); imports flow inward (`api → services → repositories → models`); no circular dependencies.
- Python: empty `__init__.py`; inward imports.
- Rust: `mod.rs`/`lib.rs` re-export only.
- Any language: barrel `index.ts` re-exports only; Go package boundaries; assembly/namespace boundaries.

### 27. No water — every line earns its place
**Intent:** delete dead code, commented-out blocks, redundant comments that restate code, and unused imports. Applies to every language identically.

## Applying the rules

1. **Infer the Language Profile** (Step 0) from the repo's manifests and existing code.
2. For each rule, translate the intent into that language's idiom using the profile.
3. Run the project's own lint/type/format/test commands as evidence (Rule 25).
4. A rule that the language enforces natively (e.g. Rust has no implementation inheritance, so Composition-over-Inheritance is largely free) is satisfied by idiom — note it and move on.

## Deep-dive worked examples

- Python: [code-quality references/python/rules.md](../code-quality/references/python/rules.md) and [examples.md](../code-quality/references/python/examples.md)
- Rust: [code-quality references/rust/rules.md](../code-quality/references/rust/rules.md) and [examples.md](../code-quality/references/rust/examples.md)

For any other language, these two are the template: same rule numbers, same intents, that language's idioms.

## Proof line

When invoked by an agent, begin the report with:

```
code-quality:language invoked: YES — language: <detected>, N violations found, N fixed
```
