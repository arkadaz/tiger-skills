#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
pass() { echo "PASS: $1"; }

WORKFLOW="$ROOT_DIR/workflows/tiger-workflow-dev.js"

if ! node --check "$WORKFLOW" 2>/dev/null; then
    fail "workflow JS has syntax errors"
else
    pass "workflow JS parses cleanly"
fi

if grep -q "export const meta" "$WORKFLOW"; then
    pass "workflow has 'export const meta'"
else
    fail "workflow missing 'export const meta'"
fi

META_BLOCK=$(sed -n '/export const meta = {/,/^};/p' "$WORKFLOW")
for field in name description phases; do
    if echo "$META_BLOCK" | grep -qE "${field}[[:space:]]*:"; then
        pass "workflow meta has field '$field'"
    else
        fail "workflow meta missing field '$field'"
    fi
done

# v8 invariants the slim spine must keep: the lead's own discovery (newest-approved — no separate
# bootstrap spawn), and it launches the merged lead (which owns the e2e suite, the priority triage /
# E2E_BLOCKERS, and the bounded re-plan loop — those markers live in agents/tiger-lead.md).
for marker in "newest-approved" "E2E_BLOCKERS" "tiger-skills:tiger-lead"; do
    if grep -qF "$marker" "$WORKFLOW"; then
        pass "workflow keeps '$marker'"
    else
        fail "workflow missing required marker '$marker'"
    fi
done

# v6 branch model: dev is the integration trunk; main is the protected release branch.
if grep -qE 'branchBase[[:space:]]*\|\|[[:space:]]*"dev"' "$WORKFLOW" || grep -qE 'base:[[:space:]]*"dev"' "$WORKFLOW"; then
    pass "workflow integrates on dev (base = dev)"
else
    fail "workflow must set the integration trunk to dev (base = dev)"
fi

# The workflow must NOT spawn the standalone review gate (or the retired agents merged into the lead).
for gate in tiger-skills:tiger-security tiger-skills:tiger-review tiger-skills:tiger-architect tiger-skills:tiger-e2e; do
    if grep -qF "$gate" "$WORKFLOW"; then
        fail "workflow must NOT spawn '$gate' (standalone or merged-away)"
    else
        pass "workflow does not spawn '$gate'"
    fi
done

exit "$FAILURES"
