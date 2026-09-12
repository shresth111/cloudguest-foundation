/**
 * Regression test: a captive-portal redirect must never resolve to a staff
 * sign-in form.
 *
 * Run: node scripts/test-captive-portal-never-staff-login.mjs
 *
 * THE DEFECT
 * ----------
 * Observed in a browser against production, 2026-09-12. This URL --
 *
 *   https://auth.wyfyguest.com/?clientMac=02-00-00-DE-AD-01
 *     &clientIp=103.84.202.195&t=1789106825&site=6aa3913c3ee1605f71ac35a1
 *     &redirectUrl=http%3A%2F%2Fneverssl.com%2F&apMac=B8-FB-B3-5D-64-3E
 *     &ssidName=WyfyGuest&radioId=1
 *
 * -- one path segment short of `/portal`, with Omada's own eight redirect
 * parameters present, rendered the OPERATOR sign-in page: "I'm signing in
 * as Owner / Staff", email + password. A guest who did nothing but join the
 * venue's WiFi was handed a credential form for that venue's dashboard,
 * inside the OS captive-network sheet, with the venue's branding round it.
 *
 * It needs no attacker. An operator who types `auth.wyfyguest.com` into the
 * controller's External Portal Server URL field instead of
 * `auth.wyfyguest.com/portal?...` produces it for every guest at that
 * venue, permanently, and nothing in either product reports it.
 *
 * WHAT IS ASSERTED, AND WHY IN TWO LAYERS
 * ---------------------------------------
 * 1. The REAL detector (`src/lib/captive-portal-redirect.ts`, bundled and
 *    imported, not reimplemented) classifies the real production search
 *    correctly, and does not fire on the ordinary operator URLs that reach
 *    the same three routes.
 *
 * 2. A REAL `@tanstack/react-router` router, built with the REAL guard in
 *    the REAL `beforeLoad` position on `/`, `/login` and `/master-login`,
 *    is driven to each of those URLs and must answer with a redirect to
 *    `/portal` carrying the redirect's parameters intact -- never with a
 *    match on the sign-in route. A detector that is correct but
 *    never wired in is exactly the shape of this bug, so behaviour is
 *    tested through the router rather than through the function alone.
 *
 * 3. The wiring itself is pinned by reading the three route files, because
 *    a locally-assembled route tree cannot see someone deleting the guard
 *    from a route file.
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

/* ------------------------------------------------------------------ *
 * Bundle the REAL module, exactly as test-portal-search-retention.mjs
 * does: output under the repo's own node_modules so `zod` and
 * `@tanstack/react-router` resolve to the installed copies.
 * ------------------------------------------------------------------ */
const work = join(ROOT, "node_modules", ".cache", "captive-portal-redirect");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const outfile = join(work, "captive-portal-redirect.mjs");

await build({
  entryPoints: [join(ROOT, "src/lib/captive-portal-redirect.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});

const { isCaptivePortalRedirect, captivePortalRedirect } = await import(
  pathToFileURL(outfile).href
);

const portalSearchOut = join(work, "portal-search.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/portal-search.ts")],
  outfile: portalSearchOut,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});
const { portalSearchSchema, portalSearchMiddlewares } = await import(
  pathToFileURL(portalSearchOut).href
);

const { createRootRoute, createRoute, createRouter, createMemoryHistory, redirect } =
  await import("@tanstack/react-router");

/* The production redirect, verbatim. `site` is the 24-hex site id the live
 * controller really emits -- read off it on 2026-09-12, not invented. */
const OMADA_QS =
  "clientMac=02-00-00-DE-AD-01" +
  "&clientIp=103.84.202.195" +
  "&t=1789106825" +
  "&site=6aa3913c3ee1605f71ac35a1" +
  "&redirectUrl=http%3A%2F%2Fneverssl.com%2F" +
  "&apMac=B8-FB-B3-5D-64-3E" +
  "&ssidName=WyfyGuest" +
  "&radioId=1";

const OMADA_SEARCH = {
  clientMac: "02-00-00-DE-AD-01",
  clientIp: "103.84.202.195",
  // A NUMBER, as TanStack's JSON.parse-ing search parser really delivers it.
  t: 1789106825,
  site: "6aa3913c3ee1605f71ac35a1",
  redirectUrl: "http://neverssl.com/",
  apMac: "B8-FB-B3-5D-64-3E",
  ssidName: "WyfyGuest",
  radioId: 1,
};

console.log("1. The detector, on the real production search");
check("the observed bare-host redirect is recognised", isCaptivePortalRedirect(OMADA_SEARCH));
check(
  "a gateway-shape redirect (no apMac/ssidName) is recognised",
  isCaptivePortalRedirect({
    clientMac: "02-00-00-DE-AD-01",
    gatewayMac: "AA-BB-CC-DD-EE-FF",
    vid: 0,
    t: 1789106825,
    site: "6aa3913c3ee1605f71ac35a1",
  }),
);
check(
  "a RouterOS hotspot redirect is recognised",
  isCaptivePortalRedirect({
    mac: "FA:42:FE:9E:29:03",
    ip: "10.5.50.251",
    dst: "",
    "link-login-only": "http://wifi.wyfyguest.com/login",
  }),
);
check(
  "a full baked portal URL that merely lost its /portal path is recognised",
  isCaptivePortalRedirect({
    organizationId: "744765dc-1acc-4d8d-abc0-57ca6b3ee2a5",
    locationId: "4b9c79ae-cc10-4dfd-8e9c-72f787ebb955",
    routerId: "f0c8fd65-7886-43ed-ba70-c93a7372bbe9",
    netProvider: "omada",
    ...OMADA_SEARCH,
  }),
);

console.log("2. The detector must NOT fire on ordinary operator URLs");
check("a bare visit", !isCaptivePortalRedirect({}));
check("undefined search", !isCaptivePortalRedirect(undefined));
check(
  "/login?redirect=... (the real post-auth bounce)",
  !isCaptivePortalRedirect({ redirect: "/master/integrations" }),
);
check(
  "/master/integrations?q=... (the wizard's own deep link)",
  !isCaptivePortalRedirect({ q: "QA Omada Venue" }),
);
check("a lone weak marker is not enough", !isCaptivePortalRedirect({ t: 1789106825 }));
check("a second weak marker is", isCaptivePortalRedirect({ t: 1789106825, site: "x" }));

console.log("3. The guard, through a real router");
const SIGN_IN_PATHS = ["/", "/login", "/master-login"];

async function routeFor(url) {
  const rootRoute = createRootRoute({});
  const guard = ({ location }) => {
    const target = captivePortalRedirect(location.search);
    if (target) throw redirect(target);
  };
  const portalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/portal",
    validateSearch: portalSearchSchema,
    search: { middlewares: portalSearchMiddlewares },
  });
  const signIn = SIGN_IN_PATHS.map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, beforeLoad: guard }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren([portalRoute, ...signIn]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  return router;
}

// `router.load()` does not itself walk the redirect -- it resolves the
// guard, records the outcome on `state.redirect`, and leaves `state.matches`
// empty. That record is the assertion worth making anyway: it is exactly
// what the router hands the server (a 307 to `href`) and therefore exactly
// what the guest's browser receives, with no sign-in document in between.
function redirectHref(router) {
  return router.state.redirect?.options?.href ?? null;
}

for (const path of SIGN_IN_PATHS) {
  const url = `${path}?${OMADA_QS}`;
  const router = await routeFor(url);
  const href = redirectHref(router);
  const landedOnPortal = !!href && href.startsWith("/portal");
  check(
    `${url.slice(0, 28)}… redirects to /portal, not a sign-in form`,
    landedOnPortal,
    href ?? `no redirect; matched ${router.state.matches.map((m) => m.routeId).join(", ")}`,
  );
  if (landedOnPortal) {
    const q = new URLSearchParams(href.slice(href.indexOf("?") + 1));
    check(
      `  …carrying clientMac, site and redirectUrl`,
      q.get("clientMac") === "02-00-00-DE-AD-01" &&
        q.get("site") === "6aa3913c3ee1605f71ac35a1" &&
        q.get("redirectUrl") === "http://neverssl.com/",
      href,
    );
  }
}

for (const path of SIGN_IN_PATHS) {
  const router = await routeFor(path);
  check(
    `${path} with no params still renders itself`,
    redirectHref(router) === null && router.state.location.href === path,
    redirectHref(router) ?? router.state.location.href,
  );
}

console.log("4. The wiring, read off the route files");
for (const file of ["index", "login", "master-login"]) {
  const src = readFileSync(join(ROOT, `src/routes/${file}.tsx`), "utf8");
  check(
    `src/routes/${file}.tsx calls the guard in beforeLoad`,
    /beforeLoad:\s*\(\{\s*location\s*\}\)\s*=>\s*\{[\s\S]{0,240}?captivePortalRedirect\(/.test(
      src,
    ) && src.includes("throw redirect(target)"),
  );
}

console.log(
  failures === 0
    ? "\nAll captive-portal misroute checks passed."
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
