---
event: PreToolUse
tool: Agent
permission: allow
---

PRE-AGENT-SPAWN GATE: Before spawning a pipeline agent (code-architect, generator, reviewer, security-reviewer, executor, cartographer), confirm the conductor gates are satisfied: (1) GATE 1 — for a build request, a HUMAN-approved spec exists (else run harness-engineering-grill first); (2) GATE 3 — exactly one feature is in_progress (WIP=1). The flow is LINEAR, one feature at a time: code-architect plans where the code goes → generator builds the code + unit tests in its OWN git worktree (.tiger-wt/<id>, branch tiger/<id>) → reviewer (quality + correctness) + security-reviewer (only if a security trigger fires: auth, untrusted input, query/command building, network/file I/O, deserialization, crypto/secrets, new dependency) — ANY not-pass loops back to the generator, repeat UNTIL pass → executor authors + runs the E2E — not-pass loops back to the generator, UNTIL pass → generator merges the worktree to main and resolves conflicts → cartographer (update-docs) refreshes CODEBASE_MAP.md, flips feature state to passing, and writes release_docs.html + business.html. Each agent must begin its report with its required-skill proof line, or the handoff is rejected and the agent re-spawned. Only the cartographer (update-docs) writes feature_list.json / progress.md / CODEBASE_MAP.md. Do not skip gates to reach the pipeline faster.
