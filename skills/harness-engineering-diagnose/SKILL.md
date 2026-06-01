---
name: harness-engineering:diagnose
description: Diagnostic loop — when something fails, attribute the failure to one of five harness layers (Instructions, Environment, State, Scope, Verification), fix that layer, and retry. Never fail the same way twice. Use when encountering any failure, bug, or unexpected behavior.
---

# Diagnostic Loop

From walkinglabs Lecture 01: *Why Capable Agents Still Fail*.

> When things fail, don't swap the model first — check the harness. — walkinglabs

## The Core Loop

```
Execute → Observe Failure → Attribute to Layer → Fix That Layer → Retry
```

**Never respond to a failure with "the model isn't good enough."** The model didn't change — the harness has a structural defect.

## The Protocol

### Step 1: Observe the Failure

Collect ALL evidence:
- Exact error message (copy-paste, don't paraphrase)
- Expected behavior vs actual behavior
- Files involved (what was being changed, what threw the error)
- Commands run (what verification was attempted)
- Context (what task was being attempted)

### Step 2: Attribute to One Layer

Map the failure to exactly ONE of the five layers. If you can't decide, you haven't understood it.

**Load [references/diagnostic-loop.md](../harness-engineering/references/diagnostic-loop.md) for the full five-layer attribution table with symptoms, harness fixes, and worked examples for each layer:**

| Layer | Question | Reference Section |
|-------|----------|-------------------|
| **Instructions** | Was the task unclear? | See reference: Layer 1 |
| **Environment** | Were there env/config issues? | See reference: Layer 2 |
| **State** | Was state lost between sessions? | See reference: Layer 3 |
| **Scope** | Did the agent overreach or under-finish? | See reference: Layer 4 |
| **Verification** | Were there no verification methods? | See reference: Layer 5 |

### Step 3: Fix That Layer

Apply the fix to the harness, not just to the code. Update the harness file so this class of failure never happens again. The reference file has specific fix patterns for each layer.

### Step 4: Retry

Run verification again. If same failure → attribute was wrong, go back to Step 2. If new failure → new layer, new fix.

### Step 5: Never Fail the Same Way Twice

If a failure class recurs, the harness fix was wrong. The diagnostic loop is incomplete until the failure stops recurring.

## The Failure Log

From walkinglabs Lecture 01. Keep a failure log in progress.md. See [references/diagnostic-loop.md](../harness-engineering/references/diagnostic-loop.md) for the template.

```markdown
## Failure Log

| Date | Task | Failure | Layer | Fix | Recurred? |
|------|------|---------|-------|-----|-----------|
| ...  | ...  | ...     | ...   | ... | ...       |
```

After 5-10 rounds, you'll see which layer is the bottleneck and focus energy there.

## Complex Failures — Multi-Layer Diagnosis

Load [references/diagnostic-loop.md](../harness-engineering/references/diagnostic-loop.md) for the full protocol. The key principle: diagnose the PRIMARY layer (the one that, if fixed, would have prevented the failure). Fix order: Environment first (so agent can verify), then re-evaluate other layers.

Layer attribution is about finding the ROOT cause, not just the first symptom. Ask: "If I fix this layer, does this class of failure stop happening?"

## The Golden Rule

**If the same model succeeds on similar, well-structured tasks, assume it's a harness problem.** Nine times out of ten, the problem lives in one of the five layers — not in the model.
