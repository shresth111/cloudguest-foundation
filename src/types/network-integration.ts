/**
 * Frontend mirrors of the `/api/v1/network-integrations` surface.
 *
 * WHAT THIS FILE IS
 * -----------------
 * The backend speaks snake_case (`external_site_id`, `last_sync_at`); every
 * component in this app speaks camelCase. Same split every other domain here
 * uses (`types/isp.ts`, `types/nas.ts`, `types/mac-authorization.ts`): the
 * `Backend*` wire shapes live in the service module and never escape it, and
 * these are the only shapes a component is allowed to see. If you find
 * yourself writing `integration.last_sync_at` in a `.tsx` file, the mapping
 * has a hole in it -- fix the service, don't widen a type here.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * Credentials. Not as a field on `NetworkIntegration`, not as an optional,
 * not as a `string | null`. The backend contract says `has_credentials:
 * true` and never the credential itself, and the only credential-shaped type
 * in this file is `NetworkIntegrationCredentials` -- a *request* payload,
 * write-only by construction, which no response type extends. That is on
 * purpose: a field that cannot be read back cannot be leaked into a React
 * Query key, a log line, or localStorage by a well-meaning later edit.
 *
 * Source of truth: `/Users/shresth/wyfy-omada/CONTRACT.md` §3.
 */

/** The only provider that exists today. Modelled as a union rather than a
 * bare `string` so that the day a second controller vendor lands, every
 * switch statement that needs a new branch fails typecheck instead of
 * silently falling through to the Omada copy. Omada is a *pluggable
 * provider*, not the product (CONTRACT.md ground rules), and this type is
 * where that promise is kept on the frontend. */
export type NetworkIntegrationProvider = "omada";

/**
 * How the platform authenticates to the controller. Chosen per integration,
 * never guessed.
 *
 * - `openapi` -- client id + client secret, issued by the controller's own
 *   *Settings > Platform Integration > Open API* screen. Requires Omada
 *   Controller v5.13 or newer.
 * - `legacy`  -- a hotspot *operator* name + password, which is what the
 *   external-portal API has always used. Works from v5.0.15 up.
 *
 * These are not interchangeable and the UI must not let a customer paste an
 * operator password into a client-secret field: the wizard renders different
 * inputs per mode for exactly that reason.
 */
export type ControllerAuthMode = "openapi" | "legacy";

export const CONTROLLER_AUTH_MODE_LABEL: Record<ControllerAuthMode, string> = {
  openapi: "Open API app",
  legacy: "Hotspot operator account",
};

/**
 * The trade-off between the two modes, in one sentence each, shown at the
 * point of choosing rather than discovered afterwards.
 *
 * This is CR-002 (`/Users/shresth/wyfy-omada/CHANGE-REQUESTS.md`). A hotspot
 * operator credential provably cannot read sites, devices or clients — the
 * gateway refuses those calls in legacy mode rather than issuing them,
 * because the controller's own auth failure reads as "wrong password" and
 * sends people debugging a credential that is in fact correct. So a customer
 * who picks legacy without being told loses half the screens, with nothing
 * on the way in to warn them.
 *
 * Note what legacy does NOT lose, and say it: the captive portal. That is
 * what the external-portal API is *for*, and it works fully. Only inventory
 * and telemetry need Open API.
 */
export const CONTROLLER_AUTH_MODE_SUMMARY: Record<ControllerAuthMode, string> = {
  openapi:
    "Everything: guest sign-in is enforced, and we can also list your sites, access points and connected clients. Needs Omada Controller 5.13 or newer.",
  legacy:
    "Guest sign-in only — fully supported, and this is what the operator account exists for. We cannot read your sites, access points or connected clients with it, so those screens stay empty and the site and network names have to be typed in by hand. Works on Omada Controller 5.0.15 and newer.",
};

/**
 * Whether inventory and telemetry reads (`/sites`, `/ssids`, `/devices`,
 * `/clients`) are possible at all for an integration.
 *
 * One named predicate rather than an `=== "openapi"` sprinkled through the
 * UI: the pickers, the two tables and the KPI tiles all have to agree, and
 * the day a third auth mode or a firmware capability flag arrives, this is
 * the one place that changes. Callers use it to render the honest
 * "requires Open API credentials" state *instead of issuing the request*,
 * which is deliberate — the backend does return a normalized error, but a
 * request whose answer we already know is a request not worth making, and an
 * error banner reads worse than an explanation.
 */
export function authModeSupportsInventory(mode: ControllerAuthMode): boolean {
  return mode === "openapi";
}

/** Heading for that state. Shared so the tables, the KPI hints and the
 * wizard cannot describe the same limitation three different ways. */
export const LEGACY_INVENTORY_TITLE = "Needs Open API credentials";

/** The body. It has three jobs, in this order: say what is missing, say what
 * still works (so nobody concludes their guest WiFi is broken), and say what
 * to do about it. */
export const LEGACY_INVENTORY_BODY =
  "This controller is connected with a hotspot operator account, which cannot read sites, access points or connected clients — that is a limit of the operator API itself, not a problem with your credentials. Guest sign-in is unaffected and fully supported. To see this screen, add an Open API app on the controller (Settings → Platform Integration → Open API, controller 5.13 or newer) and replace the credentials here.";

/**
 * Every state an integration can be in. All seven are rendered -- see
 * {@link NETWORK_INTEGRATION_STATUS_LABEL} and
 * {@link NETWORK_INTEGRATION_STATUS_DETAIL}.
 *
 * `auth_failed` and `sync_error` are the pair most likely to get collapsed
 * into one "something's wrong" badge by a later tidy-up, and they must not
 * be. `auth_failed` means the credentials on file are rejected: nothing will
 * work again until somebody re-enters them. `sync_error` means the
 * credentials are fine and a poll failed -- a controller reboot, a flaky
 * link, a rate limit -- which usually clears itself on the next sweep. Those
 * are different jobs for the person reading the screen (go find the password
 * vs. wait five minutes), so they get different words.
 */
export type NetworkIntegrationStatus =
  | "connected"
  | "connecting"
  | "auth_failed"
  | "connection_failed"
  | "disabled"
  | "sync_error"
  | "unconfigured";

/** Result of the most recent poll. `never` is a real, distinct value: an
 * integration that has never synced is not the same as one whose last sync
 * succeeded, and rendering the two identically is how "last synced: --"
 * comes to mean two different things on one screen. */
export type NetworkIntegrationSyncStatus = "ok" | "error" | "never";

/**
 * The normalized error codes the backend promises to return (CONTRACT.md §2
 * table + §3 "Error payloads").
 *
 * Two types, on purpose. {@link KnownNetworkIntegrationErrorCode} is the
 * closed set we have written copy for -- it is what keys
 * {@link NETWORK_INTEGRATION_ERROR_COPY}, so adding a code to that union
 * without adding a sentence for it fails typecheck. The wire type is a plain
 * string, because a backend that ships a new code before this file learns
 * about it must not crash a component's lookup and must not be silently
 * swallowed either: {@link describeIntegrationError} falls back to the
 * backend's own human-safe `message`, and only shows a generic line when
 * there is no message at all. What it never does is print the raw code at a
 * customer.
 */
export type KnownNetworkIntegrationErrorCode =
  | "OMADA_AUTH_FAILED"
  | "OMADA_CONNECTION_FAILED"
  | "OMADA_TIMEOUT"
  | "OMADA_RATE_LIMITED"
  | "OMADA_INVALID_CONTROLLER"
  | "OMADA_SITE_NOT_FOUND"
  | "OMADA_CLIENT_NOT_FOUND"
  | "OMADA_AUTHORIZATION_FAILED"
  | "OMADA_API_UNSUPPORTED"
  | "OMADA_SESSION_EXPIRED"
  | "NETWORK_INTEGRATION_NOT_FOUND"
  | "NETWORK_INTEGRATION_DISABLED"
  | "NETWORK_INTEGRATION_URL_REJECTED"
  | "NETWORK_INTEGRATION_PROVIDER_UNSUPPORTED"
  | "GUEST_SESSION_NOT_ACTIVE";

export type NetworkIntegrationErrorCode = string;

export interface NetworkIntegration {
  id: string;
  organizationId: string;
  locationId: string | null;
  /** Populated on the platform (master console) routes only -- the
   * org-scoped customer routes have no reason to echo the caller's own
   * organization name back at them, so this is `null` there. */
  organizationName: string | null;
  locationName: string | null;
  provider: NetworkIntegrationProvider;
  name: string;
  status: NetworkIntegrationStatus;
  isEnabled: boolean;
  /** Safe to show, and shown: the controller URL is the one piece of
   * connection config a venue owner needs to recognise their own box. It is
   * user-supplied and SSRF-validated server-side (CONTRACT.md §6); the
   * browser never fetches it. */
  baseUrl: string;
  authMode: ControllerAuthMode;
  controllerId: string | null;
  controllerVersion: string | null;
  externalSiteId: string | null;
  externalSiteName: string | null;
  guestSsidName: string | null;
  guestSsidId: string | null;
  sessionDurationSeconds: number;
  syncIntervalSeconds: number;
  lastSyncAt: string | null;
  lastSyncStatus: NetworkIntegrationSyncStatus;
  lastErrorCode: NetworkIntegrationErrorCode | null;
  /** Already human-safe per the contract (the gateway guarantees `str(exc)`
   * carries no secret, cookie, token or raw controller body). The frontend
   * still owns the copy: {@link describeIntegrationError} prefers our own
   * sentence for a known code and only falls through to this. */
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  deviceCount: number;
  clientCount: number;
  activeAuthorizationCount: number;
  /** Whether a credential is on file. NEVER the credential. This is the only
   * thing the API will ever say about it and the only thing the UI needs:
   * "on file / not on file" plus a Replace action. */
  hasCredentials: boolean;
  /** The External Portal Server URL a venue operator pastes into their
   * Omada controller, split the way TP-Link's own form splits it: a
   * `Scheme` field and a `URL` field.
   *
   * IT IS THE MIKROTIK URL. Same `/portal` route, same three ids, same
   * page -- because the controller *appends* its own parameters to a
   * configured query string with `&` (observed on real hardware
   * 2026-09-11, not inferred from the documentation's template). So an
   * Omada guest sees exactly the captive portal a MikroTik guest sees,
   * and there is no second entry point to keep in step with the first.
   *
   * SHOWN IN FULL, on purpose, and NOT the same category as
   * `hasCredentials` above. A credential is a secret this platform holds
   * on a customer's behalf and may never render; this is a URL that will
   * be in every one of that venue's guests' address bars within minutes of
   * being pasted, and the dashboard is the only place its operator can
   * learn it -- unlike MikroTik, where this platform writes the equivalent
   * page onto the device itself.
   *
   * TWO FIELDS BECAUSE THE CONTROLLER HAS TWO. `serverUrl`'s own
   * validation pattern contains no scheme, so an operator who pastes a
   * whole `https://...` string gets a validation error. Both are `null`
   * together, and only when the integration cannot serve a guest at all --
   * see `portalReadinessGaps`. */
  portalUrlScheme: string | null;
  portalUrlHostAndQuery: string | null;
  /** Everything standing between this integration and its first authorized
   * guest, from the backend's own `portal_readiness_gaps` -- the same
   * predicate `GET /portal/resolve/{token}` refuses on.
   *
   * Empty means a guest can sign in. Non-empty means the resolve endpoint
   * would answer every guest with a 404, so the portal-configuration block
   * names the gap instead of handing over a link that will turn everyone
   * away. Machine-readable on purpose: the dashboard has to ACT on this,
   * and parsing it out of `lastErrorMessage`'s English sentence is the
   * coupling `NetworkIntegrationErrorCode` exists to avoid.
   *
   * `fleet_device_missing` is the one an operator cannot fix themselves --
   * a self-service integration legitimately has no fleet device, which
   * makes it inventory-and-telemetry only until someone pairs it with one.
   * An existing product boundary, invisible until the guest flow made it
   * decide whether anybody can sign in. */
  portalReadinessGaps: string[];
  createdAt: string;
  updatedAt: string;
}

/** What `POST /network-integrations/portal/authorize` answered.
 *
 * `authorized: false` is a real, non-exceptional outcome: the call reached
 * the controller and the controller declined. That is different from the
 * call failing, and the portal must not report it as success -- the
 * MikroTik half of this flow has its own postmortem about a page that said
 * "you're connected" on evidence it did not have. */
export interface PortalAuthorizeResult {
  authorized: boolean;
  provider: string | null;
  expiresAt: string | null;
  /** Echoed back from the request. The controller chose it, this platform
   * never fetches it, and it is handed to the guest's own browser to
   * navigate to. */
  redirectUrl: string | null;
}

/** A site as the controller itself reports it -- live read, not a stored
 * row, so counts here are a snapshot and may disagree with the integration's
 * own `deviceCount`/`clientCount` between syncs. */
export interface NetworkIntegrationSite {
  siteId: string;
  name: string;
  deviceCount: number | null;
  clientCount: number | null;
}

export interface NetworkIntegrationSsid {
  ssidId: string | null;
  name: string;
  /** `null` means the controller did not say, which is not the same as
   * `false`. The wizard shows "unknown" rather than warning about a portal
   * that may well be enabled. */
  portalEnabled: boolean | null;
}

export type NetworkIntegrationDeviceType = "ap" | "switch" | "gateway" | "unknown";

/** The gateway normalizes this to
 * `connected | disconnected | pending | unknown`, but it is typed as a
 * string for the same reason the error code is: a controller firmware we
 * have not seen must render, not crash. Presentation falls back to the
 * "Unknown" bucket for anything outside the four. */
export type NetworkIntegrationDeviceStatus = string;

export interface NetworkIntegrationDevice {
  mac: string;
  name: string | null;
  deviceType: NetworkIntegrationDeviceType;
  model: string | null;
  status: NetworkIntegrationDeviceStatus;
  ipAddress: string | null;
  firmwareVersion: string | null;
  uptimeSeconds: number | null;
  clientCount: number | null;
}

export interface NetworkIntegrationClient {
  mac: string;
  name: string | null;
  ipAddress: string | null;
  ssid: string | null;
  apMac: string | null;
  radioId: number | null;
  vlanId: number | null;
  isGuest: boolean | null;
  isAuthorized: boolean | null;
  connectedSince: string | null;
  durationSeconds: number | null;
  trafficDownBytes: number | null;
  trafficUpBytes: number | null;
  signalDbm: number | null;
}

/** One row of the error/sync/auth feed. `message` and `context` are
 * pre-redacted at write time server-side (CONTRACT.md §4), which is why this
 * is safe to render verbatim -- but see `describeIntegrationError`: a known
 * `errorCode` still gets our sentence, because "connection reset by peer" is
 * true and useless. */
export interface NetworkIntegrationEvent {
  id: string;
  eventType: string;
  status: string;
  errorCode: NetworkIntegrationErrorCode | null;
  message: string | null;
  createdAt: string;
}

export interface NetworkIntegrationPlatformSummary {
  tenantCount: number;
  integrationCount: number;
  connectedCount: number;
  errorCount: number;
  disabledCount: number;
  deviceCount: number;
  clientCount: number;
  activeAuthorizationCount: number;
  lastSyncAt: string | null;
}

/**
 * The credential half of a create / rotate request. Write-only: nothing in
 * this file returns it and nothing may store it.
 *
 * Both modes are optional fields on one type rather than a discriminated
 * union because the form holds a draft of both while the user flips the auth
 * mode radio, and a union would force a cast at every keystroke. The service
 * layer only sends the pair the selected mode actually uses -- see
 * `network-integration.service.ts`'s `credentialsForMode`.
 */
export interface NetworkIntegrationCredentials {
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}

export interface CreateNetworkIntegrationPayload {
  provider: NetworkIntegrationProvider;
  name: string;
  baseUrl: string;
  authMode: ControllerAuthMode;
  credentials: NetworkIntegrationCredentials;
  locationId?: string | null;
  /** Optional at create time. The wizard creates the row first (so that the
   * `/{id}/sites` and `/{id}/ssids` reads have an id to hang off) and then
   * PATCHes the site/SSID mapping in, which is exactly the gap the
   * `unconfigured` status describes. */
  externalSiteId?: string | null;
  externalSiteName?: string | null;
  guestSsidId?: string | null;
  guestSsidName?: string | null;
  sessionDurationSeconds?: number;
  syncIntervalSeconds?: number;
}

/** Every field optional -- a PATCH sends only what changed. Credentials are
 * absent by design: they rotate through their own endpoint
 * (`POST /{id}/credentials`) so that a routine "rename this integration"
 * PATCH can never be the request that carries a secret. */
export interface UpdateNetworkIntegrationPayload {
  name?: string;
  isEnabled?: boolean;
  locationId?: string | null;
  externalSiteId?: string | null;
  externalSiteName?: string | null;
  guestSsidId?: string | null;
  guestSsidName?: string | null;
  sessionDurationSeconds?: number;
  syncIntervalSeconds?: number;
}

/** Body of the pre-save probe (`POST /network-integrations/test-connection`).
 * Nothing is persisted by that call, which is the whole point of it: the
 * wizard can tell the customer "these credentials do not work" before it has
 * written a row anywhere. */
export interface TestNetworkIntegrationPayload {
  provider: NetworkIntegrationProvider;
  baseUrl: string;
  authMode: ControllerAuthMode;
  credentials: NetworkIntegrationCredentials;
}

/**
 * What a connection test tells us.
 *
 * INFERRED SHAPE -- flagged, not hidden. CONTRACT.md §3 lists the
 * `test-connection` routes but does not pin their response body; §2 says the
 * gateway's own `test_connection()` returns a `ControllerInfo`
 * (`omadac_id`, `controller_version`, `model`, `supports_openapi`), so that
 * is what this mirrors. Every field is optional and the service maps
 * defensively, so a backend that returns more (or names things slightly
 * differently, e.g. `controller_id` instead of `omadac_id`) degrades to
 * "connected, details unknown" rather than throwing. Logged in
 * `/Users/shresth/wyfy-omada/CHANGE-REQUESTS.md` for the backend engineer to
 * confirm or correct.
 */
export interface NetworkIntegrationConnectionTest {
  ok: boolean;
  controllerId: string | null;
  controllerVersion: string | null;
  model: string | null;
  supportsOpenApi: boolean | null;
  /** Present only on a failure. Mapped through
   * {@link describeIntegrationError} before it reaches a human. */
  errorCode: NetworkIntegrationErrorCode | null;
  message: string | null;
}

/**
 * `GET /{id}/status` -- the cheap "is it still up?" poll.
 *
 * Also an inferred shape (see the note on
 * {@link NetworkIntegrationConnectionTest}). Deliberately typed as a subset
 * of `NetworkIntegration`'s live fields with everything nullable, because
 * the most likely backend implementations are both "a small status object"
 * and "the whole integration row again", and this type reads correctly
 * either way -- the service maps whichever fields are present.
 */
export interface NetworkIntegrationStatusSnapshot {
  status: NetworkIntegrationStatus | null;
  isEnabled: boolean | null;
  lastSyncAt: string | null;
  lastSyncStatus: NetworkIntegrationSyncStatus | null;
  lastErrorCode: NetworkIntegrationErrorCode | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  deviceCount: number | null;
  clientCount: number | null;
  activeAuthorizationCount: number | null;
}

/**
 * A site plus the SSIDs on it, as returned by the **Master-scoped** pre-save
 * probe.
 *
 * INFERRED — see CR-004 in `/Users/shresth/wyfy-omada/CHANGE-REQUESTS.md`.
 * CONTRACT.md §11.6 requires the Master device-add wizard to do
 * "Test Connection → load Omada sites → select site → select guest SSID"
 * *before* Save, and at that point no integration row exists, so `/{id}/sites`
 * and `/{id}/ssids` cannot be the source. Nesting the SSIDs inside each site
 * keeps that whole step to one round trip and matches how Omada itself is
 * shaped (a site owns its WLAN groups). If the probe comes back with no
 * sites, the wizard falls back to typed names — the same path legacy mode
 * always takes — so this being wrong degrades rather than blocks.
 */
export interface NetworkIntegrationProbeSite extends NetworkIntegrationSite {
  ssids: NetworkIntegrationSsid[];
}

/** What the Master-scoped pre-save probe returns: the same controller
 * information the customer-side test gives, plus the inventory the wizard
 * needs to offer a picker. Also INFERRED (CR-004). */
export interface NetworkIntegrationProbeResult extends NetworkIntegrationConnectionTest {
  sites: NetworkIntegrationProbeSite[];
}

/**
 * One Master-scoped request that registers an Omada controller as a fleet
 * device and connects it, which CONTRACT.md §11.7 asks the backend to do in a
 * single transaction.
 *
 * It is one call rather than two on purpose. Sequencing
 * `POST /routers` then `POST /network-integrations` from the browser would
 * leave an orphaned `Router` row behind whenever the second call failed — a
 * device in the fleet inventory that no agent will ever check in for and that
 * §11.5 warns will then be reported as a broken MikroTik. A browser cannot
 * offer a transaction; the backend can.
 *
 * The device half also cannot be skipped: `RouterCreateRequest` requires
 * `serial_number`, a 17-character `mac_address` and `model`, and
 * `GuestSession.router_id` is NOT NULL — so an Omada venue's guests cannot
 * log in without a `Router` row at all (§11.4). CR-004 asks what those
 * fields should hold for a *software* controller, which has no model plate;
 * until that is answered the wizard asks the operator rather than inventing
 * values.
 */
export interface CreatePlatformOmadaDevicePayload {
  /** Device half — the `Router` row, `vendor` fixed to `tplink_omada`. */
  locationId: string;
  name: string;
  model: string;
  serialNumber: string;
  macAddress: string;
  managementIpAddress?: string;
  publicIpAddress?: string;
  /** Controller half — the `network_integration` row. */
  baseUrl: string;
  authMode: ControllerAuthMode;
  credentials: NetworkIntegrationCredentials;
  externalSiteId?: string | null;
  externalSiteName?: string | null;
  guestSsidId?: string | null;
  guestSsidName?: string | null;
}

export interface NetworkIntegrationEventQuery {
  page?: number;
  pageSize?: number;
}

export interface PlatformIntegrationQuery {
  organizationId?: string;
  provider?: NetworkIntegrationProvider;
  status?: NetworkIntegrationStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** The repo's standard list result (see `IspLinkListResult` etc.) -- `rows`
 * plus the pagination the backend's own paginated envelope carries. */
export interface NetworkIntegrationListResult {
  rows: NetworkIntegration[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface NetworkIntegrationEventListResult {
  rows: NetworkIntegrationEvent[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ---------------------------------------------------------------------------
// Copy. The vocabulary lives here; the pixels live in the components.
// ---------------------------------------------------------------------------

/** Short badge text. Same "labels live in the types module" precedent as
 * `NAS_STATUS_LABEL` in types/nas.ts, so the customer page and the master
 * console cannot drift into calling the same state two different things. */
export const NETWORK_INTEGRATION_STATUS_LABEL: Record<NetworkIntegrationStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  auth_failed: "Sign-in rejected",
  connection_failed: "Can't reach controller",
  disabled: "Turned off",
  sync_error: "Sync failing",
  unconfigured: "Setup incomplete",
};

/**
 * The sentence under the badge. One job each: say what is true, and say what
 * the reader should do about it.
 *
 * The `auth_failed` / `sync_error` pair is the reason this table exists
 * rather than a single generic "Not working" string. Read them next to each
 * other -- they send the reader to two different places, which is the honest
 * outcome, because they are two different faults.
 */
export const NETWORK_INTEGRATION_STATUS_DETAIL: Record<NetworkIntegrationStatus, string> = {
  connected: "The controller answered on the last check. Guest logins are being authorised.",
  connecting: "Waiting on the controller's first successful reply. This usually takes seconds.",
  auth_failed:
    "The controller rejected the credentials we have on file. Nothing will work until they are replaced — check the operator account or Open API app on the controller, then use Replace credentials.",
  connection_failed:
    "The credentials were not the problem — we could not reach the controller at all. Check that it is powered on, that the URL and port are right, and that it is reachable from the internet.",
  disabled:
    "Switched off on purpose. Guest logins at this venue are not being sent to the controller.",
  sync_error:
    "The credentials are fine and the last sign-in worked — a background refresh failed, so the device and client lists below may be out of date. This often clears itself on the next sync.",
  unconfigured:
    "Connected to the controller, but no site and guest network have been chosen yet, so nothing is being authorised. Finish setup to start.",
};

/** Semantic tone, not a colour. Each surface maps this onto its own design
 * system (`Badge` classes on the customer side, `MTag` tones in the master
 * console) -- so neither one hardcodes a hex value and neither one can end
 * up green for a state the other paints red. */
export type NetworkIntegrationStatusTone = "success" | "warning" | "danger" | "neutral" | "info";

export const NETWORK_INTEGRATION_STATUS_TONE: Record<
  NetworkIntegrationStatus,
  NetworkIntegrationStatusTone
> = {
  connected: "success",
  connecting: "info",
  // Credentials are wrong: this venue is broken and stays broken until a
  // human acts. Red.
  auth_failed: "danger",
  connection_failed: "danger",
  disabled: "neutral",
  // Amber, not red: authorisation still works, the inventory is just stale.
  sync_error: "warning",
  unconfigured: "warning",
};

/**
 * Normalized backend error code -> a sentence a venue owner can act on.
 *
 * Nothing here echoes the code, a stack trace, or a controller response
 * body. The gateway already promises its exception strings are safe, but
 * "safe" and "useful" are different bars: `OMADA_RATE_LIMITED` is safe and
 * tells a hotel manager nothing, so it is rewritten into what actually
 * happened and what to do next.
 */
export const NETWORK_INTEGRATION_ERROR_COPY: Record<KnownNetworkIntegrationErrorCode, string> = {
  OMADA_AUTH_FAILED:
    "The controller rejected our sign-in. The stored credentials are no longer valid — replace them to reconnect.",
  OMADA_CONNECTION_FAILED:
    "We could not reach the controller. Check that it is switched on and that its address and port are correct.",
  OMADA_TIMEOUT:
    "The controller did not answer in time. It may be busy, or the link to it may be congested.",
  OMADA_RATE_LIMITED:
    "The controller is asking us to slow down, so this check was skipped. It will be retried automatically.",
  OMADA_INVALID_CONTROLLER:
    "That address answered, but it does not look like an Omada controller. Double-check the URL — the controller ID is part of the path.",
  OMADA_SITE_NOT_FOUND:
    "The site chosen for this venue no longer exists on the controller. Pick a site again.",
  OMADA_CLIENT_NOT_FOUND:
    "The controller no longer knows about that device — it has probably disconnected.",
  OMADA_AUTHORIZATION_FAILED:
    "The controller refused to let that guest online. Their sign-in worked; the network step did not.",
  // Covers two real situations, so it says both rather than guessing which
  // one the reader is in: a controller too old for us at all, and a
  // legacy-mode integration asking for inventory it can never have (CR-002).
  // The UI avoids the second case by not making the request -- see
  // `authModeSupportsInventory` -- but the code can still arrive, and when it
  // does this must not tell someone to upgrade a controller that is fine.
  OMADA_API_UNSUPPORTED:
    "The controller cannot answer that with the credentials in use. Reading sites, access points and clients needs an Open API app on Omada Controller 5.13 or newer; a hotspot operator account covers guest sign-in only. Controllers older than 5.0.15 are not supported at all.",
  OMADA_SESSION_EXPIRED:
    "Our session with the controller expired and could not be renewed. Usually transient — retry, and replace the credentials if it persists.",
  NETWORK_INTEGRATION_NOT_FOUND: "This integration no longer exists. It may have been removed.",
  NETWORK_INTEGRATION_DISABLED:
    "This integration is switched off, so nothing is being sent to the controller.",
  NETWORK_INTEGRATION_URL_REJECTED:
    "That controller address was rejected. It must be an HTTPS address on a public host and one of the standard controller ports.",
  NETWORK_INTEGRATION_PROVIDER_UNSUPPORTED:
    "That controller type is not supported on this platform yet.",
  GUEST_SESSION_NOT_ACTIVE:
    "The guest's session is no longer active, so it could not be authorised on the network.",
};

/**
 * The one function any surface should call to turn an error into words.
 *
 * Order of preference, and each step is deliberate:
 *   1. our own sentence for a code we know -- actionable, and written for a
 *      venue owner rather than for an engineer;
 *   2. the backend's `message`, which the contract guarantees is human-safe,
 *      for a code we have not seen yet (a new backend release must not
 *      degrade to a shrug);
 *   3. a generic line, only when there is genuinely nothing to say.
 *
 * What it never returns is the raw code. A screen that prints
 * `OMADA_SESSION_EXPIRED` at a hotel manager has told them nothing and
 * leaked an internal identifier while doing it.
 */
export function describeIntegrationError(
  code: string | null | undefined,
  backendMessage?: string | null,
): string {
  // The table is keyed by the closed union (so a new known code cannot be
  // added without copy), but the value on the wire is an open string --
  // hence the one widening cast, here, rather than weakening the table.
  const known = code ? (NETWORK_INTEGRATION_ERROR_COPY as Record<string, string>)[code] : undefined;
  if (known) return known;
  if (backendMessage && backendMessage.trim()) return backendMessage.trim();
  return "Something went wrong talking to the controller. Try again, and contact support if it keeps happening.";
}

/** Which statuses mean "a human needs to do something". Used for the master
 * console's error tile and the customer page's banner, so both consoles
 * agree on what counts as broken. `sync_error` is included: stale inventory
 * is a real fault even though authorisation still works. */
export const NETWORK_INTEGRATION_ERROR_STATUSES: readonly NetworkIntegrationStatus[] = [
  "auth_failed",
  "connection_failed",
  "sync_error",
];

export function isNetworkIntegrationErrored(status: NetworkIntegrationStatus): boolean {
  return NETWORK_INTEGRATION_ERROR_STATUSES.includes(status);
}
