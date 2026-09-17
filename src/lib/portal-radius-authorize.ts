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
 * ## THE CONTRACT BELOW IS PROVISIONAL
 *
 * The backend endpoint is being built in a parallel change on
 * `shresth111/cloud-guest`, and its PR was not open when this was written
 * (checked 2026-09-18). Every wire name in this file is therefore
 * DERIVED, not read: it is `PortalAuthorizeRequest`'s own spelling for
 * every field the two calls share (`session_id`, `organization_id`,
 * `location_id`, `provider`, `client_mac`, `client_ip`, `ap_mac`,
 * `ssid_name`, `radio_id`, `gateway_mac`, `vid` -- read off
 * `backend/app/domains/network_integration/schemas.py`), plus the four
 * RADIUS-only ones in the same snake_case style.
 *
 * That is why the whole payload lives in THIS module and nowhere else.
 * When the backend contract lands, this file changes and nothing else
 * does -- the same reason `portal-authorize-body.ts` is one module, and
 * the same trap: pydantic's default `extra="ignore"` means a
 * misspelled or nested key is dropped in silence and still answers 2xx.
 * `scripts/test-portal-radius-authorize.mjs` asserts the literals.
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
   * for. Where the guest actually lands afterwards is decided on the page,
   * by `resolvePostLoginDestination`, and travels nowhere near this body. */
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
 * Two sources of truth now, normalized to one closed set:
 *
 *   1. the backend's own `error_code` on the authorize response, or the
 *      error envelope of a non-2xx; and
 *   2. `errorHint`, for a guest who is still arriving from the old path --
 *      a browser that had the portal URL open before this deployed, or a
 *      controller still configured to bounce failures back to us.
 *
 * (2) is a FALLBACK, deliberately, and it is read but never trusted as an
 * instruction: it is an untrusted query parameter, so an unrecognised
 * value reads as `"unknown"` rather than as anything that changes what the
 * page does.
 * ====================================================================== */

/**
 * What went wrong, in the only four shapes that change what the guest
 * should do about it. Deliberately not one code per backend code: a guest
 * cannot act on the difference between "the controller timed out" and "the
 * controller refused the connection", and pretending otherwise is how a
 * failure screen ends up reading like a stack trace.
 */
export type RadiusAuthorizeFailure =
  /** The venue's controller, or our path to it, did not answer. Retrying
   * is genuinely worth something. */
  | "unreachable"
  /** The controller or our own RADIUS declined this guest. Their session
   * is gone or was never valid; retrying the same call cannot help, and
   * signing in again can. */
  | "rejected"
  /** The venue is not configured for this contract -- a redirect parameter
   * that is not what it claims to be, a portal mode the backend does not
   * have an integration for. Nobody standing at the venue can fix it, so
   * the screen says who can. */
  | "not-configured"
  /** Anything this module has not been taught. Never guessed into one of
   * the three above. */
  | "unknown";

/**
 * Wire token -> failure. One table, both sources.
 *
 * Keys are lowercased before lookup, so the backend's `radius_timeout` and
 * Omada's `RADIUS_SERVER_TIMEOUT` both land here without two tables. The
 * Omada spellings are the ones observed on the live controller
 * (`errorHint=RADIUS_SERVER_TIMEOUT`, `errorHint=INVALID_USERNAME_OR_PASSWORD`);
 * the snake_case ones are this repo's own convention, and are PROVISIONAL
 * until the backend PR names them -- see the module docstring. An entry
 * that turns out to be wrong shows up as `"unknown"`, which is a worse
 * message and never a wrong action.
 */
const FAILURE_BY_TOKEN: Record<string, RadiusAuthorizeFailure> = {
  // -- the controller could not be reached, or could not reach us --------
  radius_server_timeout: "unreachable",
  radius_timeout: "unreachable",
  controller_unreachable: "unreachable",
  controller_timeout: "unreachable",
  network_error: "unreachable",
  // -- somebody said no --------------------------------------------------
  invalid_username_or_password: "rejected",
  invalid_credentials: "rejected",
  radius_reject: "rejected",
  rejected: "rejected",
  session_not_active: "rejected",
  session_expired: "rejected",
  forbidden: "rejected",
  // -- this venue is not set up for this ---------------------------------
  not_configured: "not-configured",
  portal_mode_mismatch: "not-configured",
  integration_not_found: "not-configured",
  missing_target: "not-configured",
  validation_error: "not-configured",
};

/**
 * A code from either source, reduced to a `RadiusAuthorizeFailure`.
 *
 * Anything unrecognised -- including an empty string, a `null`, and a
 * guest who typed their own `?errorHint=` -- is `"unknown"`. It is never
 * read as one of the three specific ones, for the same reason
 * `portal-nas-state.ts` refuses to read an absent `hspage` as an answer:
 * a wrong specific message tells the guest to do the wrong thing.
 */
export function radiusFailureOf(code: string | null | undefined): RadiusAuthorizeFailure {
  if (typeof code !== "string") return "unknown";
  const token = code.trim().toLowerCase();
  if (token === "") return "unknown";
  return FAILURE_BY_TOKEN[token] ?? "unknown";
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
 * Order is deliberate and goes from most specific to least: a backend that
 * names its own reason in the error envelope's `data.error_code` is
 * believed first, then the `AppError.code` our own client derived, then
 * the bare status. `status: null` is `toAppError`'s "Unable to reach the
 * server" -- the request never got an answer at all, which is exactly
 * `"unreachable"`.
 */
export function radiusFailureFromError(error: unknown): RadiusAuthorizeFailure {
  if (!error || typeof error !== "object") return "unknown";
  const e = error as RadiusAuthorizeErrorShape;
  const envelope = e.data;
  if (envelope && typeof envelope === "object") {
    const named = (envelope as { error_code?: unknown }).error_code;
    if (typeof named === "string") {
      const mapped = radiusFailureOf(named);
      if (mapped !== "unknown") return mapped;
    }
  }
  if (typeof e.code === "string") {
    const mapped = radiusFailureOf(e.code);
    if (mapped !== "unknown") return mapped;
  }
  if (e.status === null || e.status === undefined) return "unreachable";
  if (e.status === 403 || e.status === 401) return "rejected";
  if (e.status === 404 || e.status === 422 || e.status === 501) return "not-configured";
  if (e.status >= 500) return "unreachable";
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
    case "not-configured":
      return "radiusFailNotConfigured";
    default:
      return "radiusFailUnknown";
  }
}

/**
 * Whether retrying the same call can possibly help.
 *
 * `false` for `"rejected"` -- the session the backend would look up is
 * gone, so the identical call produces the identical refusal, and offering
 * a retry button there is offering a button that is known not to work.
 * That guest is offered "sign in again", which is the thing that does.
 */
export function radiusFailureIsRetryable(failure: RadiusAuthorizeFailure): boolean {
  return failure !== "rejected";
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
 */
export function radiusErrorHintFromSearch(search: string): RadiusAuthorizeFailure | null {
  let hint: string | null = null;
  try {
    hint = new URLSearchParams(search).get("errorHint");
  } catch {
    return null;
  }
  if (hint === null || hint.trim() === "") return null;
  return radiusFailureOf(hint);
}
