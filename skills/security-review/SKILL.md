---
name: security-review
description: Trigger-based security review — when a change touches a security-sensitive surface (auth, untrusted input, network/file I/O, SQL/shell, deserialization, crypto, secrets, a new dependency), audit it against the common vulnerability classes (injection, broken authz, secrets exposure, crypto misuse, unsafe deserialization, SSRF/path traversal, sensitive-data logging, dependency CVEs, DoS) and report findings by severity. Use before merging any security-relevant change.
---

# Security Review

Most changes are not security-sensitive; some are dangerous. This skill runs **only when a trigger fires**, so the gate is cheap when it doesn't matter and present when it does. It is a reasoning-based audit — if the target project ships a SAST or dependency-CVE scanner, run it too and fold the results in, but never skip the manual reasoning.

## Triggers — run the security review if ANY is true

Inspect the diff. The review is **required** when the change:

- Handles **authentication or authorization** (login, sessions, tokens, roles, permission checks)
- Accepts **untrusted / external input** (HTTP params, request bodies, file uploads, CLI args, env, webhooks, message queues)
- Builds a **query or command** from data (SQL/NoSQL, shell/subprocess, `eval`, template, LDAP, XPath)
- Performs **network or file I/O** (outbound requests, URL fetch, path construction, file read/write, redirects)
- **Deserializes** data (pickle, YAML, JSON→object, XML, protobuf from an untrusted source)
- Touches **cryptography, secrets, or credentials** (hashing, encryption, signing, tokens, API keys, passwords)
- Adds or upgrades a **dependency** (new package, version bump, new transitive surface)
- Changes **security-relevant config** (CORS, CSP, TLS, cookie flags, file permissions, IAM, firewall)

If none fire, the gate is marked `skipped (no security-sensitive surface)` and no security-reviewer is spawned.

## The Vulnerability Checklist

For each category, ask the diagnostic question against the changed code:

| # | Category | Diagnostic question |
|---|----------|---------------------|
| 1 | **Injection** | Is any query/command/template built by concatenating untrusted data instead of parameterized / escaped APIs? (SQLi, command injection, XSS, template injection, LDAP/XPath) |
| 2 | **Broken authz / authn** | Is every sensitive action checked for *both* "are you logged in" *and* "are you allowed"? Any IDOR (object referenced by id with no ownership check)? Missing-default-deny? |
| 3 | **Secrets exposure** | Any hardcoded key/password/token? Secret read from code instead of config/secret store? Secret echoed into logs, errors, or responses? |
| 4 | **Sensitive-data handling** | Is PII / credentials / tokens logged, cached, or returned where it shouldn't be? Transmitted without TLS? Stored unencrypted? |
| 5 | **Crypto misuse** | Weak or homemade crypto, ECB mode, static IV/salt, MD5/SHA1 for passwords (vs bcrypt/argon2), predictable randomness for security tokens? |
| 6 | **Unsafe deserialization** | Untrusted data into `pickle`/`yaml.load`/native deserializers that can execute code or instantiate arbitrary types? |
| 7 | **SSRF / path traversal** | User-controlled URL fetched server-side? User-controlled path joined without normalization/allow-list (`../` escape)? Open redirect? |
| 8 | **Input validation** | Is external data validated/parsed into typed domain objects at the boundary, or trusted raw into business logic? |
| 9 | **Dependency risk** | New/updated dependency with known CVEs, unmaintained, or typosquat-suspicious? Lockfile updated? |
| 10 | **Resource / DoS** | Unbounded loop/allocation/recursion on user input? Missing size/rate limits? Regex catastrophic backtracking (ReDoS)? Zip/billion-laughs bomb? |
| 11 | **Unsafe defaults** | Debug mode, verbose errors, permissive CORS/`*`, world-readable files, default creds, disabled TLS verification left on? |
| 12 | **Error handling leak** | Do error paths leak stack traces, queries, internal hosts, or secrets to the client? |

## Severity

| Severity | Meaning | Verdict impact |
|----------|---------|----------------|
| **CRITICAL** | Directly exploitable now (e.g. SQLi on user input, hardcoded prod secret, auth bypass, RCE via deserialization) | → REJECTED, fix before anything else |
| **HIGH** | Exploitable with a condition, or serious data exposure | → CHANGES REQUESTED |
| **MEDIUM** | Weakness needing an unlikely precondition, or defense-in-depth gap | → fix before merge or document deferral |
| **LOW** | Hardening suggestion; no demonstrated path | → note it |

Map to the conductor's loop: any CRITICAL or HIGH blocks (loops back to the generator); MEDIUM/LOW may be deferred with an explicit, recorded decision.

## Report Template

```markdown
# Security Review: <feature>

security-review invoked: YES — N categories checked, C critical, H high

## Triggers that fired
- <e.g. accepts untrusted HTTP input; builds a SQL query>

## Findings
### <category> — `file:line` — [CRITICAL/HIGH/MEDIUM/LOW]
- **Vulnerability:** <what it is and how it's exploited>
- **Impact:** <what an attacker gains>
- **Fix:** <concrete remediation — parameterize, validate, move to secret store, pin version, …>

## Scanned (if available)
- <SAST / dependency-audit tool + result, or "none available in project">

## Verdict
- [ ] APPROVED — no CRITICAL/HIGH; MEDIUM/LOW noted
- [ ] CHANGES REQUESTED (HIGH present)
- [ ] REJECTED (CRITICAL present)

## Board Update
- feature <id> → security verdict: <verdict>
- evidence: security review — N categories, C critical, H high (<date>)
```

## Rules

- **Trigger-gated** — if no trigger fires, skip with a one-line reason; do not invent a security surface that isn't there
- **Concatenated untrusted data into a query/command/template = CRITICAL injection** until proven parameterized
- **Hardcoded secret in committed code = CRITICAL**, no exceptions
- **Run the project's scanner if it has one** — manual reasoning plus tools, never tools alone
- **You are the checker** — report the vulnerability and the fix; never edit the code under review
- **Emit the proof line** with real counts, or the conductor rejects the review and re-spawns you
