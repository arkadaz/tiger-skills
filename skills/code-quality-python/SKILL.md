---
name: code-quality:python
description: Python-specific code quality rules — types, DI, enums, naming, logging, project structure, linting. Every Python file must comply. Use when writing, reviewing, or auditing Python code.
---

# Python Code Quality Rules

Non-negotiable rules for every Python file. Load the full reference at [code-quality references/python/rules.md](../code-quality/references/python/rules.md) for detailed examples.

## Types — No Any, No Bare Generics

**Every type annotation fully parameterized.** No bare `dict`/`list`/`set`/`tuple`.

```python
# Wrong
items: list
config: dict
def process(data: Any) -> dict[str, Any]: ...

# Correct
items: list[OrderItem]
config: dict[str, str | int]
def process(data: ProcessRequest) -> ProcessResult: ...
```

**Type discovery before writing:** Before any function signature, search the codebase for existing types. `cfg: Any` when `AppConfig` exists is a **BLOCKING** violation. If no type exists but data has known structure, **create the type first** (Pydantic, dataclass, TypedDict, NamedTuple, Protocol).

**Five cases for fixing `Any`/`object` inner types:**
1. Data records → TypedDict / Pydantic / dataclass
2. Callables → `Callable[[Args], Return]` or Protocol
3. Semantic primitives → `NewType`
4. Fixed value sets → `Enum` or `Literal`
5. Truly unknown JSON → `JsonValue` union type (rare)

## Dependency Injection

**External dependencies MUST be constructor-injected.** Never pass `driver`, `client`, `connection`, `session`, `queue`, `bucket` as function parameters.

```python
# Wrong — driver passed through every function
async def resolve_product(driver, database: str, name: str) -> EntityRow: ...

# Correct — driver injected via constructor
class ProductResolver:
    def __init__(self, driver: neo4j.AsyncDriver, database: str) -> None:
        self.driver = driver
        self.database = database
    async def resolve(self, name: str) -> EntityRow: ...
```

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Config/env keys | `SCREAMING_SNAKE_CASE` | `DATABASE_URL` |
| Module constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_PAGE_SIZE = 20` |
| Enum members | `SCREAMING_SNAKE_CASE` | `OrderStatus.PENDING` |
| Class names | `PascalCase` | `CreateOrderRequest` |
| Functions/methods | `snake_case` | `def calculate_total(self) -> Money:` |
| Variables | `snake_case` | `user_count = len(users)` |

**Never:** `camelCase` in Python. **Never:** leading underscore on ANY name (`_xxx`). Python's privacy model is module structure, not `_` prefix.

## Flat Functions

**Never define a function inside another function.** Extract to module level. Pass dependencies explicitly.

```python
# Wrong
def process(items):  # nested def inside
    def helper(x): ...
    return [helper(i) for i in items]

# Correct
def helper(x): ...
def process(items):
    return [helper(i) for i in items]
```

## Enum for Fixed Choice Sets

**Magic strings are forbidden.** Use `enum.Enum` for any fixed set of values: status, category, type, state, role, level, mode, priority.

```python
class OrderStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
```

Type checker verifies exhaustiveness in `match` statements.

## Pydantic at I/O Boundaries

Every function receiving data from outside the process MUST use Pydantic models:
- API request/response bodies
- File parsing (JSON, YAML, TOML, CSV)
- Database query results passed between layers
- Message queue payloads
- Webhook payloads from external services

Invalid data must fail at the boundary, not deep in business logic.

## Logging

Use `logging` module. Never `print()`.

```python
import logging
logger = logging.getLogger(__name__)
logger.info("Processing order", extra={"order_id": order_id})
```

## No Bare Try/Except

Every `try/except` must have a specific exception type and a documented reason.

```python
# Wrong
try: ...
except: ...

# Correct
try:
    response = requests.get(url, timeout=5)
except requests.Timeout:
    logger.warning("Upstream timed out", extra={"url": url})
```

## Lint and Type-Check

After every change:
- `ruff check src/` — zero errors
- `mypy src/ --strict` — zero errors

## Project Structure

```
src/{api,services,repositories,models,core,middleware,utils}/
tests/{unit,integration,e2e}/
docs/{business,specs,reviews}/
```

**Layer rules:** Imports flow inward. `api/` → `services/` → `repositories/` → `models/`. `models/` depends on nothing. `core/` reads env vars; all others receive config via constructor injection. Every `__init__.py` is **empty**.
