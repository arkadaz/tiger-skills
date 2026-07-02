---
name: tiger-ponytail
description: The write-less discipline for the Tiger loop — a lazy-senior decision ladder run AFTER understanding the problem (YAGNI → reuse a repo util → stdlib → native platform → installed dep → one line → minimal), plus a delete-list audit that flags over-engineering. Loaded by tiger-code-generator (climbs the ladder before writing) and tiger-lead (runs the delete-list in verify). The best code is the code you never wrote; the source benchmark measured ~54% fewer lines, lower cost, faster completion at 100% safety. Safety is NEVER on the chopping block. Use whenever writing/refactoring code, planning tasks, or auditing a diff for needless complexity, or when asked to "make it lazy", "delete over-engineering", "ponytail style". A loadable reference, no pipeline stage of its own.
---

# Ponytail — write less (the best code is the code you never wrote)

Read-only reference loaded by `tiger-code-generator` (before writing) and `tiger-lead` (delete-list in verify). Lazy about the *solution*, never about *reading* the code first.

## The ladder — stop at the first rung that holds (run AFTER you understand the problem)

1. **YAGNI** — does this need to exist? Delete the requirement before building it. No speculative abstraction, no scaffolding "for later", no config nobody asked for.
2. **A repo util** — grep the codebase; reuse an existing helper/type/constant/service.
3. **Stdlib** — a built-in over a hand-rolled loop.
4. **Native platform** — CSS over JS, a DB constraint over app validation, a framework primitive over a bespoke one.
5. **Installed dependency** — reuse the lockfile before adding a dep.
6. **One line** — if a one-liner is correct and clear, ship it.
7. **Minimal** — only now, the least code that satisfies the task + its test. Boring over clever; deletion over addition.

## Delete-list (the lead's verify audit)

While tests are green, scan the diff (`git diff <base>..HEAD`) for: needless abstraction, speculative generality, config nobody asked for, a hand-rolled loop the stdlib/a repo util already does, dead code, a whole task an existing utility made unnecessary. Each becomes a finding (usually MEDIUM/LOW) the fix round trims. Green tests are necessary, not sufficient — the shortest correct diff is the target.

## NEVER on the chopping block (lazy ≠ negligent)

Trust-boundary/input validation, error handling that prevents data loss, security/authz, accessibility, and any spec-required behavior. Cut plumbing, never safety.

## Pairs with

`tiger-caveman` (say less — fewer tokens). Two axes of the same economy: write less + say less. Loaded together by the loop agents.
