#!/usr/bin/env node
// anthropic-compat-proxy.js — repair Claude Code subagent requests for
// Anthropic-compatible backends that reject effort + disabled thinking.

"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

// FIX: Properly handle fallbacks.
// If PROXY_TARGET isn't set, it defaults to DeepSeek.
const defaultTarget =
  process.env.USE_OPENROUTER === "true"
    ? "https://api.deepseek.com/anthropic"
    : "https://openrouter.ai/api";

const TARGET = new URL(process.env.PROXY_TARGET || defaultTarget);
const PORT = Number(process.env.PROXY_PORT || 8787);
const transport = TARGET.protocol === "http:" ? http : https;

// Strip every effort encoding when thinking is disabled. Returns the list of
// removed fields ([] when the request is left untouched).
function repair(json) {
  const thinkingDisabled =
    json && json.thinking && json.thinking.type === "disabled";
  if (!thinkingDisabled) return [];
  const removed = [];
  if (
    json.output_config &&
    typeof json.output_config === "object" &&
    "effort" in json.output_config
  ) {
    delete json.output_config.effort; // the encoding Claude Code actually sends
    removed.push("output_config.effort");
    if (Object.keys(json.output_config).length === 0) delete json.output_config;
  }
  for (const k of ["reasoning_effort", "effort"]) {
    // defensive: other client encodings
    if (k in json) {
      delete json[k];
      removed.push(k);
    }
  }
  return removed;
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    let body = Buffer.concat(chunks);
    let removed = [];
    if (
      body.length &&
      /application\/json/i.test(req.headers["content-type"] || "")
    ) {
      try {
        const json = JSON.parse(body.toString("utf8"));
        removed = repair(json);
        if (removed.length) body = Buffer.from(JSON.stringify(json), "utf8");
      } catch (_) {
        /* not JSON after all — forward verbatim */
      }
    }

    const headers = {
      ...req.headers,
      host: TARGET.host,
      "content-length": Buffer.byteLength(body),
    };
    delete headers["transfer-encoding"]; // body is re-buffered; length header rules

    const upstream = transport.request(
      {
        hostname: TARGET.hostname,
        port: TARGET.port || (TARGET.protocol === "http:" ? 80 : 443),
        path: TARGET.pathname.replace(/\/$/, "") + req.url,
        method: req.method,
        headers,
      },
      (ur) => {
        res.writeHead(ur.statusCode, ur.headers);
        ur.pipe(res); // SSE-safe: bytes stream through as they arrive
      },
    );

    upstream.on("error", (e) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: { type: "proxy_upstream_error", message: e.message },
        }),
      );
    });

    if (removed.length) {
      console.log(
        `[repair] ${req.method} ${req.url} — removed ${removed.join(", ")} (thinking disabled)`,
      );
    }

    upstream.end(body);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `anthropic-compat proxy: http://127.0.0.1:${PORT} -> ${TARGET.href}`,
  );
  console.log(
    `launch Claude Code with: ANTHROPIC_BASE_URL=http://127.0.0.1:${PORT}`,
  );
});
