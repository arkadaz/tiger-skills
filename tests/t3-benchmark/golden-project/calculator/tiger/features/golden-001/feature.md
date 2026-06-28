---
id: golden-001
title: Four-operation calculator module with numpad web UI
tiger-status: approved
date: 2026-06-18
classification: generic
metric: { name: all_operations_pass, baseline: 0 tests, target: 4 operations + web UI pass, direction: increase }
---

## Problem & JTBD
The codebase has no calculator module; arithmetic is inlined ad hoc. When building numeric
utilities, developers want a reusable, tested calculator module (plus a usable web UI) so they
do not duplicate arithmetic logic. Primary user: developers on the Tiger benchmark project.

## What we'll do
- FR1 — `add(a, b)` returns `a + b` (pure function) — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'`
- FR2 — `subtract(a, b)` returns `a - b` (pure function) — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'`
- FR3 — `multiply(a, b)` returns `a * b` (pure function) — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'`
- FR4 — `divide(a, b)` returns `a / b`; raises `ZeroDivisionError` when `b` is 0 (never swallowed) — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'`
- FR5 — Flask UI in `src/app.py` serves a numpad calculator at `/` on port 5000: digits 0-9, operators `+ - × ÷`, a display, and `=`. Page title contains "Calculator"; divide-by-zero shows an error in the display — `curl -s http://localhost:5000 | grep -q 'Calculator'`
- Happy path: import `calculator` → `add(2,3)`→5, `divide(10,2)`→5.0; open `http://localhost:5000` → click `7 + 3 =` → display shows `10`; `1 ÷ 0 =` → display shows an error (no crash).
- Business rules: BR1 all four operations are pure with no external deps; BR2 divide-by-zero raises `ZeroDivisionError` (not swallowed). Both verified by `python3 -m pytest src/ -q`.

## Why / Decisions
- ADR-001 (accepted) — Implement the calculator as a pure-function Python module (one function per
  operation, no class, no third-party math lib). Drivers: zero deps, trivially testable, minimal
  surface. Trade-off: a class would ease future stateful extensions (history) — explicitly out of
  scope, so the smaller surface wins. Confirmation: e2e E1-E5 + `python3 -m pytest src/ -q`.

## Business context
- Value: retires arithmetic duplication; gives the T3 benchmark a concrete, testable feature to run
  the full pipeline against. Internal tooling only — no revenue impact.
- Target users: developers on the Tiger benchmark project (every feature touching arithmetic).
- Metric: `all_operations_pass` — baseline 0 tests → target 4 operations + web UI pass (increase),
  measured by `python3 -m pytest src/ -q` plus the e2e UI cases.
- **Code glossary**: no magic codes. Operator symbols map 1:1 to functions — `+`→add, `-`→subtract,
  `×`→multiply, `÷`→divide. `ZeroDivisionError` = the only error surfaced by `divide`.

## Acceptance criteria
- AC1 — add(a, b) returns a + b — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'` — status: pending  (e2e: E1)
- AC2 — subtract(a, b) returns a - b — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'` — status: pending  (e2e: E2)
- AC3 — multiply(a, b) returns a * b — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'` — status: pending  (e2e: E3)
- AC4 — divide(a, b) returns a / b; raises ZeroDivisionError when b is 0 — `python3 -m pytest src/ -q 2>&1 | grep -q 'passed'` — status: pending  (e2e: E4, E5)
- AC5 — Numpad UI loads at http://localhost:5000 — title contains "Calculator", digits 0-9 + operators present — `curl -s http://localhost:5000 | grep -q 'Calculator'` — status: pending  (e2e: E6)
- AC6 — Clicking digit + operator buttons computes the result (7 + 3 = 10) — `curl -s http://localhost:5000 | grep -q 'Calculator'` — status: pending  (e2e: E7)
- AC7 — Divide-by-zero via the numpad shows an error in the display, not a crash — `curl -s http://localhost:5000 | grep -q 'Calculator'` — status: pending  (e2e: E8)

## Out of scope / CAN-CANNOT
- CAN modify: `src/calculator.py`, `src/app.py`, `src/templates/`.
- CANNOT modify: anything outside `src/`.
- must-not-break: no existing tests (none yet).
- Out of scope: float precision beyond Python defaults; complex/modular arithmetic or any 5th
  operation; REPL/CLI wrapper; persistent state (history, accumulator).
