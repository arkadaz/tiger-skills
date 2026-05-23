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

### Full Template

```markdown
# AGENTS.md

## Project Overview
[2-3 sentences: what this system is, what it does, primary technology stack]
Example: "FastAPI backend for the book ordering platform. Python 3.12,
PostgreSQL 15, Redis for caching. Serves the customer-facing order API."

## Quick Start
- Install dependencies: `make setup`
- Run development server: `make dev` (listens on http://localhost:8000)
- Run tests: `make test`
- Full verification: `make check` (runs lint + type-check + tests)

## Directory Map
src/
├── api/          — FastAPI route handlers, request/response Pydantic models
├── services/     — Business logic, use cases, orchestration
├── repositories/ — Database access (SQLAlchemy 2.0 queries)
├── models/       — ORM models, domain types, enums
├── middleware/    — Auth, logging, error handling middleware
└── utils/        — Shared helpers with NO business logic
docs/
├── business/     — Business rules and domain logic documentation
├── specs/        — Per-feature specification documents
└── reviews/      — Code review reports

## Hard Constraints
- [ ] All API endpoints require OAuth 2.0 Bearer token (src/middleware/auth.py)
- [ ] All DB queries use SQLAlchemy 2.0 syntax — no raw SQL
- [ ] All I/O boundaries use Pydantic models — no dict, list, or Any
- [ ] All public functions have full type hints — mypy --strict must pass
- [ ] All user-facing strings must be internationalized (src/utils/i18n.py)
- [ ] Never commit secrets — use environment variables via pydantic-settings
- [ ] Never use print() — use logging.getLogger(__name__)
- [ ] WIP=1 — one feature at a time, finish before starting next

## Verification Commands
- Lint: `ruff check src/`
- Type check: `mypy src/ --strict`
- Unit tests: `pytest tests/ -x -m "not e2e"`
- Integration tests: `pytest tests/ -x -m integration`
- E2E tests: `pytest tests/ -x -m e2e`
- Full check: `make check`

## Topic Docs
- [docs/api-patterns.md](docs/api-patterns.md) — When adding or modifying API endpoints
- [docs/database-rules.md](docs/database-rules.md) — When modifying DB schema or queries
- [docs/testing-standards.md](docs/testing-standards.md) — When writing or modifying tests
- [docs/business/pricing.md](docs/business/pricing.md) — When touching pricing, discounts, or shipping
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

### Template

```markdown
# Codebase Map
Last updated: <YYYY-MM-DD> by <session>

## Directory Overview
src/
├── api/          — FastAPI route handlers. One file per resource (orders.py, users.py, products.py)
│   └── deps.py   — Shared FastAPI dependency injection
├── services/     — Business logic. Each service = one use case or domain
│   ├── order_service.py     — Order creation, pricing orchestration
│   ├── inventory_service.py — Stock checking, reservation
│   └── notification_service.py — Email, push notification dispatch
├── repositories/ — Database access via SQLAlchemy 2.0
│   ├── order_repo.py        — Order CRUD, search queries
│   └── product_repo.py      — Product catalog queries
├── models/       — ORM models (SQLAlchemy) + domain types + enums
│   ├── order.py             — Order, OrderItem, OrderStatus enum
│   ├── product.py           — Product, ProductCategory enum
│   └── types.py             — Shared types: Money, Address, Email
├── middleware/    — Cross-cutting request/response processing
│   ├── auth.py              — OAuth 2.0 token validation
│   └── logging.py           — Request/response logging
└── utils/        — Zero-business-logic helpers
    ├── parsing.py           — Date, number parsing utilities
    └── http.py              — HTTP client wrapper with retry

## Key Files (by domain)
### Orders
- src/api/orders.py — POST /orders, GET /orders/{id}, GET /orders
- src/services/order_service.py — CreateOrderUseCase, CancelOrderUseCase
- src/repositories/order_repo.py — save(), find_by_id(), find_by_customer()
- src/models/order.py — Order (ORM), OrderItem (ORM), OrderStatus (Enum)

### Products
- src/api/products.py — GET /products, GET /products/{id}
- src/repositories/product_repo.py — find_all(), find_by_id(), search()
- src/models/product.py — Product (ORM), ProductCategory (Enum)

## Cross-Cutting Concerns
- **Auth:** All /api/* endpoints require OAuth2 Bearer token → src/middleware/auth.py:12 (require_auth)
- **Logging:** Structured JSON logging via structlog → src/middleware/logging.py:8 (setup_logging)
- **Error handling:** All services raise domain exceptions from src/errors.py → src/middleware/errors.py:20 (error_handler)
- **Database:** SQLAlchemy 2.0 async session → src/database.py:15 (get_session)
- **I18N:** All user-facing strings via gettext → src/utils/i18n.py:5 (_)

## External Dependencies
- PostgreSQL 15 — primary data store (via asyncpg + SQLAlchemy)
- Redis 7 — session cache, rate limiting
- Stripe API (2024-09) — payment processing
- SendGrid API — transactional email
- AWS S3 — order invoice PDF storage

## Environment Variables
See `.env.example` for full list. Critical ones:
- DATABASE_URL — PostgreSQL connection string
- REDIS_URL — Redis connection string
- STRIPE_SECRET_KEY — Stripe API key
- SENDGRID_API_KEY — SendGrid API key
```

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
