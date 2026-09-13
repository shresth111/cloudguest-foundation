/**
 * Regression test: "View as this customer" works on the Master Console host,
 * and END SESSION hands the operator back to the console.
 *
 * Run: node scripts/test-impersonation-master-host.mjs
 *
 * THE DEFECTS (measured on prod, 2026-09-14)
 * ------------------------------------------
 * 1. master.wyfyguest.com/master/customers -> View as this customer ->
 *    Continue. The impersonation session started (banner visible) but the
 *    page landed on /master-login?redirect=/master. Every customer-surface
 *    guard treated the master host as "operators only" and sent the visitor
 *    to /master (index.tsx, _authenticated.tsx) or across to
 *    app.wyfyguest.com (authGuards.ts -- a different origin, so a different
 *    localStorage, so signed out). /master then refused the impersonated,
 *    non-global token.
 *
 * 2. END SESSION restored the operator's session in storage, but the banner
 *    navigated to /master/customers before AuthRouterContextSync had pushed
 *    the restored roles into router context, so /master's guard ran against
 *    the stale impersonated roles and landed on /master-login.
 *
 * WHAT IS ASSERTED
 * ----------------
 * The REAL guards (`requireCustomerSession` from authGuards.ts and /master's
 * own `beforeLoad` from master.tsx) are bundled and called with a stubbed
 * `window` on each hostname, with a real impersonation-shaped token, a normal
 * customer token, and an operator token in storage. The security half matters
 * as much as the fix: a normal customer is still sent off the master host, and
 * an impersonated session is still refused operator scope.
 *
 * `_authenticated.tsx`, `index.tsx` and the banner render React trees this
 * repo has no runner for, so their wiring is pinned from source.
 */
import { build } from "esbuild";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

/* ---------------------------- browser stubs ---------------------------- */
const store = new Map();
const localStorageStub = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = localStorageStub;
globalThis.window = {
  localStorage: localStorageStub,
  location: { hostname: "master.wyfyguest.com", href: "", origin: "", pathname: "/" },
};

function setHost(hostname) {
  globalThis.window.location.hostname = hostname;
  globalThis.window.location.href = "";
}

/* ------------------------- bundle the real code ------------------------ */
const work = join(ROOT, "node_modules", ".cache", "impersonation-master-host");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

async function bundle(entry, name) {
  const outfile = join(work, `${name}.mjs`);
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    jsx: "automatic",
    define: { "import.meta.env": "{}" },
    logLevel: "error",
  });
  return import(pathToFileURL(outfile).href);
}

const { requireCustomerSession } = await bundle("src/lib/authGuards.ts", "auth-guards");
const { Route: MasterRoute } = await bundle("src/routes/master.tsx", "master-route");
const masterBeforeLoad = MasterRoute.options.beforeLoad;

/* -------------------------------- tokens ------------------------------- */
const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const jwt = (payload) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`;

const IMPERSONATION_TOKEN = jwt({
  sub: "customer-user",
  impersonation: {
    actor_user_id: "operator-user",
    actor_email: "staff@wyfyguest.com",
    started_at: "2026-09-14T00:00:00Z",
  },
});
const CUSTOMER_TOKEN = jwt({ sub: "customer-user" });
const OPERATOR_TOKEN = jwt({ sub: "operator-user" });

const IMPERSONATED_ROLES = [
  { roleId: "impersonated-session", roleName: "x", roleSlug: "x", scopeType: "organization" },
];
const CUSTOMER_ROLES = [
  { roleId: "r", roleName: "Owner", roleSlug: "owner", scopeType: "organization" },
];
const OPERATOR_ROLES = [
  { roleId: "r", roleName: "Super Admin", roleSlug: "sa", scopeType: "global" },
];

function signIn(token) {
  store.clear();
  store.set("cloudguest_token", token);
}

/** Runs a guard; returns null (allowed) or the redirect's `to`. */
function outcome(fn) {
  try {
    fn();
    return null;
  } catch (err) {
    const to = err?.options?.to ?? err?.to ?? err?.href;
    if (to === undefined) throw err;
    return to;
  }
}

const customerGuard = (roles, href = "/switch-location") =>
  outcome(() => requireCustomerSession({ status: "authenticated", roles }, { href }));
const masterGuard = (roles, href = "/master/customers") =>
  outcome(() =>
    masterBeforeLoad({
      context: { auth: { status: "authenticated", roles } },
      location: { href, pathname: href },
    }),
  );

/* -------------------------------- 1. fix ------------------------------- */
console.log("1. An impersonation session can use the customer surface on the master host");
setHost("master.wyfyguest.com");
signIn(IMPERSONATION_TOKEN);
check(
  "requireCustomerSession lets it through (was: bounce to app.wyfyguest.com)",
  customerGuard(IMPERSONATED_ROLES) === null && window.location.href === "",
  `redirect=${customerGuard(IMPERSONATED_ROLES)} href=${window.location.href}`,
);
check(
  "/master sends it back to the customer view, not to /master-login",
  masterGuard(IMPERSONATED_ROLES) === "/",
  `got ${masterGuard(IMPERSONATED_ROLES)}`,
);

/* ------------------------------ 2. security ---------------------------- */
console.log("2. The boundaries still hold");
setHost("master.wyfyguest.com");
signIn(CUSTOMER_TOKEN);
customerGuard(CUSTOMER_ROLES, "/switch-location");
check(
  "a normal customer token on the master host is still sent to app.wyfyguest.com",
  window.location.href === "https://app.wyfyguest.com/switch-location",
  `href=${window.location.href}`,
);
setHost("master.wyfyguest.com");
check(
  "a normal customer token is still refused /master (-> /master-login)",
  masterGuard(CUSTOMER_ROLES) === "/master-login",
  `got ${masterGuard(CUSTOMER_ROLES)}`,
);
signIn(IMPERSONATION_TOKEN);
check(
  "an impersonation token never passes /master's operator check",
  masterGuard(IMPERSONATED_ROLES) !== null,
);
setHost("app.wyfyguest.com");
signIn(IMPERSONATION_TOKEN);
masterGuard(IMPERSONATED_ROLES);
check(
  "/master on the customer host still bounces to the master host first",
  window.location.href.startsWith("https://master.wyfyguest.com/"),
  `href=${window.location.href}`,
);

/* ---------------------------- 3. END SESSION --------------------------- */
console.log("3. END SESSION: the operator gets /master back once router context is updated");
setHost("master.wyfyguest.com");
signIn(OPERATOR_TOKEN); // endImpersonation has restored the operator's token
check(
  "restored operator roles pass /master",
  masterGuard(OPERATOR_ROLES) === null,
  `got ${masterGuard(OPERATOR_ROLES)}`,
);
check(
  "the STALE impersonated roles would not (this is the ordering bug)",
  masterGuard(IMPERSONATED_ROLES) === "/master-login",
  `got ${masterGuard(IMPERSONATED_ROLES)}`,
);

/* --------------------------- 4. wiring pins ---------------------------- */
console.log("4. Wiring");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const src = (f) => strip(readFileSync(join(ROOT, f), "utf8"));

const authenticated = src("src/routes/_authenticated.tsx");
check(
  "_authenticated.tsx's master-host redirect exempts an impersonation session",
  /hostname\s*===\s*"master\.wyfyguest\.com"\s*&&[\s\S]{0,120}!isImpersonationSessionActive\(\)\s*\)\s*\{\s*throw redirect\(\{\s*to:\s*"\/master"/.test(
    authenticated,
  ),
);

const index = src("src/routes/index.tsx");
check(
  "index.tsx does not treat an impersonation session as the master console",
  /isMaster\s*=\s*hostname\s*===\s*"master\.wyfyguest\.com"\s*&&\s*!isImpersonating/.test(index) &&
    /isImpersonationSessionActive\(\)/.test(index) &&
    /scopeType\s*===\s*"global"/.test(index),
);

const banner = src("src/components/impersonation/ImpersonationBanner.tsx");
const updateAt = banner.search(/router\.update\(\{\s*context:[\s\S]*?auth:\s*restored/);
const navigateAt = banner.search(/navigate\(\{\s*to:\s*"\/master\/customers"/);
check(
  "the banner pushes the restored session into router context before navigating",
  /const restored = endImpersonation\(\)/.test(banner) && updateAt !== -1 && updateAt < navigateAt,
);

const authContext = src("src/context/AuthContext.tsx");
check(
  "endImpersonation returns the restored auth slice on both branches",
  /return \{ status: "anonymous", roles: \[\] \}/.test(authContext) &&
    /return \{ status: "authenticated", roles: preSession\.roles \}/.test(authContext),
);

if (failures > 0) {
  console.log(`\nimpersonation on master host: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nimpersonation on master host: all checks passed");
