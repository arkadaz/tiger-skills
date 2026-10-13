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

## Ports

| Port | Needed for | Implemented by |
|---|---|---|
| `{{OrderStore}}` | {{saving and loading orders}} | `{{PostgresOrderStore}}` |

## Needs

Names only, never values.

- {{environment variable, or service that must be running}} — {{what for}}

## Commands

- setup: `{{install the dependencies}}`
- static checks: `{{formatter check, linter, type checker}}`
- code map: `{ [ -d .codegraph ] || codegraph init -y; } && codegraph sync && node docs/agent/codemap.mjs > docs/agent/codemap.md`
- test: `{{command}}`
- architecture check: `{{command}}`
- run: `{{command}}`

## Words

| Word or value | Means |
|---|---|
| `{{status 001}}` | {{pending}} |
