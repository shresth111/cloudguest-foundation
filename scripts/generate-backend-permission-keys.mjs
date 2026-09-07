/**
 * Vendors the backend's seeded RBAC permission keys into this repo.
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/lib/customerNavPermissions.ts` decides which sidebar rows a customer
 * sees by asking "does this caller hold `<some key>`?". The keys it asks for
 * are written here; the keys that actually exist are written in another
 * repository, by another team, in Python. Nothing connected the two, so a
 * key could be misspelled -- or simply never seeded -- and the only symptom
 * was a nav row that quietly stopped rendering. No console error, no 403,
 * no failing test: the item is absent, and an absent item looks exactly
 * like a deliberate product decision.
 *
 * That is not hypothetical. `dashboard: ["dashboard.read"]` shipped and hid
 * the Dashboard row from every single user including the organization
 * owner, because the DASHBOARD module's only seeded action is `view`
 * (`MODULE_ACTIONS[PermissionModule.DASHBOARD] == (VIEW,)`). The founder
 * could not navigate back to his own dashboard.
 *
 * So: generate the real key list from the backend's seed and commit it.
 * `scripts/test-customer-nav-permissions.mjs` then asserts every key the
 * nav demands is a member of it, and a key that does not exist fails a
 * test instead of hiding a screen.
 *
 * WHY IT PARSES PYTHON INSTEAD OF IMPORTING IT
 * --------------------------------------------
 * `app/domains/rbac/seed.py` imports SQLAlchemy models and a repository, so
 * importing it needs the backend's virtualenv and a working Python. CI for
 * this repo has neither. The two declarations we need -- `MODULE_ACTIONS`
 * in seed.py and the `PermissionModule`/`PermissionAction` StrEnums in
 * enums.py -- are plain literals, so they are read textually here. The
 * parser is deliberately strict: anything it does not recognise is a hard
 * error rather than a silently shorter key list, because a silently
 * shorter key list is the exact failure this guard exists to prevent.
 *
 * USAGE
 *   node scripts/generate-backend-permission-keys.mjs           # rewrite
 *   node scripts/generate-backend-permission-keys.mjs --check   # verify
 *
 * `--check` is what CI runs. When the backend checkout is not present it
 * reports that and exits 0 -- this repo builds and deploys on its own, and
 * failing every unrelated PR because a sibling directory is missing would
 * teach people to ignore the check. The committed file is still asserted
 * against by the nav test, which needs no backend checkout at all.
 *
 * Point it at a different checkout with CLOUDGUEST_BACKEND=/path/to/backend.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "src/lib/backendPermissionKeys.generated.ts");

const BACKEND =
  process.env.CLOUDGUEST_BACKEND ?? resolve(ROOT, "..", "cloud-guest-repo", "backend");
const ENUMS = join(BACKEND, "app/domains/rbac/enums.py");
const SEED = join(BACKEND, "app/domains/rbac/seed.py");

const checkOnly = process.argv.includes("--check");

/** Strip `#` comments, respecting string literals, so a commented-out
 * member can never be read as a real one. */
function stripComments(src) {
  return src
    .split("\n")
    .map((line) => {
      let inStr = null;
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (inStr) {
          if (c === "\\") i += 1;
          else if (c === inStr) inStr = null;
        } else if (c === '"' || c === "'") {
          inStr = c;
        } else if (c === "#") {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

/** `class Name(StrEnum): MEMBER = "value"` -> { MEMBER: "value" }.
 *
 * The class body is taken as every line indented past the `class` line,
 * so a later top-level declaration can never leak members in. */
function parseStrEnum(src, className) {
  const lines = stripComments(src).split("\n");
  const start = lines.findIndex((l) => new RegExp(`^class ${className}\\(StrEnum\\):`).test(l));
  if (start === -1) throw new Error(`could not find "class ${className}(StrEnum)" in enums.py`);
  const members = {};
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (!/^\s/.test(line)) break; // dedented back to top level: class over
    const m = line.match(/^\s+([A-Z][A-Z0-9_]*)\s*=\s*"([^"]+)"\s*$/);
    if (m) members[m[1]] = m[2];
  }
  if (Object.keys(members).length === 0) throw new Error(`${className} parsed as empty`);
  return members;
}

/** The `MODULE_ACTIONS: Mapping[...] = { ... }` literal in seed.py, read as
 * a list of [moduleValue, actionValue[]] pairs. */
function parseModuleActions(src, modules, actions) {
  const clean = stripComments(src);
  const open = clean.indexOf("MODULE_ACTIONS");
  if (open === -1) throw new Error("could not find MODULE_ACTIONS in seed.py");
  const braceStart = clean.indexOf("{", open);
  if (braceStart === -1) throw new Error("MODULE_ACTIONS has no opening brace");

  // Walk to the matching close brace rather than regexing to the first `}`
  // -- the literal contains nested tuples and, in future, may contain
  // nested braces.
  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < clean.length; i += 1) {
    if (clean[i] === "{") depth += 1;
    else if (clean[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  if (braceEnd === -1) throw new Error("MODULE_ACTIONS literal is not closed");
  const body = clean.slice(braceStart + 1, braceEnd);

  // `PermissionModule.X: (_A.Y, _A.Z),` -- seed.py aliases the action enum
  // as `_A` and the module enum as `_M`; accept both the alias and the full
  // name so an alias rename is a parse error, not a silent miss.
  const entryRe = /(?:PermissionModule|_M)\.([A-Z][A-Z0-9_]*)\s*:\s*\(([^)]*)\)/g;
  const out = [];
  let match;
  let consumed = 0;
  while ((match = entryRe.exec(body)) !== null) {
    consumed += match[0].length;
    const [, moduleName, actionsBlob] = match;
    const moduleValue = modules[moduleName];
    if (!moduleValue) {
      throw new Error(`MODULE_ACTIONS names PermissionModule.${moduleName}, absent from enums.py`);
    }
    const actionNames = [
      ...actionsBlob.matchAll(/(?:PermissionAction|_A)\.([A-Z][A-Z0-9_]*)/g),
    ].map((m) => m[1]);
    if (actionNames.length === 0) {
      throw new Error(`MODULE_ACTIONS[${moduleName}] parsed as an empty action tuple`);
    }
    for (const actionName of actionNames) {
      const actionValue = actions[actionName];
      if (!actionValue) {
        throw new Error(
          `MODULE_ACTIONS[${moduleName}] names PermissionAction.${actionName}, absent from enums.py`,
        );
      }
      out.push(`${moduleValue}.${actionValue}`);
    }
  }
  if (out.length === 0) throw new Error("MODULE_ACTIONS parsed as empty");

  // Every module in the enum must appear. seed.py generates a permissions
  // row for each MODULE_ACTIONS entry, so a module missing from the mapping
  // is either a backend bug or a parse failure -- both worth stopping for.
  const seen = new Set([...body.matchAll(entryRe)].map((m) => modules[m[1]]));
  const unmapped = Object.values(modules).filter((v) => !seen.has(v));
  if (unmapped.length > 0) {
    throw new Error(
      `these PermissionModule members have no MODULE_ACTIONS entry (parser drift?): ${unmapped.join(", ")}`,
    );
  }
  // Sanity floor: catches a regex that matched a handful of entries and
  // stopped, which would otherwise vendor a short list that passes.
  if (consumed < body.length * 0.5) {
    throw new Error(
      `parsed only ${consumed} of ${body.length} chars of MODULE_ACTIONS -- the literal's shape has changed`,
    );
  }
  return [...new Set(out)].sort();
}

function render(keys) {
  return `// GENERATED FILE -- DO NOT EDIT BY HAND.
//
// Regenerate with:  node scripts/generate-backend-permission-keys.mjs
// Source of truth:  cloud-guest-repo/backend/app/domains/rbac/seed.py
//                   (MODULE_ACTIONS x app/domains/rbac/enums.py)
//
// Every RBAC permission key the backend actually seeds into its
// \`permissions\` table, as \`<module>.<action>\`. \`GET /me/permissions\`
// returns a subset of exactly these strings.
//
// This list exists so that a frontend module asking for a permission key
// can be checked against the keys that exist. Asking for one that does not
// exist is not an error anywhere at runtime -- the check simply never
// matches, and whatever it guarded disappears with no signal. See
// \`scripts/generate-backend-permission-keys.mjs\` for the incident that
// motivated vendoring this, and \`customerNavPermissions.ts\` for the
// consumer.
//
// ${keys.length} keys.
export const BACKEND_PERMISSION_KEYS: readonly string[] = [
${keys.map((k) => `  "${k}",`).join("\n")}
];

/** \`BACKEND_PERMISSION_KEYS\` as a set, for membership checks. */
export const BACKEND_PERMISSION_KEY_SET: ReadonlySet<string> = new Set(BACKEND_PERMISSION_KEYS);
`;
}

// ---------------------------------------------------------------------------

if (!existsSync(ENUMS) || !existsSync(SEED)) {
  const msg = `backend checkout not found at ${BACKEND} (set CLOUDGUEST_BACKEND to override)`;
  if (checkOnly) {
    console.log(`  skip  ${msg}`);
    console.log("\npermission key drift check skipped (no backend checkout)\n");
    process.exit(0);
  }
  console.error(`error: ${msg}`);
  process.exit(1);
}

const modules = parseStrEnum(readFileSync(ENUMS, "utf8"), "PermissionModule");
const actions = parseStrEnum(readFileSync(ENUMS, "utf8"), "PermissionAction");
const keys = parseModuleActions(readFileSync(SEED, "utf8"), modules, actions);
const rendered = render(keys);

if (checkOnly) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current === rendered) {
    console.log(`  ok   ${keys.length} backend permission keys, vendored copy is current`);
    console.log("\npermission key drift check passed\n");
    process.exit(0);
  }
  const currentKeys = new Set([...current.matchAll(/^  "([^"]+)",$/gm)].map((m) => m[1]));
  const added = keys.filter((k) => !currentKeys.has(k));
  const removed = [...currentKeys].filter((k) => !keys.includes(k));
  console.log("  FAIL vendored backend permission keys have drifted from the backend seed");
  if (added.length) console.log(`         seeded but not vendored: ${added.join(", ")}`);
  if (removed.length) console.log(`         vendored but no longer seeded: ${removed.join(", ")}`);
  if (!added.length && !removed.length) console.log("         (header/formatting differs)");
  console.log("\n  run: node scripts/generate-backend-permission-keys.mjs\n");
  process.exit(1);
}

writeFileSync(OUT, rendered);
console.log(
  `wrote ${keys.length} backend permission keys to src/lib/backendPermissionKeys.generated.ts`,
);
