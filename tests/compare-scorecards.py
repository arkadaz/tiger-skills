#!/usr/bin/env python3
"""Compare two T3 scorecard JSON files.

Usage: compare-scorecards.py <baseline.json> <candidate.json>
Exit 0 — candidate is no worse on all reliability signals.
Exit 1 — candidate regresses on at least one reliability signal.
"""
import json
import sys

# Signals that determine regression/improvement (direction: which way is better)
RELIABILITY_SIGNALS = [
    ("rounds_to_pass",       "lower"),
    ("blocked_count",        "lower"),
    ("gate_first_pass_rate", "higher"),
    ("completed",            "true"),
]

INFO_SIGNALS = ["elapsed_seconds", "commit_count", "artifacts_complete", "final_phase"]


def load(path):
    with open(path) as f:
        return json.load(f)


def compare(baseline, candidate):
    regressions = 0
    improvements = 0

    col_w = 28
    val_w = 14
    print(f"\n{'Signal':<{col_w}} {'Baseline':>{val_w}} {'Candidate':>{val_w}}  Result")
    print("-" * (col_w + val_w * 2 + 12))

    for signal, direction in RELIABILITY_SIGNALS:
        b = baseline.get(signal)
        c = candidate.get(signal)

        if direction == "lower":
            improved = c is not None and b is not None and c < b
            regressed = c is not None and b is not None and c > b
        elif direction == "higher":
            improved = c is not None and b is not None and c > b
            regressed = c is not None and b is not None and c < b
        elif direction == "true":
            improved = bool(c) and not bool(b)
            regressed = not bool(c) and bool(b)
        else:
            improved = regressed = False

        if regressed:
            verdict = "✗ REGRESSION"
            regressions += 1
        elif improved:
            verdict = "✓ improved"
            improvements += 1
        else:
            verdict = "— same"

        print(f"  {signal:<{col_w - 2}} {str(b):>{val_w}} {str(c):>{val_w}}  {verdict}")

    print()
    for signal in INFO_SIGNALS:
        b = baseline.get(signal, "—")
        c = candidate.get(signal, "—")
        print(f"  {signal:<{col_w - 2}} {str(b):>{val_w}} {str(c):>{val_w}}  — info")

    print()
    if regressions:
        print(f"RESULT: candidate regresses on {regressions} signal(s). EXIT 1")
        return 1
    else:
        print(f"RESULT: candidate improves on {improvements} signal(s), regresses on 0. EXIT 0")
        return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <baseline.json> <candidate.json>", file=sys.stderr)
        sys.exit(2)
    sys.exit(compare(load(sys.argv[1]), load(sys.argv[2])))
