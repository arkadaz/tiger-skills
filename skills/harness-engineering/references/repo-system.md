# Repo as System of Record

The agent can see: system prompts, repo files, tool output. It CANNOT see: Slack, Jira, Confluence, your mental model, hallway conversations, or that architecture decision from last Friday's coffee chat.

**Information not in the repo, for all practical purposes, does not exist for the agent.** A 50-line `ARCHITECTURE.md` in the repo beats a 500-page Confluence document nobody maintains.

## The Cold-Start Test

A fresh agent session with ONLY the repo must be able to answer all five questions:

1. **What is this system?** — 2-3 sentence overview, primary technology stack
2. **How is it organized?** — directory map, module boundaries, architectural style
3. **How do I run it?** — `make setup`, `make dev`, `make test` all work from scratch
4. **How do I verify it?** — `make check` runs lint + types + tests and reports pass/fail
5. **What are the hard constraints?** — rules that MUST NEVER be broken, regardless of context

If a fresh session cannot answer all five from the repo alone within 2 minutes, the harness is incomplete.

## AGENTS.md as Routing File

The entry instruction file MUST be a router, not an encyclopedia. Keep it under 150 lines. Beyond 150 lines, the lost-in-the-middle effect becomes significant — rules in the middle of the file are frequently ignored.

### Minimal Template

```markdown
# AGENTS.md

## Project Overview
[2-3 sentences: what, tech stack]

## Quick Start
- make setup / make dev / make test / make check

## Directory Map
src/{api,services,repositories,models,core,utils}

## Hard Constraints
- [ ] Rule 1
- [ ] Rule 2

## Verification Commands
- Lint / Type check / Tests / E2E

## Topic Docs
- [link](path) — When to load
```

### Rules for Maintaining AGENTS.md

**When to add a rule:**
- You encountered an error that would have been prevented if a rule existed → add the rule
- A code review found a pattern violation that should never happen again → add the rule
- The team agreed on a new convention → add the rule

**When to remove a rule:**
- The rule has not prevented a single issue in the last 10 sessions → remove it
- The rule is now enforced automatically by tooling (linter, CI) → remove it (tooling > documentation)
- The rule describes standard practice that any competent developer would follow → remove it

**Placement matters:**
- PUT critical constraints at the TOP (first 20 lines) or BOTTOM (last 20 lines)
- NEVER bury critical rules in the middle — the lost-in-the-middle effect is real and well-documented
- Group related rules under clear headings

## Topic Docs

Each topic doc is 50–200 lines, covers a single subject, and is loaded ONLY when the agent's task matches its trigger condition.

**Naming convention:** `<domain>-<topic>.md` — e.g., `api-patterns.md`, `database-migrations.md`

**Structure of a good topic doc:**
```markdown
# <Topic Title>

## When This Applies
[1-2 sentences: what kind of task triggers loading this doc]

## Rules
[3-8 concrete rules, each one line, active voice]

## Patterns
[Code example showing the right way]

## Anti-Patterns
[Code example showing the wrong way, with explanation]

## Related Files
- `src/module/file.py:123` — key reference implementation
- `docs/business/domain.md` — related business rules
```

## Codebase Knowledge Map

Saved at `docs/codebase-map.md`. Updated every session that creates, deletes, or renames files. A stale map is worse than no map — it sends the agent confidently in the wrong direction.

**Quality bar: A fresh agent reading ONLY codebase-map.md must be able to find any file in the project within 30 seconds, understand every file's role, know how files depend on each other, and locate the right file to modify for any given task — without running `find` or `ls`.**

### What codebase-map.md Must Contain — Completeness Checklist

**This is NOT a template with placeholders. When creating codebase-map.md, you MUST explore the actual project directory tree and document every real file.** Do NOT copy example directory names or placeholder file names. Every line must reflect a file that actually exists on disk.

```
codebase-map.md Completeness Checklist:
- [ ] Every top-level directory documented with its purpose
- [ ] Every source file documented with its role (not just filename — what it DOES)
- [ ] Every key class, function, or export listed per file
- [ ] Import/dependency relationships shown (what imports what, what depends on what)
- [ ] Configuration files documented (what each controls, required env vars)
- [ ] Test directory mapped (what tests cover what source files)
- [ ] Documentation files indexed (what each .md covers, when to read it)
- [ ] Entry points clearly marked (main, app factory, CLI entry, route registrations)
- [ ] Shared/utility code identified and categorized
- [ ] File:line references for every key function/class (enables direct jumps)
- [ ] Last updated date + git describe output (for freshness check)
```

### Detailed Template

**CRITICAL: Every `[...]` and placeholder below must be replaced with real data discovered by exploring the actual project files.** Read the directory tree. Read key files to understand their role. Document what EXISTS, not what a generic project might have. Delete no section — populate every one.

```markdown
# Codebase Map
Last updated: <YYYY-MM-DD> by <session>
Git ref: <git describe --tags or HEAD commit hash>

## Project Overview
- **Language/Stack:** <Python 3.12, FastAPI, SQLAlchemy 2.0, PostgreSQL, RabbitMQ>
- **Architecture style:** <layered (api → services → repositories → models)>
- **Entry points:** <list every way to start/run the project>
- **Package manager:** <pip/poetry/uv> — <pyproject.toml / requirements.txt>

## Directory Overview

Show EVERY top-level and second-level directory. Each with a one-line purpose statement.
Use a tree diagram — agents read these faster than lists.

```
<project-root>/
├── src/                          — Main application source
│   ├── api/                      — HTTP route handlers (FastAPI). One file per resource.
│   │   ├── orders.py             — POST /orders, GET /orders, GET /orders/{id}, DELETE /orders/{id}
│   │   ├── products.py           — GET /products, GET /products/{id}, GET /products/search
│   │   ├── users.py              — POST /auth/register, POST /auth/login, GET /users/me
│   │   └── deps.py               — Shared FastAPI dependencies (get_db, get_current_user, get_config)
│   ├── services/                 — Business logic. Each service = one domain or use case.
│   │   ├── order_service.py      — Order creation, cancellation, pricing orchestration
│   │   ├── product_service.py    — Product catalog queries, search, filtering
│   │   ├── user_service.py       — Registration, authentication, profile management
│   │   ├── promo_service.py      — Promo code validation, discount calculation
│   │   ├── inventory_service.py  — Stock checking, reservation, release
│   │   └── notification_service.py — Email, push notification dispatch
│   ├── repositories/             — Database access layer (SQLAlchemy 2.0 async).
│   │   ├── order_repo.py         — Order CRUD: save(), find_by_id(), find_by_customer(), search()
│   │   ├── product_repo.py       — Product queries: find_all(), find_by_id(), search(), find_by_category()
│   │   ├── user_repo.py          — User queries: find_by_email(), save(), update_profile()
│   │   └── base.py               — Base repository with shared query patterns, pagination
│   ├── models/                   — ORM models + domain types + enums + DTOs.
│   │   ├── order.py              — Order (ORM), OrderItem (ORM), OrderStatus (Enum: pending→confirmed→shipped→delivered→cancelled)
│   │   ├── product.py            — Product (ORM), ProductCategory (Enum), ProductImage (ORM)
│   │   ├── user.py               — User (ORM), UserRole (Enum), Address (dataclass)
│   │   ├── promo.py              — PromoCode (ORM), DiscountType (Enum: percentage, fixed)
│   │   ├── events.py             — OrderCreatedEvent, PaymentProcessedEvent, ShipmentUpdatedEvent (Pydantic)
│   │   └── types.py              — Shared types: Money (dataclass), Email (NewType), PhoneNumber (NewType)
│   ├── middleware/                — Cross-cutting request/response processing.
│   │   ├── auth.py               — OAuth 2.0 token validation, current_user injection
│   │   ├── error_handler.py      — Global exception → JSON error response mapping
│   │   ├── logging.py            — Request/response logging with correlation IDs
│   │   └── rate_limit.py         — Per-user rate limiting with Redis backend
│   ├── events/                   — Event publishing and consumption.
│   │   ├── order_events.py       — publish_order_created(), publish_order_cancelled()
│   │   ├── handlers/             — Event consumers.
│   │   │   ├── orders.py         — on_order_created() → send confirmation email
│   │   │   └── payments.py       — on_payment_processed() → update order status
│   │   └── bus.py                — RabbitMQ connection management, publish/subscribe helpers
│   ├── config/                   — Application configuration.
│   │   ├── settings.py           — Pydantic BaseSettings — all env vars, secrets, feature flags
│   │   └── logging_config.py     — Structlog configuration (JSON in prod, console in dev)
│   └── utils/                    — Zero-business-logic helpers.
│       ├── parsing.py            — Date, number, currency parsing utilities
│       ├── http.py               — HTTP client wrapper with retry, timeout, circuit breaker
│       └── id_generator.py       — UUID v7 generation, short ID for public-facing references
├── tests/                        — Test suite (mirrors src/ structure).
│   ├── conftest.py               — Shared fixtures: test DB, test client, auth headers, mock services
│   ├── test_orders_api.py        — Order endpoint integration tests
│   ├── test_order_service.py     — Order business logic unit tests
│   ├── test_products_api.py      — Product endpoint integration tests
│   ├── test_auth.py              — Authentication flow tests
│   └── factories/                — Test data factories.
│       ├── order_factory.py      — Order, OrderItem factory functions
│       └── user_factory.py       — User factory with preset roles
├── migrations/                   — Alembic database migrations.
│   ├── alembic.ini               — Alembic configuration
│   ├── env.py                    — Migration environment (connects to DATABASE_URL)
│   └── versions/                 — Migration scripts (one per schema change)
├── docs/                         — Project documentation (harness-managed).
│   ├── GRAPH.md                  — Complete code flow graph (all endpoints, all flows)
│   ├── codebase-map.md           — This file
│   ├── business/                 — Business rule documentation
│   │   ├── pricing.md            — Pricing rules, discounts, free shipping thresholds
│   │   ├── promotions.md         — Promo code rules, usage limits, stacking policy
│   │   └── notifications.md      — When emails/push are sent, templates, triggers
│   ├── specs/                    — Per-feature specification documents
│   ├── plans/                    — Per-feature implementation plans
│   └── reviews/                  — Code review reports
├── scripts/                      — Operations and utility scripts.
│   ├── seed_db.py                — Seed database with development fixtures
│   └── generate_migration.py     — Auto-generate Alembic migration from model changes
├── pyproject.toml                — Project metadata, dependencies, tool config (ruff, mypy, pytest)
├── Makefile                      — make setup / test / lint / check / dev / clean
├── Dockerfile                    — Production container image
├── docker-compose.yml            — Local dev environment (app + PostgreSQL + RabbitMQ + Redis)
├── .env.example                  — Required environment variables with documentation
├── .gitignore                    — Git ignore rules
├── AGENTS.md                     — Agent instruction routing file
├── PROGRESS.md                   — Current project progress and task state
├── DECISIONS.md                  — Architectural decision records
└── README.md                     — Project README (human-facing)
```

## File Dependency Map

Show what imports what. This helps agents understand ripple effects — "if I change X, what might break?"

```
File Dependency Map (imports graph):
src/api/orders.py
  → src/services/order_service.py
  → src/services/product_service.py
  → src/middleware/auth.py
  → src/middleware/error_handler.py
  → src/models/order.py
  → src/config/settings.py

src/services/order_service.py
  → src/repositories/order_repo.py
  → src/services/promo_service.py
  → src/services/inventory_service.py
  → src/events/order_events.py
  → src/models/order.py
  → src/models/events.py
  → src/models/types.py

src/services/promo_service.py
  → src/models/promo.py
  → src/config/settings.py

src/repositories/order_repo.py
  → src/models/order.py
  → src/repositories/base.py

src/middleware/auth.py
  → src/repositories/user_repo.py
  → src/config/settings.py

src/events/order_events.py
  → src/events/bus.py
  → src/models/events.py
```

## Configuration File Index

Document every configuration file. Include what it controls and every required environment variable.

| File | Purpose | Key Env Vars |
|------|---------|-------------|
| pyproject.toml | Project metadata, dependencies, tool config | — |
| src/config/settings.py | Application settings from env vars | DATABASE_URL, RABBITMQ_URL, REDIS_URL, STRIPE_API_KEY, AUTH_SECRET_KEY, LOG_LEVEL, APP_ENV |
| .env.example | Documented env var template | (all of the above, with placeholder values) |
| migrations/alembic.ini | Alembic DB migration config | DATABASE_URL (via env.py) |
| docker-compose.yml | Local dev service orchestration | — |
| Dockerfile | Production container build | — |
| Makefile | Task automation targets | — |

## Test Map

Show which test files cover which source files. An agent modifying a source file must know which tests to run.

| Source File | Test File(s) | Coverage Type |
|------------|-------------|---------------|
| src/api/orders.py | tests/test_orders_api.py | Integration |
| src/services/order_service.py | tests/test_order_service.py | Unit |
| src/services/promo_service.py | tests/test_order_service.py (shared) | Unit |
| src/api/products.py | tests/test_products_api.py | Integration |
| src/middleware/auth.py | tests/test_auth.py | Integration |
| src/repositories/order_repo.py | tests/test_order_service.py (indirect) | Integration (via service) |

## Key Entry Points by Task

Help agents find the right file fast for common task types.

| If you need to... | Start at... |
|-------------------|-------------|
| Add a new API endpoint | src/api/<resource>.py → register route, call service |
| Add business logic | src/services/<domain>_service.py |
| Add a database query | src/repositories/<resource>_repo.py |
| Change a database schema | src/models/<resource>.py → then generate migration |
| Add a new event consumer | src/events/handlers/<domain>.py |
| Add a config value | src/config/settings.py → add Field with env var |
| Add a test | tests/ — mirror src/ structure |
| Add a business rule | docs/business/<domain>.md → then implement |
```

### Rules for Maintaining codebase-map.md

1. **Update EVERY session that adds, deletes, or renames a file.** A stale map lies to the agent.
2. **Document REAL files, not placeholders.** Read the directory tree. Every filename in the map must exist on disk. If you don't know what a file does, read it until you do.
3. **Include file:line references** for every key function, class, or export. `src/module/file.py:123 (function_name)` format.
4. **Keep the dependency map accurate.** When you add an import, add it to the dependency map. When you remove one, remove it.
5. **Never copy the example directory names.** `order_service.py` is an example. Your project has different files. Document YOUR files.
6. **The dependency map IS the architecture documentation.** It shows coupling, layering, and potential circular dependencies at a glance.
7. **Sections can be added.** If your project has something not covered (Kubernetes configs, Terraform, CI/CD pipelines), add a section for it.

## Docs-to-Code Mapping Convention

Every `.md` file that references code MUST include file paths with line numbers:

```
`src/module/file.py:123` (function_name)
```

**Why line numbers:** They let the agent jump directly to the relevant code. They also serve as a freshness check — if the function moved, the line number being wrong signals that the doc needs updating.

**Where to add references:**
- Business logic docs → reference the implementation file
- Spec documents → reference the files touched
- Architecture docs → reference key interface definitions
- Codebase map → reference every significant file

## Knowledge Visibility

Every critical piece of project knowledge MUST live somewhere in the repo:
- **Business rules** → `docs/business/<domain>.md`
- **Architecture decisions** → `DECISIONS.md` or `docs/architecture.md`
- **API contracts** → OpenAPI spec or `docs/api/`
- **Setup instructions** → `AGENTS.md` + `Makefile`
- **Current progress** → `PROGRESS.md`
- **Why decisions were made** → `DECISIONS.md`

If it's only in someone's head, it doesn't exist for the agent.
