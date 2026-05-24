# Rust Code Examples

Concrete Rust examples for each design principle and pattern. Load with [design-principles.md](../design-principles.md) and [design-patterns.md](../design-patterns.md).

## SRP

```rust
struct OrderValidator;
impl OrderValidator { fn validate(&self, req: CreateOrderRequest) -> Result<ValidatedOrder, AppError> { todo!() } }

struct PricingCalculator;
impl PricingCalculator { fn calculate(&self, items: &[OrderItem]) -> Money { todo!() } }

struct OrderRepository { pool: PgPool }
impl OrderRepository { async fn save(&self, order: &Order) -> Result<Uuid, sqlx::Error> { todo!() } }

struct EmailNotifier { client: reqwest::Client }
impl EmailNotifier { async fn send(&self, email: &EmailAddress, id: Uuid) -> Result<(), AppError> { todo!() } }

struct CreateOrderUseCase<R: OrderRepository, N: EmailNotifier> { repo: R, notifier: N, pricing: PricingCalculator, validator: OrderValidator }
impl<R: OrderRepository, N: EmailNotifier> CreateOrderUseCase<R, N> {
    async fn execute(&self, req: CreateOrderRequest) -> Result<OrderResponse, AppError> {
        let v = self.validator.validate(req)?;
        let total = self.pricing.calculate(&v.items);
        let order = Order::new(v, total);
        let id = self.repo.save(&order).await?;
        self.notifier.send(&order.email, id).await?;
        Ok(OrderResponse::from(order))
    }
}
```

## OCP

```rust
trait ReportExporter: Send + Sync {
    fn export(&self, data: &ReportData) -> Vec<u8>;
}
struct PdfExporter;
impl ReportExporter for PdfExporter { fn export(&self, d: &ReportData) -> Vec<u8> { todo!() } }
struct CsvExporter;
impl ReportExporter for CsvExporter { fn export(&self, d: &ReportData) -> Vec<u8> { todo!() } }

struct ExportRegistry { exporters: HashMap<ExportFormat, Box<dyn ReportExporter>> }
impl ExportRegistry {
    fn export(&self, fmt: ExportFormat, data: &ReportData) -> Vec<u8> {
        self.exporters.get(&fmt).expect("unknown format").export(data)
    }
}
```

## Composition over Inheritance

```rust
trait Engine: Send + Sync { fn sound(&self) -> &'static str; }
struct GasEngine;
impl Engine for GasEngine { fn sound(&self) -> &'static str { "vroom" } }
struct ElectricEngine;
impl Engine for ElectricEngine { fn sound(&self) -> &'static str { "..." } }

trait Driver: Send + Sync { fn operate(&self) -> &'static str; }
struct HumanDriver;
impl Driver for HumanDriver { fn operate(&self) -> &'static str { "driving" } }
struct AIDriver;
impl Driver for AIDriver { fn operate(&self) -> &'static str { "driving itself" } }

struct Car<E: Engine, D: Driver> { engine: E, driver: D }
impl<E: Engine, D: Driver> Car<E, D> {
    fn describe(&self) -> String { format!("{} {}", self.driver.operate(), self.engine.sound()) }
}
// Any engine + driver combo. No hierarchy. Behaviors swappable via generics.
```

## Factory

```rust
struct NotifierFactory { registry: HashMap<String, Box<dyn Fn() -> Box<dyn Notifier>>> }
impl NotifierFactory {
    fn register(&mut self, method: &str, factory: Box<dyn Fn() -> Box<dyn Notifier>>) {
        self.registry.insert(method.to_string(), factory);
    }
    fn create(&self, method: &str) -> Box<dyn Notifier> {
        self.registry.get(method).expect("unknown method")()
    }
}
```

## Strategy Pattern

```rust
trait PricingStrategy: Send + Sync {
    fn calculate(&self, items: &[Item]) -> Money;
}
struct RegularPricing;
impl PricingStrategy for RegularPricing { fn calculate(&self, items: &[Item]) -> Money { todo!() } }
struct BulkDiscountPricing;
impl PricingStrategy for BulkDiscountPricing { fn calculate(&self, items: &[Item]) -> Money { todo!() } }

struct OrderService<P: PricingStrategy> { pricing: P }
```

## Adapter Pattern

```rust
mod third_party { pub struct Logger; impl Logger { pub fn write_entry(&self, severity: i32, text: &str) {} } }

struct LoggerAdapter { inner: third_party::Logger }
impl LoggerAdapter {
    fn info(&self, msg: &str) { self.inner.write_entry(1, msg) }
    fn error(&self, msg: &str) { self.inner.write_entry(4, msg) }
}
```

## Observer Pattern

```rust
trait Observer: Send + Sync { fn update(&self, data: &Event); }
struct Subject { observers: Vec<Box<dyn Observer>> }
impl Subject {
    fn attach(&mut self, obs: Box<dyn Observer>) { self.observers.push(obs); }
    fn notify(&self, data: &Event) {
        for obs in &self.observers { obs.update(data); }
    }
}
```

## State Pattern

```rust
trait State: Send + Sync { fn insert_card(self: Box<Self>) -> Box<dyn State>; }
struct Ready;
impl State for Ready { fn insert_card(self: Box<Self>) -> Box<dyn State> { Box::new(Validating) } }
struct Validating;
impl State for Validating { fn insert_card(self: Box<Self>) -> Box<dyn State> { self } }

struct TicketMachine { state: Box<dyn State> }
impl TicketMachine {
    fn insert_card(&mut self) {
        let old = std::mem::replace(&mut self.state, Box::new(Ready));
        self.state = old.insert_card();
    }
}
```

## Decorator Pattern

```rust
trait Ticket: Send + Sync { fn cost(&self) -> Money; fn description(&self) -> String; }

struct BaseTicket;
impl Ticket for BaseTicket { fn cost(&self) -> Money { Money::from(30) } fn description(&self) -> String { "Base".into() } }

struct VipSeating<T: Ticket> { inner: T }
impl<T: Ticket> Ticket for VipSeating<T> {
    fn cost(&self) -> Money { self.inner.cost() + Money::from(20) }
    fn description(&self) -> String { format!("{} + VIP", self.inner.description()) }
}

struct DrinkCoupon<T: Ticket> { inner: T }
impl<T: Ticket> Ticket for DrinkCoupon<T> {
    fn cost(&self) -> Money { self.inner.cost() + Money::from(5) }
    fn description(&self) -> String { format!("{} + Coupon", self.inner.description()) }
}
// Usage: let ticket = VipSeating { inner: DrinkCoupon { inner: BaseTicket } };
```

## Template Method

```rust
trait GameReport {
    fn acquire_data(&self) -> GameData;
    fn analyze(&self, data: &GameData) -> Analysis;
    fn print_body(&self, analysis: &Analysis);
    fn generate(&self) {
        let data = self.acquire_data();
        let analysis = self.analyze(&data);
        self.print_body(&analysis);
    }
}
```

## Iterator

```rust
// Rust's std::iter::Iterator is the built-in Iterator pattern
struct ListIterator<T> { items: Vec<T>, index: usize }
impl<T: Clone> Iterator for ListIterator<T> {
    type Item = T;
    fn next(&mut self) -> Option<Self::Item> {
        if self.index < self.items.len() {
            let item = self.items[self.index].clone();
            self.index += 1;
            Some(item)
        } else { None }
    }
}
```

## Composite

```rust
trait Provision { fn cost(&self) -> Money; }
struct Item { price: Money }
impl Provision for Item { fn cost(&self) -> Money { self.price } }
struct Group { name: String, items: Vec<Box<dyn Provision>> }
impl Provision for Group {
    fn cost(&self) -> Money { self.items.iter().map(|i| i.cost()).sum() }
}
```

## Singleton

```rust
use std::sync::OnceLock;
static EXECUTIVE_PASS: OnceLock<ExecutivePass> = OnceLock::new();

impl ExecutivePass {
    pub fn obtain(holder: &str) -> &ExecutivePass {
        EXECUTIVE_PASS.get_or_init(|| ExecutivePass::new(holder))
    }
    fn new(holder: &str) -> Self { ExecutivePass { holder: holder.to_string(), key: rand::random() } }
}
```

## Abstract Factory

```rust
trait UiFactory { fn create_button(&self) -> Box<dyn Button>; fn create_checkbox(&self) -> Box<dyn Checkbox>; }
struct MacFactory;
impl UiFactory for MacFactory { fn create_button(&self) -> Box<dyn Button> { Box::new(MacButton) } fn create_checkbox(&self) -> Box<dyn Checkbox> { Box::new(MacCheckbox) } }
struct WindowsFactory;
impl UiFactory for WindowsFactory { fn create_button(&self) -> Box<dyn Button> { Box::new(WinButton) } fn create_checkbox(&self) -> Box<dyn Checkbox> { Box::new(WinCheckbox) } }
```

## Facade

```rust
struct PaymentFacade {
    validator: CardValidator, gateway: PaymentGateway, fraud: FraudDetector, receipt: ReceiptGenerator,
}
impl PaymentFacade {
    async fn charge(&self, card: &Card, amount: Money) -> Result<PaymentResult, AppError> {
        self.validator.validate(card)?;
        if self.fraud.is_suspicious(card, amount) { return Err(AppError::FraudSuspected); }
        let txn = self.gateway.process(card, amount).await?;
        let receipt = self.receipt.generate(&txn);
        Ok(PaymentResult { txn, receipt })
    }
}
```

## Visitor

```rust
trait Visitor { fn visit_intramural(&mut self, node: &Intramural); fn visit_sport(&mut self, node: &Sport); }
trait Node { fn accept(&self, visitor: &mut dyn Visitor); }
struct Intramural { sports: Vec<Sport> }
impl Node for Intramural { fn accept(&self, v: &mut dyn Visitor) { v.visit_intramural(self); for s in &self.sports { s.accept(v); } } }
struct ScoresReport;
impl Visitor for ScoresReport { fn visit_intramural(&mut self, _: &Intramural) { println!("SCORES"); } fn visit_sport(&mut self, _: &Sport) {} }
```
