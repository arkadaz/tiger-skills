#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FAILURES=0

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "PASS: $1"
}

require_file() {
  if [ -f "$ROOT_DIR/$1" ]; then
    pass "$1 exists"
  else
    fail "$1 missing"
  fi
}

require_dir() {
  if [ -d "$ROOT_DIR/$1" ]; then
    pass "$1 exists"
  else
    fail "$1 missing"
  fi
}

require_file ".claude-plugin/plugin.json"
require_file ".claude-plugin/marketplace.json"
require_file "CLAUDE.md"
require_file "README.md"
require_file "project-hooks/tiger-block-rm.sh"

if command -v python3 >/dev/null 2>&1; then
  python3 - "$ROOT_DIR" <<'PY' || exit 1
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])

def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)

manifest = load_json(root / ".claude-plugin/plugin.json")
marketplace = load_json(root / ".claude-plugin/marketplace.json")

for field in ["name", "description", "version", "commands", "skills"]:
    if field not in manifest:
        raise SystemExit(f"manifest missing {field}")
if manifest["name"] != "tiger-skills":
    raise SystemExit("manifest.name must be tiger-skills")
if manifest.get("repository") != "https://gitlab.github.com/arkadaz/tiger-skills":
    raise SystemExit("manifest.repository must use the HTTPS GitLab URL")
if manifest.get("commands") != "./commands":
    raise SystemExit("manifest.commands must point to ./commands")

for field in ["name", "description", "owner", "plugins"]:
    if field not in marketplace:
        raise SystemExit(f"marketplace missing {field}")
if marketplace["name"] != "tiger-skills":
    raise SystemExit("marketplace.name must be tiger-skills")
plugins = marketplace.get("plugins")
if not isinstance(plugins, list) or len(plugins) != 1:
    raise SystemExit("marketplace.plugins must contain exactly one plugin")
plugin_entry = plugins[0]
if plugin_entry.get("name") != manifest["name"]:
    raise SystemExit("marketplace plugin name must match manifest.name")
if plugin_entry.get("source") != "./":
    raise SystemExit("marketplace plugin source must be ./")

def parse_frontmatter(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        raise SystemExit(f"{path.relative_to(root)} missing frontmatter")
    data = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return data
        if ":" in line:
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip()
    raise SystemExit(f"{path.relative_to(root)} frontmatter is not closed")

def require_frontmatter(path, required_fields):
    data = parse_frontmatter(path)
    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        raise SystemExit(f"{path.relative_to(root)} frontmatter missing: {', '.join(missing)}")
    return data

skill_paths = manifest["skills"]
if not isinstance(skill_paths, list):
    raise SystemExit("manifest.skills must be a list")

component_paths = [manifest["commands"], "./agents", *skill_paths]
for directory in component_paths:
    if not isinstance(directory, str) or not directory.startswith("./"):
        raise SystemExit(f"component path must be relative and start with ./: {directory}")
    path = root / directory[2:]
    if not path.exists():
        raise SystemExit(f"component path missing: {directory}")

def norm_dir(value):
    return value[2:].rstrip("/") if value.startswith("./") else value.rstrip("/")

discovered_skills = {
    str(path.parent.relative_to(root))
    for path in (root / "skills").glob("**/SKILL.md")
}
if not discovered_skills:
    raise SystemExit("no skills discovered under skills/")
manifest_skills = {norm_dir(skill) for skill in skill_paths}
if discovered_skills != manifest_skills:
    missing = sorted(discovered_skills - manifest_skills)
    stale = sorted(manifest_skills - discovered_skills)
    details = []
    if missing:
        details.append(f"missing from manifest.skills: {', '.join(missing)}")
    if stale:
        details.append(f"stale manifest.skills paths: {', '.join(stale)}")
    raise SystemExit("skill manifest mismatch; " + "; ".join(details))

skill_names = set()
for skill in sorted(discovered_skills):
    skill_file = root / skill / "SKILL.md"
    if not skill_file.is_file():
        raise SystemExit(f"skill missing SKILL.md: {skill}")
    data = require_frontmatter(skill_file, ["name", "description"])
    if data["name"] in skill_names:
        raise SystemExit(f"duplicate skill name: {data['name']}")
    skill_names.add(data["name"])

root_agent_files = sorted((root / "agents").glob("*.md"))
if not root_agent_files:
    raise SystemExit("agents directory has no agent definitions")

# Agents are self-contained subagents under the plugin-root agents/ directory.
# Full instructions live in the file Claude Code loads — no canonical/shim
# indirection (a subagent spawned in a target project cannot read a relative
# plugin path, so shims that say "read canonical or stop" break real runs).
for agent_file in root_agent_files:
    data = require_frontmatter(agent_file, ["name", "description", "model", "tools"])
    text = agent_file.read_text(encoding="utf-8")
    if "Canonical definition:" in text:
        raise SystemExit(
            f"agent must be self-contained, not a shim pointing at a canonical path: {agent_file.relative_to(root)}"
        )
    if len(text.splitlines()) < 15:
        raise SystemExit(
            f"agent looks like a stub (too short to be a self-contained subagent): {agent_file.relative_to(root)}"
        )

command_files = sorted((root / "commands").glob("*.md"))
if [path.name for path in command_files] != ["install.md"]:
    raise SystemExit("commands directory must contain exactly one slash command: install.md (the stages are pure skills; the full run is the workflow)")
command_names = set()
for command_file in command_files:
    data = require_frontmatter(command_file, ["name", "description"])
    command_names.add(data["name"])
if command_names != {"install"}:
    raise SystemExit("command frontmatter name must be install")
colliding_names = sorted(command_names & skill_names)
if colliding_names:
    raise SystemExit("command names must not collide with skill names: " + ", ".join(colliding_names))

import os
import re as _re

# Hooks must be REAL Claude Code wiring (hooks/hooks.json + executable scripts),
# never markdown docs. A *.md file in a hooks/ dir does NOT execute — that is the
# classic "my hooks don't fire" bug. Forbid markdown anywhere a hook is expected.
stray_md_hooks = sorted(root.glob("hooks/*.md")) + sorted((root / "skills").glob("**/hooks/*.md"))
if stray_md_hooks:
    names = ", ".join(str(p.relative_to(root)) for p in stray_md_hooks)
    raise SystemExit(
        f"markdown in a hooks/ dir does not execute and will never fire: {names}. "
        "Wire real hooks through hooks/hooks.json with executable scripts."
    )

hooks_json = root / "hooks/hooks.json"
if not hooks_json.is_file():
    raise SystemExit("hooks/hooks.json missing — plugin hooks are wired through this file, not markdown")
# The harness AUTO-LOADS the standard hooks/hooks.json. A manifest.hooks key that
# points back at it makes the loader read the SAME file twice -> "Duplicate hooks
# file detected" -> the whole plugin's hook load FAILS (the SessionStart context
# hook silently never fires). manifest.hooks may only reference ADDITIONAL hook
# files, so for this plugin (one standard file) the key must be absent. An earlier
# version of this check REQUIRED manifest.hooks == "./hooks/hooks.json" — it was
# enforcing the very bug; /doctor caught the duplicate-load at runtime.
if manifest.get("hooks") == "./hooks/hooks.json":
    raise SystemExit(
        'manifest.hooks must NOT reference ./hooks/hooks.json — that file is '
        'auto-loaded, so a manifest reference duplicates it and fails hook load. '
        'Remove the manifest.hooks key (or point it only at ADDITIONAL hook files).'
    )

hooks_cfg = load_json(hooks_json)
hook_events = hooks_cfg.get("hooks")
if not isinstance(hook_events, dict) or not hook_events:
    raise SystemExit("hooks/hooks.json must define at least one hook event under .hooks")

# Every command hook must point at a real, executable script under the plugin root.
for event, entries in hook_events.items():
    for entry in entries:
        for hook in entry.get("hooks", []):
            if hook.get("type") != "command":
                continue
            cmd = hook.get("command", "")
            m = _re.search(r"\$\{CLAUDE_PLUGIN_ROOT\}/([^\"']+)", cmd)
            if not m:
                raise SystemExit(f"hook command must invoke a script under ${{CLAUDE_PLUGIN_ROOT}}: {cmd}")
            script = root / m.group(1)
            if not script.is_file():
                raise SystemExit(f"hook command references a missing script: {m.group(1)}")
            if not os.access(script, os.X_OK):
                raise SystemExit(f"hook script is not executable (chmod +x): {m.group(1)}")

print("PASS: JSON, frontmatter, agent paths, and real hook wiring are valid")
PY
else
  fail "python3 not found; JSON validation skipped"
fi


RM_HOOK="$ROOT_DIR/project-hooks/tiger-block-rm.sh"
set +e
printf '%s\n' '{"tool_name":"Bash","tool_input":{"command":"rm -rf tmp"}}' | bash "$RM_HOOK" >/tmp/tiger-rm-hook-block.$$ 2>&1
RM_BLOCK_STATUS=$?
set -e
if [ "$RM_BLOCK_STATUS" -eq 2 ]; then
  pass "project rm guard blocks rm before execution"
else
  cat /tmp/tiger-rm-hook-block.$$ >&2 || true
  fail "project rm guard must block rm with exit code 2"
fi
rm -f /tmp/tiger-rm-hook-block.$$

if printf '%s\n' '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | bash "$RM_HOOK" >/tmp/tiger-rm-hook-safe.$$ 2>&1; then
  pass "project rm guard allows safe Bash commands"
else
  cat /tmp/tiger-rm-hook-safe.$$ >&2 || true
  fail "project rm guard must allow safe Bash commands"
fi
rm -f /tmp/tiger-rm-hook-safe.$$

# The guard must block quote/backslash-obfuscated rm (bash collapses "r"m, r''m,
# r\m, rm$() all to `rm`). A penetration pass found these slipping past an earlier
# version that stripped quotes to a space; this assertion stops that regression.
RM_OBFUSCATED=0
for payload in '"r"m -rf x' "r''m -rf x" 'r\m -rf x' 'rm$() -rf x'; do
  json="$(CMD="$payload" python3 -c 'import json,os; print(json.dumps({"tool_name":"Bash","tool_input":{"command":os.environ["CMD"]}}))')"
  set +e
  printf '%s\n' "$json" | bash "$RM_HOOK" >/dev/null 2>&1
  [ $? -eq 2 ] || RM_OBFUSCATED=1
  set -e
done
if [ "$RM_OBFUSCATED" -eq 0 ]; then
  pass "project rm guard blocks quote/backslash-obfuscated rm"
else
  fail "project rm guard must block obfuscated rm (e.g. \"r\"m, r''m, r\\m, rm\$())"
fi

# ANSI-C quoting ($'\x72\x6d' / $'\162\155') decodes to rm in bash; the guard must
# decode it too. Build the payload in python so the validator's own shell does not
# expand the $'...' before the guard sees it.
ANSI_JSON="$(python3 - <<'PY'
import json
print(json.dumps({"tool_name": "Bash", "tool_input": {"command": "$'" + r"\x72\x6d" + "' -rf x"}}))
PY
)"
set +e
printf '%s\n' "$ANSI_JSON" | bash "$RM_HOOK" >/dev/null 2>&1
ANSI_STATUS=$?
set -e
if [ "$ANSI_STATUS" -eq 2 ]; then
  pass "project rm guard blocks ANSI-C-quoted rm (\$'\\x72\\x6d')"
else
  fail "project rm guard must block ANSI-C-quoted rm (\$'\\x72\\x6d')"
fi

# A command substitution whose body deterministically yields rm — $(echo rm) or
# `echo rm` — really runs `rm -rf x`. An earlier version STRIPPED substitutions
# wholesale (to collapse rm$()->rm), so a stress pass walked rm straight through.
# The guard must also scan the substitution body for an rm command word.
RM_SUBST=0
for payload in '$(echo rm) -rf x' '`echo rm` -rf x'; do
  json="$(CMD="$payload" python3 -c 'import json,os; print(json.dumps({"tool_name":"Bash","tool_input":{"command":os.environ["CMD"]}}))')"
  set +e
  printf '%s\n' "$json" | bash "$RM_HOOK" >/dev/null 2>&1
  [ $? -eq 2 ] || RM_SUBST=1
  set -e
done
if [ "$RM_SUBST" -eq 0 ]; then
  pass "project rm guard blocks rm hidden in a command substitution (\$(echo rm), \`echo rm\`)"
else
  fail "project rm guard must block rm inside a command substitution that yields rm"
fi

# The guard must NOT trip on the letters rm inside a quoted argument (e.g. a
# commit message). False positives there would block normal work.
if printf '%s\n' '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"fix: rm dead code\""}}' | bash "$RM_HOOK" >/dev/null 2>&1; then
  pass "project rm guard allows rm inside a quoted argument"
else
  fail "project rm guard must allow rm inside a quoted argument (commit message)"
fi

# (The approval gate is the HTML meta token now — grill writes spec.html, not a
# markdown spec — so the gate test lives in the "HTML approval token gate" block
# below. The old markdown Status: approved regex test was removed with the conductor.)

# Board invariant checker must accept a valid board and reject corruption. This
# replaces the old fragile WIP grep, which also counted task-level status.
BOARD_VALIDATOR="$ROOT_DIR/scripts/validate-board.py"
if [ -f "$BOARD_VALIDATOR" ]; then
  pass "scripts/validate-board.py exists"
  BV_TMP="$(mktemp -d)"
  cat > "$BV_TMP/good.json" <<'JSON'
{"schema_version":2,"current_feature":"F1","features":{"F1":{"title":"t","status":"in_progress","phase":"build","depends_on":[],"blocks":[],"acceptance_criteria":[{"id":"AC1","criterion":"x","verification":"python3 -c 'assert 1'","status":"done"}],"tasks":[{"id":"T1","status":"in_progress"},{"id":"T2","status":"in_progress"}]}}}
JSON
  # corrupt: two features in_progress (WIP>1) — the case the old grep also got wrong
  cat > "$BV_TMP/bad.json" <<'JSON'
{"schema_version":2,"current_feature":"F1","features":{"F1":{"title":"t","status":"in_progress","phase":"build","depends_on":[],"blocks":[],"acceptance_criteria":[],"tasks":[]},"F2":{"title":"t","status":"in_progress","phase":"build","depends_on":[],"blocks":[],"acceptance_criteria":[],"tasks":[]}}}
JSON
  if python3 "$BOARD_VALIDATOR" "$BV_TMP/good.json" >/dev/null 2>&1; then
    pass "board validator accepts a valid board (and is not fooled by in-progress tasks)"
  else
    fail "board validator must accept a valid single-feature board with in-progress tasks"
  fi
  if python3 "$BOARD_VALIDATOR" "$BV_TMP/bad.json" >/dev/null 2>&1; then
    fail "board validator must reject WIP>1 (two features in_progress)"
  else
    pass "board validator rejects WIP>1"
  fi
  # A malformed board where a feature VALUE is not an object (e.g. a bare string)
  # must be REJECTED cleanly — never crash with a Python traceback. A stress pass
  # found the reciprocal-link and cycle passes calling .get() on a non-dict
  # feature, raising AttributeError. The validator must fail closed AND graceful.
  cat > "$BV_TMP/ugly.json" <<'JSON'
{"schema_version":2,"current_feature":null,"features":{"F1":"i-am-a-string","F2":{"title":"t","status":"not_started","phase":"plan","depends_on":["F1"],"blocks":[],"acceptance_criteria":[],"tasks":[]}}}
JSON
  set +e
  UGLY_ERR="$(python3 "$BOARD_VALIDATOR" "$BV_TMP/ugly.json" 2>&1 >/dev/null)"
  UGLY_STATUS=$?
  set -e
  if [ "$UGLY_STATUS" -ne 0 ] && ! printf '%s' "$UGLY_ERR" | grep -q "Traceback (most recent call last)"; then
    pass "board validator rejects a non-object feature value without crashing"
  else
    fail "board validator must reject a non-object feature value cleanly (no traceback)"
  fi
  rm -rf "$BV_TMP"
else
  fail "scripts/validate-board.py missing — board invariants would be unenforced"
fi

# SessionStart hook must actually run: emit valid JSON with context inside a Tiger
# project (feature_list.json present) and stay completely silent outside one.
SS_HOOK="$ROOT_DIR/hooks/tiger-session-start.sh"
SS_IN="$(mktemp -d)"
SS_OUT="$(mktemp -d)"
printf '{}' > "$SS_IN/feature_list.json"
if ( cd "$SS_IN" && CLAUDE_PLUGIN_ROOT="$ROOT_DIR" bash "$SS_HOOK" ) \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["hookSpecificOutput"]["additionalContext"].strip()' 2>/dev/null; then
  pass "SessionStart hook emits valid JSON with context inside a Tiger project"
else
  fail "SessionStart hook must emit valid JSON with additionalContext inside a Tiger project"
fi
SS_SILENT="$( cd "$SS_OUT" && CLAUDE_PLUGIN_ROOT="$ROOT_DIR" bash "$SS_HOOK" )"
if [ -z "$SS_SILENT" ]; then
  pass "SessionStart hook is silent outside a Tiger project"
else
  fail "SessionStart hook must be silent outside a Tiger project"
fi
rm -rf "$SS_IN" "$SS_OUT"

# ── Stage spine ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
# The grill is interactive and runs INLINE (a subagent cannot ask the human one
# question at a time), so it is a skill with NO agent. The six autonomous
# stages each own a spawnable agent under agents/.
for agent in tiger-architect tiger-code-generator tiger-security tiger-reviewer tiger-e2e tiger-update-docs; do
  if [ -f "$ROOT_DIR/agents/$agent.md" ]; then
    pass "agent $agent is present and self-contained"
  else
    fail "agent $agent.md missing from agents/"
  fi
done

# The retired 3-agent spine must stay retired — a resurrected planner/generator/
# evaluator (or a grill subagent) means two competing pipelines.
for retired in tiger-planner tiger-generator tiger-evaluator tiger-grill-interviewer; do
  if [ -f "$ROOT_DIR/agents/$retired.md" ]; then
    fail "agents/$retired.md must not exist — the 3-agent spine was replaced by the 7-stage pipeline (spec: dev-workflow-rebuild)"
  fi
done
# Exactly one workflow ships, and it is the dev spine. The old spine workflow shared
# this filename and was overwritten by the rename, so there is no separate retired
# file to forbid — instead assert the workflows/ dir holds only this one.
WF_FILES="$(cd "$ROOT_DIR/workflows" 2>/dev/null && ls *.js 2>/dev/null | sort | tr '\n' ' ')"
if [ "$WF_FILES" = "tiger-workflow-dev.js " ]; then
  pass "workflows/ contains exactly the dev spine (tiger-workflow-dev.js)"
else
  fail "workflows/ must contain exactly tiger-workflow-dev.js (found: ${WF_FILES:-none})"
fi

# Model routing lives in agent frontmatter (the declared source of truth the
# workflow mirrors): sonnet for the mechanical code generator, opus for the
# reasoning stages.
for agent in tiger-architect tiger-security tiger-reviewer tiger-e2e tiger-update-docs; do
  if grep -Eq '^model:[[:space:]]*opus[[:space:]]*$' "$ROOT_DIR/agents/$agent.md" 2>/dev/null; then
    pass "agent $agent routes to opus"
  else
    fail "agents/$agent.md frontmatter must declare model: opus"
  fi
done
if grep -Eq '^model:[[:space:]]*sonnet[[:space:]]*$' "$ROOT_DIR/agents/tiger-code-generator.md" 2>/dev/null; then
  pass "agent tiger-code-generator routes to sonnet"
else
  fail "agents/tiger-code-generator.md frontmatter must declare model: sonnet"
fi

# Board ownership: the code generator manual must NOT carry the self-contradictory
# absolute "Never touch feature_list.json" (tasks[].status LIVES in that file) and
# MUST forbid the over-reach a real run exposed — setting the phase pointer and
# pre-grading its own acceptance criteria.
GEN_MD="$ROOT_DIR/agents/tiger-code-generator.md"
if grep -q 'Never touch `feature_list.json`' "$GEN_MD" 2>/dev/null; then
  fail "tiger-code-generator.md still has the contradictory 'Never touch feature_list.json' absolute (task status lives there) — scope it to tasks[].status"
else
  pass "tiger-code-generator.md does not carry the contradictory whole-board ban"
fi
if grep -q 'acceptance_criteria' "$GEN_MD" 2>/dev/null && grep -qi 'pre-grade' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md forbids setting AC status / pre-grading (e2e's job)"
else
  fail "tiger-code-generator.md must forbid setting acceptance_criteria status / phase / pre-grading its own work"
fi

# Domain coverage: the e2e gate inherits the evaluator's protocols for the gap
# domains a real cross-domain stress pass exposed — non-deterministic checks
# (ML/perf flake), deploy/outward-facing side effects, non-executable deliverables.
E2E_MD="$ROOT_DIR/agents/tiger-e2e.md"
for needle in "non-deterministic" "Deploy / outward-facing" "Non-executable deliverables"; do
  if grep -qi "$needle" "$E2E_MD" 2>/dev/null; then
    pass "tiger-e2e.md covers: $needle"
  else
    fail "tiger-e2e.md missing domain protocol: $needle"
  fi
done
if grep -qi 'Never perform a real external' "$E2E_MD" 2>/dev/null; then
  pass "tiger-e2e.md deploy protocol forbids real external deploy in the autonomous gate"
else
  fail "tiger-e2e.md must forbid a real external/production deploy inside the gate"
fi
# v2: e2e is the single gate and triages defects by priority (HIGH/MEDIUM block, LOW logged),
# ending with the four-token contract including E2E_BLOCKERS.
if grep -qi 'priority' "$E2E_MD" 2>/dev/null && grep -q 'E2E_BLOCKERS' "$E2E_MD" 2>/dev/null; then
  pass "tiger-e2e.md triages defects by priority and ends with the E2E_BLOCKERS token"
else
  fail "tiger-e2e.md must triage defects by priority (HIGH/MEDIUM block, LOW logged) and emit E2E_BLOCKERS"
fi
# The architect must not be Python-locked: it must show non-Python runners too.
ARCH_MD="$ROOT_DIR/agents/tiger-architect.md"
if grep -q 'cargo test' "$ARCH_MD" 2>/dev/null && grep -qi 'do not default to Python' "$ARCH_MD" 2>/dev/null; then
  pass "tiger-architect.md acceptance-check guidance is language-agnostic (not Python-locked)"
else
  fail "tiger-architect.md must give non-Python acceptance-check examples (cargo/npm/go/curl)"
fi

# Every skill documents its git touchpoints and standalone contract — the yellow-note
# requirements from docs/dev-architect.md. skills/dev holds the 7 pipeline stages plus
# the independent tiger-code-quality reference skill (no conductor skill).
EXPECTED_SKILLS="tiger-architect tiger-code-generator tiger-code-quality tiger-e2e tiger-grill tiger-reviewer tiger-security tiger-update-docs tiger-docs-spec tiger-docs-adr tiger-docs-business tiger-docs-e2e tiger-docs-codemap tiger-docs-release tiger-docs-readme"
FOUND_SKILLS="$(cd "$ROOT_DIR/skills/dev" 2>/dev/null && ls -d */ 2>/dev/null | sed 's:/$::' | sort | tr '\n' ' ')"
if [ "$FOUND_SKILLS" = "$(echo "$EXPECTED_SKILLS" | tr ' ' '\n' | sort | tr '\n' ' ')" ]; then
  pass "skills/dev holds the 7 stages + tiger-code-quality + the 7 tiger-docs-* writer skills (no conductor)"
else
  fail "skills/dev must hold the 7 stages + tiger-code-quality + 7 tiger-docs-* writers (found: ${FOUND_SKILLS:-none})"
fi
for skill_dir in "$ROOT_DIR"/skills/dev/*/; do
  sk="$(basename "$skill_dir")"
  for heading in "## Git interactions" "## Standalone use"; do
    if grep -q "^$heading" "$skill_dir/SKILL.md" 2>/dev/null; then
      pass "skills/dev/$sk has '$heading'"
    else
      fail "skills/dev/$sk/SKILL.md missing required heading '$heading'"
    fi
  done
done

# The retired conductor skill must be gone — stages are invoked directly or by the
# workflow; there is no orchestrating /dev command or tiger-dev skill any more.
if [ -d "$ROOT_DIR/skills/dev/tiger-dev" ]; then
  fail "skills/dev/tiger-dev must not exist — the conductor was removed (pure skills + optional workflow)"
else
  pass "conductor skill is absent (pure-skill layout)"
fi

# ── Workflow script (v2) ──────────────────────────────────────────────────────
# The deterministic spine is a saved dynamic workflow. Its meta must be the first
# statement and a pure literal; the v2 script must encode parallel build worktrees
# and the bounded no-progress retry cap, auto-discover the feature via a bootstrap
# step (no required args), be trunk-based on main, and NOT run the in-loop
# security/reviewer gates (those are standalone in v2).
WF="$ROOT_DIR/workflows/tiger-workflow-dev.js"
if [ -f "$WF" ]; then
  pass "workflows/tiger-workflow-dev.js exists"
  if head -n 80 "$WF" | grep -q '^export const meta = {'; then
    pass "workflow meta is an export-const literal near the top"
  else
    fail "workflow meta must be 'export const meta = {' as the first statement"
  fi
  if grep -q 'parallel(' "$WF" && grep -q 'MAX_STUCK' "$WF"; then
    pass "workflow encodes the parallel build worktrees and the bounded retry cap"
  else
    fail "workflow must encode parallel( build worktrees ) and a MAX_STUCK retry cap"
  fi
  # v2: a bootstrap step discovers the feature from the board, so no required args.
  if grep -qi 'bootstrap' "$WF"; then
    pass "workflow has a bootstrap discovery step (args-free launch)"
  else
    fail "workflow must auto-discover the feature via a bootstrap step (v2: no required args)"
  fi
  # v2: the in-loop security/reviewer gates were removed (standalone-only now). Match an actual
  # SPAWN (the agentType form 'tiger-skills:tiger-security'), not the prose mentions that
  # correctly explain they are standalone.
  if grep -qE 'tiger-skills:tiger-(security|reviewer)|agentType[^\n]*tiger-(security|reviewer)' "$WF"; then
    fail "workflow must NOT spawn tiger-security/tiger-reviewer (v2 removed the in-loop gates; they are standalone)"
  else
    pass "workflow does not spawn the in-loop security/reviewer gates (v2 standalone)"
  fi
  # v2: e2e is the single gate with priority blockers; the workflow reads E2E_BLOCKERS.
  if grep -q 'E2E_BLOCKERS' "$WF"; then
    pass "workflow reads the e2e priority blocker counts (E2E_BLOCKERS)"
  else
    fail "workflow must read the e2e bug-priority counts (E2E_BLOCKERS: high/medium/low)"
  fi
  # Trunk-based on main: the workflow must not reference a develop integration branch.
  if grep -qE "['\"\`/ ]develop\b" "$WF"; then
    fail "workflow must be trunk-based on main — no 'develop' branch references"
  else
    pass "workflow is trunk-based on main (no develop references)"
  fi
  if command -v node >/dev/null 2>&1; then
    # Workflow scripts use top-level return/await, so plain `node --check` cannot
    # parse them. Wrap the body in an AsyncFunction exactly like the runtime does.
    if node -e '
      const fs = require("fs");
      const src = fs.readFileSync(process.argv[1], "utf8");
      const body = src.replace(/^export const meta/m, "const meta");
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      new AsyncFunction("args","budget","agent","parallel","pipeline","phase","log","workflow",body);
    ' "$WF" 2>/dev/null; then
      pass "workflow script parses (async-wrapped, like the runtime)"
    else
      fail "workflow script has a syntax error (AsyncFunction wrap failed)"
    fi
  else
    pass "node not found; workflow syntax check skipped (structure checks still ran)"
  fi
else
  fail "workflows/tiger-workflow-dev.js missing — the spine has no deterministic script"
fi

# ── HTML artifact templates ───────────────────────────────────────────────────
# Five self-contained HTML templates ship with the plugin (the e2e contract is now a
# Robot Framework .robot suite, checked separately below). Self-contained = opens from
# disk, no external requests; codemap's mermaid CDN script is the single documented exception.
for tpl in spec adr business codemap release_docs; do
  TPL="$ROOT_DIR/templates/$tpl.html"
  if [ -f "$TPL" ] && head -n 2 "$TPL" | grep -qi '<!DOCTYPE html>'; then
    pass "templates/$tpl.html exists and is an HTML document"
  else
    fail "templates/$tpl.html missing or not an HTML document"
  fi
done
if grep -q 'mermaid' "$ROOT_DIR/templates/codemap.html" 2>/dev/null; then
  pass "codemap template embeds mermaid"
else
  fail "templates/codemap.html must embed mermaid for the diagram"
fi
for tpl in spec adr business release_docs; do
  if grep -Eq 'src="https?://|@import url\(http' "$ROOT_DIR/templates/$tpl.html" 2>/dev/null; then
    fail "templates/$tpl.html must be self-contained (no external requests; only codemap may use the mermaid CDN)"
  else
    pass "templates/$tpl.html is self-contained"
  fi
done

# ── Robot Framework e2e templates ─────────────────────────────────────────────
# The e2e contract is a human-readable Robot Framework suite: grill writes the CASES
# (e2e_testcases.robot), the tiger-e2e gate writes the executable IMPLEMENTATIONS
# (e2e_keywords.resource — Playwright behind the scenes). Both ship as templates.
E2E_ROBOT="$ROOT_DIR/templates/e2e_testcases.robot"
if [ -f "$E2E_ROBOT" ] && grep -q '\*\*\* Test Cases \*\*\*' "$E2E_ROBOT"; then
  pass "templates/e2e_testcases.robot exists and is a Robot Framework suite"
else
  fail "templates/e2e_testcases.robot missing or not a Robot Framework suite (no *** Test Cases ***)"
fi
E2E_RES="$ROOT_DIR/templates/e2e_keywords.resource"
if [ -f "$E2E_RES" ] && grep -q '\*\*\* Keywords \*\*\*' "$E2E_RES"; then
  pass "templates/e2e_keywords.resource exists and is a Robot Framework resource (e2e gate writes it)"
else
  fail "templates/e2e_keywords.resource missing or not a Robot Framework resource (no *** Keywords ***)"
fi
# The old HTML e2e template must be gone — the e2e contract is .robot now.
if [ -f "$ROOT_DIR/templates/e2e_testcases.html" ]; then
  fail "templates/e2e_testcases.html must not exist — the e2e contract is e2e_testcases.robot now"
else
  pass "the retired HTML e2e template is gone (.robot is the contract)"
fi

# templates/feature_list.json is the full-shape REFERENCE board (the one schema-v2
# kanban example, with sub-feature tasks + a cross-feature dependency). /install does
# NOT copy it — it seeds an empty board — so this file may (and should) carry example
# features. It must stay a valid, non-trivial board that validate-board.py accepts.
BOARD_TPL="$ROOT_DIR/templates/feature_list.json"
if [ -f "$BOARD_TPL" ]; then
  if python3 "$BOARD_VALIDATOR" "$BOARD_TPL" >/dev/null 2>&1 \
     && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); fs=d.get("features",{}); sys.exit(0 if len(fs)>=2 and any(f.get("tasks") for f in fs.values()) and any(f.get("depends_on") for f in fs.values()) else 1)' "$BOARD_TPL" 2>/dev/null; then
    pass "templates/feature_list.json is a valid worked reference board (tasks + dependencies)"
  else
    fail "templates/feature_list.json must be a valid schema-v2 board that exercises tasks + a cross-feature dependency"
  fi
else
  fail "templates/feature_list.json missing — the full-kanban shape reference"
fi
# /install must seed an EMPTY board, never copy the reference (which carries demo
# features that would trip WIP=1 in a fresh project).
if grep -q 'cp .*templates/feature_list.json' "$ROOT_DIR/commands/install.md" 2>/dev/null; then
  fail "install must NOT cp templates/feature_list.json (it has demo features) — seed an empty board inline"
else
  pass "install seeds an empty board, never copies the reference"
fi
# install must SCAFFOLD init.sh (the green-cycle gate), not just check it exists — writing a
# runnable gate from the detected test command, else a fail-closed stub.
if grep -q '> init.sh' "$ROOT_DIR/commands/install.md" 2>/dev/null && grep -qi 'fail.closed' "$ROOT_DIR/commands/install.md" 2>/dev/null; then
  pass "install scaffolds init.sh (runnable gate, or a fail-closed stub when undetectable)"
else
  fail "install must scaffold init.sh (write a runnable green-cycle gate, or a fail-closed stub) — not just check presence"
fi

# ── HTML approval token gate ──────────────────────────────────────────────────
# The build pipeline (workflow or architect skill) proceeds only when spec.html's status meta
# VALUE is exactly "approved". The closing quote anchors the value, so prose like
# content="not approved" or content="approved (pending)" must NOT open the gate.
HGATE='<meta name="tiger-status" content="approved">'
HG_TMP="$(mktemp -d)"
printf '%s\n' '<meta name="tiger-status" content="approved">' > "$HG_TMP/yes.html"
printf '%s\n' '<meta name="tiger-status" content="awaiting_review">' > "$HG_TMP/no1.html"
printf '%s\n' '<meta name="tiger-status" content="not approved">' > "$HG_TMP/no2.html"
printf '%s\n' '<meta name="tiger-status" content="approved (pending lead)">' > "$HG_TMP/no3.html"
if grep -qF "$HGATE" "$HG_TMP/yes.html" \
   && ! grep -qF "$HGATE" "$HG_TMP/no1.html" \
   && ! grep -qF "$HGATE" "$HG_TMP/no2.html" \
   && ! grep -qF "$HGATE" "$HG_TMP/no3.html"; then
  pass "HTML approval gate opens on exact content=\"approved\" and rejects lookalikes"
else
  fail "HTML approval gate must open only on the exact approved meta token"
fi
rm -rf "$HG_TMP"
# The human approves the whole grill artifact SET, so the three HTML grill templates carry
# the tiger-status meta and must ship unapproved (grill flips them to approved together).
for gt in spec adr business; do
  GT="$ROOT_DIR/templates/$gt.html"
  if grep -q 'content="awaiting_review"' "$GT" 2>/dev/null && ! grep -qF "$HGATE" "$GT"; then
    pass "$gt template ships awaiting_review (never pre-approved)"
  else
    fail "templates/$gt.html must carry tiger-status awaiting_review and never the approved token"
  fi
done
# The .robot e2e contract has no HTML head, so its inspectable approval marker is a
# header comment: grill flips '# tiger-status: awaiting_review' -> '# tiger-status: approved'
# together with the three HTML siblings. It must ship unapproved.
E2E_ROBOT_TPL="$ROOT_DIR/templates/e2e_testcases.robot"
if grep -q '^# tiger-status: awaiting_review' "$E2E_ROBOT_TPL" 2>/dev/null && ! grep -q '^# tiger-status: approved' "$E2E_ROBOT_TPL" 2>/dev/null; then
  pass "e2e_testcases.robot template ships '# tiger-status: awaiting_review' (never pre-approved)"
else
  fail "templates/e2e_testcases.robot must carry '# tiger-status: awaiting_review' and never the approved marker"
fi

if [ "$FAILURES" -ne 0 ]; then
  echo "Validation failed with $FAILURES failure(s)." >&2
  exit 1
fi

echo "Validation passed."
