import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync(".codegraph/codegraph.db", { readOnly: true });

const isLeftOut = (path) =>
  path.startsWith("docs/") || /(^|\/)(tests?|__tests__|specs?|e2e)\/|(^|\/)test_[^/]*$|[._-](test|spec)\.[^/]*$/.test(path);

const functions = database
  .prepare("select id, kind, name, qualified_name, signature, file_path from nodes where kind in ('function', 'method') order by file_path, start_line")
  .all()
  .filter((row) => !isLeftOut(row.file_path));

const byId = new Map(functions.map((row) => [row.id, row]));

const callsFrom = database.prepare(
  "select target as id from edges where source = ? and kind = 'calls' group by target order by min(line), min(col)"
);

const calls = new Map(
  functions.map((row) => [row.id, callsFrom.all(row.id).map((call) => call.id).filter((id) => byId.has(id) && id !== row.id)])
);

const called = new Set([...calls.values()].flat());

const owner = (row) => (row.kind === "method" ? row.qualified_name.split(/::|\./).slice(-2).join(".") : row.name);

const onOneLine = (signature) => signature.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/,? \)/g, ")");

const shown = new Set();

const flow = (id, depth, expanded) => {
  const row = byId.get(id);
  const repeated = expanded.has(id);
  const more = repeated && calls.get(id).length ? "  ..." : "";
  const lines = [`${"  ".repeat(depth)}${owner(row)}${onOneLine(row.signature ?? "()")}  [${row.file_path}]${more}`];
  shown.add(id);
  if (repeated) return lines;
  expanded.add(id);
  return lines.concat(calls.get(id).flatMap((next) => flow(next, depth + 1, expanded)));
};

const block = (row) => flow(row.id, 0, new Set()).join("\n");

const entries = functions.filter((row) => !called.has(row.id)).map(block);
const loops = functions.filter((row) => !shown.has(row.id)).map(block);

console.log(
  [
    "# Code map",
    "Generated from the code. Do not edit.\nEach block starts at a function that nothing else calls, and follows every call until it ends.\nA line indented under another is called by it, in the order the calls are written.\nEach line: function(inputs) -> output  [file]. A trailing ... means its calls are shown earlier in the same block.\nIt shows that a call exists. It does not show when the call happens or which value is passed: read the function for that.",
    ...entries,
    ...loops,
  ].join("\n\n")
);
