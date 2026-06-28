---
name: tiger-security
description: Standalone, human-invoked security gate — the v2 automated workflow does NOT run this in-loop; a human invokes it on demand to audit any branch or commit. Use whenever the user mentions security review, security audit, vulnerability scan, secrets scan, leaked credential, hardcoded API key, "is this change safe", or wants a security pass over a diff, commit, or branch.
context: fork
agent: tiger-skills:tiger-security
---

# Tiger Security Gate

Standalone, human-invoked gate. Audits the feature branch diff against a 10-category vulnerability taxonomy plus a secrets/hygiene checklist using real executed checks. Records its verdict as a namespaced git note (`refs/notes/security`) on the target commit. NOT in the v2 automated workflow.

Full procedure: agents/tiger-security.md — this skill is the contract + how to run it.

## When to use

- Human asks for a security review, audit, vuln scan, or "is this safe".
- Secrets, leaked credentials, or hardcoded API keys suspected in a diff or commit.
- Any time, on any branch — completely standalone; the workflow never calls it.

## Contract

**Scope — branch diff only (not pre-existing issues). Baseline on `dev` (the integration trunk), never `main`.**

```bash
BASE=$(git merge-base dev HEAD 2>/dev/null || git merge-base origin/dev HEAD 2>/dev/null || echo HEAD~1)
git log -p "$BASE"..HEAD   # full patch series — audit ALL intermediate commits
git diff "$BASE"..HEAD     # net change
```

Audit the patch series, not just the net diff — a secret added then deleted is still leaked in history.

**10-category taxonomy (walk all; state n/a explicitly):**

| # | Category |
|---|---|
| 1 | Injection (SQL, command, LDAP, XPath, NoSQL, XXE) |
| 2 | Authentication & Authorization (broken auth, IDOR, privilege escalation) |
| 3 | Data Exposure (hardcoded secrets, sensitive logging, PII) |
| 4 | Cryptographic Issues (weak algorithms, key management, insecure RNG) |
| 5 | Input Validation (missing validation, sanitization, buffer overflows) |
| 6 | Business Logic Flaws (race conditions, TOCTOU) |
| 7 | Configuration Security (insecure defaults, missing headers, permissive CORS) |
| 8 | Supply Chain (vulnerable or bumped deps — diff the lockfile) |
| 9 | Code Execution (RCE via deserialization, pickle/eval) |
| 10 | XSS (reflected, stored, DOM-based) |

**Secrets scan — run all applicable:**

```bash
PATCH=/tmp/tiger-security-$$.patch
git log -p "$BASE"..HEAD > "$PATCH"
grep -nEi '^\+.*(api[_-]?key|secret|passwd|password|token|auth|credential|private[_-]?key|connection[_-]?string)' "$PATCH"
grep -nE '^\+.*(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.)' "$PATCH"
grep -nE '^\+.*(eval\(|exec\(|pickle\.loads|yaml\.load\(|child_process|os\.system|subprocess.*shell=True|dangerouslySetInnerHTML|innerHTML *=)' "$PATCH"
command -v gitleaks >/dev/null && gitleaks detect --log-opts="$BASE..HEAD" --no-banner
command -v semgrep  >/dev/null && semgrep scan --error --quiet
[ -f package.json ] && npm audit --omit=dev || true
command -v bandit   >/dev/null && bandit -q $(git diff --name-only "$BASE"..HEAD -- '*.py') 2>/dev/null || true
```

**Suppress a false-positive only via a non-comment mechanism** (inline `tiger:allow`/comment markers are banned — generated code is comment-free): a repo-root `.gitleaksignore` fingerprint (`commit:file:rule:line`), or a path allowlist (lockfiles, test fixtures). Name the mechanism in the report. A private-key block or cloud key ID is NEVER allowlisted by path alone.

**Hardcoded-secret 5-step playbook (include verbatim in every hardcoded-secret finding):**

1. **Revoke** immediately
2. **Rotate** — generate and deploy new secrets
3. **Delete** — remove leaked secrets from commits, logs, systems
4. **Investigate** audit logs (who, when, which IPs)
5. **Document** and notify dependent teams

Secret grading: local-only branch → `changes`; already pushed to remote → `blocked`.

**Verdict semantics:**

| Grade | Meaning |
|---|---|
| `pass` | Zero validated findings; secrets checklist clean |
| `changes` | Finding(s) the generator can fix by editing code on the branch |
| `blocked` | Finding only a human can remediate, or audit cannot run |

Fail closed: incomplete audit → `changes` or `blocked`, never `pass`.

**False-positive exclusions (auto-drop; never report even as minor):**
DoS, rate limiting, memory/CPU exhaustion, generic input validation without proven impact, open redirect, speculative findings without a concrete path.

**Machine token — always the last line of the report:**

```
TIGER_SECURITY: <PASS|CHANGES|BLOCKED>
```

## Works with

Human invokes standalone → me → findings printed + optional `refs/notes/security` note. The v2 workflow does not call this gate. `tiger-reviewer` writes `refs/notes/review` independently on the same commit (no conflict).

## Git interactions

- **Reads:** `git log -p`, `git diff`, `git show`, repo files for context.
- **Writes:** `refs/notes/security` only — attach to the generator's code commit (never a board commit):
  ```bash
  git notes --ref=security add -f -m "grade: <pass|changes|blocked>\nfixes:\n- <file:line finding or none>" <commit>
  ```
- **Never:** commits, `feature_list.json`, `progress.md`, code edits, pushes.

## Standalone use

Invoke by asking for "a security review of `<target>`" — runs in the owned `tiger-security` subagent (`context: fork`).

Supply: absolute project path + target (branch, commit range `A..B`, single commit, or "working tree").

Report is printed only. Write the `--ref=security` git note only if the user explicitly requests it.
