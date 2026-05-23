# Repo as System of Record

The agent can see: system prompts, repo files, tool output. It CANNOT see: Slack, Jira, Confluence, your mental model. Information not in the repo does not exist for the agent.

## AGENTS.md as Routing File

Keep it under 150 lines. It answers exactly five questions:
1. What is this system? (2-3 sentence overview + stack)
2. How is it organized? (directory map)
3. How do I run it? (`make setup`, `make dev`, `make test`)
4. How do I verify it? (`make check`)
5. What are the hard constraints? (≤15 non-negotiable rules)

**Template:**
```markdown
# AGENTS.md

## Project Overview
[2-3 sentences: what, primary stack]

## Quick Start
- Install: `make setup`
- Run dev: `make dev`
- Test: `make test`
- Full verification: `make check`

## Hard Constraints
- [≤15 rules, active voice, MUST or MUST NOT]

## Topic Docs
- [docs/topic.md] — when doing X
- [docs/topic.md] — when doing Y

## Verification Commands
- Lint: `ruff check src/`
- Type check: `mypy src/ --strict`
- Tests: `pytest tests/ -x`
- Full: `make check`
```

**Rules:** Put critical constraints at the TOP or BOTTOM (never middle — lost-in-the-middle effect). If removing a rule wouldn't change agent behavior, delete it. If the file exceeds 150 lines, split into topic docs.

## Topic Docs

Each: 50–150 lines, single subject, loaded only when the task matches its trigger.

```
project/
├── AGENTS.md              # Router
├── docs/
│   ├── api-patterns.md     # When adding/modifying API endpoints
│   ├── database-rules.md   # When modifying DB schema/queries
│   ├── testing-standards.md # When writing/modifying tests
│   └── architecture.md     # When changing cross-cutting concerns
├── PROGRESS.md
├── DECISIONS.md
└── Makefile
```

## Codebase Knowledge Map

Save to `docs/codebase-map.md`. Updated every session that changes files. A fresh session reads this first after PROGRESS.md.

```markdown
# Codebase Map

## Directory Overview
src/
├── api/          — Route handlers, request/response models
├── services/     — Business logic, use cases
├── repositories/ — Database access, queries
├── models/       — ORM models, domain types
└── utils/        — Shared helpers (no business logic)

## Key Files
- src/api/orders.py — Order CRUD endpoints
- src/services/order_service.py — Order orchestration, pricing

## Cross-Cutting Concerns
- Auth: OAuth2 Bearer on all /api/* (src/middleware/auth.py)
- Logging: structlog (src/utils/logging.py)

## External Dependencies
- PostgreSQL 15, Redis, Stripe API
```

## Docs-to-Code Mapping Convention

Every .md file referencing code MUST include file paths: `src/module/file.py:123 (function_name)`. Agents navigate from docs to code and back.

## Cold-Start Test

A fresh agent session must be able to answer all five entry-file questions from the repo alone.
