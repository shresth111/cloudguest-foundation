/**
 * Static collector: every API call a customer page can reach.
 *
 * Shared by the partner-console page tests (portal, access, engage, ...). The
 * partner console mounts customer pages UNCHANGED and relies on the request
 * shim to rewrite each call to an `/isp/venue/...` twin, so a test needs the
 * page's full call list:
 *
 *   - direct `api.<verb>(path)` / `getAllItems(path)` calls in the entry and
 *     in every component / hook / lib module it imports (walked whole);
 *   - for service modules (`src/services/**`), only the functions the page
 *     actually uses -- `svc.method(...)`, `namedFn(...)`, `defaultImport(...)`
 *     -- followed through their own helpers, `this.x(...)`, sibling object
 *     methods and other services they import.
 *
 * Entries may name one export of a multi-view module (`OperationsFeatures`'s
 * `OpenHoursView`); then only that export's body and the same-file helpers it
 * uses are scanned.
 *
 * Template expressions become a fixed UUID, so `/x/${id}` -> `/x/<uuid>`.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export const UUID = "0f8c2a3e-1b2c-4d5e-8f90-123456789abc";

const API_CALL =
  /\bapi\.(get|post|put|patch|delete)\s*(?:<[^()]*?>)?\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g;
const ALL_ITEMS = /\b(?:getAllItems|listAllPages)\s*(?:<[^()]*?>)?\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g;

export function makeCollector(root) {
  const read = (rel) => readFileSync(join(root, rel), "utf8");

  function resolveImport(fromRel, spec) {
    let base;
    if (spec.startsWith("@/")) base = join("src", spec.slice(2));
    else if (spec.startsWith(".")) base = join(dirname(fromRel), spec);
    else return null;
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
      const cand = base + ext;
      const abs = join(root, cand);
      if (existsSync(abs) && statSync(abs).isFile()) return cand;
    }
    return null;
  }

  /** The keys of the first `params: { ... }` object literal right after a
   * call (the axios config the page sends), e.g. ["location_id", "page"]. */
  function paramKeysAfter(text, index) {
    const window = text.slice(index, index + 600);
    const m = /params\s*:\s*\{([^{}]*)\}/.exec(window);
    if (!m) return [];
    return [...m[1].matchAll(/(?:^|[,{\s])([a-z_][a-z0-9_]*)\s*(?::|,|$)/gi)]
      .map((x) => x[1])
      .filter((k) => !["true", "false", "null", "undefined"].includes(k));
  }

  function pathsIn(text) {
    const out = [];
    for (const m of text.matchAll(API_CALL)) out.push([m[1], m[2], paramKeysAfter(text, m.index)]);
    for (const m of text.matchAll(ALL_ITEMS))
      out.push(["get", m[1], paramKeysAfter(text, m.index)]);
    return out.map(([method, lit, keys]) => [
      method,
      lit
        .slice(1, -1)
        .replace(/\$\{[^}]*\?[^}]*"activate"[^}]*\}/g, "activate")
        .replace(/\$\{[^}]*\}/g, UUID),
      keys,
    ]);
  }

  /** `{ localName -> { file, imported } }` for one module's imports. */
  function importsOf(rel, text) {
    const out = new Map();
    const re = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
    for (const m of text.matchAll(re)) {
      if (m[1]) continue;
      const file = resolveImport(rel, m[3]);
      if (!file) continue;
      const clause = m[2].trim();
      const named = /\{([\s\S]*)\}/.exec(clause);
      const def = clause
        .replace(/\{[\s\S]*\}/, "")
        .replace(/,/g, "")
        .trim();
      if (def && !def.startsWith("*")) out.set(def, { file, imported: "default" });
      if (named) {
        for (const part of named[1].split(",")) {
          const p = part.trim().replace(/^type\s+/, "");
          if (!p) continue;
          const [orig, alias] = p.split(/\s+as\s+/);
          out.set((alias ?? orig).trim(), { file, imported: orig.trim() });
        }
      }
    }
    return out;
  }

  /** Body text of a function / method / const named `name` in `text`. */
  function bodyOf(text, name) {
    if (["if", "for", "while", "switch", "catch", "return"].includes(name)) return null;
    const re = new RegExp(
      // definitions only: `async name(`, a method shorthand at line start,
      // `function name`, `const name =` -- never a call site.
      `(?:async\\s+${name}\\s*[<(]|^\\s+${name}\\s*\\([^)]*\\)\\s*(?::[^{\\n]*)?\\{|function\\s+${name}\\s*[<(]|const\\s+${name}\\s*[:=])`,
      "m",
    );
    const m = re.exec(text);
    if (!m) return null;
    const close = text.indexOf(")", m.index + m[0].length - 1);
    let i = text.indexOf("{\n", close === -1 ? m.index : close);
    if (i === -1) return null;
    let depth = 0;
    for (let j = i; j < text.length; j += 1) {
      if (text[j] === "{") depth += 1;
      else if (text[j] === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(i, j + 1);
      }
    }
    return null;
  }

  function isService(rel) {
    return rel.startsWith("src/services/") && rel !== "src/services/api.ts";
  }
  function skip(rel) {
    return rel === "src/services/api.ts" || rel.startsWith("src/components/ui/");
  }

  const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "function"]);

  /** The export's body plus every same-file declaration it references. */
  function slice(text, exportName) {
    const decls = [
      ...text.matchAll(
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)/gm,
      ),
    ].map((m) => m[1]);
    const first = bodyOf(text, exportName);
    if (!first) return null;
    const local = new Set([exportName]);
    const queue = [first];
    let joined = "";
    while (queue.length) {
      const b = queue.shift();
      joined += `\n${b}`;
      for (const d of decls) {
        if (!local.has(d) && new RegExp(`\\b${d}\\b`).test(b)) {
          local.add(d);
          const db = bodyOf(text, d);
          if (db) queue.push(db);
        }
      }
    }
    return joined;
  }

  /**
   * @param entries Array<{ file: string, exportName?: string }>
   * @returns Map<"verb path", fromFile>
   */
  /** "verb path" -> the query-param keys any caller sends with it. */
  const paramShapes = new Map();

  function collect(entries) {
    const calls = new Map();
    const record = (pairs, from) => {
      for (const [verb, path, keys] of pairs) {
        calls.set(`${verb} ${path}`, from);
        const k = `${verb} ${path}`;
        const prev = paramShapes.get(k) ?? new Set();
        for (const key of keys ?? []) prev.add(key);
        paramShapes.set(k, prev);
      }
    };
    const seen = new Set();
    const queue = []; // [file, exportName|null, isService]

    function follow(rel, text, scope) {
      const imports = importsOf(rel, text);
      for (const [local, imp] of imports) {
        if (skip(imp.file)) continue;
        const esc = local.replace(/[$]/g, "\\$");
        if (!new RegExp(`\\b${esc}\\b`).test(scope)) continue;
        if (isService(imp.file)) {
          for (const m of scope.matchAll(new RegExp(`\\b${esc}\\s*\\.\\s*(\\w+)\\s*\\(`, "g")))
            queue.push([imp.file, m[1], true]);
          if (new RegExp(`\\b${esc}\\s*\\(`).test(scope))
            queue.push([imp.file, imp.imported === "default" ? local : imp.imported, true]);
        } else {
          queue.push([imp.file, imp.imported === "default" ? null : imp.imported, false]);
        }
      }
    }

    for (const e of entries) queue.push([e.file, e.exportName ?? null, false]);
    while (queue.length) {
      const [file, name, service] = queue.pop();
      const key = `${file}#${name}`;
      if (seen.has(key) || skip(file)) continue;
      seen.add(key);
      const text = read(file);
      let scope;
      if (name === null) scope = text;
      else scope = slice(text, name);
      if (scope == null) {
        // a type, constant or re-export: fall back to the whole module for
        // components/hooks, nothing for services
        if (service) continue;
        scope = text;
      }
      record(pathsIn(scope), name ? `${file}#${name}` : file);
      if (service) {
        // sibling methods / this.x() inside the same service object
        for (const m of scope.matchAll(/\b(?:this\s*\.\s*|\w+\s*\.\s*)?(\w+)\s*\(/g)) {
          const n = m[1];
          if (n !== name && !KEYWORDS.has(n) && bodyOf(text, n)) queue.push([file, n, true]);
        }
      }
      follow(file, text, scope);
    }
    return calls;
  }

  return { collect, read, paramShapes };
}
