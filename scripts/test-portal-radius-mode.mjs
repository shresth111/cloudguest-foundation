/**
 * Omada RADIUS mode (`authType 2`) -- the authorize contract, the failure
 * vocabulary, and the wiring that decides when either is used.
 *
 * Run: `node scripts/test-portal-radius-mode.mjs`
 *
 * ## THE THING THIS SUITE USED TO GUARD, AND WHY IT NO LONGER DOES
 *
 * It used to assert that the guest's browser did a top-level form POST to
 * the controller's own `POST /portal/radius/browserauth`, and that the POST
 * was never a `fetch`. That contract is gone. Measured on a real Android
 * handset (2026-09-18): the browser REFUSES that navigation, because the
 * endpoint sits on the controller's own portal port behind a self-signed
 * `CN=localhost` certificate, and every venue's controller has its own.
 * Measured the same day: the identical call made server-side authorizes the
 * client. So the backend makes it, and this page asks the backend.
 *
 * The three silent regressions the suite was written for are still real and
 * still pinned below, two of them unchanged and one rewritten:
 *
 *   1. the page starts INFERRING the contract from which parameters
 *      arrived instead of the stored `portalMode`, so a firmware revision
 *      that adds or drops one moves a whole venue onto the wrong path --
 *      with the portal claiming success;
 *   2. the guest's browser starts talking to the controller again, in any
 *      form -- a form POST, a `fetch`, an image beacon. The whole point of
 *      this change is that it cannot work on the handsets guests own;
 *   3. THE FINAL HOP BECOMES A `fetch` OR A CLIENT-SIDE `navigate`. This is
 *      the one that has actually shipped, twice, under two different
 *      vendors: the hop to the guest's destination must be a real top-level
 *      document load, or iOS's Captive Network Assistant hangs forever
 *      (2026-08-18) and the page asserts "you're online" without ever
 *      asking the network. The authorize call is a `fetch`; the hop after
 *      it is not, and the two must not be confused.
 *
 * Plus the one this contract never had at all, and which is the second half
 * of the change: a FAILURE the guest can read. Before it, a rejected login
 * was a raw JSON blob the browser had already navigated to, or a silent
 * bounce back to the sign-in card carrying `?errorHint=...` that NOTHING in
 * this repo read -- zero grep hits.
 *
 * Behaviour is checked against the REAL `src/lib/portal-radius-authorize.ts`
 * (bundled, no stubs); the wiring is checked at source level, like
 * test-portal-post-login.mjs, because the render path needs framework stubs
 * that would test nothing real.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "portal-radius-mode-"));

await build({
  entryPoints: [join(SRC, "lib/portal-radius-authorize.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: { "@": SRC },
});

const {
  buildPortalRadiusAuthorizeBody,
  PORTAL_RADIUS_AUTHORIZE_PATH,
  radiusErrorHintFromSearch,
  radiusFailureFromError,
  radiusFailureIsRetryable,
  radiusFailureMessageKey,
  radiusFailureOf,
} = await import(join(work, "bundle.mjs"));

// Comments are stripped before any "this string must not appear" check.
// Several of these files name the retired contract, `redirect_url` and
// `error_code` in their docstrings ON PURPOSE -- the whole subject of those
// docstrings is why each is not used. What must not come back is a
// REACHABLE reference, which is code.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

// A real `authType 2` redirect, captured verbatim off the live controller
// (Omada Software Controller 5.15.24.19, 2026-09-11). Note what is NOT in
// it: no `site`, no `t`, no `redirectUrl`.
const REDIRECT = {
  target: "13.126.39.79",
  targetPort: 8843,
  scheme: "https",
  originUrl: "http://example.com/some/page?a=1",
  clientMac: "AA-BB-CC-DD-EE-20",
  clientIp: "103.84.202.195",
  apMac: "B8-FB-B3-5D-64-3E",
  gatewayMac: "",
  ssidName: "WyfyRadTest",
  vid: "",
  radioId: 1,
};
const IDENTITY = {
  session_id: "11111111-1111-1111-1111-111111111111",
  organization_id: "22222222-2222-2222-2222-222222222222",
  location_id: "33333333-3333-3333-3333-333333333333",
  provider: "omada",
};

console.log("omada radius mode -- the authorize body");

const body = buildPortalRadiusAuthorizeBody(IDENTITY, REDIRECT, undefined);
check("a real redirect builds a body", !("refused" in body));

// THE WIRE NAMES. Asserted as literals, not derived from the object, for
// the reason portal-authorize-body.ts's own docstring gives: the backend
// takes pydantic's default `extra="ignore"`, so a misspelled or nested key
// is dropped in silence and still answers 2xx. That is the one shipped
// cross-repo bug this integration has already had.
const EXPECTED_KEYS = [
  "session_id",
  "organization_id",
  "location_id",
  "provider",
  "client_mac",
  "client_ip",
  "ap_mac",
  "gateway_mac",
  "ssid_name",
  "radio_id",
  "vid",
  "origin_url",
  "target",
  "target_port",
  "scheme",
];
for (const key of EXPECTED_KEYS) {
  check(`the body spells \`${key}\` at the top level`, Object.hasOwn(body, key));
}
check(
  "and carries nothing else",
  Object.keys(body).every((k) => EXPECTED_KEYS.includes(k)),
  JSON.stringify(Object.keys(body)),
);
check(
  "nothing is nested -- every value is a scalar or null",
  Object.values(body).every((v) => v === null || typeof v !== "object"),
);
check(
  "NO CREDENTIAL LEAVES THE PAGE -- no username, no password, no identifier",
  !("username" in body) && !("password" in body) && !("identifier" in body),
  "the browser-POST contract sent the guest's own verified phone/email; this one sends a session id",
);
check(
  "the endpoint is this module's own, not the controller's",
  {
    ok: PORTAL_RADIUS_AUTHORIZE_PATH === "/portal/radius-authorize",
  }.ok,
);
check(
  "and is never the controller's browserauth path",
  !PORTAL_RADIUS_AUTHORIZE_PATH.includes("browserauth") &&
    !PORTAL_RADIUS_AUTHORIZE_PATH.includes("/portal/radius/auth"),
);

// --- captured, never derived -----------------------------------------
check(
  "every controller value travels exactly as it arrived",
  body.client_mac === "AA-BB-CC-DD-EE-20" &&
    body.ap_mac === "B8-FB-B3-5D-64-3E" &&
    body.ssid_name === "WyfyRadTest" &&
    body.client_ip === "103.84.202.195" &&
    body.target === "13.126.39.79",
);
check(
  "origin_url is the CONTROLLER's captured value, not our own landing page",
  body.origin_url === "http://example.com/some/page?a=1",
  "the browser is no longer the thing the controller redirects, so the honest value is the captured one",
);
check(
  "a numeric parameter goes out as the number its backend field takes",
  body.radio_id === 1 && body.target_port === 8843,
);
check(
  "an empty parameter is null, never an invented empty string",
  body.gateway_mac === null && body.vid === null,
);
const sparse = buildPortalRadiusAuthorizeBody(IDENTITY, {}, undefined);
check(
  "an absent parameter is present as null, so 'not told' is a statement on the wire",
  Object.hasOwn(sparse, "client_mac") && sparse.client_mac === null,
);
check(
  "the flat runtime clientIp is used only when the redirect carried none",
  buildPortalRadiusAuthorizeBody(IDENTITY, {}, "10.0.5.23").client_ip === "10.0.5.23" &&
    buildPortalRadiusAuthorizeBody(IDENTITY, REDIRECT, "10.0.5.23").client_ip === "103.84.202.195",
);

// --- refusals ---------------------------------------------------------
//
// `target`/`targetPort`/`scheme` arrive on the query string of a page
// anyone can link to. A PRESENT one that is not what it claims to be is
// refused rather than repaired; an ABSENT one is not a refusal any more,
// because the backend reaches its controller over the integration row's
// stored base URL, which no redirect can supply or invalidate.
check(
  "an absent target is no longer a refusal -- the backend has its own address",
  !("refused" in buildPortalRadiusAuthorizeBody(IDENTITY, { clientMac: "AA-BB" }, undefined)),
);
check(
  "a non-http(s) scheme is refused",
  buildPortalRadiusAuthorizeBody(IDENTITY, { ...REDIRECT, scheme: "javascript" }, undefined)
    .refused === "bad-scheme",
);
for (const hostile of [
  "13.126.39.79/evil.example.com",
  "evil.example.com@13.126.39.79",
  "13.126.39.79?x=1",
  "13.126.39.79#f",
]) {
  check(
    `a target that is not a bare host is refused (${hostile})`,
    buildPortalRadiusAuthorizeBody(IDENTITY, { ...REDIRECT, target: hostile }, undefined)
      .refused === "bad-target",
  );
}
for (const port of ["0", "70000", "84 43", "https"]) {
  check(
    `a port that is not a port is refused (${port})`,
    buildPortalRadiusAuthorizeBody(IDENTITY, { ...REDIRECT, targetPort: port }, undefined)
      .refused === "bad-target",
  );
}

// --- the failure vocabulary -------------------------------------------
console.log("omada radius mode -- the failure the guest can read");

// THE BACKEND'S FIVE, EXACTLY. `constants.RadiusPortalFailure` in
// cloud-guest#268 is a closed enum, so this is a mapping this repo must
// MATCH rather than merely accept. Both halves are pinned: each member's
// meaning, and the fact that there are five of them -- a sixth added on
// the backend then shows up here as a failing check rather than as a
// guest silently getting the generic message.
const BACKEND_FAILURES = {
  controller_unreachable: "unreachable",
  radius_unreachable: "unreachable",
  rejected: "rejected",
  controller_refused: "unknown",
  bad_request: "unknown",
};
for (const [token, expected] of Object.entries(BACKEND_FAILURES)) {
  check(`backend \`${token}\` reads as ${expected}`, radiusFailureOf(token) === expected);
}
check(
  "the two unreachable sides collapse to one message, and the two 'our bug' ones to another",
  radiusFailureOf("controller_unreachable") === radiusFailureOf("radius_unreachable") &&
    radiusFailureOf("controller_refused") === radiusFailureOf("bad_request"),
  "a guest cannot act on which side of the path broke",
);
check(
  "there is NO backend token for `not-authorized` -- it is the opaque 403's job",
  !Object.values(BACKEND_FAILURES).includes("not-authorized") &&
    radiusFailureOf("not_configured") === "unknown" &&
    radiusFailureOf("portal_mode_mismatch") === "unknown",
  "naming that fact in a token would let anyone on the WiFi enumerate which venue runs which contract",
);
check(
  "an unrecognised token is never guessed into a specific reason",
  radiusFailureOf("SOMETHING_NEW") === "unknown" &&
    radiusFailureOf("") === "unknown" &&
    radiusFailureOf(null) === "unknown" &&
    radiusFailureOf(undefined) === "unknown",
  "a wrong specific message tells the guest to do the wrong thing",
);
check(
  "a token's case and padding do not change its meaning",
  radiusFailureOf("  RADIUS_UNREACHABLE  ") === "unreachable",
);
check(
  "neither failure whose call is known to repeat itself is offered a retry",
  radiusFailureIsRetryable("rejected") === false &&
    radiusFailureIsRetryable("not-authorized") === false &&
    radiusFailureIsRetryable("unreachable") === true &&
    radiusFailureIsRetryable("unknown") === true,
);
check(
  "each failure has its own message key, and they are all distinct",
  new Set(["unreachable", "rejected", "not-authorized", "unknown"].map(radiusFailureMessageKey))
    .size === 4,
);

// THE STATUS IS THE ANSWER, and the opaque 403 is the reason the status
// matters more here than on any other call in this app.
check(
  "a request that reached nothing reads as unreachable",
  radiusFailureFromError({ status: null, code: "network_error" }) === "unreachable",
);
check(
  "the opaque 403 reads as not-authorized -- stop retrying, ask staff",
  radiusFailureFromError({
    status: 403,
    code: "forbidden",
    data: { code: "GUEST_SESSION_NOT_ACTIVE" },
  }) === "not-authorized",
);
check(
  "and its body is NOT mined for a reason it deliberately does not carry",
  // Every distinct cause renders the identical code on purpose. A build
  // that reads `data.code` here is one mapping the OPERATOR vocabulary
  // through the GUEST table, which silently yields "unknown" for values
  // that mean something precise.
  radiusFailureFromError({ status: 403, data: { code: "OMADA_TIMEOUT" } }) === "not-authorized",
);
check(
  "400 and 422 are our own body being wrong, so retrying it is not offered",
  radiusFailureFromError({ status: 400 }) === "not-authorized" &&
    radiusFailureFromError({ status: 422 }) === "not-authorized",
);
check(
  "429 says something true and retryable, not a false claim about the venue's equipment",
  radiusFailureFromError({ status: 429 }) === "unknown" &&
    radiusFailureIsRetryable(radiusFailureFromError({ status: 429 })),
);
check("a 502 reads as unreachable", radiusFailureFromError({ status: 502 }) === "unreachable");
check(
  "a thrown non-error is not a reason",
  radiusFailureFromError(undefined) === "unknown" && radiusFailureFromError("boom") === "unknown",
);

// `errorHint` -- the fallback for guests still arriving from the old path.
// A SEPARATE TABLE from the backend's: one is a contract this repo must
// match, the other is whatever a firmware revision writes into a query
// string, and a merged table would let the second reach the first's
// meaning.
check(
  "errorHint is read off the query string",
  radiusErrorHintFromSearch("?errorHint=RADIUS_SERVER_TIMEOUT&x=1") === "unreachable" &&
    radiusErrorHintFromSearch("?errorHint=INVALID_USERNAME_OR_PASSWORD") === "rejected",
);
check(
  "a BACKEND token in errorHint is not honoured -- the two vocabularies stay apart",
  radiusErrorHintFromSearch("?errorHint=controller_unreachable") === "unknown" &&
    radiusErrorHintFromSearch("?errorHint=bad_request") === "unknown",
);
check(
  "no errorHint is null, not a failure -- an ordinary sign-in shows nothing",
  radiusErrorHintFromSearch("?organizationId=o") === null &&
    radiusErrorHintFromSearch("") === null &&
    radiusErrorHintFromSearch("?errorHint=") === null,
);
check(
  "a guest who types their own errorHint gets the generic message, never a specific claim",
  radiusErrorHintFromSearch("?errorHint=YOUR_ACCOUNT_IS_SUSPENDED") === "unknown",
);

// --- the wiring -------------------------------------------------------
console.log("omada radius mode -- the wiring");

const successSrc = readFileSync(join(SRC, "routes/portal.success.tsx"), "utf8");
const searchSrc = readFileSync(join(SRC, "lib/portal-search.ts"), "utf8");
const portalSrc = readFileSync(join(SRC, "routes/portal.tsx"), "utf8");
const authorizeSrc = readFileSync(join(SRC, "lib/portal-radius-authorize.ts"), "utf8");
const serviceSrc = readFileSync(join(SRC, "services/network-integration.service.ts"), "utf8");
const signInSrc = readFileSync(join(SRC, "components/portal-runtime/GuestSignInCard.tsx"), "utf8");

check("the success page dispatches on the STORED mode", /portalMode === "radius"/.test(successSrc));
check(
  "and reads it from the runtime, not from the redirect's parameters",
  /portalMode,/.test(successSrc) && !/target\s*&&\s*targetPort/.test(successSrc),
);
check(
  "the RADIUS branch is inside the omada branch, before the RouterOS guards",
  successSrc.indexOf('portalMode === "radius"') > successSrc.indexOf('netProvider === "omada"') &&
    successSrc.indexOf('portalMode === "radius"') <
      successSrc.indexOf("if (!guestIdentifier) return;"),
);
check(
  "the External Portal Server path is untouched by the new branch",
  /void authorizeOnController\(\);/.test(successSrc),
);

// REGRESSION 2. The browser must never talk to the controller again.
check(
  "the browser-POST module is gone from the tree",
  !existsSync(join(SRC, "lib/portal-radius-submit.ts")),
  "leaving it means somebody re-wires it",
);
// In CODE, not in prose. Both files name `browserauth` in their docstrings
// on purpose -- the whole subject of those docstrings is why that endpoint
// is no longer called. Comments are stripped first so that documenting the
// retired contract does not read as re-introducing it; what must not come
// back is a reachable reference to it.
const CONTROLLER_SUBMIT_PATH = /\/portal\/radius\/(browserauth|auth)\b/;
check(
  "no module still spells the controller's own submit endpoints",
  !CONTROLLER_SUBMIT_PATH.test(stripComments(authorizeSrc)) &&
    !CONTROLLER_SUBMIT_PATH.test(stripComments(successSrc)),
);
check(
  "and nothing builds a form for the controller any more",
  !/form\.submit\(\)/.test(authorizeSrc) && !/document\.createElement\("form"\)/.test(authorizeSrc),
);
check(
  "the RADIUS branch goes to OUR backend",
  /guestPortalIntegrationService\.authorizeRadiusPortal\(/.test(successSrc),
);
check(
  "and the service posts it to this module's own path, not a literal it re-typed",
  /\$\{BASE\}\$\{PORTAL_RADIUS_AUTHORIZE_PATH\}/.test(serviceSrc),
);

// REGRESSION 3. THE ONE THAT HAS ACTUALLY SHIPPED. The hop to the guest's
// destination is a real top-level document load. `window.location.assign`,
// never `navigate()` (which repaints "you're connected" without a byte
// crossing the network) and never a `fetch` (which hangs iOS's CNA).
const radiusBranch = successSrc.slice(
  successSrc.indexOf("async function authorizeRadiusOnBackend"),
  successSrc.indexOf("function failRadius"),
);
check(
  "the RADIUS branch's success hop is a real document load",
  /window\.location\.assign\(directTarget\(\)\)/.test(radiusBranch),
);
check(
  "and is not a client-side navigate",
  !/navigate\(/.test(radiusBranch),
  "a route change can only ASSERT that the gate is open; it can never find out",
);
check(
  "a declined authorization navigates nowhere at all",
  radiusBranch.indexOf("if (!result.authorized)") <
    radiusBranch.indexOf("window.location.assign") &&
    /failRadius\(radiusFailureOf\(result\.failure\)\);\s*\n\s*return;/.test(radiusBranch),
);
// A CONTROLLER-ANSWERED REFUSAL IS AN HTTP 200 WITH `success: false`. It
// resolves; it does not throw. A branch that looked only in its `catch`
// would leave every rejected guest on the spinner until the 15s escape
// hatch -- the exact failure this screen was added to end.
check(
  "the refusal is read from the resolved answer, not only from the catch",
  /if \(!result\.authorized\)/.test(radiusBranch) &&
    radiusBranch.indexOf("if (!result.authorized)") < radiusBranch.indexOf("} catch"),
);
// #268 §5: `redirect_url` is whatever `origin_url` we sent, echoed back by
// the controller as its 302 Location -- and we send the CONTROLLER's
// captured value. Obeying it would drop the guest on a plain website with
// no session page, and would route around both
// `resolvePostLoginDestination` and the iOS CNA exception.
check(
  "the response's redirect_url is never navigated to",
  !/redirect_url|redirectUrl/.test(stripComments(radiusBranch)),
);
check(
  "and is not carried onto the result type, so obeying it is impossible",
  !/redirectUrl/.test(
    readFileSync(join(SRC, "types/network-integration.ts"), "utf8")
      .split("export interface RadiusPortalAuthorizeResult")[1]
      .slice(0, 200),
  ),
);
// The contract has no duration on this path -- the controller grants the
// session from its own RADIUS reply attributes and never tells us one.
check(
  "nothing reads or displays an expiry the backend never sends",
  !/expires_at|expiresAt/.test(serviceSrc.slice(serviceSrc.indexOf("authorizeRadiusPortal"))) &&
    !/expiresAt/.test(radiusBranch),
);
// Scoped to this ONE interface body, not the rest of the file:
// `BackendNetworkIntegrationEvent` legitimately carries an `error_code`,
// and that is the operator-facing field this response deliberately does
// not reuse the name of.
const radiusWireBody = (() => {
  const st = stripComments(serviceSrc);
  const from = st.indexOf("interface BackendRadiusPortalAuthorize");
  return from === -1 ? "" : st.slice(from, st.indexOf("}", from));
})();
check(
  "the service reads `failure`, not the operator-facing `error_code`",
  /failure: data\.failure \?\? null/.test(serviceSrc) &&
    radiusWireBody.includes("failure?:") &&
    !radiusWireBody.includes("error_code"),
);
check(
  "a failed call releases the submit guard, so the retry is a real retry",
  /hotspotLoginSubmitted\.current = false;/.test(
    successSrc.slice(successSrc.indexOf("function failRadius")),
  ),
);
check(
  "the failure screen is rendered, not navigated to",
  /if \(radiusFailure\) \{/.test(successSrc) &&
    /radiusFailureMessageKey\(radiusFailure\)/.test(successSrc),
);
check(
  "and the retry clears it first, so the guest can see the attempt fire",
  /setRadiusFailure\(null\);/.test(successSrc.slice(successSrc.indexOf("function retry()"))),
);

// The errorHint fallback, on the screen the bounced guest actually lands on.
check(
  "the search schema declares errorHint so it survives the hop to the sign-in card",
  /errorHint: z\.string\(\)\.optional\(\)/.test(searchSrc),
);
check(
  "the sign-in card reads it and shows a real message",
  /radiusErrorHintFromSearch/.test(signInSrc) && /radiusFailureMessageKey/.test(signInSrc),
);
check(
  "the success page does NOT seed itself from a retained errorHint",
  !/radiusErrorHintFromSearch/.test(successSrc),
  "it rides along on the next attempt and would render a stale failure before the fresh call answered",
);

check(
  "the search schema declares the four RADIUS redirect parameters",
  ["target:", "targetPort:", "scheme:", "originUrl:"].every((k) => searchSrc.includes(k)),
);
check("the search schema declares portalMode", /portalMode: z\.string/.test(searchSrc));
check(
  "the route captures them into the one redirect object",
  /targetPort,/.test(portalSrc) && /originUrl,/.test(portalSrc),
);
check(
  "and mirrors the mode alongside the controller's parameters",
  /portalMode: urlPortalMode,/.test(portalSrc),
);
check(
  "the mode falls back to the mirror per key, never the other way round",
  /const portalMode = urlPortalMode \?\? persistedOmada\?\.portalMode;/.test(portalSrc),
);

console.log(
  failures === 0 ? "\nportal RADIUS mode: all checks passed" : `\n${failures} check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
