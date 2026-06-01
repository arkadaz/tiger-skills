---
name: code-quality:rust
description: Rust-specific code quality rules — traits, ownership, error handling, module structure, clippy. Every Rust file must comply. Use when writing, reviewing, or auditing Rust code.
---

# Rust Code Quality Rules

Non-negotiable rules for every Rust file. Load the full reference at [code-quality references/rust/rules.md](../code-quality/references/rust/rules.md) for detailed examples.

## Types — No Any Equivalent

Rust's type system enforces most type safety, but watch for:
- `Box<dyn Any>` — almost always wrong. Use proper traits.
- `serde_json::Value` passed through business logic — parse into domain types at the boundary.
- `String` used where `&str` or a newtype would be clearer.

**Newtype pattern for semantic types:**
```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(String);

#[derive(Debug, Clone)]
pub struct PriceCents(i64);
```

## Traits Over Concrete Types

**Depend on traits, not concrete types.** Function parameters should accept `impl Trait` or `&dyn Trait`.

```rust
// Wrong — coupled to concrete type
fn send_notification(notifier: &EmailNotifier, user: &User) -> Result<()> { ... }

// Correct — depends on abstraction
fn send_notification(notifier: &impl Notifier, user: &User) -> Result<()> { ... }
```

## Error Handling

**No bare `unwrap()` or `expect()` in library code.** Use `Result` propagation with `?`. Applications can `expect()` at startup only.

```rust
// Wrong — panics on error
let config = read_config("config.toml").unwrap();

// Correct — propagates error
let config = read_config("config.toml")?;
```

Use `thiserror` for library errors, `anyhow` for application errors.

## Ownership and Borrowing

- Accept `&str` not `String` when only reading
- Accept `&[T]` not `&Vec<T>` when only reading
- Return owned types, accept references
- Avoid unnecessary `.clone()` — understand when to borrow

## Module Structure

```
src/
├── main.rs or lib.rs
├── api/        — HTTP handlers, route definitions
├── services/   — business logic
├── repositories/ — data access
├── models/     — domain types, enums, value objects
├── config.rs   — configuration (envy, config crate)
└── error.rs    — error types (thiserror)
```

**Init files:** `mod.rs` or `lib.rs` re-exports only what's public. No logic.

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Types, traits, enums | `PascalCase` | `OrderService`, `Notifier` |
| Functions, methods | `snake_case` | `fn calculate_total()` |
| Constants, statics | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES` |
| Enum variants | `PascalCase` | `OrderStatus::Pending` |
| Modules, crates | `snake_case` | `mod order_service` |

## Enums Over Magic Values

Use enums for all fixed choice sets. No magic strings or integers.

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum OrderStatus {
    Pending,
    Confirmed,
    Shipped,
    Delivered,
    Cancelled,
}
```

Rust's exhaustive pattern matching ensures all cases are handled.

## Composition Over Inheritance

Rust has no implementation inheritance — this is the default. Use:
- Traits for shared behavior
- Composition (HAS-A) for code reuse
- Newtypes for wrapping and extending external types

## Logging

Use `tracing` or `log` crate. Never `println!()` for operational output.

```rust
use tracing::{info, warn, error};

info!(order_id = %id, "Processing order");
```

## Clippy and Format

After every change:
- `cargo clippy -- -D warnings` — zero warnings
- `cargo fmt --check` — formatted

## Serde at I/O Boundaries

Every struct receiving data from outside the process MUST derive `Serialize`/`Deserialize` and validate at construction:

```rust
#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub customer_name: String,
    #[validate(email)]
    pub customer_email: String,
    pub items: Vec<OrderItem>,
}
```

Invalid data must fail at the boundary.

## DI in Rust

Constructor injection via traits:
```rust
pub struct OrderService<N: Notifier, R: OrderRepository> {
    notifier: N,
    repo: R,
}

impl<N: Notifier, R: OrderRepository> OrderService<N, R> {
    pub fn new(notifier: N, repo: R) -> Self {
        Self { notifier, repo }
    }
}
```

No global state. No lazy_static for business dependencies.
