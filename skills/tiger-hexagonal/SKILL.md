---
name: tiger-hexagonal
description: Hexagonal architecture, also called ports and adapters. Business rules in the middle, everything that touches the outside world at the edge, imports pointing inward only. Covers where each kind of code goes, tests by layer, the architecture check, and fitting it onto an existing or framework project. Use when designing, placing, moving or reviewing code structure.
---

# Hexagonal architecture

Keep the business rules in the middle and everything that talks to the outside world at the edge. Then a rule can change without touching the database, and the database can change without touching a rule.

## The shape

```
src/
  domain/            rules and data. No I/O, no framework, no clock, no randomness.
  application/       use cases: one per thing a user can do. Calls the domain and the ports.
    ports/           what the use cases need from outside, as interfaces.
  adapters/
    inbound/         how requests arrive: HTTP, CLI, UI, queue, schedule.
    outbound/        how we reach out: database, other APIs, files, email, clock.
  main               builds the adapters and hands them to the use cases.
```

**The one rule: imports point inward.** `adapters → application → domain`. Adapters never import each other.

The domain is free to use the language and the pure parts of its standard library: math, decimals, dates as values, collections. It never imports the application, an adapter, a framework, or anything that does I/O.

## Where does it go

| This | Goes in |
|---|---|
| a price calculation, a status change, a business check | domain |
| "place an order": load, decide, save, notify | application, one use case |
| "save an order", "send an email", "what time is it", as a need | a port |
| SQL, HTTP calls, file reads, controllers, ORM models | adapters |
| reading config, connecting the parts | main |

An inbound adapter does three things: read the input, call one use case, format the answer. An outbound adapter implements one port.

## Keep it small

- A port exists only where the code touches the outside world. A pure function needs no interface.
- A use case is one function or one small class. No base classes, no generic "service".
- Domain data has a named type with its fields: an order is an `Order`, never a bare dict. The types are plain data and functions. ORM models stay in the adapter; convert at the edge.
- Let the database do database work inside the outbound adapter: constraints, transactions, one query instead of a loop.
- A small program still separates the two: one pure function for the logic, one thin `main` for input and output. That is the whole hexagon. Do not add folders for fifty lines.

## Existing projects

- Lay the hexagon over the folders the project already has. Do not rename the world. Write the mapping in `docs/agent/architecture.md`.
- In a framework project (Rails, Django, Next.js, Spring, Laravel) the framework is the adapter layer. Controllers, views, models and jobs stay where the framework wants them. Rules move into plain modules that the framework code calls, never the other way round.
- Code that breaks the rule is not rewritten all at once. New code follows the rule. Old code moves when a task touches it: put its I/O behind a port and move its rule into the domain. A large move is its own refactor.

## Tests by layer

| Layer | Test it with |
|---|---|
| domain | plain unit tests, no mocks, no I/O. Most tests live here. |
| application | the use case run against small in-memory versions of its ports: a real little class, not a mocking script |
| outbound adapters | the real thing (the project's test database or container), because that is where queries and wire formats break |
| inbound adapters | a few end-to-end checks through the real entry point |

## The architecture check

One command that fails when an import points outward. It runs with the tests and is written in `docs/agent/architecture.md`. It looks for outward imports only: a standard library import in the domain is fine and must not trip it.

Use what the project already has: import-linter (Python), dependency-cruiser or an ESLint boundaries rule (JavaScript, TypeScript), ArchUnit (JVM), NetArchTest or project references (.NET), `internal/` packages or depguard (Go), separate crates (Rust).

Nothing installed? One search is enough. Do not add a dependency for this. Put the project's own folder and framework names in the pattern:

```bash
! grep -rnE "(import|from|require|use).*(adapters|django|flask|express|sqlalchemy)" src/domain src/application
```

## Smells

| You see | Do this |
|---|---|
| the domain imports a framework or a driver | move the I/O to an adapter behind a port |
| a controller holds a business rule | move the rule to the domain; the controller calls a use case |
| a use case builds SQL or calls HTTP | that is an adapter's job |
| an adapter calls another adapter | go through a use case |
| an interface wraps a pure function | delete the interface |
