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
  "comprehension_gate": false,
  "tests_passed": false,
  "verification_passed": false
}
```

### Phase Values

| Phase | When Set | Code Edits | Commits | Push |
|-------|----------|-----------|---------|------|
| `session-start` | Bootstrap / Phase 1 | blocked | blocked | blocked |
| `clarify` | Phase 2 start | blocked | blocked | blocked |
| `plan` | Phase 4 start | blocked | blocked | blocked |
| `implement` | Phase 5 start | gate on `comprehension_gate` | gate on `tests_passed` | blocked |
| `verify` | Phase 6 start | allowed | allowed | gate on `verification_passed` |
| `track` | Phase 7 | allowed | allowed | allowed |
| `session-end` | Phase 8 | allowed | allowed | allowed |

### Gate Flags

| Flag | Set When | Unblocks |
|------|----------|----------|
| `comprehension_gate` | Agent reads all design principles + language rules + passes 7-item self-check | Edit/Write on code files during `implement` phase |
| `tests_passed` | Test suite runs with zero failures | `git commit` |
| `verification_passed` | 3-layer pipeline + code quality review passes | `git push` |

## Hook Scripts

### 1. Pre-Edit Gate — `.claude/hooks/pre-edit-gate.js`

Blocks Edit/Write on code files until the agent reaches the `implement` phase AND passes the comprehension gate.

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

    if (!codePhases.includes(state.phase)) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Harness gate: phase is "' + state.phase + '". Complete clarify/spec/plan phases before editing code. Transition .harness-state phase to "implement" after planning.'
        }
      }));
    } else if (state.phase === 'implement' && !state.comprehension_gate) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Harness gate: comprehension gate not passed. Read all 13 design principles + language rules + examples, pass the 7-item self-check, then set comprehension_gate=true in .harness-state.'
        }
      }));
    }
  } catch (e) {
    process.exit(0);
  }
});
```

### 2. Pre-Commit Gate — `.claude/hooks/pre-commit-gate.js`

Blocks `git commit` unless tests have passed this session.

```javascript
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const state = JSON.parse(fs.readFileSync('.harness-state', 'utf8'));

    if (!state.tests_passed) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Harness gate: tests have not passed this session. Run the test suite (make test or equivalent), verify zero failures, then set tests_passed=true in .harness-state.'
        }
      }));
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
| Phase 4 → Phase 5 | `phase: "implement"`, `comprehension_gate: false` |
| Comprehension gate passes | `comprehension_gate: true` |
| Tests pass (any run) | `tests_passed: true` |
| Code changes after tests passed | `tests_passed: false` (reset — must re-run) |
| Phase 5 → Phase 6 | `phase: "verify"` |
| Verification pipeline passes | `verification_passed: true` |
| Phase 6 → Phase 7 | `phase: "track"` |
| Phase 7 → Phase 8 | `phase: "session-end"` |

## Escape Hatch

For trivial fixes (typo, single-line change) where the full flow is overkill, the agent can fast-track the state:

```json
{
  "phase": "implement",
  "comprehension_gate": true,
  "tests_passed": false,
  "verification_passed": false
}
```

This skips the phase gate but still requires tests before commit and verification before push. The agent must explicitly acknowledge why it's fast-tracking and note it in the session.

## Test Gate Reset

After any code change (Edit/Write on code files), `tests_passed` should be reset to `false`. The agent must re-run tests before the next commit. This is enforced by instruction (in SKILL.md), not by hook — a PostToolUse hook on Edit would be too noisy and would slow down every edit.
