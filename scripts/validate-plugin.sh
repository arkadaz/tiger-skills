#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FAILURES=0

fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
pass() { echo "PASS: $1"; }

require_file() {
  if [ -f "$ROOT_DIR/$1" ]; then pass "$1 exists"; else fail "$1 missing"; fi
}

require_file ".claude-plugin/plugin.json"
require_file ".claude-plugin/marketplace.json"
require_file "CLAUDE.md"
require_file "README.md"
require_file "project-hooks/tiger-block-rm.sh"

if command -v python3 >/dev/null 2>&1; then
  python3 - "$ROOT_DIR" <<'PY' || exit 1
import json, os, pathlib, re as _re, sys

root = pathlib.Path(sys.argv[1])

def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)

manifest = load_json(root / ".claude-plugin/plugin.json")
marketplace = load_json(root / ".claude-plugin/marketplace.json")

# Manifest: skills/agents/commands are discovered via autoDiscovery (no top-level commands/skills keys).
for field in ["name", "description", "version", "autoDiscovery"]:
    if field not in manifest:
        raise SystemExit(f"manifest missing {field}")
if manifest["name"] != "tiger-skills":
    raise SystemExit("manifest.name must be tiger-skills")
if not manifest.get("repository"):
    raise SystemExit("manifest.repository must be set")
auto = manifest["autoDiscovery"]
if not isinstance(auto, dict):
    raise SystemExit("manifest.autoDiscovery must be an object")
skill_paths = auto.get("skills")
if not isinstance(skill_paths, list) or not skill_paths:
    raise SystemExit("manifest.autoDiscovery.skills must be a non-empty list")

for field in ["name", "description", "owner", "plugins"]:
    if field not in marketplace:
        raise SystemExit(f"marketplace missing {field}")
plugins = marketplace.get("plugins")
if not isinstance(plugins, list) or len(plugins) != 1:
    raise SystemExit("marketplace.plugins must contain exactly one plugin")
if plugins[0].get("name") != manifest["name"]:
    raise SystemExit("marketplace plugin name must match manifest.name")
if plugins[0].get("source") != "./":
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

def require_frontmatter(path, required):
    data = parse_frontmatter(path)
    missing = [f for f in required if not data.get(f)]
    if missing:
        raise SystemExit(f"{path.relative_to(root)} frontmatter missing: {', '.join(missing)}")
    return data

def norm_dir(value):
    v = value[2:] if value.startswith("./") else value
    return v.rstrip("/")

# Skills are flat under skills/ and must equal autoDiscovery.skills exactly.
discovered_skills = {
    str(p.parent.relative_to(root)).replace("\\", "/")
    for p in (root / "skills").glob("**/SKILL.md")
}
if not discovered_skills:
    raise SystemExit("no skills discovered under skills/")
manifest_skills = {norm_dir(s).replace("\\", "/") for s in skill_paths}
if discovered_skills != manifest_skills:
    missing = sorted(discovered_skills - manifest_skills)
    stale = sorted(manifest_skills - discovered_skills)
    details = []
    if missing: details.append(f"missing from manifest: {', '.join(missing)}")
    if stale: details.append(f"stale manifest paths: {', '.join(stale)}")
    raise SystemExit("skill manifest mismatch; " + "; ".join(details))

skill_names = set()
for skill in sorted(discovered_skills):
    data = require_frontmatter(root / skill / "SKILL.md", ["name", "description"])
    if data["name"] in skill_names:
        raise SystemExit(f"duplicate skill name: {data['name']}")
    skill_names.add(data["name"])

# Agents: self-contained subagents under agents/.
agent_files = sorted((root / "agents").glob("*.md"))
if not agent_files:
    raise SystemExit("agents directory has no agent definitions")
for agent_file in agent_files:
    data = require_frontmatter(agent_file, ["name", "description", "model", "tools"])
    text = agent_file.read_text(encoding="utf-8")
    if "Canonical definition:" in text:
        raise SystemExit(f"agent must be self-contained, not a shim: {agent_file.relative_to(root)}")
    if len(text.splitlines()) < 15:
        raise SystemExit(f"agent looks like a stub: {agent_file.relative_to(root)}")

command_files = sorted((root / "commands").glob("*.md"))
if [p.name for p in command_files] != ["install.md"]:
    raise SystemExit("commands/ must contain exactly install.md")
data = require_frontmatter(root / "commands/install.md", ["name", "description"])
if data["name"] != "install":
    raise SystemExit("command frontmatter name must be install")
if data["name"] in skill_names:
    raise SystemExit("command name must not collide with a skill name")

# Hooks must be real JSON + executable scripts, never markdown.
stray = sorted(root.glob("hooks/*.md")) + sorted((root / "skills").glob("**/hooks/*.md"))
if stray:
    raise SystemExit("markdown in a hooks/ dir never fires: " + ", ".join(str(p.relative_to(root)) for p in stray))
hooks_json = root / "hooks/hooks.json"
if not hooks_json.is_file():
    raise SystemExit("hooks/hooks.json missing")
if manifest.get("hooks") == "./hooks/hooks.json":
    raise SystemExit("manifest.hooks must NOT reference the auto-loaded ./hooks/hooks.json (duplicate-load fails hooks)")
hooks_cfg = load_json(hooks_json)
hook_events = hooks_cfg.get("hooks")
if not isinstance(hook_events, dict) or not hook_events:
    raise SystemExit("hooks/hooks.json must define at least one hook event under .hooks")
for event, entries in hook_events.items():
    for entry in entries:
        for hook in entry.get("hooks", []):
            if hook.get("type") != "command":
                continue
            m = _re.search(r"\$\{CLAUDE_PLUGIN_ROOT\}/([^\"']+)", hook.get("command", ""))
            if not m:
                raise SystemExit(f"hook command must invoke a script under ${{CLAUDE_PLUGIN_ROOT}}: {hook.get('command','')}")
            script = root / m.group(1)
            if not script.is_file():
                raise SystemExit(f"hook references a missing script: {m.group(1)}")
            if not os.access(script, os.X_OK):
                raise SystemExit(f"hook script not executable (chmod +x): {m.group(1)}")

print("PASS: JSON, frontmatter, skill/agent/command discovery, and real hook wiring are valid")
PY
else
  fail "python3 not found; JSON validation skipped"
fi

# ── rm guard ──────────────────────────────────────────────────────────────────
RM_HOOK="$ROOT_DIR/project-hooks/tiger-block-rm.sh"
set +e
printf '%s\n' '{"tool_name":"Bash","tool_input":{"command":"rm -rf tmp"}}' | bash "$RM_HOOK" >/tmp/tiger-rm-hook-block.$$ 2>&1
RM_BLOCK_STATUS=$?
set -e
if [ "$RM_BLOCK_STATUS" -eq 2 ]; then pass "project rm guard blocks rm before execution"; else
  cat /tmp/tiger-rm-hook-block.$$ >&2 || true; fail "project rm guard must block rm with exit code 2"; fi
rm -f /tmp/tiger-rm-hook-block.$$

if printf '%s\n' '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | bash "$RM_HOOK" >/tmp/tiger-rm-hook-safe.$$ 2>&1; then
  pass "project rm guard allows safe Bash commands"; else
  cat /tmp/tiger-rm-hook-safe.$$ >&2 || true; fail "project rm guard must allow safe Bash commands"; fi
rm -f /tmp/tiger-rm-hook-safe.$$

RM_OBFUSCATED=0
for payload in '"r"m -rf x' "r''m -rf x" 'r\m -rf x' 'rm$() -rf x'; do
  json="$(CMD="$payload" python3 -c 'import json,os; print(json.dumps({"tool_name":"Bash","tool_input":{"command":os.environ["CMD"]}}))')"
  set +e; printf '%s\n' "$json" | bash "$RM_HOOK" >/dev/null 2>&1; [ $? -eq 2 ] || RM_OBFUSCATED=1; set -e
done
if [ "$RM_OBFUSCATED" -eq 0 ]; then pass "project rm guard blocks quote/backslash-obfuscated rm"; else
  fail "project rm guard must block obfuscated rm (e.g. \"r\"m, r''m, r\\m, rm\$())"; fi

ANSI_JSON="$(python3 - <<'PY'
import json
print(json.dumps({"tool_name": "Bash", "tool_input": {"command": "$'" + r"\x72\x6d" + "' -rf x"}}))
PY
)"
set +e; printf '%s\n' "$ANSI_JSON" | bash "$RM_HOOK" >/dev/null 2>&1; ANSI_STATUS=$?; set -e
if [ "$ANSI_STATUS" -eq 2 ]; then pass "project rm guard blocks ANSI-C-quoted rm (\$'\\x72\\x6d')"; else
  fail "project rm guard must block ANSI-C-quoted rm (\$'\\x72\\x6d')"; fi

RM_SUBST=0
for payload in '$(echo rm) -rf x' '`echo rm` -rf x'; do
  json="$(CMD="$payload" python3 -c 'import json,os; print(json.dumps({"tool_name":"Bash","tool_input":{"command":os.environ["CMD"]}}))')"
  set +e; printf '%s\n' "$json" | bash "$RM_HOOK" >/dev/null 2>&1; [ $? -eq 2 ] || RM_SUBST=1; set -e
done
if [ "$RM_SUBST" -eq 0 ]; then pass "project rm guard blocks rm hidden in a command substitution"; else
  fail "project rm guard must block rm inside a command substitution that yields rm"; fi

if printf '%s\n' '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"fix: rm dead code\""}}' | bash "$RM_HOOK" >/dev/null 2>&1; then
  pass "project rm guard allows rm inside a quoted argument"; else
  fail "project rm guard must allow rm inside a quoted argument (commit message)"; fi

# ── board invariant checker ─────────────────────────────────────────────────────
BOARD_VALIDATOR="$ROOT_DIR/scripts/validate-board.py"
if [ -f "$BOARD_VALIDATOR" ]; then
  pass "scripts/validate-board.py exists"
  BV_TMP="$(mktemp -d)"
  cat > "$BV_TMP/good.json" <<'JSON'
{"schema_version":2,"current_feature":"F1","features":{"F1":{"title":"t","status":"in_progress","phase":"build","depends_on":[],"blocks":[],"acceptance_criteria":[{"id":"AC1","criterion":"x","verification":"python3 -c 'assert 1'","status":"done"}],"tasks":[{"id":"T1","status":"in_progress"},{"id":"T2","status":"in_progress"}]}}}
JSON
  cat > "$BV_TMP/bad.json" <<'JSON'
{"schema_version":2,"current_feature":"F1","features":{"F1":{"title":"t","status":"in_progress","phase":"build","depends_on":[],"blocks":[],"acceptance_criteria":[],"tasks":[]},"F2":{"title":"t","status":"in_progress","phase":"build","depends_on":[],"blocks":[],"acceptance_criteria":[],"tasks":[]}}}
JSON
  if python3 "$BOARD_VALIDATOR" "$BV_TMP/good.json" >/dev/null 2>&1; then
    pass "board validator accepts a valid board"; else
    fail "board validator must accept a valid single-feature board with in-progress tasks"; fi
  if python3 "$BOARD_VALIDATOR" "$BV_TMP/bad.json" >/dev/null 2>&1; then
    fail "board validator must reject WIP>1"; else pass "board validator rejects WIP>1"; fi
  cat > "$BV_TMP/ugly.json" <<'JSON'
{"schema_version":2,"current_feature":null,"features":{"F1":"i-am-a-string","F2":{"title":"t","status":"not_started","phase":"plan","depends_on":["F1"],"blocks":[],"acceptance_criteria":[],"tasks":[]}}}
JSON
  set +e; UGLY_ERR="$(python3 "$BOARD_VALIDATOR" "$BV_TMP/ugly.json" 2>&1 >/dev/null)"; UGLY_STATUS=$?; set -e
  if [ "$UGLY_STATUS" -ne 0 ] && ! printf '%s' "$UGLY_ERR" | grep -q "Traceback (most recent call last)"; then
    pass "board validator rejects a non-object feature value without crashing"; else
    fail "board validator must reject a non-object feature value cleanly"; fi
  rm -rf "$BV_TMP"
else
  fail "scripts/validate-board.py missing"
fi

# ── board CLI (read/patch helper installed into projects as tiger/board.py) ──────
BOARD_CLI="$ROOT_DIR/scripts/board.py"
if [ -f "$BOARD_CLI" ]; then
  pass "scripts/board.py exists"
  BC_TMP="$(mktemp -d)"
  cat > "$BC_TMP/feature_list.json" <<'JSON'
{"schema_version":2,"current_feature":"F1","features":{"F1":{"title":"t","status":"in_progress","phase":"plan","spec_file":"tiger/features/F1/feature.md","depends_on":[],"blocks":[],"acceptance_criteria":[{"id":"AC1","criterion":"x","verification":"true","status":"not_started","evidence":[]}],"tasks":[{"id":"T1","status":"not_started","evidence":[]}],"learning":{"technical":[],"product":[],"process":[],"harness_updates":[]}}}}
JSON
  BC_OK=1
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" in-progress 2>/dev/null | grep -q '^F1$' || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" set-phase F1 build >/dev/null 2>&1 || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" set-task F1 T1 done --evidence "x" >/dev/null 2>&1 || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" get F1 phase 2>/dev/null | grep -q '^build$' || BC_OK=0
  # a write that breaks WIP=1 must be REFUSED (fail closed): add a second in_progress feature.
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" add-feature F2 --title t --start >/dev/null 2>&1 && BC_OK=0
  if [ "$BC_OK" -eq 1 ]; then
    pass "board.py reads + patches the board and refuses an invariant-breaking write"
  else
    fail "board.py must read/patch the board surgically and fail closed on invariant breaks"
  fi
  rm -rf "$BC_TMP"
else
  fail "scripts/board.py missing — stages need the read/patch CLI"
fi
# install must copy the board helper into the project.
if grep -q 'board.py' "$ROOT_DIR/commands/install.md" 2>/dev/null; then
  pass "install copies the board helper into the project (tiger/board.py)"
else
  fail "install must copy scripts/board.py into the project as tiger/board.py"
fi

# ── SessionStart hook ───────────────────────────────────────────────────────────
SS_HOOK="$ROOT_DIR/hooks/tiger-session-start.sh"
SS_IN="$(mktemp -d)"; SS_OUT="$(mktemp -d)"
printf '{}' > "$SS_IN/feature_list.json"
if ( cd "$SS_IN" && CLAUDE_PLUGIN_ROOT="$ROOT_DIR" bash "$SS_HOOK" ) \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["hookSpecificOutput"]["additionalContext"].strip()' 2>/dev/null; then
  pass "SessionStart hook emits valid JSON with context inside a Tiger project"; else
  fail "SessionStart hook must emit valid JSON with additionalContext inside a Tiger project"; fi
SS_SILENT="$( cd "$SS_OUT" && CLAUDE_PLUGIN_ROOT="$ROOT_DIR" bash "$SS_HOOK" )"
if [ -z "$SS_SILENT" ]; then pass "SessionStart hook is silent outside a Tiger project"; else
  fail "SessionStart hook must be silent outside a Tiger project"; fi
rm -rf "$SS_IN" "$SS_OUT"

# ── Stage spine ─────────────────────────────────────────────────────────────────
# grill is interactive (inline skill, no agent). Six autonomous stages own agents.
for agent in tiger-architect tiger-code-generator tiger-security tiger-reviewer tiger-e2e tiger-update-docs; do
  if [ -f "$ROOT_DIR/agents/$agent.md" ]; then pass "agent $agent present"; else fail "agent $agent.md missing"; fi
done
for retired in tiger-planner tiger-generator tiger-evaluator tiger-grill-interviewer tiger-conductor tiger-dev; do
  if [ -f "$ROOT_DIR/agents/$retired.md" ]; then fail "agents/$retired.md must not exist (retired)"; fi
done
WF_FILES="$(cd "$ROOT_DIR/workflows" 2>/dev/null && ls *.js 2>/dev/null | sort | tr '\n' ' ')"
if [ "$WF_FILES" = "tiger-workflow-dev.js " ]; then
  pass "workflows/ contains exactly the dev spine"; else
  fail "workflows/ must contain exactly tiger-workflow-dev.js (found: ${WF_FILES:-none})"; fi

# Model routing mirrors agent frontmatter: opus everywhere except the code generator (sonnet).
for agent in tiger-architect tiger-security tiger-reviewer tiger-e2e tiger-update-docs; do
  if grep -Eq '^model:[[:space:]]*opus[[:space:]]*$' "$ROOT_DIR/agents/$agent.md" 2>/dev/null; then
    pass "agent $agent routes to opus"; else fail "agents/$agent.md must declare model: opus"; fi
done
if grep -Eq '^model:[[:space:]]*sonnet[[:space:]]*$' "$ROOT_DIR/agents/tiger-code-generator.md" 2>/dev/null; then
  pass "agent tiger-code-generator routes to sonnet"; else
  fail "agents/tiger-code-generator.md must declare model: sonnet"; fi

# Code generator board ownership + v6 quality rules (no comments, simplify pass).
GEN_MD="$ROOT_DIR/agents/tiger-code-generator.md"
if grep -q 'Never touch `feature_list.json`' "$GEN_MD" 2>/dev/null; then
  fail "tiger-code-generator.md still has the contradictory 'Never touch feature_list.json' absolute"; else
  pass "tiger-code-generator.md has no contradictory whole-board ban"; fi
if grep -qi 'acceptance_criteria' "$GEN_MD" 2>/dev/null && grep -qiE 'pre-grad' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md forbids pre-grading AC (e2e's job)"; else
  fail "tiger-code-generator.md must forbid setting acceptance_criteria status / pre-grading"; fi
if grep -qi 'simplif' "$GEN_MD" 2>/dev/null && grep -qiE 'no comment|comment-free|without comment' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md requires the simplify pass + no-comments rule"; else
  fail "tiger-code-generator.md must require a simplify pass and forbid comments in generated code"; fi

# E2E gate: priority triage, the E2E_BLOCKERS token the workflow reads, and case iteration.
E2E_MD="$ROOT_DIR/agents/tiger-e2e.md"
if grep -qi 'priority' "$E2E_MD" 2>/dev/null && grep -q 'E2E_BLOCKERS' "$E2E_MD" 2>/dev/null; then
  pass "tiger-e2e.md triages by priority and emits E2E_BLOCKERS"; else
  fail "tiger-e2e.md must triage by priority and emit E2E_BLOCKERS"; fi
if grep -qiE 'append|source:e2e|add (more|new) (e2e )?cases|expand coverage' "$E2E_MD" 2>/dev/null; then
  pass "tiger-e2e.md iterates and adds more cases"; else
  fail "tiger-e2e.md must iterate and append more e2e cases (not a single fixed pass)"; fi

# ── Workflow script (v6) ─────────────────────────────────────────────────────────
WF="$ROOT_DIR/workflows/tiger-workflow-dev.js"
if [ -f "$WF" ]; then
  pass "workflow exists"
  if head -n 40 "$WF" | grep -q '^export const meta = {'; then
    pass "workflow meta is an export-const literal near the top"; else
    fail "workflow meta must be 'export const meta = {' as the first statement"; fi
  if grep -q 'parallel(' "$WF" && grep -q 'MAX_STUCK' "$WF"; then
    pass "workflow encodes parallel build worktrees + the bounded retry cap"; else
    fail "workflow must encode parallel( ) and a MAX_STUCK retry cap"; fi
  if grep -qi 'bootstrap' "$WF"; then pass "workflow has a bootstrap discovery step"; else
    fail "workflow must auto-discover the feature via a bootstrap step"; fi
  if grep -qE 'tiger-skills:tiger-(security|reviewer)' "$WF"; then
    fail "workflow must NOT spawn tiger-security/tiger-reviewer (standalone in v6)"; else
    pass "workflow does not spawn the in-loop security/reviewer gates"; fi
  if grep -q 'E2E_BLOCKERS' "$WF"; then pass "workflow reads the e2e priority blocker counts"; else
    fail "workflow must read E2E_BLOCKERS"; fi
  # v6: dev is the integration trunk; main is never the workflow's build base.
  if grep -qE '"dev"|\bdev\b' "$WF"; then pass "workflow integrates on dev"; else
    fail "workflow must use dev as the integration trunk"; fi
  if grep -qiE 'merge --ff-only|fast-forward merge to dev' "$WF"; then
    pass "workflow fast-forward merges to dev (never main)"; else
    fail "workflow must fast-forward merge to dev (the kit never touches main)"; fi
  if command -v node >/dev/null 2>&1; then
    if node -e '
      const fs=require("fs");const src=fs.readFileSync(process.argv[1],"utf8");
      const body=src.replace(/^export const meta/m,"const meta");
      const AF=Object.getPrototypeOf(async function(){}).constructor;
      new AF("args","budget","agent","parallel","pipeline","phase","log","workflow",body);
    ' "$WF" 2>/dev/null; then
      pass "workflow script parses (async-wrapped, like the runtime)"; else
      fail "workflow script has a syntax error"; fi
  else
    pass "node not found; workflow syntax check skipped"
  fi
else
  fail "workflows/tiger-workflow-dev.js missing"
fi

# ── Markdown artifact templates (v6) ─────────────────────────────────────────────
for tpl in feature CODEBASE_MAP business release_docs; do
  TPL="$ROOT_DIR/templates/$tpl.md"
  if [ -f "$TPL" ] && head -n 3 "$TPL" | grep -qE '^(#|---)'; then
    pass "templates/$tpl.md exists and is markdown"; else
    fail "templates/$tpl.md missing or not markdown"; fi
done
# feature.md carries the frontmatter approval token and ships unapproved.
FEAT_TPL="$ROOT_DIR/templates/feature.md"
if grep -qE '^tiger-status:[[:space:]]*awaiting_review[[:space:]]*$' "$FEAT_TPL" 2>/dev/null \
   && ! grep -qE '^tiger-status:[[:space:]]*approved[[:space:]]*$' "$FEAT_TPL" 2>/dev/null; then
  pass "feature.md template ships tiger-status: awaiting_review (never pre-approved)"; else
  fail "templates/feature.md must carry 'tiger-status: awaiting_review' and never the approved token"; fi
# CODEBASE_MAP is markdown, not HTML, and may carry a mermaid fence (no CDN).
if grep -qiE '<!DOCTYPE html>|cdn\.jsdelivr' "$ROOT_DIR/templates/CODEBASE_MAP.md" 2>/dev/null; then
  fail "templates/CODEBASE_MAP.md must be plain markdown (no HTML doctype, no CDN)"; else
  pass "templates/CODEBASE_MAP.md is plain markdown"; fi
# Old HTML templates must be gone.
for old in spec.html adr.html business.html codemap.html release_docs.html e2e_testcases.html; do
  if [ -f "$ROOT_DIR/templates/$old" ]; then fail "templates/$old must not exist (migrated to markdown)"; else
    pass "retired template $old is gone"; fi
done

# ── Robot Framework e2e templates ───────────────────────────────────────────────
E2E_ROBOT="$ROOT_DIR/templates/e2e_testcases.robot"
if [ -f "$E2E_ROBOT" ] && grep -q '\*\*\* Test Cases \*\*\*' "$E2E_ROBOT"; then
  pass "templates/e2e_testcases.robot is a Robot suite"; else
  fail "templates/e2e_testcases.robot missing or not a Robot suite"; fi
E2E_RES="$ROOT_DIR/templates/e2e_keywords.resource"
if [ -f "$E2E_RES" ] && grep -q '\*\*\* Keywords \*\*\*' "$E2E_RES"; then
  pass "templates/e2e_keywords.resource is a Robot resource"; else
  fail "templates/e2e_keywords.resource missing or not a Robot resource"; fi
# Approval marker lives in Metadata now, not a # comment, and ships unapproved.
if grep -qE '^Metadata[[:space:]]+tiger-status[[:space:]]+awaiting_review' "$E2E_ROBOT" 2>/dev/null \
   && ! grep -qE '^Metadata[[:space:]]+tiger-status[[:space:]]+approved' "$E2E_ROBOT" 2>/dev/null; then
  pass "e2e_testcases.robot ships Metadata tiger-status awaiting_review (off comments)"; else
  fail "templates/e2e_testcases.robot must carry 'Metadata tiger-status awaiting_review' (not a # comment)"; fi
# The templates must not reuse the old # comment status token.
if grep -qE '^# tiger-status' "$E2E_ROBOT" "$E2E_RES" 2>/dev/null; then
  fail "robot templates must not carry the old '# tiger-status' comment token (moved to Metadata)"; else
  pass "robot templates carry no old # status comment token"; fi

# ── Reference board ──────────────────────────────────────────────────────────────
BOARD_TPL="$ROOT_DIR/templates/feature_list.json"
if [ -f "$BOARD_TPL" ]; then
  if python3 "$BOARD_VALIDATOR" "$BOARD_TPL" >/dev/null 2>&1 \
     && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); fs=d.get("features",{}); sys.exit(0 if len(fs)>=2 and any(f.get("tasks") for f in fs.values()) and any(f.get("depends_on") for f in fs.values()) else 1)' "$BOARD_TPL" 2>/dev/null; then
    pass "templates/feature_list.json is a valid worked reference board"; else
    fail "templates/feature_list.json must be a valid schema-v2 board (tasks + a cross-feature dependency)"; fi
  if grep -q 'spec.html' "$BOARD_TPL" 2>/dev/null; then
    fail "templates/feature_list.json spec_file must point at feature.md, not spec.html"; else
    pass "reference board spec_file points at feature.md"; fi
else
  fail "templates/feature_list.json missing"
fi

# install must seed an EMPTY board, scaffold init.sh, and migrate old projects.
INSTALL="$ROOT_DIR/commands/install.md"
if grep -q 'cp .*templates/feature_list.json' "$INSTALL" 2>/dev/null; then
  fail "install must NOT cp templates/feature_list.json (it has demo features) — seed empty inline"; else
  pass "install seeds an empty board, never copies the reference"; fi
if grep -q '> init.sh' "$INSTALL" 2>/dev/null && grep -qi 'fail.closed' "$INSTALL" 2>/dev/null; then
  pass "install scaffolds init.sh (runnable gate or fail-closed stub)"; else
  fail "install must scaffold init.sh (not just check presence)"; fi
if grep -qi 'migrat' "$INSTALL" 2>/dev/null; then
  pass "install migrates old-version projects to the current version"; else
  fail "install must migrate an old-version project (convert old artifacts/filenames) every run"; fi
if grep -qiE 'dev branch|born `dev`|branch dev' "$INSTALL" 2>/dev/null; then
  pass "install ensures a dev integration branch"; else
  fail "install must ensure a born dev branch (the integration trunk)"; fi

# ── Frontmatter approval gate logic ─────────────────────────────────────────────
HG_TMP="$(mktemp -d)"
printf '%s\n' 'tiger-status: approved' > "$HG_TMP/yes.md"
printf '%s\n' 'tiger-status: awaiting_review' > "$HG_TMP/no1.md"
printf '%s\n' 'tiger-status: not approved' > "$HG_TMP/no2.md"
printf '%s\n' 'tiger-status: approved (pending lead)' > "$HG_TMP/no3.md"
GATE='^tiger-status:[[:space:]]*approved[[:space:]]*$'
if grep -Eq "$GATE" "$HG_TMP/yes.md" \
   && ! grep -Eq "$GATE" "$HG_TMP/no1.md" \
   && ! grep -Eq "$GATE" "$HG_TMP/no2.md" \
   && ! grep -Eq "$GATE" "$HG_TMP/no3.md"; then
  pass "frontmatter approval gate opens only on exact 'tiger-status: approved'"; else
  fail "frontmatter approval gate must open only on the exact approved line"; fi
rm -rf "$HG_TMP"

if [ "$FAILURES" -ne 0 ]; then
  echo "Validation failed with $FAILURES failure(s)." >&2
  exit 1
fi
echo "Validation passed."
