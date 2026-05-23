# Design Principles

From *Software Design for Python Programmers* by Ronald Mak. Apply in order of priority. Each principle includes violation signals that MUST trigger a fix, and concrete before/after examples.

## 1. Single Responsibility Principle (SRP)

Each class and function MUST have exactly one reason to change. A cohesive class with a clear purpose is easy to use, test, and maintain.

**Violation signals:**
- A class with more than ~7 public methods
- A method over 30 lines
- Class name containing "And", "Manager", "Handler", "Processor", or "Utils"
- Instance variables used by only half the methods (split personality)
- A function that does computation AND I/O AND error handling
- Constructor that both initializes state AND connects to external services

**Before (SRP violation):**
```python
class OrderProcessor:
    def __init__(self):
        self.db = connect_db()
        self.email_client = SmtpClient()

    def process(self, order_data):
        # validate
        if not order_data.get("customer_email"):
            raise ValueError("missing email")
        # calculate
        total = sum(item["price"] * item["qty"] for item in order_data["items"])
        # persist
        self.db.execute("INSERT INTO orders ...")
        # notify
        self.email_client.send(order_data["customer_email"], f"Order confirmed, total: {total}")
```

**After (SRP applied):**
```python
class OrderValidator:
    def validate(self, data: dict) -> ValidatedOrder: ...

class PricingCalculator:
    def calculate(self, items: list[OrderItem]) -> Money: ...

class OrderRepository:
    def save(self, order: Order) -> OrderId: ...

class OrderNotifier:
    def send_confirmation(self, order: Order) -> None: ...

class CreateOrderUseCase:
    def __init__(self, validator, calculator, repo, notifier):
        self._validator = validator
        self._calculator = calculator
        self._repo = repo
        self._notifier = notifier

    def execute(self, request: CreateOrderRequest) -> OrderResult:
        validated = self._validator.validate(request)
        total = self._calculator.calculate(validated.items)
        order_id = self._repo.save(Order.from_validated(validated, total))
        self._notifier.send_confirmation(validated.email, order_id, total)
        return OrderResult(order_id=order_id, total=total)
```

**Fix:** Split along responsibility boundaries. Each extracted piece gets a name that describes its single job. The original class becomes an orchestrator that delegates.

## 2. Encapsulate What Varies Principle

Code that may change MUST be isolated from code that won't. When changes occur to encapsulated code, they don't leak out and force changes elsewhere.

**Violation signals:**
- A change to one class forces changes in another
- Multiple classes import the same implementation details
- Hardcoded values (thresholds, URLs, config) scattered across files
- Feature flags or configuration conditionals spread through business logic
- Algorithm choice (which payment gateway, which shipping method) hardcoded

**Before:**
```python
def calculate_shipping(order):
    if order.total > 100:
        return 0  # free shipping over $100
    if order.country == "US":
        return 5.99
    elif order.country == "CA":
        return 9.99
    else:
        return 14.99
```

**After:**
```python
class ShippingCalculator(ABC):
    @abstractmethod
    def calculate(self, order: Order) -> Money: ...

class FreeOverThreshold(ShippingCalculator):
    def __init__(self, threshold: Money, base_calculator: ShippingCalculator):
        self._threshold = threshold
        self._base = base_calculator

    def calculate(self, order: Order) -> Money:
        if order.total >= self._threshold:
            return Money.zero()
        return self._base.calculate(order)

# The shipping logic is now composable and each piece varies independently.
# Add a new shipping rule = add a new class, not edit existing code.
```

**Fix:** Create a dedicated class for the varying behavior. Inject it via constructor. The stable code depends only on the interface. New rules = new classes.

## 3. Principle of Least Knowledge (Law of Demeter)

A class MUST know as little as possible about other classes' implementations. Loose coupling means changes to one class don't ripple.

**Violation signals:**
- Method chains: `obj.a().b().c()` (train wreck)
- Accessing private members of another class (names starting with `_`)
- A function receives an object and immediately calls 5+ property getters on it
- Code that reaches through one object to call methods on another
- Tests that mock 3+ layers of dependencies

**Before (violation):**
```python
def format_invoice(order):
    # reaching through order to customer to address — 4 levels deep
    street = order.customer.address.street
    city = order.customer.address.city
    zip_code = order.customer.address.zip_code
    # reaching through order to its items to product names
    item_names = [item.product.name for item in order.items]
    ...
```

**After:**
```python
def format_invoice(order):
    # order provides what you need through its own interface
    shipping = order.shipping_label()   # "123 Main St, Springfield, 62701"
    item_list = order.item_descriptions()  # ["Widget (2x $5.00)", ...]
    ...
```

**Fix:** The called class should expose a single method that does the work. "Tell, don't ask." Delegate, don't dig.

## 4. Don't Repeat Yourself (DRY)

No duplicate code. Every piece of knowledge must have a single, unambiguous representation. Copy-paste is always wrong — it creates divergence and doubles maintenance burden.

**Violation signals:**
- Same 3+ lines appear in two places
- Similar `if/elif/else` chains in multiple functions
- Copy-pasted test setup across test files
- Two functions that differ only by a constant or a type
- Same validation logic in both API layer and service layer

**Before:**
```python
# In orders/service.py
if order.status == "pending":
    order.status = "confirmed"
    logger.info("Order confirmed", extra={"order_id": order.id})

# In payments/service.py
if payment.status == "pending":
    payment.status = "confirmed"
    logger.info("Payment confirmed", extra={"payment_id": payment.id})
```

**After:**
```python
# In shared/state_machine.py
def confirm(entity: HasStatus, entity_type: str) -> None:
    if entity.status != "pending":
        raise InvalidTransition(entity.status, "confirmed")
    entity.status = "confirmed"
    logger.info(f"{entity_type} confirmed", extra={f"{entity_type}_id": entity.id})
```

**Fix:** Extract shared code into a single function or class. Parameterize the differences. If the code is similar but not identical, find the abstraction that makes them the same.

## 5. Open-Closed Principle (OCP)

Classes MUST be open for extension but closed for modification. Closing a class to modification provides stability; opening for extension provides flexibility.

**Violation signals:**
- Adding a feature requires editing an existing class (not adding a new class)
- Long `match`/`if-elif` chains that dispatch on type, kind, or format
- A class that imports concrete subclasses to do type-specific work
- "Just add another elif" becoming the standard development pattern

**Before (OCP violation):**
```python
class ReportExporter:
    def export(self, data, format_type):
        if format_type == "pdf":
            return self._to_pdf(data)
        elif format_type == "csv":
            return self._to_csv(data)
        elif format_type == "xlsx":
            return self._to_xlsx(data)
        else:
            raise ValueError(f"Unknown format: {format_type}")
```

**After (OCP applied):**
```python
class ReportExporter(ABC):
    @abstractmethod
    def export(self, data: ReportData) -> bytes: ...

class PdfExporter(ReportExporter): ...
class CsvExporter(ReportExporter): ...
class XlsxExporter(ReportExporter): ...

class ExportRegistry:
    def __init__(self):
        self._exporters: dict[ExportFormat, ReportExporter] = {}

    def register(self, fmt: ExportFormat, exporter: ReportExporter):
        self._exporters[fmt] = exporter

    def export(self, fmt: ExportFormat, data: ReportData) -> bytes:
        return self._exporters[fmt].export(data)

# New format = new class + one register() call. No existing code modified.
```

**Fix:** Define a stable interface (ABC or Protocol). New behavior arrives as new classes implementing that interface. Register them via a factory or registry.

## 6. Code to the Interface Principle

Code MUST depend on abstractions, not concrete classes. This enables polymorphism to choose behavior at runtime instead of hardcoding decisions.

**Violation signals:**
- Variable typed as a concrete class instead of a Protocol/ABC
- `isinstance()` checks to decide behavior (ask the object, don't inspect it)
- Constructor creates concrete dependencies with `ClassName()` — no injection point
- Import of a concrete class from a different layer/module just to call one method
- Test that cannot swap a real database for an in-memory one

**Before:**
```python
class OrderService:
    def __init__(self):
        self._repo = PostgresOrderRepository()  # hardcoded concrete
        self._notifier = SmtpEmailNotifier()     # hardcoded concrete

    def create(self, request):
        order = Order.from_request(request)
        self._repo.save(order)
        self._notifier.send(order.customer_email, "Confirmed")
```

**After:**
```python
class OrderRepository(Protocol):
    def save(self, order: Order) -> OrderId: ...
    def find_by_id(self, id: OrderId) -> Order | None: ...

class Notifier(Protocol):
    def send(self, recipient: str, message: str) -> None: ...

class OrderService:
    def __init__(self, repo: OrderRepository, notifier: Notifier):
        self._repo = repo          # any implementation, as long as it follows the protocol
        self._notifier = notifier  # swappable for tests, different providers

    def create(self, request: CreateOrderRequest) -> OrderResult:
        ...
```

**Fix:** Define a Protocol or ABC. Inject the concrete implementation through the constructor. Let polymorphism decide behavior. Tests inject mocks; production injects real implementations.

## 7. Liskov Substitution Principle (LSP)

A subclass MUST be usable wherever its superclass is expected. After substituting, the program should run without errors — it may produce different but meaningful results.

**Violation signals:**
- A subclass overrides a method and raises `NotImplementedError` or `TypeError`
- A subclass changes the semantics of an inherited method (e.g., `add()` in subclass actually removes)
- `isinstance()` checks in caller code to special-case or work around a subclass
- Subclass constructor requires extra parameters that the superclass doesn't
- Subclass strengthens preconditions (accepts fewer inputs) or weakens postconditions (returns less)

**Before (LSP violation):**
```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

class Square(Rectangle):
    def __init__(self, side):
        super().__init__(side, side)

    # This violates LSP — setting width changes height silently
    @property
    def width(self):
        return self._width

    @width.setter
    def width(self, value):
        self._width = value
        self._height = value  # surprise! also changes height
```

**Fix:** If a subclass cannot fully substitute the superclass without surprises, it should not be a subclass. Use composition instead:
```python
class Square:
    def __init__(self, side):
        self._side = side
    # Square is NOT a Rectangle. Both could implement a Shape protocol.
```

## 8. Favor Composition over Inheritance

"HAS-A" relationships are usually better than "IS-A." Composition enables runtime flexibility; inheritance hardcodes behavior at compile time.

**Violation signals:**
- Deep inheritance chains (3+ levels deep)
- Subclasses that only add state (extra fields), not overridden behavior
- Subclasses that override most superclass methods
- Multiple inheritance with tangled method resolution order
- "Base" or "Abstract" classes that exist only to share utility methods (use a plain utility class instead)

**Before (over-inheritance):**
```python
class Vehicle:
    def move(self): ...

class Car(Vehicle):
    def move(self): return "driving"

class ElectricCar(Car):
    def move(self): return "driving silently"

class SelfDrivingElectricCar(ElectricCar):
    def move(self): return "driving itself silently"
# 4 levels deep. What happens when we need a self-driving gas car?
```

**After (composition):**
```python
class Engine(Protocol):
    def sound(self) -> str: ...

class GasEngine:
    def sound(self) -> str: return "vroom"

class ElectricEngine:
    def sound(self) -> str: return "..."

class Driver(Protocol):
    def operate(self) -> str: ...

class HumanDriver:
    def operate(self) -> str: return "driving"

class AIDriver:
    def operate(self) -> str: return "driving itself"

class Car:
    def __init__(self, engine: Engine, driver: Driver):
        self._engine = engine
        self._driver = driver

    def move(self) -> str:
        return f"{self._driver.operate()} {self._engine.sound()}"
# Any engine + driver combination works. No deep hierarchy needed.
```

**Fix:** Replace inheritance with composition. The former subclass holds an instance of a collaborator and delegates to it. Behaviors become swappable plugins.

## 9. Principle of Least Astonishment

Code MUST NOT surprise its users. A function should do exactly what its name says — nothing more, nothing less.

**Violation signals:**
- A function named `get_x` modifies state (should be `fetch_and_cache_x` or similar)
- A function returns `None` without the name indicating it — use `find_` or `maybe_`
- Off-by-one errors (month 1 maps to index 0 internally)
- Function does more than its name suggests (e.g., `validate_email` also sends a verification email)
- Boolean parameter that radically changes behavior (`process(order, True)` — what does True mean?)
- Return type differs based on input values ("sometimes returns list, sometimes returns dict")

**Before:**
```python
def get_user(email):
    user = db.query("SELECT * FROM users WHERE email = ?", email)
    db.execute("UPDATE users SET last_accessed = NOW() WHERE email = ?", email)  # surprise!
    return user

def process(items, mode):
    if mode:
        return [item.name for item in items]   # returns list of strings
    return {item.id: item.name for item in items}  # returns dict — caller must handle both
```

**After:**
```python
def find_user(email: str) -> User | None:  # name says it might not find
    ...

def record_access(user: User) -> None:  # separate function for the side effect
    ...

def list_item_names(items: list[Item]) -> list[str]:  # always returns list
    ...

def index_items_by_id(items: list[Item]) -> dict[int, str]:  # always returns dict
    ...
```

**Fix:** Name functions for exactly what they do. If it has side effects, the name says so. If it can return `None`, use `Optional[]` and a name like `find_` or `maybe_`. Split functions that do multiple things.

## 10. Lazy Evaluation Principle

Defer expensive work until the result is actually needed. This improves performance by preventing unnecessary calculations and memory allocation.

**Violation signals:**
- Constructor does heavy computation that might never be needed
- A property getter recalculates the same value on every access (no caching)
- Data loaded eagerly when only a subset is used
- Expensive object created inside a loop but only conditionally used
- Entire file parsed when only the header is needed

**Before:**
```python
class Report:
    def __init__(self, data_source: str):
        self._all_rows = self._parse_csv(data_source)  # 10M rows, parsed eagerly
        self._summary = self._compute_summary(self._all_rows)  # expensive, might not be used

    @property
    def summary(self):
        return self._summary

    @property
    def total_rows(self):
        return len(self._all_rows)
```

**After:**
```python
class Report:
    def __init__(self, data_source: str):
        self._source = data_source
        self._rows: list[Row] | None = None
        self._summary: Summary | None = None

    @property
    def rows(self) -> list[Row]:
        if self._rows is None:
            self._rows = self._parse_csv(self._source)  # only parse when first accessed
        return self._rows

    @property
    def summary(self) -> Summary:
        if self._summary is None:
            self._summary = self._compute_summary(self.rows)  # deferred + cached
        return self._summary
```

**Fix:** Cache computed values on first access. Load data lazily. Use generators for large sequences (`yield` instead of building a full list). Only compute what's asked for.

## 11. Class Invariant, Precondition, and Postcondition Principles

- **Precondition:** What MUST be true before calling a function. Caller's responsibility to ensure.
- **Postcondition:** What MUST be true after the function returns. Function's responsibility to ensure.
- **Class Invariant:** What MUST remain true for every object across all state changes after construction.

**Violation signals:**
- A function validates arguments that the caller should have validated (defensive validation where contract would suffice)
- An object can be constructed in an invalid state
- A setter allows invalid state transitions
- A public method is called and the object ends up in a corrupted state

**Example with contracts:**
```python
class BankAccount:
    def __init__(self, account_id: str, initial_balance: Money):
        assert initial_balance >= Money.zero(), "Cannot open with negative balance"
        self._id = account_id
        self._balance = initial_balance
        self._closed = False
        assert self._invariant()  # check after construction

    def _invariant(self) -> bool:
        """Balance must never be negative while account is open."""
        return self._closed or self._balance >= Money.zero()

    def withdraw(self, amount: Money) -> None:
        # Precondition: caller ensures account is open and has sufficient funds
        assert not self._closed, "Cannot withdraw from closed account"
        assert amount <= self._balance, f"Insufficient funds: {self._balance} < {amount}"
        self._balance -= amount
        assert self._invariant()  # postcondition: invariant still holds

    def deposit(self, amount: Money) -> None:
        assert not self._closed
        assert amount > Money.zero()
        self._balance += amount
        assert self._invariant()
```

**Fix:** Document preconditions with `assert` or explicit checks at function entry. Validate postconditions (especially invariants) before return. Check class invariants after construction and in every method that mutates state. In production, convert assertions to proper exceptions or logging.

## 12. Delegation Principle

A class MUST delegate tasks to another class better suited to perform them. The delegating class should have no knowledge of how the delegate does the work.

**Violation signals:**
- A class doing work that clearly belongs to another cohesive class
- Methods that reach into another object's data to do work on its behalf
- "Manager" classes that do everything themselves instead of asking the right object
- A service that directly manipulates another service's data structures

**Before:**
```python
class OrderService:
    def calculate_tax(self, order):
        # OrderService shouldn't know tax rules — that's TaxCalculator's job
        if order.state == "CA":
            return order.subtotal * 0.0725
        elif order.state == "NY":
            return order.subtotal * 0.04
        ...
```

**After:**
```python
class TaxCalculator(Protocol):
    def calculate(self, order: Order) -> Money: ...

class OrderService:
    def __init__(self, tax_calculator: TaxCalculator):
        self._tax = tax_calculator

    def create_order(self, request):
        ...
        tax = self._tax.calculate(order)  # delegate to the expert
        ...
```

**Fix:** Move the work into the class that owns the data or has the expertise. The original class calls the delegate's method. "I have a tax question — let me ask the tax expert."

## 13. Factory Principle

Encapsulate object creation in a dedicated factory function or method. The caller doesn't need to know which concrete class to instantiate.

**Violation signals:**
- `if/elif` chains that return different concrete types scattered through the codebase
- Caller code that directly calls `SomeConcreteClass()` to create a dependency
- Object creation logic duplicated in 3+ places
- Adding a new variant requires finding all the creation sites

**Before:**
```python
def create_notifier(method: str) -> object:
    if method == "email":
        return EmailNotifier(smtp_host=os.environ["SMTP_HOST"])
    elif method == "slack":
        return SlackNotifier(webhook_url=os.environ["SLACK_WEBHOOK"])
    elif method == "sms":
        return SmsNotifier(api_key=os.environ["SMS_API_KEY"])

# This same if-elif appears in three other files.
```

**After:**
```python
class NotifierFactory:
    def __init__(self):
        self._registry: dict[str, Callable[[], Notifier]] = {}

    def register(self, method: str, factory: Callable[[], Notifier]):
        self._registry[method] = factory

    def create(self, method: str) -> Notifier:
        if method not in self._registry:
            raise UnknownNotifierMethod(method)
        return self._registry[method]()

# Registration happens once at startup:
factory = NotifierFactory()
factory.register("email", lambda: EmailNotifier(config.smtp_host))
factory.register("slack", lambda: SlackNotifier(config.slack_webhook))
factory.register("sms", lambda: SmsNotifier(config.sms_api_key))
```

**Fix:** Create a factory class with a registry. Callers pass a key; factory returns the right concrete object. Registration happens once at composition root. Adding a new variant = one new class + one register call.
