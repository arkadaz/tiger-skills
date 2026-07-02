---
id: {{GOAL_ID}}
title: {{GOAL_TITLE}}
tiger-status: awaiting_review
date: {{DATE}}
metric: { name: {{name}}, baseline: {{number|null}}, target: {{number}}, direction: {{max|min}} }
harness: "{{one fast, seeded, DETERMINISTIC command that prints the metric, e.g. python harness.py --seed 0}}"
harness_timeout_s: {{hard cap, e.g. 900}}
frozen:
  {{var}}: {{value}}
  seed: {{value}}
budget: { max_iters: {{e.g. 20}}, patience_K: {{e.g. 5}}, epsilon: {{e.g. 0.001}}, novelty_floor: {{e.g. 0.15}}, wall_hours: {{e.g. 6}} }
taxonomy_axes: [{{family}}, {{family}}, {{…}}]
---

# {{GOAL_TITLE}}

> The grilled research spec: what we're trying to move, how it's measured, what stays
> frozen, and when to stop. Keep it short — bullets, not paragraphs. `/research-goal`
> writes it with the human and, on the explicit yes, flips `tiger-status` above to
> `approved`. That line is the loop's only gate. Siblings: `taxonomy.md` (the approach-family
> enum), `research_ledger.json` (state). GIT-FREE — folders are the memory.

## Goal & JTBD
{{One or two lines. We want to move {{metric}} from {{baseline}} toward {{target}} because {{why it matters}}.}}

## The metric (Iron Law)
- Name: {{metric}} — baseline {{…}} → target {{…}} — direction {{max|min}}
- Measured from a REAL harness run EVERY iteration. Never asserted, never estimated.
- Goal-met is JS-derived from best-vs-target: `max` → best ≥ target · `min` → best ≤ target.

## Frozen controlled vars (the anti-tuning lever)
- These stay FIXED across every experiment: {{list the vars + values from `frozen` above}}.
- The novelty gate EXCLUDES these from the structural set — moving them is tuning, not a new way.
- Carve-out: a genuinely NEW method component MAY bring its OWN intrinsic var (G3-gated only).

## Harness (deterministic fixture)
- Command: `{{harness}}` — fast, seeded, reproducible; prints the numeric metric on stdout.
- Runs as a bounded background process, hard timeout {{harness_timeout_s}}s.
- `experiment0/` is the baseline: the harness run under the frozen vars, no method change.

## Budget & stopping
- max_iters {{…}} · patience_K {{…}} · epsilon {{…}} · novelty_floor {{…}} · wall_hours {{…}}
- Stops on: goal-met · budget (iters or wall) · stall (novelty-exhausted / no-improve ≥ K / rolling novelty < floor) · blocked ×2.

## Taxonomy (approach families)
- Families live in `taxonomy.md` (closed enum) — every experiment picks exactly one for its vector.
- Axes for this goal: {{echo taxonomy_axes; re-author taxonomy.md for a non-ML domain}}.

## Out of scope / CAN-CANNOT
- CAN change: {{method internals — the way the result is produced}}
- CANNOT change: {{the frozen vars, the harness, the metric definition}}
- Not doing: {{explicit non-goal — e.g. shipping a winner to prod; that's a manual human step}}
