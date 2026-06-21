#!/usr/bin/env python3
"""T2: Run validate-board.py against each board fixture. Fails if any fixture is rejected."""
import pathlib
import subprocess
import sys

SCRIPT_DIR = pathlib.Path(__file__).parent
ROOT = SCRIPT_DIR.parent.parent
FIXTURES_DIR = SCRIPT_DIR / "fixtures"
VALIDATE_BOARD = ROOT / "scripts" / "validate-board.py"

BOARD_FIXTURES = [
    FIXTURES_DIR / "board-grill.json",
    FIXTURES_DIR / "board-architect.json",
]

failures = 0

for fixture in BOARD_FIXTURES:
    result = subprocess.run(
        ["python3", str(VALIDATE_BOARD), str(fixture)],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"PASS: {fixture.name} accepted by validate-board.py")
    else:
        print(f"FAIL: {fixture.name} rejected: {result.stdout.strip()} {result.stderr.strip()}", file=sys.stderr)
        failures += 1

sys.exit(failures)
