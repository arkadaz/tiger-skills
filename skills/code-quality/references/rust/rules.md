# Rust-Specific Rules

Always loaded for Rust projects. These are non-negotiable for every `.rs` file written or modified.

## Naming Conventions (Capital Rule)

All configuration keys, constants, and enum variants MUST use proper Rust casing:

| What | Convention | Example |
|------|-----------|---------|
| Config/env keys | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`, `JWT_SECRET`, `MAX_RETRIES` |
| `const` / `static` items | `SCREAMING_SNAKE_CASE` | `const DEFAULT_PAGE_SIZE: u32 = 20;` |
| Enum variants | `PascalCase` | `OrderStatus::PendingConfirmation` |
| Struct/enum/trait names | `PascalCase` | `CreateOrderRequest`, `EmailNotifier` |
| Function/method names | `snake_case` | `fn calculate_total(&self) -> Money` |
| Variable names | `snake_case` | `let user_count = users.len();` |
| Private items | (no leading `_` needed — privacy is by module) | `fn internal_helper()` |

**Serde JSON mapping:** When enum variants need lowercase JSON, use `#[serde(rename_all = "snake_case")]` — the Rust variant stays PascalCase, serialization handles the rest.

**Never:** `camelCase` in Rust, config keys in lowercase, magic strings where enums exist, `SHOUTY_SNAKE_CASE` for enum variants (that's Python convention, not Rust).

## Strong Types at Boundaries

Rust's type system is the boundary validator. Every external input MUST be parsed into a concrete type at the edge of the system — never pass raw `String`, `Vec<u8>`, or `serde_json::Value` through business logic.

**Why:** Rust's type system makes invalid states unrepresentable. Use it. A `String` containing "an email address" is not an email address — it's a String. An `EmailAddress` newtype IS an email address.

**Correct (newtypes at boundaries):**
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBookRequest {
    pub title: String,           // non-empty enforced at construction
    pub author: String,
    pub isbn: Isbn,              // newtype with validation
    pub year: u16,
    pub genre: BookGenre,        // enum, not string
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Isbn(String);

impl Isbn {
    pub fn new(raw: String) -> Result<Self, ValidationError> {
        let cleaned: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
        if cleaned.len() != 13 && cleaned.len() != 10 {
            return Err(ValidationError::InvalidIsbn);
        }
        Ok(Self(cleaned))
    }
}

// The service layer NEVER sees raw strings for ISBN — only Isbn.
pub fn create_book(req: CreateBookRequest) -> Result<BookResponse, AppError> {
    // req.isbn is already validated. No string parsing in business logic.
    todo!()
}
```


## Serde for Serialization Boundaries

All I/O boundaries MUST use `serde` with `#[derive(Serialize, Deserialize)]`. This applies to: HTTP request/response bodies (axum/actix), file parsing (JSON, YAML, TOML, CSV), database query results, message queue payloads, CLI argument structs (clap).

**Correct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResponse {
    pub id: Uuid,
    pub customer_name: String,
    pub total: Decimal,
    pub status: OrderStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
```

## Enums for Known Value Sets (Pattern Matching)

Every discriminant MUST be a Rust enum — never magic strings or integers. Rust's exhaustive pattern matching makes this even more powerful than Python's Enum.

**Correct (Rust enum with exhaustive match):**
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Pending,
    Confirmed,
    Shipped,
    Delivered,
    Cancelled,
}

// Exhaustive match — compiler errors if a variant is missing:
impl OrderStatus {
    pub fn description(&self) -> &'static str {
        match self {
            OrderStatus::Pending => "Awaiting confirmation",
            OrderStatus::Confirmed => "Order confirmed",
            OrderStatus::Shipped => "In transit",
            OrderStatus::Delivered => "Delivered",
            OrderStatus::Cancelled => "Cancelled",
        }
    }
}
```


## Logging with Tracing

Use the `tracing` crate for structured logging. Never `println!()` for operational output.

**Why:** `tracing` provides spans, structured fields, levels, and async-aware context propagation. `println!()` provides none of these.

**Correct:**
```rust
use tracing::{info, warn, error, debug, instrument};

#[instrument(skip(repo, email_service), fields(order_id = %request.id))]
pub async fn create_order(
    repo: &dyn OrderRepository,
    email_service: &dyn EmailService,
    request: CreateOrderRequest,
) -> Result<OrderResponse, AppError> {
    info!("Creating order");

    let order = Order::from_request(request);
    repo.save(&order).await?;
    info!(order_id = %order.id, "Order saved");

    if let Err(e) = email_service.send_confirmation(&order).await {
        warn!(error = %e, "Confirmation email failed — order still created");
    }

    Ok(OrderResponse::from(order))
}
```


## Trait-Based Abstraction (Code to Interface)

Rust traits replace Python's Protocols/ABCs. Depend on traits, not concrete implementations.

**Correct:**
```rust
use async_trait::async_trait;

#[async_trait]
pub trait OrderRepository: Send + Sync {
    async fn save(&self, order: &Order) -> Result<(), RepoError>;
    async fn find_by_id(&self, id: &Uuid) -> Result<Option<Order>, RepoError>;
}

// Service depends on trait, not concrete type:
pub struct OrderService<R: OrderRepository, E: EmailService> {
    repo: R,
    email: E,
}

// In tests: inject mock implementation
// In production: inject PostgresOrderRepository
```


## Cargo Check and Clippy

After every implementation step, run both. Never leave warnings or errors behind.

- **`cargo check`** — fast compilation check (no codegen), catches type errors
- **`cargo clippy -- -D warnings`** — lint + style + correctness checks
- **`cargo fmt -- --check`** — verify formatting

**These are non-negotiable.** A clean `cargo check && cargo clippy` is part of the minimum bar.

## No Water Code

Rust-specific water to delete:
- `#[allow(dead_code)]` on code that's actually dead — delete the code
- `unwrap()` used because "it shouldn't fail" — use `expect("reason")` or proper error handling
- Redundant clones of values that implement `Copy`
- `let _ = ...` ignoring a `Result` — handle the error or use `.ok()`
- Comments that restate the obvious: `// increment counter` next to `counter += 1`
- `todo!()` macros left in committed code — they're for active development only

**Correct (expect with reason):**
```rust
let config = Config::from_env().expect("Config must be valid at startup");
```


## Error Handling — No Magic Catch-Alls

Every error path MUST produce a specific error type. Use `thiserror` for library errors, `anyhow` for application-level (but still with context).

**Correct (specific errors with thiserror):**
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Order not found: {0}")]
    NotFound(Uuid),

    #[error("Validation failed: {0}")]
    Validation(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Email send failed: {0}")]
    Email(#[from] lettre::error::Error),
}

// Caller handles specific variants:
match order_service.create(req).await {
    Err(AppError::Validation(msg)) => return HttpResponse::BadRequest().json(msg),
    Err(AppError::NotFound(id)) => return HttpResponse::NotFound().json(id),
    Err(e) => {
        tracing::error!(%e, "Unexpected error");
        return HttpResponse::InternalServerError();
    }
    Ok(order) => HttpResponse::Created().json(order),
}
```


## Rust Project Structure

```
project/
├── src/
│   ├── main.rs              — Entry point + axum/actix router setup
│   ├── lib.rs               — Public API surface for library crates
│   ├── api/                 — Route handlers, request/response DTOs
│   │   ├── mod.rs
│   │   ├── orders.rs        — POST /orders, GET /orders/{id}
│   │   └── health.rs        — GET /health
│   ├── services/            — Business logic, use cases
│   │   ├── mod.rs
│   │   └── order_service.rs
│   ├── repositories/        — Database access, external API clients
│   │   ├── mod.rs
│   │   └── order_repo.rs    — trait OrderRepository + Postgres impl
│   ├── models/              — Domain types, enums, newtypes
│   │   ├── mod.rs
│   │   ├── order.rs
│   │   └── types.rs         — EmailAddress, Isbn, Money, etc.
│   ├── core/                — Config, logging, error types
│   │   ├── mod.rs
│   │   ├── config.rs        — figment/config/env-based Settings
│   │   ├── logging.rs       — tracing subscriber setup
│   │   └── errors.rs        — AppError enum, error response mapping
│   └── utils/               — Zero-business-logic helpers
│       └── mod.rs
├── tests/
│   ├── integration/         — Full stack with test DB
│   └── unit/                — One file per source module
├── docs/
│   ├── business/            — Business rules per domain
│   ├── specs/               — Per-feature specs
│   └── reviews/             — Code review reports
├── Cargo.toml
├── AGENTS.md
├── PROGRESS.md
├── Makefile                 — check, test, lint, dev targets
└── .env.example
```

### Layer Rules (Rust)

| Layer | Allowed Imports | Forbidden |
|-------|----------------|-----------|
| **api/** | services/, models/, core/ | repositories/ |
| **services/** | repositories/, models/, core/ | api/ |
| **repositories/** | models/, core/ | api/, services/ |
| **models/** | core/ (errors only), utils/ | everything else |
| **core/** | nothing from src/ | everything else |
| **utils/** | nothing from src/ | everything else |

### Cargo.toml Pattern

```toml
[package]
name = "book-store"
version = "0.1.0"
edition = "2024"

[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid"] }
uuid = { version = "1", features = ["v4", "serde"] }
tracing = "0.1"
tracing-subscriber = "0.3"
thiserror = "2"
chrono = { version = "0.4", features = ["serde"] }
rust_decimal = { version = "1", features = ["serde"] }

[dev-dependencies]
tower = "0.5"
http-body-util = "0.1"
```

## Explore Before Implementing (Rust)

Before writing new code:
1. Use Grep to search for the function name or trait name
2. Use Glob to find files in the relevant module
3. Check `src/lib.rs` for re-exports — these define the public API surface
4. If a trait already exists that does 80%+ of what you need, implement it — don't create a duplicate
5. Check `Cargo.toml` for existing dependencies before adding new crates

## Config Management (Rust)

Use `figment` or `config` crate. Single source of truth. Inject via constructor, never import globally.

```rust
// src/core/config.rs
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Settings {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub smtp_host: String,
    pub smtp_port: u16,
}
```

Config values flow inward via constructor injection — services never import `Settings` directly.
