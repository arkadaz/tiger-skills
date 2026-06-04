---
name: code-quality-audit
description: Audit existing code for design principle violations — scan files or modules against all 16 design principles, identify violations with file:line references, and produce a ranked audit report. Use when auditing a codebase, reviewing architecture, or checking SOLID compliance.
---

# Code Quality Audit

Audit existing code against all 16 design principles. Produces a ranked violation report with file:line references and fix suggestions.

## Audit Protocol

### 1. Select Scope

Identify what to audit:
- Specific file(s) the user named
- Module or package the user referenced
- Recent diff (changed files)
- Full codebase (if user requests comprehensive audit)

### 2. Read the Code

Read every file in scope. Do NOT audit from file names or assumptions. An audit of code you haven't read is worthless.

### 3. Check Each Principle

For each of the 16 principles, ask the diagnostic question:

| # | Principle | Diagnostic Question |
|---|-----------|-------------------|
| 1 | Single Responsibility | Does this class/module have more than one reason to change? |
| 2 | Encapsulate What Varies | Is variable behavior isolated behind a stable interface? |
| 3 | Least Knowledge | Does any module reach into another module's internals? |
| 4 | DRY | Is the same logic duplicated in two or more places? |
| 5 | Open-Closed | Would adding a new variant require editing existing code? |
| 6 | Code to Interface | Do consumers depend on concrete types instead of abstractions? |
| 7 | Liskov Substitution | Can every subtype fully substitute its supertype? |
| 8 | Composition over Inheritance | Is inheritance used where composition would be cleaner? |
| 9 | Least Astonishment | Do any function names misrepresent what they do? |
| 10 | Lazy Evaluation | Is expensive work done before it's needed? |
| 11 | Class Invariant | Can any object be constructed or left in an invalid state? |
| 12 | Precondition | Are function entry conditions validated? |
| 13 | Postcondition | Are function exit conditions guaranteed? |
| 14 | Delegation | Is any module doing work that belongs to another? |
| 15 | Factory | Is object creation scattered where a factory would centralize it? |
| 16 | Defensive Programming | Are boundaries unguarded against invalid inputs? |

### 4. Check the Tooling Rules

Invoke `code-quality-language`. It infers the Language Profile from the repo and applies the 11 tooling rules (types, DI, enums, naming, logging, error handling, I/O validation, flat functions, lint/type/format, module hygiene, no water) through that language's idioms. Works for any language — Python and Rust are the worked examples.

### 5. Check Layer Discipline

Imports must flow inward (applies in any layered codebase):
```
api/ → services/ → repositories/ → models/
```

Violations:
- `models/` importing from `services/` or `api/` → **BLOCKING**
- `services/` importing from `api/` → **BLOCKING**
- Layer skipping (api/ → repositories/) → **MAJOR**

### 6. Check Module Health

- Files under 300 lines (over = candidate for split)
- Classes under 15 public methods (over = SRP violation likely)
- Functions under 30 lines (over = does too much)
- No circular imports
- Config injected, never imported globally

## Audit Report Template

```markdown
# Code Quality Audit: [scope]

## Summary
- **Files audited:** N
- **Total violations:** N (BLOCKING: N, MAJOR: N, MINOR: N)
- **Health score:** [N]/16 principles passing

## Violations by Severity

### BLOCKING
| # | Principle | File:Line | Problem | Fix |
|---|-----------|-----------|---------|-----|
| 1 | SRP | `services.py:45` | Class has 12 public methods, 3 responsibilities | Split into OrderService, PricingService, NotificationService |

### MAJOR
| # | Principle | File:Line | Problem | Fix |
|---|-----------|-----------|---------|-----|

### MINOR
| # | Principle | File:Line | Problem | Fix |
|---|-----------|-----------|---------|-----|

## Principle Health Map
| Principle | Status | Worst File |
|-----------|--------|-----------|
| SRP | ⚠️ 3 violations | services.py |
| OCP | ✅ Clean | — |
| DRY | ⚠️ 1 violation | api.py |
| ... | ... | ... |

## Layer Discipline
- [ ] Import flow is inward-only
- [ ] No circular imports
- [ ] Config is centralized and injected

## Recommendations
1. [Highest-impact fix]
2. [Next fix]
3. [Pattern improvement]
```

## Audit Severity

| Severity | Definition | Must Fix? |
|----------|-----------|-----------|
| **BLOCKING** | Would prevent the system from working correctly, or introduces a security vulnerability, or violates a hard constraint | Yes, immediately |
| **MAJOR** | Degrades maintainability, creates tech debt, or violates a design principle in a way that will cause problems | Yes, before merge |
| **MINOR** | Style inconsistency, minor naming issue, pattern preference | Fix or document deferral |
