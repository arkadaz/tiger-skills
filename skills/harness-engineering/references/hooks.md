# Hook Enforcement

Hooks enforce harness workflow gates at the tool level. The skill prompt governs conversational flow (phase ordering, brainstorming before planning). Hooks govern tool-level actions (no code edits before comprehension gate, no commits before tests, no push before verification).

## Architecture

```
.harness-state (JSON, gitignored)     ← skill updates at each phase transition
       ↓ read by
.claude/hooks/*.js (committed)        ← hook scripts check state before allowing tools
       ↓ configured in
.claude/settings.json (committed)     ← hook events wired to scripts
```

The skill writes phase transitions to `.harness-state`. Hook scripts read it to gate actions.

## State File: `.harness-state`

Session-specific state file in project root. Created during bootstrap, gitignored.

```json
{
  "phase": "session-start",
  "docs_read": false,
  "code_quality_loaded": false,
  "codebase_read": false,
  "comprehension_gate": false,
  "tests_passed": false,
  "docs_updated": false,
  "verification_passed": false
}
```

### Phase Values

| Phase | When Set | Code Edits | Commits | Push |
|-------|----------|-----------|---------|------|
| `session-start` | Bootstrap / Phase 1 | blocked | blocked | blocked |
| `clarify` | Phase 2 start | blocked | blocked | blocked |
| `plan` | Phase 4 start | blocked | blocked | blocked |
| `implement` | Phase 5 start | gate on ALL 4: `docs_read` + `code_quality_loaded` + `codebase_read` + `comprehension_gate` | gate on `tests_passed` + `docs_updated` | blocked |
| `verify` | Phase 6 start | allowed | allowed | gate on `verification_passed` |
| `track` | Phase 7 | allowed | allowed | allowed |
| `session-end` | Phase 8 | allowed | allowed | allowed |

### Gate Flags

| Flag | Set When | Unblocks |
|------|----------|----------|
| `docs_read` | Agent reads ALL harness .md files (AGENTS.md, PROGRESS.md, DECISIONS.md, GRAPH.md, codebase-map.md, business/*.md, specs/*.md) | Required for code edits (pre-edit gate) |
| `code_quality_loaded` | Agent invokes code-quality skill and reads all 13 design principles + language rules + examples | Required for code edits (pre-edit gate) |
| `codebase_read` | Agent reads all existing source files, type definitions, and relevant code in the area being modified | Required for code edits (pre-edit gate) |
| `comprehension_gate` | Agent passes the 7-item self-check confirming understanding of types, principles, and rules | Required for code edits (pre-edit gate) |
| `tests_passed` | Test suite runs with zero failures | `git commit` (pre-commit gate) |
| `docs_updated` | Agent updates ALL harness .md files (PROGRESS.md, DECISIONS.md, GRAPH.md, codebase-map.md, business docs) after code changes | `git commit` (pre-commit gate) |
| `verification_passed` | 3-layer pipeline + code quality review passes | `git push` (pre-push gate) |

### Pre-Edit Gate Unlock Sequence

All four flags must be `true` before any code edit is allowed during `implement` phase:

```
1. docs_read            — read ALL harness .md files (know the project state, decisions, flows)
2. code_quality_loaded  — invoke code-quality skill, read principles + rules + examples
3. codebase_read        — glob/grep all types, read all source files in affected area
4. comprehension_gate   — pass 7-item self-check, announce readiness
```

The order matters: read docs first (know what exists and what's decided), then load the quality rules, then read the code (so you know what to reuse), then confirm understanding.

### Pre-Commit Gate Unlock Sequence

Both flags must be `true` before `git commit` is allowed:

```
1. tests_passed   — run test suite, zero failures
2. docs_updated   — update PROGRESS.md, GRAPH.md, codebase-map.md, DECISIONS.md, business docs
```

After any code change, both `tests_passed` and `docs_updated` reset to `false`. The agent must re-run tests AND update docs before the next commit.

## Hook Scripts

### 1. Pre-Edit Gate — `.claude/hooks/pre-edit-gate.js`

Blocks Edit/Write on code files until the agent reaches the `implement` phase AND passes all four gates: docs read, code-quality loaded, codebase read, and comprehension check.

```javascript
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.filePath || '';

    const nonCode = ['.md', '.json', '.toml', '.yaml', '.yml', '.cfg', '.ini', '.env', '.txt', '.lock'];
    if (nonCode.some(ext => filePath.endsWith(ext))) process.exit(0);
    if (filePath.includes('.harness-state') || filePath.includes('.claude/') || filePath.includes('.claude\\')) process.exit(0);
    if (filePath.includes('Makefile') || filePath.includes('.gitignore')) process.exit(0);

    const state = JSON.parse(fs.readFileSync('.harness-state', 'utf8'));
    const codePhases = ['implement', 'verify', 'track', 'session-end'];
    const deny = (reason) => console.log(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
    }));

    if (!codePhases.includes(state.phase)) {
      deny('Harness gate: phase is "' + state.phase + '". Complete clarify/spec/plan phases before editing code. Transition .harness-state phase to "implement" after planning.');
    } else if (state.phase === 'implement' && !state.docs_read) {
      deny('Harness gate: harness docs not read. Read ALL .md files: AGENTS.md, PROGRESS.md, DECISIONS.md, docs/GRAPH.md, docs/codebase-map.md, docs/business/*.md, docs/specs/*.md. Then set docs_read=true in .harness-state.');
    } else if (state.phase === 'implement' && !state.code_quality_loaded) {
      deny('Harness gate: code-quality skill not loaded. Invoke the code-quality skill and read ALL 13 design principles + language-specific rules + examples, then set code_quality_loaded=true in .harness-state.');
    } else if (state.phase === 'implement' && !state.codebase_read) {
      deny('Harness gate: codebase not read. Glob/grep all type definitions, read ALL source files in the affected area, build a type inventory, then set codebase_read=true in .harness-state.');
    } else if (state.phase === 'implement' && !state.comprehension_gate) {
      deny('Harness gate: comprehension gate not passed. Pass the 7-item self-check (types inventory, exact parameter types, 13 principles, violation signals, 11 tooling rules, relevant rules, fix patterns), then set comprehension_gate=true in .harness-state.');
    }
  } catch (e) {
    process.exit(0);
  }
});
```

### 2. Pre-Commit Gate — `.claude/hooks/pre-commit-gate.js`

Blocks `git commit` unless tests have passed AND all harness docs are updated this session.

```javascript
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const state = JSON.parse(fs.readFileSync('.harness-state', 'utf8'));
    const deny = (reason) => console.log(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
    }));

    if (!state.tests_passed) {
      deny('Harness gate: tests have not passed this session. Run the test suite (make test or equivalent), verify zero failures, then set tests_passed=true in .harness-state.');
    } else if (!state.docs_updated) {
      deny('Harness gate: harness docs not updated after code changes. Update ALL relevant .md files: PROGRESS.md (feature state, progress %), GRAPH.md (new/changed code flows), codebase-map.md (new/changed files), DECISIONS.md (if decisions made), docs/business/*.md (if rules changed). Then set docs_updated=true in .harness-state.');
    }
  } catch (e) {
    process.exit(0);
  }
});
```

### 3. Pre-Push Gate — `.claude/hooks/pre-push-gate.js`

Blocks `git push` unless the full verification pipeline has passed.

```javascript
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const state = JSON.parse(fs.readFileSync('.harness-state', 'utf8'));

    if (!state.verification_passed) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Harness gate: verification pipeline not completed. Run Phase 6 (3-layer pipeline: static > runtime > system + code quality review), then set verification_passed=true in .harness-state.'
        }
      }));
    }
  } catch (e) {
    process.exit(0);
  }
});
```

### 4. Session End Check — `.claude/hooks/session-end-check.js`

Reminds the agent about the exit checklist when the session stops.

```javascript
const fs = require('fs');

try {
  const state = JSON.parse(fs.readFileSync('.harness-state', 'utf8'));
  const warnings = [];

  if (state.phase === 'implement' && !state.tests_passed) {
    warnings.push('Tests have not been run this session');
  }
  if (state.phase === 'implement' && !state.verification_passed) {
    warnings.push('Verification pipeline not completed');
  }
  if (!['session-end', 'session-start', 'track'].includes(state.phase)) {
    warnings.push('Session ending mid-phase ("' + state.phase + '") — exit checklist may be incomplete');
  }

  if (warnings.length > 0) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: 'Harness exit warnings:\n' + warnings.map(w => '- ' + w).join('\n') + '\n\nComplete the 8-item exit checklist: make check passes, PROGRESS.md updated, DECISIONS.md updated, commits clean, no debug code, no temp files, startup works, AGENTS.md updated.'
      }
    }));
  }
} catch (e) {
  // No state file — bootstrap hasn't run, nothing to check
}
```

## Settings Configuration

Add this to `.claude/settings.json` (merge with existing settings):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/pre-edit-gate.js",
            "timeout": 5,
            "statusMessage": "Harness: checking phase gate..."
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/pre-commit-gate.js",
            "if": "Bash(git commit*)",
            "timeout": 5,
            "statusMessage": "Harness: checking test gate..."
          },
          {
            "type": "command",
            "command": "node .claude/hooks/pre-push-gate.js",
            "if": "Bash(git push*)",
            "timeout": 5,
            "statusMessage": "Harness: checking verification gate..."
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/session-end-check.js",
            "timeout": 5,
            "statusMessage": "Harness: checking exit state..."
          }
        ]
      }
    ]
  }
}
```

## Phase Transition Commands

The agent updates `.harness-state` at each phase boundary. Use Edit tool to update the JSON:

| Transition | Update |
|-----------|--------|
| Bootstrap complete → Phase 1 | Create file with `phase: "session-start"`, all flags `false` |
| Phase 1 → Phase 2 | `phase: "clarify"` |
| Phase 2/3 → Phase 4 | `phase: "plan"` |
| Phase 4 → Phase 5 | `phase: "implement"`, all implementation flags `false` |
| All harness .md files read | `docs_read: true` |
| Code-quality skill invoked + all references read | `code_quality_loaded: true` |
| All source files in affected area read + type inventory built | `codebase_read: true` |
| 7-item self-check passes | `comprehension_gate: true` |
| Tests pass (any run) | `tests_passed: true` |
| All harness .md files updated after code changes | `docs_updated: true` |
| Code changes after tests/docs | `tests_passed: false`, `docs_updated: false` (reset — must re-run and re-update) |
| Phase 5 → Phase 6 | `phase: "verify"` |
| Verification pipeline passes | `verification_passed: true` |
| Phase 6 → Phase 7 | `phase: "track"` |
| Phase 7 → Phase 8 | `phase: "session-end"` |

## Escape Hatch

For trivial fixes (typo, single-line change) where the full flow is overkill, the agent can fast-track the state:

```json
{
  "phase": "implement",
  "docs_read": true,
  "code_quality_loaded": true,
  "codebase_read": true,
  "comprehension_gate": true,
  "tests_passed": false,
  "docs_updated": false,
  "verification_passed": false
}
```

This skips the phase gate and all four pre-edit gates, but still requires tests + docs update before commit and verification before push. The agent must explicitly acknowledge why it's fast-tracking and note it in the session.

## Post-Edit Resets

After any code change (Edit/Write on code files), these flags should be reset to `false`:
- `tests_passed` — must re-run tests before the next commit
- `docs_updated` — must re-update harness docs before the next commit

This is enforced by instruction (in SKILL.md), not by hook — a PostToolUse hook on Edit would be too noisy and would slow down every edit.
