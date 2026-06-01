---
name: harness-engineering:review
description: Independent code review — separate the doer from the checker. Spawn an independent review agent to audit work against design principles, tooling rules, and spec compliance. Use after implementation, before claiming completion.
---

# Independent Review

From walkinglabs core principle: **separate the doer from the checker.** Agents systematically over-rate their own output (Anthropic, 2026). The agent that wrote the code cannot be the sole judge of its quality.

> "Agents confidently praise their own work." — Anthropic. The fix: "separate the person who does the work from the person who checks the work." — walkinglabs, Lecture 02

## Which Review Skill to Use

This skill (`harness-engineering:review`) checks **harness compliance** — did the agent follow the process? For **code quality** (design principles, tooling rules, types), also invoke `code-quality:review`.

| What to Check | Skill to Invoke |
|---------------|----------------|
| Harness compliance (state files updated, verification ran, clean state) | `harness-engineering:review` (this skill) |
| Code quality (16 design principles, 11 tooling rules, types, DI, enums) | `code-quality:review` |
| Both (full review before merge) | Invoke both — harness first, then code quality |

## When Review Is Required

| Change Type | Review Required? |
|------------|-----------------|
| New module or class | **Yes — mandatory** |
| Function >15 lines added or modified | **Yes — mandatory** |
| New API endpoint or public interface | **Yes — mandatory** |
| Change touches shared infrastructure (DB, auth, config) | **Yes — mandatory** |
| Change spans 3+ files | **Yes — mandatory** |
| Bug fix (single line, obvious) | Optional |
| Typo / formatting / config value | No |
| Test-only change | Optional (but another agent should run them) |

## The Review Flow

```
Implementation Agent          Review Agent
─────────────────────         ─────────────
1. Writes code
2. Self-verifies (init.sh)
3. Commits locally
4. Spawns review agent ─────→ 5. Reads the diff
                               6. Audits against principles
                               7. Files violations with line refs
8. Reads review findings
9. Addresses every BLOCKING/MAJOR violation
10. Re-runs verification
11. Commits fixes
12. Records review outcome
```

**The review agent does NOT modify code.** It only reports findings. The implementation agent decides how to fix each issue.

## How to Spawn the Review Agent

Use the Agent tool:

```
You are an independent code review agent. Audit the current diff against these dimensions:

1. SPEC COMPLIANCE — Does the code match what the feature spec says? All behaviors? All error cases? No scope creep?

2. DESIGN PRINCIPLES — Check against:
   - Single Responsibility: each class/module has one reason to change
   - Open/Closed: open for extension, closed for modification
   - DRY: no duplicate code
   - Interface Segregation: no client depends on methods it doesn't use
   - Dependency Inversion: depend on abstractions, not concretions
   - Composition over Inheritance: HAS-A over IS-A
   - Least Astonishment: no surprises
   - Defensive Programming: guard against invalid states

3. CODE QUALITY:
   - Types: no bare dict/list/set/tuple, no Any where real types exist
   - DI: external dependencies constructor-injected, not passed as parameters
   - Enums: fixed choice sets are enums, not magic strings
   - Naming: no leading underscore on any name
   - Logging: structured logging, never print()
   - No bare except: specific exceptions only
   - Flat functions: no nested def
   - No water: every line earns its place

4. HARNESS COMPLIANCE — Does the code leave the harness clean?
   - ./init.sh still passes?
   - feature_list.json updated?
   - progress.md updated?

For each violation: cite file:line, name the principle violated, explain what's wrong, suggest a fix.
Severity: BLOCKING (must fix now), MAJOR (should fix now), MINOR (can defer).

CRITICAL: If you find Any anywhere, search the codebase for a real type. If a real type exists and wasn't used → BLOCKING.
If no type exists but data has known structure → BLOCKING (agent should have created a type first).

Do NOT modify code. Report findings only.
```

## Review Report Template

```markdown
# Review: [feature/task name]

## Summary
- **Files reviewed:** N
- **Violations:** [BLOCKING: N, MAJOR: N, MINOR: N]
- **Verdict:** APPROVED / APPROVED WITH CHANGES / CHANGES REQUESTED / REJECTED

## Violations

### [Category] — [Principle]
- **File:** `path/file.py:line`
- **Severity:** BLOCKING / MAJOR / MINOR
- **Problem:** [specific description]
- **Fix:** [concrete suggestion]

## Observations (non-blocking)
- [Improvement idea that isn't a violation]
- [Pattern noticed across files]

## Verdict
- [ ] APPROVED — no violations, or violations are trivial
- [ ] APPROVED WITH CHANGES — minor violations, can fix before merge
- [ ] CHANGES REQUESTED — major/blocking violations, must fix
- [ ] REJECTED — fundamental issues, needs redesign
```

## After the Review

The implementation agent MUST:
1. Read every finding
2. Fix every BLOCKING and MAJOR violation
3. Fix MINOR violations or document why they're deferred
4. Re-run verification (./init.sh) after fixes
5. Commit fixes separately from original implementation
6. Record review outcome in progress.md

## The Self-Review Check (Minimum)

Even when a full independent review isn't required, the implementation agent MUST self-review:

```
Completeness:
- Did I fully implement everything in the spec?
- Did I miss any requirements or error cases?

Quality:
- Are names clear and accurate?
- Does the code follow project conventions?
- Are types fully parameterized with no Any?

Discipline:
- Did I avoid overbuilding (YAGNI)?
- Did I only build what was requested?
- Does ./init.sh still pass?

If issues found: fix BEFORE committing. Self-review does NOT replace independent review — both are needed for non-trivial changes.
```
