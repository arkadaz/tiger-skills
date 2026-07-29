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
  # a worktree coder's ONLY board read: one task packet, not the whole feature.
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" task F1 T1 2>/dev/null | grep -q '"id": "T1"' || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" task F1 NOPE >/dev/null 2>&1 && BC_OK=0
  # recency discovery: an approved, non-passing feature is the newest buildable candidate.
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" approve F1 >/dev/null 2>&1 || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" newest-approved 2>/dev/null | grep -q '^F1$' || BC_OK=0
  # a write that breaks WIP=1 must be REFUSED (fail closed): add a second in_progress feature.
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" add-feature F2 --title t --start >/dev/null 2>&1 && BC_OK=0
  # ATOMIC transitions: status + current_feature move together, so a two-step set-* is refused in BOTH
  # orders — clock-in, park, and close-out MUST each be one validated write or the loop deadlocks.
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" add-feature F3 --title t >/dev/null 2>&1 || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" switch F3 >/dev/null 2>&1 || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" get F3 status 2>/dev/null | grep -q '^in_progress$' || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" current 2>/dev/null | grep -q '^F3$' || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" get F1 status 2>/dev/null | grep -q '^blocked$' || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" close F3 >/dev/null 2>&1 || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" get F3 phase 2>/dev/null | grep -q '^passing$' || BC_OK=0
  python3 "$BOARD_CLI" --file "$BC_TMP/feature_list.json" current 2>/dev/null | grep -q '^None$' || BC_OK=0
  if [ "$BC_OK" -eq 1 ]; then
    pass "board.py reads + patches the board (recency, one-task packet, ATOMIC switch/close) and refuses an invariant-breaking write"
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
# grill is interactive (inline skill, no agent). v7: 3 in-loop stages own agents — the merged
# lead (architect+e2e), the code generator it spawns, and update-docs.
for agent in tiger-lead tiger-code-generator tiger-update-docs; do
  if [ -f "$ROOT_DIR/agents/$agent.md" ]; then pass "agent $agent present"; else fail "agent $agent.md missing"; fi
done
# architect + e2e merged into tiger-lead; review (formerly security/reviewer) is a standalone SKILL
# with no owned agent — none of these agent files may exist.
for retired in tiger-planner tiger-generator tiger-evaluator tiger-grill-interviewer tiger-conductor tiger-dev tiger-architect tiger-e2e tiger-security tiger-reviewer tiger-review; do
  if [ -f "$ROOT_DIR/agents/$retired.md" ]; then fail "agents/$retired.md must not exist (retired/merged/standalone-skill)"; fi
done
WF_FILES="$(cd "$ROOT_DIR/workflows" 2>/dev/null && ls *.js 2>/dev/null | sort | tr '\n' ' ')"
if [ "$WF_FILES" = "research-workflow.js tiger-workflow-dev.js " ]; then
  pass "workflows/ contains the two spines (dev + research)"; else
  fail "workflows/ must contain exactly {research-workflow.js, tiger-workflow-dev.js} (found: ${WF_FILES:-none})"; fi

# Research loop (second spine + its git-free novelty engine): parse + key markers + compiles.
RWF="$ROOT_DIR/workflows/research-workflow.js"
if node --check "$RWF" 2>/dev/null; then pass "research-workflow.js parses"; else fail "research-workflow.js has syntax errors"; fi
if grep -qF 'tiger-skills:tiger-researcher' "$RWF" 2>/dev/null; then pass "research spine spawns tiger-researcher"; else fail "research spine must spawn tiger-skills:tiger-researcher"; fi
if grep -qF 'tiger-status' "$RWF" 2>/dev/null; then pass "research spine approval-gates goal.md"; else fail "research spine must gate on tiger-status: approved"; fi
if python3 -m py_compile "$ROOT_DIR/scripts/research.py" 2>/dev/null; then pass "research.py compiles"; else fail "scripts/research.py has syntax errors"; fi
if python3 -m py_compile "$ROOT_DIR/scripts/validate-research.py" 2>/dev/null; then pass "validate-research.py compiles"; else fail "scripts/validate-research.py has syntax errors"; fi

# Reasoning effort must be OPT-IN: a default run has to send NO effort field at all, because the runtime
# pairs it with thinking:disabled and some Anthropic-compatible backends 400 on that combination, killing
# every agent at spawn. Run the spine three times — bare, with {"effort":"high"}, and with a bogus value —
# and assert the field is absent, applied to every spawn, and dropped respectively.
WF_EFFORT="$ROOT_DIR/workflows/tiger-workflow-dev.js"
if command -v node >/dev/null 2>&1; then
  if node -e '
    const fs=require("fs");const body=fs.readFileSync(process.argv[1],"utf8").replace(/^export const meta/m,"const meta");
    const AF=Object.getPrototypeOf(async function(){}).constructor;
    const run=(args)=>{
      const seen=[];
      const agent=async(p,o={})=>{ seen.push(o.effort===undefined?null:o.effort);
        if(/MODE: PLAN/.test(p)) return {abort:null,featureId:"F1",featureTitle:"v",today:"d",branchBase:"dev",waves:[["T1"]],uiFeature:false,tasksTotal:1,verifyCmd:"./init.sh"};
        if(/MODE: E2E-PROVISION/.test(p)) return {ready:true,browser:false,dryrun:"n/a",note:"x"};
        if(/WORKTREE CODER/.test(p)) return {task:"T1",status:"GREEN",branch:"b",commit:"c"};
        if(/MODE: INTEGRATE/.test(p)) return {integrated:["T1"],failed:[],retry:[],verificationGreen:true};
        if(/MODE: VERIFY/.test(p)) return {grade:"PASS",high:0,medium:0,low:0,tasksDone:1,tasksTotal:1,deltaWaves:[]};
        return "FINALIZE_STATUS: MERGED_TO_DEV"; };
      const fn=new AF("args","budget","agent","parallel","pipeline","phase","log","workflow",body);
      return fn(args,{total:null,spent:()=>0,remaining:()=>Infinity},agent,async(t)=>Promise.all(t.map((f)=>f())),async(i)=>i,()=>{},()=>{},async()=>null).then(()=>seen);
    };
    run({}).then((bare)=>{
      if(bare.some((e)=>e!==null)) throw new Error("default run sent an effort field: "+JSON.stringify(bare));
      return run({effort:"high"}).then((set)=>{
        if(!set.length || set.some((e)=>e!=="high")) throw new Error("effort arg not applied to every spawn: "+JSON.stringify(set));
        return run({effort:"bogus"}).then((bad)=>{
          if(bad.some((e)=>e!==null)) throw new Error("an invalid effort value was forwarded: "+JSON.stringify(bad));
          process.exit(0);
        });
      });
    }).catch((e)=>{ console.error(String((e&&e.message)||e)); process.exit(1); });
  ' "$WF_EFFORT" 2>/dev/null; then
    pass "reasoning effort is opt-in (absent by default, applied to every spawn when asked, invalid values dropped)"; else
    fail "effort wiring is wrong: a default run must send NO effort, {effort:...} must reach every spawn, an invalid value must be dropped"; fi
fi


# Model routing mirrors agent frontmatter: opus everywhere except the code generator (sonnet).
for agent in tiger-lead tiger-update-docs; do
  if grep -Eq '^model:[[:space:]]*opus[[:space:]]*$' "$ROOT_DIR/agents/$agent.md" 2>/dev/null; then
    pass "agent $agent routes to opus"; else fail "agents/$agent.md must declare model: opus"; fi
done
if grep -Eq '^model:[[:space:]]*sonnet[[:space:]]*$' "$ROOT_DIR/agents/tiger-code-generator.md" 2>/dev/null; then
  pass "agent tiger-code-generator routes to sonnet"; else
  fail "agents/tiger-code-generator.md must declare model: sonnet"; fi

# Code generator: v10 ownership (builds in a worktree, writes NO shared state — the architect records
# the board after the merge) + the quality rules (no comments, simplify pass).
GEN_MD="$ROOT_DIR/agents/tiger-code-generator.md"
if grep -qE 'board\.py[[:space:]]+(set-task|set-ac|set-phase|set-status|set-current)' "$GEN_MD" 2>/dev/null; then
  fail "tiger-code-generator.md must not instruct a board WRITE (v10: the architect records tasks[].status after the merge)"; else
  pass "tiger-code-generator.md writes no shared board state (architect records it)"; fi
if grep -qi 'worktree' "$GEN_MD" 2>/dev/null && grep -qiE 'own branch|your branch|per-task branch' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md builds in an isolated worktree on its own branch"; else
  fail "tiger-code-generator.md must build in an isolated worktree and commit on its own per-task branch"; fi
if grep -qiE 'PACKET GAP' "$GEN_MD" 2>/dev/null && grep -qiE 'do not explore|not explore|never.*explor' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md forbids exploring and mandates the PACKET GAP report"; else
  fail "tiger-code-generator.md must forbid codebase exploration and require a PACKET GAP report instead"; fi
if grep -qiE 'reuse' "$GEN_MD" 2>/dev/null && grep -qiE 'ladder' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md carries the reuse-before-build ladder"; else
  fail "tiger-code-generator.md must carry the reuse-before-build (lazy-senior) ladder"; fi
if grep -qi 'acceptance_criteria' "$GEN_MD" 2>/dev/null && grep -qiE 'pre-grad' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md forbids pre-grading AC (e2e's job)"; else
  fail "tiger-code-generator.md must forbid setting acceptance_criteria status / pre-grading"; fi
if grep -qi 'simplif' "$GEN_MD" 2>/dev/null && grep -qiE 'no comment|comment-free|without comment' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md requires the simplify pass + no-comments rule"; else
  fail "tiger-code-generator.md must require a simplify pass and forbid comments in generated code"; fi

# Plan+verify lead: it must carry BOTH the planning half (architect) and the verify half (e2e gate)
# and drive UI for real. Under the workflow it does NOT spawn the coders (the deterministic conductor
# does — so steps are guaranteed + context bounded); it keeps the Agent tool for the standalone path.
LEAD_MD="$ROOT_DIR/agents/tiger-lead.md"
# frontmatter: opus + Write (so it can author the e2e keyword layer — the old e2e agent lacked Write,
# a root cause of missed UI cases). Agent stays for the standalone top-level path.
LEAD_TOOLS=$(grep -E '^tools:' "$LEAD_MD" | head -1)
if printf '%s' "$LEAD_TOOLS" | grep -q 'Write'; then
  pass "tiger-lead.md has Write (authors the e2e keyword layer)"; else
  fail "tiger-lead.md must list Write (to author e2e_keywords.resource)"; fi
# planning half + verify half + the priority triage / token the workflow reads.
if grep -qiE 'blueprint|acceptance check|scope_map|CODEBASE_MAP' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md carries the planning half (blueprint + acceptance checks + codemap)"; else
  fail "tiger-lead.md must carry the architect planning half"; fi
if grep -qi 'priority' "$LEAD_MD" 2>/dev/null && grep -q 'E2E_BLOCKERS' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md triages by priority and emits E2E_BLOCKERS"; else
  fail "tiger-lead.md must triage by priority and emit E2E_BLOCKERS"; fi
if grep -q 'e2e_testcases.robot' "$LEAD_MD" 2>/dev/null && grep -qiE 'author' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md authors the e2e suite itself (v8: lead-owned cases)"; else
  fail "tiger-lead.md must author e2e_testcases.robot itself (the lead owns the e2e cases in v8)"; fi
if grep -qiE 'extend|append' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md extends coverage across verify rounds"; else
  fail "tiger-lead.md must extend e2e coverage as new risks surface"; fi
# The lead runs in two conductor-driven modes; it must document them (PLAN returns the task order,
# VERIFY runs the suite) and must NOT claim to spawn the coders itself (the conductor does).
if grep -qiE 'MODE:?[[:space:]]*PLAN' "$LEAD_MD" 2>/dev/null && grep -qiE 'MODE:?[[:space:]]*VERIFY' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md documents its PLAN and VERIFY conductor modes"; else
  fail "tiger-lead.md must document the PLAN and VERIFY modes the conductor drives"; fi
# v10: the architect (not a coder-integrator) merges every wave, and warms the e2e runtime in parallel
# with the first build wave.
if grep -qiE 'MODE:?[[:space:]]*INTEGRATE' "$LEAD_MD" 2>/dev/null && grep -qi 'cherry-pick' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md owns the wave merge (MODE INTEGRATE, cherry-pick)"; else
  fail "tiger-lead.md must document MODE INTEGRATE — the architect cherry-picks each wave itself"; fi
if grep -qiE 'MODE:?[[:space:]]*E2E-PROVISION' "$LEAD_MD" 2>/dev/null && grep -qi 'dryrun' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md provisions the e2e runtime beside PLAN (MODE E2E-PROVISION) and dryrun-proves the keyword layer it authors"; else
  fail "tiger-lead.md must document MODE E2E-PROVISION and the PLAN-time keyword layer proven with robot --dryrun"; fi
# v10.1: the boundary contract is what stops a trust-boundary defect reaching the gate — the whole
# point of the taxonomy is that it is INSTANTIATED, not improvised, so both halves must be present.
if grep -qi 'hostile-input taxonomy' "$LEAD_MD" 2>/dev/null && grep -q 'ABUSE' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md carries the standing hostile-input taxonomy + the ABUSE packet section"; else
  fail "tiger-lead.md must carry the standing hostile-input taxonomy and require an ABUSE corpus at every trust boundary"; fi
if grep -q 'ABUSE' "$GEN_MD" 2>/dev/null; then
  pass "tiger-code-generator.md treats the ABUSE corpus as tests it must write and keep green"; else
  fail "tiger-code-generator.md must require the packet's ABUSE corpus rows as its own tests"; fi
if grep -qi 'equivalence class' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md extends the suite by equivalence class on a confirmed boundary defect"; else
  fail "tiger-lead.md must extend by equivalence class when it confirms a trust-boundary defect (one sibling per round is what makes a round 2 a round 3)"; fi
if grep -qiE 'REUSE INVENTORY' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md builds the reuse inventory its packets inline"; else
  fail "tiger-lead.md must build a REUSE INVENTORY during recon (so coders reuse instead of reinventing)"; fi
# UI is not optional — the merged lead must mandate a real browser drive (Playwright), the fix for
# the missed-UI-testcase pain.
if grep -qiE 'browser|playwright|rfbrowser' "$LEAD_MD" 2>/dev/null; then
  pass "tiger-lead.md mandates real UI (Playwright/Browser) verification"; else
  fail "tiger-lead.md must mandate real-browser UI verification"; fi

# ── Workflow script (v6) ─────────────────────────────────────────────────────────
WF="$ROOT_DIR/workflows/tiger-workflow-dev.js"
if [ -f "$WF" ]; then
  pass "workflow exists"
  if head -n 40 "$WF" | grep -q '^export const meta = {'; then
    pass "workflow meta is an export-const literal near the top"; else
    fail "workflow meta must be 'export const meta = {' as the first statement"; fi
  # v7 slim spine: it launches the merged lead, which owns the parallel worktree build + bounded
  # re-plan loop internally (those markers live in agents/tiger-lead.md now).
  if grep -qF 'tiger-skills:tiger-lead' "$WF"; then
    pass "workflow launches the merged lead (owns build + verify + bounded loop)"; else
    fail "workflow must launch tiger-skills:tiger-lead"; fi
  if grep -q 'newest-approved' "$WF"; then pass "workflow auto-discovers the newest approved feature (lead-led, no bootstrap spawn)"; else
    fail "workflow must auto-discover the feature (newest-approved) inside the lead PLAN spawn"; fi
  if grep -qE 'tiger-skills:tiger-(security|review|architect|e2e)' "$WF"; then
    fail "workflow must NOT spawn review/security (standalone) or architect/e2e (merged into lead)"; else
    pass "workflow does not spawn standalone/merged-away agents directly"; fi
  if grep -q 'E2E_BLOCKERS' "$WF"; then pass "workflow reads the e2e priority blocker counts"; else
    fail "workflow must read E2E_BLOCKERS"; fi
  # v6: dev is the integration trunk; main is never the workflow's build base.
  if grep -qE '"dev"|\bdev\b' "$WF"; then pass "workflow integrates on dev"; else
    fail "workflow must use dev as the integration trunk"; fi
  # The workflow-conductor spawns update-docs on PASS (ff-merge to dev) — deterministic, guaranteed finalize.
  if grep -qiE 'tiger-update-docs|fast-forward merge' "$WF"; then
    pass "workflow spawns update-docs to finalize (ff-merge to dev)"; else
    fail "workflow must spawn update-docs (ff-merge to dev) on PASS"; fi
  # The conductor spawns the coders itself (deterministic orchestration), so the workflow must name them.
  if grep -qi 'tiger-code-generator' "$WF"; then
    pass "workflow-conductor spawns tiger-code-generator per task"; else
    fail "workflow must spawn tiger-code-generator (the conductor builds each wave)"; fi
  # v10: EVERY task is built by a coder in an isolated worktree (no inline/lead-built path), and the
  # ARCHITECT — not a coder-integrator — merges each wave.
  if grep -q 'isolation: "worktree"' "$WF"; then
    pass "workflow builds every task in an isolated worktree coder"; else
    fail "workflow must spawn coders with isolation: \"worktree\" (parallel, race-free builds)"; fi
  if grep -qE 'buildMode|"inline"' "$WF"; then
    fail "workflow must not carry the retired buildMode/inline path (v10: coders always build, the architect always merges)"; else
    pass "workflow has no retired inline build path"; fi
  if grep -qiE 'MODE: INTEGRATE' "$WF" && grep -qi 'cherry-pick' "$WF"; then
    pass "workflow has the architect merge each wave (MODE INTEGRATE)"; else
    fail "workflow must drive the lead's MODE INTEGRATE (the architect cherry-picks each wave)"; fi
  if grep -q 'board.py task' "$WF"; then
    pass "workflow points coders at the single-task packet read (board.py task)"; else
    fail "workflow must give coders the task-scoped board read (python3 tiger/board.py task <id> <task>)"; fi
  if command -v node >/dev/null 2>&1; then
    if node -e '
      const fs=require("fs");const src=fs.readFileSync(process.argv[1],"utf8");
      const body=src.replace(/^export const meta/m,"const meta");
      const AF=Object.getPrototypeOf(async function(){}).constructor;
      new AF("args","budget","agent","parallel","pipeline","phase","log","workflow",body);
    ' "$WF" 2>/dev/null; then
      pass "workflow script parses (async-wrapped, like the runtime)"; else
      fail "workflow script has a syntax error"; fi
    # Parsing is not enough: a const referenced in a stage prompt ABOVE its own declaration throws a
    # temporal-dead-zone ReferenceError only when that prompt template is built at runtime. EXECUTE the
    # body with stub globals through the bootstrap + lead spawns to catch that class before it ships.
    # Parsing is not enough: a const referenced in a stage prompt ABOVE its own declaration throws a
    # temporal-dead-zone ReferenceError only when that prompt template is built at runtime. EXECUTE the
    # whole spine with stub globals — plan → coders → integrate → verify → finalize — so EVERY stage
    # prompt is actually constructed. A stub that stops at the second spawn would never build the coder,
    # integrate, verify or finalize prompts, which is exactly where that class of bug hides.
    # parallel() is STRICT Promise.all here: a rejecting thunk must be caught by the workflow itself.
    if node -e '
      const fs=require("fs");const src=fs.readFileSync(process.argv[1],"utf8");
      const body=src.replace(/^export const meta/m,"const meta");
      const AF=Object.getPrototypeOf(async function(){}).constructor;
      const fn=new AF("args","budget","agent","parallel","pipeline","phase","log","workflow",body);
      const seen=new Set(); let worst=0, worstStage="";
      // Worst-case payload: a full-width wave of maximally chatty coders. Every field a coder returns is
      // interpolated into the architect prompts, so this is what actually decides whether a spawn dies on
      // the ~8191-char Windows command-line limit — static source length never shows it.
      const BIG="x".repeat(600);
      const agent=async(p)=>{
        if(p.length>worst){ worst=p.length; worstStage=(p.match(/MODE: [A-Z-]+|WORKTREE CODER|tiger-update-docs/)||["?"])[0]; }
        if(/MODE: PLAN/.test(p)){ seen.add("plan"); return {abort:null,featureId:"F1",featureTitle:"v",today:"2026-01-01",branchBase:"dev",waves:[["T1","T2","T3","T4","T5","T6"],["T7"]],uiFeature:true,tasksTotal:7,verifyCmd:"./init.sh",setupCmd:"npm ci",assumptions:[BIG,BIG,BIG,BIG,BIG,BIG,BIG,BIG]}; }
        if(/MODE: E2E-PROVISION/.test(p)){ seen.add("provision"); return {ready:true,browser:true,dryrun:"n/a",note:BIG}; }
        if(/WORKTREE CODER/.test(p)){ seen.add("coder"); if(/"T2"/.test(p)) throw new Error("simulated coder rejection"); return {task:"T",status:"GREEN",branch:"feature/F1-r1w1-Tn",commit:"abc1234",reused:BIG,verification:BIG,packetGap:BIG,note:BIG}; }
        if(/MODE: INTEGRATE/.test(p)){ seen.add("integrate"); return {integrated:["T1"],failed:[],retry:[],qualityFindings:[BIG],verificationGreen:true}; }
        if(/MODE: VERIFY/.test(p)){ seen.add("verify"); return {grade:"PASS",high:0,medium:0,low:0,tasksDone:7,tasksTotal:7,deltaWaves:[]}; }
        seen.add("finalize"); return "FINALIZE_STATUS: MERGED_TO_DEV";
      };
      const parallel=async(t)=>Promise.all(t.map((f)=>f()));
      const noop=()=>{};
      const budget={total:null,spent:()=>0,remaining:()=>Infinity};
      fn({},budget,agent,parallel,async(i)=>i,noop,noop,async()=>null)
        .then((r)=>{
          const need=["plan","provision","coder","integrate","verify","finalize"];
          const missing=need.filter((s)=>!seen.has(s));
          if(missing.length){ console.error("stages never reached: "+missing.join(",")); process.exit(1); }
          if(!r||r.passed!==true){ console.error("spine did not reach PASS: "+JSON.stringify(r)); process.exit(1); }
          if(worst>8000){ console.error("prompt too long for a Windows subagent spawn: "+worst+" chars at "+worstStage); process.exit(1); }
          process.exit(0);
        })
        .catch((e)=>{ console.error(String((e&&e.message)||e)); process.exit(1); });
    ' "$WF" 2>/dev/null; then
      pass "workflow spine executes end to end with stubs (every stage prompt built + bounded under 8000 chars; no TDZ; a rejecting coder cannot abort the run)"; else
      fail "workflow spine failed the stubbed end-to-end run (TDZ, an unreached stage, an uncaught coder rejection, an over-long prompt, or no PASS)"; fi
  else
    pass "node not found; workflow syntax check skipped"
  fi
else
  fail "workflows/tiger-workflow-dev.js missing"
fi

# ── Line endings: a CR byte in a machine-consumed file breaks the runtime ───────
# A workflow script containing \r is REJECTED by the Workflow approval layer ("control characters that
# would be hidden in the approval dialog"), so /tiger-workflow-dev can never launch; a shell hook with
# CRLF dies on its shebang ("bad interpreter"). .gitattributes normalizes on checkout, but a file EDITED
# on Windows lands CRLF in the working tree — which is exactly what install/the benchmark copy. Check the
# bytes, not the config.
CRLF_BAD=""
while IFS= read -r f; do
  case "$f" in */node_modules/*|*/.git/*) continue;; esac
  if grep -qU $'\r' "$ROOT_DIR/$f" 2>/dev/null; then CRLF_BAD="$CRLF_BAD $f"; fi
done <<EOF
$(cd "$ROOT_DIR" && find workflows scripts hooks project-hooks templates -type f \( -name '*.js' -o -name '*.sh' -o -name '*.py' -o -name '*.robot' -o -name '*.resource' -o -name '*.json' \) 2>/dev/null)
EOF
if [ -z "$CRLF_BAD" ]; then
  pass "machine-consumed files are LF-only (no CR bytes to break the workflow approval layer or a shebang)"
else
  fail "CRLF found in machine-consumed file(s) — the Workflow runtime rejects a script with control characters:$CRLF_BAD"
fi

# ── Retired v9 vocabulary must be gone everywhere an agent reads ────────────────
# The workflow itself is checked above, but the docs an agent actually loads at runtime
# (CLAUDE.md, the SessionStart contract, the agent manuals, the skills) are what create
# contradictory instructions when they lag a spine change. Sweep them for the retired terms.
V10_STALE=0
for doc in CLAUDE.md README.md AGENTS.md hooks/tiger-session-start.sh docs/tiger-cheatsheet.md \
  docs/tiger-git-best-practice.md agents/tiger-lead.md agents/tiger-code-generator.md \
  skills/tiger-lead/SKILL.md skills/tiger-code-generator/SKILL.md; do
  [ -f "$ROOT_DIR/$doc" ] || continue
  # `inline` survives only in legitimate senses (inline interview, inline the signature); the retired
  # BUILD-MODE vocabulary is what must not appear.
  if grep -nEi 'buildMode|inline (build|mode)|builds (it )?inline|verifies inline|waves mode|1-task wave|an integrator' "$ROOT_DIR/$doc" >/dev/null 2>&1; then
    fail "retired v9 build-mode vocabulary in $doc (v10: coders always build in worktrees, the architect always merges)"
    V10_STALE=1
  fi
done
[ "$V10_STALE" -eq 0 ] && pass "no retired v9 build-mode vocabulary in the docs agents load"
# The SessionStart contract is force-injected into every Tiger session, so it must name the v10 spine.
if grep -q 'INTEGRATE' "$ROOT_DIR/hooks/tiger-session-start.sh" && grep -q 'E2E-PROVISION' "$ROOT_DIR/hooks/tiger-session-start.sh"; then
  pass "SessionStart contract names the v10 stages (INTEGRATE + E2E-PROVISION)"; else
  fail "hooks/tiger-session-start.sh must describe the v10 spine (lead INTEGRATE + E2E-PROVISION)"; fi

# ── Markdown artifact templates (v8) ─────────────────────────────────────────────
for tpl in spec feature CODEBASE_MAP business release_docs; do
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
# v8: the suite is LEAD-authored (no grill approval token); machine metadata identifies feature + stage.
if grep -qE '^Metadata[[:space:]]+tiger-feature-id' "$E2E_ROBOT" 2>/dev/null \
   && grep -qE '^Metadata[[:space:]]+tiger-stage[[:space:]]+lead' "$E2E_ROBOT" 2>/dev/null; then
  pass "e2e_testcases.robot carries Metadata tiger-feature-id + tiger-stage lead (lead-authored)"; else
  fail "templates/e2e_testcases.robot must carry Metadata tiger-feature-id and tiger-stage lead"; fi
if grep -qE '^Metadata[[:space:]]+tiger-status[[:space:]]+approved' "$E2E_ROBOT" 2>/dev/null; then
  fail "templates/e2e_testcases.robot must not ship an approved token"; else
  pass "e2e_testcases.robot ships no approval token (approval lives in feature.md)"; fi
# The templates must not reuse the old # comment status token.
if grep -qE '^# tiger-status' "$E2E_ROBOT" "$E2E_RES" 2>/dev/null; then
  fail "robot templates must not carry the old '# tiger-status' comment token (moved to Metadata)"; else
  pass "robot templates carry no old # status comment token"; fi
# spec.md is the detailed agent-facing requirements doc — no approval token of its own.
SPEC_TPL="$ROOT_DIR/templates/spec.md"
if grep -qiE 'acceptance criteria' "$SPEC_TPL" 2>/dev/null && grep -qiE 'errors' "$SPEC_TPL" 2>/dev/null \
   && ! grep -qE '^tiger-status:' "$SPEC_TPL" 2>/dev/null; then
  pass "templates/spec.md is the detailed requirements doc (ACs + error table, no gate token)"; else
  fail "templates/spec.md must carry acceptance criteria + error sections and no tiger-status token (feature.md is the gate)"; fi

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
