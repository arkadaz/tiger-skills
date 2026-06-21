# Calculator Benchmark Project

Minimal target project for the Tiger harness T3 benchmark run. The feature `golden-001` is pre-approved; the workflow should proceed directly to the architect stage.

## Scope

- `src/calculator.py` — pure-function arithmetic module (add, subtract, multiply, divide)
- `src/app.py` — Flask web UI serving the calculator at `http://localhost:5000`

## Tech stack

- Python 3, Flask (web UI), pytest (unit tests)
- Robot Framework + Browser library (Playwright) for e2e UI tests

## e2e notes for the tiger-e2e stage

- E1–E5 use the Process + OperatingSystem libraries (no browser needed).
- E6–E8 are UI cases: start the Flask server as a background process, open the browser with the Browser library, click the numpad buttons by their visible text or `data-key` attribute, assert the display element, and call `Take Screenshot` to save a PNG as evidence before each case ends. The screenshot path must be under `${OUTPUT_DIR}` so Robot includes it in the run evidence.
- The Flask server must be stopped after E8 (use a Suite Teardown or explicit keyword).
- The numpad HTML must have each button identifiable by its label text (e.g. `text=7`, `text==`, `text=+`). The display must have a stable selector (e.g. `id=display`).
- `rfbrowser init` must have been run before `robot` — add a shell step if it has not.
