/**
 * The partner console mounts the customer's OWN Portal page
 * (`src/components/features/PortalPage.tsx`) unchanged inside a venue scope.
 * The only thing standing between that page and a 403 is the request shim
 * rewriting each of its calls to a `/isp/venue/...` twin.
 *
 * This pins it from the source, so a call added to the page (or to a service
 * method the page uses) on main fails here instead of 403ing in the field:
 *
 *   1. Collect every API path the page can reach: direct `api.*` calls in the
 *      page and in the components it imports, plus the bodies of every
 *      `portalService.X` / `brandAssetService.X` / `resolveOrgId` the page
 *      calls, following the service file's own helper functions.
 *   2. Each path must be rewritten by the real shim (bundled with esbuild,
 *      requests stopped at a fake adapter) to a twin path the backend mounts
 *      (`app/domains/isp_partner/twins_portal.py`, `venue_session.py`), with
 *      the venue headers attached and the ISP org on X-Organization-Id.
 *   3. With no venue pinned, nothing is rewritten (fail closed).
 *   4. The old simplified editor is gone from the partner console.
 *
 * Run: node scripts/test-isp-partner-portal-shim.mjs
 */
import { build } from "esbuild";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let checks = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const PAGE = "src/components/features/PortalPage.tsx";
const UUID = "0f8c2a3e-1b2c-4d5e-8f90-123456789abc";

// -- 1. collect -------------------------------------------------------------
function resolveImport(fromRel, spec) {
  let base;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(fromRel), spec);
  else return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    const cand = base + ext;
    if (existsSync(join(ROOT, cand)) && !cand.endsWith("/")) {
      try {
        readFileSync(join(ROOT, cand));
        return cand;
      } catch {
        /* a directory */
      }
    }
  }
  return null;
}

const API_CALL =
  /\bapi\.(get|post|put|patch|delete)\s*(?:<[^()]*?>)?\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g;
const ALL_ITEMS = /\bgetAllItems\s*(?:<[^()]*?>)?\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g;

function pathsIn(text) {
  const out = [];
  for (const m of text.matchAll(API_CALL)) out.push([m[1], m[2]]);
  for (const m of text.matchAll(ALL_ITEMS)) out.push(["get", m[1]]);
  return out.map(([method, lit]) => [
    method,
    lit
      .slice(1, -1)
      .replace(/\$\{[^}]*status[^}]*\}/g, "activate")
      .replace(/\$\{[^}]*\}/g, UUID),
  ]);
}

/** The text of `name`'s body inside a module (object method or function). */
function bodyOf(text, name) {
  const re = new RegExp(
    `(?:async\\s+${name}\\s*\\(|function\\s+${name}\\s*\\(|const\\s+${name}\\s*=)`,
  );
  const m = re.exec(text);
  if (!m) return null;
  let i = text.indexOf("{", m.index + m[0].length);
  // skip a destructured/typed parameter list's braces: find the "{" after ")"
  const close = text.indexOf(")", m.index + m[0].length - 1);
  if (close !== -1 && close < text.length) {
    // A body opens with "{" + newline; an inline return type such as
    // `Promise<{ shown: number }>` does not, so it is skipped.
    const arrow = text.indexOf("{\n", close);
    if (arrow !== -1) i = arrow;
  }
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

function serviceReach(fileRel, methods) {
  const text = read(fileRel);
  const topLevel = new Set(
    [...text.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]),
  );
  const seen = new Set();
  const queue = [...methods];
  const found = [];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const body = bodyOf(text, name);
    if (!body) {
      check(`${fileRel}: found ${name}()`, false, "method not found; update this test");
      continue;
    }
    found.push(...pathsIn(body));
    for (const helper of topLevel) {
      if (!seen.has(helper) && new RegExp(`\\b${helper}\\s*\\(`).test(body)) queue.push(helper);
    }
  }
  return found;
}

const page = read(PAGE);
const reached = [];
// direct calls in the page + every component module it imports (not services)
const visited = new Set();
const stack = [PAGE];
while (stack.length) {
  const rel = stack.pop();
  if (visited.has(rel)) continue;
  visited.add(rel);
  const text = read(rel);
  reached.push(...pathsIn(text).map((p) => [...p, rel]));
  for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) {
    const dep = resolveImport(rel, m[1]);
    if (!dep) continue;
    if (dep.startsWith("src/services/") || dep.startsWith("src/components/ui/")) continue;
    if (dep === "src/services/api.ts") continue;
    stack.push(dep);
  }
}
const SERVICES = {
  portalService: "src/services/portal.service.ts",
  brandAssetService: "src/services/brand-asset.service.ts",
};
for (const [obj, file] of Object.entries(SERVICES)) {
  const used = [
    ...new Set(
      [...page.matchAll(new RegExp(`${obj}\\s*\\.\\s*(\\w+)\\s*\\(`, "g"))].map((m) => m[1]),
    ),
  ];
  check(`${obj}: the page calls some methods`, used.length > 0, obj);
  reached.push(...serviceReach(file, used).map((p) => [...p, file]));
}
if (/resolveOrgId\(/.test(page)) {
  reached.push(
    ...serviceReach("src/services/organization-id.ts", ["resolveOrganizationId"]).map((p) => [
      ...p,
      "organization-id.ts",
    ]),
  );
}

const unique = new Map();
for (const [method, path, from] of reached) unique.set(`${method} ${path}`, from);
console.log(`collected ${unique.size} distinct calls`);
check("the collector found the page's calls", unique.size >= 10, String(unique.size));

// -- 2. rewrite through the real shim ----------------------------------------
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-portal-shim-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { api } from "${p("src/services/api.ts")}";
   export * from "${p("src/lib/isp-partner/api-shim.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  external: ["axios"],
  nodePaths: [join(ROOT, "node_modules")],
  define: { "import.meta.env": JSON.stringify({ VITE_API_BASE_URL: "/api/v1" }) },
  plugins: [
    {
      name: "at-alias",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) =>
          b.resolve(`./src/${args.path.slice(2)}`, { resolveDir: ROOT, kind: args.kind }),
        );
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx" },
});
const { api, installIspApiShim, setShimIspOrganization, setShimVenue } = await import(outfile);
const sent = [];
api.defaults.adapter = async (config) => {
  sent.push(config);
  return { data: { success: true, data: {} }, status: 200, statusText: "OK", headers: {}, config };
};
installIspApiShim(api);
const ISP = "11111111-1111-1111-1111-111111111111";
const CUST = "22222222-2222-2222-2222-222222222222";
const LOC = "33333333-3333-3333-3333-333333333333";
setShimIspOrganization(ISP);

/** Paths the backend mounts (twins_portal.py + venue_session.py), as templates. */
const TWINS = [
  "GET /isp/venue/branding",
  "PUT /isp/venue/branding",
  "POST /isp/venue/branding/logo",
  "DELETE /isp/venue/branding/logo",
  "GET /isp/venue/branding/logo/raw",
  "POST /isp/venue/branding/background-image",
  "DELETE /isp/venue/branding/background-image",
  "GET /isp/venue/branding/background-image/raw",
  "GET /isp/venue/captive-portal-configs",
  "POST /isp/venue/captive-portal-configs",
  "GET /isp/venue/captive-portal-configs/{id}",
  "PUT /isp/venue/captive-portal-configs/{id}",
  "POST /isp/venue/captive-portal-configs/{id}/activate",
  "POST /isp/venue/captive-portal-configs/{id}/deactivate",
  "POST /isp/venue/captive-portal-configs/{id}/content-image",
  "DELETE /isp/venue/captive-portal-configs/{id}/content-image",
  "GET /isp/venue/captive-portal/review-stats",
  "GET /isp/venue/organizations/{id}",
  "GET /isp/venue/organizations/{id}/locations",
  "GET /isp/venue/me/organizations",
];

/** Reachable in the source but not from this page, each with the reason. */
const NOT_FROM_THIS_PAGE = new Map([
  [
    "get /organizations",
    "fetchOrgNameMap's no-org branch; PortalPage always passes the resolved org id",
  ],
]);

console.log("every page call reaches a twin");
setShimVenue(CUST, LOC);
for (const [key, from] of unique) {
  const [method, path] = key.split(" ");
  if (NOT_FROM_THIS_PAGE.has(key)) {
    check(`${key} documented as unreachable here: ${NOT_FROM_THIS_PAGE.get(key)}`, true);
    continue;
  }
  sent.length = 0;
  await api.request({ method, url: path, data: method === "get" ? undefined : {} });
  const cfg = sent[0];
  const got = (cfg?.url ?? "").split("?")[0].replaceAll(UUID, "{id}");
  const twin = `${method.toUpperCase()} ${got}`;
  check(
    `${key.replace(UUID, "{id}")} (${from.split("/").pop()}) -> ${got}`,
    TWINS.includes(twin),
    `not a mounted twin: ${twin}`,
  );
  const h = cfg?.headers ?? {};
  const header = (n) => (typeof h.get === "function" ? h.get(n) : h[n]);
  check(
    `  carries the venue + ISP headers`,
    header("X-Isp-Customer-Id") === CUST &&
      header("X-Isp-Location-Id") === LOC &&
      header("X-Organization-Id") === ISP,
  );
}

console.log("fail closed with no venue");
setShimVenue(null, null);
for (const key of ["get /branding", "get /me/organizations", "get /captive-portal-configs"]) {
  const [method, path] = key.split(" ");
  sent.length = 0;
  await api.request({ method, url: path }).catch(() => {});
  check(`${key} untouched without a venue`, sent[0]?.url === path, sent[0]?.url);
}
setShimVenue(CUST, LOC);
for (const path of [
  `/branding/${UUID}/logo/public`,
  `/captive-portal-configs/${UUID}/content-image/public`,
  "/organizations",
]) {
  sent.length = 0;
  await api.request({ method: "get", url: path }).catch(() => {});
  check(
    `${path.replace(UUID, "{id}")} is never rewritten (no twin)`,
    sent[0]?.url === path,
    sent[0]?.url,
  );
}
setShimVenue(null, null);

// -- 4. the old editor is gone ------------------------------------------------
function walk(dir) {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(rel));
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}
const partnerFiles = [
  ...walk("src/components/isp-partner"),
  ...walk("src/routes").filter((f) => f.includes("partner")),
];
check(
  "PortalEditor is not referenced in the partner console",
  !partnerFiles.some((f) => /PortalEditor/.test(read(f))),
);
check(
  "no 'Logo URL' text field in the partner console",
  !partnerFiles.some((f) => /Logo URL/i.test(read(f))),
);
check(
  "VenuePortal mounts the customer PortalPage",
  /features\/PortalPage/.test(read("src/components/isp-partner/workspace/VenuePortal.tsx")),
);

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
