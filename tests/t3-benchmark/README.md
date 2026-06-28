# T3 — End-to-End Benchmark

T3 runs a **real** Tiger v2 pipeline against a *golden project* and scores the result.
It copies a golden project into a throwaway repo, drives the saved `/tiger-workflow-dev`
workflow with a headless `claude` session (bootstrap → architect → parallel build →
e2e → close-out), and collects a `scorecard.json`. Unlike T1 (structural) and T2
(contract) checks, T3 actually **builds and exercises** a feature — including driving the
generated UI with Playwright — so it measures whether the workflow *works*, not just
whether the files are well-formed.

> A run takes ~20–25 min and makes real API calls. To gauge cost first, run T1+T2
> (`../run-ci.sh`), which are fast and free.

---

## Prerequisites

| Need | Why |
|---|---|
| `claude` CLI (v2.1.154+) | runs the workflow headlessly (`claude -p`) |
| `python3`, `git` | board parsing, scorecard, bench repo |
| this repo present at `../..` | the local plugin is installed from `KIT_ROOT` so the workflow's `tiger-skills:*` agents resolve |
| *(auto)* `robotframework` + `robotframework-browser` | the e2e stage `pip install`s + `rfbrowser init`s as needed for the Playwright UI cases |
| *(optional)* `coreutils` (`gtimeout`) | enables the 45-min watchdog; without it the run has no timeout (`brew install coreutils`) |

---

## Quick start

Bundled golden projects live under `golden-project/<name>/`. Pass a **bare name** (resolved
there), a relative path, or an absolute path:

```bash
./run-benchmark.sh                        # golden-project/calculator (default)
./run-benchmark.sh /abs/path/to/project   # any Tiger project on disk
```

Current bundled project: `calculator` (four-op calculator + numpad UI).

The **feature id is auto-discovered** from the golden project's `feature_list.json`
(`current_feature`, else the single `in_progress` feature) — you never pass it.

### Choosing models

```bash
TIGER_PRO_MODEL=opus   TIGER_FAST_MODEL=sonnet  ./run-benchmark.sh   # defaults
TIGER_PRO_MODEL=inherit TIGER_FAST_MODEL=inherit ./run-benchmark.sh  # session default (non-Anthropic backends)
```

`PRO` drives architect/e2e/update-docs; `FAST` drives code-generator/integrator. These
become the workflow's `proModel`/`fastModel` args (the agent frontmatter `model:` is
ignored by the workflow runtime — it passes these directly).

---

## What a run does

1. **Seed** — copy the golden project to `/tmp/tiger-bench-<timestamp>`, `git init`, set
   the **`main`** trunk (v2 is trunk-based; bootstrap aborts without it), branch
   `feature/<id>`.
2. **Install the local plugin** into the bench project (`claude plugin install --scope
   project`) so the workflow's namespaced subagents resolve. A **fidelity gate** then
   fails loud (exit 3) if the plugin isn't enabled — otherwise the run would silently
   fall back to the generic agent and overstate fidelity. The bench plugin is
   **uninstalled on exit** (no global state left behind).
3. **Run the workflow** headlessly with `--append-system-prompt` guarding against the
   runner improvising (it must run the workflow as-written and report, never patch around
   failures). A live **progress poller** prints board phase / task progress / active
   worktrees every ~10s, so a buffered `claude -p` run never looks stuck.
4. **Score** — write `config.json` + `scorecard.json`, copy Robot evidence (report/log
   HTML + screenshots) out of the bench dir.

Everything lands in (project name first, so a project's runs group together):

```
tests/scorecards/<golden-name>-<timestamp>-<version>/
├── scorecard.json   # the metrics (see below)
├── config.json      # models, timeout, exit code, bench dir
├── run.log          # full headless claude transcript
└── evidence/        # report.html, log.html, output.xml, *.png (UI screenshots)
```

---

## Reading the scorecard

```jsonc
{
  "completed": true,            // reached phase: passing
  "final_phase": "passing",
  "rounds_to_pass": 0,          // e2e fix-up rounds needed (0 = passed first try)
  "blocked_count": 0,           // gate notes graded "blocked"
  "stages_passed": ["architect", "code-generator", "e2e", "update-docs"],
  "gate_first_pass_rate": 1.0,  // pass-notes / total gate-notes
  "commit_count": 7,            // commits on feature/<id> over main..HEAD
  "elapsed_seconds": 1134,      // first→last feature commit span
  "artifacts_complete": true,   // spec/adr/business/e2e present
  "e2e_blockers": { "high": 0, "medium": 0, "low": 1 },  // bug-priority triage from the e2e note
  "e2e_screenshots": 3          // Playwright captures = proof the UI was actually driven
}
```

`e2e_blockers` + `e2e_screenshots` are the "clickable verified" signal: a pass with
`high=0, medium=0` and N screenshots means the e2e gate launched a real browser, clicked
the UI, and asserted behavior — not just that unit tests passed.

### Re-score an existing bench dir

```bash
./scorecard.py /tmp/tiger-bench-<ts> <version> [feature_id]
```

### Compare two runs (A/B a plugin version or a change)

```bash
../compare-scorecards.py baseline/scorecard.json candidate/scorecard.json
# exit 0 = candidate no worse on rounds_to_pass / blocked_count / gate_first_pass_rate / completed
# exit 1 = candidate regresses on at least one
```

---

## Adding a new golden project

A golden project is a directory holding a **Tiger project with exactly one approved,
`in_progress` feature ready to build**. The benchmark builds *from* that approved spec, so
the artifacts must already exist and be committed (they are test fixtures — see
`golden-project/calculator/` for the reference layout). Drop a new one under
`golden-project/<name>/` and it's runnable as `./run-benchmark.sh <name>`.

Required:

```
golden-project/<name>/
├── CLAUDE.md                 # project conventions (test command, stack notes)
├── progress.md
├── feature_list.json         # board with a discoverable feature:
│                             #   current_feature set OR exactly one status:"in_progress"
│                             #   phase:"plan", WHY/SPECIFY fields filled
├── tiger/features/<id>/
│   ├── feature.md            # MUST carry the frontmatter line `tiger-status: approved`
│   └── e2e_testcases.robot   # broad, priority-tagged Given/When/Then cases
└── …optional seed source (src/…)
```

The harness supplies the rest: git init + `main` + a `dev` integration trunk, the workflow, the rm guard, the
local plugin install, and the Robot/Playwright tooling. A bare seed (like
`golden-project/`) and a fully `install`-ed project both work.

> **The board must contain a feature, or the run aborts (exit 2).** A freshly
> `install`-ed project has an **empty board** until `tiger-grill` (or a pre-baked fixture)
> creates an approved feature. Example:
>
> ```
> ./run-benchmark.sh /…/TEST-CASES/CJ-STORE-WEB
> ERROR: cannot determine the feature id … (need current_feature, or one in_progress feature)
> ```
>
> Author the feature (feature.md with the `tiger-status: approved` token + the board entry) first.

---

## Exit codes

| Code | Meaning | Fix |
|---|---|---|
| `0` | ran and scored (may still be a workflow non-pass — read the scorecard) | — |
| `2` | can't resolve a golden project / feature id | point at a project whose board has a discoverable approved feature |
| `3` | local plugin not enabled in the bench | ensure this repo is intact at `../..` and `claude plugin` works |

## Related

- `../run-ci.sh` — T1 (structural) + T2 (contract) checks; fast, no API.
- `golden-project/` — the reference calculator golden project.
