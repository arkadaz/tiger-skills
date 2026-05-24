# Systematic Debugging

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue: test failures, bugs, unexpected behavior, performance problems, build failures, integration issues.

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (systematic is faster than thrashing)

## The Four Phases

Complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read error messages carefully** — don't skip past errors or warnings. Read stack traces completely. Note line numbers, file paths, error codes. They often contain the exact solution.

2. **Reproduce consistently** — can you trigger it reliably? What are the exact steps? If not reproducible, gather more data — don't guess.

3. **Check recent changes** — `git diff`, recent commits, new dependencies, config changes, environmental differences.

4. **Gather evidence in multi-component systems** — before proposing fixes, add diagnostic instrumentation at each component boundary. Log what enters, what exits, verify environment/config propagation at each layer. Run once to find WHERE it breaks, THEN investigate that component.

5. **Trace data flow backward** — trace backward through the call chain until you find the original trigger:
   - Where does the bad value originate?
   - What called this with the bad value?
   - Keep tracing up until you find the source
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

1. **Find working examples** — locate similar working code in the same codebase
2. **Compare against references** — read reference implementations COMPLETELY, not skimming
3. **Identify differences** — list every difference between working and broken, however small
4. **Understand dependencies** — what other components, settings, config, or environment does this need?

### Phase 3: Hypothesis and Testing

1. **Form single hypothesis** — state clearly: "I think X is the root cause because Y." Be specific.
2. **Test minimally** — make the SMALLEST possible change. One variable at a time.
3. **Verify** — did it work? Yes → Phase 4. No → form NEW hypothesis. Do NOT add more fixes on top.
4. **When you don't know** — say "I don't understand X." Don't pretend. Research more.

### Phase 4: Implementation

1. **Create failing test case** — simplest possible reproduction. Automated if possible. MUST have before fixing.
2. **Implement single fix** — address the root cause. ONE change at a time. No "while I'm here" improvements.
3. **Verify fix** — test passes? No other tests broken? Issue actually resolved?
4. **If fix doesn't work** — STOP. Count fixes attempted.
   - If < 3: return to Phase 1, re-analyze with new information
   - **If ≥ 3: STOP and question architecture** — 3+ failed fixes means the pattern is fundamentally wrong, not just buggy. Discuss with user before more attempts.

## Defense-in-Depth Validation

When you fix a bug caused by invalid data, validate at EVERY layer data passes through. Single validation can be bypassed by different code paths, refactoring, or mocks.

### The Four Layers

| Layer | Purpose | Example |
|-------|---------|---------|
| **1 — Entry point** | Reject obviously invalid input at API boundary | Validate not empty, exists, correct type |
| **2 — Business logic** | Ensure data makes sense for this operation | Domain-specific invariant checks |
| **3 — Environment guards** | Prevent dangerous operations in specific contexts | Refuse destructive ops in test mode |
| **4 — Debug instrumentation** | Capture context for forensics | Log data + stack trace before dangerous operations |

**All four layers are necessary.** During testing, each layer catches bugs the others miss: different code paths bypass entry validation, mocks bypass business logic, edge cases need environment guards.

## Condition-Based Waiting

When tests or integrations involve async operations, wait for the actual condition — not an arbitrary delay.

```python
# WRONG — guessing at timing
import time
time.sleep(0.5)
result = get_result()

# RIGHT — waiting for condition
import time
start = time.time()
while time.time() - start < 5.0:
    result = get_result()
    if result is not None:
        break
    time.sleep(0.01)
```

| When to use | When arbitrary timeout is OK |
|------------|------------------------------|
| Waiting for async operations to complete | Testing actual timing behavior (debounce, throttle) |
| Flaky tests that pass/fail inconsistently | Always document WHY if using arbitrary timeout |
| Tests with race conditions | |

## Red Flags — STOP and Follow Process

If you catch yourself thinking any of these, STOP. Return to Phase 1:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- "One more fix attempt" (when already tried 2+)

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. Question pattern, don't fix again. |

## Diagnostic Loop Integration

This debugging process plugs into the [workflow.md](workflow.md) diagnostic loop at any step. When verification fails:

1. Apply Phase 1 (root cause) to identify WHICH layer failed: spec / context / environment / verification / state
2. Apply Phase 2-3 (pattern analysis + hypothesis) to identify the specific fix
3. Apply Phase 4 (implementation) to fix and verify
4. Update the harness so this class of failure never happens again
