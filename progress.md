# Claude Progress

## Current State
- **Latest commit:** dffe034 (Update marketplace sha)
- **Branch:** main
- **Verification:** passing (`./init.sh` — 49/49 checks pass, 2026-06-01)
- **Last updated:** 2026-06-01

## Completed
- [x] Rewrote harness-engineering SKILL.md from scratch based on walkinglabs 5-subsystem model
- [x] Created 6 harness-engineering sub-skills (bootstrap, session, feature, verify, review, diagnose)
- [x] Created 6 new reference files (five-subsystems, diagnostic-loop, minimal-pack, session-lifecycle, verification-pipeline, scope-control)
- [x] Deleted 7 old harness-engineering reference files
- [x] Rewrote code-quality SKILL.md as router with sub-skill routing
- [x] Created 5 code-quality sub-skills (review, audit, fix, python, rust)
- [x] Updated plugin.json with all new skill paths (v4.0.0)
- [x] Updated AGENTS.md to reflect new structure
- [x] Filled commands/review-branch.md with review protocol
- [x] Updated feature_list.json with real features, WIP=1 enforced
- [x] Fixed init.sh — now runs real validation: JSON validity, skill/agent frontmatter, path resolution, harness health

## In Progress
- [ ] harness-rewrite (85% — all files created, verification criteria met, cross-file inconsistencies remain)
  - **Active since:** 2026-06-01
  - **Remaining:** Fix number inconsistencies in code-quality review files, update agents to reference new skill names, fix hooks.json, fix marketplace skill count, fix code-architect role

## Known Issues
- **Cross-file number inconsistency** — code-quality:review SKILL.md says "25 items (13+12)" but actually lists 27 items (16+11). references/review-agent.md says "/19 items" in template. The code-quality router lists 16 principles but the review sub-skill says 13.
  - **Discovered:** 2026-06-01
  - **Fix location:** skills/code-quality-review/SKILL.md:30, skills/code-quality/references/review-agent.md:64

- **Agents don't reference new sub-skill names** — planner.md references no skills. generator.md doesn't name code-quality:python/rust. executor.md duplicates verification instead of invoking harness-engineering:verify. healer.md duplicates diagnostic loop instead of invoking harness-engineering:diagnose. code-architect.md duplicates audit instead of invoking code-quality:audit.
  - **Discovered:** 2026-06-01
  - **Fix location:** agents/planner.md, agents/generator.md, agents/executor.md, agents/healer.md, agents/code-architect.md

- **hooks.json has no executable hook scripts** — 5 hook entries exist with descriptions but no commands/scripts to enforce them.
  - **Discovered:** 2026-06-01
  - **Fix location:** hooks/hooks.json

- **marketplace.json says "12 skills total" but 13 exist** — autoDiscovery lists 13 skill directories.
  - **Discovered:** 2026-06-01
  - **Fix location:** .claude-plugin/marketplace.json:4

- **code-architect agent has no defined position in agent workflow** — planner/healer/generator/executor all say "4-agent workflow" but code-architect is a 5th agent with no integration protocol.
  - **Discovered:** 2026-06-01
  - **Fix location:** agents/planner.md:10, agents/code-architect.md

- **Diagnose SKILL.md duplicates references/diagnostic-loop.md** — both contain same 5-layer attribution model. DRY violation.
  - **Discovered:** 2026-06-01
  - **Fix location:** skills/harness-engineering-diagnose/SKILL.md (should reference, not duplicate)

- **harness-engineering:review and code-quality:review overlap** — both spawn independent review agents checking design principles. No definition of which to invoke when.
  - **Discovered:** 2026-06-01
  - **Fix location:** skills/harness-engineering-review/SKILL.md, skills/code-quality-review/SKILL.md

- **.mcp.json has empty mcpServers** — plugin.json references it for auto-discovery but it contains no servers.
  - **Discovered:** 2026-06-01
  - **Fix location:** .mcp.json

- **claude-progress.md previously claimed "Known Issues: None"** — was false (now corrected).
  - **Discovered:** 2026-06-01
  - **Status:** Fixed in this commit

## Failure Log

| Date | Task | Failure | Layer | Fix | Recurred? |
|------|------|---------|-------|-----|-----------|
| 2026-06-01 | WIP=1 | 3 features marked in_progress | State | Sequenced features, only harness-rewrite active | No |
| 2026-06-01 | Verification | init.sh was a no-op placeholder | Verification | Rewrote init.sh with real JSON/frontmatter/path checks | No |
| 2026-06-01 | State | claude-progress.md claimed no known issues | State | Updated with real known issues | No |
| 2026-06-01 | Cross-file | Review item counts disagree (13/16/19/25/27) | Instructions | Fix in progress | — |

## Next Steps (ordered by priority)
1. Fix number inconsistencies in code-quality:review SKILL.md and review-agent.md reference
2. Update all 5 agents to reference new sub-skill names
3. Make hooks.json functional with executable hook scripts
4. Fix marketplace.json skill count (12 → 13)
5. Define code-architect position in the agent workflow
6. Resolve review skill overlap between harness-engineering and code-quality
7. DRY up diagnose sub-skill vs reference
8. Populate or remove .mcp.json
9. Commit all changes
