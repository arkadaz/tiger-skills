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

exit "$FAILURES"
