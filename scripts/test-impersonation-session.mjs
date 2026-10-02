/**
 * Regression test: a "View as this customer" SESSION works, and is exactly the
 * customer's -- no more, no less.
 *
 * Run: `bun run test:impersonation-session`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * THE DEFECT (measured on prod, 2026-10-02)
 * -----------------------------------------
 * master.wyfyguest.com -> Customers -> WyFy Guest -> View as this customer ->
 * Continue. The banner appeared, `/` spun forever, and /switch-location said
 * "Your venues 0 / No locations yet" while
 *   GET /organizations/{org}/locations?page_size=50   403
 *   GET /alerts?organization_id={org}                  403
 *   GET /monitored-hardware?page=1&page_size=200       403
 *
 * What this harness established about it, driving the real code:
 *  - The requests were NOT going out on the operator's token or on the Master
 *    "all organizations" scope. With the stored state the prod tab held, the
 *    real interceptor sends the impersonation token and `X-Organization-Id:
 *    <org>` (case "wire" below pins that).
 *  - The session's grants were INVENTED: one placeholder org-scoped role and
 *    the organization picked in the drawer. A customer whose real grant is
 *    narrower (location-scoped) gets 403 on every org-wide read, and the
 *    location-scoped fallback in `customerService.listLocations()` cannot run,
 *    because it reads the location roles the placeholder replaced.
 *  - `listLocations()` swallowed every failure into `[]`, which the picker
 *    renders as "No locations yet".
 *
 * THE FIX, AND WHAT IS ASSERTED
 * -----------------------------
 * The backend's impersonate response now carries the target's real roles and
 * memberships (cloud-guest, same helpers as /auth/login). The frontend uses
 * them, refuses to start a session that cannot be the customer's own (global
 * role, not a member of the chosen org), clears the operator's permissions,
 * query cache, Master scope and workspace location on the way in and restores
 * the Master scope on the way out, and renders a failed venue read as an
 * error with a retry.
 *
 * Everything below runs the shipping AuthProvider, axios instance + request
 * interceptor, customer service and the real /switch-location page component
 * in Chromium, against a fake backend (page.route) that authorizes each
 * request by the identity in its bearer token, the way the real one does.
 * Only `@tanstack/react-router` is stubbed (no router in this harness).
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "impersonation-session-"));

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const ORG = "08ec098b-1fb0-4bd0-bcc2-fe489d01ec4c";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const LOC = "33333333-3333-4333-8333-333333333333";
const STAFF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOCMGR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/* ------------------------------- the bundle ------------------------------ */
writeFileSync(
  join(work, "router-stub.js"),
  `export function createFileRoute() {
     return (o) => ({ ...o, useSearch: () => ({}), useParams: () => ({}) });
   }
   export function createRootRoute() { return {}; }
   export function useNavigate() { return (o) => { window.__NAVS__.push(o?.to ?? null); }; }
   export function useRouter() { return { navigate: () => {}, update: () => {}, options: { context: {} } }; }
   export function useRouterState() { return { location: { pathname: "/switch-location" } }; }
   export function useParams() { return {}; }
   export function useSearch() { return {}; }
   export function redirect(o) { return o; }
   export function Link({ children }) { return children ?? null; }
   export function Outlet() { return null; }
`,
);

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { useEffect } from "react";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { TooltipProvider } from "@/components/ui/tooltip";
   import { AuthProvider, useAuth } from "@/context/AuthContext";
   import { customerService } from "@/services/customer.service";
   import { impersonationService } from "@/services/impersonation.service";
   import { Route as SwitchLocationRoute } from "@/routes/switch-location";

   window.__NAVS__ = [];
   const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   window.__qc = client;
   window.__listLocations = () => customerService.listLocations();
   window.__impersonationService = impersonationService;

   function Expose() {
     const auth = useAuth();
     useEffect(() => { window.__auth = auth; });
     return null;
   }

   const view = new URLSearchParams(location.search).get("view");
   const Page = SwitchLocationRoute.component;
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={client}>
       <AuthProvider>
         <TooltipProvider>
           <Expose />
           {view === "switch" ? <Page /> : null}
         </TooltipProvider>
       </AuthProvider>
     </QueryClientProvider>,
   );
`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  loader: { ".css": "empty", ".svg": "dataurl", ".png": "dataurl", ".webp": "dataurl" },
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env.VITE_API_BASE_URL": '""' },
  plugins: [
    {
      name: "aliases",
      setup(b) {
        b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: join(work, "router-stub.js"),
        }));
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          const probes = [
            base,
            `${base}.tsx`,
            `${base}.ts`,
            join(base, "index.tsx"),
            join(base, "index.ts"),
          ];
          for (const p of probes) if (existsSync(p) && extname(p)) return { path: p };
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8><title>impersonation session harness</title>
   <div id=root></div><script type=module src="./bundle.js"></script>`,
);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  const name = req.url.split("?")[0];
  try {
    const file = readFileSync(join(work, name === "/" ? "/index.html" : name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(file);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

/* --------------------------- the fake backend --------------------------- */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (p) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(p)}.sig`;
const exp = () => Math.floor(Date.now() / 1000) + 1800;
const STAFF_TOKEN = jwt({ sub: STAFF, email: "staff@wyfy.test", exp: exp() });
const impToken = (sub) =>
  jwt({
    sub,
    email: `${sub.slice(0, 4)}@cust.test`,
    exp: exp(),
    impersonation: {
      actor_user_id: STAFF,
      actor_email: "staff@wyfy.test",
      started_at: new Date().toISOString(),
    },
  });

const PERMS = {
  [STAFF]: ["users.manage", "users.impersonate", "organizations.read", "billing.manage"],
  [OWNER]: ["locations.read", "dashboard.read"],
  [LOCMGR]: ["locations.read"],
};
const ORG_SUMMARY = {
  organization_id: ORG,
  organization_name: "WyFy Guest",
  organization_slug: "wyfy-guest",
  is_primary_contact: true,
  enabled_features: ["guest_wifi"],
};
/** Each identity's real grants, as the backend holds them. */
const GRANTS = {
  [OWNER]: {
    roles: [
      {
        role_id: "r-owner",
        role_name: "Organization Owner",
        role_slug: "organization-owner",
        scope_type: "organization",
        organization_id: ORG,
        location_id: null,
        router_id: null,
      },
    ],
    organizations: [ORG_SUMMARY],
  },
  [LOCMGR]: {
    roles: [
      {
        role_id: "r-locmgr",
        role_name: "Location Manager",
        role_slug: "location-manager",
        scope_type: "location",
        organization_id: ORG,
        location_id: LOC,
        router_id: null,
      },
    ],
    organizations: [{ ...ORG_SUMMARY, is_primary_contact: false }],
  },
};
const page_ = (items) => ({
  items,
  page: 1,
  page_size: 100,
  total_items: items.length,
  total_pages: 1,
  has_next: false,
  has_previous: false,
});
const VENUE = {
  id: LOC,
  name: "Hall",
  city: "Delhi",
  property_type: "hotel",
  organization_id: ORG,
};

function subOf(auth) {
  try {
    return JSON.parse(Buffer.from(auth.replace(/^Bearer /, "").split(".")[1], "base64url")).sub;
  } catch {
    return null;
  }
}

/**
 * Installs the fake API on `page`. `opts`:
 *  - impersonateAs: the user id `POST /users/{id}/impersonate` mints for
 *  - legacyImpersonateResponse: omit roles/organizations (an older backend)
 *  - impersonateGrants: override the grants the response reports
 *  - failPermissionsFor: user id whose /me/permissions 500s
 *  - permissionsDelayMs: delay on /me/permissions
 *  - ownerLocationsForbidden: the owner's org-wide locations read 403s
 */
async function installBackend(page, opts = {}) {
  const log = [];
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const h = req.headers();
    const sub = subOf(h.authorization || "");
    const entry = {
      method: req.method(),
      path,
      sub,
      org: h["x-organization-id"] ?? null,
      scope: h["x-organization-scope"] ?? null,
      loc: h["x-location-id"] ?? null,
    };
    log.push(entry);
    const send = (status, data) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(
          status < 400
            ? { success: true, message: "", data, request_id: "r" }
            : { success: false, message: data, data: null, request_id: "r" },
        ),
      });
    const deny = (why) => send(403, `Permission denied: ${why}`);

    if (path === "/me/permissions") {
      if (opts.permissionsDelayMs) await new Promise((r) => setTimeout(r, opts.permissionsDelayMs));
      if (opts.failPermissionsFor === sub) return send(500, "boom");
      return send(200, { user_id: sub, permissions: PERMS[sub] ?? [] });
    }
    if (path === "/auth/me") return send(200, { id: sub, email: "x@x.test", is_active: true });
    if (path === "/me/organizations") return send(200, []);

    if (sub === STAFF) {
      const m = path.match(/^\/users\/([^/]+)\/impersonate$/);
      if (m && req.method() === "POST") {
        const target = opts.impersonateAs ?? m[1];
        const grants = opts.impersonateGrants ?? GRANTS[target] ?? { roles: [], organizations: [] };
        const data = {
          access_token: impToken(target),
          expires_at: new Date(Date.now() + 1.8e6).toISOString(),
          target_user: {
            id: target,
            full_name: "Mohit Murari",
            email: "owner@cust.test",
            username: "m",
          },
          ...(opts.legacyImpersonateResponse ? {} : grants),
        };
        return send(200, data);
      }
      return send(200, page_([]));
    }

    // Customer identities: authorized against their real grants, the way
    // CurrentOrganizationScope + RequirePermission do it.
    if (entry.scope === "all") return deny("cross-organization scope requires a global role");
    const pathOrg = (path.match(/^\/organizations\/([^/]+)/) || [])[1];
    const effectiveOrg = pathOrg || entry.org || url.searchParams.get("organization_id");
    if (!effectiveOrg) return deny("no organization in scope");
    if (effectiveOrg !== ORG) return deny("not a member of that organization");
    if (sub === OWNER) {
      if (/^\/organizations\/[^/]+\/locations$/.test(path)) {
        return opts.ownerLocationsForbidden ? deny("locations.read") : send(200, page_([VENUE]));
      }
      return send(200, page_([]));
    }
    if (sub === LOCMGR) {
      // A location grant cannot satisfy an organization-level check.
      if (entry.loc !== LOC) return deny("required at organization scope");
      if (path === `/locations/${LOC}`) return send(200, VENUE);
      return send(200, page_([]));
    }
    return deny("unknown identity");
  });
  return log;
}

const STAFF_STORAGE = {
  cloudguest_token: STAFF_TOKEN,
  cloudguest_refresh_token: "staff-refresh",
  cloudguest_user: JSON.stringify({ id: STAFF, name: "Staff", email: "staff@wyfy.test" }),
  cloudguest_roles: JSON.stringify([
    { roleId: "sa", roleName: "Super Admin", roleSlug: "super-admin", scopeType: "global" },
  ]),
  cloudguest_organizations: JSON.stringify([]),
  "cg.activeOrgId": "all",
  "cg.workspace.activeLoc": "operator-was-here",
};

const { chromium } = await import("playwright");
const browser = await chromium.launch();

async function openPage({ storage = STAFF_STORAGE, view = "", backend = {} } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const log = await installBackend(page, backend);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, storage);
  await page.goto(`${origin}/index.html${view ? `?view=${view}` : ""}`);
  await page.waitForFunction(() => window.__auth && window.__auth.isReady, null, {
    timeout: 15_000,
  });
  return { page, log, errors };
}

/** Starts a session the way master.customers.tsx does: the real service call,
 *  then the real beginImpersonation. Returns { ok, error }. */
async function startImpersonation(
  page,
  targetId,
  organization = { id: ORG, name: "WyFy Guest", slug: "wyfy-guest" },
) {
  return page.evaluate(
    async ({ targetId, organization }) => {
      try {
        // The real service call + the real beginImpersonation, with exactly
        // the arguments master.customers.tsx passes.
        const session = await window.__impersonationService.impersonate(targetId, "test");
        await window.__auth.beginImpersonation({
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
          targetUser: session.targetUser,
          organization,
          roles: session.roles,
          organizations: session.organizations,
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    },
    { targetId, organization },
  );
}

const storageOf = (page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
const settle = (page, ms = 400) => page.waitForTimeout(ms);

/* ------------------------------------------------------------------------ */
console.log("\n1. A location-scoped customer: the session holds their REAL grants");
{
  const { page, log, errors } = await openPage();
  const r = await startImpersonation(page, LOCMGR);
  check("location-scoped target: session starts", r.ok, r.error);
  const st = await storageOf(page);
  const roles = JSON.parse(st.cloudguest_roles ?? "[]");
  check(
    "stored roles are the customer's real location-scoped grant, not a placeholder",
    roles.length === 1 && roles[0].scopeType === "location" && roles[0].locationId === LOC,
    st.cloudguest_roles,
  );
  check(
    "no role in the impersonated session is global",
    roles.every((x) => x.scopeType !== "global"),
    st.cloudguest_roles,
  );
  const venues = await page.evaluate(() =>
    window.__listLocations().then(
      (v) => v.map((x) => x.id),
      (e) => `rejected: ${e?.message}`,
    ),
  );
  check(
    "venue list reaches the customer's venue through the location-scoped fallback",
    Array.isArray(venues) && venues.includes(LOC),
    JSON.stringify(venues),
  );
  const after = log.filter((e) => e.path !== `/users/${LOCMGR}/impersonate`);
  const custReqs = after.filter((e) => e.sub === LOCMGR);
  check("customer requests went out (sanity)", custReqs.length > 0, JSON.stringify(after));
  check(
    "every request after the start carries the CUSTOMER's token, none the operator's",
    after.slice(after.findIndex((e) => e.sub === LOCMGR)).every((e) => e.sub === LOCMGR),
    JSON.stringify(after.map((e) => `${e.path}:${e.sub?.slice(0, 4)}`)),
  );
  check(
    "no request during the session asks for the Master 'all organizations' scope",
    custReqs.every((e) => e.scope === null),
    JSON.stringify(custReqs),
  );
  check("no page errors", errors.length === 0, errors.join(" | "));
  await page.close();
}

console.log("\n2. Wire shape for an organization owner (what prod's tab held)");
{
  const { page, log } = await openPage();
  const r = await startImpersonation(page, OWNER);
  check("owner target: session starts", r.ok, r.error);
  await page.evaluate(() => window.__listLocations());
  const read = log.find((e) => e.path === `/organizations/${ORG}/locations`);
  check(
    "locations read: impersonation token + X-Organization-Id <org>, no scope=all",
    read && read.sub === OWNER && read.org === ORG && read.scope === null,
    JSON.stringify(read),
  );
  const orgs = JSON.parse((await storageOf(page)).cloudguest_organizations ?? "[]");
  check(
    "the chosen organization is the session's first (active) membership",
    orgs[0]?.organizationId === ORG,
    JSON.stringify(orgs),
  );
  await page.close();
}

console.log(
  "\n3. Master scope, workspace location, refresh token and query cache across both transitions",
);
{
  const { page } = await openPage();
  await page.evaluate(() => window.__qc.setQueryData(["operator-only"], { secret: 1 }));
  const r = await startImpersonation(page, OWNER);
  check("session starts", r.ok, r.error);
  let st = await storageOf(page);
  check(
    "Master scope 'all' is not inherited by the customer session",
    st["cg.activeOrgId"] === undefined,
    String(st["cg.activeOrgId"]),
  );
  check(
    "operator's workspace location is cleared on start",
    st["cg.workspace.activeLoc"] === undefined,
    String(st["cg.workspace.activeLoc"]),
  );
  check(
    "no refresh token during impersonation (cannot renew into the operator)",
    st.cloudguest_refresh_token === undefined,
  );
  check(
    "operator's cached queries are gone on start",
    (await page.evaluate(() => window.__qc.getQueryData(["operator-only"]))) === undefined,
  );
  await page.evaluate(() => window.__qc.setQueryData(["customer-only"], { secret: 2 }));
  await page.evaluate(() => window.__auth.endImpersonation());
  await settle(page);
  st = await storageOf(page);
  check(
    "end restores the operator's Master scope exactly ('all')",
    st["cg.activeOrgId"] === "all",
    String(st["cg.activeOrgId"]),
  );
  check("end restores the operator's token", st.cloudguest_token === STAFF_TOKEN);
  check(
    "end restores the operator's refresh token",
    st.cloudguest_refresh_token === "staff-refresh",
  );
  check(
    "customer's cached queries are gone on end",
    (await page.evaluate(() => window.__qc.getQueryData(["customer-only"]))) === undefined,
  );
  check(
    "no parked session or expiry left behind",
    st.cloudguest_pre_impersonation_session === undefined &&
      st.cloudguest_impersonation_expires_at === undefined,
  );
  await page.close();
}

console.log("\n4. Permissions: exactly the customer's, never the operator's");
{
  const { page } = await openPage({ backend: { permissionsDelayMs: 700 } });
  await page.waitForFunction(() => window.__auth.can("users.manage"), null, { timeout: 5000 });
  check(
    "operator holds users.manage before the start (sanity)",
    await page.evaluate(() => window.__auth.can("users.manage")),
  );
  const pending = startImpersonation(page, OWNER);
  await page.waitForFunction(
    () => window.__auth.user && window.__auth.user.name === "Mohit Murari",
    null,
    { timeout: 5000 },
  );
  check(
    "while the customer's permissions load, the operator's are NOT answered",
    !(await page.evaluate(() => window.__auth.can("users.manage"))),
  );
  const r = await pending;
  check("session starts", r.ok, r.error);
  await settle(page);
  check(
    "customer permission granted",
    await page.evaluate(() => window.__auth.can("locations.read")),
  );
  check(
    "no operator permission leaks into the session",
    !(await page.evaluate(
      () =>
        window.__auth.can("users.manage") ||
        window.__auth.can("users.impersonate") ||
        window.__auth.can("billing.manage"),
    )),
  );
  await page.close();
}
{
  const { page } = await openPage({ backend: { failPermissionsFor: OWNER } });
  await page.waitForFunction(() => window.__auth.can("users.manage"), null, { timeout: 5000 });
  const r = await startImpersonation(page, OWNER);
  await settle(page);
  const st = await storageOf(page);
  check("a start whose permission read fails is reported as failed", !r.ok);
  check(
    "...and puts the operator back instead of leaving a half-started session",
    st.cloudguest_token === STAFF_TOKEN && st.cloudguest_pre_impersonation_session === undefined,
    st.cloudguest_token?.slice(0, 20),
  );
  await page.close();
}

console.log("\n5. Refusals: never start a session that is not the customer's own");
{
  const { page } = await openPage({
    backend: {
      impersonateGrants: {
        roles: [
          {
            role_id: "g",
            role_name: "Super Admin",
            role_slug: "super-admin",
            scope_type: "global",
            organization_id: null,
            location_id: null,
            router_id: null,
          },
        ],
        organizations: [ORG_SUMMARY],
      },
    },
  });
  const r = await startImpersonation(page, OWNER);
  const st = await storageOf(page);
  check("a target reported with a global role is refused", !r.ok, JSON.stringify(r));
  check(
    "...and the operator's session is untouched",
    st.cloudguest_token === STAFF_TOKEN &&
      st["cg.activeOrgId"] === "all" &&
      st.cloudguest_pre_impersonation_session === undefined,
  );
  await page.close();
}
{
  const { page } = await openPage();
  const r = await startImpersonation(page, OWNER, {
    id: OTHER_ORG,
    name: "Some Other Venue",
    slug: "other",
  });
  const st = await storageOf(page);
  check(
    "a target who is not a member of the chosen organization is refused, with a reason",
    !r.ok && /not an active member/i.test(r.error ?? ""),
    JSON.stringify(r),
  );
  check("...and the operator's session is untouched", st.cloudguest_token === STAFF_TOKEN);
  await page.close();
}
{
  const { page } = await openPage({ backend: { legacyImpersonateResponse: true } });
  const r = await startImpersonation(page, OWNER);
  const roles = JSON.parse((await storageOf(page)).cloudguest_roles ?? "[]");
  check(
    "an older backend (no grants in the response) still starts, scoped to the chosen org",
    r.ok &&
      roles.length === 1 &&
      roles[0].organizationId === ORG &&
      roles[0].scopeType !== "global",
    JSON.stringify(r),
  );
  await page.close();
}

console.log("\n6. /switch-location: a refused venue read is an error with a retry");
const IMPERSONATED_OWNER_STORAGE = {
  cloudguest_token: impToken(OWNER),
  cloudguest_user: JSON.stringify({ id: OWNER, name: "Mohit Murari", email: "owner@cust.test" }),
  cloudguest_roles: JSON.stringify([
    {
      roleId: "r-owner",
      roleName: "Organization Owner",
      roleSlug: "organization-owner",
      scopeType: "organization",
      organizationId: ORG,
    },
  ]),
  cloudguest_organizations: JSON.stringify([
    {
      organizationId: ORG,
      organizationName: "WyFy Guest",
      organizationSlug: "wyfy-guest",
      isPrimaryContact: true,
      enabledFeatures: [],
    },
  ]),
  cloudguest_impersonation_expires_at: new Date(Date.now() + 1.8e6).toISOString(),
};
{
  const backend = { ownerLocationsForbidden: true };
  const { page, errors } = await openPage({
    storage: IMPERSONATED_OWNER_STORAGE,
    view: "switch",
    backend,
  });
  // useCustomerLocations retries once (retry: 1), so the verdict lands after
  // React Query's ~1s back-off, not on the first response.
  await page
    .waitForFunction(
      () => /Couldn.t load your venues|No locations yet/.test(document.body.innerText),
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
  const text = await page.evaluate(() => document.body.innerText);
  check(
    '403 renders "Couldn\'t load your venues"',
    /Couldn.t load your venues/.test(text),
    text.slice(0, 300),
  );
  check('403 does NOT render "No locations yet"', !/No locations yet/.test(text));
  check("the backend's reason is shown", /Permission denied/.test(text), text.slice(0, 300));
  // The read starts succeeding; Retry must recover without a reload.
  backend.ownerLocationsForbidden = false;
  await page
    .getByRole("button", { name: /^Retry$/ })
    .click({ timeout: 5000 })
    .catch(() => {});
  await page
    .waitForFunction(() => document.body.innerText.includes("Hall"), null, { timeout: 10_000 })
    .catch(() => {});
  const after = await page.evaluate(() => document.body.innerText);
  check(
    "Retry recovers to the real venue list",
    /Hall/.test(after) && !/Couldn.t load your venues/.test(after),
    after.slice(0, 300),
  );
  check("no page errors", errors.length === 0, errors.join(" | "));
  await page.close();
}
{
  // Contrast: a genuinely empty account still gets the empty state.
  const { page } = await openPage({ storage: IMPERSONATED_OWNER_STORAGE, view: "switch" });
  await page.unroute("**/api/v1/**");
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "", data: page_([]), request_id: "r" }),
    }),
  );
  await page.evaluate(() => window.__qc.invalidateQueries());
  await page
    .waitForFunction(() => document.body.innerText.includes("No locations yet"), null, {
      timeout: 10_000,
    })
    .catch(() => {});
  const text = await page.evaluate(() => document.body.innerText);
  check(
    'an account with zero venues still shows "No locations yet"',
    /No locations yet/.test(text) && !/Couldn.t load/.test(text),
    text.slice(0, 300),
  );
  await page.close();
}

console.log("\n7. Wiring pinned from source (React trees this harness does not mount)");
{
  const index = readFileSync(join(ROOT, "src/routes/index.tsx"), "utf8");
  check(
    "'/' hand-off spinner has a stall fallback that renders an error",
    /HANDOFF_STALL_MS/.test(index) && /Couldn't open your dashboard/.test(index),
  );
  const customers = readFileSync(join(ROOT, "src/routes/master.customers.tsx"), "utf8");
  const start = customers.indexOf("auth.beginImpersonation(");
  const update = customers.indexOf("router.update(", start);
  const nav = customers.indexOf('navigate({ to: "/"', start);
  check(
    "start pushes the impersonated auth slice into router context BEFORE navigating",
    start > 0 && update > start && nav > update,
  );
  check(
    "start passes the backend-reported roles and organizations through",
    /roles:\s*session\.roles/.test(customers) &&
      /organizations:\s*session\.organizations/.test(customers),
  );
}

await browser.close();
server.close();
if (failures > 0) {
  console.log(`\nimpersonation-session: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nimpersonation-session: all checks passed");
