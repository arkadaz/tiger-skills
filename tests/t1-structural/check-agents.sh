#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
pass() { echo "PASS: $1"; }

check_frontmatter() {
    local file="$1"
    local name; name=$(basename "$file")
    # Extract content between first two --- markers
    local front; front=$(awk '/^---/{n++; next} n==1' "$file")
    for field in name description model tools; do
        if echo "$front" | grep -qE "^${field}:[[:space:]]*.+"; then
            pass "$name: '$field' present"
        else
            fail "$name: frontmatter field '$field' missing or empty"
        fi
    done
}

for agent_file in "$ROOT_DIR/agents/"*.md; do
    [ -f "$agent_file" ] || continue
    check_frontmatter "$agent_file"
done

exit "$FAILURES"
