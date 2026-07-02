#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
pass() { echo "PASS: $1"; }

PLUGIN_JSON="$ROOT_DIR/.claude-plugin/plugin.json"

if ! command -v python3 >/dev/null 2>&1; then
    fail "python3 not found — cannot check skill registry"
    exit "$FAILURES"
fi

python3 - "$ROOT_DIR" "$PLUGIN_JSON" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
plugin_json_path = pathlib.Path(sys.argv[2])

# v7 lineup: 19 skills. Dev loop (15): grill/lead/code-generator/code-quality + caveman/ponytail +
# security/reviewer/update-docs + the 6 docs-* writers. Research loop (+4): research-goal (the /research-goal
# gate), tiger-researcher, tiger-novelty-critic, tiger-experiment-log.
EXPECTED = {
    "tiger-grill", "tiger-lead", "tiger-code-generator", "tiger-code-quality",
    "tiger-caveman", "tiger-ponytail",
    "tiger-security", "tiger-reviewer", "tiger-update-docs",
    "tiger-docs-feature", "tiger-docs-business", "tiger-docs-e2e",
    "tiger-docs-codemap", "tiger-docs-release", "tiger-docs-readme",
    "research-goal", "tiger-researcher", "tiger-novelty-critic", "tiger-experiment-log",
}

with plugin_json_path.open() as f:
    manifest = json.load(f)

# Skills live under manifest.autoDiscovery.skills (a list of "skills/<name>/" paths).
skill_paths = manifest.get("autoDiscovery", {}).get("skills", [])
failures = 0

if not skill_paths:
    print("FAIL: manifest.autoDiscovery.skills is empty or missing", file=sys.stderr)
    sys.exit(1)

declared = {pathlib.PurePosixPath(p.rstrip("/")).name for p in skill_paths}

missing = EXPECTED - declared
extra = declared - EXPECTED
if missing:
    print(f"FAIL: manifest missing skills: {sorted(missing)}", file=sys.stderr)
    failures += len(missing)
if extra:
    print(f"FAIL: manifest has unexpected skills: {sorted(extra)}", file=sys.stderr)
    failures += len(extra)
if not missing and not extra:
    print(f"PASS: manifest.autoDiscovery.skills == the 19 v7 skills")

# Every declared skill must have a SKILL.md on disk.
for skill_path in skill_paths:
    skill_file = root / skill_path / "SKILL.md"
    if skill_file.exists():
        print(f"PASS: {skill_path}SKILL.md exists")
    else:
        print(f"FAIL: {skill_path}SKILL.md missing", file=sys.stderr)
        failures += 1

sys.exit(failures)
PY
PY_EXIT=$?
if [ "$PY_EXIT" -ne 0 ]; then
    FAILURES=$((FAILURES + PY_EXIT))
fi

exit "$FAILURES"
