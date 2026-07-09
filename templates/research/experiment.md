---
experiment: experiment{{N}}
goal: {{GOAL_ID}}
date: {{DATE}}
approach_vector:
  family: {{one value from taxonomy.md}}
  components: [{{method-element slug}}, {{slug}}]
  controlled_vars: { {{MUST equal the goal frozen set}} }
  sources: [{{fetched id-or-url}}, {{…}}]
  hypothesis: "if we change {{X}} to {{technique}} then {{metric}} moves because {{mechanism}}"
  nearest_prior: {{experimentM|null}}
result:
  metric: {{number measured from the REAL harness run THIS iteration}}
  status: {{improved|neutral|regressed}}
  delta_vs_best: {{signed number}}
  novelty_distance: {{0..1}}
  goal_met: {{YES|NO}}
novelty_gate:
  pre: {{accept|refused}}
  post: {{accept|refused}}
  reason: {{null|the printed refusal reason}}
critic: {{NOVEL|DUPLICATE}}
---

# experiment{{N}} — {{one-line what-we-tried}}

> The iteration card, written by `tiger-researcher` (built-in format). IMMUTABLE once done — later
> iterations reconstruct the frontier from these files, never from agent memory.
> Siblings in this folder: `deliberation.md` (why this move won), `run.sh` (+ comment-free
> method files), `sources.md` (provenance), `metrics.json` (raw numbers), `evidence/` (real logs).

## Hypothesis
{{The falsifiable one-liner from the vector above, in plain words.}}

## Method
- Family: {{family}} · new component(s): {{the ≥1 never-before-seen slug — the G3 requirement}}
- What was built, under the FROZEN controlled vars: {{2-4 bullets, no code here — see run.sh}}
- Reused before building: {{what existing method/util this leaned on}}

## Result
- {{metric}} = {{value}} ({{status}}) · Δ vs best = {{signed}} · goal-met {{YES|NO}}
- Evidence: `evidence/{{run log}}` · raw: `metrics.json`

## Novelty
- Fresh source cited: {{id-or-url}} — {{the quoted mechanism it supplied}} (in `sources.md`)
- Gate: PRE {{accept|refused}} · POST-from-built-files {{accept|refused}} {{· reason}}
- Semantic critic: {{NOVEL|DUPLICATE}} — {{smart? y/n note}}
- {{If POST refused: this experiment is REJECTED + UNCREDITED — recorded honestly, not counted.}}

## Notes / next-idea seeds
- Why it moved (or didn't): {{the mechanism read from the numbers}}
- Weakness of this approach a future experiment could attack: {{…}}
- Untried direction this surfaced: {{seed the frontier miner aggregates}}
