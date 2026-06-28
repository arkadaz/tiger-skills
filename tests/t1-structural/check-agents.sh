#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
pass() { echo "PASS: $1"; }

# v6 lineup: 6 agents. opus everywhere except code-generator (sonnet).
EXPECTED_AGENTS="tiger-architect tiger-code-generator tiger-e2e tiger-update-docs tiger-security tiger-reviewer"
EXPECTED_MODEL_tiger_architect=opus
EXPECTED_MODEL_tiger_code_generator=sonnet
EXPECTED_MODEL_tiger_e2e=opus
EXPECTED_MODEL_tiger_update_docs=opus
EXPECTED_MODEL_tiger_security=opus
EXPECTED_MODEL_tiger_reviewer=opus

front_of() { awk '/^---/{n++; next} n==1' "$1"; }

check_frontmatter() {
    local file="$1"
    local name; name=$(basename "$file")
    local front; front=$(front_of "$file")
    for field in name description model tools; do
        if echo "$front" | grep -qE "^${field}:[[:space:]]*.+"; then
            pass "$name: '$field' present"
        else
            fail "$name: frontmatter field '$field' missing or empty"
        fi
    done
}

# 1. Each agent file has the required frontmatter shape.
for agent_file in "$ROOT_DIR/agents/"*.md; do
    [ -f "$agent_file" ] || continue
    check_frontmatter "$agent_file"
done

# 2. The 6 expected agents are present with the right model tier.
for agent in $EXPECTED_AGENTS; do
    agent_file="$ROOT_DIR/agents/$agent.md"
    if [ ! -f "$agent_file" ]; then
        fail "agent '$agent' missing (expected agents/$agent.md)"
        continue
    fi
    pass "agent '$agent' present"
    var="EXPECTED_MODEL_$(echo "$agent" | tr '-' '_')"
    want="${!var}"
    got=$(front_of "$agent_file" | grep -E "^model:[[:space:]]*" | head -1 | sed -E 's/^model:[[:space:]]*//; s/[[:space:]]*$//')
    if [ "$got" = "$want" ]; then
        pass "agent '$agent' model=$got"
    else
        fail "agent '$agent' model should be '$want', got '$got'"
    fi
done

exit "$FAILURES"
