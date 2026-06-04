# Deterministic Workflow — `tiger-pipeline`

The tiger-skills conductor (GATES 5–12) expressed as a **git-committed Claude Code
Workflow** — a fixed JS orchestration script that spawns the 8 agents the same way
every run, instead of the conductor re-deciding the plan each time. You review it
once in a PR and trust it forever.

Based on the deterministic-workflow approach described in
[*Claude Code Workflows: Build Deterministic Agent Runs*](https://nimbalyst.com/) (R. Rezvani),
applied to this plugin's gate sequence.

> **Research-preview API.** The Workflow runtime is new, reverse-engineered, and not
> in Anthropic's public docs. Treat `tiger-pipeline.js` as a best-effort scaffold:
> the determinism *rules* are verified against the article; a few API *signatures*
> are assumptions, flagged `[ASSUMED]` in the file. It is **not yet runtime-tested**.

## Dynamic vs. deterministic — why this exists

| | Dynamic (default) | Deterministic (this file) |
|---|---|---|
| Who writes the plan | Claude, per run | You, once, committed to git |
| Reproducible | No — same prompt may replan | Yes — identical orchestration every run |
| Reviewable in a PR | No | Yes (`git diff`) |
| Best for | one-off hard tasks | a repeatable team procedure — exactly the gate sequence |

## What it covers — and what it deliberately doesn't

It runs **one already-approved feature** through:

```
explore → plan → [architect?] → persist-tasks → generate
        → execute → (heal → regenerate → re-execute){≤3}
        → review → (fix → re-review){≤3} → track
```

**Out of scope, on purpose — these stay in the conversational layer:**

- **GATE 0** bootstrap, **GATE 1** grill + **human spec approval**, **GATES 2–4**
  ledger / clock-in / scope (WIP=1). An autonomous orchestrator can't run a human
  interview, and per this plugin's own rule a spec is approved only by an explicit
  human "yes". So you grill and get sign-off *first*, then launch the workflow on the
  approved feature.

This boundary is the whole point: the **mechanical** part is deterministic; the
**judgment** part stays with you.

## Install

Workflows load from `.claude/workflows/` (project, shared) or `~/.claude/workflows/`
(personal). Plugins don't distribute workflows, so the file has to land in the project.

**Easiest — use the bundled command** (installs the plugin's copy into this project):

```
/tiger-skills:install-workflow
```

Then commit `.claude/workflows/tiger-pipeline.js`.

**Manual equivalent:**

```bash
mkdir -p .claude/workflows
cp path/to/tiger-skills/workflows/tiger-pipeline.js .claude/workflows/
```

Requires Claude Code ≥ 2.1.154, and the `tiger-skills` plugin installed (the workflow
spawns its agents).

## Run

1. Finish GATES 0–4 conversationally: bootstrap, grill, **human-approve the spec**,
   pick one feature (`in_progress`, WIP=1).
2. Launch and pass the feature's inputs:

```
/workflows tiger-pipeline
```

It expects these `args` (no clock reads — pass the date in, per the determinism rules):

| arg | type | meaning |
|---|---|---|
| `featureId` | string | e.g. `feature-001` |
| `featureTitle` | string | the feature title |
| `specFile` | string | `specs/<id>.md` (human-approved) |
| `projectDir` | string | absolute project path |
| `today` | string | ISO date for the scribe's log |
| `newModule` / `spans3PlusFiles` / `newPattern` / `structuralRisk` | bool | GATE 6 architect triggers |

3. Watch in `/workflows`: `p` pause, `x` stop an agent, `r` restart, `s` save.

## Determinism rules this file obeys (and why)

The runtime saves progress and **replays** the script to resume, so it must be
replayable. The file follows every rule from the article:

- **`meta()` is a pure literal, first statement** — read before anything runs.
- **No `Date.now()` / `Math.random()` / argless `new Date()`** in the orchestrator —
  the date is passed in via `args.today`.
- **No filesystem / shell / network in the script** — the orchestrator only
  coordinates; all I/O (explorer reads, scribe writes `feature_list.json`, generator
  writes code, executor runs verification) happens **inside agent prompts**.
- **Loops are guarded** by a counter *and* `budget.remaining()` — the heal and review
  loops cap at 3, matching the conductor's limits, well under the 1,000-agent cap.
- **Gate decisions are machine-readable** — the executor ends with
  `PIPELINE_STATUS: PASS|FAIL` and the reviewer with `REVIEW_VERDICT: APPROVED|CHANGES`,
  so loop conditions are robust, not fuzzy string-sniffing.

## Synergy with the harness

The pipeline reuses the plugin's existing contracts unchanged:

- **Proof-of-invocation** lines (`code-quality-language invoked: YES …`) are required
  in each agent's prompt — the workflow can't silently skip an agent's skill.
- **Single-writer scribe** — only the two `scribe` calls touch state; every other
  agent returns a report the orchestrator threads into the next prompt.
- **Earned `passing`** — GATE 12's scribe flips the feature to `passing` only if every
  task passes and every criterion is done.

## Adapting it

- **Fan-out a stage:** if the planner emits independent tasks, replace the single
  `generate` call with `parallel(tasks.map(t => () => run("tiger-skills:generator", …)))`
  — pass **thunks** (`() => …`), and `filter(Boolean)` the results.
- **Multi-feature:** wrap the body in a guarded `for` over an approved feature list
  (respect WIP=1 semantics per feature).
- **Different agent selector:** if `agent()` doesn't take `subagent_type`, change only
  the `run()` helper, or inline each agent's `.md` role into the prompt.
