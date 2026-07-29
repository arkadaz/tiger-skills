#!/usr/bin/env python3
"""Live human view of a headless `claude -p --output-format stream-json --verbose` run.

Usage:  claude -p --output-format stream-json --verbose … 2>&1 | stream-view.py [--raw run.jsonl]

`claude -p` in plain text mode prints NOTHING until the whole run ends, which hides every
workflow stage while it happens. In stream-json mode it emits one JSON event per line —
this filter turns those into one compact, timestamped line per event so the benchmark
console shows EVERY stage as it runs (workflow launch, each agent spawn, each agent's
tools, the final result), while `--raw` mirrors the untouched NDJSON for post-mortem.

Fail-open by design: an unparseable line is printed verbatim rather than dropped, so a
format change degrades the view instead of blinding the run.
"""
import argparse
import json
import sys
import time

START = time.monotonic()

# A Windows console defaults to cp1252 and would CRASH on the glyphs below, killing the run
# it exists to observe. Force UTF-8 with replacement; fall back to ASCII markers if even that
# is refused.
ICONS = {"sys": "*", "say": "|", "run": ">", "ok": "+", "err": "!", "end": "#", "raw": "."}
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    ICONS = {"sys": "⚙", "say": "💬", "run": "▶", "ok": "✓", "err": "✗", "end": "■", "raw": "·"}
except Exception:
    pass


def stamp():
    return f"[+{int(time.monotonic() - START):5d}s]"


def clip(text, n):
    s = " ".join(str(text).split())
    return s if len(s) <= n else s[:n] + "…"


def describe_tool(name, args):
    a = args if isinstance(args, dict) else {}
    if name in ("Task", "Agent"):
        who = a.get("subagent_type") or a.get("agent_type") or a.get("name") or "agent"
        return f"SPAWN {who} — {clip(a.get('description') or a.get('prompt') or '', 90)}"
    if name == "Workflow":
        return f"WORKFLOW {clip(a.get('name') or a.get('scriptPath') or a.get('description') or 'inline script', 90)}"
    if name == "Bash":
        return f"$ {clip(a.get('command'), 110)}"
    if name in ("Read", "Write", "Edit", "NotebookEdit"):
        return f"{name.lower()} {clip(a.get('file_path'), 90)}"
    if name in ("Grep", "Glob"):
        return f"{name.lower()} {clip(a.get('pattern'), 60)}"
    if name == "TodoWrite":
        return "todo update"
    return clip(json.dumps(a, ensure_ascii=False), 100) if a else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", help="mirror every raw line to this file")
    args = ap.parse_args()
    raw = open(args.raw, "w", encoding="utf-8") if args.raw else None

    # A subagent's events carry parent_tool_use_id; label them so parallel coders are
    # distinguishable in the flat stream.
    labels = {}

    for line in sys.stdin:
        line = line.rstrip("\n")
        if raw:
            raw.write(line + "\n")
            raw.flush()
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except Exception:
            print(f"{stamp()} | {clip(line, 200)}", flush=True)
            continue
        if not isinstance(ev, dict):
            continue

        etype = ev.get("type")
        parent = ev.get("parent_tool_use_id")
        tag = f"[{labels.get(parent, 'sub')}]" if parent else ""

        if etype == "system":
            sub = ev.get("subtype")
            if sub == "init":
                print(f"{stamp()} {ICONS['sys']} session start — model={ev.get('model')} tools={len(ev.get('tools') or [])} "
                      f"agents={len(ev.get('agents') or [])}", flush=True)
            elif sub == "task_started":
                print(f"{stamp()} {ICONS['run']} TASK START {clip(ev.get('task_id'), 20)}", flush=True)
            elif sub == "task_progress":
                # The workflow runtime reports its CURRENT STAGE here (description = "<phase>: <prompt
                # head>"), which is the only live view of a backgrounded workflow. Print each distinct
                # stage once, with its running cost, instead of one line per poll.
                stage = clip(ev.get("description") or "", 90)
                u = ev.get("usage") or {}
                key = stage.split(":")[0].strip().lower()
                if key and key != labels.get("_stage"):
                    labels["_stage"] = key
                    print(f"{stamp()} {ICONS['sys']} STAGE {stage}", flush=True)
                elif (u.get("tool_uses") or 0) and (u.get("tool_uses") or 0) % 25 == 0:
                    print(f"{stamp()} {ICONS['raw']} …{key}: {u.get('tool_uses')} tool uses, "
                          f"{round((u.get('total_tokens') or 0) / 1000)}k tokens", flush=True)
            elif sub in ("hook_started", "hook_response", "thinking_tokens", "background_tasks_changed"):
                pass  # harness noise — not a stage
            else:
                print(f"{stamp()} {ICONS['sys']} {sub} {clip(ev.get('message') or '', 120)}", flush=True)
            continue

        if etype == "rate_limit_event":
            info = ev.get("rate_limit_info") or {}
            if info.get("status") not in ("allowed", None):
                print(f"{stamp()} {ICONS['err']} rate limit: {info.get('status')} ({info.get('rateLimitType')})", flush=True)
            continue

        if etype == "assistant":
            for block in (ev.get("message") or {}).get("content") or []:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "text" and block.get("text", "").strip():
                    print(f"{stamp()} {tag}{ICONS['say']} {clip(block['text'], 240)}", flush=True)
                elif block.get("type") == "tool_use":
                    name = block.get("name", "?")
                    desc = describe_tool(name, block.get("input"))
                    if name in ("Task", "Agent"):
                        who = (block.get("input") or {}).get("subagent_type") or "agent"
                        labels[block.get("id")] = str(who).split(":")[-1]
                    print(f"{stamp()} {tag}{ICONS['run']} {name}: {desc}", flush=True)
            continue

        if etype == "user":
            for block in (ev.get("message") or {}).get("content") or []:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    content = block.get("content")
                    if isinstance(content, list):
                        content = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
                    text = clip(content or "", 160)
                    mark = ICONS["err"] if block.get("is_error") else ICONS["ok"]
                    if block.get("is_error") or text:
                        print(f"{stamp()} {tag}{mark} {text}", flush=True)
            continue

        if etype == "result":
            usage = ev.get("usage") or {}
            print(f"{stamp()} {ICONS['end']} RESULT {ev.get('subtype')} — turns={ev.get('num_turns')} "
                  f"cost=${ev.get('total_cost_usd')} in={usage.get('input_tokens')} out={usage.get('output_tokens')}",
                  flush=True)
            if ev.get("result"):
                print(f"{stamp()} {ICONS['end']} {clip(ev['result'], 600)}", flush=True)
            continue

        print(f"{stamp()} {ICONS['raw']} {etype} {clip(json.dumps({k: v for k, v in ev.items() if k != 'type'}, ensure_ascii=False), 140)}",
              flush=True)

    if raw:
        raw.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
