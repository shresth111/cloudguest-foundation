/**
 * Omada RADIUS mode (`authType 2`), authorized BY OUR BACKEND.
 *
 * This module replaces the direction of the call that
 * `portal-radius-submit.ts` documents, and it exists because that direction
 * does not work on a real phone.
 *
 * ## What changed, and what measured it
 *
 * `portal-radius-submit.ts` made the guest's own browser do a top-level
 * form POST to `POST /portal/radius/browserauth` on the controller's own
 * HTTPS port. Measured on a real Android handset (2026-09-18): **the
 * browser refuses the navigation**. The controller answers on its own
 * portal port with a self-signed `CN=localhost` certificate, Android will
 * not let a user click through an interstitial for a form POST it did not
 * initiate from that origin, and every venue's controller has its own
 * self-signed certificate, so this is not one venue's misconfiguration --
 * it is the contract.
 *
 * Measured the same day: **the identical call made server-side authorizes
 * the client**. Our backend already holds the venue's controller
 * credentials and already talks to it over a connection that does not go
 * through a guest's certificate store. So the browser stops calling the
 * controller and asks our backend instead -- exactly the shape the
 * External Portal Server contract (`authType 4`,
 * `portal-authorize-body.ts`) has used at a live venue since it shipped.
 *
 * ## What this fixes beyond the certificate
 *
 * Three things the browser-POST contract could not do at all, each of
 * which `portal-radius-submit.ts` documents as unfixable from its side:
 *
 * 1. **A failure was a raw JSON blob.** The controller answered a rejected
 *    form navigation with `Content-Type: application/json` and no page, so
 *    the guest's browser rendered `{"errorCode":-41529,...}`. The browser
 *    had already navigated away; there was nothing left to style. Now the
 *    answer comes back to a `fetch` on a page that is still mounted, and
 *    the guest sees a real failure screen.
 * 2. **A credential left the page.** The old body carried `username` and
 *    `password` -- the guest's own verified identifier, posted from the
 *    browser to a host named by a query parameter. This body carries
 *    `session_id` and nothing else that authenticates: the same "a claim,
 *    not a credential" posture the `authType 4` endpoint already takes.
 *    The backend resolves the RADIUS identifier from the session it owns.
 * 3. **A guest who lost their identifier to a reload was stuck.** The old
 *    path could not proceed without `guestIdentifier`, because that exact
 *    string was the RADIUS username. Keyed on the session id, this path
 *    can.
 *
 * ## THE CONTRACT, READ FROM cloud-guest#268
 *
 * Every wire name below is the backend's own, read off
 * `shresth111/cloud-guest` PR #268 ("Open the gate at RADIUS-mode venues
 * from the server, not the guest's phone"). The REQUEST BODY matched this
 * module's first draft field for field, including `session_id` and no
 * credential, which the backend adopted on stronger grounds than were
 * first written here: on this contract the submitted username *is* the
 * credential, because our FreeRADIUS authorizes by session lookup and
 * never checks the password -- so accepting it on an unauthenticated body
 * would be authorizing an identity the caller never proved it holds.
 *
 * The RESPONSE diverged in four ways, all of them reconciled here:
 *
 *  1. the guest-facing token is `failure`, not `error_code`. `data.code`
 *     on this domain is already the OPERATOR-facing `ErrorCode`
 *     vocabulary, and two vocabularies under one field name is a trap;
 *  2. `failure` is a closed FIVE-value enum, collapsed to four here --
 *     see `FAILURE_BY_BACKEND_TOKEN`;
 *  3. there is no `not_configured` token and there cannot be one. The
 *     fact is withheld on purpose -- see `"not-authorized"`;
 *  4. there is no `expires_at`. The controller grants the session from its
 *     own RADIUS reply attributes and never tells us a duration, so there
 *     is nothing to put in the field but a guess. The portal must not
 *     display or compute one on this contract.
 *
 * A CONTROLLER-ANSWERED FAILURE IS AN HTTP 200 with `success: false`, not
 * a non-2xx. A caller that only looked in its `catch` would render the
 * spinner forever.
 *
 * The whole payload and both failure tables live in THIS module and
 * nowhere else -- the same reason `portal-authorize-body.ts` is one
 * module, and the same trap: pydantic's default `extra="ignore"` means a
 * misspelled or nested key is dropped in silence and still answers 2xx.
 * `scripts/test-portal-radius-mode.mjs` asserts the literals.
 *
 * ## Two rules carried over unchanged
 *
 * **Captured, never derived.** Every controller-supplied value travels
 * exactly as the controller spelled it, or travels as `null`. Nothing here
 * defaults, coerces or substitutes. A value we invented that happened to
 * be plausible is the worse of the two failures, because the controller
 * would accept it.
 *
 * **Top level, never nested.** See `portal-authorize-body.ts` rule 1 and
 * the cross-repo bug it is named for.
 */

import {
  normalizeClientIp,
  normalizeOmadaNumeric,
  normalizeOmadaText,
  type PortalAuthorizeIdentity,
} from "@/lib/portal-authorize-body";
/** The controller-supplied half of an `authType 2` redirect.
 *
 * Moved here from `portal-radius-submit.ts`, which this change retires
 * along with the browser-POST contract it existed to build. The shape is
 * unchanged except for one addition noted below.
 *
 * `string | number` per field for the same reason `OmadaRedirectCapture`
 * uses it: TanStack Router's search parser JSON.parses raw values, so
 * `targetPort=8843` arrives as a number and `radioId=1` as a number.
 * Normalized here, never upstream, so the capture stays verbatim. */
export interface OmadaRadiusRedirect {
  /** The controller's address, as the controller itself reported it. */
  target?: string | number;
  /** The portal port -- 8843 (https) or 8088 (http). */
  targetPort?: string | number;
  /** `http` or `https`, chosen by the controller, not by us. */
  scheme?: string | number;
  /** WAS MISSING FROM THIS INTERFACE, and that was a real hole rather than
   * a tidy-up. `/portal` has captured `originUrl` into the redirect object
   * since the RADIUS capture shipped (`portalSearchShape.originUrl`), and
   * neither this interface nor `OmadaRedirectCapture` declared it -- so it
   * rode along untyped, and the one module that needed to read it could
   * not. It is declared now because this body carries it. */
  originUrl?: string | number;
  clientMac?: string | number;
  clientIp?: string | number;
  apMac?: string | number;
  gatewayMac?: string | number;
  ssidName?: string | number;
  vid?: string | number;
  radioId?: string | number;
}

/** The path, relative to the `network-integrations` base the guest portal
 * client already uses. PROVISIONAL -- see the module docstring. Exported so
 * a test asserts the literal rather than re-typing it. */
export const PORTAL_RADIUS_AUTHORIZE_PATH = "/portal/radius-authorize" as const;

/**
 * The body, in full.
 *
 * `session_id`/`organization_id`/`location_id`/`provider` are
 * `PortalAuthorizeIdentity`'s four, reused rather than re-declared: they
 * mean the same thing on both Omada contracts and the backend parses them
 * under the same names.
 *
 * The rest is the controller's own redirect. An `authType 2` redirect is
 * NOT the same shape as an `authType 4` one -- it carries no `site` and no
 * `t`, and it carries `target`/`targetPort`/`scheme`/`originUrl` that the
 * other never does -- so this is deliberately not
 * `OmadaAuthorizeFields`. Overlapping names keep the overlapping spelling.
 */
export interface PortalRadiusAuthorizeBody extends PortalAuthorizeIdentity {
  client_mac: string | null;
  client_ip: string | null;
  ap_mac: string | null;
  gateway_mac: string | null;
  ssid_name: string | null;
  radio_id: number | string | null;
  vid: number | string | null;
  /** `authType 2`'s spelling of "where this guest was going", straight off
   * the controller's redirect and NOT our own post-login destination.
   *
   * This is the one field whose meaning changed with the direction of the
   * call. When the BROWSER posted the form, `originUrl` was where the
   * controller would 302 the browser next, so the portal put its own
   * landing URL there. Now the BACKEND makes the call and no browser is
   * being navigated by the controller at all, so the honest value is the
   * pass-through one: what the controller told us the guest was reaching
   * for.
   *
   * ## AND THEREFORE THE RESPONSE'S `redirect_url` IS IGNORED
   *
   * cloud-guest#268 §5 names the trap and it is a real one. The
   * controller's `302 Location` -- which the backend returns as
   * `redirect_url` -- is simply whatever `origin_url` we sent, echoed
   * back. So there are exactly two coherent positions, and the one thing
   * that must not happen is doing half of each: sending the captured
   * `http://neverssl.com/` and then navigating the guest to
   * `redirect_url`, which drops them on a plain website with no session
   * page and no way back.
   *
   * The backend author's preference is the other position -- send our own
   * landing URL, then `redirect_url` is directly usable. This module takes
   * the first, for two reasons that only apply on the frontend:
   *
   *   * where the guest lands is ONE decision and it already has an owner.
   *     `resolvePostLoginDestination` picks it, and `/portal/success` then
   *     overrides that for iOS's Captive Network Assistant, where an
   *     external target is meaningless and pointing the websheet at one is
   *     exactly how a freshly-logged-in iPhone ended up staring at
   *     google.com. A `redirect_url` handed back from the backend has been
   *     through neither, so obeying it would route around both;
   *   * "captured, never derived" is this module's rule everywhere else,
   *     and substituting our own URL for a value the controller supplied
   *     is the one thing it forbids.
   *
   * `redirect_url` is therefore not mapped onto `RadiusPortalAuthorizeResult`
   * at all -- see the service. Structurally unavailable beats documented
   * and ignored. */
  origin_url: string | null;
  /** The controller's own address, port and scheme, as the controller
   * reported them. Informational, not authoritative: the backend reaches
   * its controller over the integration's stored base URL, and a
   * venue-hosted controller's `target` is frequently a LAN address no
   * backend can route to. Carried because doc 132060's rule ("preserve and
   * return these parameters") applies to the whole redirect, and because
   * only the controller ever knew them.
   *
   * VALIDATED BEFORE IT TRAVELS -- see `buildPortalRadiusAuthorizeBody`.
   * These three arrive on the query string of a page anyone can link to. */
  target: string | null;
  target_port: number | string | null;
  scheme: string | null;
}

/** Why a body could not be built. Both values mean the same thing -- a
 * redirect parameter is present and is not what it claims to be -- and both
 * are a refusal rather than a repair. */
export type RadiusAuthorizeRefusal = "bad-scheme" | "bad-target";

/** A bare host or IP, with no `/`, `@`, `?` or `#` in it. Same pattern and
 * same reasoning as `portal-radius-submit.ts`: a `target` carrying any of
 * those is an attempt to make this call name somewhere other than the
 * venue's controller. */
const HOST_PATTERN = /^[A-Za-z0-9.:_-]+$/;

/**
 * Build the body, or say which captured value is malformed.
 *
 * ## What is refused, and what is merely absent
 *
 * An ABSENT `target`/`targetPort`/`scheme` is not a refusal here, and that
 * is the one deliberate behavioural difference from
 * `portal-radius-submit.ts`. That module had to refuse, because the three
 * were the form's `action` and there was nothing else to submit to. This
 * call goes to our own backend, which reaches the controller over the
 * integration row's stored base URL -- an address a redirect cannot
 * supply and cannot invalidate. So absence travels as `null` and the
 * backend decides, exactly as it already does for every other absent
 * redirect parameter.
 *
 * A PRESENT-BUT-MALFORMED one is still a refusal, for the unchanged
 * reason: these values come off a URL anyone can link to.
 */
export function buildPortalRadiusAuthorizeBody(
  identity: PortalAuthorizeIdentity,
  redirect: OmadaRadiusRedirect,
  clientIp: string | null | undefined,
): PortalRadiusAuthorizeBody | { refused: RadiusAuthorizeRefusal } {
  const target = normalizeOmadaText(redirect.target);
  const port = normalizeOmadaText(redirect.targetPort);
  const scheme = normalizeOmadaText(redirect.scheme)?.toLowerCase() ?? null;

  if (scheme !== null && scheme !== "http" && scheme !== "https") {
    return { refused: "bad-scheme" };
  }
  if (target !== null && !HOST_PATTERN.test(target)) return { refused: "bad-target" };
  if (port !== null && (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    return { refused: "bad-target" };
  }

  return {
    ...identity,
    client_mac: normalizeOmadaText(redirect.clientMac),
    // TWO PLACES THE SAME FACT CAN ARRIVE, and the more specific one wins.
    // `/portal` captures `clientIp` as a flat runtime field (see
    // `PortalRuntimeState.clientIp`) because the `authType 4` body wanted
    // it that way, and `OmadaRadiusRedirect` also declares it because the
    // `authType 2` redirect carries it. Neither is derived from the other,
    // so this reads the redirect's own copy first and falls back to the
    // runtime's -- and sends `null` rather than an empty string when both
    // are silent, which is what `normalizeClientIp` exists to spell.
    client_ip: normalizeOmadaText(redirect.clientIp) ?? normalizeClientIp(clientIp),
    ap_mac: normalizeOmadaText(redirect.apMac),
    gateway_mac: normalizeOmadaText(redirect.gatewayMac),
    ssid_name: normalizeOmadaText(redirect.ssidName),
    radio_id: normalizeOmadaNumeric(redirect.radioId),
    vid: normalizeOmadaNumeric(redirect.vid),
    origin_url: normalizeOmadaText(redirect.originUrl),
    target,
    target_port: normalizeOmadaNumeric(port),
    scheme,
  };
}

/* ====================================================================== *
 * FAILURE, WHICH USED TO BE INVISIBLE.
 *
 * Before this change a RADIUS-mode failure had no representation anywhere
 * in this codebase. The controller answered the browser's form navigation
 * with a JSON blob or bounced it back to the portal URL with
 * `?errorHint=RADIUS_SERVER_TIMEOUT`, and `errorHint` had ZERO occurrences
 * in the repo -- so the guest silently landed back on the login page with
 * no idea why, and tried the same thing again.
 *
 * Three sources, normalized to one closed set:
 *
 *   1. the backend's `failure` token on a `200` whose `authorized` is
 *      false -- a CONTROLLER-ANSWERED failure, which is not an HTTP error
 *      and must not be looked for only in a `catch`;
 *   2. the HTTP status of a rejected request -- and on this contract the
 *      status carries a fact no token does, because `403` is deliberately
 *      opaque (below); and
 *   3. `errorHint`, for a guest still arriving from the old path -- a
 *      browser that had the portal URL open before this deployed, or a
 *      controller still configured to bounce failures back to us.
 *
 * (3) is a FALLBACK, and it is read but never trusted as an instruction:
 * it is an untrusted query parameter, so an unrecognised value reads as
 * `"unknown"` rather than as anything that changes what the page does.
 *
 * THE TWO VOCABULARIES ARE KEPT APART, in two tables and two functions.
 * They look similar and they are not the same: (1) is `RadiusPortalFailure`
 * on the backend, a closed five-value enum this module must match exactly,
 * and (3) is whatever TP-Link's firmware writes into a query string. One
 * merged table would let a controller-supplied string reach the backend
 * half's meaning, and would hide a backend enum member being added.
 * ====================================================================== */

/**
 * What went wrong, in the only four shapes that change what the guest
 * should do about it. Deliberately not one per backend token: a guest
 * cannot act on the difference between "we could not reach the controller"
 * and "the controller could not reach our RADIUS", and pretending
 * otherwise is how a failure screen ends up reading like a stack trace.
 */
export type RadiusAuthorizeFailure =
  /** The venue's controller, or the path between it and our RADIUS, did
   * not answer. Retrying is genuinely worth something. */
  | "unreachable"
  /** RADIUS said no. On this platform that means the session is gone, not
   * that a guest mistyped -- our FreeRADIUS authorizes by session lookup
   * and never checks the password. Retrying the same call cannot help;
   * signing in again can. */
  | "rejected"
  /** THE OPAQUE 403, and the name is chosen to be honest about how little
   * we know. The backend answers one identical `403` for every distinct
   * refusal -- no session, expired session, TERMINATED session, org or
   * location mismatch, a MAC that is not the session's device, no enabled
   * integration, a venue on the OTHER portal contract, and a controller
   * address that disagrees with the stored one.
   *
   * That is deliberate and it is right: this endpoint is reachable by
   * anyone standing in range of a venue's WiFi, and a 403 that named its
   * cause would let them enumerate which venues run which contract. The
   * operator gets the real reason on the integration's event feed.
   *
   * So the guest is told the one thing that is true of all of them --
   * this sign-in was not accepted, stop retrying -- and offered both of
   * the two things that can help, without claiming to know which. */
  | "not-authorized"
  /** Anything this module has not been taught, plus the backend tokens
   * whose own advice is "retry, and it is probably our bug"
   * (`controller_refused`, `bad_request`). Never guessed into one of the
   * three above. */
  | "unknown";

/**
 * `RadiusPortalFailure` -> what the guest is told. THE FIVE, EXACTLY.
 *
 * Read off cloud-guest#268's contract, not inferred: `constants.RadiusPortalFailure`
 * is a closed enum of exactly these five members, and this table must
 * carry exactly those five keys. A sixth member added on the backend
 * arrives here as `"unknown"` -- honest, but a worse message -- and
 * `scripts/test-portal-radius-mode.mjs` pins the key set so the drift is
 * visible rather than silent.
 *
 * Five collapse to three: the backend keeps `controller_unreachable` and
 * `radius_unreachable` apart because which side of the path broke is the
 * first question an operator asks, and it keeps `controller_refused` and
 * `bad_request` apart for the same reason. Neither distinction changes
 * what the guest does, so neither survives the trip to this screen.
 */
const FAILURE_BY_BACKEND_TOKEN: Record<string, RadiusAuthorizeFailure> = {
  // We could not reach the venue's controller.
  controller_unreachable: "unreachable",
  // The controller could not reach our RADIUS server.
  radius_unreachable: "unreachable",
  // RADIUS Access-Reject (`-41529`).
  rejected: "rejected",
  // The controller refused without naming a reason (`-41501`), or named
  // one we do not map.
  controller_refused: "unknown",
  // HTTP 400 from the controller -- a field missing from OUR body. Always
  // our bug, never the guest's, and there is nothing honest to tell them
  // beyond "something went wrong".
  bad_request: "unknown",
};

/** Omada's own `errorHint` spellings, observed on the live controller.
 * A SEPARATE TABLE from the backend's -- see the section docstring. These
 * are firmware strings, not a contract anyone owns, so the list is
 * open-ended by nature and anything outside it is `"unknown"`. */
const FAILURE_BY_ERROR_HINT: Record<string, RadiusAuthorizeFailure> = {
  radius_server_timeout: "unreachable",
  invalid_username_or_password: "rejected",
};

/**
 * The backend's `failure` token, reduced to what the guest is told.
 *
 * Anything unrecognised -- including an empty string, a `null` (which is
 * what the field holds on success and on a failure the backend declined to
 * name), and a token from a newer backend -- is `"unknown"`. It is never
 * read as one of the three specific ones, for the same reason
 * `portal-nas-state.ts` refuses to read an absent `hspage` as an answer: a
 * wrong specific message tells the guest to do the wrong thing.
 */
export function radiusFailureOf(token: string | null | undefined): RadiusAuthorizeFailure {
  return lookup(FAILURE_BY_BACKEND_TOKEN, token);
}

function lookup(
  table: Record<string, RadiusAuthorizeFailure>,
  raw: string | null | undefined,
): RadiusAuthorizeFailure {
  if (typeof raw !== "string") return "unknown";
  const token = raw.trim().toLowerCase();
  if (token === "") return "unknown";
  return table[token] ?? "unknown";
}

/** The shape this module reads off a rejected request, duck-typed on
 * purpose. `AppError` lives in `@/services/api`, which imports axios;
 * this module is bundled by a `platform: "neutral"` test and must stay
 * free of it. Anything with these keys is accepted, including a real
 * `AppError`. */
export interface RadiusAuthorizeErrorShape {
  status?: number | null;
  code?: string;
  data?: unknown;
}

/**
 * A rejected authorize request, reduced to a failure.
 *
 * ## THE STATUS IS THE WHOLE ANSWER HERE, AND THE BODY IS DELIBERATELY NOT
 *
 * This used to read `data.error_code` off the error envelope first. It no
 * longer looks at the body at all, and that is a correction rather than a
 * simplification. On this domain `data.code` is the OPERATOR-facing
 * `ErrorCode` vocabulary (`OMADA_TIMEOUT`,
 * `NETWORK_INTEGRATION_PORTAL_MODE_MISMATCH`, ...), which is a different
 * and much larger set than the guest-facing `failure` one -- reading it
 * here would be mapping one vocabulary's tokens through another's table,
 * which silently produces `"unknown"` for values that mean something
 * precise. And on the one status that matters, `403`, every distinct cause
 * renders the identical `{"code": "GUEST_SESSION_NOT_ACTIVE"}` on purpose,
 * so there is nothing in the body to read.
 *
 * `status: null` is `toAppError`'s "Unable to reach the server" -- the
 * request never got an answer at all, which is exactly `"unreachable"`.
 *
 * ## Why `429`, `400` and `422` land where they do
 *
 * `429` is the rate limiter (per client IP in middleware, per guest
 * session in the service). Waiting and retrying is the right move, but
 * "the venue's equipment did not answer" would be a false statement about
 * what happened -- so it takes the honest generic message, which is also
 * the retryable one.
 *
 * `400` (unsupported provider) and `422` (malformed MAC) are both OUR
 * body being wrong, and an identical retry sends the identical body. They
 * take the `403` treatment -- stop retrying, ask staff -- because that is
 * the only advice that can actually resolve them.
 */
export function radiusFailureFromError(error: unknown): RadiusAuthorizeFailure {
  if (!error || typeof error !== "object") return "unknown";
  const { status } = error as RadiusAuthorizeErrorShape;
  if (status === null || status === undefined) return "unreachable";
  if (status === 401 || status === 403) return "not-authorized";
  if (status === 400 || status === 404 || status === 422 || status === 501) {
    return "not-authorized";
  }
  if (status >= 500) return "unreachable";
  return "unknown";
}

/**
 * The i18n key for what the guest is told.
 *
 * One sentence per failure, and each one says what happened AND what to do
 * -- the two halves a captive-portal failure screen has to carry, because
 * the guest cannot see the network and cannot ask it anything.
 */
export function radiusFailureMessageKey(failure: RadiusAuthorizeFailure): string {
  switch (failure) {
    case "unreachable":
      return "radiusFailUnreachable";
    case "rejected":
      return "radiusFailRejected";
    case "not-authorized":
      return "radiusFailNotAuthorized";
    default:
      return "radiusFailUnknown";
  }
}

/**
 * Whether retrying the same call can possibly help.
 *
 * `false` for the two failures where the identical call is known to
 * produce the identical answer, so a retry button would be a button that
 * cannot work:
 *
 *   * `"rejected"` -- RADIUS looked the session up and it is gone;
 *   * `"not-authorized"` -- the backend's opaque `403`, which covers every
 *     refusal it will not name, and a `400`/`422` where our own body is
 *     what is wrong.
 *
 * Both guests are still offered "sign in again", which is the thing that
 * can actually help for the commonest cause of each.
 */
export function radiusFailureIsRetryable(failure: RadiusAuthorizeFailure): boolean {
  return failure !== "rejected" && failure !== "not-authorized";
}

/**
 * The controller's own `errorHint`, off the portal URL's query string.
 *
 * Read with `URLSearchParams` rather than the route's typed search, because
 * the guests this is for arrive on a FRESH DOCUMENT the controller
 * navigated: the bounce is a full page load onto the portal URL with the
 * hint appended, not a client-side hop. `search` is passed in rather than
 * read off `window` so this stays pure and testable, the same way
 * `nasAuthorizedFromSearch` is.
 *
 * Mapped through the CONTROLLER's table, never the backend's -- see the
 * section docstring on why the two are kept apart. The strings happen to
 * look alike; one is a contract this repo must match exactly and the other
 * is whatever a firmware revision writes into a query string.
 */
export function radiusErrorHintFromSearch(search: string): RadiusAuthorizeFailure | null {
  let hint: string | null = null;
  try {
    hint = new URLSearchParams(search).get("errorHint");
  } catch {
    return null;
  }
  if (hint === null || hint.trim() === "") return null;
  return lookup(FAILURE_BY_ERROR_HINT, hint);
}
