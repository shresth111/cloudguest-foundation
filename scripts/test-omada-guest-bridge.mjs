/**
 * The guest-flow bridge: from an Omada controller's redirect to a guest
 * who is actually online.
 *
 * Run: node scripts/test-omada-guest-bridge.mjs
 *
 * THE GAP THIS COVERS
 * -------------------
 * Nothing in `src/` called `POST /network-integrations/portal/authorize` --
 * the backend step that tells a venue's Omada controller to let a device
 * through. It was live, tenant-checked, rate-limited and tested, with no
 * caller anywhere.
 *
 * THE SHAPE, AND WHY IT IS THIS ONE
 * ---------------------------------
 * An Omada guest lands on `/portal` directly, with
 * `organizationId`/`locationId`/`routerId` in the URL the venue's operator
 * pasted into the controller -- the SAME shape `buildPortalUrl()` stamps
 * into a RouterOS override page today. Measured on hardware 2026-09-11: the
 * controller APPENDS its own parameters to a configured query string with
 * `&`, not the second `?` doc 132060's redirect template implied. So there
 * is no second entry point, and an Omada guest sees exactly the captive
 * portal a MikroTik guest sees.
 *
 * WHAT IS ASSERTED, AND WHY IN THIS SHAPE
 * ---------------------------------------
 * Sections 1-2 drive REAL modules bundled with esbuild -- the real
 * authorize-body builder, the real service against a recording HTTP client.
 * Section 3 replays a REAL captured redirect through the REAL router and
 * the REAL search schema. Section 4 pins wiring no behavioural test can
 * see: that `/portal/success` really branches on the provider, that the
 * branch really sits above the three RouterOS guards that would otherwise
 * swallow an Omada guest, and that the login call really feeds `clientMac`
 * into `device_mac`.
 *
 * That last one is not cosmetic. `POST /portal/authorize` requires the MAC
 * it is asked to authorize to BE the session's own device (the fix for a
 * guest who signed in honestly putting a stranger's phone on the WiFi). A
 * session with no device cannot satisfy it, so at an Omada venue a MAC-less
 * login does not merely risk a second sign-in -- it guarantees the
 * authorize call fails and the guest never gets internet at all.
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "omada-bridge-"));

/* A recording stand-in for both HTTP clients, so a test can assert WHICH
 * one a call went out on. That distinction is the point for the portal
 * route: `api` carries an admin JWT, a 401-refresh-retry loop and an
 * `X-Organization-Id` header read out of localStorage. A guest's browser
 * has none of those, and the org header in particular would be a claim
 * about which tenant this is, sent by an unauthenticated caller, to the
 * endpoint whose whole job is to check that claim against a real session. */
const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  `export const calls = [];
   let nextData = {};
   export function setNext(d) { nextData = d; }
   export function reset() { calls.length = 0; nextData = {}; }
   function record(client, method, url, body, config) {
     calls.push({ client, method, url, body, headers: config?.headers ?? {} });
     return { data: nextData };
   }
   export const api = {
     async get(url, config) { return record("api", "get", url, undefined, config); },
     async post(url, body, config) { return record("api", "post", url, body, config); },
     async patch(url, body, config) { return record("api", "patch", url, body, config); },
     async put(url, body, config) { return record("api", "put", url, body, config); },
     async delete(url, config) { return record("api", "delete", url, undefined, config); },
   };
   export const guestPortalApi = {
     async get(url, config) { return record("guest", "get", url, undefined, config); },
     async post(url, body, config) { return record("guest", "post", url, body, config); },
   };
   export function toAppError(e) { return e; }
   export default api;`,
);

const orgStub = join(outdir, "org-stub.mjs");
writeFileSync(
  orgStub,
  `export async function resolveOrganizationId() { return "org-under-test"; }
   export function peekOrganizationId() { return "org-under-test"; }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { guestPortalIntegrationService } from "${p("src/services/network-integration.service.ts")}";
   export * from "${p("src/lib/portal-authorize-body.ts")}";
   export { calls, setNext, reset } from "${apiStub.replace(/\\/g, "/")}";`,
);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: {
    "@/services/api": apiStub,
    "@/services/guest-portal-api": apiStub,
    "@/services/organization-id": orgStub,
    "@/types/network-integration": p("src/types/network-integration.ts"),
    "@/lib/portal-authorize-body": p("src/lib/portal-authorize-body.ts"),
  },
  plugins: [
    {
      name: "stub-relative-org-id",
      setup(b) {
        b.onResolve({ filter: /(^|\/)organization-id$/ }, () => ({ path: orgStub }));
      },
    },
  ],
});

const { guestPortalIntegrationService, buildPortalAuthorizeBody, calls, setNext, reset } =
  await import(pathToFileURL(outfile).href);

/* The real values from the captured hardware redirect, 2026-09-11. MACs are
 * HYPHEN-separated in the controller's 302 (they were colon-separated in the
 * AP's own first hop), `site` is the Omada site ID and not its name, and
 * `clientIp` is the venue's NAT address rather than the client's. */
const ORG = "08ec098b-4c1e-4a3f-9d21-6f0a5b3e77c1";
const LOC = "ede8381c-1b44-4d0e-a7c9-2e5f8a91b330";
const RTR = "bfc7ed1c-9a02-4b6d-8f13-4c7e2d0a5169";
const CLIENT_MAC = "B2-1F-D7-13-DC-8E";
const CLIENT_IP = "103.84.202.195";
const SITE = "6aa3913c3ee1605f71ac35a1";
const AP_MAC = "B8-FB-B3-5D-64-3E";

/* ------------------------------------------------------------------ *
 * 1. The URL the operator pastes -- against TP-Link's OWN pattern.
 * ------------------------------------------------------------------ */
console.log("\n1. the External Portal Server URL the dashboard hands over");

/* `ExternalServerPortalSetting.serverUrl.pattern`, transcribed from
 * TP-Link's published Open API schema. This is the assertion the shape
 * rests on: what we hand an operator must be something the controller will
 * accept, and only their regex can say. The string itself is built
 * server-side (`validators.build_external_portal_url`); what is checked
 * here is that the shape the frontend renders and instructs around is the
 * one that passes. */
const SERVER_URL_PATTERN = new RegExp(
  "^(([-a-zA-Z0-9@:%._+~#=]{2,256}\\.[a-z]{2,63})|" +
    "((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}" +
    "(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))" +
    "((:([0-9]{1,5}))?)(/([-a-zA-Z0-9@:%_+.~#?&//=]*))?$",
);

const HOST_AND_QUERY =
  `auth.wyfyguest.com/portal?organizationId=${ORG}` +
  `&locationId=${LOC}&routerId=${RTR}&netProvider=omada`;

check(
  "the URL field matches TP-Link's own serverUrl pattern",
  SERVER_URL_PATTERN.test(HOST_AND_QUERY),
);
check(
  "the scheme-in-URL form does NOT -- which is why they are two fields",
  !SERVER_URL_PATTERN.test(`https://${HOST_AND_QUERY}`),
  "an operator who pastes the whole thing gets a validation error from the controller",
);
check(
  "a bare host with a query string does NOT -- which is why /portal is load-bearing",
  !SERVER_URL_PATTERN.test(HOST_AND_QUERY.replace("/portal?", "?")),
  "the `?` lives inside the pattern's PATH class and is only reachable after a `/`",
);
check(
  "it is the same route and the same three ids a MikroTik guest gets",
  HOST_AND_QUERY.includes("/portal?") &&
    HOST_AND_QUERY.includes(`organizationId=${ORG}`) &&
    HOST_AND_QUERY.includes(`locationId=${LOC}`) &&
    HOST_AND_QUERY.includes(`routerId=${RTR}`),
);
/* The controller APPENDS with `&`, measured on hardware. That is what makes
 * a configured query string survive at all, and it is the fact the whole
 * "same portal as MikroTik" decision rests on. */
const EMITTED = `https://${HOST_AND_QUERY}&clientMac=${CLIENT_MAC}&clientIp=${CLIENT_IP}&t=1789107394&site=${SITE}&redirectUrl=http%3A%2F%2Fneverssl.com%2F&apMac=${AP_MAC}&ssidName=WyfyGuest&radioId=1`;
const emittedParams = new URL(EMITTED).searchParams;
check(
  "the configured ids survive the controller's append",
  emittedParams.get("organizationId") === ORG &&
    emittedParams.get("locationId") === LOC &&
    emittedParams.get("routerId") === RTR &&
    emittedParams.get("netProvider") === "omada",
);
check(
  "...and so does every parameter the controller added",
  emittedParams.get("clientMac") === CLIENT_MAC &&
    emittedParams.get("site") === SITE &&
    emittedParams.get("apMac") === AP_MAC,
  "a naive `?` join would have made organizationId's value swallow clientMac",
);

/* ------------------------------------------------------------------ *
 * 2. The authorize call: the step that actually lets the device on.
 * ------------------------------------------------------------------ */
console.log("\n2. the authorize call");

const SESSION = "5c7f5f26-0a1e-4a49-9c1b-3d2f7a1c9e40";
/* The captured redirect, in the types TanStack's search parser really
 * produces: `radioId` and `t` arrive as NUMBERS because the router
 * JSON.parses every raw value. */
const CAPTURED = {
  clientMac: CLIENT_MAC,
  site: SITE,
  apMac: AP_MAC,
  ssidName: "WyfyGuest",
  radioId: 1,
  t: 1789107394,
  redirectUrl: "http://neverssl.com/",
};

const body = buildPortalAuthorizeBody(
  { session_id: SESSION, organization_id: ORG, location_id: LOC, provider: "omada" },
  CAPTURED,
  CLIENT_IP,
);

/* THE SHAPE THE BACKEND PARSES -- `PortalAuthorizeRequest` in
 * app/domains/network_integration/schemas.py -- not the shape this frontend
 * happens to build. The one shipped cross-repo bug in this integration was
 * a frontend nesting fields under a key pydantic's `extra="ignore"` then
 * dropped without a word. */
for (const field of [
  "session_id",
  "organization_id",
  "location_id",
  "provider",
  "client_mac",
  "client_ip",
  "site",
  "ap_mac",
  "ssid_name",
  "radio_id",
  "gateway_mac",
  "vid",
  "t",
  "redirect_url",
]) {
  check(`body carries \`${field}\` at the TOP level`, field in body);
}
check(
  "nothing is nested under a sub-object",
  Object.values(body).every((v) => v === null || typeof v !== "object"),
);
check("no camelCase key survives", !Object.keys(body).some((k) => /[A-Z]/.test(k)));
check(
  "the controller's values are carried, not re-derived",
  body.client_mac === CLIENT_MAC &&
    body.site === SITE &&
    body.ssid_name === "WyfyGuest" &&
    body.radio_id === 1 &&
    body.t === "1789107394" &&
    body.redirect_url === "http://neverssl.com/",
);
check(
  "a gateway-shape absence stays absent rather than being filled in",
  body.gateway_mac === null && body.vid === null,
  "an EAP redirect carries no gatewayMac/vid; inventing one would authorize against a VLAN " +
    "the controller never named",
);

reset();
setNext({ authorized: true, provider: "omada", redirect_url: "http://neverssl.com/" });
const result = await guestPortalIntegrationService.authorizePortal(body);
const authCall = calls[0];

check("it goes to the public authorize route", authCall.url.endsWith("/portal/authorize"));
check(
  "it goes out on the UNAUTHENTICATED client",
  authCall.client === "guest",
  "a guest holds no admin JWT",
);
check(
  "...and carries no organization header",
  !Object.keys(authCall.headers ?? {}).some((h) => /organization/i.test(h)),
  "an org header here would be a claim about which tenant this is, sent by the caller",
);
check("the body is passed through verbatim", authCall.body === body);
check("a success is reported as one", result.authorized === true);

reset();
setNext({ authorized: false, provider: "omada" });
const declined = await guestPortalIntegrationService.authorizePortal(body);
check(
  "a controller that DECLINES is not reported as connected",
  declined.authorized === false,
  "this page has already shipped the version of that mistake once",
);

/* ------------------------------------------------------------------ *
 * 3. The real captured redirect, through the real router and schema.
 * ------------------------------------------------------------------ */
console.log("\n3. the captured redirect, replayed through the real search schema");

const work = join(ROOT, "node_modules", ".cache", "omada-guest-bridge");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const searchOut = join(work, "portal-search.mjs");
await build({
  entryPoints: [p("src/lib/portal-search.ts")],
  outfile: searchOut,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});
const { portalSearchSchema, portalSearchMiddlewares } = await import(pathToFileURL(searchOut).href);
const { createRootRoute, createRoute, createRouter, createMemoryHistory } =
  await import("@tanstack/react-router");

const rootRoute = createRootRoute({});
const portalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/portal",
  validateSearch: portalSearchSchema,
  search: { middlewares: portalSearchMiddlewares },
});
portalRoute.addChildren(
  ["/", "/welcome", "/terms", "/verify", "/success"].map((path) =>
    createRoute({ getParentRoute: () => portalRoute, path }),
  ),
);
const router = createRouter({
  routeTree: rootRoute.addChildren([portalRoute]),
  history: createMemoryHistory({
    initialEntries: [EMITTED.replace("https://auth.wyfyguest.com", "")],
  }),
});
await router.load();

const parsed = router.state.location.search;
check(
  "the real schema parses the real redirect without rejecting it",
  parsed.organizationId === ORG && parsed.netProvider === "omada",
  JSON.stringify(parsed),
);
check(
  "every controller parameter reaches the schema",
  String(parsed.clientMac) === CLIENT_MAC &&
    String(parsed.site) === SITE &&
    String(parsed.apMac) === AP_MAC &&
    String(parsed.ssidName) === "WyfyGuest" &&
    String(parsed.radioId) === "1" &&
    parsed.clientIp === CLIENT_IP,
);
/* The 7 Sep incident's exact shape, with the other vendor's parameters in
 * it: a `<Link>` that passes only the three ids must not narrow the URL. */
const THREE_KEYS = { organizationId: ORG, locationId: LOC, routerId: RTR };
for (const [label, opts] of [
  ["the three-key object", { search: THREE_KEYS }],
  ["an empty object", { search: {} }],
  ["no `search` key at all", {}],
]) {
  const href = router.buildLocation({ to: "/portal/success", ...opts }).href;
  const q = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  check(
    `welcome -> success with ${label} keeps netProvider and clientMac`,
    q.get("netProvider") === "omada" && q.get("clientMac") === CLIENT_MAC,
    href,
  );
}
const offPortal = router.buildLocation({ to: "/", search: {} }).href;
check(
  "navigating OFF /portal does not drag the guest's MAC onto an operator page",
  !offPortal.includes("clientMac"),
);

/* ------------------------------------------------------------------ *
 * 4. The wiring. A behavioural test cannot see a branch being deleted.
 * ------------------------------------------------------------------ */
console.log("\n4. the wiring that makes the flow reach the authorize call");

const src = (rel) => readFileSync(join(ROOT, rel), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/* Prose in JSX and in doc comments is line-wrapped by prettier, so a phrase
 * a human reads as one sentence is split by a newline, indentation and (in
 * a block comment) a continuation asterisk. Both are removed before
 * matching, so these assertions are about the words an operator or a
 * reader actually sees rather than about where the formatter broke the
 * line. */
const flat = (s) => s.replace(/^\s*\*[ \t]?/gm, " ").replace(/\s+/g, " ");

check(
  "there is no second entry route for Omada guests",
  !readFileSync(join(ROOT, "src/routeTree.gen.ts"), "utf8").includes("/omada/"),
  "the product decision is that an Omada guest sees exactly the MikroTik portal, same route",
);

const searchLib = stripComments(src("src/lib/portal-search.ts"));
check(
  "netProvider is on the retained search schema",
  /netProvider: z\./.test(searchLib),
  "a param missing from this schema is dropped at the first <Link>, exactly as `mac` was",
);
for (const key of [
  "clientMac",
  "clientIp",
  "site",
  "apMac",
  "ssidName",
  "radioId",
  "gatewayMac",
  "vid",
  "redirectUrl",
]) {
  check(`${key} is on the retained search schema`, new RegExp(`\\b${key}: `).test(searchLib));
}

const successStripped = stripComments(src("src/routes/portal.success.tsx"));
check("/portal/success branches on netProvider", /netProvider === "omada"/.test(successStripped));
check(
  "...and calls the authorize endpoint on that branch",
  /guestPortalIntegrationService\.authorizePortal/.test(successStripped),
);
/* ORDER IS LOAD-BEARING. Each of the three RouterOS guards would swallow an
 * Omada guest: `hspage` is never stamped by a controller, the
 * `guestIdentifier` return exists for a RADIUS lookup the Omada call does
 * not make, and the `!hotspotLoginUrl` branch would send EVERY Omada guest
 * to a page saying they are online before anything let them on. */
const omadaBranchAt = successStripped.indexOf('netProvider === "omada"');
for (const [name, needle] of [
  ["the hspage check", "nasAuthorizedFromSearch"],
  ["the guestIdentifier return", "if (!guestIdentifier) return"],
  ["the missing-hotspot-URL branch", "if (!hotspotLoginUrl)"],
]) {
  const at = successStripped.indexOf(needle, omadaBranchAt - 1);
  check(
    `the omada branch sits ABOVE ${name}`,
    omadaBranchAt >= 0 && at > omadaBranchAt,
    "that RouterOS guard would otherwise swallow every Omada guest",
  );
}
check(
  "the MikroTik form POST is still there, untouched",
  /submitHotspotLogin\(hotspotLoginUrl, guestIdentifier, dst\)/.test(successStripped),
  "the live flow carrying real guests today must not have been changed",
);

const signIn = stripComments(src("src/components/portal-runtime/useGuestSignIn.ts"));
check(
  "the login call feeds device_mac from Omada's clientMac when RouterOS has none",
  /routerOsMac \?\? normalizeOmadaText\(omadaRedirect\?\.clientMac\)/.test(signIn),
  "a MAC-less login writes device_id = NULL, and the authorize endpoint REFUSES a session " +
    "whose device it cannot bind -- so that guest never gets online at all",
);

const ctx = stripComments(src("src/context/PortalRuntimeContext.tsx"));
check(
  "the Omada context is mirrored outside the URL",
  /cloudguest_portal_omada_ctx/.test(ctx) &&
    /safeSet\(OMADA_CTX_STORAGE_KEY/.test(ctx) &&
    /safeCookieSet\(OMADA_CTX_STORAGE_KEY/.test(ctx),
  "retainSearchParams does not cover the three full document loads this flow performs",
);
const portalRouteSrc = stripComments(src("src/routes/portal.tsx"));
check(
  "the URL wins over the mirror",
  /const netProvider = urlNetProvider \?\? persistedOmada/.test(portalRouteSrc) &&
    /const effectiveClientIp = clientIp \?\? persistedOmada/.test(portalRouteSrc),
  "a mirror that could override a live redirect would send the controller this device's " +
    "PREVIOUS association",
);
check(
  "only an Omada arrival ever writes the mirror",
  /if \(!urlNetProvider\) return;/.test(portalRouteSrc),
);

/* The operator half. Without it nobody can complete setup at all: unlike
 * MikroTik, this platform does not write the equivalent page onto the
 * device -- a human reads this off a dashboard and types it into a
 * controller.
 *
 * The controller steps live in ONE shared component, rendered by every
 * surface that hands them over. Each surface is checked against its own
 * source plus that component's, and must actually render it -- a surface
 * that stopped importing it would lose every step below without any of
 * these checks noticing otherwise. */
const SHARED_STEPS = "src/components/network-integrations/OmadaPortalSetupSteps.tsx";
const rendersSharedSteps = (s) =>
  /from "@\/components\/network-integrations\/OmadaPortalSetupSteps"/.test(s) &&
  /<OmadaPortalSetupSteps\b/.test(s);
for (const [name, rel] of [
  ["the add-customer wizard", "src/components/locations/PlatformLocationWizard.tsx"],
  ["router fleet's omada setup screen", "src/components/routers/OmadaGuidedSetupPanel.tsx"],
]) {
  check(`${name} renders the shared controller steps`, rendersSharedSteps(src(rel)));
}
for (const [name, rel] of [
  ["the customer dashboard", "src/components/features/NetworkIntegrationsPage.tsx"],
  ["the master console", "src/routes/master.integrations.tsx"],
]) {
  check(`${name} renders the shared controller steps`, rendersSharedSteps(src(rel)));
  const page = `${src(rel)}\n${src(SHARED_STEPS)}`;
  check(
    `${name} shows the scheme and the URL as separate copyable values`,
    /portalUrlScheme/.test(page) && /portalUrlHostAndQuery/.test(page) && /Copy/.test(page),
  );
  check(
    `${name} warns that the scheme must not be inside the URL field`,
    /rejects a URL that contains the scheme|rejects it if the scheme is included/.test(flat(page)),
  );
  check(
    `${name} refuses to show a link that could not serve a guest`,
    /portalReadinessGaps/.test(page) && /fleet_device_missing/.test(page),
    "an integration with no fleet device has no routerId to put in the URL at all",
  );
  check(
    `${name} tells the operator the guest must reach the controller on 8088`,
    /8088/.test(page),
    "the AP's first hop is to the CONTROLLER's own portal entry, not to us -- observed " +
      "2026-09-11, and the failure is silent",
  );
  /* THE SECOND HALF OF SETUP, AND IT IS NOT OPTIONAL. Measured the same
   * day from an associated-but-unauthorized client: DNS resolves, TCP 443
   * connects, and every HTTPS request times out -- our own portal host
   * included. Omada does not auto-permit the external portal server it is
   * itself redirecting to. A dashboard that shows only the portal URL has
   * given the operator half an instruction, and the missing half produces
   * the least diagnosable failure in the whole flow: every setting looks
   * right and the page never appears. */
  check(
    `${name} tells the operator to add a Pre-Authentication Access entry`,
    /Pre-Authentication Access/.test(flat(page)),
    "without it the sign-in page never loads at all -- HTTPS is black-holed pre-auth",
  );
  check(
    `${name} gives the host to permit, taken off the URL rather than re-derived`,
    /hostAndQuery\.split\("\/"\)\[0\]/.test(page),
    "the host an operator is told to permit must BE the host their guests are sent to; two " +
      "copies of that string is a walled garden that lets nobody in",
  );
  check(
    `${name} says WHY one entry covers the API origin, not just that it does`,
    /resolved/.test(flat(page)) && /same address/.test(flat(page)),
    "a URL entry permits the resolved address, not the name. That makes one entry sufficient " +
      "TODAY and silently insufficient the moment DNS moves -- which this estate has done once",
  );
}

/* The NAT finding has to be written down where the field is spelled, or the
 * engineer plumbing CR-004 will treat a venue identifier as a client one. */
check(
  "the clientIp NAT finding is recorded where the field is spelled",
  /NAT ADDRESS|NAT address/.test(flat(src("src/lib/portal-authorize-body.ts"))) &&
    /NAT ADDRESS|NAT address/.test(flat(src("src/lib/portal-search.ts"))),
  "off-site controllers report the venue's egress address, identical for every guest at once",
);

console.log("");
if (failures) {
  console.log(`omada guest bridge: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("omada guest bridge: all checks passed");
