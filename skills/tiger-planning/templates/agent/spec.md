# v{{N}} spec — {{title}}

- type: {{feature, bugfix, refactor, performance or infra}}
- request: {{the user's own words}}

## Bug

- seen: {{what happens today}}
- expected: {{what should happen}}
- reproduce: `{{command}}`
- cause: {{one sentence: where the wrong decision is made}}

## Behavior

- B1 — {{the exact rule, with real values}}. Example: {{input}} → {{output}}

## Design

Data first, then functions. Engineers build exactly these.

- size: {{how many items, how often it runs, how fast it must answer}}
- settings: {{each new setting and what it is for, or "none"}}
- type `{{Product}}`: `{{name: str}}`
- `{{search_page(products: list[Product], word: str, page_number: int, page_size: int) -> ProductPage}}` in `{{catalog/search.py}}`

## Cases

The decision tree, drawn. Every leaf is a case, and a row of the tests.

```
{{condition}}?
├─ {{answer}} ............ {{the exact result}}   [{{request, code, docs, user or default}}]
├─ {{answer}}
│  └─ {{next condition}}?
│     ├─ {{answer}} ...... {{the exact result}}   [{{source}}]
│     └─ {{answer}} ...... {{the exact result}}   [{{source}}]
└─ {{answer}} ............ {{the exact result}}   [{{source}}]
```

## Acceptance

- A1 — given {{state}}, when {{action}}, then {{result}}
  - verify: `{{command}}` → {{expected}}

## Out of scope

- {{what this version does not do}}

## Decisions

- {{the choice}} — {{why}}
