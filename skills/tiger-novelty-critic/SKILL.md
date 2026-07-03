---
name: tiger-novelty-critic
description: The semantic layer-2 novelty veto of the research loop — spawned in-loop every iteration by tiger-researcher and standalone-invocable. tiger/research.py is the layer-1 STRUCTURAL gate (set-math G0-G4 over the approach_vector); this reads the ACTUAL built method files + every prior approach_vector + the experiment's deliberation.md and judges two axes: genuinely NOVEL mechanism (not a synonym-relabel or constant-tweak that gamed the structural gate) AND an intelligently-motivated bet (grounded in prior results, not a random switch). Returns nearest prior + a 0..1 semantic distance, ends with TIGER_NOVELTY: <NOVEL|DUPLICATE>. Use when the research loop reaches the novelty gate, or a human asks "is this experiment actually new", "is this a real new way or just tuning", "critique this approach vector". Git-free and write-free.
context: fork
agent: tiger-skills:tiger-novelty-critic
---

# Tiger Novelty Critic — the semantic veto

The layer-2 semantic gate of the research loop. `tiger/research.py novelty-check` is layer 1 — set-math G0-G4 over the STRUCTURAL SET `S = {family} ∪ components` (excluding controlled_vars), blind to meaning. This reads the ACTUAL built method + all prior approach_vectors + the recorded `deliberation.md` and vetoes what the math cannot see: a new tag naming an old idea, a vector that promised a mechanism but shipped a constant tweak, or a novel-but-unmotivated coin-flip.

Spawned in-loop by **tiger-researcher** (step 8, after the built method exists and the POST structural check ran) and human-invocable standalone. Fresh each spawn — reconstruct from the folder tree only.

Full procedure: `agents/tiger-novelty-critic.md` — this skill is the contract + how to run it.

## When to use

- The research loop reaches the semantic novelty gate (in-loop, every iteration).
- A human asks "is this experiment actually novel", "real new way or just tuning", "critique this approach vector / method", "did they game the novelty gate".
- Standalone: point it at `research/<goalId>/` and one experiment id.

## Contract

**Inputs:** `research/<goalId>/` (absolute), the `<experimentN>` under judgment. Reads only — git-free, write-free.

**Reconstruct from the tree (read, do NOT run the harness or grade the metric):**

```bash
python3 tiger/research.py vectors    # every prior approach_vector — the anti-repeat memory
python3 tiger/research.py summary    # metric+target+direction, baseline, best {iter,value}, stall counters
```

Then read `research/<goalId>/experiments/<experimentN>/`: `experiment.md` (declared vector + hypothesis), `run.sh` **+ the method files it invokes** (the ACTUAL mechanism — judge this, not the labels), `deliberation.md` (the recorded why-this-move), `sources.md` (provenance), and `research/<goalId>/taxonomy.md` (family vocabulary).

**Two axes — both must hold for `NOVEL`:**

- **Novel (mechanism):** the built method enacts a mechanism no prior experiment already enacted. A rename, a reorder of the same parts, or a controlled-var move dressed as a component is not novel.
- **Smart (motivation):** `deliberation.md` shows a results-grounded reason — learn-from-worst-failure / attack-best-weakness / import-fresh-source / bold cross-family composition. An ungrounded switch is novel-but-dumb → `DUPLICATE`.

**Judgment dimensions (one pass each):**

| Dimension | What to check |
|---|---|
| Semantic duplication | Built mechanism replicates a prior's under different words — read `run.sh`+method vs the nearest prior's method. |
| Structural echo / synonym-gaming | Layer 1 passed only because a new tag names an old idea — name the alias pair for `tiger/research.py alias`. |
| Promise-vs-build | Built method actually enacts the DECLARED vector, or promised a new component and shipped a constant tweak (liar → `DUPLICATE`, uncredited). |
| Motivation quality | `deliberation.md` cites a prior result, or is an ungrounded random switch. |
| Hypothesis falsifiability | A real testable mechanism ("if X→<technique> then <metric> moves because <mechanism>"), not vibes. |
| Source grounding | The claimed fresh source is real, quoted in `sources.md`, and actually motivates THIS mechanism (not decorative). |
| Frozen-vars respect | The "new way" doesn't reduce to moving the goal's frozen controlled_vars (tuning that slipped G0/G2). |

**Nearest prior + distance:** name the single closest prior experiment + a semantic distance in `[0,1]` (your read, distinct from tiger/research.py's structural Jaccard): `1.0` = wholly new mechanism, `0.0` = the same mechanism relabeled. Report `nearest_prior` + `semantic_distance` + the shared mechanism (or "none").

**Verdict:**

| Verdict | Meaning |
|---|---|
| `NOVEL` | New mechanism AND intelligently motivated — both axes hold. |
| `DUPLICATE` | Semantic clone of a prior, a relabel that gamed layer 1, a promise-vs-build lie, or an unmotivated random switch. |

**Fail closed to `DUPLICATE`** — missing/unreadable file, no built `run.sh`/method yet, declared vector unmatchable to a built mechanism, or any incomplete read. Never `NOVEL` on incomplete evidence.

**Writes nothing.** No files, no ledger writes, no git notes, no commits — a pure judge. The researcher and tiger/research.py act on the verdict.

**Machine token — the LAST line of every report, exactly once** (parsed by tiger-researcher / the workflow; absent or garbled fails closed to `DUPLICATE`). The `smart? y/n` note rides the same line so the token stays parseable:

```
TIGER_NOVELTY: <NOVEL|DUPLICATE>  (smart? <y|n> — <one-clause reason>)
```

Emit nothing after it.

## Works with

research loop: tiger-researcher (deliberate → build method → `tiger/research.py novelty-check --built`) → **[ tiger-novelty-critic: semantic veto ]** → write experimentN + the six research tokens. Standalone: a human invokes it to critique one experiment's approach.

## File interactions (git-free)

- **Reads:** `python3 tiger/research.py vectors` / `summary`, `research/<goalId>/experiments/<experimentN>/{experiment.md,run.sh,method files,deliberation.md,sources.md}`, `research/<goalId>/taxonomy.md`.
- **Writes:** nothing — verdict is printed only; the `TIGER_NOVELTY:` token is the sole machine output.
- **Never:** run the harness or grade the metric, edit any experiment or the ledger, write git notes/commits/branches (the loop is git-free), or mutate `tiger/research.py` state.

## Standalone use

Invoke by intent ("is this experiment actually new", "critique this approach vector"). Supply: `research/<goalId>/` (absolute) + the experiment id. Forks into the `tiger-skills:tiger-novelty-critic` subagent, runs the full read + two-axis judgment, prints the verdict, and ends with the `TIGER_NOVELTY:` token.

## References

- `agents/tiger-novelty-critic.md` — the full procedure.
- tiger/research.py `vectors` / `summary` / `novelty-check` / `alias` — the layer-1 structural gate this complements.
- `research/<goalId>/taxonomy.md` — the approach-family vocabulary.
