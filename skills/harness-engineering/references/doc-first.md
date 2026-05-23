# Documentation-First Development

The agent MUST NOT jump straight to implementation. Every task flows: **understand → document → get approval → implement → update docs.**

## Ask Before You Act

If ANY of these are unclear, ask the user BEFORE writing code: exact scope, I/O types/format, which files will be touched, what "done" looks like (verification criteria), priority relative to other work. Do not assume. Do not guess.

## Spec Before Code

Before writing implementation, write a spec to `docs/specs/YYYY-MM-DD-<topic>.md`. Present to user for approval if non-trivial.

```markdown
# <Feature/Task Name>

## What
[2-3 sentences from user perspective]

## Scope
- In: [what's included]
- Out: [what's excluded]

## Input/Output
- Input: [types, fields, validation]
- Output: [types, fields, meaning]

## Design
[Classes/functions to create/modify, data flow, dependencies]

## Files to Touch
- [path/file.py] — [what changes, why]

## Verification
- [specific command that proves this works]

## Dependencies
- [other features, services, decisions]
```

## Business Logic Documentation

Business rules MUST live in version-controlled .md files, not just in code or conversation memory.

**Where:** `docs/business/<domain>.md` or `src/<module>/README.md`

**What to record:** What the rule is (plain language), why it exists, where implemented (file:line), when added/changed (date + commit).

```markdown
# Pricing Rules

## Free shipping over $50
- Rule: Orders ≥ $50 get free standard shipping
- Reason: Marketing promotion, effective 2024-01-01
- Implemented: src/orders/pricing.py:45 (calculate_shipping)
- Last updated: 2024-03-15 (abc1234)
```

## After Implementation

When a feature is complete and verified:
1. Update the spec with what ACTUALLY happened
2. Update business logic docs if rules changed
3. Update `docs/codebase-map.md` with new/changed files
4. Update `docs/GRAPH.md` with new code flow paths (see below)
5. Update `PROGRESS.md`
6. Update `AGENTS.md` if new conventions emerged

## Code Flow Graph (GRAPH.md)

Saved at `docs/GRAPH.md`. This is the living map of how code actually flows through the system — the call graph, data flow, and business logic flow combined. Agents read this BEFORE implementing to understand the system. Agents update it AFTER implementing to keep context from being lost across sessions.

### Purpose

- **Before implementing:** Read GRAPH.md to understand the end-to-end flow — what gets called in what order, where data transforms, which branches exist
- **After implementing:** Update GRAPH.md with new paths, new branches, changed flows
- **Context continuity:** When a session ends, the next session reads GRAPH.md and immediately understands how things connect — no re-discovery needed

### Template

```markdown
# Code Flow Graph
Last updated: <YYYY-MM-DD> by <session>

## Entry Points
[What triggers the system — HTTP endpoints, message consumers, cron jobs, CLI commands]
- POST /api/orders — Create a new order
- GET /api/orders/{id} — Get order by ID
- order.created (RabbitMQ) — Order created event consumer

## Order Creation Flow
```
POST /api/orders
  → api/orders.py:create_order()           [validate request via Pydantic]
    → middleware/auth.py:require_auth()    [verify OAuth2 token]
    → services/order_service.py:create()   [orchestrate]
      → services/pricing.py:calculate()    [subtotal + tax + shipping - discounts]
        → services/promo.py:apply()        [promo code validation, discount calc]
          → docs/business/pricing.md       [business rules: max 2 promos, stackable]
      → repositories/order_repo.py:save()  [INSERT into orders + order_items]
      → services/notification.py:send()    [email confirmation via SendGrid]
    → api/orders.py:return OrderResponse   [Pydantic serialization]
```
[Arrow format: caller → callee, with brief description of what happens at each step]

## Key Decision Points
[Where does the code branch? What conditions matter?]
- **Promo code validation** (services/promo.py:45)
  - Valid code → apply discount, continue
  - Expired code → raise PromoExpired (caught by API layer, returns 400)
  - Usage limit exceeded → raise PromoExhausted (caught by API layer, returns 400)

- **Shipping calculation** (services/pricing.py:78)
  - Domestic (US) → standard rates from shipping table
  - International → weight-based calculation
  - Free shipping → if subtotal >= $50 AND domestic
  - See: docs/business/pricing.md for complete rules

## Data Transformations
[Where does data change shape? What forms does it take?]
```
CreateOrderRequest (Pydantic, from API)
  → ValidatedOrder (domain model, after validation)
    → Order (ORM model, for persistence)
      → OrderResult (Pydantic, for API response)
```

## External Calls
[What leaves the process? Databases, APIs, message queues, file system]
- **PostgreSQL** — order persistence, inventory check (repositories/order_repo.py, repositories/inventory_repo.py)
- **Redis** — rate limiting on promo code usage (services/promo.py:30)
- **SendGrid** — order confirmation email (services/notification.py:25)
- **RabbitMQ** — publish order.created event after successful save (services/order_service.py:67)
- **AWS S3** — invoice PDF storage (services/invoice.py:40)

## Error Propagation
[What errors can occur and how do they flow to the user?]
- ValidationError (Pydantic) → caught by FastAPI → 422 response
- OrderNotFound (domain) → caught by API layer → 404 response
- PromoExpired (domain) → caught by API layer → 400 response
- DatabaseError → caught by repository → wrapped as PersistenceError → caught by service → logged → 500 response
- SendGrid timeout → caught by notification service → logged as WARNING → order still succeeds (notification is best-effort)
```

### Rules for GRAPH.md

1. **Read BEFORE implementing.** If you don't understand the flow, you'll break it.
2. **Update AFTER implementing.** Every new endpoint, every new branch, every new external call — add it to the graph.
3. **Use the arrow format consistently.** `caller → callee [description]` — agents can parse this.
4. **Include business logic references.** Link to `docs/business/` files where rules are documented.
5. **Keep it current.** A stale flow graph is worse than no flow graph — it lies to the agent.
6. **One flow per major use case.** Don't mush everything together. Create separate flow sections for create, read, update, delete, search, etc.
