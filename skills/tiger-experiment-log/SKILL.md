---
name: tiger-experiment-log
description: Focused writer that authors ONE iteration's research/<goalId>/experiments/experimentN/experiment.md — the IMMUTABLE experiment card with YAML frontmatter (the approach_vector + provenance + result schema) and compact body sections (Idea & provenance / THE WAY IT DID IT — method with exact modules+symbols+reproduce commands+seeds / a MANDATORY "Not a redux of expK" justification mapped to the G0–G4 novelty guards / Result numbers vs baseline & best / Notes & next-idea seeds). Also DEFINES the sibling deliberation.md format (candidates + debate + verdict). Git-free, files-only; loaded by tiger-researcher via skills: frontmatter, or invoked directly.
---

# Tiger Experiment Log — Experiment Card Writer

Writes ONE artifact per iteration: `research/<goalId>/experiments/experimentN/experiment.md` — the human-inspectable card that records WHAT was tried, HOW it was done (reproducibly), and WHAT the real harness returned. Also **defines the sibling `deliberation.md` format** the researcher writes at step 2. Sits inside the autonomous loop: `tiger-researcher` loads this skill at step 9 to log the iteration it just ran. Analog of the `tiger-docs-*` writers — a focused reference, **no owned agent**.

**Git-free.** State is the folder tree, not commits. This writer never touches git. A card is written once and is **IMMUTABLE** — a later iteration never edits an earlier `experimentN/`.

## When to use

- `tiger-researcher` loads it automatically to write `experimentN/experiment.md` after the real run + both novelty checks.
- Standalone: "write the experiment card for `experimentN` of `<goalId>`" — from an already-run experiment's `metrics.json` + `evidence/` + built method files.

## Contract

**Owns ONE artifact:** `research/<goalId>/experiments/experimentN/experiment.md` (the card).
**Also defines:** the `deliberation.md` format (below) — the researcher writes it at step 2; this skill is its schema of record.
**Never owns:** `research_ledger.json` (that is `research.py`), `goal.md`, `taxonomy.md`, `run.sh`/method files (the code generator writes those), `sources.md` (the researcher writes it at step 3), `metrics.json`/`evidence/` (the real run produces them), `REPORT.md` (synthesis). Never runs the harness, never runs `research.py`, never emits the six machine tokens (the researcher does that).

**Inputs:** goal id, experiment index `N` (monotonic from 1; `0` = baseline), today `YYYY-MM-DD`, the built approach_vector, `research.py summary` (baseline + current best), the POST `research.py novelty-check --built` verdict, the `tiger-novelty-critic` verdict (`TIGER_NOVELTY: NOVEL|DUPLICATE`), `metrics.json` (the metric measured THIS run), the `sources.md` provenance, and the built method files (modules + symbols).

**Iron Law:** every number on the card is read from `metrics.json` / `evidence/` of a REAL run this iteration — NEVER asserted, estimated, or copied from the hypothesis. No evidence ⇒ no number.

### Frontmatter (the machine schema)

```
---
experiment: experimentN
goal: <goalId>
date: <YYYY-MM-DD>
approach_vector:
  family: <exactly one value from taxonomy.md>
  components: [<method-element-slug>, ...]      # ≥1 never-before-seen slug (G3)
  controlled_vars: { <k>: <v>, ... }            # MUST equal goal frozen set (G0)
  sources: [<fetched-id-or-url>, ...]           # ≥1 fresh, present in sources.md (G4)
  hypothesis: "if we change <X> to <technique> then <metric> moves because <mechanism>"
  nearest_prior: experimentK                    # closest prior by structural-set Jaccard
result:
  metric: <numeric, measured THIS run>
  baseline: <experiment0 metric>
  best_before: <best metric prior to this iteration>
  delta_vs_baseline: <signed>                   # metric − baseline (direction-aware in prose)
  delta_vs_best: <signed>                       # matches the DELTA_VS_BEST token
  status: improved|neutral|regressed            # matches research.py record-result --status
  novelty_distance: <0..1>                      # matches the NOVELTY_DISTANCE token
  novelty_gate: accepted|refused                # research.py novelty-check --built (POST)
  novelty_critic: NOVEL|DUPLICATE               # tiger-novelty-critic verdict
  credited: yes|no                              # no ⇐ POST gate refused OR critic DUPLICATE
---
```

- **Structural set** `S = {family} ∪ components`, **excluding** `controlled_vars` — the anti-tuning set the G-guards judge.
- `controlled_vars` MUST equal the goal frozen set. The ONLY exception: a genuinely new component may carry its OWN intrinsic var, allowed only when it attaches to a never-seen component (the G3 carve-out) — note it explicitly under the method.
- `credited: no` ⇒ the run is logged honestly but NOT counted as a novel move (POST `--built` refusal or a `DUPLICATE` critic). Record the reason in the Result section; do not delete the card.
- **experiment0 (baseline)** uses the same shape as a control: `family: baseline`, `components: [baseline]`, no fresh sources, no hypothesis, `novelty_gate`/`novelty_critic` = `N/A`; it only records the seed harness metric.

### Body sections (compact markdown, bullets/tables over prose)

| Section | Contents |
|---|---|
| `## Idea & provenance` | 1–3 lines: the idea and the fetched source(s) it came from — cite each as `[<id-or-url>]` resolvable in `sources.md` with the quoted claim. State the falsifiable hypothesis (same string as frontmatter). Name the deliberation angle that won (link `deliberation.md`). |
| `## The way it did it — method` | The reproducible HOW. **Exact modules + symbols**: which files under `experimentN/` implement the method and the functions/classes touched (`file:symbol`). **Reproduce block**: the copy-pasteable `bash run.sh …` invocation with the SEED and the frozen `controlled_vars` shown, so the number regenerates deterministically. Note the method files are comment-free. Point at `evidence/` for the captured run log. If the G3 carve-out var was used, declare it here. |
| `## Not a redux of expK` | **MANDATORY.** `K` = `nearest_prior`. Prove novelty against the guards: the ≥1 **never-seen component** introduced (G3); the ≥1 **freshly-fetched source** absent from all priors and present in this `sources.md` (G4); `controlled_vars` **unchanged** vs the frozen set (G0/G2); Jaccard(`S`, prior `S`) **< 0.8** for every prior, quoting the max and against which experiment (G1). One bullet per guard; this section is what the POST `novelty-check --built` re-derives from the built files. |
| `## Result` | Numbers vs baseline AND best, from `metrics.json`. A small table: `metric \| this \| baseline \| best_before \| Δ vs baseline \| Δ vs best`, then the direction-aware verdict (`improved`/`neutral`/`regressed`) and the `evidence/` proof path. If `credited: no`, state which check refused and why in one line. |
| `## Notes & next-idea seeds` | What surprised us; the current best's remaining weakness this run exposed; 2–4 concrete **next-idea seeds** (family or component sketches worth trying) — `research.py frontier` aggregates these to feed later deliberations. |

**Style:** plain compact markdown, no HTML, no CDN, no comments-as-code. Inapplicable field → `N/A — <reason>`. The card is prose+tables ABOUT the method; the runnable method lives in `run.sh` + method files (comment-free).

## The deliberation.md format (defined here, written by the researcher at step 2)

Sibling file `experimentN/deliberation.md` — the recorded self-discussion, a first-class human-inspectable artifact. Shape:

| Section | Contents |
|---|---|
| `## Frontier snapshot` | What `research.py summary` + `vectors` + `frontier` showed: current best `{iter, value}`, tried vs untried families, the pacing hint in force (`exploit`/`explore`/`big-swing`). |
| `## Candidates` | A table, one row per panel proposal from a DISTINCT angle — **learn-from-the-worst-failure**, **attack-the-current-best-weakness**, **import-a-fresh-fetched-source**, **bold cross-family composition**: `angle \| family \| sketch \| new component(s) \| feasibility under frozen vars \| expected effect`. |
| `## Debate` | The ranking arguments grounded in prior results + novelty + feasibility; a rebuttal round when the top two are close. |
| `## Verdict` | The chosen bet and **WHY it won** over the others, tied to the hypothesis it becomes. On a `big-swing` hint the winner MUST sit in an untried family. |

## Works with

`tiger-researcher` (loads this skill): step 2 writes `deliberation.md` (this format) → steps 3–8 mine sources, build the method, run the harness for real, run both novelty checks → **step 9 writes `experiment.md` here** from the real numbers → step 10 the researcher emits the six machine tokens. The card + `deliberation.md` are what a human reads to audit the iteration, and what `REPORT.md` synthesis chains into the winning-method provenance.

## State / immutability (no git)

- **Files only.** Write `experiment.md`; do NOT commit, branch, or note anything (the whole research loop is git-free). Resume is `research.py summary` + reading the experiment folders.
- **Immutable once done.** Never edit a prior `experimentN/`. A correction is a NEW experiment, not a rewrite.
- Never write `research_ledger.json`, `goal.md`, `taxonomy.md`, `metrics.json`, `sources.md`, or `REPORT.md`; never run `research.py` or the harness.

## Standalone use

Invoke with: goal id, experiment index `N`, today (`YYYY-MM-DD`), the approach_vector, `research.py summary` output, the POST `novelty-check --built` + `tiger-novelty-critic` verdicts, `metrics.json`, `sources.md`, and the built method files. Writes `experiments/experimentN/experiment.md` with numbers taken only from the real run and stops — reports the path written. Does not run experiments, score novelty, or synthesize.
