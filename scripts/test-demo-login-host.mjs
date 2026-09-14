// Regression test: the demo login exists on the demo host, and only there.
//
// HISTORY. `admin@example.com` / `test` matches a branch in AuthContext that
// mints a whole session in the browser -- Super Admin, global scope, the
// sentinel `demo-access-token` -- with no backend involved. #284 gated it
// behind `VITE_ENABLE_DEMO_LOGIN`, which production leaves unset, because on
// the real hosts that is a console presenting itself as a global admin to
// anyone who reads the JS, and one no `force-logout` can end. That also took
// the product demo away.
//
// demo.wyfyguest.com is served by the SAME bundle as app./master. (identical
// asset hashes), so the demo now comes back keyed on the hostname, through
// one predicate: src/lib/demo-host.ts. Three things must hold together:
//
//   1. The predicate: demo.wyfyguest.com / demo.localhost yes; app., master.,
//      portal., auth., plain localhost no -- unless a build opts in with
//      VITE_ENABLE_DEMO_LOGIN=true, which still enables it everywhere.
//   2. The real hosts stay closed. The demo credentials go to the backend,
//      and a `demo-access-token` planted in localStorage is purged before
//      anything renders as signed in: AuthContext, isDemo(), the customer
//      guard's demo exemption and the api.ts interceptor all refuse it.
//   3. The demo works on the demo host. localStorage is per-origin, so any
//      guard that sends the session to app./master. arrives signed out. The
//      demo session must reach the customer dashboard AND the master console
//      without ever leaving demo.wyfyguest.com.
//
// WHAT THIS CHECKS. Real behaviour, not source text, wherever that is
// possible without a DOM: the real AuthProvider is driven through a
// ~40-line hook runtime (useState/useEffect/useMemo with re-render until
// stable), and the real route guards are called with a fake `window`. The
// framework edges (react, TanStack, leaf UI components, the network) are
// stubbed; everything that makes a decision is the shipped code.
//
// Run: node scripts/test-demo-login-host.mjs

import { build } from "esbuild";
import { AxiosError } from "axios";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve, extname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
let passes = 0;

function check(name, ok, extra = "") {
  if (ok) {
    passes += 1;
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${extra ? `\n       ${extra}` : ""}`);
}

const REAL_HOSTS = [
  "app.wyfyguest.com",
  "master.wyfyguest.com",
  "portal.wyfyguest.com",
  "auth.wyfyguest.com",
  "localhost",
];
const DEMO_HOSTS = ["demo.wyfyguest.com", "demo.localhost"];

const TOKEN_KEY = "cloudguest_token";
const USER_KEY = "cloudguest_user";
const DEMO_TOKEN = "demo-access-token";
const DEMO_CREDS = { email: "admin@example.com", password: "test" };
const DEMO_ROLES = [
  { roleId: "r-001", roleName: "Super Admin", roleSlug: "super-admin", scopeType: "global" },
];

// ---------------------------------------------------------------------
// Fake browser.
// ---------------------------------------------------------------------
const store = new Map();
const localStorageStub = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
/** Every cross-origin navigation a guard performs (`window.location.href = ...`). */
let hardNavigations = [];
function onHost(hostname, pathname = "/") {
  hardNavigations = [];
  globalThis.window = {
    localStorage: localStorageStub,
    location: {
      hostname,
      pathname,
      origin: `https://${hostname}`,
      search: "",
      get href() {
        return `https://${hostname}${pathname}`;
      },
      set href(v) {
        hardNavigations.push(v);
      },
      replace(v) {
        hardNavigations.push(v);
      },
    },
  };
  globalThis.localStorage = localStorageStub;
}
onHost("localhost");

// ---------------------------------------------------------------------
// Stubs for the framework edges.
// ---------------------------------------------------------------------
const MINI_REACT = `
let slots = [];
let idx = 0;
let effects = [];
let dirty = false;
export const Fragment = "Fragment";
export function createContext(value) { return { _value: value, Provider: "Provider" }; }
export function useContext(ctx) { return ctx._value; }
export function useState(init) {
  const i = idx++;
  if (!(i in slots)) slots[i] = typeof init === "function" ? init() : init;
  return [slots[i], (v) => {
    const next = typeof v === "function" ? v(slots[i]) : v;
    if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; }
  }];
}
function same(a, b) { return !!a && !!b && a.length === b.length && a.every((d, k) => Object.is(d, b[k])); }
export function useMemo(fn, deps) {
  const i = idx++;
  if (slots[i] && same(slots[i].deps, deps)) return slots[i].v;
  const v = fn();
  slots[i] = { deps, v };
  return v;
}
export function useCallback(fn, deps) { return useMemo(() => fn, deps); }
export function useEffect(fn, deps) {
  const i = idx++;
  if (slots[i] && same(slots[i].deps, deps)) return;
  slots[i] = { deps };
  effects.push(fn);
}
export const useLayoutEffect = useEffect;
export function useRef(v) { return useMemo(() => ({ current: v }), []); }
/** Render until no state changes. Returns every rendered output, in order. */
export function __render(Component, props) {
  const outputs = [];
  for (let n = 0; n < 50; n++) {
    idx = 0; dirty = false;
    outputs.push(Component(props));
    const fx = effects; effects = [];
    for (const f of fx) f();
    if (!dirty) return outputs;
  }
  throw new Error("render did not settle");
}
export function __reset() { slots = []; idx = 0; effects = []; dirty = false; }
export default { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef, Fragment };
`;
const JSX_RUNTIME = `
export const Fragment = "Fragment";
export function jsx(type, props) { return { type, props }; }
export const jsxs = jsx;
export const jsxDEV = jsx;
`;
const TANSTACK_ROUTER = `
export function createFileRoute() { return (options) => ({ options }); }
export function redirect(opts) { return { __redirect: true, ...opts }; }
export function Outlet() { return null; }
export function useNavigate() { return (opts) => globalThis.__navigations.push(opts); }
export function useRouterState({ select }) { return select({ location: { pathname: globalThis.window.location.pathname } }); }
`;
const REACT_QUERY = `export function useQueryClient() { return { clear() {} }; }`;
const AUTH_SERVICE = `
export const authService = {
  async login(creds) {
    globalThis.__backend.push(["login", creds.email]);
    const e = new Error("Invalid email or password");
    e.status = 401;
    throw e;
  },
  async me() { globalThis.__backend.push(["me"]); throw new Error("401"); },
  async myPermissions() { globalThis.__backend.push(["myPermissions"]); return []; },
  async logout() {},
};
`;
const CUSTOMER_STORE = `
const state = { activeLocationId: globalThis.__activeLocationId ?? null, clearLocation() { state.activeLocationId = null; } };
export function useCustomerStore(sel) { state.activeLocationId = globalThis.__activeLocationId ?? null; return sel ? sel(state) : state; }
useCustomerStore.getState = () => state;
`;
const AUTH_CONTEXT_FOR_ROUTES = `export function useAuth() { return globalThis.__auth; }`;

/** A component stub per named import, generated from the importer's own
 *  import statement -- so a new leaf import in a route file cannot break the
 *  build (see scripts/ci-gated-test.sh for why that matters). */
function autoStub(importerPath, spec) {
  const src = readFileSync(importerPath, "utf8");
  const esc = spec.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const re = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*["']${esc}["']`, "g");
  const names = new Set();
  for (const m of src.matchAll(re)) {
    for (const part of m[1].split(",")) {
      const name = part
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) names.add(name);
    }
  }
  return [...names]
    .map((n) =>
      /^use[A-Z]/.test(n)
        ? `export function ${n}() { return undefined; }`
        : `export function ${n}(props) { return { type: ${JSON.stringify(n)}, props }; }`,
    )
    .join("\n");
}

const work = join(ROOT, "node_modules", ".demo-login-host-test");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

function resolveSrc(spec) {
  const base = join(ROOT, "src", spec.slice(2));
  const probes = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  for (const p of probes) if (existsSync(p) && extname(p)) return p;
  return null;
}

async function bundle(name, entrySource, { fixed = {}, autoStubRoutes = false, demoFlag } = {}) {
  const entry = join(work, `${name}.entry.js`);
  writeFileSync(entry, entrySource);
  const outfile = join(work, `${name}.mjs`);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "error",
    jsx: "automatic",
    nodePaths: [resolve(ROOT, "node_modules")],
    external: ["axios"],
    loader: { ".css": "empty" },
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.env": JSON.stringify({
        VITE_API_BASE_URL: "/api/v1",
        ...(demoFlag === undefined ? {} : { VITE_ENABLE_DEMO_LOGIN: demoFlag }),
      }),
    },
    plugins: [
      {
        name: "stubs-and-alias",
        setup(b) {
          const FIXED = {
            react: MINI_REACT,
            "react/jsx-runtime": JSX_RUNTIME,
            "react/jsx-dev-runtime": JSX_RUNTIME,
            ...fixed,
          };
          b.onResolve({ filter: /.*/ }, (args) => {
            if (args.path in FIXED) return { path: args.path, namespace: "fixed" };
            if (!args.path.startsWith("@/")) return undefined;
            const real = resolveSrc(args.path);
            if (
              autoStubRoutes &&
              args.importer.startsWith(join(ROOT, "src", "routes")) &&
              !["@/lib/authGuards", "@/lib/demo-host", "@/services/api"].includes(args.path)
            ) {
              return {
                path: args.path,
                namespace: "auto",
                pluginData: { importer: args.importer },
              };
            }
            if (!real) return { errors: [{ text: `cannot resolve ${args.path}` }] };
            return { path: real };
          });
          b.onLoad({ filter: /.*/, namespace: "fixed" }, (args) => ({
            contents: FIXED[args.path],
            loader: "js",
          }));
          b.onLoad({ filter: /.*/, namespace: "auto" }, (args) => ({
            contents: autoStub(args.pluginData.importer, args.path),
            loader: "js",
          }));
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}

// A production build: VITE_ENABLE_DEMO_LOGIN unset.
const A = await bundle(
  "auth",
  `export { AuthProvider } from "@/context/AuthContext";
   export { isDemoLoginEnabled, isDemoLogin, isHonouredDemoToken } from "@/lib/demo-host";
   export { isDemo } from "@/services/customer.service";
   export { api, ORG_HEADER, ORG_SCOPE_HEADER, ROLES_STORAGE_KEY, ORGS_STORAGE_KEY, ACTIVE_ORG_STORAGE_KEY } from "@/services/api";
   export { __render, __reset } from "react";`,
  {
    fixed: {
      "@/services/auth.service": AUTH_SERVICE,
      "@/stores/customerStore": CUSTOMER_STORE,
      "@tanstack/react-query": REACT_QUERY,
    },
  },
);
const B = await bundle(
  "routes",
  `export { Route as IndexRoute } from "@/routes/index";
   export { Route as MasterRoute } from "@/routes/master";
   export { Route as AuthenticatedRoute } from "@/routes/_authenticated";
   export { requireCustomerSession } from "@/lib/authGuards";
   export { __render, __reset } from "react";`,
  {
    fixed: {
      "@tanstack/react-router": TANSTACK_ROUTER,
      "@/context/AuthContext": AUTH_CONTEXT_FOR_ROUTES,
      "@/stores/customerStore": CUSTOMER_STORE,
    },
    autoStubRoutes: true,
  },
);
const DemoBuild = await bundle("demobuild", `export * from "@/lib/demo-host";`, {
  demoFlag: "true",
});

// ---------------------------------------------------------------------
// 1. The predicate.
// ---------------------------------------------------------------------
console.log("predicate (production build, VITE_ENABLE_DEMO_LOGIN unset)");
for (const host of DEMO_HOSTS) {
  check(`${host} enables the demo login`, A.isDemoLoginEnabled(host) === true);
}
for (const host of REAL_HOSTS) {
  check(`${host} does not`, A.isDemoLoginEnabled(host) === false);
}
for (const host of [
  "demo.wyfyguest.com.evil.test",
  "xdemo.wyfyguest.com",
  "DEMO.wyfyguest.com.",
  "",
]) {
  check(`look-alike ${JSON.stringify(host)} does not`, A.isDemoLoginEnabled(host) === false);
}
check("no window (server render) does not", A.isDemoLoginEnabled(null) === false);
console.log("predicate (demo/local build, VITE_ENABLE_DEMO_LOGIN=true)");
for (const host of [...REAL_HOSTS, ...DEMO_HOSTS]) {
  check(`${host} enables it, as #284 left it`, DemoBuild.isDemoLoginEnabled(host) === true);
}

// ---------------------------------------------------------------------
// 2 + 3a. AuthContext: login and rehydrate, per host.
// ---------------------------------------------------------------------
function statusOf(output) {
  return output.props.value.status;
}

async function mountAuth() {
  A.__reset();
  globalThis.__backend = [];
  const outputs = A.__render(A.AuthProvider, { children: null });
  await new Promise((r) => setTimeout(r, 0));
  return outputs;
}

console.log("AuthContext.login with the demo credentials");
for (const host of [...REAL_HOSTS, ...DEMO_HOSTS]) {
  onHost(host);
  store.clear();
  const outputs = await mountAuth();
  const { login } = outputs.at(-1).props.value;
  let session = null;
  let error = null;
  try {
    session = await login({ ...DEMO_CREDS });
  } catch (e) {
    error = e;
  }
  const sentToBackend = globalThis.__backend.some(([op]) => op === "login");
  if (DEMO_HOSTS.includes(host)) {
    check(
      `${host}: mints the demo session without the backend`,
      session?.tokens?.accessToken === DEMO_TOKEN &&
        !sentToBackend &&
        store.get(TOKEN_KEY) === DEMO_TOKEN,
      `session=${JSON.stringify(session?.tokens)} backend=${JSON.stringify(globalThis.__backend)}`,
    );
  } else {
    check(
      `${host}: sends the credentials to the backend and fails`,
      sentToBackend && error !== null && session === null,
      `backend=${JSON.stringify(globalThis.__backend)} error=${error}`,
    );
    check(`${host}: stores no demo token`, store.get(TOKEN_KEY) !== DEMO_TOKEN);
  }
}

console.log("AuthContext rehydrate with a hand-planted demo-access-token");
for (const host of [...REAL_HOSTS, ...DEMO_HOSTS]) {
  onHost(host);
  store.clear();
  store.set(TOKEN_KEY, DEMO_TOKEN);
  store.set(USER_KEY, JSON.stringify({ id: "u-001", email: DEMO_CREDS.email, name: "Admin User" }));
  store.set("cloudguest_roles", JSON.stringify(DEMO_ROLES));
  const outputs = await mountAuth();
  const statuses = outputs.map(statusOf);
  if (DEMO_HOSTS.includes(host)) {
    check(
      `${host}: rehydrates the demo session, with no backend call`,
      statuses.at(-1) === "authenticated" &&
        store.get(TOKEN_KEY) === DEMO_TOKEN &&
        globalThis.__backend.length === 0,
      `statuses=${statuses} backend=${JSON.stringify(globalThis.__backend)}`,
    );
  } else {
    check(
      `${host}: never renders as signed in, not even for one render`,
      !statuses.includes("authenticated") && statuses.at(-1) === "anonymous",
      `statuses=${statuses}`,
    );
    check(
      `${host}: purges the planted session from storage`,
      !store.has(TOKEN_KEY) && !store.has(USER_KEY),
      `left: ${[...store.keys()]}`,
    );
  }
}

console.log("isDemo() (fixtures instead of the API)");
for (const host of [...REAL_HOSTS, ...DEMO_HOSTS]) {
  onHost(host);
  store.clear();
  store.set(TOKEN_KEY, DEMO_TOKEN);
  const expected = DEMO_HOSTS.includes(host);
  check(`${host}: isDemo() is ${expected} for the demo token`, A.isDemo() === expected);
}

console.log("api.ts request interceptor");
{
  A.api.defaults.adapter = async (config) => ({
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });
  const ORG = "08ec098b-1fb0-4bd0-bcc2-fe489d01ec4c";
  for (const host of ["app.wyfyguest.com", "demo.wyfyguest.com"]) {
    onHost(host, "/customer/dashboard");
    store.clear();
    store.set(TOKEN_KEY, DEMO_TOKEN);
    store.set(A.ROLES_STORAGE_KEY, JSON.stringify([{ scopeType: "organization" }]));
    store.set(A.ORGS_STORAGE_KEY, JSON.stringify([{ organizationId: ORG }]));
    const res = await A.api.get("/alerts");
    const org = res.config.headers.get?.(A.ORG_HEADER) ?? null;
    if (host === "demo.wyfyguest.com") {
      check(`${host}: a demo request carries no organization`, org === null, `org=${org}`);
    } else {
      check(
        `${host}: the demo token gets no special treatment (scoped like any token)`,
        org === ORG,
        `org=${org}`,
      );
    }
  }
}

console.log("api.ts 401 handling");
{
  // The backend refuses demo-access-token on every host. On the demo host
  // that must not end the demo (measured: the Master Console's alerts poll
  // dropped it on /session-expired); everywhere else #282's teardown stands.
  // Demo host FIRST: goToSessionExpired() latches after its first navigation.
  A.api.defaults.adapter = async (config) => {
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config,
      data: { success: false, message: "Not authenticated", data: null },
    });
  };
  for (const host of ["demo.wyfyguest.com", "app.wyfyguest.com"]) {
    onHost(host, "/master");
    store.clear();
    store.set(TOKEN_KEY, DEMO_TOKEN);
    store.set(USER_KEY, JSON.stringify({ id: "u-001" }));
    let rejected = null;
    try {
      await A.api.get("/alerts");
    } catch (e) {
      rejected = e;
    }
    const tornDown = !store.has(TOKEN_KEY);
    const expired = hardNavigations.some((h) => h.includes("/session-expired"));
    if (host === "demo.wyfyguest.com") {
      check(
        `${host}: a 401 on the demo token rejects the call but keeps the demo signed in`,
        rejected?.status === 401 && !tornDown && !expired,
        `status=${rejected?.status} tornDown=${tornDown} nav=${JSON.stringify(hardNavigations)}`,
      );
    } else {
      check(
        `${host}: a 401 on the demo token tears the session down (#282 unchanged)`,
        tornDown && expired,
        `tornDown=${tornDown} nav=${JSON.stringify(hardNavigations)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------
// 2b + 3b. Guards: the demo host never sends the session off-host.
// ---------------------------------------------------------------------
const demoAuth = { status: "authenticated", roles: DEMO_ROLES };

function runGuard(fn) {
  try {
    fn();
    return { redirect: null };
  } catch (e) {
    if (e && e.__redirect) return { redirect: e };
    throw e;
  }
}

console.log("route guards on the demo host");
for (const host of DEMO_HOSTS) {
  const guardCases = [
    [
      "requireCustomerSession /c/loc-1",
      "/c/loc-1",
      () => B.requireCustomerSession(demoAuth, { href: "/c/loc-1" }),
    ],
    [
      "requireCustomerSession /agents",
      "/agents",
      () => B.requireCustomerSession(demoAuth, { href: "/agents" }),
    ],
    [
      "/master beforeLoad",
      "/master",
      () =>
        B.MasterRoute.options.beforeLoad({
          context: { auth: demoAuth },
          location: { href: "/master", pathname: "/master" },
        }),
    ],
    [
      "/_authenticated beforeLoad /c/loc-1",
      "/c/loc-1",
      () =>
        B.AuthenticatedRoute.options.beforeLoad({
          context: { auth: demoAuth },
          location: { href: "/c/loc-1", pathname: "/c/loc-1" },
        }),
    ],
    [
      "/_authenticated beforeLoad /master/customers",
      "/master/customers",
      () =>
        B.AuthenticatedRoute.options.beforeLoad({
          context: { auth: demoAuth },
          location: { href: "/master/customers", pathname: "/master/customers" },
        }),
    ],
  ];
  for (const [label, path, fn] of guardCases) {
    onHost(host, path);
    store.clear();
    store.set(TOKEN_KEY, DEMO_TOKEN);
    const { redirect } = runGuard(fn);
    check(
      `${host}: ${label} lets the demo session through, on this host`,
      redirect === null && hardNavigations.length === 0,
      `redirect=${JSON.stringify(redirect)} hard=${JSON.stringify(hardNavigations)}`,
    );
  }
}

console.log("route guards on the real hosts, with a planted demo token");
{
  onHost("app.wyfyguest.com", "/c/loc-1");
  store.clear();
  store.set(TOKEN_KEY, DEMO_TOKEN);
  runGuard(() => B.requireCustomerSession(demoAuth, { href: "/c/loc-1" }));
  check(
    "app.wyfyguest.com: the customer guard no longer exempts it (global role -> master host)",
    hardNavigations.some((h) => h.startsWith("https://master.wyfyguest.com")),
    `hard=${JSON.stringify(hardNavigations)}`,
  );
  onHost("app.wyfyguest.com", "/master");
  runGuard(() =>
    B.MasterRoute.options.beforeLoad({
      context: { auth: demoAuth },
      location: { href: "/master", pathname: "/master" },
    }),
  );
  check(
    "app.wyfyguest.com: /master still bounces to master.wyfyguest.com (unchanged)",
    hardNavigations.some((h) => h.startsWith("https://master.wyfyguest.com")),
  );
  onHost("master.wyfyguest.com", "/agents");
  runGuard(() => B.requireCustomerSession(demoAuth, { href: "/agents" }));
  check(
    "master.wyfyguest.com: customer routes still bounce to app.wyfyguest.com (unchanged)",
    hardNavigations.some((h) => h.startsWith("https://app.wyfyguest.com")),
  );
}

console.log("the bare root (/) on the demo host");
for (const host of DEMO_HOSTS) {
  for (const [label, locationId, expectNav, expectRender] of [
    ["with a location picked", "loc-1", null, "CustomerDashboardPage"],
    ["with no location yet", null, "/switch-location", null],
  ]) {
    onHost(host, "/");
    globalThis.__navigations = [];
    globalThis.__activeLocationId = locationId;
    globalThis.__auth = {
      isAuthenticated: true,
      isReady: true,
      user: { id: "u-001" },
      roles: DEMO_ROLES,
    };
    B.__reset();
    const outputs = B.__render(B.IndexRoute.options.component, {});
    const last = outputs.at(-1);
    const navs = globalThis.__navigations.map((n) => n.to);
    check(
      `${host}: ${label} -> ${expectRender ?? expectNav}, never /master or another host`,
      (expectRender ? last?.type?.name === expectRender || last?.type === expectRender : true) &&
        (expectNav ? navs.includes(expectNav) : navs.length === 0) &&
        !navs.includes("/master") &&
        hardNavigations.length === 0,
      `render=${last?.type?.name ?? last?.type} navs=${JSON.stringify(navs)}`,
    );
  }
}

// ---------------------------------------------------------------------
// 4. One predicate: nobody else compares against the sentinel or the flag.
// ---------------------------------------------------------------------
console.log("single source of truth");
{
  const offenders = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(ent.name) && !p.endsWith(join("lib", "demo-host.ts"))) {
        const code = readFileSync(p, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        if (
          /["']demo-access-token["']|VITE_ENABLE_DEMO_LOGIN|["']admin@example\.com["']/.test(code)
        ) {
          offenders.push(relative(ROOT, p));
        }
      }
    }
  };
  walk(join(ROOT, "src"));
  check(
    "only src/lib/demo-host.ts names the demo token, credentials or build flag",
    offenders.length === 0,
    offenders.join(", "),
  );
}

console.log("");
if (failures > 0) {
  console.log(`FAIL: ${failures} failing, ${passes} passing`);
  process.exit(1);
}
console.log(`PASS: all ${passes} demo-login host checks passed`);
