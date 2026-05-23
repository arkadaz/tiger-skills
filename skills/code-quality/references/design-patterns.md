# Design Patterns

From *Software Design for Python Programmers* by Ronald Mak. Each pattern solves a specific architecture problem. When you recognize the "before" symptoms, apply the corresponding pattern.

## Pattern Selection Guide

| When You See... | Use This Pattern |
|----------------|-----------------|
| Fixed algorithm steps, some vary | **Template Method** |
| Multiple interchangeable algorithms | **Strategy** |
| Creating families of related objects | **Abstract Factory** |
| Subclass should decide what to create | **Factory Method** |
| Incompatible interfaces need to work together | **Adapter** |
| Complex subsystem, need simple interface | **Facade** |
| One algorithm, different collections | **Iterator** |
| Different algorithms, one collection | **Visitor** |
| One produces data, many consume it | **Observer** |
| Object behavior changes with state | **State** |
| At most one instance allowed | **Singleton** |
| Part-whole hierarchy, treat uniformly | **Composite** |
| Add responsibilities at runtime | **Decorator** |

## Template Method

**Problem:** An algorithm has fixed steps in a fixed order, but some steps vary by context.

**Solution:** Superclass defines the skeleton (template method). Subclasses implement the varying steps.

```python
class GameReport(ABC):
    def generate(self):              # template method — fixed order
        self._print_header()
        self._acquire_data()
        self._analyze_data()
        self._print_body()
        self._print_footer()

    def _print_header(self): ...     # common — implemented once
    def _print_footer(self): ...     # common — implemented once

    @abstractmethod
    def _acquire_data(self): pass    # varies — subclasses implement
    @abstractmethod
    def _analyze_data(self): pass
    @abstractmethod
    def _print_body(self): pass

class BaseballReport(GameReport):
    def _acquire_data(self): ...
    # only the varying steps — no duplicated structure
```

**Key insight:** The superclass owns the algorithm structure. Subclasses fill in blanks. Never duplicate the structure.

**vs. Strategy:** Template Method uses inheritance (IS-A). Strategy uses composition (HAS-A). Template Method is simpler when the algorithm structure is stable. Strategy is more flexible when algorithms need to swap at runtime.

## Strategy

**Problem:** Multiple algorithms exist for the same task. They need to be interchangeable at runtime.

**Solution:** Define a strategy interface. Each algorithm is a concrete strategy. The client holds a reference to the current strategy.

```python
class PricingStrategy(ABC):
    @abstractmethod
    def calculate(self, items: list[Item]) -> Money: ...

class RegularPricing(PricingStrategy):
    def calculate(self, items): return sum(item.price * item.qty for item in items)

class BulkDiscountPricing(PricingStrategy):
    def calculate(self, items):
        total = sum(item.price * item.qty for item in items)
        return total * 0.9 if total > Money(100) else total

class SeasonalPricing(PricingStrategy):
    def calculate(self, items): ...

class OrderService:
    def __init__(self, pricing: PricingStrategy):
        self._pricing = pricing  # injected — changeable at runtime

    def create_order(self, request):
        total = self._pricing.calculate(request.items)
        ...
```

**Key insight:** Encapsulate the algorithm. Inject it. Swap it. The client doesn't know which strategy it's using.

## Abstract Factory

**Problem:** Create families of related objects without mixing objects from different families.

**Solution:** Define a factory interface with create methods for each object type. Concrete factories produce objects from one family.

```python
class UIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...
    @abstractmethod
    def create_checkbox(self) -> Checkbox: ...

class MacFactory(UIFactory):
    def create_button(self): return MacButton()
    def create_checkbox(self): return MacCheckbox()

class WindowsFactory(UIFactory):
    def create_button(self): return WindowsButton()
    def create_checkbox(self): return WindowsCheckbox()

# Client code never mixes Mac and Windows widgets because one factory
# produces all widgets from the same family.
```

**Key insight:** One factory = one family. No mixing families. Adding a new family = one new factory class.

## Factory Method

**Problem:** A class needs to create objects, but the exact subclass should be decided by subclasses.

**Solution:** Define an abstract create method. Subclasses override it to create the right concrete object.

```python
class Document(ABC):
    @abstractmethod
    def create_exporter(self) -> Exporter: ...  # factory method

    def export(self) -> bytes:
        exporter = self.create_exporter()  # subclass decides which exporter
        return exporter.export(self)

class PDFDocument(Document):
    def create_exporter(self): return PDFExporter()

class SpreadsheetDocument(Document):
    def create_exporter(self): return CSVExporter()
```

**Key insight:** Delegate "which class to instantiate" to subclasses. The superclass uses the result without knowing the concrete type.

**vs. Abstract Factory:** Factory Method creates ONE object. Abstract Factory creates FAMILIES of objects. Factory Method uses inheritance. Abstract Factory uses composition.

## Adapter

**Problem:** Two classes have incompatible interfaces but need to work together. Neither can be modified.

**Solution:** Create an adapter that wraps one class and presents the interface the other expects.

```python
# External library has this interface (can't change):
class ThirdPartyLogger:
    def write_entry(self, severity: int, text: str): ...

# Our code expects this interface:
class Logger(Protocol):
    def info(self, msg: str): ...
    def error(self, msg: str): ...

# Adapter bridges them:
class ThirdPartyLoggerAdapter:
    def __init__(self, adaptee: ThirdPartyLogger):
        self._adaptee = adaptee

    def info(self, msg: str):
        self._adaptee.write_entry(1, msg)    # 1 = INFO in their system

    def error(self, msg: str):
        self._adaptee.write_entry(4, msg)    # 4 = ERROR in their system
```

**Key insight:** Don't change either side. Wrap the adaptee. The adapter translates. Object adapter (wrapping) is more flexible than class adapter (multiple inheritance).

## Facade

**Problem:** A complex subsystem has many interfaces. Callers need a simple, unified entry point.

**Solution:** Create a facade class that presents a high-level interface and delegates to the subsystem.

```python
class PaymentFacade:
    def __init__(self):
        self._validator = CardValidator()
        self._gateway = PaymentGateway()
        self._fraud_check = FraudDetector()
        self._receipt = ReceiptGenerator()
        self._notifier = CustomerNotifier()

    def charge(self, card: Card, amount: Money) -> PaymentResult:
        # One call from the caller's perspective.
        # Facade orchestrates all subsystem components.
        self._validator.validate(card)
        if self._fraud_check.is_suspicious(card, amount):
            raise FraudSuspected()
        transaction = self._gateway.process(card, amount)
        receipt = self._receipt.generate(transaction)
        self._notifier.send_receipt(card.email, receipt)
        return PaymentResult(transaction, receipt)
```

**Key insight:** Facade simplifies. Adapter converts. Facade fronts a whole subsystem; Adapter wraps a single class.

## Iterator

**Problem:** One algorithm must work on different sequential collections (list, dict, generator, tree) without knowing their internals.

**Solution:** Each collection provides an iterator. The algorithm uses `next()` and `has_next()` uniformly.

```python
class Iterator(ABC):
    @abstractmethod
    def next(self) -> object: ...
    @abstractmethod
    def has_next(self) -> bool: ...

class ListIterator(Iterator):
    def __init__(self, items: list):
        self._items = items
        self._index = -1

    def next(self):
        self._index += 1
        return self._items[self._index]

    def has_next(self):
        return self._index < len(self._items) - 1

def print_all(iterator: Iterator):
    while iterator.has_next():
        print(iterator.next())
# Works with any iterator — list, dict, generator, tree — no code changes.
```

**Key insight:** Encapsulate traversal. Hide collection implementation. One algorithm, many collection types.

## Visitor

**Problem:** Multiple algorithms operate on a single collection of different object types. Adding algorithms shouldn't change the collection.

**Solution:** Each algorithm is a visitor. Each element type has an `accept()` method that calls the visitor's appropriate visit method.

```python
class Node(ABC):
    @abstractmethod
    def accept(self, visitor: "Visitor"): ...

class Intramural(Node):
    def accept(self, visitor):
        visitor.visit_intramural(self)  # double dispatch

class Sport(Node):
    def accept(self, visitor):
        visitor.visit_sport(self)

class Visitor(ABC):
    @abstractmethod
    def visit_intramural(self, node): ...
    @abstractmethod
    def visit_sport(self, node): ...

class ScoresReport(Visitor):
    def visit_intramural(self, node): print("SCORES REPORT")
    def visit_sport(self, node): print(f"  {node.type}")

class ActivitiesReport(Visitor):
    def visit_intramural(self, node): print("ACTIVITIES REPORT")
    def visit_sport(self, node): print(f"  {node.type}: {node.game_count} games")
```

**Key insight:** New algorithm = new visitor class. No changes to data classes. Double dispatch routes to the right method.

## Observer

**Problem:** One object (publisher) produces data. Multiple objects (subscribers) need to react to new data. Publisher shouldn't know subscriber details.

**Solution:** Publisher maintains a subscriber list. On new data, it calls `update()` on each subscriber.

```python
class Subject:
    def __init__(self):
        self._observers: list[Observer] = []

    def attach(self, observer: Observer): self._observers.append(observer)
    def detach(self, observer: Observer): self._observers.remove(observer)

    def _notify(self, data):
        for obs in self._observers:
            obs.update(data)  # tell each observer, don't care what they do

class Observer(ABC):
    @abstractmethod
    def update(self, data): ...

class LogSubscriber(Observer):
    def update(self, data):
        logger.info(f"New event: {data}")

class EmailSubscriber(Observer):
    def update(self, data):
        if data.priority == "high":
            self._send_alert(data)
```

**Key insight:** Publisher knows "I have observers, I notify them." Publisher does NOT know what they do. Add/remove subscribers at runtime.

## State

**Problem:** Object behavior changes dramatically based on internal state. State-specific logic is scattered across if-else chains.

**Solution:** Each state is a class. The object delegates behavior to its current state object. State transitions return the next state.

```python
class TicketMachine:
    def __init__(self, count: int):
        self._state = Ready()
        self._count = count

    def insert_card(self):
        self._state = self._state.insert_card()  # state returns next state

class State(ABC):
    @abstractmethod
    def insert_card(self) -> "State": ...

class Ready(State):
    def insert_card(self) -> State:
        print("Validating card...")
        return Validating()  # transition

class Validating(State):
    def insert_card(self) -> State:
        print("Still checking...")
        return self  # no transition

class TicketSold(State):
    def insert_card(self) -> State:
        print("Take your ticket first")
        return self
```

**Key insight:** Each state encapsulates its behavior. Transitions are explicit (state returns next state). Adding a state = adding a class, not editing if-else chains.

## Singleton

**Problem:** At most one instance of a class can exist during runtime.

**Solution:** Private constructor, static instance variable, public accessor that creates only if null.

```python
class ExecutivePass:
    _instance: "ExecutivePass | None" = None

    @classmethod
    def obtain(cls, holder: str) -> "ExecutivePass":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._key = random.randint(1, 999)
            cls._instance._holder = holder
        cls._instance._holder = holder
        return cls._instance

    def __new__(cls):
        raise NotImplementedError("Use ExecutivePass.obtain()")  # block direct creation

    def __copy__(self):
        raise NotImplementedError("Cannot copy singleton")  # block copy

    def __deepcopy__(self, memo):
        raise NotImplementedError("Cannot copy singleton")
```

**Key insight:** Block direct construction, block copying. Single access point. Only create when first needed (lazy).

## Composite

**Problem:** A tree of objects where individual objects and groups of objects should be treated the same way.

**Solution:** Define a common interface. Leaf (individual) and Composite (group) both implement it.

```python
class Provision(ABC):
    @abstractmethod
    def cost(self) -> Money: ...
    @abstractmethod
    def print_item(self, indent: int = 0): ...

class Item(Provision):          # Leaf
    def cost(self): return self._price
    def print_item(self, indent):
        print(f"{'  ' * indent}{self._name}: ${self.cost()}")

class Group(Provision):         # Composite
    def __init__(self, name):
        self._items: list[Provision] = []

    def add(self, item: Provision): self._items.append(item)

    def cost(self):
        return sum(item.cost() for item in self._items)

    def print_item(self, indent):
        print(f"{'  ' * indent}{self._name}")
        for item in self._items:
            item.print_item(indent + 1)
        print(f"{'  ' * indent}Total: ${self.cost()}")
# Caller calls cost() or print_item() — doesn't care if it's Item or Group.
```

**Key insight:** Same interface for one and many. The composite contains children (which may themselves be composites). Recursion handles the rest.

## Decorator

**Problem:** Add responsibilities to objects dynamically at runtime without changing their class.

**Solution:** Wrap the object in a decorator that adds the responsibility and delegates the rest.

```python
class Ticket(ABC):
    @abstractmethod
    def cost(self) -> Money: ...
    @abstractmethod
    def description(self) -> str: ...

class BaseTicket(Ticket):
    def cost(self): return Money(30)
    def description(self): return "Base ticket"

class Enhancement(Ticket):    # Decorator base
    def __init__(self, ticket: Ticket, name: str, price: Money):
        self._ticket = ticket  # wrap this
        self._name = name
        self._price = price

    def cost(self):
        return self._price + self._ticket.cost()  # add my cost + wrapped cost

    def description(self):
        return f"{self._ticket.description()} + {self._name}"

class VIPSeating(Enhancement):
    def __init__(self, ticket: Ticket):
        super().__init__(ticket, "VIP seating", Money(20))

class DrinkCoupon(Enhancement):
    def __init__(self, ticket: Ticket):
        super().__init__(ticket, "Drink coupon", Money(5))

# Usage:
ticket = BaseTicket()
ticket = VIPSeating(ticket)           # wrap
ticket = DrinkCoupon(ticket)          # wrap again
ticket = DrinkCoupon(ticket)          # wrap again (2 coupons)
print(f"${ticket.cost()}")  # $60 — base(30) + VIP(20) + 2×coupon(5)
```

**Key insight:** Each decorator adds one responsibility. Decorators can stack in any order. The base object doesn't know it's decorated.
