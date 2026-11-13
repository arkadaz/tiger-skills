# Architecture

{{two or three lines: what this system does}}

## Layers

| Layer | Path | Holds |
|---|---|---|
| domain | `{{src/domain}}` | rules and data, no I/O |
| application | `{{src/application}}` | use cases and ports |
| adapters in | `{{src/adapters/inbound}}` | {{HTTP, CLI, UI}} |
| adapters out | `{{src/adapters/outbound}}` | {{database, APIs, files}} |
| wiring | `{{src/main}}` | builds the adapters, starts the app |

Not in its layer yet: {{each file that is outside its layer's folder, and the folder it moves to; "none" when the architecture check passes}}

## Ports

| Port | Needed for | Implemented by |
|---|---|---|
| `{{OrderStore}}` | {{saving and loading orders}} | `{{PostgresOrderStore}}` |

## Services

API under `{{/api/v1}}`, contract in `{{openapi.yaml}}`, written by `{{command}}`.

| Service | Folder | Image | Port | Health |
|---|---|---|---|---|
| `{{backend}}` | `{{backend/}}` | {{its Dockerfile, or postgres:17.2}} | {{8000}} | `{{/readyz}}` |

## Needs

Names only, never values.

- {{environment variable, or service that must be running}} — {{what for}}

## Commands

- setup: `{{install the dependencies}}`
- static checks: `{{formatter check, linter, type checker}}`
- code map: `{ [ -d .codegraph ] || codegraph init -y; } && codegraph sync && node docs/agent/codemap.mjs > docs/agent/codemap.md && node docs/agent/codemap.mjs --human docs/human/flows.html`
- test: `{{command}}`
- architecture check: `{{fails on a file outside its layer and on an import that points outward}}`
- run: `{{command}}`

## Words

| Word or value | Means |
|---|---|
| `{{status 001}}` | {{pending}} |
