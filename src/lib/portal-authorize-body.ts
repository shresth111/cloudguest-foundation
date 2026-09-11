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
 *
 * A SECOND PROBLEM, MEASURED ON HARDWARE 2026-09-11, AND IT IS WORSE. When
 * the controller sits off-site, `clientIp` is the VENUE'S PUBLIC NAT
 * ADDRESS, not the client's -- the controller reports the source address of
 * the HTTP request it received, so every guest at that venue arrives from
 * the same one. Captured live: `clientIp=103.84.202.195` while the client
 * was `192.168.1.114`.
 *
 * This module's job is unchanged by that: it carries what the controller
 * said, and inventing a different value would be exactly the guess the rule
 * above forbids. But nothing downstream may treat this field as a client
 * identifier in the WyfyGuest-hosted-controller model, because it is not
 * one. On a venue-hosted controller it is the real client address. CR-004
 * makes the field mandatory on v6.2.10+, so this has to be settled before
 * that firmware ships -- it belongs to the `feat/clientip-vendor-sync`
 * work, and is recorded here because this is the file that spells the wire
 * name.
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

/* ====================================================================== *
 * The rest of Omada's redirect.
 *
 * Doc 132060 again, and this time the sentence that makes this whole file
 * necessary rather than merely convenient:
 *
 *   "Your External Portal Server must preserve and return these parameters
 *   when interacting with the Omada Controller."
 *
 * Two redirect shapes, and a venue produces exactly one of them:
 *
 *   EAP/AP:  ?clientMac=..&clientIp=..&apMac=..&ssidName=..&t=..
 *            &radioId=..&site=..&redirectUrl=..
 *   Gateway: ?clientMac=..&clientIp=..&gatewayMac=..&vid=..&t=..
 *            &site=..&redirectUrl=..
 *
 * THREE SPELLINGS, DELIBERATELY -- the same three `client_ip` travels
 * through above. TP-Link's camelCase on the way in, our own backend's
 * snake_case across our API, TP-Link's camelCase again on the way out to
 * the controller. This module owns the middle spelling, and
 * `OMADA_REDIRECT_FIELD_MAP` below is the only place the translation is
 * written down.
 *
 * The middle spelling was read off the backend, not inferred from a naming
 * convention: `PortalAuthorizeRequest` in
 * `cloud-guest-repo/backend/app/domains/network_integration/schemas.py`,
 * whose fields `app/domains/network_integration/router.py` hands one by one
 * to `service.authorize_portal_client(...)`. Reading it mattered -- the
 * mapping is not uniformly "camelCase to snake_case": `site`, `t` and `vid`
 * keep their exact spelling, and `ssidName` becomes `ssid_name` rather than
 * the `guest_ssid_name` that the integration row and three other request
 * models on that same file use for the SSID. Guessing would have produced a
 * body with one plausible wrong key in it, which is the failure mode this
 * integration has already shipped once (see rule 1 above): pydantic's
 * default `extra="ignore"` drops an unrecognised key without a word.
 *
 * WHAT IS DELIBERATELY NOT HERE. `organization_id`, `location_id`,
 * `session_id` and `provider` are also on `PortalAuthorizeRequest`, and
 * none of them is an Omada redirect parameter -- how the venue is
 * identified is an open design question being answered elsewhere. This
 * module resolves nothing about them and invents nothing for them. It
 * carries the values only the controller can supply, and stops.
 *
 * TYPES. Doc 132060 writes every body value as a string; the backend takes
 * `radio_id` and `vid` as `int | None` and `t` as `str | None`. That
 * discrepancy is known, tracked, and NOT settled here. What this module
 * does is narrower and not in dispute: it renders each captured value into
 * the form ITS OWN backend field takes today, so `t` goes out as a string
 * even when TanStack handed it over as a number, and `radio_id`/`vid` go
 * out as numbers. If the backend's types change, this is the one file that
 * changes with them.
 * ====================================================================== */

/**
 * Omada's query-string spelling -> the body key the backend actually
 * parses. Exported so a test can assert the literals rather than re-typing
 * them, and so there is exactly one copy of the mapping in the repo.
 *
 * `clientIp` is absent on purpose: it is spelled by
 * `PORTAL_AUTHORIZE_CLIENT_IP_FIELD` above and carried by `withClientIp`,
 * which shipped first and is deliberately left untouched.
 */
export const OMADA_REDIRECT_FIELD_MAP = {
  clientMac: "client_mac",
  site: "site",
  apMac: "ap_mac",
  ssidName: "ssid_name",
  radioId: "radio_id",
  gatewayMac: "gateway_mac",
  vid: "vid",
  t: "t",
  redirectUrl: "redirect_url",
} as const;

/**
 * What `/portal` captured off the controller's redirect, in TP-Link's own
 * spelling.
 *
 * `string | number` on every field, because that is genuinely what arrives:
 * TanStack Router's default search parser JSON.parses each raw value, so
 * `radioId=1` and `t=1757548800000` reach this module as numbers, and so
 * does a `site` or `ssidName` that happens to be spelled with digits. See
 * `omadaRedirectParam` in src/lib/portal-search.ts.
 */
export interface OmadaRedirectCapture {
  clientMac?: string | number;
  site?: string | number;
  apMac?: string | number;
  ssidName?: string | number;
  radioId?: string | number;
  gatewayMac?: string | number;
  vid?: string | number;
  t?: string | number;
  redirectUrl?: string | number;
}

/**
 * The nine fields as they go on the authorize body: backend spelling,
 * backend types, top level.
 *
 * `radio_id`/`vid` are `number | string | null` rather than `number | null`
 * for one reason, and it is the "captured, never derived" rule again. The
 * backend declares them `int`, so a well-formed integer goes out as a
 * number. A value that is NOT a well-formed integer is passed through
 * exactly as the controller sent it, and the backend rejects the call with
 * a 422. Turning it into `null` instead would be inventing an absence the
 * controller never reported, and it would do so in the one direction that
 * hides the problem: `null` is a legal value for both fields, so the
 * authorize call would succeed while quietly omitting a parameter doc
 * 132060 requires us to return. A loud 422 names the bad value; a silent
 * null names nothing. (`normalizeClientIp` already takes this same branch
 * for an address it does not recognise, for the same reason.)
 */
export interface OmadaAuthorizeFields {
  client_mac: string | null;
  site: string | null;
  ap_mac: string | null;
  ssid_name: string | null;
  radio_id: number | string | null;
  gateway_mac: string | null;
  vid: number | string | null;
  t: string | null;
  redirect_url: string | null;
}

/**
 * A captured value reduced to the string form its backend field takes.
 *
 * A number is rendered back to text rather than rejected: `?t=1757548800000`
 * was text on the wire, TanStack's JSON.parse made it a number in transit,
 * and `String()` restores what the controller actually sent. That is
 * restoring a value, not deriving one.
 *
 * Present-but-empty and whitespace-only both mean "the controller told us
 * nothing" and become `null`, never `""`. Everything else is passed through
 * byte-for-byte after trimming: this is not the layer that decides whether
 * a MAC or a URL is well-formed, and dropping a value we do not recognise
 * would invent an absence.
 */
export function normalizeOmadaText(raw: string | number | null | undefined): string | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A captured value reduced to the form `radio_id`/`vid` take -- a number
 * where the controller sent an integer, and the raw value otherwise.
 *
 * `Number.isSafeInteger` rather than a bare `Number()`: a digit string long
 * enough to lose precision would be silently rewritten into a different
 * number, and a wrong VLAN id is worse than a rejected one. Such a value
 * goes through as text and the backend's own `ge`/`le` bounds refuse it.
 *
 * No clamping to the backend's ranges (`radio_id` 0-16, `vid` 0-4094)
 * either. Bounds are the backend's to enforce; a portal that quietly moved
 * an out-of-range value inside the range would be authorizing against a
 * radio or VLAN the controller never named.
 */
export function normalizeOmadaNumeric(
  raw: string | number | null | undefined,
): number | string | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = normalizeOmadaText(raw);
  if (text === null) return null;
  if (!/^-?\d+$/.test(text)) return text;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : text;
}

/**
 * The captured redirect, reduced to the nine body fields.
 *
 * Every key is always present, `null` where the redirect carried nothing,
 * for the same reason `client_ip` is: "the controller did not tell us" is a
 * statement on the wire, distinguishable from a caller who forgot the
 * field. Both documented shapes go through this unchanged -- an EAP
 * redirect leaves `gateway_mac`/`vid` null, a gateway redirect leaves
 * `ap_mac`/`ssid_name`/`radio_id` null, and neither absence is filled in
 * from the other shape.
 */
export function omadaAuthorizeFields(captured: OmadaRedirectCapture): OmadaAuthorizeFields {
  return {
    client_mac: normalizeOmadaText(captured.clientMac),
    site: normalizeOmadaText(captured.site),
    ap_mac: normalizeOmadaText(captured.apMac),
    ssid_name: normalizeOmadaText(captured.ssidName),
    radio_id: normalizeOmadaNumeric(captured.radioId),
    gateway_mac: normalizeOmadaText(captured.gatewayMac),
    vid: normalizeOmadaNumeric(captured.vid),
    t: normalizeOmadaText(captured.t),
    redirect_url: normalizeOmadaText(captured.redirectUrl),
  };
}

/**
 * Put the captured redirect parameters on an authorize body, at the top
 * level, under the names the backend actually parses.
 *
 * Same narrowness and same two rules as `withClientIp`, and composes with
 * it: `withClientIp(withOmadaRedirectParams(base, captured), clientIp)`
 * produces every controller-supplied field of `PortalAuthorizeRequest` and
 * nothing else. `session_id`, `organization_id`, `location_id` and
 * `provider` remain entirely the caller's, and remain an open design
 * question this module does not touch.
 *
 * Top level, never nested -- rule 1 above, which this integration has
 * already paid for once.
 */
export function withOmadaRedirectParams<T extends object>(
  body: T,
  captured: OmadaRedirectCapture,
): T & OmadaAuthorizeFields {
  return { ...body, ...omadaAuthorizeFields(captured) };
}

/* ====================================================================== *
 * The whole body, assembled.
 *
 * The four fields below are the ones NO redirect parameter supplies:
 * `session_id` is the GuestSession this platform issued after OTP, and the
 * venue triple comes off the portal token's own row server-side
 * (`GET /network-integrations/portal/resolve/{token}`), never off anything
 * the controller sent or a human typed. The comment above used to say how
 * the venue is identified was "an open design question being answered
 * elsewhere"; it has been answered, and this is where the two halves meet.
 *
 * Kept as a type in THIS module, next to the field map, for rule 1's sake:
 * every wire name of this call is spelled in one file, so a nested or
 * camelCased key is a type error here rather than a 200 with a field the
 * backend's `extra="ignore"` dropped in silence.
 * ====================================================================== */

/** The four fields the controller cannot tell us. */
export interface PortalAuthorizeIdentity {
  session_id: string;
  organization_id: string;
  location_id: string;
  provider: string;
}

/** The complete `POST /network-integrations/portal/authorize` body:
 * identity, plus every value the controller supplied, all at the top
 * level. `client_ip` is separate from the nine only because it shipped
 * first (see `withClientIp`). */
export type PortalAuthorizeBody = PortalAuthorizeIdentity &
  OmadaAuthorizeFields & { client_ip: string | null };

/**
 * Build the body. The one place a caller should ever assemble this call.
 *
 * Composes the two existing helpers in the order their own docstrings
 * describe (`withClientIp(withOmadaRedirectParams(base, captured), ip)`),
 * so nothing about how a value is rendered is decided twice.
 */
export function buildPortalAuthorizeBody(
  identity: PortalAuthorizeIdentity,
  captured: OmadaRedirectCapture,
  clientIp: string | null | undefined,
): PortalAuthorizeBody {
  return withClientIp(withOmadaRedirectParams(identity, captured), clientIp);
}
