---
name: tiger-hexagonal
description: Hexagonal architecture, also called ports and adapters. Business rules in the middle, everything that touches the outside world at the edge, every file in the folder of its layer, imports pointing inward only. Covers where each kind of code goes, tests by layer, the architecture check that fails on a file outside its layer, and moving an existing or framework project into the shape. Use when designing, placing, moving or reviewing code structure.
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

**Rule one: every source file is in the folder of its layer,** named as above, so anyone can see where a piece of code belongs and what it may import.

- A part of a bigger project has the same folders inside it: `crates/backend/src/adapters/inbound/notes.rs`.
- A whole crate or package can be one layer when its folder is named for the layer: `crates/domain/`.
- Outside the layer folders sit only the wiring and the tests. The wiring is `main`, the settings it reads, and the files that only declare modules, such as `lib.rs`, `mod.rs` and `__init__.py`.

**Rule two: imports point inward.** `adapters → application → domain`. Adapters never import each other.

The architecture check below fails when either rule is broken.

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

The shape is not optional. A project whose architecture check fails is moved into the shape before anything else is built in it. Whether to move is never a question for the user, and how the project was built before is no reason to wait.

- The move is a refactor version of its own, planned as `tiger-planning` says. Until it is done, every other request waits for it, except a bug fix.
- `docs/agent/architecture.md` lists each file that is not in its layer's folder yet, and the folder it moves to.
- Each task moves the files of one layer into its folder and fixes the imports, with no other change. The same tests pass after it.
- A file that holds both a rule and its I/O is split first: the rule into the domain, the I/O into an adapter behind a port.
- The version is done when the architecture check passes.
- In a framework project (Rails, Django, Next.js, Spring, Laravel, Flutter), the framework's own folders are the inbound adapters. Controllers, views, models, jobs and screens stay where the framework wants them, and the check names those folders. The rules and the use cases move into `domain/` and `application/` folders, which the framework code calls, never the other way round.

## Tests by layer

| Layer | Test it with |
|---|---|
| domain | plain unit tests, no mocks, no I/O. Most tests live here. |
| application | the use case run against small in-memory versions of its ports: a real little class, not a mocking script |
| outbound adapters | the real thing (the project's test database or container), because that is where queries and wire formats break |
| inbound adapters | a few end-to-end checks through the real entry point |

## The architecture check

One command, written in `docs/agent/architecture.md`, that runs with the tests. It fails in two cases:

1. A source file is outside the layer folders, the wiring and the tests.
2. An import points outward. A standard library import in the domain is fine and must not trip it.

For the imports, use what the project already has: import-linter (Python), dependency-cruiser or an ESLint boundaries rule (JavaScript, TypeScript), ArchUnit (JVM), NetArchTest or project references (.NET), `internal/` packages or depguard (Go), separate crates (Rust).

Nothing installed? Two searches are enough. Do not add a dependency for this. Put the project's own file types, framework folders, one-file tools, generated code and names in the patterns:

```bash
! git ls-files '*.rs' '*.py' '*.ts' '*.go' | grep -vE '(^|/)(domain|application|adapters)(/|\.[a-z]+$)|(^|/)(main|lib|mod|__init__|settings)\.[a-z]+$|(^|/)tests?/' \
  && ! grep -rnE "(import|from|require|use).*(adapters|django|flask|express|sqlalchemy)" src/domain src/application
```

The first search prints every file that is outside the layers. While it prints any, the check fails.

## Smells

| You see | Do this |
|---|---|
| a source file outside the folder of its layer | move it there, as "Existing projects" says |
| a port in the domain | move it to `application/ports/` |
| the domain imports a framework or a driver | move the I/O to an adapter behind a port |
| a controller holds a business rule | move the rule to the domain; the controller calls a use case |
| a use case builds SQL or calls HTTP | that is an adapter's job |
| an adapter calls another adapter | go through a use case |
| an interface wraps a pure function | delete the interface |
