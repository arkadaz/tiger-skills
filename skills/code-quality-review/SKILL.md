---
name: code-quality-review
description: Independent code quality review — spawn a review agent to audit a diff against all 16 design principles and language-specific tooling rules. Separate the doer from the checker. Use after implementation, before claiming completion.
---

# Code Quality Review

Independent code review against all 16 design principles + language-specific tooling rules. **The agent that wrote the code cannot be the sole judge of its quality.** Agents systematically over-rate their own output.

**Which review to use:** This skill checks code quality. For harness compliance (state files, verification, clean state), also invoke `harness-engineering-review`. See that skill for a full comparison table. For a complete pre-merge review, invoke both.

## When Review Is Required

| Change Type | Required? |
|------------|-----------|
| New class or module | **Yes — mandatory** |
| Function >15 lines added or modified | **Yes — mandatory** |
| New API endpoint or public interface | **Yes — mandatory** |
| Change touches shared infrastructure (DB, auth, config) | **Yes — mandatory** |
| Change spans 3+ files | **Yes — mandatory** |
| Bug fix (single line, obvious) | Optional |
| Typo / formatting / config value | No |

## How to Spawn

Use the Agent tool:

```
You are an independent code review agent. Audit this diff:

FIRST: Infer the Language Profile (invoke code-quality-language) — detect the language and its type system, "any" escape hatch, enum mechanism, DI idiom, logging library, error model, I/O validation, and lint/type/format toolchain from the repo's manifests and existing code. Then run type discovery — search for all existing type/struct/interface/enum definitions and build a Type Inventory.

THEN: Check against all 27 items:
  16 design principles + 11 tooling rules. The tooling rules are intents — apply each through the detected language's idioms.

DESIGN PRINCIPLES (16):
1. Single Responsibility — class/module has one reason to change
2. Encapsulate What Varies — isolate changeable code
3. Least Knowledge (Law of Demeter) — expose only what's needed
4. DRY — no duplicate code
5. Open-Closed — open for extension, closed for modification
6. Code to Interface — depend on abstractions
7. Liskov Substitution — subtypes fully substitute
8. Composition over Inheritance — HAS-A over IS-A
9. Least Astonishment — no surprises
10. Lazy Evaluation — defer expensive work
11. Class Invariant — condition true across states
12. Precondition — what's true before calling
13. Postcondition — what's true after returning
14. Delegation — delegate to best-suited class
15. Factory — encapsulate object creation
16. Defensive Programming — guard boundaries

TOOLING RULES (11) — intents; apply via the detected language's idioms:
17. Types — no "any" escape hatch where a real type exists; no unparameterized generics
18. DI — external dependencies injected at construction, not threaded through functions
19. Enums — fixed choice sets are typed enums/sum types, not magic values
20. Naming — idiomatic casing for the language; no privacy-by-underscore unless idiomatic
21. Logging — structured logging library, never the raw print primitive
22. Errors — explicit, specific handling; no catch-all/ignored errors; no crash-in-library
23. Lint/type-check/format — the project's own toolchain passes with zero errors
24. No water — every line earns its place
25. Flat functions — no nested function definitions / deep nesting where a flatter form exists
26. Module/entry hygiene — entry points re-export only; imports flow inward
27. Explore first — no duplicate of existing functions/types

CRITICAL: If you find the language's "any" type — check the Type Inventory. Real type exists → BLOCKING.
No type but known structure → BLOCKING (agent should have created one).

For each violation: file:line, item #, severity (BLOCKING/MAJOR/MINOR), problem, fix.
Do NOT modify code. Report findings only.
```

## Review Report Template

```markdown
# Code Review: [feature/task]

## Summary
- **Files reviewed:** N
- **Audit score:** [passed]/27 items
- **Severity:** CLEAN / MINOR / MAJOR / BLOCKING

## Violations

### [Category] — item #[N]
- **File:** `path/file.py:line`
- **Severity:** BLOCKING / MAJOR / MINOR
- **Problem:** [specific description]
- **Fix:** [concrete suggestion]

## Verdict
- [ ] APPROVED — no violations or trivial only
- [ ] APPROVED WITH CHANGES — minor violations, fix before merge
- [ ] CHANGES REQUESTED — major/blocking violations
- [ ] REJECTED — fundamental issues, needs redesign
```

## Common Findings Agents Miss

(Examples below are in Python; map each to the active language's idiom — `any` in TS, `interface{}` in Go, `object`/`dynamic` in C#, `Box<dyn Any>` in Rust, `console.log`/`fmt.Println`/`System.out` for logging, etc.)

- **`Any` used when real type exists** — e.g., `cfg: Any` when `AppConfig` exists → BLOCKING
- **`Any` when no type but known structure** — e.g., `-> dict[str, Any]` returning structured data → BLOCKING
- **Bare generics** — `dict` instead of `dict[str, str]`
- **print() instead of logging** — operational output must use `logging`
- **Magic strings** — `"pending"` instead of `OrderStatus.PENDING`
- **Pass-through DI** — `driver` as function parameter instead of constructor-injected
- **Leading underscore** — `_private` on any name
- **Nested functions** — `def` inside `def`
- **Code in __init__.py** — must be empty
- **Missing type on new public function** — every parameter and return typed

## After Review

1. Fix every BLOCKING and MAJOR violation
2. Fix MINOR or document deferral
3. Re-run verification after fixes
4. Commit fixes separately from original implementation
