# AGENTS.md

## Project Overview
Book store API backend. Python 3.12, FastAPI, Pydantic v2 for validation, SQLAlchemy 2.0 for database, structlog for logging.

## Quick Start
- Install: `pip install -r requirements.txt`
- Run dev: `uvicorn src.main:app --reload`
- Test: `pytest tests/ -x`
- Full verification: `make check`

## Directory Map
```
src/
├── api/          — FastAPI route handlers, request/response Pydantic models
├── services/     — Business logic, use cases, orchestration
├── repositories/ — Database access
├── models/       — Domain types, enums
└── main.py       — App factory, dependency wiring
docs/
├── business/     — Business rules documentation
├── specs/        — Per-feature specification documents
├── reviews/      — Code review reports
└── GRAPH.md      — Code flow graph
```

## Hard Constraints
- All I/O boundaries use Pydantic models — no dict, list, or Any
- All public functions have full type hints — mypy --strict must pass
- Never use print() — use logging.getLogger(__name__)
- All known value sets use enum.Enum — no magic strings
- No bare except: or except Exception: — specific exceptions only
- WIP=1 — one feature at a time
- Spec before code — write docs/specs/<date>-<topic>.md first

## Verification Commands
- Lint: `ruff check src/`
- Type check: `mypy src/ --strict`
- Tests: `pytest tests/ -x`
- Full: `make check`

## Topic Docs
- [docs/business/auth.md](docs/business/auth.md) — When modifying auth, registration, passwords
- [docs/GRAPH.md](docs/GRAPH.md) — Code flow, read before implementing anything

## Definition of Done
A feature is complete ONLY when:
1. Static analysis passes (ruff + mypy)
2. All tests pass
3. Verification evidence recorded
4. Code committed with clean message
5. docs/GRAPH.md updated
6. PROGRESS.md updated
