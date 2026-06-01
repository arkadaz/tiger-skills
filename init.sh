#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PASS=0
FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}FAIL${NC} $1"; }

# Run a Python snippet and strip Windows \r from stdout
pyrun() { $PYTHON -c "$1" 2>/dev/null | tr -d '\r'; }

# Detect Python
PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PYTHON="$cmd"
        break
    fi
done

echo "==> tiger-skills verification"
echo "    Working directory: $ROOT_DIR"
if [ -n "$PYTHON" ]; then
    echo "    Python: $PYTHON"
else
    echo "    Python: not found (JSON/plugin checks limited)"
fi
echo ""

# ── Layer 1: JSON validity ──────────────────────────────────────────
echo "── Layer 1: JSON validity ──"

JSON_FILES=".claude-plugin/plugin.json .claude-plugin/marketplace.json feature_list.json .mcp.json"
for f in $JSON_FILES; do
    if [ ! -f "$f" ]; then
        fail "$f is missing"
    elif [ -n "$PYTHON" ]; then
        if pyrun "import json; json.load(open('$f'))"; then
            pass "$f is valid JSON"
        else
            fail "$f has invalid JSON"
        fi
    else
        pass "$f exists (JSON check skipped — no Python)"
    fi
done

# ── Layer 2: Skill frontmatter ───────────────────────────────────────
echo ""
echo "── Layer 2: Skill frontmatter ──"

SKILL_FILES=$(find skills -name 'SKILL.md' -type f 2>/dev/null | sort)
SKILL_COUNT=0
for f in $SKILL_FILES; do
    SKILL_COUNT=$((SKILL_COUNT + 1))
    NAME=$(sed -n '/^---$/,/^---$/p' "$f" | grep '^name:' | sed 's/^name: *//')
    DESC=$(sed -n '/^---$/,/^---$/p' "$f" | grep '^description:' | sed 's/^description: *//')
    if [ -n "$NAME" ] && [ -n "$DESC" ]; then
        pass "$f — name=$NAME"
    elif [ -z "$NAME" ]; then
        fail "$f — missing 'name' in frontmatter"
    elif [ -z "$DESC" ]; then
        fail "$f — missing 'description' in frontmatter"
    fi
done
echo "    Total skills found: $SKILL_COUNT"

# ── Layer 3: Agent frontmatter ───────────────────────────────────────
echo ""
echo "── Layer 3: Agent frontmatter ──"

AGENT_FILES=$(find agents -name '*.md' -type f 2>/dev/null | sort)
AGENT_COUNT=0
for f in $AGENT_FILES; do
    AGENT_COUNT=$((AGENT_COUNT + 1))
    NAME=$(sed -n '/^---$/,/^---$/p' "$f" | grep '^name:' | sed 's/^name: *//')
    MODEL=$(sed -n '/^---$/,/^---$/p' "$f" | grep '^model:' | sed 's/^model: *//')
    if [ -n "$NAME" ] && [ -n "$MODEL" ]; then
        pass "$f — name=$NAME, model=$MODEL"
    elif [ -z "$NAME" ]; then
        fail "$f — missing 'name' in frontmatter"
    elif [ -z "$MODEL" ]; then
        fail "$f — missing 'model' in frontmatter"
    fi
done
echo "    Total agents found: $AGENT_COUNT"

# ── Layer 4: Plugin path resolution ──────────────────────────────────
echo ""
echo "── Layer 4: Plugin path resolution ──"

if [ -n "$PYTHON" ] && [ -f .claude-plugin/plugin.json ]; then
    # skills
    SKILL_PATHS=$(pyrun "
import json
p = json.load(open('.claude-plugin/plugin.json'))
for s in p.get('autoDiscovery',{}).get('skills',[]):
    print(s.strip())
" || echo "")
    if [ -n "$SKILL_PATHS" ]; then
        for sp in $SKILL_PATHS; do
            if [ -d "$sp" ] && [ -f "${sp}SKILL.md" ]; then
                pass "Skill path resolves: $sp"
            else
                fail "Skill path broken: $sp (directory or SKILL.md missing)"
            fi
        done
    fi

    # agents
    AGENT_PATH=$(pyrun "
import json
p = json.load(open('.claude-plugin/plugin.json'))
print(p.get('autoDiscovery',{}).get('agents',['agents/'])[0].strip())
" || echo "")
    if [ -n "$AGENT_PATH" ] && [ -d "$AGENT_PATH" ] && [ "$(find "$AGENT_PATH" -name '*.md' 2>/dev/null | wc -l)" -gt 0 ]; then
        pass "Agent path resolves: $AGENT_PATH ($(find "$AGENT_PATH" -name '*.md' | wc -l) agents)"
    elif [ -n "$AGENT_PATH" ]; then
        fail "Agent path broken: $AGENT_PATH"
    fi

    # commands
    CMD_PATH=$(pyrun "
import json
p = json.load(open('.claude-plugin/plugin.json'))
print(p.get('autoDiscovery',{}).get('commands',['commands/'])[0].strip())
" || echo "")
    if [ -n "$CMD_PATH" ] && [ -d "$CMD_PATH" ] && [ "$(find "$CMD_PATH" -name '*.md' 2>/dev/null | wc -l)" -gt 0 ]; then
        pass "Command path resolves: $CMD_PATH"
    elif [ -n "$CMD_PATH" ]; then
        fail "Command path broken: $CMD_PATH"
    fi

    # hooks — individual .md files in hooks/ directory
    if [ -d "hooks" ]; then
        HOOK_COUNT=$(find hooks -name '*.md' -type f 2>/dev/null | wc -l)
        if [ "$HOOK_COUNT" -gt 0 ]; then
            pass "Hook files found: hooks/ ($HOOK_COUNT hooks)"
        else
            fail "No hook files found in hooks/"
        fi
    else
        fail "hooks/ directory missing"
    fi
else
    echo "  (skipping path resolution — no Python or no plugin.json)"
fi

# ── Layer 5: Harness health ──────────────────────────────────────────
echo ""
echo "── Layer 5: Harness health ──"

# Check no old reference files exist
OLD_REFS=(
    "skills/harness-engineering/references/doc-first.md"
    "skills/harness-engineering/references/hooks.md"
    "skills/harness-engineering/references/repo-system.md"
    "skills/harness-engineering/references/session-discipline.md"
    "skills/harness-engineering/references/task-management.md"
    "skills/harness-engineering/references/verification.md"
    "skills/harness-engineering/references/workflow.md"
)
for old in "${OLD_REFS[@]}"; do
    if [ -f "$old" ]; then
        fail "Old reference still exists: $old"
    else
        pass "Old reference deleted: $(basename "$old")"
    fi
done

# Check WIP=1
if [ -n "$PYTHON" ] && [ -f feature_list.json ]; then
    ACTIVE_COUNT=$(pyrun "
import json
features = json.load(open('feature_list.json')).get('features',[])
active = [f['id'] for f in features if f.get('status') == 'in_progress']
print(len(active))
" || echo "?")
    if [ "$ACTIVE_COUNT" = "1" ]; then
        pass "WIP=1 enforced: exactly 1 feature in_progress"
    elif [ "$ACTIVE_COUNT" = "0" ]; then
        fail "WIP=1: no features in_progress"
    elif [ "$ACTIVE_COUNT" = "?" ]; then
        fail "WIP=1: could not parse feature_list.json"
    else
        fail "WIP=1 violated: $ACTIVE_COUNT features in_progress (should be 1)"
    fi
else
    echo "  (skipping WIP=1 check — no Python or no feature_list.json)"
fi

# Check AGENTS.md under 150 lines
if [ -f AGENTS.md ]; then
    AGENTS_LINES=$(wc -l < AGENTS.md)
    if [ "$AGENTS_LINES" -le 150 ]; then
        pass "AGENTS.md is $AGENTS_LINES lines (limit: 150)"
    else
        fail "AGENTS.md is $AGENTS_LINES lines (limit: 150)"
    fi
else
    fail "AGENTS.md is missing"
fi

# Check init.sh is executable
if [ -x init.sh ]; then
    pass "init.sh is executable"
else
    fail "init.sh is not executable"
fi

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────"
echo -e "Result: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "──────────────────────────────────────────"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
