# Python Code Examples

Concrete Python examples for each design principle and pattern. Load with [design-principles.md](../design-principles.md) and [design-patterns.md](../design-patterns.md).

## SRP

```python
# VIOLATION — one class does validation, pricing, persistence, notification
class OrderProcessor:
    def __init__(self):
        self.db = connect_db()
        self.email_client = SmtpClient()
    def process(self, data):
        total = sum(item["price"] * item["qty"] for item in data["items"])
        self.db.execute("INSERT INTO orders ...")
        self.email_client.send(data["email"], f"Total: {total}")

# FIX — split into single-responsibility classes
class OrderValidator:
    def validate(self, data: dict) -> ValidatedOrder: ...
class PricingCalculator:
    def calculate(self, items: list[OrderItem]) -> Money: ...
class OrderRepository:
    def save(self, order: Order) -> OrderId: ...
class OrderNotifier:
    def send_confirmation(self, order: Order) -> None: ...
class CreateOrderUseCase:
    def __init__(self, validator, calculator, repo, notifier): ...
    def execute(self, request): ...  # orchestrates, one responsibility
```

## OCP

```python
# VIOLATION — if-elif chain, edit existing class for each new format
class ReportExporter:
    def export(self, data, format_type):
        if format_type == "pdf": return self._to_pdf(data)
        elif format_type == "csv": return self._to_csv(data)

# FIX — trait + registry, new format = new class + one register()
class ReportExporter(ABC):
    @abstractmethod
    def export(self, data: ReportData) -> bytes: ...
class PdfExporter(ReportExporter): ...
class CsvExporter(ReportExporter): ...
class ExportRegistry:
    def __init__(self): self._exporters: dict[str, ReportExporter] = {}
    def register(self, fmt: str, exporter: ReportExporter): ...
    def export(self, fmt: str, data: ReportData) -> bytes: ...
```

## Composition over Inheritance

```python
# VIOLATION — deep inheritance, 4 levels
class Vehicle: ...
class Car(Vehicle): ...     # level 1
class ElectricCar(Car): ... # level 2
class SelfDrivingCar(ElectricCar): ... # level 3 — what about self-driving gas car?

# FIX — composition, behaviors are swappable
class Engine(Protocol):
    def sound(self) -> str: ...
class Driver(Protocol):
    def operate(self) -> str: ...
class Car:
    def __init__(self, engine: Engine, driver: Driver): ...
    def move(self) -> str: return f"{self._driver.operate()} {self._engine.sound()}"
```

## Factory

```python
class NotifierFactory:
    def __init__(self): self._registry: dict[str, Callable[[], Notifier]] = {}
    def register(self, method: str, factory: Callable[[], Notifier]): ...
    def create(self, method: str) -> Notifier: ...

# Registration at composition root:
factory = NotifierFactory()
factory.register("email", lambda: EmailNotifier(config.smtp_host))
factory.register("slack", lambda: SlackNotifier(config.slack_webhook))
```

## Strategy Pattern

```python
class PricingStrategy(ABC):
    @abstractmethod
    def calculate(self, items: list[Item]) -> Money: ...
class RegularPricing(PricingStrategy): ...
class BulkDiscountPricing(PricingStrategy): ...
class SeasonalPricing(PricingStrategy): ...

class OrderService:
    def __init__(self, pricing: PricingStrategy): ...  # inject, swap at runtime
```

## Adapter Pattern

```python
# External library has incompatible interface
class ThirdPartyLogger:
    def write_entry(self, severity: int, text: str): ...

# Adapter translates
class ThirdPartyLoggerAdapter:
    def __init__(self, adaptee: ThirdPartyLogger): self._adaptee = adaptee
    def info(self, msg: str): self._adaptee.write_entry(1, msg)
    def error(self, msg: str): self._adaptee.write_entry(4, msg)
```

## Observer Pattern

```python
class Subject:
    def __init__(self): self._observers: list[Observer] = []
    def attach(self, obs): self._observers.append(obs)
    def _notify(self, data):
        for obs in self._observers: obs.update(data)

class Observer(ABC):
    @abstractmethod
    def update(self, data): ...
```

## State Pattern

```python
class TicketMachine:
    def __init__(self): self._state: State = Ready()
    def insert_card(self): self._state = self._state.insert_card()

class State(ABC):
    @abstractmethod
    def insert_card(self) -> "State": ...
class Ready(State):
    def insert_card(self) -> State: return Validating()
```

## Decorator Pattern

```python
class Ticket(ABC):
    @abstractmethod
    def cost(self) -> Money: ...

class BaseTicket(Ticket):
    def cost(self): return Money(30)

class Enhancement(Ticket):
    def __init__(self, ticket: Ticket, name: str, price: Money):
        self._ticket = ticket; self._price = price
    def cost(self): return self._price + self._ticket.cost()

class VIPSeating(Enhancement):
    def __init__(self, ticket): super().__init__(ticket, "VIP", Money(20))

# Usage: ticket = VIPSeating(DrinkCoupon(BaseTicket()))
```

## Template Method

```python
class GameReport(ABC):
    def generate(self):  # template — fixed order
        self._print_header(); self._acquire_data(); self._analyze_data()
        self._print_body(); self._print_footer()
    def _print_header(self): ...   # common
    @abstractmethod
    def _acquire_data(self): pass  # varies per subclass
```

## Iterator

```python
class Iterator(ABC):
    @abstractmethod
    def next(self) -> object: ...
    @abstractmethod
    def has_next(self) -> bool: ...
class ListIterator(Iterator): ...
class DictIterator(Iterator): ...

def print_all(it: Iterator):
    while it.has_next(): print(it.next())
```

## Composite

```python
class Provision(ABC):
    @abstractmethod
    def cost(self) -> Money: ...
class Item(Provision):  # Leaf
    def cost(self): return self._price
class Group(Provision):  # Composite
    def cost(self): return sum(item.cost() for item in self._items)
```

## Singleton

```python
class ExecutivePass:
    _instance: "ExecutivePass | None" = None
    @classmethod
    def obtain(cls, holder: str) -> "ExecutivePass":
        if cls._instance is None: cls._instance = super().__new__(cls)
        return cls._instance
    def __new__(cls): raise NotImplementedError("Use obtain()")
    def __copy__(self): raise NotImplementedError
```

## Abstract Factory

```python
class UIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...
class MacFactory(UIFactory):
    def create_button(self): return MacButton()
class WindowsFactory(UIFactory):
    def create_button(self): return WindowsButton()
# One factory = one family. No cross-family mixing.
```

## Facade

```python
class PaymentFacade:
    def __init__(self):
        self._validator = CardValidator(); self._gateway = PaymentGateway()
        self._fraud = FraudDetector(); self._receipt = ReceiptGenerator()
    def charge(self, card, amount) -> PaymentResult:
        self._validator.validate(card)
        txn = self._gateway.process(card, amount)
        return PaymentResult(txn, self._receipt.generate(txn))
```

## Visitor

```python
class Node(ABC):
    @abstractmethod
    def accept(self, visitor: "Visitor"): ...
class Intramural(Node):
    def accept(self, visitor): visitor.visit_intramural(self)
class Visitor(ABC):
    @abstractmethod
    def visit_intramural(self, node): ...
class ScoresReport(Visitor):
    def visit_intramural(self, node): print("SCORES REPORT")
```
