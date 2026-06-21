#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

deny() {
  local message="$1"
  printf '{"hookSpecificOutput":{"permissionDecision":"deny"},"systemMessage":"%s"}\n' "$message" >&2
  exit 2
}

if ! command -v python3 >/dev/null 2>&1; then
  deny "Tiger rm guard blocked Bash because python3 is required to parse hook input safely."
fi

HOOK_INPUT="$input" python3 - <<'PY'
import json
import os
import re
import shlex
import sys


def deny(message):
    print(
        json.dumps(
            {
                "hookSpecificOutput": {"permissionDecision": "deny"},
                "systemMessage": message,
            }
        ),
        file=sys.stderr,
    )
    sys.exit(2)


raw = os.environ.get("HOOK_INPUT", "")
try:
    payload = json.loads(raw or "{}")
except json.JSONDecodeError:
    deny("Tiger rm guard blocked Bash because hook input was not valid JSON.")

if payload.get("tool_name") != "Bash":
    sys.exit(0)

tool_input = payload.get("tool_input") or {}
command = str(tool_input.get("command") or "")

# Detect an actual `rm` command word the way bash would parse it, so quote and
# backslash obfuscation cannot smuggle it past us. Earlier versions stripped
# quoted segments to a SPACE, which split `"r"m` into `r m` and let it through;
# bash collapses `"r"m`, `r''m`, `r\m`, `rm$()` all to `rm`. We mirror that.
#
# Steps:
#   1. Drop command-substitution / param-expansion WRAPPERS so `rm$()` collapses
#      to `rm`. The body of a `$(...)`/backtick substitution is itself a command
#      that runs, so it is scanned separately (substitution_bodies) — otherwise
#      `$(echo rm) -rf x` would walk straight through.
#   2. shlex.split (POSIX) word-splits exactly like bash and removes quoting,
#      so `"r"m -rf x` -> ['rm', '-rf', 'x'].
#   3. A token that still contains a space was a quoted *argument* (e.g.
#      -m "fix: rm dead code"), never a command word — skip it. A space-free
#      token is split on shell metacharacters so `(rm` and `find -exec rm`
#      are still caught, and any piece equal to `rm` or ending in `/rm` blocks.
#
# This guard is a speed bump, not a sandbox: it blocks the `rm` token, not every
# deletion path (os.remove, find -delete, git clean, truncate, > redirection), it
# does not peer inside a nested interpreter (bash -c '...', sh -c, eval, a
# base64|sh pipe) — rm hidden in a string passed to another shell still runs — and
# it does not decode param-expansion defaults (${x:-rm}) or doubly-nested
# substitutions. It DOES now scan one level of $(...)/backtick command bodies.

META_SPLIT = re.compile(r"[();|&<>{}]+")
ANSI_C = re.compile(r"\$'((?:\\.|[^'])*)'")


def decode_ansi_c(text):
    # bash ANSI-C quoting: $'\x72\x6d' -> rm, $'\162\155' -> rm. shlex does not
    # decode these, so without this an attacker (or an over-clever model) could
    # spell rm in hex/octal and slip past. Decode the escapes back to text first,
    # preserving adjacency so r$'\x6d' collapses to rm.
    def repl(match):
        inner = match.group(1)
        try:
            return inner.encode("utf-8", "surrogatepass").decode("unicode_escape")
        except Exception:
            return inner  # at least drop the $'' wrapper
    return ANSI_C.sub(repl, text)


def strip_expansions(text):
    text = re.sub(r"\$\([^)]*\)", "", text)
    text = re.sub(r"`[^`]*`", "", text)
    text = re.sub(r"\$\{[^}]*\}", "", text)
    return text


def substitution_bodies(text):
    # A command substitution body is itself a command that runs: $(echo rm) and
    # `echo rm` both expand to the word `rm`, so `$(echo rm) -rf x` really deletes.
    # strip_expansions() removes the wrapper (so rm$() collapses to rm for the
    # outer scan), which would walk an rm hidden in the body straight through —
    # so we also scan each body for an rm command word. One level covers the
    # common bypass; deeply nested $( $( ... ) ) falls under the nested-interpreter
    # gap below. Param-expansion defaults (${x:-rm}) are NOT decoded and remain a gap.
    bodies = re.findall(r"\$\(([^)]*)\)", text)
    bodies += re.findall(r"`([^`]*)`", text)
    return bodies


def is_rm_word(token):
    if " " in token:  # had spaces => was a quoted argument, not a command word
        return False
    for piece in META_SPLIT.split(token):
        if piece == "rm" or piece.endswith("/rm"):
            return True
    return False


def tokenize(text):
    try:
        return shlex.split(text)
    except ValueError:
        # Unbalanced quotes or a construct shlex can't parse: collapse quoting
        # characters by joining (so `"r"m` -> `rm`) and fall back to whitespace split.
        return re.sub(r"""['"\\]""", "", text).split()


decoded = decode_ansi_c(command)
tokens = tokenize(strip_expansions(decoded))
for body in substitution_bodies(decoded):
    tokens += tokenize(body)

if any(is_rm_word(token) for token in tokens):
    deny(
        "Tiger rm guard blocked a Bash command invoking rm before execution. "
        "Use a non-destructive command, or ask a human to perform deletion explicitly. "
        "Note: this guard is a speed bump, not a sandbox — it does not stop os.remove or other deletion paths."
    )
PY
