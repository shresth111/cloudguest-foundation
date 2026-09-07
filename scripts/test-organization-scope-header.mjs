#!/usr/bin/env node
// =====================================================================
// EVERY REQUEST SAYS WHICH ORGANIZATION IT IS ABOUT
// =====================================================================
// The defect (2026-09-07). A founder holding `Super Admin` at GLOBAL scope
// opened a report about his own venue and read numbers blended across all
// fourteen organizations in the database -- most of them demo and QA
// fixtures (`Wyfy Demo`, `testyyy`, `QA Test Co`, `TechQA-4471`, ...).
//
// He was entitled to every one of those rows, so nothing failed, nothing
// 403'd, and nothing on the screen was marked. That is what made it bad: a
// `total_items` or a `success_rate_percentage` summed over fourteen tenants
// renders identically to one summed over one.
//
// The cause was here, in this file's subject. `attachOrganizationScope` in
// src/services/api.ts used to `return` early for any session holding a
// GLOBAL-scoped role -- deliberately, because the backend read a missing
// `X-Organization-Id` as "every organization" and the master console
// depended on that. The reasoning was right about the backend and wrong
// about the population: the founder holds that role AND spends his time on
// the customer dashboard, so every report he opened went out with no
// tenancy at all.
//
// The rule now: a request states its tenancy, either
// `X-Organization-Id: <one org>` or `X-Organization-Scope: all`. Reading
// across tenants is a thing you ask for, never a thing you get by omission.
//
// WHAT THIS CHECKS. Real behaviour, not source text: it bundles the real
// src/services/api.ts with esbuild, swaps axios's adapter for one that
// captures the outgoing request instead of sending it, and drives the real
// interceptor over the four sessions that matter. A source-grep could not
// tell the difference between the header being computed and the header
// being attached.
//
// Run: node scripts/test-organization-scope-header.mjs

import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${extra ? `\n       ${extra}` : ""}`);
}

// ---------------------------------------------------------------------
// Bundle the real api.ts (plus axios) into something node can import.
// ---------------------------------------------------------------------
// Inside the repo's own node_modules rather than /tmp: axios stays external
// (bundling its node build pulls in CJS `require("util")`, which an ESM
// bundle cannot do), so the emitted module has to sit somewhere node will
// resolve a bare `axios` specifier from.
const work = join(ROOT, "node_modules", ".org-scope-test");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

writeFileSync(
  join(work, "entry.js"),
  `export {
     api,
     ORG_HEADER,
     ORG_SCOPE_HEADER,
     ALL_ORGANIZATIONS,
     ACTIVE_ORG_STORAGE_KEY,
     ROLES_STORAGE_KEY,
     ORGS_STORAGE_KEY,
     TOKEN_STORAGE_KEY,
     resolveOrganizationScope,
     setOrganizationScope,
     crossOrganizationHeaders,
   } from "@/services/api";`,
);

await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "bundle.mjs"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  external: ["axios"],
  loader: { ".css": "empty" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env.VITE_API_BASE_URL": '"/api/v1"',
  },
  plugins: [
    {
      name: "src-alias",
      setup(b) {
        // `@/x` -> `<root>/src/x`, with the extension probing esbuild would
        // otherwise do for us (an onResolve result must be an exact path).
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          const probes = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
          for (const p of probes) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

// ---------------------------------------------------------------------
// A localStorage/window good enough for the interceptor.
// ---------------------------------------------------------------------
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  location: { pathname: "/customer/dashboard", origin: "http://localhost" },
};
globalThis.localStorage = globalThis.window.localStorage;

const mod = await import(pathToFileURL(join(work, "bundle.mjs")).href);
const {
  api,
  ORG_HEADER,
  ORG_SCOPE_HEADER,
  ALL_ORGANIZATIONS,
  ACTIVE_ORG_STORAGE_KEY,
  ROLES_STORAGE_KEY,
  ORGS_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} = mod;

// A far-future, unsigned JWT. `isTokenSpent` only reads `exp`, and a token
// that parses as live keeps the interceptor off the refresh path -- which
// would otherwise try to reach a network that is not there.
const EXP = Math.floor(Date.now() / 1000) + 86_400;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const TOKEN = `${b64({ alg: "none" })}.${b64({ exp: EXP })}.x`;

// Capture instead of send. The request interceptor has already run by the
// time the adapter is called, so `config.headers` is exactly what would
// have gone on the wire.
api.defaults.adapter = async (config) => ({
  data: {},
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

const REAL_ORG = "08ec098b-1fb0-4bd0-bcc2-fe489d01ec4c"; // WyFy Guest
const DEMO_ORG = "11111111-2222-3333-4444-555555555555"; // a QA fixture

function session({ roles = [], orgs = [], selected = null, pathname = "/customer/dashboard" }) {
  store.clear();
  store.set(TOKEN_STORAGE_KEY, TOKEN);
  store.set(ROLES_STORAGE_KEY, JSON.stringify(roles));
  store.set(ORGS_STORAGE_KEY, JSON.stringify(orgs));
  if (selected) store.set(ACTIVE_ORG_STORAGE_KEY, selected);
  globalThis.window.location.pathname = pathname;
}

async function headersFor(url = "/alerts", config = {}) {
  const res = await api.get(url, config);
  const h = res.config.headers;
  const get = (name) => (typeof h.get === "function" ? h.get(name) : h[name]);
  return { org: get(ORG_HEADER) ?? null, scope: get(ORG_SCOPE_HEADER) ?? null };
}

const GLOBAL_ROLE = { scopeType: "global", roleSlug: "super-admin" };
const OWNER_ROLE = { scopeType: "organization", roleSlug: "organization-owner" };
const MEMBERSHIP = { organizationId: REAL_ORG, organizationName: "WyFy Guest" };

// ---------------------------------------------------------------------
// 1. The founder's case, which is the whole reason this file exists.
// ---------------------------------------------------------------------
{
  // Super Admin at global scope AND Organization Owner on his own venue --
  // the exact shape of `pathakshresthcs@gmail.com` in production.
  session({ roles: [GLOBAL_ROLE, OWNER_ROLE], orgs: [MEMBERSHIP] });
  const { org, scope } = await headersFor();

  check(
    "a global-scope founder on the customer dashboard sends his own organization",
    org === REAL_ORG,
    "this is the bug: the interceptor used to return early for any session holding a " +
      "GLOBAL role, so the request left with no tenancy and the backend answered with " +
      "all fourteen organizations",
  );
  check(
    "...and does not ask for every organization",
    scope === null,
    "a report about one venue must never carry the cross-tenant opt-in",
  );
}

// ---------------------------------------------------------------------
// 2. The estate view still exists -- it is just asked for.
// ---------------------------------------------------------------------
{
  session({ roles: [GLOBAL_ROLE], orgs: [], pathname: "/master/customers" });
  const { org, scope } = await headersFor();
  check(
    "an operator in the master console asks for every organization explicitly",
    scope === ALL_ORGANIZATIONS,
    "the console is the deliberate cross-tenant surface, and its own route guard " +
      "already admits only GLOBAL-scoped sessions",
  );
  check("...and names no single organization", org === null);
}

{
  session({
    roles: [GLOBAL_ROLE],
    orgs: [MEMBERSHIP],
    selected: ALL_ORGANIZATIONS,
    pathname: "/customer/dashboard",
  });
  const { scope } = await headersFor();
  check(
    "an explicit 'All organizations' choice is honoured off the master console too",
    scope === ALL_ORGANIZATIONS,
    "the picker's selection is the operator's, not the URL's",
  );
}

{
  session({
    roles: [GLOBAL_ROLE],
    orgs: [],
    selected: DEMO_ORG,
    pathname: "/master/routers",
  });
  const { org, scope } = await headersFor();
  check(
    "choosing one organization narrows the master console to it",
    org === DEMO_ORG && scope === null,
    "an operator who picked a tenant must not keep getting the estate",
  );
}

// ---------------------------------------------------------------------
// 3. A tenant session can never widen itself.
// ---------------------------------------------------------------------
{
  session({ roles: [OWNER_ROLE], orgs: [MEMBERSHIP], pathname: "/master/customers" });
  const { org, scope } = await headersFor();
  check(
    "an org-scoped session gets no cross-tenant opt-in, even at a /master URL",
    scope === null && org === REAL_ORG,
    "the URL is not the authority -- the role is. /master's own guard would have " +
      "bounced this session anyway, but the transport must not depend on that",
  );
}

{
  // A stale "all" left in storage by a previous, more privileged session on
  // a shared browser.
  session({ roles: [OWNER_ROLE], orgs: [MEMBERSHIP], selected: ALL_ORGANIZATIONS });
  const { org, scope } = await headersFor();
  check(
    "a stale 'all' selection does not widen an org-scoped session",
    scope === null && org === REAL_ORG,
    "falls back to the session's own organization rather than sending a request the " +
      "backend would refuse",
  );
}

{
  // An organization id left over from a previous account.
  session({ roles: [OWNER_ROLE], orgs: [MEMBERSHIP], selected: DEMO_ORG });
  const { org } = await headersFor();
  check(
    "a stale organization id from a previous account is discarded",
    org === REAL_ORG,
    "sending it would 403 every request with a message naming the wrong cause",
  );
}

// ---------------------------------------------------------------------
// 4. An explicit call site still wins.
// ---------------------------------------------------------------------
{
  session({ roles: [GLOBAL_ROLE], orgs: [MEMBERSHIP] });
  const { org } = await headersFor("/alerts", { headers: { [ORG_HEADER]: DEMO_ORG } });
  check(
    "a hand-set X-Organization-Id is not overwritten",
    org === DEMO_ORG,
    "dozens of call sites thread the header per organization when fanning out",
  );
}

{
  session({ roles: [GLOBAL_ROLE], orgs: [MEMBERSHIP] });
  const { org, scope } = await headersFor("/alerts", {
    headers: { [ORG_SCOPE_HEADER]: ALL_ORGANIZATIONS },
  });
  check(
    "a hand-set X-Organization-Scope is not doubled with an org header",
    scope === ALL_ORGANIZATIONS && org === null,
    "the two are mutually exclusive; sending both is a contradiction the backend " +
      "resolves by narrowing, which would silently undo the call site's intent",
  );
}

// ---------------------------------------------------------------------
// 5. `crossOrganizationHeaders` is gated on the role, not on the caller.
// ---------------------------------------------------------------------
{
  session({ roles: [GLOBAL_ROLE], orgs: [] });
  check(
    "crossOrganizationHeaders() opts a platform operator in",
    mod.crossOrganizationHeaders()?.[ORG_SCOPE_HEADER] === ALL_ORGANIZATIONS,
  );
  session({ roles: [OWNER_ROLE], orgs: [MEMBERSHIP] });
  check(
    "crossOrganizationHeaders() gives an org-scoped session nothing",
    mod.crossOrganizationHeaders() === undefined,
    "the platform-wide pages outside the master console (policies, queue management) " +
      "must still scope an ordinary customer to their own tenant",
  );
}

// ---------------------------------------------------------------------
// 6. Nothing is attached where there is nothing to attach.
// ---------------------------------------------------------------------
{
  session({ roles: [], orgs: [] });
  const { org, scope } = await headersFor();
  check(
    "a session belonging to no organization sends neither header",
    org === null && scope === null,
    "there is deliberately no rule that turns 'I do not know' into 'all of them' -- " +
      "that rule IS the bug. The backend answers with a 400 naming both remedies.",
  );
}

console.log(
  failures === 0 ? "\norg-scope-header: all checks passed" : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
