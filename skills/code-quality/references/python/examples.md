# Python Code Examples

Concrete Python examples for each design principle and pattern. Load with [design-principles.md](../design-principles.md) and [design-patterns.md](../design-patterns.md).

## SRP

```python
class OrderValidator:
    def validate(self, request: CreateOrderRequest) -> ValidatedOrder: ...
class PricingCalculator:
    def calculate(self, items: list[OrderItem]) -> Money: ...
class OrderRepository:
    def save(self, order: Order) -> OrderId: ...
class OrderNotifier:
    def send_confirmation(self, order: Order) -> None: ...
class CreateOrderUseCase:
    def __init__(self, validator: OrderValidator, calculator: PricingCalculator,
                 repo: OrderRepository, notifier: OrderNotifier) -> None: ...
    def execute(self, request: CreateOrderRequest) -> OrderResult: ...
```

## OCP

```python
class ExportFormat(Enum):
    PDF = "pdf"
    CSV = "csv"

class ReportExporter(ABC):
    @abstractmethod
    def export(self, data: ReportData) -> bytes: ...
class PdfExporter(ReportExporter): ...
class CsvExporter(ReportExporter): ...
class ExportRegistry:
    def __init__(self) -> None: self.exporters: dict[ExportFormat, ReportExporter] = {}
    def register(self, fmt: ExportFormat, exporter: ReportExporter) -> None: ...
    def export(self, fmt: ExportFormat, data: ReportData) -> bytes: ...
```

## Composition over Inheritance

```python
class Engine(Protocol):
    def sound(self) -> str: ...
class Driver(Protocol):
    def operate(self) -> str: ...
class Car:
    def __init__(self, engine: Engine, driver: Driver) -> None: ...
    def move(self) -> str: return f"{self.driver.operate()} {self.engine.sound()}"
```

## Factory

```python
class NotificationMethod(Enum):
    EMAIL = "email"
    SLACK = "slack"

class NotifierFactory:
    def __init__(self) -> None: self.registry: dict[NotificationMethod, Callable[[], Notifier]] = {}
    def register(self, method: NotificationMethod, factory: Callable[[], Notifier]) -> None: ...
    def create(self, method: NotificationMethod) -> Notifier: ...

factory = NotifierFactory()
factory.register(NotificationMethod.EMAIL, lambda: EmailNotifier(config.smtp_host))
factory.register(NotificationMethod.SLACK, lambda: SlackNotifier(config.slack_webhook))
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
    def __init__(self, pricing: PricingStrategy) -> None: ...
```

## Adapter Pattern

```python
class ThirdPartyLogger:
    def write_entry(self, severity: int, text: str) -> None: ...

class ThirdPartyLoggerAdapter:
    def __init__(self, adaptee: ThirdPartyLogger) -> None: self.adaptee = adaptee
    def info(self, msg: str) -> None: self.adaptee.write_entry(1, msg)
    def error(self, msg: str) -> None: self.adaptee.write_entry(4, msg)
```

## Observer Pattern

```python
class Subject:
    def __init__(self) -> None: self.observers: list[Observer] = []
    def attach(self, obs: Observer) -> None: self.observers.append(obs)
    def notify(self, event: Event) -> None:
        for obs in self.observers: obs.update(event)

class Observer(ABC):
    @abstractmethod
    def update(self, event: Event) -> None: ...
```

## State Pattern

```python
class TicketMachine:
    def __init__(self) -> None: self.state: State = Ready()
    def insert_card(self) -> None: self.state = self.state.insert_card()

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
    def cost(self) -> Money: return Money(30)

class Enhancement(Ticket):
    def __init__(self, ticket: Ticket, name: str, price: Money) -> None:
        self.ticket = ticket; self.price = price
    def cost(self) -> Money: return self.price + self.ticket.cost()

class VIPSeating(Enhancement):
    def __init__(self, ticket: Ticket) -> None: super().__init__(ticket, "VIP", Money(20))
```

## Template Method

```python
class GameReport(ABC):
    def generate(self) -> None:
        self.print_header(); self.acquire_data(); self.analyze_data()
        self.print_body(); self.print_footer()
    def print_header(self) -> None: ...
    @abstractmethod
    def acquire_data(self) -> GameData: ...
```

## Iterator

```python
class Iterator(ABC, Generic[T]):
    @abstractmethod
    def next(self) -> T: ...
    @abstractmethod
    def has_next(self) -> bool: ...
class ListIterator(Iterator[T]): ...

def process_all(it: Iterator[T]) -> None:
    while it.has_next():
        item = it.next()
        logger.info("Processing item", extra={"item": item})
```

## Composite

```python
class Provision(ABC):
    @abstractmethod
    def cost(self) -> Money: ...
class Item(Provision):
    def cost(self) -> Money: return self.price
class Group(Provision):
    def cost(self) -> Money: return sum(item.cost() for item in self.items)
```

## Singleton

```python
class ExecutivePass:
    instance: "ExecutivePass | None" = None
    @classmethod
    def obtain(cls, holder: str) -> "ExecutivePass":
        if cls.instance is None: cls.instance = super().__new__(cls)
        return cls.instance
    def __new__(cls) -> None: raise NotImplementedError("Use obtain()")
    def __copy__(self) -> None: raise NotImplementedError
```

## Abstract Factory

```python
class UIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...
class MacFactory(UIFactory):
    def create_button(self) -> Button: return MacButton()
class WindowsFactory(UIFactory):
    def create_button(self) -> Button: return WindowsButton()
```

## Facade

```python
class PaymentFacade:
    def __init__(self) -> None:
        self.validator = CardValidator(); self.gateway = PaymentGateway()
        self.fraud = FraudDetector(); self.receipt = ReceiptGenerator()
    def charge(self, card: Card, amount: Money) -> PaymentResult:
        self.validator.validate(card)
        txn = self.gateway.process(card, amount)
        return PaymentResult(txn, self.receipt.generate(txn))
```

## Visitor

```python
class Node(ABC):
    @abstractmethod
    def accept(self, visitor: "Visitor") -> None: ...
class Intramural(Node):
    def accept(self, visitor: Visitor) -> None: visitor.visit_intramural(self)
class Visitor(ABC):
    @abstractmethod
    def visit_intramural(self, node: Intramural) -> None: ...
class ScoresReport(Visitor):
    def visit_intramural(self, node: Intramural) -> None:
        logger.info("Scores report", extra={"node": node})
```
