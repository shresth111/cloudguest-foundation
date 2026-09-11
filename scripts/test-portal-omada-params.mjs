/**
 * Omada's portal-redirect parameters must survive the portal.
 *
 * Run: node scripts/test-portal-omada-params.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * TP-Link doc 132060 (*External Portal Server, Omada Controller v6.2.10 or
 * Above*) states the obligation directly:
 *
 *   "Your External Portal Server must preserve and return these parameters
 *   when interacting with the Omada Controller."
 *
 * The controller 302s the guest's browser to this portal with one of two
 * documented query strings, and a venue produces exactly one of them:
 *
 *   EAP/AP:  ?clientMac=..&clientIp=..&apMac=..&ssidName=..&t=..
 *            &radioId=..&site=..&redirectUrl=..
 *   Gateway: ?clientMac=..&clientIp=..&gatewayMac=..&vid=..&t=..
 *            &site=..&redirectUrl=..
 *
 * `clientIp` is covered by scripts/test-portal-client-ip.mjs. This suite is
 * the other nine. Nothing here depends on how the VENUE is identified --
 * `organizationId`/`locationId`/`routerId` are a separate, open design
 * question and are deliberately untouched. These nine are known today under
 * any answer to it, because only the controller can supply them.
 *
 * THREE FAILURE MODES, ALL SILENT, ALL ASSERTED HERE
 * -------------------------------------------------
 * 1. DROPPED IN TRANSIT. A param not on `portalSearchShape` is stripped by
 *    the schema on the first parse and again by `retainSearchParams` at the
 *    first internal `<Link>` -- how a real production sign-in lost `mac` on
 *    7 Sep 2026 (scripts/test-portal-search-retention.mjs). Sections 1-3
 *    drive the REAL schema and the REAL router middleware.
 *
 * 2. REJECTED BY OUR OWN SCHEMA. TanStack Router's default search parser
 *    JSON.parses every raw value, so a genuine redirect delivers `radioId`,
 *    `vid` and `t` as NUMBERS. A `z.string()` on those keys would throw a
 *    SearchParamError and the route's errorComponent would swallow the
 *    entire redirect -- all nine parameters, not just the numeric three.
 *    Section 2 parses through the real router for exactly this reason;
 *    section 6 pins the types end to end.
 *
 * 3. SENT WHERE NOBODY READS IT. The one shipped cross-repo bug in this
 *    integration was this frontend nesting controller credentials under a
 *    `credentials: {...}` key the backend never read; pydantic's default
 *    `extra="ignore"` dropped it and returned 201 with nothing stored, while
 *    the contract test passed throughout because it asserted the same wrong
 *    place the code wrote to. Section 5 therefore asserts the names the
 *    BACKEND parses -- `PortalAuthorizeRequest` in
 *    cloud-guest-repo/backend/app/domains/network_integration/schemas.py,
 *    whose fields router.py hands one by one to
 *    `service.authorize_portal_client(...)` -- and that no camelCased or
 *    nested second copy exists anywhere in the body. That mapping is not
 *    uniform: `site`, `t` and `vid` keep their spelling, and `ssidName`
 *    becomes `ssid_name`, NOT the `guest_ssid_name` that the integration row
 *    and three other request models on the same file use for an SSID.
 *
 * Sections 4 and 7 pin CAPTURED, NEVER DERIVED: an absent parameter is null
 * on the wire, never filled in from the other redirect shape, from the
 * integration's own configuration, from `Date.now()`, or from the other
 * vendor's similarly-shaped param.
 */
import { build } from "esbuild";
import { mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
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
 * Bundle the REAL modules, into the repo's own node_modules so
 * `@tanstack/react-router` and `zod` resolve to the same installed
 * copies the app uses.
 * ------------------------------------------------------------------ */
const work = join(ROOT, "node_modules", ".cache", "portal-omada-params");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

async function bundle(entry, name) {
  const outfile = join(work, name);
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
  });
  return import(pathToFileURL(outfile).href);
}

const { portalSearchSchema, PORTAL_SEARCH_KEYS, portalSearchMiddlewares } = await bundle(
  "src/lib/portal-search.ts",
  "portal-search.mjs",
);
const {
  OMADA_REDIRECT_FIELD_MAP,
  omadaAuthorizeFields,
  withOmadaRedirectParams,
  normalizeOmadaText,
  normalizeOmadaNumeric,
  withClientIp,
} = await bundle("src/lib/portal-authorize-body.ts", "portal-authorize-body.mjs");
const { createRootRoute, createRoute, createRouter, createMemoryHistory } =
  await import("@tanstack/react-router");

/* Doc 132060's own two redirects, with this platform's three IDs on them
 * (an Omada venue's portal URL is configured on the controller, so it
 * carries both sets). Values chosen to be awkward on purpose: an SSID with
 * a space, `radioId=1`, and `vid=0` -- zero because a falsy-but-real value
 * is where "if (!value)" bugs live. */
const ORG = "08ec098b-4c1e-4a3f-9d21-6f0a5b3e77c1";
const LOC = "ede8381c-1b44-4d0e-a7c9-2e5f8a91b330";
const RTR = "bfc7ed1c-9a02-4b6d-8f13-4c7e2d0a5169";
const IDS = `organizationId=${ORG}&locationId=${LOC}&routerId=${RTR}`;

const CLIENT_MAC = "AA-BB-CC-DD-EE-FF";
const CLIENT_IP = "10.0.5.23";
const AP_MAC = "11-22-33-44-55-66";
const GW_MAC = "99-88-77-66-55-44";
const SSID = "Guest WiFi";
const SITE = "Default";
const T = "1757548800000";
const REDIRECT = "https://www.tp-link.com/";

const EAP_REDIRECT =
  `/portal/welcome?${IDS}` +
  `&clientMac=${CLIENT_MAC}&clientIp=${CLIENT_IP}&apMac=${AP_MAC}` +
  `&ssidName=${encodeURIComponent(SSID)}&t=${T}&radioId=1&site=${SITE}` +
  `&redirectUrl=${encodeURIComponent(REDIRECT)}`;

const GATEWAY_REDIRECT =
  `/portal/welcome?${IDS}` +
  `&clientMac=${CLIENT_MAC}&clientIp=${CLIENT_IP}&gatewayMac=${GW_MAC}` +
  `&vid=0&t=${T}&site=${SITE}` +
  `&redirectUrl=${encodeURIComponent(REDIRECT)}`;

/* The nine this suite owns. `clientIp` is the tenth and belongs to
 * scripts/test-portal-client-ip.mjs. */
const WIRE_NAMES = [
  "clientMac",
  "site",
  "apMac",
  "ssidName",
  "radioId",
  "gatewayMac",
  "vid",
  "t",
  "redirectUrl",
];

const PORTAL_CHILD_PATHS = [
  "/",
  "/welcome",
  "/terms",
  "/verify",
  "/success",
  "/session",
  "/redirect",
];

function makeRouter(initialUrl) {
  const rootRoute = createRootRoute({});
  const portalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/portal",
    validateSearch: portalSearchSchema,
    search: { middlewares: portalSearchMiddlewares },
  });
  portalRoute.addChildren(
    PORTAL_CHILD_PATHS.map((path) => createRoute({ getParentRoute: () => portalRoute, path })),
  );
  return createRouter({
    routeTree: rootRoute.addChildren([portalRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
}

async function loadedRouter(url) {
  const r = makeRouter(url);
  await r.load();
  return r;
}

function searchOf(href) {
  return Object.fromEntries(new URLSearchParams(href.slice(href.indexOf("?") + 1)));
}

/* ------------------------------------------------------------------ *
 * 1. The schema declares all nine. `z.object` strips every key it does
 *    not declare, so this is what decides whether they exist at all.
 * ------------------------------------------------------------------ */
console.log("\n1. `/portal`'s search contract declares every parameter doc 132060 sends");

for (const name of WIRE_NAMES) {
  check(
    `\`${name}\` is on portalSearchShape (and so on PORTAL_SEARCH_KEYS)`,
    Object.keys(portalSearchSchema.shape).includes(name) && PORTAL_SEARCH_KEYS.includes(name),
    "an undeclared key is stripped by the schema before any component sees it",
  );
}
check(
  "TP-Link's own spelling is kept on the query string, not the backend's",
  ["client_mac", "ssid_name", "radio_id", "gateway_mac", "redirect_url"].every(
    (snake) => !Object.keys(portalSearchSchema.shape).includes(snake),
  ),
);

/* ------------------------------------------------------------------ *
 * 2. The real router's real parse. NOT `URLSearchParams` -- that would
 *    hand every value over as a string and hide failure mode 2 entirely.
 * ------------------------------------------------------------------ */
console.log("\n2. a real controller redirect parses, numeric params included");

/* Two steps, in the order the router itself does them: its own parser
 * turns the raw query string into values, then `validateSearch` (our
 * schema) runs over the result. Both are asserted, because the trap lives
 * precisely in the seam between them. */
const eapRouter = await loadedRouter(EAP_REDIRECT);
const eapRaw = eapRouter.state.location.search;
const eap = portalSearchSchema.parse(eapRaw);

check(`clientMac survives as ${CLIENT_MAC}`, eap.clientMac === CLIENT_MAC);
check(`site survives as ${SITE}`, eap.site === SITE);
check(`apMac survives as ${AP_MAC}`, eap.apMac === AP_MAC);
check(`ssidName survives with its space intact ("${SSID}")`, eap.ssidName === SSID);
check(`redirectUrl survives unescaped (${REDIRECT})`, eap.redirectUrl === REDIRECT);
check(
  'the router\'s own parser hands radioId over as the NUMBER 1, not the string "1"',
  eapRaw.radioId === 1 && typeof eapRaw.radioId === "number",
  `got ${typeof eapRaw.radioId} ${JSON.stringify(eapRaw.radioId)} -- TanStack's default ` +
    "search parser JSON.parses raw values",
);
check(
  "...and the schema accepts that number rather than rejecting the redirect",
  eap.radioId === 1,
  `got ${JSON.stringify(eap.radioId)} -- a z.string() here throws a SearchParamError, and the ` +
    "route's errorComponent then swallows all nine parameters, not just this one",
);
check(
  "t arrives as a number too, and the schema accepts it",
  eapRaw.t === Number(T) && eap.t === Number(T),
  `raw ${typeof eapRaw.t} ${JSON.stringify(eapRaw.t)}, validated ${JSON.stringify(eap.t)}`,
);

const gwRouter = await loadedRouter(GATEWAY_REDIRECT);
const gwRaw = gwRouter.state.location.search;
const gw = portalSearchSchema.parse(gwRaw);
check(`gatewayMac survives as ${GW_MAC}`, gw.gatewayMac === GW_MAC);
check(
  "vid=0 survives as the number 0, not dropped as falsy",
  gwRaw.vid === 0 && gw.vid === 0,
  `raw ${JSON.stringify(gwRaw.vid)}, validated ${JSON.stringify(gw.vid)}`,
);

/* A value JSON.parse turns into something that is neither string nor
 * number must cost one key, never the whole redirect. */
const odd = portalSearchSchema.parse(
  (await loadedRouter(`${EAP_REDIRECT}&vid=null`)).state.location.search,
);
check(
  "an unusable `?vid=null` costs that one key instead of the whole redirect",
  odd.vid === undefined && odd.clientMac === CLIENT_MAC && odd.site === SITE,
  JSON.stringify(odd),
);
check(
  "...and it does not throw, which is what would lose the other eight",
  (() => {
    try {
      portalSearchSchema.parse({ organizationId: ORG, t: [], radioId: true, ssidName: null });
      return true;
    } catch {
      return false;
    }
  })(),
);

/* ------------------------------------------------------------------ *
 * 3. Retention. Capturing once is worthless if the first `<Link>` drops
 *    it -- precisely the `mac` incident.
 * ------------------------------------------------------------------ */
console.log("\n3. every parameter survives every internal navigation under /portal");

const EAP_NAMES = ["clientMac", "site", "apMac", "ssidName", "radioId", "t", "redirectUrl"];
const GATEWAY_NAMES = ["clientMac", "site", "gatewayMac", "vid", "t", "redirectUrl"];
check(
  "the EAP router's own initial location still has all seven EAP params",
  EAP_NAMES.every((n) => searchOf(eapRouter.state.location.href)[n] !== undefined),
  eapRouter.state.location.href,
);
check(
  "the gateway router's does too, for all six of its own",
  GATEWAY_NAMES.every((n) => searchOf(gwRouter.state.location.href)[n] !== undefined),
  gwRouter.state.location.href,
);

/* The lossiest caller there is: a whole-object `search` naming only the
 * three IDs. That literal, copied into six files, is what caused the
 * incident. */
const THREE_KEYS = { organizationId: ORG, locationId: LOC, routerId: RTR };
for (const path of PORTAL_CHILD_PATHS) {
  const to = path === "/" ? "/portal" : `/portal${path}`;
  const s = searchOf(eapRouter.buildLocation({ to, search: THREE_KEYS }).href);
  check(
    `${to}, from the lossiest caller, keeps all seven EAP params`,
    s.clientMac === CLIENT_MAC &&
      s.site === SITE &&
      s.apMac === AP_MAC &&
      s.ssidName === SSID &&
      s.radioId === "1" &&
      s.t === T &&
      s.redirectUrl === REDIRECT,
    JSON.stringify(s),
  );
}
for (const path of PORTAL_CHILD_PATHS) {
  const to = path === "/" ? "/portal" : `/portal${path}`;
  const s = searchOf(gwRouter.buildLocation({ to, search: THREE_KEYS }).href);
  check(
    `${to} keeps the gateway shape's own two (gatewayMac, vid=0)`,
    s.gatewayMac === GW_MAC && s.vid === "0",
    JSON.stringify(s),
  );
}

/* A `<Link>` that legitimately sets one of them must still be able to. */
const narrowed = searchOf(
  eapRouter.buildLocation({ to: "/portal/terms", search: { ssidName: "Lobby" } }).href,
);
check(
  "a caller that sets one param narrows what it SETS, not what the URL carries",
  narrowed.ssidName === "Lobby" && narrowed.clientMac === CLIENT_MAC && narrowed.site === SITE,
  JSON.stringify(narrowed),
);

/* None of this may ride along onto an operator screen. */
const offPortal = eapRouter.buildLocation({ to: "/", search: {} }).href;
check(
  "navigating OFF /portal drops every one of them",
  WIRE_NAMES.every((n) => !offPortal.includes(`${n}=`)),
  offPortal,
);

/* ------------------------------------------------------------------ *
 * 4. Vendor separation. Each of these has a similarly-shaped MikroTik
 *    param beside it, and substituting one for the other sends a value
 *    to a controller that never saw it.
 * ------------------------------------------------------------------ */
console.log("\n4. the MikroTik params next door are never substituted");

const mikrotik = portalSearchSchema.parse({
  organizationId: ORG,
  mac: "FA:42:FE:9E:29:03",
  ip: "10.5.50.251",
  dst: "http://example.com/",
});
check(
  "a MikroTik `mac` does not become `clientMac`",
  mikrotik.clientMac === undefined && mikrotik.mac === "FA:42:FE:9E:29:03",
);
check(
  "a MikroTik `dst` does not become `redirectUrl`",
  mikrotik.redirectUrl === undefined && mikrotik.dst === "http://example.com/",
);
check(
  "...and the Omada shape does not leak back the other way",
  (() => {
    const omada = portalSearchSchema.parse({
      organizationId: ORG,
      clientMac: CLIENT_MAC,
      redirectUrl: REDIRECT,
    });
    return omada.mac === undefined && omada.dst === undefined && omada.ip === undefined;
  })(),
);
check(
  "a redirect carrying both vendors' params keeps them apart",
  (() => {
    const both = portalSearchSchema.parse({
      organizationId: ORG,
      mac: "FA:42:FE:9E:29:03",
      clientMac: CLIENT_MAC,
      dst: "http://example.com/",
      redirectUrl: REDIRECT,
    });
    return (
      both.mac === "FA:42:FE:9E:29:03" &&
      both.clientMac === CLIENT_MAC &&
      both.dst === "http://example.com/" &&
      both.redirectUrl === REDIRECT
    );
  })(),
);

/* ------------------------------------------------------------------ *
 * 5. The body. THE NAMES THE BACKEND PARSES, not the names we happen to
 *    build -- see this file's header for why that distinction is the
 *    whole point.
 * ------------------------------------------------------------------ */
console.log("\n5. the authorize body: backend names, top level, one copy each");

/* Read off PortalAuthorizeRequest, field by field. `site`/`t`/`vid` keep
 * their spelling; `ssidName` is `ssid_name`, not `guest_ssid_name`. */
const EXPECTED_MAP = {
  clientMac: "client_mac",
  site: "site",
  apMac: "ap_mac",
  ssidName: "ssid_name",
  radioId: "radio_id",
  gatewayMac: "gateway_mac",
  vid: "vid",
  t: "t",
  redirectUrl: "redirect_url",
};
for (const [wire, body] of Object.entries(EXPECTED_MAP)) {
  check(
    `${wire} -> ${body}`,
    OMADA_REDIRECT_FIELD_MAP[wire] === body,
    `the map says ${JSON.stringify(OMADA_REDIRECT_FIELD_MAP[wire])}`,
  );
}
check(
  "the map has exactly those nine and invents nothing else",
  Object.keys(OMADA_REDIRECT_FIELD_MAP).length === 9,
  Object.keys(OMADA_REDIRECT_FIELD_MAP).join(", "),
);
check(
  "`ssid_name`, not the `guest_ssid_name` the integration row uses",
  OMADA_REDIRECT_FIELD_MAP.ssidName === "ssid_name" &&
    !Object.values(OMADA_REDIRECT_FIELD_MAP).includes("guest_ssid_name"),
);

/* `session_id`/`organization_id`/`location_id`/`provider` are the
 * caller's and belong to an open design question; this module adds the
 * nine and resolves nothing about them. */
const BASE_BODY = {
  session_id: "5c7f5f26-0a1e-4a49-9c1b-3d2f7a1c9e40",
  provider: "omada",
};
const wire = JSON.parse(JSON.stringify(withOmadaRedirectParams(BASE_BODY, eap)));

check(`client_mac is top level and is ${CLIENT_MAC}`, wire.client_mac === CLIENT_MAC);
check(`site is top level and is ${SITE}`, wire.site === SITE);
check(`ap_mac is top level and is ${AP_MAC}`, wire.ap_mac === AP_MAC);
check(`ssid_name is top level and is "${SSID}"`, wire.ssid_name === SSID);
check(`redirect_url is top level and is ${REDIRECT}`, wire.redirect_url === REDIRECT);
check(
  'the serialized body literally contains "ssid_name":"Guest WiFi"',
  JSON.stringify(wire).includes(`"ssid_name":"${SSID}"`),
);
check(
  "every one of the nine body keys is an OWN key of the top level",
  Object.values(OMADA_REDIRECT_FIELD_MAP).every((k) =>
    Object.prototype.hasOwnProperty.call(wire, k),
  ),
  `top-level keys: ${Object.keys(wire).join(", ")}`,
);
check(
  "the caller's own fields are untouched and the base body is not mutated",
  wire.session_id === BASE_BODY.session_id &&
    wire.provider === "omada" &&
    !Object.prototype.hasOwnProperty.call(BASE_BODY, "client_mac"),
);
check(
  "nothing about the venue's identity is invented",
  !Object.prototype.hasOwnProperty.call(wire, "organization_id") &&
    !Object.prototype.hasOwnProperty.call(wire, "location_id") &&
    !Object.prototype.hasOwnProperty.call(wire, "router_id"),
  `top-level keys: ${Object.keys(wire).join(", ")}`,
);

/* No second copy anywhere. A camelCase key, or one nested under
 * `credentials`/`context`/`client`, is dropped by pydantic's
 * `extra="ignore"` in total silence -- 201, nothing carried. */
function keyPaths(value, path = "$") {
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => [
    `${path}.${k}`,
    ...keyPaths(v, `${path}.${k}`),
  ]);
}
const paths = keyPaths(wire);
for (const [camel, snake] of Object.entries(EXPECTED_MAP)) {
  const hits = paths.filter((p) => p.endsWith(`.${camel}`) || p.endsWith(`.${snake}`));
  check(
    `exactly one key for ${snake}, and it is at the top level`,
    hits.length === 1 && hits[0] === `$.${snake}`,
    `found: ${hits.join(", ") || "none"}`,
  );
}
check(
  "no nesting at all: every key on the body is a top-level scalar-or-null",
  paths.every((p) => p.split(".").length === 2),
  paths.filter((p) => p.split(".").length > 2).join(", "),
);

/* Composes with the clientIp module that shipped first: between them they
 * produce every controller-supplied field of PortalAuthorizeRequest. */
const bothModules = JSON.parse(
  JSON.stringify(withClientIp(withOmadaRedirectParams(BASE_BODY, eap), eap.clientIp)),
);
check(
  "withOmadaRedirectParams composes with withClientIp without either clobbering the other",
  bothModules.client_ip === CLIENT_IP && bothModules.client_mac === CLIENT_MAC,
  JSON.stringify(bothModules),
);

/* ------------------------------------------------------------------ *
 * 6. Types. Doc 132060 writes every body value as a string; the backend
 *    takes `radio_id`/`vid` as int and `t` as str. That discrepancy is
 *    tracked elsewhere -- what is pinned here is that each value goes out
 *    in the form ITS OWN backend field takes today.
 * ------------------------------------------------------------------ */
console.log("\n6. each value goes out in the form its backend field takes");

check(
  "radio_id is a NUMBER (backend: int | None, ge=0 le=16)",
  wire.radio_id === 1 && typeof wire.radio_id === "number",
  `${typeof wire.radio_id} ${JSON.stringify(wire.radio_id)}`,
);
check(
  "t is a STRING (backend: str | None), restored from the number TanStack made of it",
  wire.t === T && typeof wire.t === "string",
  `${typeof wire.t} ${JSON.stringify(wire.t)}`,
);
const gwWire = JSON.parse(JSON.stringify(withOmadaRedirectParams(BASE_BODY, gw)));
check(
  'vid=0 is the NUMBER 0 on the wire, not null and not the string "0"',
  gwWire.vid === 0 && typeof gwWire.vid === "number",
  `${typeof gwWire.vid} ${JSON.stringify(gwWire.vid)}`,
);
check('a string-typed "1" still goes out as the number 1', normalizeOmadaNumeric("1") === 1);
check("a number-typed radioId stays a number", normalizeOmadaNumeric(2) === 2);
check(
  "a non-integer value is passed through verbatim for the backend to refuse, not nulled",
  normalizeOmadaNumeric("radio-1") === "radio-1",
  "nulling it would authorize successfully while omitting a parameter doc 132060 requires",
);
check(
  "an out-of-range vid is NOT clamped into the backend's range",
  normalizeOmadaNumeric(9999) === 9999,
  "bounds are the backend's to enforce; a quietly-moved VLAN id is a wrong VLAN id",
);
check(
  "a digit string too long to survive Number() goes through as text",
  normalizeOmadaNumeric("123456789012345678901") === "123456789012345678901",
);
check(
  "an SSID or site spelled with digits is restored to text",
  normalizeOmadaText(5) === "5" && normalizeOmadaText(0) === "0",
);
check("present-but-empty is null, not an empty string", normalizeOmadaText("") === null);
check("whitespace-only is null", normalizeOmadaText("   ") === null);
check(
  "surrounding whitespace is trimmed off a real value",
  normalizeOmadaText(" Default ") === SITE,
);
check(
  "an unrecognisable value is still passed through, not silently dropped",
  normalizeOmadaText("not-a-mac") === "not-a-mac",
);

/* ------------------------------------------------------------------ *
 * 7. Absence. Captured, never derived -- including from the OTHER
 *    redirect shape, which is the most plausible wrong answer available.
 * ------------------------------------------------------------------ */
console.log("\n7. absent means null -- never the other shape, never a default");

const fromEap = omadaAuthorizeFields(eap);
check(
  "an EAP redirect leaves gateway_mac null (it genuinely has no gateway)",
  fromEap.gateway_mac === null,
);
check("...and vid null", fromEap.vid === null);
const fromGw = omadaAuthorizeFields(gw);
check("a gateway redirect leaves ap_mac null", fromGw.ap_mac === null);
check("...and ssid_name null", fromGw.ssid_name === null);
check("...and radio_id null", fromGw.radio_id === null);
check(
  "neither shape is filled in from the other (no ap_mac <- gateway_mac)",
  fromGw.ap_mac !== GW_MAC && fromEap.gateway_mac !== AP_MAC,
);
check(
  "every key is present even when null, so 'not told' is stated rather than silent",
  Object.values(OMADA_REDIRECT_FIELD_MAP).every((k) =>
    Object.prototype.hasOwnProperty.call(fromEap, k),
  ),
);

/* A body full of plausible substitutes is the exact temptation the rule
 * exists to refuse. An SSID taken from our own integration row, a site
 * taken from the same, and a timestamp taken from the clock are all
 * well-formed values that describe something the controller never said. */
const tempting = omadaAuthorizeFields({});
check(
  "an empty capture derives NOTHING -- all nine null",
  Object.values(tempting).every((v) => v === null),
  JSON.stringify(tempting),
);
const temptingBody = JSON.parse(
  JSON.stringify(
    withOmadaRedirectParams(
      {
        ...BASE_BODY,
        guest_ssid_name: "Configured SSID",
        integration_site: "Site A",
        now: Date.now(),
        device_mac: "FA:42:FE:9E:29:03",
      },
      {},
    ),
  ),
);
check(
  "no fallback to the integration's own configured SSID",
  temptingBody.ssid_name === null,
  `derived ${JSON.stringify(temptingBody.ssid_name)} from a neighbouring field`,
);
check("no fallback to a neighbouring site", temptingBody.site === null);
check("no fallback to the clock for `t`", temptingBody.t === null);
check("no fallback to the MikroTik device_mac for client_mac", temptingBody.client_mac === null);

/* ------------------------------------------------------------------ *
 * 8. The wiring. Sections 1-7 assemble their own route tree, so they
 *    cannot see the real route file failing to read the values.
 * ------------------------------------------------------------------ */
console.log("\n8. the real /portal route reads them and hands them down");

const routeSrc = readFileSync(join(ROOT, "src/routes/portal.tsx"), "utf8");
const destructured = routeSrc.slice(0, routeSrc.indexOf("} = search;"));
for (const name of WIRE_NAMES) {
  check(
    `portal.tsx destructures ${name} out of the VALIDATED search`,
    new RegExp(`\\n\\s+${name},`).test(destructured),
    "reading it off `window.location` instead would bypass the schema and the middleware",
  );
}
check(
  "portal.tsx passes them to PortalRuntimeProvider as one `omadaRedirect` prop",
  /omadaRedirect=\{omadaRedirect\}/.test(routeSrc),
);
check(
  "...memoized, so the provider's context value is not invalidated every render",
  /const omadaRedirect = useMemo\(/.test(routeSrc),
);
check(
  "...and the MikroTik props still carry the MikroTik values",
  /deviceMac=\{mac\}/.test(routeSrc) &&
    /deviceIp=\{ip\}/.test(routeSrc) &&
    /destinationUrl=\{dst\}/.test(routeSrc) &&
    !/deviceMac=\{clientMac\}/.test(routeSrc) &&
    !/destinationUrl=\{redirectUrl\}/.test(routeSrc),
);

const ctxSrc = readFileSync(join(ROOT, "src/context/PortalRuntimeContext.tsx"), "utf8");
check(
  "PortalRuntimeContext declares omadaRedirect on its props and its state",
  (ctxSrc.match(/^\s{2}omadaRedirect\?: OmadaRedirectCapture;$/gm) ?? []).length === 2,
);
check(
  "...and puts it on the context value",
  (ctxSrc.match(/^\s{6}omadaRedirect,$/gm) ?? []).length === 2,
  "one for the value object, one for the memo dependency list",
);
check(
  "...and still has its own `t` (the i18n binding these nine must not shadow)",
  /^\s{2}t: \(key: string\) => string;$/m.test(ctxSrc),
  "the collision is why these nine are grouped where clientIp is flat",
);

/* ------------------------------------------------------------------ *
 * The other end of the wire. Informational only: the backend lives in a
 * separate repo that is not present in CI. This prints what it finds and
 * never fails the suite on it.
 * ------------------------------------------------------------------ */
const BACKEND_SCHEMA =
  "/Users/shresth/cloud-guest-repo/backend/app/domains/network_integration/schemas.py";
console.log("\n   note: the backend end of this wire");
if (existsSync(BACKEND_SCHEMA)) {
  const py = readFileSync(BACKEND_SCHEMA, "utf8");
  const req = py.slice(py.indexOf("class PortalAuthorizeRequest"));
  const decl = req.slice(0, req.indexOf("\n\n\nclass "));
  const missing = Object.values(OMADA_REDIRECT_FIELD_MAP).filter(
    (f) => !new RegExp(`^\\s{4}${f}:`, "m").test(decl),
  );
  console.log(
    missing.length === 0
      ? "   PortalAuthorizeRequest declares all nine -- both ends agree."
      : `   PortalAuthorizeRequest does NOT declare: ${missing.join(", ")}. Until it does, ` +
          'pydantic\'s extra="ignore" drops those fields silently (2xx, nothing carried).',
  );
  console.log(
    /^\s{4}client_ip:/m.test(decl)
      ? "   ...and client_ip too."
      : "   client_ip is still absent there -- the backend half of CR-004, owned elsewhere.",
  );
} else {
  console.log("   backend checkout not present; skipped.");
}

rmSync(work, { recursive: true, force: true });

console.log("");
if (failures) {
  console.log(`portal Omada params: ${failures} FAILED`);
  process.exit(1);
}
console.log("portal Omada params: all checks passed");
