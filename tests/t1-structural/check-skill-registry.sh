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

with plugin_json_path.open() as f:
    manifest = json.load(f)

skills = manifest.get("skills", [])
failures = 0
for skill_path in skills:
    skill_file = root / skill_path / "SKILL.md"
    if skill_file.exists():
        print(f"PASS: {skill_path}/SKILL.md exists")
    else:
        print(f"FAIL: {skill_path}/SKILL.md missing", file=sys.stderr)
        failures += 1

sys.exit(failures)
PY
PY_EXIT=$?
if [ "$PY_EXIT" -ne 0 ]; then
    FAILURES=$((FAILURES + PY_EXIT))
fi

exit "$FAILURES"
