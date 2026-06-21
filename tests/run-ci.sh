#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FAILURES=0

run_check() {
    local label="$1"; shift
    echo ""
    echo "=== $label ==="
    if "$@"; then
        echo "--- PASSED: $label ---"
    else
        echo "--- FAILED: $label ---" >&2
        FAILURES=$((FAILURES + 1))
    fi
}

run_check "T1: agent frontmatter"   bash "$SCRIPT_DIR/t1-structural/check-agents.sh"
run_check "T1: workflow lint"       bash "$SCRIPT_DIR/t1-structural/check-workflow.sh"
run_check "T1: skill registry"      bash "$SCRIPT_DIR/t1-structural/check-skill-registry.sh"
run_check "T2: board contracts"     python3 "$SCRIPT_DIR/t2-contracts/check-board-contracts.py"
run_check "T2: git note schemas"    python3 "$SCRIPT_DIR/t2-contracts/check-git-note-schemas.py"

echo ""
if [ "$FAILURES" -gt 0 ]; then
    echo "CI FAILED: $FAILURES check(s) failed" >&2
    exit 1
else
    echo "CI PASSED: all checks passed"
fi
