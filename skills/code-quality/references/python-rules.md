# Python-Specific Rules

Always loaded. These are non-negotiable for every Python file written or modified.

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

**Wrong (no Pydantic):**
```python
def create_order(data: dict) -> dict:
    # Is "email" present? Is it a string? Is it a valid email? Unknown.
    email = data.get("email", "")
    # Is "items" present? Is it a list? Does each item have a "book_id"?
    items = data.get("items", [])
    if not items:
        raise ValueError("No items")  # error message missing all context
    for item in items:
        qty = item.get("quantity", 0)  # silently defaulting garbage
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

**Forbidden (magic, vague, swallowing):**
```python
# Silently swallowing everything — never do this
try:
    process(data)
except:
    pass

# Catching Exception because you don't know what might fail
try:
    value = data["key"]
    parsed = int(value)
except Exception:
    parsed = 0  # what failed? why? the failure is now invisible

# Catching to paper over a missing type definition
try:
    email = request["email"]
except KeyError:  # use Pydantic instead — it tells you ALL missing fields at once
    email = ""
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

**Log levels and when to use each:**
```python
import logging
logger = logging.getLogger(__name__)

# DEBUG: internal state, detailed values — useful when troubleshooting
logger.debug("Calculating subtotal", extra={"items": len(order.items)})
logger.debug("Item price", extra={"sku": item.sku, "price": item.price, "qty": item.qty})

# INFO: completed operations, milestones — normal operational visibility
logger.info("Order created", extra={"order_id": result.id, "total": str(result.total)})
logger.info("Batch processed", extra={"records": count, "duration_s": elapsed})

# WARNING: recoverable issues, degraded operation — something's wrong but we're handling it
logger.warning("Cache miss, falling back to primary", extra={"key": cache_key})
logger.warning("Retry exhausted, proceeding without enrichment", extra={"attempts": n})

# ERROR: operation failed, process continues — needs attention
logger.error("Payment declined", extra={"order_id": oid, "reason": reason})

# CRITICAL: process cannot continue — wake someone up
logger.critical("Database unreachable, shutting down consumer", exc_info=True)
```

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

**Never:**
```python
print(f"Processing {order_id}")           # cannot be filtered, leveled, or formatted
print(f"Error: {e}")                      # goes to stdout, not stderr; no structured context
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

**Wrong (magic strings):**
```python
def categorize_age(age: int) -> str:
    if age < 18:
        return "minor"    # typo "minro" would compile and fail silently
    if age < 65:
        return "adult"    # these strings are scattered across the codebase
    return "senior"

# Caller:
if categorize_age(age) == "adlut":  # typo — always False, never caught
    ...
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

**Before (water):**
```python
def calculate_total(items):
    total = 0
    # iterate over all items
    for item in items:
        # add the price to total
        total = total + item.price  # price is in dollars
    # return the computed total
    return total
```

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
