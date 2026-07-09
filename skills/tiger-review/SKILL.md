---
name: tiger-review
description: The standalone, human-invoked review gate — code quality AND security in one pass (merges the former tiger-reviewer and tiger-security skills). NOT part of the automated workflow (tiger-lead is the single in-loop gate). Runs the project's test suite as a real process, audits the branch diff across seven quality dimensions plus a 10-category vulnerability taxonomy and a secrets scan, validates every finding, records a pass/changes/blocked verdict as git notes (refs/notes/review for quality, refs/notes/security for security findings). Use when the user asks for a code review, "review this diff/branch/commit/MR/PR", "check test quality", a security review/audit, vuln or secrets scan, "is this change safe", or "audit this commit".
---

# Tiger Review — the standalone quality + security gate

One human-invoked skill, two halves that share the same evidence discipline: a **quality audit** (the old reviewer) and a **security audit** (the old security gate). Run both by default; run one half alone when the user asks for only that. **Not in the automated workflow** — tiger-lead is the single automated gate.

## When to use

- Human asks for a code review, diff audit, test-quality check, MR/PR review — quality half (at least).
- Human asks for a security review/audit, vuln scan, secrets scan, "is this safe" — security half (at least).
- Standalone only — never spawned by `/tiger-workflow-dev`.

## Shared contract

**Inputs:** project dir (absolute), target (default `git log -1`; a branch-wide review baselines on `dev`):

```bash
BASE=$(git merge-base dev HEAD 2>/dev/null || git merge-base origin/dev HEAD 2>/dev/null || echo HEAD~1)
git log -p "$BASE"..HEAD   # full patch series — audit ALL intermediate commits
git diff "$BASE"..HEAD     # net change
```

Optional: `tiger/features/<id>/spec.md` + `feature.md` for the business-logic audit (without them, say so plainly and skip that pass).

**Suite run is mandatory.** A real OS process (`./init.sh` or documented path). Code-reading is not evidence. Red suite → automatic non-PASS with failing output quoted in `fixes:`.

**Confidence filter — flag ONLY IF:** code fails to parse/import (demonstrated by running it); logic definitely produces incorrect results (demonstrated or deterministically traced); or a clear guideline violation with the exact rule quoted. Never flag: style opinions, input-dependent "potentials", pre-existing issues, linter-catchable problems, anything without a file:line.

## Quality half (seven dimensions, one deliberate pass each)

| Dimension | What to check |
|---|---|
| Comments are a defect | flag EVERY comment for removal — generated code is comment-free. Sole exceptions: shebang, required lint/type pragma |
| Test gaps | against `docs/tiger-unit-test-best-practice.md` only — no generic "more tests" |
| Silent failures | swallowed exceptions, broad catches, error-hiding defaults |
| Type design | unenforced invariants, leaked internals, stringly-typed state |
| Design quality | the `tiger-code-quality` smells at file:line |
| Guideline compliance | CLAUDE.md, scope_map writes, semantic-commit format, one-commit discipline |
| Simplification | demand the smallest readable code (the write-less delete-list) — flag anything shorter/clearer with behavior preserved |

**Discriminating-check rule:** if a test's inputs cannot distinguish a correct implementation from a plausible wrong one, derive a discriminating input from the spec and run it yourself. Green-but-degenerate suite → CHANGES with the input quoted.

## Security half (branch diff only, never pre-existing issues)

**10-category taxonomy — walk all; state n/a explicitly:** 1 Injection (SQL/command/LDAP/XPath/NoSQL/XXE) · 2 AuthN/AuthZ (broken auth, IDOR, privilege escalation) · 3 Data exposure (hardcoded secrets, sensitive logging, PII) · 4 Crypto (weak algorithms, key management, insecure RNG) · 5 Input validation (missing sanitization, overflows) · 6 Business-logic flaws (races, TOCTOU) · 7 Configuration (insecure defaults, missing headers, permissive CORS) · 8 Supply chain (vulnerable/bumped deps — diff the lockfile) · 9 Code execution (deserialization, pickle/eval) · 10 XSS (reflected/stored/DOM).

**Secrets scan — run all applicable:**

```bash
PATCH=/tmp/tiger-review-$$.patch
git log -p "$BASE"..HEAD > "$PATCH"
grep -nEi '^\+.*(api[_-]?key|secret|passwd|password|token|auth|credential|private[_-]?key|connection[_-]?string)' "$PATCH"
grep -nE '^\+.*(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.)' "$PATCH"
grep -nE '^\+.*(eval\(|exec\(|pickle\.loads|yaml\.load\(|child_process|os\.system|subprocess.*shell=True|dangerouslySetInnerHTML|innerHTML *=)' "$PATCH"
command -v gitleaks >/dev/null && gitleaks detect --log-opts="$BASE..HEAD" --no-banner
command -v semgrep  >/dev/null && semgrep scan --error --quiet
[ -f package.json ] && npm audit --omit=dev || true
command -v bandit   >/dev/null && bandit -q $(git diff --name-only "$BASE"..HEAD -- '*.py') 2>/dev/null || true
```

Suppress a false-positive only via a non-comment mechanism (a `.gitleaksignore` fingerprint or a path allowlist — lockfiles, test fixtures); name it in the report. A private-key block or cloud key ID is NEVER allowlisted by path alone.

**Hardcoded-secret 5-step playbook (verbatim in every such finding):** 1 **Revoke** immediately · 2 **Rotate** · 3 **Delete** from commits/logs/systems · 4 **Investigate** audit logs (who/when/IPs) · 5 **Document** + notify. Grading: local-only branch → `changes`; already pushed → `blocked`.

**Auto-drop (never report, even as minor):** DoS, rate limiting, resource exhaustion, generic input validation without proven impact, open redirect, speculative findings without a concrete path.

## Verdict + notes

| Verdict | Meaning |
|---|---|
| `pass` | Suite green by own run; zero validated findings in the halves that ran |
| `changes` | Validated findings a fix round can address |
| `blocked` | Spec contradiction, pushed secret, or state a retry cannot fix |

Fail closed: an incomplete audit is `changes` or `blocked`, never `pass`.

**Git notes — the only writes (and only when the user asks for the note, or a full gate run):** quality findings → `refs/notes/review`; security findings → `refs/notes/security`. Attach to the code commit, never a board commit:

```bash
git notes --ref=review   add -f -m "grade: <pass|changes|blocked>\nfixes:\n- <file:line — finding + concrete fix, or 'none'>" <commit>
git notes --ref=security add -f -m "grade: <pass|changes|blocked>\nfixes:\n- <file:line — finding + concrete fix, or 'none'>" <commit>
```

**End every report with EXACTLY these lines, last** (machine-read; absent/garbled fails closed to CHANGES). Emit the line(s) for the half(ves) that ran; each must agree with its `grade:`:

```
TIGER_REVIEW: <PASS|CHANGES|BLOCKED>
TIGER_SECURITY: <PASS|CHANGES|BLOCKED>
```

## Works with

grill → tiger-lead → **[human invokes tiger-review standalone]** → update-docs. Independent of the loop; the human merges its fix list into the next round.

## Git interactions

- **Reads:** `git log -p`, `git diff`, `git show`, `feature_list.json`, touched files, spec artifacts, existing notes.
- **Writes:** `refs/notes/review` and/or `refs/notes/security` on the reviewed commit — nothing else.
- **Never:** `git commit`, push, branch ops, board writes, `progress.md`, code/test edits.

## Standalone use

Invoke by intent ("review this commit/branch/MR", "security-audit this diff"). Supply: project dir, target, optional spec path. Runs the suite for real, audits the requested half(ves), validates findings, prints the report, ends with the token line(s).

## References

- `docs/tiger-unit-test-best-practice.md` — test quality standard
- `tiger-code-quality` skill — design principles + write-less delete-list
- `docs/tiger-git-best-practice.md` — commit and note contract
