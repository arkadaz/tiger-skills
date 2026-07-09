---
name: research-goal
description: The ONLY human gate of the git-free research loop — an inline goal grill that turns a vague "find a better WAY to do X" into an approved, inspectable research/<goalId>/goal.md. Runs INLINE in the main session, interviewing one question at a time (AskUserQuestion with a recommended answer), exploring existing code/harness/data first, then writing goal.md (the single metric{name,direction,target,baseline}, the FROZEN controlled vars, the fast seeded DETERMINISTIC harness command, the budget) + a seeded taxonomy.md of approach-families, seeding research_ledger.json via `tiger/research.py init` — and flipping the `tiger-status: approved` frontmatter token only on an explicit human yes. Use whenever the user wants to search for a NEW WAY — optimize a metric, beat a baseline, explore approaches, run a research loop — even if they never say "grill" or "goal". Git-free: state is the folder tree, no branches/commits ever. A long description is input, not approval.
---

# Research Goal — the Only Human Gate of the Research Loop

I convert a vague "find a better way to <X>" into one approved, inspectable artifact set the autonomous loop consumes. I am the research analog of the Tiger grill: the one Human↔goal edge — no other stage talks to the human mid-run. I run INLINE (no `agent:`) because a subagent has no channel to ask a question and wait. **Git-free: I write files only — never a branch, commit, or note.**

## When to use
- The user wants a NEW WAY to do something — optimize a metric, beat a baseline, explore approaches — BEFORE any experiment runs.
- Standalone (goal-only) or as the front of `/research-workflow`. Same run either way.
- A long description is input, not approval — do not skip the grill.

## Contract

**Preflight (hard gate).** `ls tiger/research.py` — the CLI I seed the ledger with (installed alongside `board.py`). If missing, tell the user to run `/tiger-skills:install` and STOP. Never improvise the ledger. Runs in ANY directory: no git repo, no board required. Then derive `<goalId>`: kebab-case from the goal, unique under `research/`.

**Interview rules.**
- ONE question per cycle via `AskUserQuestion` with 2–4 options + a recommended answer. Never batch.
- Explore before asking — if existing code, data, a harness, or prior runs answer it, read those and report. On a large repo, fork a read-only recon subagent before the first question.
- **Classify the goal FIRST** (ML model / algorithm / prompt-or-agent / systems-perf / other) and seed the matching default taxonomy families; grill only dimensions that exist.
- Dig deeper: per applicable dimension ask ≥2 probing questions; pin every vague word to a number or named entity; ask a boundary "what happens when…". Err toward one more question. A fast "just run it" means probe harder.
- Push back on **tuning disguised as research** (only controlled vars moving = not a new way), on non-deterministic / unbounded / networked harnesses, on metrics that are not a single number, on scope creep. Sharpen vague terms to the canonical one.
- No method design, no experiment plan, no approach vectors (the researcher owns those).

**Iron-Law hard-blocks.** A goal is NOT approvable until:
- **Deterministic.** The metric is produced by ONE fast command that is seeded + fixture-pinned → same inputs give the same number every run. HALT until the human pins the seed + fixture.
- **Bounded.** The command has a hard timeout and runs as a background process — no unbounded/networked training in the loop. HALT until a timeout is set.
- **Measured, never asserted.** The metric comes from a REAL run each iteration; a baseline you did not measure is not a baseline. HALT until it is measurable.
- **Anti-tuning.** The frozen controlled-var set is non-empty AND the taxonomy has ≥3 families, so "a new way" (new family/component) is distinguishable from "tuning" (only controlled vars move). HALT until both hold.

Silence is not acknowledgment.

**Grill Ledger.** Reprint updated before every question; `closed` = exit condition met AND the deeper-probe bar satisfied (a single shallow answer stays `open`). All nine genuinely closed → draft.

```markdown
## Grill Ledger — <goalId>
- Goal / JTBD: open|closed
- Metric (name/direction/target/baseline): open|closed
- Deterministic harness command: open|closed
- Frozen controlled vars: open|closed
- Baseline (experiment0): open|closed
- Taxonomy families: open|closed
- Budget + stop conditions: open|closed
- What counts as "a new way": open|closed
- Non-goals / scope / safety: open|closed
```

**9 discovery dimensions (exit conditions).**
1. **Goal/JTBD** — can state `<researcher> needs a better way to <do X> so that <outcome>`; what is optimized, why now.
2. **Metric** — ONE numeric metric, `direction: maximize|minimize`, target, baseline; tied to value. Ask "if it moves 10%, will anyone notice?"
3. **Deterministic harness** — the ONE fast command; seeded + fixture-pinned (same number every run); hard-timeout bounded; emits the single metric to stdout / `metrics.json` so `tiger/research.py` can read it. This is the Iron Law made concrete.
4. **Frozen controlled vars** — the CORE set held constant EVERY experiment (dataset, split, seed, eval protocol, compute budget…). This is the anti-tuning lever (G0). The **G3 carve-out**: a genuinely new component MAY introduce its OWN intrinsic var — allowed only when it attaches to a never-seen component.
5. **Baseline (experiment0)** — the current/naive method + its measured number. Prove the harness (§ below) to fill it honestly, else leave `pending` for the workflow bootstrap to seed.
6. **Taxonomy families** — the approach-family vocabulary the novelty engine ranges over; seed sensible domain defaults (ML: architecture / optimization / regularization / data-augmentation / representation / ensembling / loss-design / search-decoding / distillation), then the human edits. ≥3 distinct families.
7. **Budget + stop** — `max_iters`, `patience_K` (no-improve rounds → stall), `epsilon` (smallest meaningful metric delta), `novelty_floor` (min rolling novelty distance), `wall_hours`.
8. **What counts as "a new way"** (the novelty contract) — the human agrees the STRUCTURAL SET `S = {family} ∪ components` (EXCLUDING controlled_vars) drives the gate: **G0** frozen vars unchanged, **G1** no near-duplicate (Jaccard(S, any prior)≥0.8 refused), **G2** no pure-tuning, **G3** every accepted experiment introduces ≥1 never-seen component, **G4** cites ≥1 freshly-fetched source. Confirm the frozen set + taxonomy make these gates bite.
9. **Non-goals / scope / safety** — off-limits files, resource caps, that method code runs sandboxed/bounded, explicit out-of-scope directions.

**Prove the harness (the honest baseline).** Run the pinned command TWICE as a bounded background process — an identical number proves determinism; that number is the baseline and seeds `research/<goalId>/experiment0/` (`run.sh` + `metrics.json` + `evidence/`). Never write a baseline you did not measure. If the human declines the run, baseline stays `pending` and the workflow bootstrap seeds `experiment0` on first launch.

**Outputs — two artifacts + the seeded ledger (I author them inline; no writer skill, no template needed so I run in any directory):**

| Artifact | What it holds |
|---|---|
| `research/<goalId>/goal.md` | frontmatter machine gate + the grilled spec |
| `research/<goalId>/taxonomy.md` | the approach-family vocabulary (defaults + human edits) |
| `research/<goalId>/research_ledger.json` | seeded by `python3 tiger/research.py init --goal <goalId>` |

**goal.md** — compact bullets, never walls of text. Every section present; inapplicable → `N/A — <reason>`. Frontmatter is the machine gate the workflow bootstrap greps (`tiger-status:.*approved`) and `tiger/research.py init` parses:

```
---
goal_id: <goalId>
title: <one line>
tiger-status: awaiting_review
date: <YYYY-MM-DD>
schema_version: 1
metric: { name: <…>, direction: maximize|minimize, target: <n>, baseline: <n|pending> }
harness: "<one fast seeded deterministic command; hard-timeout bounded; emits the metric>"
frozen_controlled_vars: { <var>: <value>, ... }
budget: { max_iters: <n>, patience_K: <n>, epsilon: <n>, novelty_floor: <0..1>, wall_hours: <n> }
taxonomy_families: [ <family>, <family>, <family>, ... ]
---
```

| Section | Notes |
|---|---|
| Goal & JTBD | 1–2 lines: who, the thing optimized, why now |
| Metric & evidence | the single metric + the Iron Law: measured from a real run each iteration, never asserted |
| Deterministic harness | the exact command, the seed + fixture, the hard timeout, what number it emits and where |
| Frozen controlled vars | the CORE set held constant (G0) + the G3 carve-out for a new component's own var |
| Taxonomy | the families (mirrors `taxonomy.md`) + one line each |
| Budget & stop | `max_iters` / `patience_K` / `epsilon` / `novelty_floor` / `wall_hours` |
| Baseline | experiment0 method + its measured number (or `pending`) |
| What counts as "a new way" | G0–G4 in one glance; the frozen-vars exclusion is the anti-tuning lever |
| Non-goals / scope / safety | off-limits, resource caps, sandbox/bounded method runs, explicit non-goals |

**Gate token** — frontmatter MUST carry exactly `tiger-status: awaiting_review`. NEVER write `approved` — that is the human's act (the approval protocol below).

**taxonomy.md** — a markdown list/table of the approach families with a one-line description each, seeded from the goal classification, then human-edited. This is the goal-authored vocabulary the novelty engine's family axis draws from; the researcher may extend it, never silently redefine it.

**Ledger seeding via `tiger/research.py` — never hand-write the JSON.** After both markdown files exist, run `python3 tiger/research.py init --goal <goalId>` (it reads `goal.md` + `taxonomy.md`, seeds `research_ledger.json` at `schema_version 1`, load → validate → write, fail-closed on exit 1). Reads stay token-cheap: `python3 tiger/research.py summary`. If `init` refuses, the goal.md is malformed — fix and re-init; never leave a half-seeded ledger.

**Approval Protocol (hard gate). The model can NEVER approve on the human's behalf.**
1. Summarize BOTH artifacts the human is approving (goal.md + taxonomy.md) and the pinned metric / harness / frozen vars / budget, linked to open ledger items; call out anything pushed back on.
2. Ask ONE explicit question via `AskUserQuestion` and wait: **"Approve this goal.md + taxonomy + harness/metric/budget as-is, or revise?"** Never infer from enthusiasm / "looks good" / a thumbs-up.
3. On revise: reopen the relevant ledger dimension, update the artifacts, re-ask. Everything stays `awaiting_review`; nothing seeded past a re-runnable `init`.
4. On explicit yes, flip in `goal.md` frontmatter: `tiger-status: awaiting_review` → `tiger-status: approved` — this line is the ONLY gate the workflow bootstrap greps. Update any visible approved-by line/date to `<user> on <YYYY-MM-DD>`.
5. Seed/refresh the ledger: `python3 tiger/research.py init --goal <goalId>` — confirm it exits 0. Ensure `taxonomy.md` is written and (if proven) `experiment0/` seeded from the real harness run.
6. STOP. Tell the user what next: run `/research-workflow` (no args — it auto-discovers the approved goal and runs the autonomous loop).

## Works with
Upstream: human (the only gate). Me → **tiger-researcher** (the fresh-each-iteration loop `/research-workflow` spawns: deliberate → mine sources → novelty-check → build method → run harness for real → log) → **REPORT.md** on stop. Internal, Tiger-namespaced, spawned by the workflow only: `tiger-researcher`, `tiger-novelty-critic`, `tiger/research.py`. No merge — the loop is git-free, and promoting a winning method into real code is a MANUAL human step.

## Git interactions
- **None — ever.** This loop is git-free. State is the folder tree under `research/<goalId>/`; resume = read `research_ledger.json` + the `experiment*/` folders. I write files only: `goal.md`, `taxonomy.md`, the `tiger/research.py`-seeded `research_ledger.json`, and (if proven) `experiment0/`. No branch, no commit, no note. Post-approval edits void the approval — reopen, get a fresh yes.

## Standalone use
Goal-only with no loop to follow runs identically: inline, one question at a time, preflight `tiger/research.py`, two markdown artifacts + the seeded ledger, the Iron-Law hard-blocks, the approval protocol on the explicit yes — then stop (whether `/research-workflow` runs later is the human's call). I must never get `context: fork`/`agent:` — that would sever the human channel. If the user wants discovery without artifacts ("just help me think"), keep the ledger conversational and write nothing.
