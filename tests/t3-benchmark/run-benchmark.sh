#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
KIT_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

# ── Cross-platform native paths (Linux/macOS + Windows Git Bash) ───────────────
# On Git Bash / MSYS / Cygwin, `pwd` and `$0` are MSYS paths (/c/Code/…) that native
# Windows Python and the native `claude` binary cannot open. `winpath` rewrites any path
# handed to a native program into a Windows path (C:/Code/…) via cygpath; on Linux/macOS it
# is the identity, so ONE script runs on both. Bash-native tools (cp, git, grep, find, cd)
# keep the MSYS path — only Python/claude arguments are converted.
case "$(uname -s)" in
MINGW* | MSYS* | CYGWIN*) IS_WINDOWS=1 ;;
*) IS_WINDOWS=0 ;;
esac
if [ "$IS_WINDOWS" -eq 1 ] && command -v cygpath >/dev/null 2>&1; then
	winpath() { cygpath -m "$1"; }
	echo "platform: Windows (Git Bash) — converting native paths via cygpath"
else
	winpath() { printf '%s' "$1"; }
	echo "platform: $(uname -s) — native paths used as-is"
fi
KIT_ROOT_N="$(winpath "$KIT_ROOT")"
SCRIPT_DIR_N="$(winpath "$SCRIPT_DIR")"

# Plugin install ref is <plugin-name>@<marketplace-name>. BOTH are read from the manifests
# (plugin.json / marketplace.json) rather than hardcoded, so renaming the marketplace (it is
# "arkadaz", not "tiger-skills") never desyncs the install / fidelity-gate / uninstall calls.
PLUGIN_NAME="$(python3 -c "import json;print(json.load(open('$KIT_ROOT_N/.claude-plugin/plugin.json'))['name'])")"
MARKETPLACE_NAME="$(python3 -c "import json;print(json.load(open('$KIT_ROOT_N/.claude-plugin/marketplace.json'))['name'])")"
PLUGIN_REF="${PLUGIN_NAME}@${MARKETPLACE_NAME}"

# Golden project under test. golden-project/ is a CONTAINER of projects; pass a bare NAME
# (resolved under golden-project/<name>), a relative path, or an ABSOLUTE path — as $1 or via
# TIGER_GOLDEN. Defaults to the calculator. The feature id is then DISCOVERED from that
# project's board (current_feature, else its single in_progress feature), never hardcoded —
# so adding a new golden project needs no edits to this script.
#   ./run-benchmark.sh                  # golden-project/calculator (default)
#   ./run-benchmark.sh /abs/path        # any Tiger project on disk
GOLDEN_ARG="${1:-${TIGER_GOLDEN:-calculator}}"
case "$GOLDEN_ARG" in
/*) GOLDEN_PROJECT="$GOLDEN_ARG" ;;                           # absolute path
*/*) GOLDEN_PROJECT="$SCRIPT_DIR/$GOLDEN_ARG" ;;              # relative path under t3-benchmark/
*) GOLDEN_PROJECT="$SCRIPT_DIR/golden-project/$GOLDEN_ARG" ;; # bare name → golden-project/<name>
esac
GOLDEN_NAME="$(basename "$GOLDEN_PROJECT")"
GOLDEN_PROJECT_N="$(winpath "$GOLDEN_PROJECT")"
if [ ! -f "$GOLDEN_PROJECT/feature_list.json" ]; then
	echo "ERROR: golden project '$GOLDEN_PROJECT' has no feature_list.json" >&2
	exit 2
fi
FEATURE_ID=$(python3 -c "
import json
d = json.load(open('$GOLDEN_PROJECT_N/feature_list.json'))
f = d.get('current_feature')
if not f:
    ip = [k for k, v in d.get('features', {}).items() if v.get('status') == 'in_progress']
    f = ip[0] if len(ip) == 1 else ''
print(f or '')
")
if [ -z "$FEATURE_ID" ]; then
	echo "ERROR: cannot determine the feature id from $GOLDEN_PROJECT/feature_list.json" >&2
	echo "       (need current_feature set, or exactly one feature with status: in_progress)" >&2
	exit 2
fi
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BENCH_DIR="/tmp/tiger-bench-${TIMESTAMP}"
SCORECARD_DIR="$KIT_ROOT/tests/scorecards"
TIMEOUT=18000 # 5 hours

# Model tiers — override via env vars or edit here.
# The workflow's agent() calls pass these directly; agent frontmatter model: is ignored by the runtime.
# Use "inherit" to let the session default decide (no model arg sent).
PRO_MODEL="${TIGER_PRO_MODEL:-opus}"     # architect, security, reviewer, e2e, update-docs
FAST_MODEL="${TIGER_FAST_MODEL:-sonnet}" # code-generator, integrator

# Read version from plugin.json
VERSION=$(python3 -c "import json; print(json.load(open('$KIT_ROOT_N/.claude-plugin/plugin.json'))['version'])")
# Scorecard run dir leads with the project name so runs of the same golden project group
# together (alphabetical sort), then date, then version: <project>-<date>-<version>.
RUN_DIR="$SCORECARD_DIR/${GOLDEN_NAME}-${TIMESTAMP}-${VERSION}"
SCORECARD_OUT="$RUN_DIR/scorecard.json"
CONFIG_OUT="$RUN_DIR/config.json"
LOG_OUT="$RUN_DIR/run.log"
EVIDENCE_DST="$RUN_DIR/evidence"
mkdir -p "$RUN_DIR"

echo "=== Tiger T3 Benchmark ==="
echo "Version  : $VERSION"
echo "Golden   : $GOLDEN_NAME (feature: $FEATURE_ID)"
echo "Pro model: $PRO_MODEL  (architect/security/reviewer/e2e/docs)"
echo "Fast model: $FAST_MODEL  (code-generator/integrator)"
echo "Bench dir: $BENCH_DIR"
echo "Scorecard: $SCORECARD_OUT"

# 1. Copy golden project to a fresh temp dir
cp -r "$GOLDEN_PROJECT" "$BENCH_DIR"
BENCH_DIR_N="$(winpath "$BENCH_DIR")"

# 2. Set up git: init, born main, born dev (the integration trunk), feature branch off dev.
# v6 integration trunk is `dev` — NOT main (the protected release branch the workflow never
# touches) and NOT the old v1 `develop`. Everything integrates on dev; feature/<id> is cut
# FROM dev. The pre-approved golden artifact is feature.md carrying the frontmatter line
# `tiger-status: approved` (was the old spec.html <meta>). `branch -M main` normalizes whatever
# `git init` produced (master, when init.defaultBranch is unset) to main; we branch dev off
# main, then cut the feature branch off dev.
git -C "$BENCH_DIR" init -q
git -C "$BENCH_DIR" -c user.email=benchmark@tiger.test -c user.name=Benchmark add -A
git -C "$BENCH_DIR" -c user.email=benchmark@tiger.test -c user.name=Benchmark \
	commit -q -m "chore: seed golden project"
git -C "$BENCH_DIR" branch -M main
git -C "$BENCH_DIR" branch dev main
git -C "$BENCH_DIR" checkout -q -b "feature/$FEATURE_ID" dev

# 3. Install harness files into the bench project
mkdir -p "$BENCH_DIR/.claude/workflows"
cp "$KIT_ROOT/workflows/tiger-workflow-dev.js" "$BENCH_DIR/.claude/workflows/"
cp "$KIT_ROOT/project-hooks/tiger-block-rm.sh" "$BENCH_DIR/"
chmod +x "$BENCH_DIR/tiger-block-rm.sh"

# 3b. Install THIS repo's plugin into the bench project (REAL install, project scope) so the
# workflow's `agentType: tiger-skills:tiger-*` subagents resolve. A settings-only
# declaration (extraKnownMarketplaces + enabledPlugins) is NOT enough — verified: the agents
# only register after an actual `plugin install`; without it every stage dies at spawn and the
# workflow silently falls back to the generic agent. Must run BEFORE claude starts (plugin
# agents load only at session startup). The marketplace is a directory source = this repo's
# live working tree, so the benchmark exercises the exact local version under test.
(cd "$BENCH_DIR" && claude plugin marketplace add "$KIT_ROOT_N" --scope project >/dev/null 2>&1) &&
	echo "Local plugin marketplace added to bench project"
(cd "$BENCH_DIR" && claude plugin install "$PLUGIN_REF" --scope project >/dev/null 2>&1) &&
	echo "Plugin installed into bench project (scope: project)"
# FIDELITY GATE: if the local plugin is not enabled for this project, the run would silently
# use the generic agent and overstate fidelity (the exact failure mode this harness must avoid).
# Fail LOUD instead. enabledPlugins lives in the bench project's own settings.json.
if grep -q "\"$PLUGIN_REF\": *true" "$BENCH_DIR/.claude/settings.json" 2>/dev/null; then
	echo "Local plugin enabled in bench project ✓ (stages will run the real tiger-* agents)"
else
	echo "ERROR: local plugin not enabled in bench project — aborting before the run." >&2
	echo "       (Proceeding would run the generic agent and produce a misleading PASS.)" >&2
	exit 3
fi

# 4. Run the workflow (non-interactive; --dangerously-skip-permissions for CI)
# macOS ships without GNU timeout; prefer gtimeout (brew install coreutils), fall back to none
TIMEOUT_CMD=""
if command -v timeout >/dev/null 2>&1; then
	TIMEOUT_CMD="timeout $TIMEOUT"
elif command -v gtimeout >/dev/null 2>&1; then
	TIMEOUT_CMD="gtimeout $TIMEOUT"
else
	echo "WARN: timeout/gtimeout not found — running without timeout (install coreutils: brew install coreutils)"
fi

echo "Run dir  : $RUN_DIR"
echo "Starting workflow (timeout: ${TIMEOUT}s)..."
echo "Live log : $LOG_OUT"

# ── Live progress poller ──────────────────────────────────────────────────────
# `claude -p` buffers its own stdout until the whole run ends, so the console
# looks frozen even while the pipeline is hard at work. This watcher shows what the
# workflow is actually doing by polling DURABLE state in the bench repo every 10s —
# the board phase, task progress, active git worktrees (parallel build waves), and
# the latest commit — printing a line whenever any of them changes, plus a ~60s
# heartbeat so it is never silent for long. Disk state is authoritative, so this is
# accurate regardless of how claude buffers its own output.
progress_poller() {
	local last="" start_ts ticks=0 elapsed phase tasks wt head snap
	start_ts=$(date +%s)
	while :; do
		sleep 10
		ticks=$((ticks + 1))
		elapsed=$(($(date +%s) - start_ts))
		phase=$(python3 -c "import json;print(json.load(open('$BENCH_DIR_N/feature_list.json'))['features']['$FEATURE_ID'].get('phase','?'))" 2>/dev/null || echo '?')
		tasks=$(python3 -c "import json;t=json.load(open('$BENCH_DIR_N/feature_list.json'))['features']['$FEATURE_ID'].get('tasks') or [];print(f\"{sum(1 for x in t if x.get('status')=='done')}/{len(t)}\")" 2>/dev/null || echo '?')
		wt=$(git -C "$BENCH_DIR" worktree list 2>/dev/null | wc -l | tr -d ' ')
		head=$(git -C "$BENCH_DIR" log -1 --format='%h %s' 2>/dev/null || echo '<no commit>')
		snap="$phase|$tasks|$wt|$head"
		if [ "$snap" != "$last" ]; then
			printf '  [+%5ds] phase=%-9s tasks=%-7s worktrees=%s | %s\n' "$elapsed" "$phase" "$tasks" "${wt:-1}" "$head"
			last="$snap"
		elif [ $((ticks % 6)) -eq 0 ]; then
			printf '  [+%5ds] …still working (phase=%s tasks=%s)\n' "$elapsed" "$phase" "$tasks"
		fi
	done
}
progress_poller &
POLLER_PID=$!
# On ANY exit: stop the poller AND uninstall the bench plugin, so the global
# installed_plugins.json doesn't accumulate one project-scope entry per benchmark run.
trap 'kill "$POLLER_PID" 2>/dev/null || true; (cd "$BENCH_DIR" && claude plugin uninstall "$PLUGIN_REF" --scope project >/dev/null 2>&1 || true)' EXIT

set +e
# CLAUDE_CODE_SUBAGENT_MODEL: unset so proModel/fastModel args take effect.
# CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0: wait indefinitely for background subagents
#   (default 600s ceiling kills long-running workflows mid-run).
(cd "$BENCH_DIR" && unset CLAUDE_CODE_SUBAGENT_MODEL &&
	export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 &&
	$TIMEOUT_CMD claude \
		--dangerously-skip-permissions \
		--verbose \
		--append-system-prompt "BENCHMARK MODE: You are a non-interactive harness runner. Your ONLY job is to invoke the /tiger-workflow-dev workflow exactly as written and let it run to completion, then report its result verbatim. Do NOT edit, patch, or rewrite the workflow script or any .claude file. Do NOT substitute, reroute, or inline any agent. Do NOT work around errors or fix the environment (branches, plugins, settings). If the workflow aborts or any stage fails, report the failure exactly as given and STOP — a clean failure is a valid benchmark outcome, never something to repair." \
		-p "/tiger-workflow-dev {\"proModel\":\"$PRO_MODEL\",\"fastModel\":\"$FAST_MODEL\"}") 2>&1 | tee "$LOG_OUT"
WORKFLOW_EXIT=${PIPESTATUS[0]}
set -e
kill "$POLLER_PID" 2>/dev/null || true
# EXIT trap stays armed — it uninstalls the bench plugin when the script finishes.

if [ "$WORKFLOW_EXIT" -eq 124 ]; then
	echo "WARN: workflow timed out after ${TIMEOUT}s — collecting partial scorecard"
elif [ "$WORKFLOW_EXIT" -ne 0 ]; then
	echo "WARN: workflow exited $WORKFLOW_EXIT — collecting partial scorecard"
fi

# 5. Save run config
python3 - <<EOF >"$CONFIG_OUT"
import json, os
print(json.dumps({
    "version": "$VERSION",
    "timestamp": "$TIMESTAMP",
    "pro_model": "$PRO_MODEL",
    "fast_model": "$FAST_MODEL",
    "timeout_seconds": $TIMEOUT,
    "golden_project": "$GOLDEN_NAME",
    "golden_feature": "$FEATURE_ID",
    "bench_dir": "$BENCH_DIR",
    "workflow_exit_code": $WORKFLOW_EXIT,
}, indent=2))
EOF
echo "Config   written to: $CONFIG_OUT"

# 6. Collect scorecard (pass the discovered feature id so it works for any golden project)
python3 "$SCRIPT_DIR_N/scorecard.py" "$BENCH_DIR_N" "$VERSION" "$FEATURE_ID" >"$SCORECARD_OUT"
echo ""
echo "Scorecard written to: $SCORECARD_OUT"
cat "$SCORECARD_OUT"

# 7. Copy Robot evidence (screenshots + report/log HTML) out of the temp bench dir.
# The lead runs the whole folder (robot --outputdir tiger/evidence tiger/features/), so evidence is
# the project-level tiger/evidence; fall back to the legacy per-feature dir for older runs.
EVIDENCE_SRC="$BENCH_DIR/tiger/evidence"
[ -d "$EVIDENCE_SRC" ] || EVIDENCE_SRC="$BENCH_DIR/tiger/features/$FEATURE_ID/evidence"
if [ -d "$EVIDENCE_SRC" ]; then
	mkdir -p "$EVIDENCE_DST"
	# Copy all Robot output files and screenshots
	find "$EVIDENCE_SRC" \( -name "*.html" -o -name "*.xml" -o -name "*.png" -o -name "*.jpg" \) \
		-exec cp {} "$EVIDENCE_DST/" \;
	SCREENSHOT_COUNT=$(find "$EVIDENCE_DST" -name "*.png" -o -name "*.jpg" | wc -l | tr -d ' ')
	echo "Evidence copied to: $EVIDENCE_DST"
	echo "Screenshots saved: $SCREENSHOT_COUNT"
	[ "$SCREENSHOT_COUNT" -gt 0 ] &&
		echo "Open report: open \"$RUN_DIR/evidence/report.html\"" ||
		echo "WARN: no screenshots found — e2e UI keywords may not have taken screenshots"
else
	echo "WARN: no evidence dir found at $EVIDENCE_SRC"
fi
