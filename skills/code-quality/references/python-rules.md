# Python-Specific Rules

Always loaded. These are non-negotiable.

## Pydantic for All I/O Boundaries

Every function receiving data from outside the process MUST use Pydantic models: API request/response bodies, file parsing (JSON, YAML, CSV), database query results, message queue payloads, env vars, CLI args.

A Pydantic model defines the contract. Invalid data fails at the boundary, not deep in business logic.

**Correct:**
```python
from pydantic import BaseModel, PositiveInt

class CreateBookRequest(BaseModel):
    title: str
    author_last: str
    author_first: str
    year: PositiveInt

def create_book(req: CreateBookRequest) -> Book:
    ...
```

**Wrong:**
```python
def create_book(data: dict) -> Book:
    title = data.get("title")      # is it there? string? who knows
    year = int(data.get("year", 0))  # silently swallowing garbage
```

## No Magic Try/Except

Every `try/except` MUST have a specific exception type and a specific reason. If catching because you're unsure about data shape — STOP — define the type with Pydantic first.

**Allowed:** `try: parse_json(raw) except json.JSONDecodeError`, `try: db.execute(q) except DatabaseError`, retry logic for network calls.

**Forbidden:** `try: ... except Exception: pass`, bare `except:`, `try: data["key"] except KeyError` (use `.get()` or Pydantic instead), catching exceptions when you don't know the data shape.

## Logging Rules

Use Python's `logging` module. Never `print()`.

**Every function crossing a system boundary MUST log:** Entry (function name, key inputs), exit (function name, result summary, elapsed if >1s), every state-changing branch (what changed and why).

**Log levels:** DEBUG (internal state), INFO (completed operations), WARNING (recoverable issues), ERROR (operation failed, process continues), CRITICAL (process cannot continue).

```python
import logging
logger = logging.getLogger(__name__)

def process_order(order_id: str) -> OrderResult:
    logger.info("Processing order", extra={"order_id": order_id})
    ...
    if out_of_stock:
        logger.warning("Item out of stock", extra={"sku": sku})
    ...
    logger.info("Order processed", extra={"status": result.status})
    return result
```

## Enum for Known Value Sets

When a variable can only take one of a known, fixed set of values, use `enum.Enum` — never magic strings or bare integers. Applies to: status codes, categories, types, states, roles, levels, modes.

**Violation signals:** Function returns strings like `"minor"`, `"adult"`. `if/elif` tests against string literals. Parameter documented as "one of: 'active', 'pending'" but typed as `str`.

**Correct:**
```python
from enum import Enum

class AgeCategory(Enum):
    MINOR = "minor"
    ADULT = "adult"
    SENIOR = "senior"

def categorize_age(age: int) -> AgeCategory:
    if age < 18: return AgeCategory.MINOR
    if age < 65: return AgeCategory.ADULT
    return AgeCategory.SENIOR
```

## Lint and Type-Check on Every Change

After every implementation step, run `ruff check` (or project linter) and `mypy --strict` (or project type checker). Never leave lint or type errors behind. A clean run is part of the minimum bar for "done."

## No Water Code

Every line MUST carry its weight. Delete: comments restating code, unused imports/variables/parameters, dead `else` branches after `return`/`raise`, intermediate variables used exactly once (inline them), getters/setters that do nothing (use plain attribute or frozen dataclass), `__init__` methods that only assign parameters (use `@dataclass` or Pydantic).

## Explore Before Implementing

Before writing new code, search the codebase for existing functions that do the same or similar thing. Use Grep/Glob. If an existing function does 80%+ of what you need, extend or reuse it — do NOT write a duplicate. This applies to: helper functions, validators, API clients, database queries, type definitions, constants.
