---
name: code-quality
description: Enforce code quality when writing, reviewing, refactoring, or auditing code in ANY language. Use this skill whenever the user mentions code quality, clean code, design principles, software design, SOLID, refactoring, code review, wants to improve code, or asks about writing well-designed code. Supports Python and Rust with language-specific rules. Also use when the user says "make this better", "improve this", "clean up this code", or any variation suggesting code improvement. This skill is rigid — its rules must be followed, not negotiated.
---

# Code Quality

Enforces design principles from *Software Design for Python Programmers* by Ronald Mak, plus language-specific rules for types, validation, logging, and clean code. Supports **Python** and **Rust**.

## Relationship to harness-engineering

This skill is the **inner loop** — applied during implementation. Load [harness-engineering](../harness-engineering/SKILL.md) for the **outer loop** (session discipline, spec-before-code, verification pipeline). The two skills hand off at specific points:
- **Phase 5 BEFORE** — harness requires passing the comprehension gate (read all principles + language rules) before any code is written
- **Phase 5 DURING** — all code must comply with code-quality rules (13 design principles + language-specific rules)
- **Phase 6 Step 3** — harness spawns an independent code-quality review agent (per `references/review-agent.md`) to audit the diff
- **Phase 6 GATE** — code quality review must pass (0 MAJOR/BLOCKING findings) before completion

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

## Comprehension Gate — READ BEFORE WRITING CODE

**Before writing, modifying, or reviewing any code, the agent MUST fully read and understand ALL applicable rules AND discover all existing types in the codebase.** Skimming the checklist is not reading. "I get the idea" is not understanding. The reference files exist because the rules cannot be summarized in a checklist — the agent must read them.

### Mandatory Reading Sequence

Execute in strict order. Do not skip any step. Do not write code until all steps complete. **If you think you already know the rules from a previous session, you're wrong — read them again. Rules evolve, and memory degrades.**

1. **Discover project types (Codebase Type Discovery)** — BEFORE reading any reference file, find and read ALL existing type definitions in the project. This is the single most important step. Agents that skip this write `cfg: Any` when `AppConfig` exists 3 files away.

   **Execute these searches IN ORDER:**
   ```
   a. Glob for model/type files:  **/*.py (or **/*.rs) — focus on models/, types/, schemas/, core/ directories
   b. Grep for type definitions:  "class.*BaseModel|class.*TypedDict|@dataclass|class.*Enum|NewType|TypeAlias|type .*=" 
   c. Grep for config types:      "class.*Config|class.*Settings|class.*Options"
   d. Grep for driver/client types: "class.*Driver|class.*Client|class.*Connection|class.*Session"
   e. Read EVERY file that matches — not just the class name, the FULL file with all fields and methods
   ```

   **Build a Type Inventory** — after reading, you MUST be able to answer:
   - What is the config type? (e.g., `AppConfig`, `Settings`, `PipelineConfig`)
   - What are the driver/client types? (e.g., `Neo4jDriver`, `AsyncDriver`, `HttpClient`)
   - What domain models exist? (e.g., `Checkpoint`, `EntityRow`, `UserRecord`)
   - What enums exist? (e.g., `OrderStatus`, `AgentKey`, `PipelinePhase`)
   - What type aliases exist? (e.g., `JsonValue`, `UserId`)

   **Rule:** If a type exists in the codebase for a concept, you MUST use it. Writing `Any`, `object`, or a generic stand-in when a real type exists is a **BLOCKING violation** — not a style issue, a correctness bug. The type exists. Use it.

2. **Read all project documentation** — Read every `.md` file that provides context about the codebase:
   - `AGENTS.md` / `CLAUDE.md` — project conventions, hard constraints, architecture
   - `PROGRESS.md` — what's done, what's in progress, known issues
   - `DECISIONS.md` — locked architectural choices
   - `docs/GRAPH.md` — code flow connections
   - `docs/codebase-map.md` — file roles and dependencies
   - `docs/business/*.md` — domain rules
   - `docs/specs/*.md` — feature specifications (at least the relevant one)

   **Why:** These files contain context that prevents you from re-inventing existing patterns, contradicting locked decisions, or misunderstanding domain rules. An agent that doesn't read them will build the wrong thing.

3. **Read design principles** — [references/design-principles.md](references/design-principles.md). Every principle. Every violation signal. Every fix. All 13. Do not skim the table — read the full text for each principle. Understanding WHY a principle exists is what prevents you from violating it.
4. **Read language rules** — [references/python/rules.md](references/python/rules.md) or [references/rust/rules.md](references/rust/rules.md). Naming conventions (no leading-underscore on ANY name), Pydantic/serde at boundaries, fully parameterized generics (no bare dict/list/set/tuple), enums for all fixed choices, structured logging, flat functions (no nested def), empty `__init__.py`, config injection, one-way imports, no water.
5. **Read language examples** — [references/python/examples.md](references/python/examples.md) or [references/rust/examples.md](references/rust/examples.md). See each principle and pattern in real code. The examples show correct implementation — copy the pattern, not just the concept.
6. **If designing new components/architecture:** Read [references/design-patterns.md](references/design-patterns.md). Pattern selection guide, when to use which pattern, the cheat sheet.

### Comprehension Self-Check

Before writing ANY code, the agent must answer YES to ALL seven questions:

- [ ] Can I list every type in this project's Type Inventory? (config types, driver types, domain models, enums, type aliases)
- [ ] For the code I'm about to write, do I know the EXACT type for every parameter? (not `Any`, not `object` — the real type)
- [ ] Can I name all 13 design principles and what violation each prevents?
- [ ] Can I recognize at least one violation signal for each principle?
- [ ] Do I know all 11 tooling rules (types, DI, enums, naming, logging, exceptions, lint, type-check, no-water, flat-functions, init-files)?
- [ ] Do I know what code I'm about to write and which rules are most relevant to it?
- [ ] If I encountered a violation while reviewing, do I know the correct fix pattern?

**If ANY answer is NO:** Re-read the relevant reference file or re-run the type discovery. Do not write code until all seven are YES.

### Gate Rule

**Do not write, modify, or review a single line of code until the mandatory reading sequence is complete AND the comprehension self-check passes all seven items.** The agent's first response after loading this skill must include: "Type inventory: [N types discovered]. Read [N] reference files. Read [N] doc files. Comprehension check: [PASS/FAIL]." Only then may code work begin.

### Quick Reference

Once the comprehension gate passes, use these as reminders while implementing:

| Reference | Use When |
|-----------|----------|
| [references/design-principles.md](references/design-principles.md) | Checking your code against all 13 principles |
| [references/design-patterns.md](references/design-patterns.md) | Choosing a pattern for new architecture |
| [references/python/rules.md](references/python/rules.md) | Python — every line must comply |
| [references/rust/rules.md](references/rust/rules.md) | Rust — every line must comply |
| [references/python/examples.md](references/python/examples.md) | Python — need a reference implementation |
| [references/rust/examples.md](references/rust/examples.md) | Rust — need a reference implementation |
| [references/review-agent.md](references/review-agent.md) | After implementing — spawn independent review |

## Audit Checklist (Quick Reference)

When reviewing code, check all 13 [design principles](references/design-principles.md) plus these 12 tooling items:

1. **Type discovery done** — agent read all existing types in the codebase BEFORE writing code. If `AppConfig` exists and the code says `cfg: Any`, the agent skipped type discovery — BLOCKING violation.
2. Types — Pydantic/serde at boundaries, fully parameterized generics, no `Any`/`object` as inner type parameter (replace with: TypedDict/Pydantic/dataclass for data, Callable/Protocol for callables, NewType for primitives, Enum/Literal for fixed sets). **`Any` when a real type exists in the codebase = BLOCKING, not just a style issue.**
3. DI — external dependencies (driver, client, connection, session) constructor-injected, never passed as function parameters
4. Enums — all fixed choice sets are enums, including factory/registry keys (no magic strings)
5. Naming — no leading-underscore on ANY name (functions, methods, variables, attributes); `__init__.py` must be empty
6. Logging — structured logging, no print()/println!()
7. No bare except — specific exceptions only
8. Lint clean — project linter passes
9. Type check clean — project type checker passes
10. No water — every line earns its place
11. Flat functions — no nested `def` inside `def`; every function at module level or class method
12. Init files — `__init__.py` present in every package directory, always empty

### `Any` Severity Escalation

| Situation | Severity | Action |
|-----------|----------|--------|
| `Any` used, no matching type exists anywhere in project | MAJOR | Create the proper type (Pydantic/dataclass/TypedDict/Enum) |
| `Any` used, matching type EXISTS in project (e.g., `cfg: Any` when `AppConfig` exists) | **BLOCKING** | Use the existing type. This means type discovery was skipped. |
| `Any` used in truly generic context (JSON parser, cache) | MINOR | Document why `Any` is unavoidable, use `JsonValue` union if possible |
