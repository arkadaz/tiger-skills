# Python-Specific Rules

Always loaded. These are non-negotiable for every Python file written or modified.

## Naming Conventions (Capital Rule)

All configuration keys, module-level constants, and enum members MUST use proper casing:

| What | Convention | Example |
|------|-----------|---------|
| Config/env keys | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`, `JWT_SECRET`, `MAX_RETRIES` |
| Module constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_PAGE_SIZE = 20` |
| Enum members | `SCREAMING_SNAKE_CASE` | `OrderStatus.PENDING_CONFIRMATION` |
| Class names | `PascalCase` | `CreateOrderRequest`, `EmailNotifier` |
| Functions/methods | `snake_case` | `def calculate_total(self) -> Money:` |
| Variables/attributes | `snake_case` | `user_count = len(users)`, `self.password_hash` |

**Never:** `camelCase` in Python, config keys in lowercase, magic strings where enums exist, leading-underscore variables (`_xxx`). Python's privacy model is by convention and module structure, not by `_` prefix. Use plain `snake_case` for all attributes — `self.observers`, not `self._observers`.

## No Bare Generics

Every `dict`, `list`, `set`, `tuple` in a type annotation MUST be parameterized. Bare generics erase the type information that mypy, Pydantic, and human readers depend on.

**Always parameterize:**
```python
# Wrong — bare generics tell you nothing about contents
brief: dict
items: list
tags: set
coordinates: tuple
config: dict

# Correct — parameterized generics are self-documenting
brief: dict[str, str | int]
items: list[OrderItem]
tags: set[str]
coordinates: tuple[float, float]
config: dict[str, Any]
```

**For complex structures, use domain types instead of nested generics:**
```python
# Wrong — nested bare or complex generics
users: list[dict]
response: dict[str, list[dict[str, Any]]]

# Correct — domain types replace nested generics
users: list[UserSummary]
response: PaginatedResponse[UserSummary]
```

**Rule:** If you write a bare `dict`, `list`, `set`, or `tuple` without `[...]`, it's a violation. No exceptions. `mypy --strict` enforces this — the skill enforces it at review time too.

## Pydantic for All I/O Boundaries

Every function receiving data from outside the process MUST use Pydantic models. This applies to:
- API request/response bodies (FastAPI, Flask, Django views)
- File parsing (JSON, YAML, TOML, CSV with headers, XML)
- Database query results being passed between layers
- Message queue payloads (Kafka, RabbitMQ, SQS)
- Environment variable and CLI argument parsing
- Webhook payloads from external services

**Why:** Invalid data must fail at the boundary — immediately, with a clear error — not deep in business logic where the original context is lost and debugging requires tracing back through the call stack.

**Correct (Pydantic at boundary):**
```python
from pydantic import BaseModel, EmailStr, PositiveInt, field_validator

class BookOrderItem(BaseModel):
    book_id: str
    quantity: PositiveInt

class ShippingAddress(BaseModel):
    street: str
    city: str
    state: str
    zip_code: str

    @field_validator("zip_code")
    @classmethod
    def valid_zip(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 5:
            raise ValueError("ZIP must be 5 digits")
        return v

class CreateBookOrderRequest(BaseModel):
    customer_name: str
    customer_email: EmailStr           # validates email format automatically
    items: list[BookOrderItem]
    shipping_address: ShippingAddress
    promo_code: str | None = None

    @field_validator("items")
    @classmethod
    def not_empty(cls, v: list[BookOrderItem]) -> list[BookOrderItem]:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v

# Boundary function — Pydantic has already validated everything
def create_order(request: CreateBookOrderRequest) -> OrderResult:
    # No None checks, no type checks, no missing-key handling needed.
    # request.customer_email is guaranteed to be a valid email string.
    ...
```

**At which layer:** The boundary is the outermost layer that touches external data. In FastAPI, the framework does this automatically when you annotate with Pydantic. In a script reading JSON, it's the first function after `json.load()`. In a message consumer, it's the first function after deserializing the message body.

## No Magic Try/Except

Every `try/except` block MUST have:
1. A specific exception type (never bare `except:`, never `except Exception:`)
2. A specific, documented reason for catching it

If you're catching an exception because you're unsure what type or shape the data has — STOP. Define the type with Pydantic first. The uncertainty is a symptom of missing type information, not a reason to add error handling.

**Allowed (specific, justified):**
```python
# Specific external failure with a specific recovery
try:
    response = requests.get(url, timeout=5)
except requests.Timeout:
    logger.warning("Upstream timed out, using cached data", extra={"url": url})
    return cached_data

# Parsing known-untrustworthy input at the boundary
try:
    parsed = json.loads(raw_body)
except json.JSONDecodeError:
    raise HTTPException(status_code=400, detail="Invalid JSON body")

# Retry with backoff for transient failures
try:
    result = db.execute(query)
except DatabaseConnectionError:
    logger.warning("DB connection lost, retrying", exc_info=True)
    time.sleep(1)
    result = db.execute(query)
```

**Alternatives to try/except:**
- Instead of `try: d["key"] except KeyError`: use `d.get("key")` or Pydantic model
- Instead of `try: int(s) except ValueError`: validate before conversion, or use Pydantic
- Instead of `try: obj.method() except AttributeError`: use `hasattr()` or a Protocol
- Instead of `try: import foo except ImportError`: handle at startup, not per-call

## Logging Rules

Use Python's `logging` module. Never `print()`.

**Why:** `print()` goes to stdout and cannot be filtered, leveled, formatted, or redirected without changing code. `logging` supports all of these via configuration — no code changes needed when you move from dev to production.

**Every function crossing a system boundary MUST log:**
- **Entry:** function name + key input values (never log secrets, passwords, or tokens)
- **Exit:** function name + result summary + elapsed time if >1 second
- **Every state-changing branch:** what changed, why, and under what conditions

**Correct (structured logging with extra context):**
```python
import logging
import time

logger = logging.getLogger(__name__)

def process_order(order_id: str) -> OrderResult:
    start = time.monotonic()
    logger.info("Processing order", extra={"order_id": order_id})

    order = find_order(order_id)
    if order is None:
        logger.error("Order not found", extra={"order_id": order_id})
        raise OrderNotFound(order_id)

    if order.status == "cancelled":
        logger.warning("Skipping cancelled order", extra={"order_id": order_id})
        return OrderResult.skipped(order_id)

    result = _fulfill(order)
    elapsed = time.monotonic() - start
    logger.info("Order processed",
                extra={"order_id": order_id, "status": result.status, "elapsed_s": round(elapsed, 3)})
    return result
```

## Enum for Known Value Sets

When a variable can only take one of a known, fixed set of values, use `enum.Enum`. Never use magic strings or bare integers.

**Applies to:** status codes, categories, types, states, roles, levels, modes, priorities, and any other discriminant that drives branching logic.

**Why:**
- Typos in magic strings are runtime errors caught too late (or silently produce wrong results)
- The type checker can verify exhaustiveness in `match` statements
- Invalid states become unrepresentable — you literally cannot create an invalid value
- Renaming is safe (IDE refactoring) vs. find-and-replace on strings
- Self-documenting — reading the Enum tells you all possible values

**Correct:**
```python
from enum import Enum

class OrderStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class AgeCategory(Enum):
    MINOR = "minor"
    ADULT = "adult"
    SENIOR = "senior"

def categorize_age(age: int) -> AgeCategory:
    if age < 18:
        return AgeCategory.MINOR
    if age < 65:
        return AgeCategory.ADULT
    return AgeCategory.SENIOR

# Type checker verifies exhaustiveness:
def status_description(status: OrderStatus) -> str:
    match status:
        case OrderStatus.PENDING:    return "Awaiting confirmation"
        case OrderStatus.CONFIRMED:  return "Order confirmed"
        case OrderStatus.SHIPPED:    return "In transit"
        case OrderStatus.DELIVERED:  return "Delivered"
        case OrderStatus.CANCELLED:  return "Cancelled"
        # Type checker warns if any case is missing — no default needed
```

**Also applies to function parameters:**
```python
# Wrong
def send_notification(user_id: str, channel: str):  # "channel" is "email" or "sms" or "push"?
    ...

# Correct
class NotificationChannel(Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

def send_notification(user_id: str, channel: NotificationChannel):
    ...
```

## Lint and Type-Check on Every Change

After every implementation step, run both checks. Never leave errors behind.

**If the project has configured tools, use those. If not, default to:**
- Lint: `ruff check src/`
- Type check: `mypy src/ --strict`

**Commitment:** A clean lint + type-check run is part of the minimum bar for "done." You don't proceed to testing until these pass. You don't commit until these pass.

## No Water Code

Every line MUST carry its weight. Delete ruthlessly.

**Delete on sight:**
- Comments that restate what the code says: `# increment i` next to `i += 1`
- Unused imports, variables, parameters, and functions
- Dead `else` branches after `return` or `raise` (the `else` is unreachable or redundant)
- Intermediate variables used exactly once, unless they clarify a genuinely complex expression
- Getters/setters that just read/write a private field with zero validation or logic — use a plain attribute or `@dataclass`
- `__init__` methods that only assign parameters to same-named attributes — use `@dataclass` or Pydantic
- Empty `__init__`, empty `pass` blocks, TODO comments from 3 months ago
- `assert False, "unreachable"` — if it's unreachable, type-checker should prove it

**After (no water):**
```python
def calculate_total(items: list[Item]) -> Money:
    return sum(item.price for item in items)
```

## Explore Before Implementing

Before writing ANY new code:
1. Use Grep to search for the function name or key terms
2. Use Glob to find files in the relevant module
3. Read the files you find
4. If an existing function does 80%+ of what you need, extend or reuse it

**Do NOT create:** a second `validate_email()`, a second `parse_date()`, a second `build_query()`, or a second constant definition. Duplication is worse than a mildly awkward reuse.

## Project Structure

Every Python project MUST follow this structure. The separation of concerns is enforced at the directory level — code in one layer must not cross boundaries into another.

### Required Directory Layout

Every Python project MUST follow a layered structure. The specific layer names adapt to the project type, but the separation principle is universal: code flows inward through layers, never outward, never skipping.

**API / Backend:**
```
project/
├── src/{api,services,repositories,models,core,middleware,utils}/
├── tests/{unit,integration,e2e}/
├── docs/{business,specs,reviews}/
├── AGENTS.md, PROGRESS.md, GRAPH.md, codebase-map.md
├── Makefile, pyproject.toml, .env.example
```

**CLI Tool:**
```
project/
├── src/{commands,services,repositories,models,core,utils}/
├── tests/{unit,integration}/
├── docs/{business,specs,reviews}/
├── AGENTS.md, PROGRESS.md, GRAPH.md, codebase-map.md
├── Makefile, pyproject.toml, .env.example
```

**Library / SDK:**
```
project/
├── src/<package_name>/{_internal,models}/
├── src/<package_name>/__init__.py (empty), py.typed
├── tests/{unit,integration}/
├── docs/{business,specs,reviews}/
├── AGENTS.md, PROGRESS.md, GRAPH.md, codebase-map.md
├── Makefile, pyproject.toml
```

**Data Pipeline / Worker:**
```
project/
├── src/{pipelines,extractors,transformers,loaders,models,core,utils}/
├── tests/{unit,integration}/
├── docs/{business,specs,reviews}/
├── AGENTS.md, PROGRESS.md, GRAPH.md, codebase-map.md
├── Makefile, pyproject.toml, .env.example
```

### Universal Rules (All Project Types)

1. **Config is centralized.** `src/core/config.py` (pydantic-settings) is the ONLY file that reads env vars. Config values flow inward via constructor injection.
2. **Layers are one-way.** Imports flow inward. Outer layers import from inner layers. Inner layers NEVER import from outer layers.
3. **Domain code is isolated.** `models/` has ZERO imports from `api/`, `services/`, `repositories/`, `commands/`, `pipelines/`. It depends on `utils/` only.
4. **Utils has zero business logic.** If a function knows about "orders" or "users," it does not belong in `utils/`.
5. **Every directory is a package.** Every `src/` subdirectory has `__init__.py`. **`__init__.py` must be empty** — no re-exports, no `__all__`, no code. Imports use the full module path.
6. **Tests mirror source.** `tests/unit/services/test_auth_service.py` for `src/services/auth_service.py`.
7. **Docs are mandatory.** `docs/` with business rules, specs, GRAPH.md, and codebase-map.md. Not optional.

### Layer Rules (API/Backend Example)

| Layer | Allowed Imports | Forbidden Imports |
|-------|----------------|-------------------|
| **api/** | services/, models/, core/, utils/ | repositories/ (go through services) |
| **services/** | repositories/, models/, core/, utils/ | api/ (services don't know about HTTP) |
| **repositories/** | models/, core/, utils/ | api/, services/ |
| **models/** | utils/ only | api/, services/, repositories/, core/ |
| **core/** | utils/ only | everything else |
| **utils/** | nothing from src/ | everything else |

**The dependency rule (all project types):** Dependencies flow inward. The outermost layer (api/commands/pipelines) depends on the inner layers (services/extractors). The innermost layer (models/) depends on nothing. No layer skips inward. No layer reaches outward.

**Why this matters (any project type):**
- Swap the entry point (FastAPI → Flask → CLI) without touching business logic
- Swap the data layer (PostgreSQL → MongoDB → flat files) without touching business logic
- Test business logic without any I/O
- New developers (and agents) know exactly where to find code immediately

### What Goes Where — Universal

| If you're writing... | It goes in... |
|---------------------|---------------|
| Entry point (HTTP route, CLI command, pipeline step) | api/, commands/, pipelines/ |
| I/O contract (Pydantic request/response model, CLI args schema) | Same file as the entry point |
| Business rule ("an order over $50 gets free shipping") | services/ |
| Orchestration ("create order: validate → price → save → notify") | services/ |
| Data access (database query, API call, file read/write) | repositories/ |
| Domain model (User, Order, Product) | models/ |
| Enum (OrderStatus, UserRole, Priority) | models/ |
| Value object (Money, Email, Address) | models/ |
| Config (env vars, settings, feature flags) | core/config.py ONLY |
| Database connection (engine, session, pool) | core/database.py ONLY |
| Logging setup | core/logging.py ONLY |
| Exception handlers (domain error → HTTP response) | core/exceptions.py |
| Shared error types (domain exceptions) | models/ or core/exceptions.py |
| Cross-cutting HTTP processing (auth, CORS, timing) | middleware/ |
| Pure helper (date format, string manipulation, math) | utils/ |

### Anti-Pattern — Wrong Layout

```
# DON'T DO THIS:
project/
├── app.py           # everything in one file
├── models.py        # all models dumped together regardless of domain
├── utils.py         # "the drawer where everything goes"
├── helpers.py       # same problem, different name
└── constants.py     # magic values without domain context
```

### Init Files

Every directory under `src/` and `tests/` MUST have an `__init__.py`. Every `__init__.py` MUST be empty — no imports, no re-exports, no `__all__`, no code. Use full module paths for imports: `from src.services.order_service import OrderService`, not `from src.services import OrderService`.

### Config Management

Every project MUST have a single source of truth for configuration. Never scatter `os.environ` calls or hardcoded values across the codebase.

**Correct (pydantic-settings):**
```python
# src/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    app_name: str = "book-store-api"
    debug: bool = False
    port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/bookstore"

    # Auth
    jwt_secret: str  # required — no default, must be set in .env
    jwt_expiry_minutes: int = 60
    password_min_length: int = 8

    # External services
    sendgrid_api_key: str = ""
    stripe_secret_key: str = ""
    redis_url: str = "redis://localhost:6379/0"


# Single instance — imported ONCE at app startup, injected everywhere else
settings = Settings()
```

**Config injection pattern — never import settings globally in business logic:**
```python
# src/services/password_service.py
class PasswordService:
    def __init__(self, min_length: int) -> None:  # config injected, not imported
        self.min_length = min_length

    def validate_strength(self, password: str) -> PasswordValidationResult:
        if len(password) < self.min_length:  # uses injected value
            ...

# src/main.py — wiring at composition root
from src.core.config import settings
from src.services.password_service import PasswordService

password_service = PasswordService(min_length=settings.password_min_length)
```

**Required files for config:**
- `src/core/config.py` — Settings model (pydantic-settings)
- `src/core/__init__.py` — empty (package marker only)
- `.env.example` — all required vars documented, no real secrets committed
- `.env` — real values (in .gitignore — NEVER committed)

### Core Module

The `src/core/` directory holds application-wide infrastructure:

```
src/core/
├── __init__.py
├── config.py       — pydantic-settings Settings model
├── database.py     — SQLAlchemy engine + session factory (if using DB)
├── logging.py      — logging configuration (structlog setup, level, format)
└── exceptions.py   — shared exception handlers (FastAPI exception handlers)
```

**Rules for src/core/:**
- `config.py` is the ONLY file that reads environment variables
- All other modules receive config values via constructor injection
- `database.py` owns the DB connection lifecycle
- `logging.py` configures logging ONCE at startup
- `exceptions.py` maps domain exceptions to HTTP responses

### New Project Bootstrap

When starting a new Python project, create this structure BEFORE writing any business code:

```bash
mkdir -p src/{api,services,repositories,models,middleware,utils}
mkdir -p tests/{unit,integration,e2e}
mkdir -p docs/{business,specs,reviews}
touch src/{api,services,repositories,models,middleware,utils}/__init__.py
touch tests/{unit,integration,e2e}/__init__.py
```

