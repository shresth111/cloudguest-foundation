/**
 * CR-004: the guest's IP address, as an Omada controller reported it, must
 * reach the captive-portal authorize call as a top-level `client_ip`.
 *
 * Run: node scripts/test-portal-client-ip.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * TP-Link doc 132060 (*External Portal Server, Omada Controller v6.2.10 or
 * Above*) says the authorization body "must contain" `clientIp`, in both
 * the EAP/AP shape and the gateway shape, and its redirect hands the value
 * to the guest's browser to be carried back:
 *
 *   http(s)://PORTAL?clientMac=CLIENT_MAC&clientIp=CLIENT_IP&apMac=AP_MAC
 *                   &ssidName=SSID_NAME&t=TIME&radioId=RADIO_ID&site=SITE
 *                   &redirectUrl=LANDING_PAGE
 *
 * Doc 13080 (v5.0.15-v6.2.0) does not contain the string `clientIp`
 * anywhere, so this is a real new-firmware requirement, not an omission in
 * the old doc. On current shipping firmware an authorize call without it is
 * missing a documented mandatory field -- i.e. the guest may get no
 * internet at all, at a venue where everything else looks healthy.
 *
 * TWO FAILURE MODES, BOTH SILENT, BOTH ASSERTED HERE
 * -------------------------------------------------
 * 1. DROPPED IN TRANSIT. A param that is not on `portalSearchShape` is
 *    stripped by the schema on the very first parse, and then again by
 *    `retainSearchParams` on the first internal `<Link>` -- which is
 *    exactly how a real production sign-in lost `mac` (see
 *    scripts/test-portal-search-retention.mjs). Sections 1 and 2 drive the
 *    REAL schema and the REAL middleware.
 *
 * 2. SENT WHERE NOBODY READS IT. The one shipped cross-repo bug in this
 *    integration was this frontend nesting controller credentials under a
 *    `credentials: {...}` key the backend never read; pydantic's default
 *    `extra="ignore"` dropped it and returned 201 with nothing stored. The
 *    contract test passed throughout, because it asserted the same wrong
 *    place the code wrote to. Section 4 therefore asserts the shape the
 *    BACKEND parses -- `PortalAuthorizeRequest.client_ip`, top level,
 *    snake_case -- and that no nested or camelCased copy exists anywhere in
 *    the body.
 *
 * Section 5 pins the rule that the value is CAPTURED, never derived: with
 * no `clientIp` on the redirect the wire carries `null`, even when the body
 * is full of other addresses that a "helpful" fallback could reach for.
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
const work = join(ROOT, "node_modules", ".cache", "portal-client-ip");
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
const { withClientIp, normalizeClientIp, PORTAL_AUTHORIZE_CLIENT_IP_FIELD } = await bundle(
  "src/lib/portal-authorize-body.ts",
  "portal-authorize-body.mjs",
);
const { createRootRoute, createRoute, createRouter, createMemoryHistory } =
  await import("@tanstack/react-router");

/* The redirect, in doc 132060's own parameter order, with this platform's
 * own three IDs on it (an Omada venue's portal URL is configured on the
 * controller, so it carries both sets). */
const ORG = "08ec098b-4c1e-4a3f-9d21-6f0a5b3e77c1";
const LOC = "ede8381c-1b44-4d0e-a7c9-2e5f8a91b330";
const RTR = "bfc7ed1c-9a02-4b6d-8f13-4c7e2d0a5169";
const CLIENT_MAC = "AA-BB-CC-DD-EE-FF";
const CLIENT_IP = "10.0.5.23";
const AP_MAC = "11-22-33-44-55-66";
const SSID = "Guest WiFi";
const REDIRECT = "https://www.tp-link.com/";

const OMADA_REDIRECT =
  `/portal/welcome?organizationId=${ORG}&locationId=${LOC}&routerId=${RTR}` +
  `&clientMac=${CLIENT_MAC}&clientIp=${CLIENT_IP}&apMac=${AP_MAC}` +
  `&ssidName=${encodeURIComponent(SSID)}&t=1757548800000&radioId=1&site=Default` +
  `&redirectUrl=${encodeURIComponent(REDIRECT)}`;

function searchOf(url) {
  return Object.fromEntries(new URLSearchParams(url.slice(url.indexOf("?") + 1)));
}

/* ------------------------------------------------------------------ *
 * 1. The capture. The schema is what decides whether the value exists
 *    at all: `z.object` strips every key it does not declare.
 * ------------------------------------------------------------------ */
console.log("\n1. `/portal` captures `clientIp` off the controller's redirect");

const parsed = portalSearchSchema.parse(searchOf(OMADA_REDIRECT));

check(
  "the redirect fixture really carries clientIp (before we parse anything)",
  searchOf(OMADA_REDIRECT).clientIp === CLIENT_IP,
);
check(
  `the parsed search carries clientIp = ${CLIENT_IP}`,
  parsed.clientIp === CLIENT_IP,
  `got ${JSON.stringify(parsed.clientIp)} -- an undeclared key is stripped by the schema, ` +
    "so the authorize call would post client_ip: null at a venue that told us the address",
);
check("the schema declares `clientIp`", PORTAL_SEARCH_KEYS.includes("clientIp"));
check(
  "TP-Link's own spelling is preserved (not `client_ip`/`clientip` on the query string)",
  Object.keys(portalSearchSchema.shape).includes("clientIp") &&
    !Object.keys(portalSearchSchema.shape).includes("client_ip"),
);

/* The MikroTik `ip` param is a different vendor's value for a similar
 * thing. Neither may become the other: `ip` goes to our own login calls as
 * `ip_address`, `clientIp` goes to the controller's authorize call. */
const mikrotikOnly = portalSearchSchema.parse({ organizationId: ORG, ip: "10.5.50.251" });
check(
  "a MikroTik redirect's `ip` does not become `clientIp`",
  mikrotikOnly.clientIp === undefined && mikrotikOnly.ip === "10.5.50.251",
);
const omadaOnly = portalSearchSchema.parse({ organizationId: ORG, clientIp: CLIENT_IP });
check(
  "an Omada redirect's `clientIp` does not become `ip`",
  omadaOnly.ip === undefined && omadaOnly.clientIp === CLIENT_IP,
);
check(
  "a redirect with neither parses cleanly, carrying neither",
  (() => {
    const bare = portalSearchSchema.parse({ organizationId: ORG });
    return bare.clientIp === undefined && bare.ip === undefined;
  })(),
);

/* ------------------------------------------------------------------ *
 * 2. Retention. Capturing it once is worthless if the first `<Link>`
 *    drops it -- that is precisely the `mac` incident.
 * ------------------------------------------------------------------ */
console.log("\n2. it survives every internal navigation under /portal");

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

const router = makeRouter(OMADA_REDIRECT);
await router.load();
check(
  "the router's own initial location still has it",
  searchOf(router.state.location.href).clientIp === CLIENT_IP,
  router.state.location.href,
);

const THREE_KEYS = { organizationId: ORG, locationId: LOC, routerId: RTR };
for (const path of PORTAL_CHILD_PATHS) {
  const to = path === "/" ? "/portal" : `/portal${path}`;
  const href = router.buildLocation({ to, search: THREE_KEYS }).href;
  check(`${to}, from the lossiest caller, keeps clientIp`, searchOf(href).clientIp === CLIENT_IP);
}

/* The guest's address must not ride along onto an operator screen. */
const offPortal = router.buildLocation({ to: "/", search: {} }).href;
check("navigating OFF /portal drops it", !offPortal.includes("clientIp"), offPortal);

/* ------------------------------------------------------------------ *
 * 3. The wiring. Sections 1-2 assemble their own route tree, so they
 *    cannot see the real route file failing to read the value.
 * ------------------------------------------------------------------ */
console.log("\n3. the real /portal route reads it and hands it down");

const portalRouteSrc = readFileSync(join(ROOT, "src/routes/portal.tsx"), "utf8");
check(
  "portal.tsx destructures clientIp out of the validated search",
  /clientIp,/.test(portalRouteSrc.slice(0, portalRouteSrc.indexOf("} = search;"))),
  "reading it off `window.location` instead would bypass the schema and the middleware",
);
check(
  // `effectiveClientIp`, not `clientIp`, since the storage mirror landed:
  // the URL's value still wins, and the mirror only fills a gap the URL
  // left (see `loadPersistedOmadaContext` in PortalRuntimeContext). Both
  // spellings are accepted so this asserts the WIRING -- that the captured
  // address reaches the provider under its own name -- rather than pinning
  // one variable name. The rule that actually matters is the next check.
  "portal.tsx passes it to PortalRuntimeProvider as its own prop",
  /clientIp=\{(clientIp|effectiveClientIp)\}/.test(portalRouteSrc),
);
check(
  "...and the URL still wins over the mirror",
  !/clientIp = persistedOmada/.test(portalRouteSrc) &&
    (!/effectiveClientIp/.test(portalRouteSrc) ||
      /const effectiveClientIp = clientIp \?\? persistedOmada/.test(portalRouteSrc)),
  "a mirror that could override a live redirect would send the controller this " +
    "device's PREVIOUS address",
);
check(
  "...and does NOT feed it into deviceIp (the MikroTik value)",
  /deviceIp=\{ip\}/.test(portalRouteSrc) && !/deviceIp=\{clientIp\}/.test(portalRouteSrc),
);

const ctxSrc = readFileSync(join(ROOT, "src/context/PortalRuntimeContext.tsx"), "utf8");
check(
  // At least two: one on `PortalRuntimeState`, one on the provider's
  // `Props`. It was exactly two until the Omada storage mirror added a
  // third on `PersistedOmadaContext` -- which is the same value being
  // carried through a third channel, not a fourth concept, so the floor is
  // asserted rather than the exact count.
  "PortalRuntimeContext declares clientIp on its props and its state",
  (ctxSrc.match(/^\s{2}clientIp\?: string;$/gm) ?? []).length >= 2,
);
check(
  "...and puts it on the context value",
  (ctxSrc.match(/^\s{6}clientIp,$/gm) ?? []).length === 2,
  "one for the value object, one for the memo dependency list",
);

/* ------------------------------------------------------------------ *
 * 4. The body. THE SHAPE THE BACKEND PARSES, not the shape we happen
 *    to build -- see this file's header for why that distinction is
 *    the whole point.
 * ------------------------------------------------------------------ */
console.log("\n4. the authorize body: top level, snake_case, one copy");

/* Everything except `client_ip` here belongs to CONTRACT §3 and to
 * whoever builds the authorize call; this module adds exactly one field
 * and resolves nothing about the others. */
const BASE_BODY = {
  session_id: "5c7f5f26-0a1e-4a49-9c1b-3d2f7a1c9e40",
  organization_id: ORG,
  location_id: LOC,
  provider: "omada",
  client_mac: CLIENT_MAC,
  site: "Default",
  ap_mac: AP_MAC,
  ssid_name: SSID,
  radio_id: 1,
  gateway_mac: null,
  vid: null,
  t: "1757548800000",
  redirect_url: REDIRECT,
};

const body = withClientIp(BASE_BODY, parsed.clientIp);
const onTheWire = JSON.parse(JSON.stringify(body));

check(
  "`client_ip` is an own key of the body's top level",
  Object.prototype.hasOwnProperty.call(onTheWire, "client_ip"),
  `top-level keys: ${Object.keys(onTheWire).join(", ")}`,
);
check(
  `...and its value is the address the controller sent (${CLIENT_IP})`,
  onTheWire.client_ip === CLIENT_IP,
  JSON.stringify(onTheWire.client_ip),
);
check(
  'the serialized body literally contains "client_ip":"10.0.5.23"',
  JSON.stringify(onTheWire).includes(`"client_ip":"${CLIENT_IP}"`),
);
check(
  "the module names the field exactly once, as a constant",
  PORTAL_AUTHORIZE_CLIENT_IP_FIELD === "client_ip",
);

/* No second copy anywhere: a camelCase key, or one nested under
 * `credentials`/`context`/`client`, is dropped by pydantic's
 * `extra="ignore"` in total silence -- 201, nothing carried. */
function ipKeyPaths(value, path = "$") {
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const here = `${path}.${k}`;
    const isIpKey = /^client_?ip$/i.test(k);
    return [...(isIpKey ? [here] : []), ...ipKeyPaths(v, here)];
  });
}
const paths = ipKeyPaths(onTheWire);
check(
  "exactly one client-IP key exists in the whole body, at the top level",
  paths.length === 1 && paths[0] === "$.client_ip",
  `found: ${paths.join(", ") || "none"}`,
);
check(
  "no camelCase `clientIp` key on the body (the backend would ignore it silently)",
  !Object.prototype.hasOwnProperty.call(onTheWire, "clientIp"),
);
check(
  "the caller's own fields are untouched",
  Object.keys(BASE_BODY).every(
    (k) => JSON.stringify(onTheWire[k]) === JSON.stringify(BASE_BODY[k]),
  ),
);
check(
  "the base body the caller passed in is not mutated",
  !Object.prototype.hasOwnProperty.call(BASE_BODY, "client_ip"),
);

/* ------------------------------------------------------------------ *
 * 5. Absence. Captured, never derived: the absent case is `null` on the
 *    wire, not a value scavenged from somewhere plausible.
 * ------------------------------------------------------------------ */
console.log("\n5. absent means null -- never a guess");

const noIpSearch = portalSearchSchema.parse(
  searchOf(OMADA_REDIRECT.replace(`&clientIp=${CLIENT_IP}`, "")),
);
check("a pre-v6.2.10 redirect parses fine with no clientIp", noIpSearch.clientIp === undefined);

const absent = JSON.parse(JSON.stringify(withClientIp(BASE_BODY, noIpSearch.clientIp)));
check(
  "the key is still present, so 'not told' is stated rather than silent",
  Object.prototype.hasOwnProperty.call(absent, "client_ip"),
);
check("...and its value is null", absent.client_ip === null);
check("...and nothing else on the body changed", ipKeyPaths(absent).join() === "$.client_ip");

/* A body full of other addresses is the exact temptation this rule
 * exists to refuse: the portal's own peer address is the reverse proxy's,
 * and a wrong client IP authorizes the wrong device or nobody. */
const tempting = JSON.parse(
  JSON.stringify(
    withClientIp(
      {
        ...BASE_BODY,
        ip_address: "172.18.0.4",
        device_ip: "10.5.50.251",
        source_ip: "203.0.113.9",
      },
      undefined,
    ),
  ),
);
check(
  "no fallback to any other address on the body",
  tempting.client_ip === null,
  `derived ${JSON.stringify(tempting.client_ip)} from a neighbouring field`,
);

check("`?clientIp=` (present, empty) is null, not an empty string", normalizeClientIp("") === null);
check("whitespace-only is null", normalizeClientIp("   ") === null);
check(
  "surrounding whitespace is trimmed off a real value",
  normalizeClientIp(" 10.0.5.23 ") === CLIENT_IP,
);
check(
  "null/undefined are null",
  normalizeClientIp(null) === null && normalizeClientIp(undefined) === null,
);
check(
  "an IPv6 address survives verbatim (the backend's column is 45 chars for this reason)",
  normalizeClientIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334") ===
    "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
);
check(
  "an unrecognisable value is still passed through, not silently dropped",
  normalizeClientIp("not-an-ip") === "not-an-ip",
  "dropping what we do not recognise would invent an absence the controller never reported",
);

/* ------------------------------------------------------------------ *
 * The other end of the wire. Informational only: the backend lives in a
 * separate repo that is not present in CI, and `client_ip` is landing
 * there under its own change. This prints what it finds and never fails
 * the suite on it.
 * ------------------------------------------------------------------ */
const BACKEND_SCHEMA =
  "/Users/shresth/cloud-guest-repo/backend/app/domains/network_integration/schemas.py";
console.log("\n   note: the backend end of this wire");
if (existsSync(BACKEND_SCHEMA)) {
  const py = readFileSync(BACKEND_SCHEMA, "utf8");
  const req = py.slice(py.indexOf("class PortalAuthorizeRequest"));
  const decl = req.slice(0, req.indexOf("\n\n\nclass "));
  console.log(
    /^\s{4}client_ip:/m.test(decl)
      ? "   PortalAuthorizeRequest declares `client_ip` -- both ends agree."
      : "   PortalAuthorizeRequest does NOT declare `client_ip` yet. Until it does, " +
          'pydantic\'s extra="ignore" drops this field silently (201, nothing carried). ' +
          "That is the backend half of CR-004 and is owned by another engineer.",
  );
} else {
  console.log("   backend checkout not present; skipped.");
}

rmSync(work, { recursive: true, force: true });

console.log("");
if (failures) {
  console.log(`portal clientIp capture: ${failures} FAILED`);
  process.exit(1);
}
console.log("portal clientIp capture: all checks passed");
