/**
 * The one module that spells the captive-portal authorize call's
 * `client_ip` field, and the only place that decides where on the body it
 * goes.
 *
 * ## What this is for
 *
 * An Omada controller intercepts a guest and 302s their browser to this
 * portal with the client's connection information on the query string
 * (TP-Link doc 132060, *External Portal Server, Omada Controller v6.2.10 or
 * Above*):
 *
 *     http(s)://PORTAL?clientMac=CLIENT_MAC&clientIp=CLIENT_IP&apMac=AP_MAC
 *                     &ssidName=SSID_NAME&t=TIME&radioId=RADIO_ID&site=SITE
 *                     &redirectUrl=LANDING_PAGE
 *
 * From v6.2.10 the controller's own authorization body "must contain"
 * `clientIp`, in both the EAP/AP shape and the gateway shape. Our platform
 * never lets a guest's browser talk to the controller, so the value travels
 * one more hop first:
 *
 *     Omada 302  --?clientIp=...-->  guest browser (`/portal`, captured by
 *                                    `portalSearchShape.clientIp`)
 *         --> POST /api/v1/network-integrations/portal/authorize
 *             { ..., "client_ip": "10.0.5.23" }        <-- THIS MODULE
 *         --> PortalAuthorizeRequest.client_ip  (backend schema)
 *         --> ProviderPortalContext.client_ip   (provider seam)
 *         --> PortalAuthContext.client_ip       (gateway)
 *         --> body["clientIp"]                  (controller's extPortal/auth)
 *
 * Three spellings, deliberately: `clientIp` on the way in, `client_ip`
 * across our own API, `clientIp` again on the way out. This module owns the
 * middle one.
 *
 * ## Two rules, both of which have already cost this integration once
 *
 * **1. Top level, never nested.** The one shipped cross-repo bug in this
 * integration was this frontend nesting controller credentials under a
 * `credentials: {...}` key. Every backend request model takes those fields
 * flat, and pydantic's default `extra="ignore"` dropped the whole object
 * without a word: create returned 201 for an integration with no stored
 * credentials, and Test Connection could never authenticate. The contract
 * test passed the entire time, because it asserted the same wrong place the
 * code wrote to. `client_ip` fails identically if it is nested or
 * camelCased -- a 201 with nothing carried and no error anywhere. So the
 * test for this module asserts the shape the BACKEND parses
 * (`PortalAuthorizeRequest.client_ip`, top level, snake_case), not the
 * shape this file happens to produce.
 *
 * **2. Captured, never derived.** The only honest source for this value is
 * the controller's own redirect. It must not be inferred from the portal
 * request's source address: this portal is reached through a reverse proxy,
 * so that address belongs to the proxy, and an authorize call carrying the
 * wrong address either authorizes some other device or nobody at all -- a
 * failure that looks exactly like "the WiFi is broken". When the redirect
 * carried nothing, this sends `null` and lets the controller decide; there
 * is deliberately no fallback parameter for a caller to pass instead.
 *
 * ## Known, and deliberately not papered over
 *
 * The address is captured at redirect time; authorization happens once the
 * guest has finished OTP, which can be minutes later. A DHCP lease that
 * changed in between means we send a stale address and the controller
 * rejects it. We still send exactly what the redirect said: the only
 * alternative is a guess, and a guess that happens to name a real device on
 * that LAN is the worse of the two failures.
 */

/** The wire name, on our own API, at the top level of the body. Exported so
 * a test can assert the literal rather than re-typing it. */
export const PORTAL_AUTHORIZE_CLIENT_IP_FIELD = "client_ip" as const;

/**
 * The captured query-string value, reduced to what may travel onward.
 *
 * `?clientIp=` (present but empty) and a whitespace-only value both mean
 * "the controller told us nothing", and both become `null` rather than an
 * empty string the backend would have to special-case. Anything else is
 * passed through byte-for-byte after trimming surrounding whitespace: this
 * is not the layer that decides whether an address is well-formed, and
 * dropping a value we do not recognise would be inventing an absence.
 */
export function normalizeClientIp(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Put the captured client IP on an authorize body, at the top level, under
 * the name the backend actually parses.
 *
 * Deliberately narrow: it takes whatever body the caller has already built
 * and adds exactly one field. Every other parameter of that call
 * (`session_id`, `client_mac`, `site`, `radio_id`, `t`, ...) belongs to the
 * caller and to CONTRACT §3 -- this module resolves nothing about them, in
 * particular not the open question of whether `t`/`radio_id`/`vid` should
 * be strings rather than numbers, which needs its own change and its own
 * hardware check.
 *
 * The key is always present, `null` when absent, so "the controller did not
 * tell us" is a statement on the wire rather than a silence
 * indistinguishable from a caller that forgot the field.
 */
export function withClientIp<T extends object>(
  body: T,
  clientIp: string | null | undefined,
): T & { client_ip: string | null } {
  return { ...body, [PORTAL_AUTHORIZE_CLIENT_IP_FIELD]: normalizeClientIp(clientIp) } as T & {
    client_ip: string | null;
  };
}
