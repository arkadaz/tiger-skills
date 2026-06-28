#!/usr/bin/env python3
"""T2: Assert each sample gate note contains a valid 'grade:' line.

v6 note model: refs/notes/e2e is the single in-loop grade. refs/notes/security and
refs/notes/review exist only when a human runs those standalone gates, so they are
NOT required on HEAD — the sample fixtures below just pin the shared note schema, and
any live HEAD note is validated only if it happens to be present.
"""
import pathlib
import sys
import subprocess

SCRIPT_DIR = pathlib.Path(__file__).parent
NOTES_DIR = SCRIPT_DIR / "fixtures" / "notes"
VALID_GRADES = {"pass", "changes", "blocked"}

EXPECTED_NOTES = [
    ("sample-security.txt", "security"),
    ("sample-review.txt", "review"),
    ("sample-e2e.txt", "e2e"),
]

failures = 0

def validate_note(text, label):
    lines = text.strip().splitlines()
    if not lines:
        print(f"FAIL: {label}: note is empty", file=sys.stderr)
        return 1
    first = lines[0].strip()
    if not first.startswith("grade:"):
        print(f"FAIL: {label}: first line must start with 'grade:', got: {first!r}", file=sys.stderr)
        return 1
    grade = first.split(":", 1)[1].strip()
    if grade not in VALID_GRADES:
        print(f"FAIL: {label}: grade must be pass|changes|blocked, got: {grade!r}", file=sys.stderr)
        return 1
    print(f"PASS: {label}: grade={grade!r}")
    return 0

for filename, label in EXPECTED_NOTES:
    note_path = NOTES_DIR / filename
    if not note_path.exists():
        print(f"FAIL: {label}: {note_path} not found", file=sys.stderr)
        failures += 1
        continue
    failures += validate_note(note_path.read_text(), label)

# Also validate any live git notes on HEAD if they exist (catches a bad note on current branch)
for ref in ("security", "review", "e2e"):
    result = subprocess.run(
        ["git", "notes", f"--ref={ref}", "show", "HEAD"],
        capture_output=True, text=True, cwd=str(SCRIPT_DIR.parent.parent)
    )
    if result.returncode == 0 and result.stdout.strip():
        failures += validate_note(result.stdout, f"HEAD {ref} note (live)")

sys.exit(failures)
