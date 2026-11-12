import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

if (process.argv[2] === "--human") {
  mkdirSync(dirname(process.argv[3]), { recursive: true });
  writeFileSync(process.argv[3], humanPage(readFileSync(process.argv[4] ?? "docs/agent/codemap.md", "utf8")));
  process.exit(0);
}

const database = new DatabaseSync(".codegraph/codegraph.db", { readOnly: true });

const isLeftOut = (path) =>
  path.startsWith("docs/") ||
  /(^|\/)(tests?|__tests__|specs?|e2e|integration_tests?|test_driver)\/|(^|\/)test_[^/]*$|[._-](test|spec)\.[^/]*$/.test(path);

const sources = new Map();

const linesOf = (path) => {
  if (!sources.has(path)) {
    try {
      sources.set(path, readFileSync(path, "utf8").split("\n").map((line) => line.trim()));
    } catch {
      sources.set(path, []);
    }
  }
  return sources.get(path);
};

const braceChange = (line) => {
  let change = 0;
  for (let at = 0; at < line.length; at++) {
    const letter = line[at];
    if (letter === "/" && line[at + 1] === "/") break;
    if (letter === '"') {
      for (at++; at < line.length && line[at] !== '"'; at++) if (line[at] === "\\") at++;
      continue;
    }
    if (letter === "'" && line[at + 2] === "'") at += 2;
    else if (letter === "'" && line[at + 1] === "\\" && line.indexOf("'", at + 2) > 0) at = line.indexOf("'", at + 2);
    else if (letter === "{") change++;
    else if (letter === "}") change--;
  }
  return change;
};

const rustTestSpans = (path) => {
  if (!path.endsWith(".rs")) return [];
  const lines = linesOf(path);
  const spans = [];
  for (let at = 0; at < lines.length; at++) {
    if (!lines[at].startsWith("#[cfg(test)]")) continue;
    let opening = at + 1;
    while ((lines[opening] ?? "").startsWith("#[")) opening++;
    if (!/^(pub(\([^)]*\))?\s+)?mod\s+\w+\s*\{/.test(lines[opening] ?? "")) continue;
    let open = 0;
    let end = opening;
    for (; end < lines.length; end++) {
      open += braceChange(lines[end]);
      if (open <= 0) break;
    }
    spans.push([at + 1, end + 1]);
    at = end;
  }
  return spans;
};

const testSpans = new Map();

const inRustTests = (row) => {
  if (!testSpans.has(row.file_path)) testSpans.set(row.file_path, rustTestSpans(row.file_path));
  return testSpans.get(row.file_path).some(([start, end]) => row.start_line >= start && row.start_line <= end);
};

const markedInGitattributes = (paths) => {
  try {
    const answer = execFileSync("git", ["check-attr", "--stdin", "linguist-generated", "linguist-vendored"], {
      input: paths.join("\n"),
      encoding: "utf8",
    });
    return answer
      .split("\n")
      .map((line) => /^(.*): linguist-(generated|vendored): (set|true)$/.exec(line))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]);
  } catch {
    return [];
  }
};

const files = database.prepare("select path, generated from files").all();
const notOurs = new Map(files.filter((file) => file.generated).map((file) => [file.path, "generated"]));
for (const [path, why] of markedInGitattributes(files.map((file) => file.path))) notOurs.set(path, why);

const functions = database
  .prepare("select id, kind, name, qualified_name, signature, file_path, start_line, end_line from nodes where kind in ('function', 'method') order by file_path, start_line")
  .all()
  .filter((row) => !isLeftOut(row.file_path) && !inRustTests(row));

const byId = new Map(functions.map((row) => [row.id, row]));
const isOurs = (row) => !notOurs.has(row.file_path);

const ours = functions.filter(isOurs);
const byName = Map.groupBy(ours, (row) => row.name);

const onOneLine = (signature) => signature.replace(/\s+/g, " ").trim().replace(/\( /g, "(").replace(/,? \)/g, ")");

const inputsAndOutput = (signature) => {
  const text = onOneLine(signature ?? "()");
  if (text.startsWith("(")) return text;
  const open = text.indexOf("(");
  if (open === -1) return ` -> ${text}`;
  return `${text.slice(open)} -> ${text.slice(0, open).trim()}`;
};

const owner = (row) => row.qualified_name.split(/::|\./).slice(-2, -1)[0];

const pathWords = (path) => path.replace(/\.[^/.]+$/, "").replace(/-/g, "_").split("/");

const crateRoot = (path) => path.slice(0, path.lastIndexOf("src/") + 1);

const throughPath = (caller, reference) => {
  const parts = reference.split("::");
  const name = parts.pop();
  if (parts.length === 0) return [];
  const candidates = (byName.get(name) ?? []).filter((row) => row.id !== caller.id);
  const last = parts.at(-1) === "Self" && caller.kind === "method" ? owner(caller) : parts.at(-1);
  if (/^[A-Z]/.test(last)) return candidates.filter((row) => row.kind === "method" && owner(row) === last);
  const local = ["crate", "self", "super"].includes(parts[0]);
  const modules = parts.filter((part) => !["crate", "self", "super"].includes(part)).map((part) => part.replace(/-/g, "_"));
  return candidates.filter(
    (row) =>
      row.kind === "function" &&
      (!local || crateRoot(row.file_path) === crateRoot(caller.file_path)) &&
      modules.every((module) => pathWords(row.file_path).includes(module))
  );
};

const parameterType = (caller, parameter) => {
  const signature = onOneLine(caller.signature ?? "");
  const nameFirst = new RegExp(`[(,{]\\s*(?:mut\\s+)?${parameter}\\)?\\s*:\\s*([^,)]+)`).exec(signature);
  const typeFirst = new RegExp(`[(,{]\\s*(?:required\\s+|final\\s+)?([\\w<>?.]+)\\s+${parameter}\\s*[,)}=]`).exec(signature);
  return nameFirst?.[1] ?? typeFirst?.[1];
};

const types = Map.groupBy(database.prepare("select name, file_path, start_line, end_line from nodes where kind in ('struct', 'class')").all(), (row) => row.name);

const wrappers = new Set(["Option", "Box", "Arc", "Rc", "RefCell", "Cell", "Mutex", "RwLock", "Pin", "Optional"]);

const typePath = (type) => {
  let text = type.replace(/&|'\w+|\b(mut|dyn|impl)\b/g, " ").replace(/\|\s*None\b/, "").trim();
  let outer = /^([\w:]+)\s*[<[](.*)[>\]]$/.exec(text);
  while (outer && wrappers.has(outer[1].split("::").at(-1))) {
    text = outer[2].trim();
    outer = /^([\w:]+)\s*[<[](.*)[>\]]$/.exec(text);
  }
  const path = outer ? outer[1] : text;
  return /^[\w:]+$/.test(path) ? path.split("::") : undefined;
};

const typeName = (type) => typePath(type)?.at(-1);

const modules = (path) => path.filter((word) => !["crate", "self", "super"].includes(word)).map((word) => word.replace(/-/g, "_"));

const isUnder = (row, words) => words.every((word) => pathWords(row.file_path).includes(word));

const importedFrom = (file, name) => {
  const found = linesOf(file)
    .filter((line) => /^(pub(\([^)]*\))?\s+)?use\s/.test(line))
    .map((line) => new RegExp(`([\\w:]+)::(?:\\{[^}]*\\b|)${name}\\b`).exec(line.replace(/^(pub(\([^)]*\))?\s+)?use\s+/, "")))
    .filter(Boolean);
  return found.length ? modules(found[0][1].split("::")) : undefined;
};

const typesMeant = (file, type) => {
  const path = typePath(type);
  if (!path) return [];
  const name = path.at(-1);
  const all = (types.get(name) ?? []).filter((row) => !notOurs.has(row.file_path));
  if (path.length > 1) return all.filter((row) => isUnder(row, modules(path.slice(0, -1))));
  const imported = importedFrom(file, name);
  if (imported) return all.filter((row) => isUnder(row, imported));
  const sameCrate = all.filter((row) => crateRoot(row.file_path) === crateRoot(file));
  return sameCrate.length ? sameCrate : all;
};

const fieldType = (file, type, field) => {
  const found = new Map();
  for (const row of typesMeant(file, type)) {
    const body = linesOf(row.file_path).slice(row.start_line - 1, row.end_line).join(" ");
    const match = new RegExp(`\\b${field}\\s*:\\s*([^,;}=]+)`).exec(body);
    if (match && !found.has(match[1].trim())) found.set(match[1].trim(), row.file_path);
  }
  return found.size === 1 ? { type: [...found.keys()][0], file: [...found.values()][0] } : undefined;
};

const sameValue = new Set(["as_mut", "as_ref", "as_deref", "as_deref_mut", "take", "clone", "unwrap", "expect", "lock", "borrow", "borrow_mut"]);

const withoutSameValue = (parts) => {
  const path = [...parts];
  while (path.length > 1 && sameValue.has(path.at(-1))) path.pop();
  return path;
};

const typeOfPath = (caller, path, withLocals, depth = 0) => {
  if (depth > 3 || !path.length || !path.every((part) => /^\w+$/.test(part))) return undefined;
  const [first, ...fields] = path;
  let type;
  if (["self", "this"].includes(first)) type = caller.kind === "method" ? owner(caller) : undefined;
  else type = parameterType(caller, first) ?? (withLocals ? localType(caller, first, depth + 1) : undefined);
  let file = caller.file_path;
  for (const field of fields) {
    const next = type && fieldType(file, type, field);
    type = next?.type;
    file = next?.file;
  }
  const name = type && typeName(type);
  return (name && !types.has(name) && boundOf(caller, name)) || type;
};

const boundOf = (caller, name) => {
  const bound = new RegExp(`[<,]\\s*${name}\\s*:\\s*([A-Z]\\w*)|\\bwhere\\b.*\\b${name}\\s*:\\s*([A-Z]\\w*)`);
  const headers = [onOneLine(caller.signature ?? "")];
  const lines = linesOf(caller.file_path);
  for (let at = caller.start_line - 2; at >= 0; at--) {
    if (!/^impl\b/.test(lines[at])) continue;
    headers.push(lines.slice(at, at + 4).join(" ").split("{")[0]);
    break;
  }
  for (const header of headers) {
    const found = bound.exec(header);
    if (found) return found[1] ?? found[2];
  }
  return undefined;
};

const receiverType = (caller, parts) => typeOfPath(caller, parts.slice(0, -1), false);

const mentions = (type, name) => new RegExp(`\\b${name}\\b`).test(type);

const outputOf = (row) => {
  const text = inputsAndOutput(row.signature);
  const at = text.lastIndexOf(") -> ");
  return at === -1 ? undefined : text.slice(at + 5);
};

const genericArgs = (type) => {
  const text = type.replace(/^&\s*(?:mut\s+)?/, "").trim();
  const open = text.indexOf("<");
  if (open === -1 || !text.endsWith(">")) return [text, []];
  const args = [];
  let nested = 0;
  let start = open + 1;
  for (let at = open + 1; at < text.length - 1; at++) {
    if ("<([".includes(text[at])) nested++;
    if (">)]".includes(text[at])) nested--;
    if (text[at] === "," && nested === 0) {
      args.push(text.slice(start, at).trim());
      start = at + 1;
    }
  }
  args.push(text.slice(start, text.length - 1).trim());
  return [text.slice(0, open).trim(), args];
};

const innerValue = (type) => {
  const [outer, args] = genericArgs(type);
  return ["Result", "Option"].includes(outer.split("::").at(-1)) && args.length ? args[0] : type;
};

const keepsValue = new Set(["as_ref", "as_mut", "as_deref", "as_deref_mut", "clone", "to_owned", "take", "lock", "borrow", "borrow_mut", "map_err", "context", "with_context", "ok_or", "ok_or_else"]);

const outputOfMethod = (method) => outputOf(method)?.replace(/\bSelf\b/g, owner(method));

const afterCall = (type, name) => {
  if (["unwrap", "expect", "unwrap_or_default"].includes(name)) return innerValue(type);
  if (keepsValue.has(name)) return type;
  const method = methodOn(type, name);
  return method ? outputOfMethod(method) : undefined;
};

const afterParens = (text) => {
  let open = 0;
  for (let at = 0; at < text.length; at++) {
    if (text[at] === "(") open++;
    if (text[at] === ")" && --open === 0) return text.slice(at + 1);
  }
  return "";
};

const uniqueFunction = (name) => {
  const found = (byName.get(name) ?? []).filter((row) => row.kind === "function");
  return found.length === 1 ? found[0] : undefined;
};

const valueType = (caller, text, depth) => {
  const head = /^([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)/.exec(text);
  if (!head || depth > 3) return undefined;
  let rest = text.slice(head[0].length).trimStart();
  const segments = head[1].split("::");
  const called = rest.startsWith("(");
  let type;
  if (segments.length > 1) {
    const [typeName, last] = segments.slice(-2);
    if (/^[A-Z]/.test(last)) type = last;
    else if (/^[A-Z]/.test(typeName)) type = methodOn(typeName, last) ? outputOfMethod(methodOn(typeName, last)) : typeName;
    else type = uniqueFunction(last) && outputOf(uniqueFunction(last));
  } else if (/^[A-Z]/.test(head[1])) type = head[1];
  else if (called) type = uniqueFunction(head[1]) && outputOf(uniqueFunction(head[1]));
  else if (["self", "this"].includes(head[1])) type = caller.kind === "method" ? owner(caller) : undefined;
  else type = parameterType(caller, head[1]) ?? localType(caller, head[1], depth + 1);
  if (called) rest = afterParens(rest);
  let file = caller.file_path;
  while (type && rest) {
    if (rest.startsWith("?")) {
      type = innerValue(type);
      rest = rest.slice(1).trimStart();
      continue;
    }
    const step = /^\.\s*(\w+)\s*/.exec(rest);
    if (!step) break;
    rest = rest.slice(step[0].length);
    if (rest.startsWith("(")) {
      type = afterCall(type, step[1]);
      rest = afterParens(rest).trimStart();
    } else {
      const next = fieldType(file, type, step[1]);
      type = next?.type;
      file = next?.file ?? file;
    }
  }
  return type;
};

const localType = (caller, name, depth = 0) => {
  const lines = linesOf(caller.file_path);
  const binding = new RegExp(`^(?:let\\s+(?:mut\\s+)?|final\\s+|var\\s+)?${name}\\s*(?::\\s*([^=;]+?))?\\s*=(?![=>])\\s*(.*)$`);
  const unwrapped = new RegExp(`^(?:}\\s*else\\s+)?(?:if\\s+|while\\s+)?let\\s+(?:Some|Ok)\\(\\s*(?:mut\\s+)?${name}\\s*\\)\\s*=\\s*&?(?:mut\\s+)?((?:self|this)(?:\\.\\w+)+)`);
  const field = new RegExp(`[{,]\\s*(?:(\\w+)\\s*:\\s*)?(?:mut\\s+)?${name}\\s*[,}]`);
  for (let at = caller.start_line; at <= caller.end_line; at++) {
    const line = lines[at - 1] ?? "";
    const opened = unwrapped.exec(line);
    if (opened) return typeOfPath(caller, withoutSameValue(opened[1].split(".")), true, depth);
    const parts = /^let\s+([A-Z]\w*)\s*\{/.exec(line);
    if (parts) {
      let text = line;
      for (let next = at + 1; next <= caller.end_line && next < at + 12 && !/}\s*=/.test(text); next++) text += ` ${lines[next - 1]}`;
      const named = field.exec(text.split(/}\s*=/)[0]);
      if (named) return fieldType(caller.file_path, parts[1], named[1] ?? name)?.type;
      continue;
    }
    const bound = binding.exec(line);
    if (!bound) continue;
    if (bound[1]) return bound[1];
    let value = bound[2];
    for (let next = at + 1; next <= caller.end_line && next < at + 6 && (lines[next - 1] ?? "").startsWith("."); next++) value += lines[next - 1];
    return valueType(caller, value.replace(/^&\s*(?:mut\s+)?/, ""), depth);
  }
  return undefined;
};

const throughReceiver = (caller, reference) => {
  const parts = reference.split(".");
  if (!parts.every((part) => /^\w+$/.test(part))) return [];
  const type = receiverType(caller, parts);
  if (!type) return [];
  return (byName.get(parts.at(-1)) ?? []).filter((row) => row.kind === "method" && mentions(type, owner(row)));
};

const traitsOf = Map.groupBy(
  database
    .prepare("select type.name as type, trait.name as trait from edges edge join nodes type on type.id = edge.source join nodes trait on trait.id = edge.target where edge.kind = 'implements'")
    .all(),
  (row) => row.type
);

const pythonClasses = database
  .prepare("select name, file_path, start_line from nodes where kind = 'class' and file_path like '%.py'")
  .all()
  .filter((row) => !isLeftOut(row.file_path));

const basesOf = (row) =>
  (/^class\s+\w+\s*\(([^)]*)\)/.exec(linesOf(row.file_path)[row.start_line - 1] ?? "")?.[1] ?? "")
    .split(",")
    .map((base) => base.trim().replace(/\[.*$/, ""))
    .filter(Boolean);

const isProtocol = (bases) => bases.some((base) => /^(typing\.)?Protocol$/.test(base));
const isPort = (bases) => isProtocol(bases) || bases.some((base) => /^(abc\.)?ABC$|^metaclass\s*=\s*(abc\.)?ABCMeta$/.test(base));

const pythonMethods = Map.groupBy(
  ours.filter((row) => row.kind === "method" && row.file_path.endsWith(".py")),
  owner
);

const ownMethodNames = (type) => (pythonMethods.get(type) ?? []).map((row) => row.name).filter((name) => !/^__\w+__$/.test(name));

const ports = pythonClasses.filter((row) => isPort(basesOf(row)));
const portNames = new Set(ports.map((row) => row.name));

const meets = (type, port) =>
  basesOf(type).some((base) => base.split(".").at(-1) === port.name) ||
  (isProtocol(basesOf(port)) && ownMethodNames(port.name).length > 0 && ownMethodNames(port.name).every((name) => ownMethodNames(type.name).includes(name)));

const implementersOf = new Map(
  ports.map((port) => [port.name, pythonClasses.filter((type) => !portNames.has(type.name) && meets(type, port)).map((type) => type.name)])
);

const portImplementations = (row) =>
  row.kind === "method" && implementersOf.has(owner(row))
    ? implementersOf.get(owner(row)).flatMap((type) => (pythonMethods.get(type) ?? []).filter((method) => method.name === row.name))
    : [];

const traitMethod = (target) => {
  const found = (traitsOf.get(owner(target)) ?? []).flatMap((row) =>
    (byName.get(target.name) ?? []).filter((method) => method.kind === "method" && owner(method) === row.trait)
  );
  return found.length === 1 ? found[0] : undefined;
};

const statementAt = (caller, line) => {
  const lines = linesOf(caller.file_path);
  let text = lines[line - 1] ?? "";
  for (let at = line - 1; at >= caller.start_line && at > line - 5 && text.startsWith("."); at--) text = (lines[at - 1] ?? "") + text;
  for (let at = line + 1; at <= caller.end_line && at < line + 5 && (lines[at - 1] ?? "").startsWith("."); at++) text += lines[at - 1];
  return text;
};

const receiversOnLine = (caller, line, name) =>
  [...statementAt(caller, line).matchAll(new RegExp(`((?:self|this|\\w+)(?:\\.\\w+)*)\\.${name}\\s*\\(`, "g"))].map((found) => withoutSameValue(found[1].split(".")));

const methodOn = (type, name) => {
  const on = typeName(type);
  const found = (byName.get(name) ?? []).filter((row) => row.kind === "method" && owner(row) === on);
  return found.length === 1 ? found[0] : undefined;
};

const judge = (caller, target, how, line) => {
  if (!how.refName || target.kind !== "method") return { target };
  let parts = how.refName.split(/::|\./);
  if (parts.length === 1) {
    if (caller.kind === "method" && owner(caller) === owner(target)) return { target };
    const paths = receiversOnLine(caller, line, target.name);
    if (!paths.length || paths.some((path) => ["self", "this"].includes(path.join(".")))) return { target, guess: true };
    if (paths.length > 1) {
      const types = paths.map((path) => typeOfPath(caller, path, true) ?? "");
      if (types.every((type) => mentions(type, owner(target)))) return { target };
      const others = types.map((type) => methodOn(type, target.name));
      return others.every((other) => other && other.id === others[0].id) ? { target: others[0] } : { target, guess: true };
    }
    parts = [...paths[0], target.name];
  }
  const receiver = parts.at(-2) === "Self" ? owner(caller) : parts.at(-2);
  if (["self", "this", owner(target)].includes(receiver)) return { target };
  if (how.refName.includes("::")) return /^[A-Z]/.test(receiver) ? undefined : { target };
  const type = receiverType(caller, parts);
  if (!type) {
    const local = typeOfPath(caller, parts.slice(0, -1), true);
    if (local && mentions(local, owner(target))) return { target };
    const other = local && methodOn(local, target.name);
    return other ? { target: other } : { target, guess: true };
  }
  if (mentions(type, owner(target))) return { target };
  const throughTrait = traitMethod(target);
  if (throughTrait && mentions(type, owner(throughTrait))) return { target: throughTrait };
  const other = methodOn(type, target.name);
  if (other) return { target: other };
  if (/\b[A-Z]\b/.test(type)) return throughTrait ? { target: throughTrait } : { target, guess: true };
  return undefined;
};

const macroStart = /\b[a-z_]\w*!\s*[([{]/g;

const callInMacro = /(?:((?:self|this|[a-z_]\w*)(?:\.\w+)*)\.)?\b([a-z_]\w*)\s*\(/g;

const macroCallsOf = (row) => {
  const lines = linesOf(row.file_path);
  const calls = [];
  for (let at = row.start_line; at <= row.end_line; at++) {
    const text = lines[at - 1] ?? "";
    for (const macro of text.matchAll(macroStart)) {
      let open = 0;
      let body = "";
      for (let line = at; line <= row.end_line; line++) {
        for (const letter of line === at ? text.slice(macro.index + macro[0].length - 1) : lines[line - 1] ?? "") {
          if ("([{".includes(letter)) open++;
          if (")]}".includes(letter)) open--;
          body += letter;
          if (open === 0) break;
        }
        if (open === 0) break;
        body += " ";
      }
      for (const call of body.slice(1).matchAll(callInMacro)) calls.push({ path: call[1]?.split("."), name: call[2], line: at });
    }
  }
  return calls;
};

const passedValue = /\.\w+\(\s*(?:([A-Z]\w*)::)?([a-z_]\w*)\s*\)/g;

const boundNames = (row) => {
  const names = new Set();
  const text = [onOneLine(row.signature ?? ""), ...linesOf(row.file_path).slice(row.start_line - 1, row.end_line)].join(" ");
  const bindings = [
    /\blet\s+(?:mut\s+)?([a-z_]\w*)/g,
    /\bfor\s+([a-z_]\w*)\s*(?:,|in\b)/g,
    /,\s*([a-z_]\w*)\s+in\b/g,
    /[(,]\s*(?:mut\s+)?([a-z_]\w*)\s*:(?!:)/g,
    /\|\s*(?:mut\s+)?([a-z_]\w*)\s*[|,:]/g,
    /,\s*([a-z_]\w*)\s*\|/g,
    /\b[A-Z]\w*(?:::\w+)*\s*\(\s*(?:ref\s+)?(?:mut\s+)?([a-z_]\w*)\s*[,)]/g,
    /\b[A-Z]\w*(?:::\w+)*\s*\{\s*([a-z_]\w*)\s*[,}]/g,
  ];
  for (const binding of bindings) for (const found of text.matchAll(binding)) names.add(found[1]);
  for (const line of linesOf(row.file_path).slice(row.start_line - 1, row.end_line)) {
    const assigned = /^([a-z_]\w*(?:\s*,\s*[a-z_]\w*)*)\s*=(?![=>])/.exec(line);
    for (const name of assigned?.[1].split(",") ?? []) names.add(name.trim());
  }
  for (const word of onOneLine(row.signature ?? "").match(/\b[a-z_]\w*\b/g) ?? []) names.add(word);
  return names;
};

const passedCallsOf = (row) => {
  const lines = linesOf(row.file_path);
  const bound = boundNames(row);
  const calls = [];
  for (let at = row.start_line; at <= row.end_line; at++) {
    for (const found of (lines[at - 1] ?? "").matchAll(passedValue)) {
      const [, typeName, name] = found;
      if (!typeName && bound.has(name)) continue;
      const owned = typeName === "Self" && row.kind === "method" ? owner(row) : typeName;
      const reachable = (target) =>
        target.file_path === row.file_path ||
        (crateRoot(row.file_path) !== "" && crateRoot(target.file_path) === crateRoot(row.file_path)) ||
        importedFrom(row.file_path, name) ||
        linesOf(row.file_path).some((line) => /^(from\s+\S+\s+)?import\s/.test(line) && new RegExp(`\\b${name}\\b`).test(line));
      const targets = (byName.get(name) ?? []).filter((target) =>
        owned ? target.kind === "method" && owner(target) === owned : target.kind === "function" && target.id !== row.id && reachable(target)
      );
      if (targets.length === 1) calls.push({ target: targets[0], line: at });
    }
  }
  return calls;
};

const outsideTarget = (caller, how, line) => {
  if (!how.refName || how.refName.includes("::")) return undefined;
  const parts = how.refName.split(".");
  const name = parts.pop();
  const paths = parts.length ? [parts] : receiversOnLine(caller, line, name);
  if (paths.length !== 1) return undefined;
  const type = typeOfPath(caller, withoutSameValue(paths[0]), true);
  return type ? methodOn(type, name) : undefined;
};

const targetInMacro = (caller, call) => {
  if (!call.path) {
    const functions = (byName.get(call.name) ?? []).filter((row) => row.kind === "function" && row.id !== caller.id);
    return functions.length === 1 ? functions[0] : undefined;
  }
  const type = typeOfPath(caller, withoutSameValue(call.path), true);
  return type ? methodOn(type, call.name) : undefined;
};

const followed = database.prepare("select target as id, line, col, metadata from edges where source = ? and kind = 'calls'");

const notFollowed = database.prepare("select reference_name as name, line, col from unresolved_refs where from_node_id = ? and reference_kind = 'calls'");

const spawnCall = /\b(?:thread|tokio|task|rayon)::spawn(?:_blocking)?\s*\(|\.spawn\s*\(\s*(?:move\s*)?\|/;

const spawnedSpans = (row) => {
  const lines = linesOf(row.file_path);
  const spans = [];
  for (let at = row.start_line; at <= row.end_line; at++) {
    const found = spawnCall.exec(lines[at - 1] ?? "");
    if (!found) continue;
    const after = lines[at - 1].slice(found.index);
    let open = 0;
    let end = row.end_line;
    for (let line = at; line <= row.end_line && end === row.end_line; line++) {
      for (const letter of line === at ? after : lines[line - 1] ?? "") {
        if (letter === "(") open++;
        if (letter === ")") open--;
        if (open === 0 && letter === ")") {
          end = line;
          break;
        }
      }
    }
    spans.push({ line: at, after, end });
  }
  return spans;
};

const onNewThread = (spans, line, name) =>
  spans.some((span) => (line > span.line && line <= span.end) || (line === span.line && span.after.includes(`${name}(`)));

const callsOf = (row) => {
  const found = [];
  const spans = spawnedSpans(row);
  const add = (target, guess, impl, line, col) =>
    found.push({ id: target.id, guess, impl, thread: !impl && onNewThread(spans, line, target.name), line, col });
  for (const call of followed.all(row.id)) {
    const how = JSON.parse(call.metadata ?? "{}");
    if (!byId.has(call.id)) {
      const real = outsideTarget(row, how, call.line);
      if (real) add(real, false, false, call.line ?? 0, call.col ?? 0);
      continue;
    }
    const judged = judge(row, byId.get(call.id), how, call.line);
    if (judged) add(judged.target, Boolean(judged.guess), how.synthesizedBy === "interface-impl", call.line ?? 0, call.col ?? 0);
  }
  for (const reference of notFollowed.all(row.id)) {
    const targets = [...throughPath(row, reference.name), ...throughReceiver(row, reference.name)];
    if (targets.length === 1) add(targets[0], false, false, reference.line, reference.col);
    const real = targets.length === 0 && /^\w+$/.test(reference.name) && outsideTarget(row, { refName: reference.name }, reference.line);
    if (real) add(real, false, false, reference.line, reference.col);
  }
  for (const call of macroCallsOf(row)) {
    const target = targetInMacro(row, call);
    if (target) add(target, false, false, call.line, 0);
  }
  for (const call of passedCallsOf(row)) add(call.target, false, false, call.line, 0);
  for (const implementation of portImplementations(row)) add(implementation, false, true, row.end_line, 0);
  const first = new Map();
  for (const call of found.sort((a, b) => a.line - b.line || a.col - b.col)) {
    if (call.id === row.id) continue;
    const earlier = first.get(call.id);
    if (!earlier) first.set(call.id, call);
    else if (earlier.guess && !call.guess) first.set(call.id, { ...earlier, guess: false });
  }
  return [...first.values()];
};

const calls = new Map(functions.map((row) => [row.id, isOurs(row) ? callsOf(row) : []]));

const called = new Set([...calls.values()].flat().filter((call) => !call.guess).map((call) => call.id));

const routes = Map.groupBy(
  database
    .prepare("select route.name as route, route.file_path as file, edge.target as id from nodes route join edges edge on edge.source = route.id where route.kind = 'route' and edge.kind = 'references' order by route.start_line")
    .all()
    .filter((row) => byId.has(row.id)),
  (row) => row.id
);

const shown = new Set();

const printed = new Set();

const nameOf = (row) => (row.kind === "method" ? `${owner(row)}.${row.name}` : row.name);

const flow = (call, depth, expanded) => {
  const row = byId.get(call.id);
  const repeated = expanded.has(call.id);
  const marks = [call.impl ? "impl" : undefined, notOurs.get(row.file_path), call.thread ? "new thread" : undefined, call.guess ? "guess" : undefined]
    .filter(Boolean)
    .map((mark) => `  (${mark})`)
    .join("");
  const more = repeated && !call.guess && calls.get(call.id).length ? "  ..." : "";
  printed.add(call.id);
  const lines = [`${"  ".repeat(depth)}${nameOf(row)}  [${row.file_path}]${marks}${more}`];
  if (call.guess) return lines;
  shown.add(call.id);
  if (repeated) return lines;
  expanded.add(call.id);
  return lines.concat(calls.get(call.id).flatMap((next) => flow(next, depth + 1, expanded)));
};

const block = (row) => {
  const served = (routes.get(row.id) ?? []).map((route) => `${route.route}  [${route.file}]`);
  return served.concat(flow({ id: row.id, guess: false }, served.length ? 1 : 0, new Set())).join("\n");
};

const isEntry = (row) => routes.has(row.id) || !called.has(row.id);
const isWayIn = (row) => routes.has(row.id) || row.name === "main";
const entries = [...ours.filter((row) => isEntry(row) && isWayIn(row)), ...ours.filter((row) => isEntry(row) && !isWayIn(row))].map(block);
const loops = ours.filter((row) => !shown.has(row.id)).map(block);

const signatures = functions
  .filter((row) => printed.has(row.id))
  .map((row) => `${nameOf(row)}${inputsAndOutput(row.signature)}  [${row.file_path}]`)
  .join("\n");

console.log(
  [
    "# Code map",
    [
      "Generated from the code. Do not edit.",
      "Each block starts at a route or at a function that nothing else calls, and follows every call until it ends. Under a route is the function that answers it.",
      "A line indented under another is called by it, in the order the calls are written. Each line: function  [file]. A trailing ... means its calls are shown earlier in the same block.",
      "The inputs and output of every function are under ## Functions at the end, one line each, file by file.",
      "Lines marked (impl) under a trait's or an interface's method are its implementations: only one of them runs, the one of the value it is called on.",
      "A line marked (new thread) is called inside a closure handed to a spawn, such as thread::spawn: it runs on another thread, and the caller does not wait for it.",
      "Generated and vendored code is not followed: a call into it is one line marked (generated) or (vendored).",
      "A line marked (guess) is a call matched by its name alone, such as x.insert() on a value whose type the map cannot see. It is not followed: read the code before you rely on it.",
      "It shows that a call exists. It does not show when the call happens or which value is passed: read the function for that.",
      "It misses a call it cannot trace to one function, such as a method called on a local variable: search for a name before you trust that nothing calls it.",
    ].join("\n"),
    ...entries,
    ...loops,
    `## Functions\n\n${signatures}`,
  ].join("\n\n")
);

function humanPage(map) {
  const style = String.raw`
:root { --bg: #fbfaf8; --panel: #ffffff; --fg: #1d1d1b; --muted: #6b6a66; --line: #e3e1dc; --accent: #2f5fd0; --flash: #fff1b8; --chip-l: 92%; --chip-fg-l: 28%; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161615; --panel: #1f1f1d; --fg: #ecebe7; --muted: #a09e98; --line: #34332f; --accent: #8eb0ff; --flash: #4a4220; --chip-l: 24%; --chip-fg-l: 84%; } }
:root[data-theme="dark"] { --bg: #161615; --panel: #1f1f1d; --fg: #ecebe7; --muted: #a09e98; --line: #34332f; --accent: #8eb0ff; --flash: #4a4220; --chip-l: 24%; --chip-fg-l: 84%; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { padding: 14px 16px; border-bottom: 1px solid var(--line); }
header h1 { margin: 0; font-size: 18px; }
header p { margin: 4px 0 0; color: var(--muted); }
main { display: grid; grid-template-columns: 300px 1fr; min-height: calc(100vh - 70px); }
nav { border-right: 1px solid var(--line); padding: 12px; overflow: auto; max-height: calc(100vh - 70px); position: sticky; top: 0; }
nav input, .tools input[type="search"] { width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--fg); font: inherit; }
nav h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 14px 0 4px; }
nav details summary { cursor: pointer; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 4px; }
nav button { display: block; width: 100%; text-align: left; border: 0; background: none; color: var(--fg); padding: 4px 6px; border-radius: 5px; cursor: pointer; font: inherit; overflow-wrap: anywhere; }
nav button:hover { background: var(--line); }
nav button.on { background: var(--accent); color: var(--bg); }
nav button.on small { color: var(--bg); }
nav small { color: var(--muted); display: block; font-size: 11px; }
section { padding: 16px; min-width: 0; }
section h2 { margin: 0; font-size: 17px; overflow-wrap: anywhere; }
section .where { color: var(--muted); font-size: 12px; margin-bottom: 12px; }
.parts { margin: 10px 0 14px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.chain { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
.chain + .chain, .chain + details { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }
.parts details summary { cursor: pointer; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
.chip.big { font-size: 13px; padding: 3px 12px; font-weight: 600; }
.chain.whole { padding: 6px 0; }
.chain.whole + .chain.whole { margin-top: 0; padding-top: 6px; }
button.start { display: block; width: 100%; max-width: 640px; text-align: left; border: 1px solid var(--line); background: var(--panel); color: var(--fg); padding: 6px 10px; margin: 4px 0; border-radius: 6px; cursor: pointer; font: inherit; }
button.start small { display: block; color: var(--muted); font-size: 11px; }
[hidden] { display: none !important; }
.arrow { color: var(--muted); padding: 0 2px; }
.chip { display: inline-block; border: 0; border-radius: 999px; padding: 1px 9px; margin: 2px; font: inherit; font-size: 12px; cursor: pointer; background: hsl(var(--h) 55% var(--chip-l)); color: hsl(var(--h) 45% var(--chip-fg-l)); }
.chip b { font-weight: 600; opacity: .7; margin-left: 4px; }
.tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.tools input[type="search"] { width: 220px; }
.tools button, .tools label { border: 1px solid var(--line); background: var(--panel); color: var(--fg); padding: 5px 10px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; }
ul.tree, ul.tree ul { list-style: none; margin: 0; padding-left: 18px; border-left: 1px solid var(--line); }
ul.tree { padding-left: 0; border: 0; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; padding: 3px 4px; border-radius: 5px; cursor: pointer; }
.row:hover { background: var(--line); }
.row.lit { background: var(--flash); }
.row .toggle { width: 14px; color: var(--muted); flex: none; }
.row .name { font-weight: 600; overflow-wrap: anywhere; }
.row .sig { color: var(--muted); font-family: ui-monospace, Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
.badge { font-size: 11px; border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; color: var(--muted); }
.badge.thread { border-color: #c77d1a; color: #c77d1a; }
.badge.impl { border-color: #2f8f5b; color: #2f8f5b; }
.badge.guess { border-style: dashed; }
.above { font-size: 12px; color: var(--accent); background: none; border: 0; cursor: pointer; padding: 0; font: inherit; }
.legend { color: var(--muted); font-size: 12px; margin-top: 18px; border-top: 1px solid var(--line); padding-top: 10px; }
.legend p { margin: 3px 0; }
@media (max-width: 760px) { main { grid-template-columns: 1fr; } nav { position: static; max-height: 260px; border-right: 0; border-bottom: 1px solid var(--line); } }
`;
  const script = String.raw`
const lines = MAP.split("\n");
const functionsAt = lines.findIndex((line) => line.startsWith("## Functions"));
const signatures = new Map();
for (const line of lines.slice(functionsAt + 1)) {
  const found = /^([^(\s]+)(.*?)  \[([^\]]+)\]$/.exec(line);
  if (found) signatures.set(found[1] + "|" + found[3], found[2].trim());
}

const partOf = (file) => {
  const pieces = file.split("/");
  const stem = pieces.pop().replace(/\.[^.]+$/, "");
  const folders = pieces.filter((piece) => piece !== "src" && piece !== "lib");
  const area = file.includes("/src/") ? file.slice(0, file.lastIndexOf("/src/")).split("/").pop() : file.endsWith(".rs") ? pieces.at(-1) ?? "." : pieces.join("/") || ".";
  const generic = ["mod", "lib", "main", "index", "__init__"].includes(stem);
  const name = generic ? folders.at(-1) ?? stem : stem;
  return { key: area + "/" + name, name, area };
};

const hue = (text) => [...text].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) % 360, 7);

const parseLine = (line) => {
  const depth = line.match(/^ */)[0].length / 2;
  const found = /^(.*?)  \[([^\]]*)\](.*)$/.exec(line.trim());
  if (!found) return undefined;
  return {
    depth,
    name: found[1],
    file: found[2],
    marks: [...found[3].matchAll(/\(([^)]+)\)/g)].map((mark) => mark[1]),
    more: /\.\.\.\s*$/.test(found[3]),
    part: partOf(found[2]),
    children: [],
  };
};

const flows = [];
for (const chunk of lines.slice(0, functionsAt).join("\n").split(/\n\s*\n/)) {
  const rows = chunk.split("\n").filter((line) => line.trim());
  if (!rows.length || /^(#|Generated from)/.test(rows[0])) continue;
  const stack = [];
  let root;
  for (const line of rows) {
    const node = parseLine(line);
    if (!node) continue;
    node.parent = stack[node.depth - 1];
    if (node.parent) node.parent.children.push(node);
    else root = node;
    stack[node.depth] = node;
    stack.length = node.depth + 1;
  }
  if (root) flows.push(root);
}

const kindOf = (root) => {
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(root.name)) return "route";
  if (root.name === "main" && !/(^|\/)build\.rs$/.test(root.file)) return "program";
  if (/\.rs$/.test(root.file) && /(^|\/)api\//.test(root.file)) return "app";
  if (/\.dart$/.test(root.file)) return "screen";
  return "other";
};

const groups = [
  ["route", "Web routes"],
  ["program", "Programs"],
  ["app", "App functions"],
  ["screen", "Screens"],
  ["other", "Other starting points"],
];

const order = groups.map(([kind]) => kind);
const sizes = new Map(flows.map((root) => [root, (function count(node) { return 1 + node.children.reduce((sum, child) => sum + count(child), 0); })(root)]));
const sorted = [...flows].sort((a, b) => order.indexOf(kindOf(a)) - order.indexOf(kindOf(b)) || (kindOf(a) === "other" ? sizes.get(b) - sizes.get(a) : 0));

const keyOf = (node) => node.name + "|" + node.file;
const flowId = (root) => encodeURIComponent(keyOf(root));

let current;
let everyFunction = false;
let lit = new Set();

const visible = (node) => {
  if (everyFunction || (!node.parent && kindOf(node) === "route")) return node.children;
  const out = [];
  const seen = new Set();
  const walk = (from) => {
    for (const child of from.children) {
      if (child.marks.includes("guess")) continue;
      const hasVersions = child.children.some((grandchild) => grandchild.marks.includes("impl"));
      if (child.part.key === node.part.key && !child.marks.length && !child.more && !hasVersions) walk(child);
      else if (!seen.has(keyOf(child))) {
        seen.add(keyOf(child));
        out.push(child);
      }
    }
  };
  walk(node);
  return out;
};

const allNodes = (root) => {
  const out = [];
  const walk = (node) => {
    out.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return out;
};

const shownParent = (node) => {
  let up = node.parent;
  if (everyFunction) return up;
  while (up && up.parent && up.part.key === up.parent.part.key && !up.marks.length && !up.more && !up.children.some((child) => child.marks.includes("impl"))) up = up.parent;
  return up;
};

const openPathTo = (node) => {
  for (let up = shownParent(node); up; up = shownParent(up)) up.open = true;
};

const element = (tag, className, text) => {
  const made = document.createElement(tag);
  if (className) made.className = className;
  if (text !== undefined) made.textContent = text;
  return made;
};

const chip = (part, count) => {
  const made = element("button", "chip", part.name);
  made.style.setProperty("--h", hue(part.area));
  made.title = part.area + " / " + part.name;
  if (count) made.append(element("b", "", String(count)));
  return made;
};

const badgeNames = {
  impl: ["one of these runs", "impl"],
  "new thread": ["runs on another thread", "thread"],
  guess: ["may be wrong", "guess"],
  generated: ["generated code", ""],
  vendored: ["copied-in code", ""],
};

const renderTree = () => {
  const tree = document.getElementById("tree");
  tree.replaceChildren();
  const list = element("ul", "tree");
  const firstSeen = new Map();
  allNodes(current).forEach((node) => {
    if (!node.more && !firstSeen.has(keyOf(node))) firstSeen.set(keyOf(node), node);
  });
  const draw = (node, into) => {
    const item = element("li");
    const row = element("div", "row" + (lit.has(node) ? " lit" : ""));
    const shownChildren = visible(node);
    row.append(element("span", "toggle", shownChildren.length ? (node.open ? "▾" : "▸") : "·"));
    row.append(chip(node.part));
    row.append(element("span", "name", node.name));
    const signature = signatures.get(keyOf(node));
    if (signature) row.append(element("span", "sig", signature));
    for (const mark of node.marks) {
      const [words, kind] = badgeNames[mark] ?? [mark, ""];
      row.append(element("span", "badge " + kind, words));
    }
    if (node.more) {
      const jump = element("button", "above", "its steps are shown above ↑");
      jump.onclick = (event) => {
        event.stopPropagation();
        const first = firstSeen.get(keyOf(node));
        if (first) show([first]);
      };
      row.append(jump);
    }
    row.onclick = () => {
      node.open = !node.open;
      renderTree();
    };
    item.append(row);
    if (node.open && shownChildren.length) {
      const children = element("ul");
      shownChildren.forEach((child) => draw(child, children));
      item.append(children);
    }
    into.append(item);
  };
  draw(current, list);
  tree.append(list);
};

const show = (nodes) => {
  lit = new Set(nodes);
  nodes.forEach(openPathTo);
  renderTree();
  const first = document.querySelector(".row.lit");
  if (first) first.scrollIntoView({ block: "center" });
};

const renderParts = () => {
  const box = document.getElementById("parts");
  box.replaceChildren();
  const parts = new Map();
  for (const node of allNodes(current)) {
    if (node.marks.includes("guess")) continue;
    if (!parts.has(node.part.key)) parts.set(node.part.key, { part: node.part, nodes: [] });
    parts.get(node.part.key).nodes.push(node);
  }
  const areas = new Map();
  for (const { part, nodes } of parts.values()) {
    if (!areas.has(part.area)) areas.set(part.area, []);
    areas.get(part.area).push(...nodes);
  }
  const chain = element("div", "chain");
  [...parts.values()].forEach(({ part, nodes }, index) => {
    if (index) chain.append(element("span", "arrow", "→"));
    const made = chip(part, nodes.length);
    made.onclick = () => show(nodes);
    chain.append(made);
  });
  if (areas.size > 1) {
    const overview = element("div", "chain");
    [...areas].forEach(([area, nodes], index) => {
      if (index) overview.append(element("span", "arrow", "→"));
      const made = chip({ name: area, area }, nodes.length);
      made.classList.add("big");
      made.onclick = () => show(nodes);
      overview.append(made);
    });
    box.append(overview);
  }
  if (parts.size > 20) {
    const more = element("details");
    more.append(element("summary", "", "Every part (" + parts.size + ")"), chain);
    box.append(more);
  } else box.append(chain);
};

const choose = (root) => {
  current = root;
  lit = new Set();
  document.getElementById("tools").hidden = false;
  allNodes(root).forEach((node) => (node.open = false));
  root.open = true;
  visible(root).forEach((child) => (child.open = visible(child).length < 8));
  document.getElementById("title").textContent = root.name;
  document.getElementById("where").textContent = root.file + " · " + allNodes(root).length + " steps";
  document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("on", button.dataset.id === flowId(root)));
  history.replaceState(null, "", "#" + flowId(root));
  renderParts();
  renderTree();
};

const reachedBy = new Map();
for (const root of flows) {
  for (const node of allNodes(root)) {
    if (node.marks.includes("guess")) continue;
    if (!reachedBy.has(node.part.key)) reachedBy.set(node.part.key, { part: node.part, roots: new Set() });
    reachedBy.get(node.part.key).roots.add(root);
  }
}

const startingPoints = (entry) => {
  const tree = document.getElementById("tree");
  tree.replaceChildren(element("p", "where", entry.part.area + " / " + entry.part.name + " is reached from these starting points. Pick one to see the way there."));
  for (const root of sorted.filter((root) => entry.roots.has(root))) {
    const button = element("button", "start", root.name);
    button.append(element("small", "", root.file));
    button.onclick = () => {
      choose(root);
      show(allNodes(root).filter((node) => node.part.key === entry.part.key && !node.marks.includes("guess")));
    };
    tree.append(button);
  }
};

const overview = () => {
  current = undefined;
  lit = new Set();
  document.getElementById("tools").hidden = true;
  const areas = new Map();
  for (const entry of [...reachedBy.values()].sort((a, b) => a.part.key.localeCompare(b.part.key))) {
    if (!areas.has(entry.part.area)) areas.set(entry.part.area, []);
    areas.get(entry.part.area).push(entry);
  }
  document.getElementById("title").textContent = "The whole project";
  document.getElementById("where").textContent = areas.size + " areas · " + reachedBy.size + " parts · " + flows.length + " starting points";
  document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("on", button.dataset.id === ""));
  history.replaceState(null, "", location.pathname);
  const box = document.getElementById("parts");
  box.replaceChildren();
  for (const [area, entries] of [...areas].sort((a, b) => a[0].localeCompare(b[0]))) {
    const row = element("div", "chain whole");
    const name = chip({ name: area, area });
    name.classList.add("big");
    name.onclick = () => startingPoints({ part: { area, name: "everything", key: "" }, roots: new Set(entries.flatMap((entry) => [...entry.roots])) });
    row.append(name);
    for (const entry of entries) {
      const made = chip(entry.part, entry.roots.size);
      made.onclick = () => startingPoints(entry);
      row.append(made);
    }
    box.append(row);
  }
  document.getElementById("tree").replaceChildren(element("p", "where", "Every area of the code and the parts in it, one file each. The number is how many starting points reach that part. Click a part to see them."));
};

const renderNav = (filter) => {
  const nav = document.getElementById("list");
  nav.replaceChildren();
  const wanted = filter.toLowerCase();
  const onlyOther = flows.every((root) => kindOf(root) === "other");
  if (!wanted) {
    const whole = element("button", current ? "" : "on", "The whole project");
    whole.dataset.id = "";
    whole.append(element("small", "", "every area and part, and what reaches it"));
    whole.onclick = overview;
    nav.append(whole);
  }
  for (const [kind, title] of groups) {
    const members = sorted.filter((root) => kindOf(root) === kind && (root.name + " " + root.file).toLowerCase().includes(wanted));
    if (!members.length) continue;
    const folded = kind === "other" && !wanted && !onlyOther;
    const holder = element(folded ? "details" : "div");
    holder.append(element(folded ? "summary" : "h2", "", title + " (" + members.length + ")"));
    for (const root of members) {
      const button = element("button", root === current ? "on" : "", root.name);
      button.dataset.id = flowId(root);
      button.append(element("small", "", root.file));
      button.onclick = () => choose(root);
      holder.append(button);
    }
    nav.append(holder);
  }
};

document.getElementById("search").oninput = (event) => renderNav(event.target.value);
document.getElementById("find").onkeydown = (event) => {
  if (event.key !== "Enter") return;
  const wanted = event.target.value.toLowerCase();
  if (wanted) show(allNodes(current).filter((node) => node.name.toLowerCase().includes(wanted)));
};
document.getElementById("every").onchange = (event) => {
  everyFunction = event.target.checked;
  renderTree();
};
document.getElementById("open").onclick = () => {
  allNodes(current).forEach((node) => (node.open = true));
  renderTree();
};
document.getElementById("close").onclick = () => {
  allNodes(current).forEach((node) => (node.open = false));
  current.open = true;
  renderTree();
};

const asked = decodeURIComponent(location.hash.slice(1));
const start = flows.find((root) => keyOf(root) === asked);
renderNav("");
if (start) choose(start);
else overview();
`;
  const body = String.raw`
<header>
  <h1>How the code runs</h1>
  <p>Made from the code by a program after every change. Do not edit. Start from the whole project, or pick a starting point and open any step.</p>
</header>
<main>
  <nav><input id="search" type="search" placeholder="Find a starting point" aria-label="Find a starting point"><div id="list"></div></nav>
  <section>
    <h2 id="title"></h2>
    <div class="where" id="where"></div>
    <div class="parts" id="parts"></div>
    <div class="tools" id="tools">
      <input id="find" type="search" placeholder="Find a step, then Enter" aria-label="Find a step">
      <label><input type="checkbox" id="every"> every function</label>
      <button id="open">Open all</button>
      <button id="close">Close all</button>
    </div>
    <div id="tree"></div>
    <div class="legend">
      <p>The chains at the top are what this starting point reaches, in the order it first reaches them: first the big areas, such as a crate or a package, then the parts inside them, one file each. A part has its area's colour, and the number is how many steps run there. Click one to see those steps.</p>
      <p>Below, each line is one step: the part it is in, the function, what it takes and what it gives. A step under another is called by it, in the order the code calls them. Click a line to open or close it.</p>
      <p>Only the steps that move into another part are shown, and calls the program could only guess are left out. Tick "every function" to see each one.</p>
      <p>"one of these runs": the same step has several versions and only the one that fits runs. "runs on another thread": it works in the background and the step above does not wait for it. "may be wrong": the program matched this call by its name only.</p>
      <p>This shows every step that can happen, not which one happens in a given case: read the code for that.</p>
    </div>
  </section>
</main>`;
  const data = JSON.stringify(map).replace(/</g, "\\u003c");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>How the code runs</title>",
    "<style>" + style + "</style>",
    "</head>",
    "<body>" + body,
    "<script>",
    "const MAP = " + data + ";",
    script,
    "</script>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
