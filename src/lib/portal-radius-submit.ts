/**
 * Omada RADIUS mode (`authType 2`) -- the one module that knows how a guest
 * at a RADIUS-mode venue actually gets through the gate.
 *
 * ## Why this is a second module and not a branch in an existing one
 *
 * A venue on `authType 2` + External Web Portal has a *different contract*
 * from a venue on `authType 4` (External Portal Server), not a variant of
 * it. Measured on a real Omada Software Controller 5.15.24.19 with an
 * adopted EAP245 (2026-09-11, re-verified credential-free 2026-09-12):
 *
 * | | `authType 4` (`portal-authorize-body.ts`) | `authType 2` (this file) |
 * |---|---|---|
 * | redirect names the venue | `site` | **nothing** -- no `site`, no `t` |
 * | where the credential goes | our backend, over HTTPS | **the controller**, from the guest's own browser |
 * | who calls the controller | our backend, with a stored operator login | nobody -- the controller calls **us**, over RADIUS |
 * | how the submit is made | `fetch` to our API | a **top-level HTML form POST** |
 * | what the redirect adds | -- | `target`, `targetPort`, `scheme`, `originUrl`, `gatewayMac`, `vid` |
 *
 * The direction of trust is reversed, so nothing about the authorize body
 * is reusable: there is no request to our backend at all on this path.
 *
 * ## Why a form POST, and never `fetch`
 *
 * `POST /portal/radius/auth` is the controller's XHR endpoint and it is
 * unusable cross-origin -- measured, not assumed: its preflight answers
 * `Access-Control-Allow-Methods: OPTIONS` (no POST), and the POST response
 * carries no `Access-Control-Allow-Origin` at all, so a page on
 * `auth.wyfyguest.com` can deliver the request and never read the answer.
 * TP-Link's own documentation says the same and names the alternative:
 * "HTML form demo and radius/browserauth api is recommended."
 *
 * `POST /portal/radius/browserauth` is form-encoded, answers a success with
 * `302 Location: <originUrl>`, and answers a missing required field with
 * `400`. A top-level form POST is also what iOS's Captive Network Assistant
 * needs -- the same mechanism, and the same reason, as the MikroTik
 * `link-login-only` POST in `portal.success.tsx`, where an embedded `fetch`
 * hangs the CNA forever.
 *
 * ## The failure UX is bad and this module cannot fix it
 *
 * Stated here rather than discovered later. On anything other than success
 * the controller answers the form navigation with
 * `Content-Type: application/json` and no page, so **the guest's browser
 * renders a raw JSON blob**: `{"errorCode":-41529,"msg":"Incorrect username
 * or password."}` for a RADIUS reject, and `-41530 "Connecting to the
 * RADIUS server times out."` when it cannot reach our RADIUS server at all
 * (measured on the live controller, 2026-09-12 -- which is what a guest
 * will see for *every* login until the inbound network path exists). The
 * browser has already navigated away, so there is nothing for this page to
 * intercept and nothing to style. There is no failure-URL field: not in
 * `ExternalRadiusSetting` (re-read off the controller's own `/v3/api-docs`
 * on 2026-09-12) and not in the controller's own portal bundle, which never
 * references `browserauth` at all.
 *
 * The only mitigation is the one this module already implements: never
 * submit a credential that can be rejected. The identifier submitted here
 * belongs to a `GuestSession` this platform created seconds earlier, and
 * our FreeRADIUS authorizes by session lookup rather than by password, so
 * a reject means the session is gone -- not that a guest mistyped.
 */

/** The controller-supplied half of an `authType 2` redirect.
 *
 * `string | number` per field for the same reason `OmadaRedirectCapture`
 * uses it: TanStack Router's search parser JSON.parses raw values, so
 * `targetPort=8843` arrives as a number and `radioId=1` as a number.
 * Normalized here, never upstream, so the capture stays verbatim. */
export interface OmadaRadiusRedirect {
  /** The controller's address, as the controller itself reported it. */
  target?: string | number;
  /** The portal port to submit to -- 8843 (https) or 8088 (http). */
  targetPort?: string | number;
  /** `http` or `https`, chosen by the controller, not by us. */
  scheme?: string | number;
  clientMac?: string | number;
  clientIp?: string | number;
  apMac?: string | number;
  gatewayMac?: string | number;
  ssidName?: string | number;
  vid?: string | number;
  radioId?: string | number;
}

/** Why a submission could not be built. Each value is a distinct, real
 * misconfiguration, and none of them is "try harder with a default". */
export type RadiusSubmitRefusal =
  /** The venue is recorded as RADIUS mode but the redirect carries no
   * `target`/`targetPort`/`scheme`. That means the controller is still
   * configured for the other contract (or the guest is on a portal URL
   * captured before the venue moved). There is nowhere to submit to, and
   * guessing the controller's address from anything else on the page
   * would be inventing the one value only the controller knows. */
  | "missing-target"
  /** `scheme` was neither `http` nor `https`. */
  | "bad-scheme"
  /** `target` is not a bare host or IP, or `targetPort` is not a port.
   * Refused rather than pasted into a URL: `target` arrives on the query
   * string of a page anyone can link to, and a `target` carrying `/`,
   * `@`, `?` or `#` is an attempt to make this form POST a guest's
   * identifier somewhere other than the venue's controller. */
  | "bad-target";

export interface OmadaRadiusSubmission {
  /** Where the form POSTs. */
  action: string;
  /** Exactly the fields the controller's own portal bundle sends, plus
   * the two the form API needs. Every value is a string -- this is an
   * `application/x-www-form-urlencoded` body, which has no other type. */
  fields: Record<string, string>;
}

/** The endpoint. The XHR sibling (`/portal/radius/auth`) is deliberately
 * not reachable from this module -- see the file docstring. */
export const OMADA_RADIUS_BROWSERAUTH_PATH = "/portal/radius/browserauth";

/** `authType` on the submit body. The same enum as the portal's own
 * configuration: `2` is External RADIUS Server. */
export const OMADA_RADIUS_AUTH_TYPE = "2";

const HOST_PATTERN = /^[A-Za-z0-9.:_-]+$/;

function text(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const asText = String(value).trim();
  return asText === "" ? undefined : asText;
}

/**
 * Build the form POST that opens the gate, or say why it cannot be built.
 *
 * ## What is sent, and what is refused
 *
 * The field set is not invented: it is what the controller's own shipping
 * portal bundle sends (`clientMac`, `apMac`, `gatewayMac`, `ssidName`,
 * `radioId`, `vid`, then `username`/`password`, then `authType: 2`), plus
 * `originUrl` which the form API uses as its success `Location`. `clientIp`
 * is included when the redirect carried it: TP-Link's documentation lists
 * it as required, the shipping page omits it, and the controller accepts
 * both -- so we send what we were given and invent nothing.
 *
 * Every controller-supplied value travels exactly as the controller spelled
 * it. Nothing here defaults, coerces or substitutes -- the same rule
 * `portal-authorize-body.ts` states for the other contract, for the same
 * reason: a value we invented that happened to be plausible is the worse of
 * the two failures, because the controller would accept it.
 *
 * The two values that are *ours* are named as such: `username` is the guest
 * identifier whose `GuestSession` this platform just created (our
 * FreeRADIUS authorizes by session lookup, not by password -- see
 * `RadiusService.authorize`), and `password` is the same placeholder the
 * MikroTik path sends, because no RADIUS path in this product ever checks
 * it.
 */
export function buildOmadaRadiusSubmission(
  redirect: OmadaRadiusRedirect,
  {
    identifier,
    password,
    landingUrl,
  }: { identifier: string; password: string; landingUrl: string },
): OmadaRadiusSubmission | { refused: RadiusSubmitRefusal } {
  const target = text(redirect.target);
  const port = text(redirect.targetPort);
  const scheme = text(redirect.scheme)?.toLowerCase();

  if (!target || !port || !scheme) return { refused: "missing-target" };
  if (scheme !== "http" && scheme !== "https") return { refused: "bad-scheme" };
  if (!HOST_PATTERN.test(target)) return { refused: "bad-target" };
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return { refused: "bad-target" };
  }

  const fields: Record<string, string> = {
    authType: OMADA_RADIUS_AUTH_TYPE,
    username: identifier,
    password,
    // WHERE THE CONTROLLER SENDS THE BROWSER ON SUCCESS -- the `dst` of
    // this contract. Deliberately our own post-login destination rather
    // than the `originUrl` the controller captured: this is our form, and
    // the guest's original destination has already been through
    // `resolvePostLoginDestination` upstream, exactly as RouterOS's
    // `link-orig` is. Echoing the captured value back instead would drop
    // the guest on a plain website with no session page and no way back.
    originUrl: landingUrl,
  };
  // Present-only, never defaulted: an absent parameter stays absent all
  // the way to the wire. The controller treats a missing optional field
  // and an empty one differently on some firmware, and we have measured
  // neither, so we send what arrived.
  const optional: Array<[string, string | undefined]> = [
    ["clientMac", text(redirect.clientMac)],
    ["clientIp", text(redirect.clientIp)],
    ["apMac", text(redirect.apMac)],
    ["gatewayMac", text(redirect.gatewayMac)],
    ["ssidName", text(redirect.ssidName)],
    ["vid", text(redirect.vid)],
    ["radioId", text(redirect.radioId)],
  ];
  for (const [name, value] of optional) {
    if (value !== undefined) fields[name] = value;
  }

  return {
    action: `${scheme}://${target}:${port}${OMADA_RADIUS_BROWSERAUTH_PATH}`,
    fields,
  };
}

/**
 * Perform the submission as a real top-level navigation.
 *
 * Identical mechanism to `submitHotspotLogin` in `portal.success.tsx`, and
 * for the identical reason recorded there: a subresource navigation (an
 * iframe) is subject to mixed-content autoupgrade and an embedded `fetch`
 * hangs iOS's Captive Network Assistant forever. A real document POST is
 * the only thing that both asks the network and survives the CNA.
 */
export function submitOmadaRadiusLogin(submission: OmadaRadiusSubmission): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = submission.action;
  form.style.display = "none";
  for (const [name, value] of Object.entries(submission.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
