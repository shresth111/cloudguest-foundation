import { api } from "@/services/api";
import { guestPortalApi } from "@/services/guest-portal-api";
import type { PortalAuthorizeBody } from "@/lib/portal-authorize-body";
import { resolveOrganizationId as sharedResolveOrganizationId } from "./organization-id";
import type {
  ControllerAuthMode,
  ControllerTlsMode,
  CreateNetworkIntegrationPayload,
  NetworkIntegration,
  NetworkIntegrationClient,
  NetworkIntegrationConnectionTest,
  NetworkIntegrationCredentials,
  NetworkIntegrationDevice,
  NetworkIntegrationDeviceType,
  NetworkIntegrationEvent,
  NetworkIntegrationEventListResult,
  NetworkIntegrationEventQuery,
  NetworkIntegrationListResult,
  NetworkIntegrationPlatformSummary,
  NetworkIntegrationSite,
  NetworkIntegrationSsid,
  NetworkIntegrationStatus,
  NetworkIntegrationStatusSnapshot,
  NetworkIntegrationSyncStatus,
  PlatformIntegrationQuery,
  PortalAuthorizeResult,
  TestNetworkIntegrationPayload,
  UpdateNetworkIntegrationPayload,
} from "@/types/network-integration";

/**
 * `/api/v1/network-integrations` — the TP-Link Omada controller integration.
 *
 * Written against `/Users/shresth/wyfy-omada/CONTRACT.md` §3, in the shape
 * `isp.service.ts` established: `Backend*` interfaces describe the wire
 * exactly as the backend sends it, `to*()` functions do the
 * snake_case → camelCase mapping, and nothing outside this module ever sees
 * a snake_case key. Components import from `@/types/network-integration`.
 *
 * ## THE ORG HEADER IS NOT OPTIONAL ON THE CUSTOMER ROUTES
 *
 * Every customer route in this domain resolves `CurrentOrganization` from
 * `X-Organization-Id` and gates on `RequirePermission("network_integrations.*")`.
 * Omitting that header does **not** loosen scoping — it downgrades the
 * caller to a GLOBAL-scope permission check, which an ordinary
 * customer/org-owner session never holds, so the request comes back
 * `403 Permission denied: 'network_integrations.read' is required at global
 * scope`. On reads, not only writes. That exact bug has been fixed twice in
 * this repo already (`isp.service.ts`, `mac-authorization.service.ts`, each
 * of which carries its own postmortem), so every customer method below
 * attaches it explicitly via {@link resolveOrganizationId}.
 *
 * `api.ts`'s request interceptor would attach it as a default anyway for an
 * org-scoped session — but it deliberately attaches *nothing* for a
 * global-scope operator, and it reads from `localStorage` rather than from
 * `/me/organizations`. Explicit beats both: it works for a member whose
 * membership list has not been persisted yet, and it makes the scope of each
 * call readable at the call site.
 *
 * ## AND IT MUST BE ABSENT ON THE PLATFORM ROUTES
 *
 * The `platform/*` methods at the bottom of this file send **no** org header,
 * intentionally. They are `ScopeType.GLOBAL` reads for the master console and
 * they are supposed to span every tenant. `hasGlobalScopeRole()` in `api.ts`
 * already suppresses the interceptor's default for operator sessions, which
 * is why `master.health.tsx`, `master.audit.tsx` and friends work at all.
 * Attaching an org id to a platform call would silently narrow the master
 * console to one tenant, which is a worse bug than a 403 because it looks
 * like it worked.
 *
 * That asymmetry is also the frontend half of the leak CONTRACT.md §3 warns
 * about: a GLOBAL caller gets `CurrentOrganization is None`, and `None` means
 * "no org filter" downstream. Isolation is enforced server-side — this file
 * cannot create it and must not undermine it — but it can at least be
 * unambiguous about which of the two scopes each request is asking for.
 *
 * ## CREDENTIALS
 *
 * They travel in a POST body and nowhere else. There is no method here that
 * returns one, no `Backend*` type with a credential field, and nothing in
 * this module writes to `localStorage`/`sessionStorage` or logs a payload.
 * The API's whole vocabulary for a stored credential is
 * `has_credentials: boolean`. See {@link credentialsForMode} for why the
 * unused half of the form is stripped before the request leaves.
 *
 * ## NO SINGLE-FLIGHT CACHE HERE, ON PURPOSE
 *
 * `isp.service.ts` grew a request coalescer because two independent hooks and
 * a dashboard leg all issue the same `GET /isp/links` on one page load, which
 * was *measured*. Nothing here has that shape: the customer page has one
 * reader per endpoint and the master console one, both through React Query,
 * which dedupes its own queries. Adding a second cache in front of it would
 * be a cache with no measurement behind it — the exact thing this repo's own
 * `wyfy_bundle_perf_measurement` note warns against. If a duplicate read
 * ever shows up in a real capture, measure it first, then copy that file's
 * pattern.
 */
async function resolveOrganizationId(): Promise<string> {
  // Delegates to the one shared resolver — a module-local cache here is how
  // `/me/organizations` came to be fetched once per active service on a
  // single page load. See services/organization-id.ts.
  return sharedResolveOrganizationId();
}

/** Headers for an org-scoped (customer) call. */
async function orgHeaders(): Promise<Record<string, string>> {
  return { "X-Organization-Id": await resolveOrganizationId() };
}

// ---------------------------------------------------------------------------
// Wire shapes. Exactly as CONTRACT.md §3 writes them.
// ---------------------------------------------------------------------------

interface BackendNetworkIntegration {
  id: string;
  organization_id: string;
  location_id: string | null;
  organization_name?: string | null;
  location_name: string | null;
  provider: string;
  name: string;
  status: string;
  is_enabled: boolean;
  base_url: string;
  auth_mode: string;
  tls_mode?: string | null;
  tls_pinned_sha256?: string | null;
  controller_id: string | null;
  controller_version: string | null;
  external_site_id: string | null;
  external_site_name: string | null;
  guest_ssid_name: string | null;
  guest_ssid_id: string | null;
  session_duration_seconds: number;
  sync_interval_seconds: number;
  last_sync_at: string | null;
  last_sync_status: string;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_at: string | null;
  device_count: number;
  client_count: number;
  active_authorization_count: number;
  has_credentials: boolean;
  portal_url_scheme?: string | null;
  portal_url_host_and_query?: string | null;
  portal_readiness_gaps?: string[] | null;
  created_at: string;
  updated_at: string;
}

/** `POST /network-integrations/portal/authorize`. */
interface BackendPortalAuthorize {
  authorized?: boolean | null;
  provider?: string | null;
  expires_at?: string | null;
  redirect_url?: string | null;
}

interface BackendNetworkIntegrationSite {
  site_id: string;
  name: string;
  device_count?: number | null;
  client_count?: number | null;
}

interface BackendNetworkIntegrationSsid {
  ssid_id: string | null;
  name: string;
  portal_enabled?: boolean | null;
}

interface BackendNetworkIntegrationDevice {
  mac: string;
  name: string | null;
  device_type: string;
  model: string | null;
  status: string;
  ip_address?: string | null;
  firmware_version?: string | null;
  uptime_seconds?: number | null;
  client_count?: number | null;
}

interface BackendNetworkIntegrationClient {
  mac: string;
  name?: string | null;
  ip_address?: string | null;
  ssid?: string | null;
  ap_mac?: string | null;
  radio_id?: number | null;
  vlan_id?: number | null;
  is_guest?: boolean | null;
  is_authorized?: boolean | null;
  connected_since?: string | null;
  duration_seconds?: number | null;
  traffic_down_bytes?: number | null;
  traffic_up_bytes?: number | null;
  signal_dbm?: number | null;
}

interface BackendNetworkIntegrationEvent {
  id: string;
  event_type: string;
  status: string;
  error_code: string | null;
  message: string | null;
  created_at: string;
}

interface BackendPlatformSummary {
  tenant_count?: number;
  integration_count?: number;
  connected_count?: number;
  error_count?: number;
  disabled_count?: number;
  device_count?: number;
  client_count?: number;
  active_authorization_count?: number;
  last_sync_at?: string | null;
}

/**
 * INFERRED (CONTRACT.md §3 pins the route but not the body) — see
 * `NetworkIntegrationConnectionTest`'s own note and the entry in
 * CHANGE-REQUESTS.md. Modelled on the gateway's `ControllerInfo`
 * (`omadac_id`, `controller_version`, `model`, `supports_openapi`), with
 * `controller_id` accepted as an alias because that is the name the
 * *integration* row uses for the same value and the backend may well
 * normalise to it. Everything optional; {@link toConnectionTest} treats a
 * 2xx with no recognisable field as "connected, details unknown" rather
 * than throwing, because a probe that succeeded is useful information even
 * if we cannot name the box.
 */
interface BackendConnectionTest {
  ok?: boolean;
  success?: boolean;
  omadac_id?: string | null;
  controller_id?: string | null;
  controller_version?: string | null;
  model?: string | null;
  supports_openapi?: boolean | null;
  error_code?: string | null;
  message?: string | null;
  tls_fingerprint_sha256?: string | null;
  tls_chain_trusted?: boolean | null;
  tls_matches_pin?: boolean | null;
  tls_certificate_subject?: string | null;
  tls_certificate_issuer?: string | null;
  tls_certificate_expires_at?: string | null;
}

/** INFERRED, same caveat: this reads correctly whether `/{id}/status`
 * returns a small status object or the whole integration row again. */
interface BackendStatusSnapshot {
  status?: string | null;
  is_enabled?: boolean | null;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  last_error_at?: string | null;
  device_count?: number | null;
  client_count?: number | null;
  active_authorization_count?: number | null;
}

/** The repo-standard paginated envelope every other domain returns. */
interface BackendPage<T> {
  items: T[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// ---------------------------------------------------------------------------
// Mapping.
// ---------------------------------------------------------------------------

function toIntegration(i: BackendNetworkIntegration): NetworkIntegration {
  return {
    id: i.id,
    organizationId: i.organization_id,
    locationId: i.location_id,
    // `organization_name` is documented as "platform routes only", so it is
    // genuinely absent (not null) on the customer routes. Normalised to null
    // so components have one thing to check instead of two.
    organizationName: i.organization_name ?? null,
    locationName: i.location_name,
    // Cast, not validation: the backend owns this enum and a value outside it
    // is a backend bug, not something the UI should paper over. Presentation
    // is total over the seven documented statuses and falls back to a neutral
    // "Unknown" chip for anything else rather than crashing a table.
    provider: i.provider as NetworkIntegration["provider"],
    name: i.name,
    status: i.status as NetworkIntegrationStatus,
    isEnabled: i.is_enabled,
    baseUrl: i.base_url,
    authMode: i.auth_mode as ControllerAuthMode,
    // `strict` when absent: it is the column default, and an older backend
    // that does not send the field has made no other decision.
    tlsMode: (i.tls_mode as ControllerTlsMode | null | undefined) ?? "strict",
    tlsPinnedSha256: i.tls_pinned_sha256 ?? null,
    controllerId: i.controller_id,
    controllerVersion: i.controller_version,
    externalSiteId: i.external_site_id,
    externalSiteName: i.external_site_name,
    guestSsidName: i.guest_ssid_name,
    guestSsidId: i.guest_ssid_id,
    sessionDurationSeconds: i.session_duration_seconds,
    syncIntervalSeconds: i.sync_interval_seconds,
    lastSyncAt: i.last_sync_at,
    lastSyncStatus: i.last_sync_status as NetworkIntegrationSyncStatus,
    lastErrorCode: i.last_error_code,
    lastErrorMessage: i.last_error_message,
    lastErrorAt: i.last_error_at,
    deviceCount: i.device_count,
    clientCount: i.client_count,
    activeAuthorizationCount: i.active_authorization_count,
    hasCredentials: i.has_credentials,
    // Both `?? null` together, never `?? ""`. The backend withholds these
    // as a pair when the integration cannot serve a guest at all, and an
    // empty string would render as a copyable field containing nothing.
    portalUrlScheme: i.portal_url_scheme ?? null,
    portalUrlHostAndQuery: i.portal_url_host_and_query ?? null,
    // `?? []` rather than `?? null`: an older backend that does not send the
    // field is not the same statement as "this integration has no gaps", but
    // the only honest behaviour for a dashboard that cannot know is to show
    // the link and let the resolve endpoint be the authority -- which it is
    // regardless of what this array says.
    portalReadinessGaps: i.portal_readiness_gaps ?? [],
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

function toSite(s: BackendNetworkIntegrationSite): NetworkIntegrationSite {
  return {
    siteId: s.site_id,
    name: s.name,
    deviceCount: s.device_count ?? null,
    clientCount: s.client_count ?? null,
  };
}

function toSsid(s: BackendNetworkIntegrationSsid): NetworkIntegrationSsid {
  return {
    ssidId: s.ssid_id,
    name: s.name,
    // `?? null`, never `?? false`. "The controller did not tell us whether
    // the portal is on" and "the portal is off" are different facts and the
    // wizard says so.
    portalEnabled: s.portal_enabled ?? null,
  };
}

function toDevice(d: BackendNetworkIntegrationDevice): NetworkIntegrationDevice {
  return {
    mac: d.mac,
    name: d.name,
    deviceType: d.device_type as NetworkIntegrationDeviceType,
    model: d.model,
    status: d.status,
    ipAddress: d.ip_address ?? null,
    firmwareVersion: d.firmware_version ?? null,
    uptimeSeconds: d.uptime_seconds ?? null,
    clientCount: d.client_count ?? null,
  };
}

function toClient(c: BackendNetworkIntegrationClient): NetworkIntegrationClient {
  return {
    mac: c.mac,
    name: c.name ?? null,
    ipAddress: c.ip_address ?? null,
    ssid: c.ssid ?? null,
    apMac: c.ap_mac ?? null,
    radioId: c.radio_id ?? null,
    vlanId: c.vlan_id ?? null,
    isGuest: c.is_guest ?? null,
    isAuthorized: c.is_authorized ?? null,
    connectedSince: c.connected_since ?? null,
    durationSeconds: c.duration_seconds ?? null,
    trafficDownBytes: c.traffic_down_bytes ?? null,
    trafficUpBytes: c.traffic_up_bytes ?? null,
    signalDbm: c.signal_dbm ?? null,
  };
}

function toEvent(e: BackendNetworkIntegrationEvent): NetworkIntegrationEvent {
  return {
    id: e.id,
    eventType: e.event_type,
    status: e.status,
    errorCode: e.error_code,
    message: e.message,
    createdAt: e.created_at,
  };
}

function toConnectionTest(t: BackendConnectionTest): NetworkIntegrationConnectionTest {
  // A 2xx from a probe endpoint means the probe ran. `ok`/`success` are only
  // consulted to let the backend report a *negative* result with a 200 if it
  // chooses to; absent both, a 200 is a pass. A failure that arrives as a
  // non-2xx never reaches here at all — it rejects as an `AppError` and the
  // caller maps its `code` through `describeIntegrationError`.
  const ok = t.ok ?? t.success ?? true;
  return {
    ok,
    controllerId: t.controller_id ?? t.omadac_id ?? null,
    controllerVersion: t.controller_version ?? null,
    model: t.model ?? null,
    supportsOpenApi: t.supports_openapi ?? null,
    errorCode: t.error_code ?? null,
    message: t.message ?? null,
    tlsFingerprintSha256: t.tls_fingerprint_sha256 ?? null,
    tlsChainTrusted: t.tls_chain_trusted ?? null,
    tlsMatchesPin: t.tls_matches_pin ?? null,
    tlsCertificateSubject: t.tls_certificate_subject ?? null,
    tlsCertificateIssuer: t.tls_certificate_issuer ?? null,
    tlsCertificateExpiresAt: t.tls_certificate_expires_at ?? null,
  };
}

function toStatusSnapshot(s: BackendStatusSnapshot): NetworkIntegrationStatusSnapshot {
  return {
    status: (s.status as NetworkIntegrationStatus | null | undefined) ?? null,
    isEnabled: s.is_enabled ?? null,
    lastSyncAt: s.last_sync_at ?? null,
    lastSyncStatus: (s.last_sync_status as NetworkIntegrationSyncStatus | null | undefined) ?? null,
    lastErrorCode: s.last_error_code ?? null,
    lastErrorMessage: s.last_error_message ?? null,
    lastErrorAt: s.last_error_at ?? null,
    deviceCount: s.device_count ?? null,
    clientCount: s.client_count ?? null,
    activeAuthorizationCount: s.active_authorization_count ?? null,
  };
}

function toSummary(s: BackendPlatformSummary): NetworkIntegrationPlatformSummary {
  return {
    tenantCount: s.tenant_count ?? 0,
    integrationCount: s.integration_count ?? 0,
    connectedCount: s.connected_count ?? 0,
    errorCount: s.error_count ?? 0,
    disabledCount: s.disabled_count ?? 0,
    deviceCount: s.device_count ?? 0,
    clientCount: s.client_count ?? 0,
    activeAuthorizationCount: s.active_authorization_count ?? 0,
    lastSyncAt: s.last_sync_at ?? null,
  };
}

/**
 * Pulls rows out of a list response whose envelope is not pinned by the
 * contract.
 *
 * CONTRACT.md §3 documents the nested list *element* shapes
 * (`sites[] {...}`, `devices[] {...}`) without saying whether
 * `GET /{id}/sites` answers with a bare array, `{ items: [...] }`, or
 * `{ sites: [...] }`. All three are plausible readings of that line and all
 * three exist elsewhere in this backend. Rather than guess and ship a page
 * that renders an empty table against a working endpoint — a failure that
 * looks exactly like "the venue has no access points" — this accepts any of
 * them and is documented as the ambiguity it is. Logged in
 * CHANGE-REQUESTS.md; when the backend lands, this can collapse to one
 * branch.
 *
 * Note this is `unknown`-in by design: it is the one place in this module
 * that inspects an unvalidated payload, so the `as` casts are contained here
 * instead of being sprinkled through fifteen methods.
 */
function unwrapRows<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const bag = payload as Record<string, unknown>;
    for (const candidate of [key, "items", "rows", "data"]) {
      if (Array.isArray(bag[candidate])) return bag[candidate] as T[];
    }
  }
  return [];
}

/** The paginated envelope, tolerant of a bare array for the same reason. */
function unwrapPage<T>(payload: unknown, key: string): BackendPage<T> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const bag = payload as Partial<BackendPage<T>> & Record<string, unknown>;
    if (Array.isArray(bag.items)) {
      return {
        items: bag.items,
        page: bag.page ?? 1,
        page_size: bag.page_size ?? bag.items.length,
        total_items: bag.total_items ?? bag.items.length,
        total_pages: bag.total_pages ?? 1,
        has_next: bag.has_next ?? false,
        has_previous: bag.has_previous ?? false,
      };
    }
  }
  const rows = unwrapRows<T>(payload, key);
  return {
    items: rows,
    page: 1,
    page_size: rows.length,
    total_items: rows.length,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  };
}

/**
 * Sends only the credentials the selected auth mode actually uses.
 *
 * - legacy  -> the hotspot operator pair, and never an Open API app pair.
 * - openapi -> the app pair AND the operator pair.
 *
 * The second line used to strip the operator pair, on the theory that an
 * Open API integration never used it. That theory was the bug: the
 * controller authorises guests only through its operator login, in either
 * mode, so an Open API integration stored without it could never let anybody
 * online. The Open API form now asks for the operator account on purpose,
 * and it is sent.
 *
 * What is still stripped is the pair a mode genuinely never reads: an app
 * client secret typed into the draft and then abandoned by switching to
 * legacy would otherwise be encrypted and kept for no reason, and a secret
 * retained for no reason can leak for no reason.
 *
 * Empty strings are dropped too, so an absent field is absent rather than
 * blank.
 */
function credentialsForMode(
  authMode: ControllerAuthMode,
  credentials: NetworkIntegrationCredentials,
): Record<string, string> {
  const keep = (value: string | undefined) => (value && value.length > 0 ? value : undefined);
  const out: Record<string, string> = {};
  if (authMode === "openapi") {
    const clientId = keep(credentials.clientId);
    const clientSecret = keep(credentials.clientSecret);
    if (clientId) out.client_id = clientId;
    if (clientSecret) out.client_secret = clientSecret;
  }
  const username = keep(credentials.username);
  const password = keep(credentials.password);
  if (username) out.username = username;
  if (password) out.password = password;
  return out;
}

/** Certificate trust and the Omada ID, as the backend spells them. Keys are
 * omitted rather than sent as `null` when the caller did not set them, so a
 * create keeps the backend's `strict` default and a PATCH leaves both alone. */
function trustFields(payload: {
  controllerId?: string | null;
  tlsMode?: ControllerTlsMode;
  tlsPinnedSha256?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  const controllerId = payload.controllerId?.trim();
  if (controllerId) out.controller_id = controllerId;
  if (payload.tlsMode) out.tls_mode = payload.tlsMode;
  const pin = payload.tlsPinnedSha256?.trim();
  if (pin) out.tls_pinned_sha256 = pin;
  return out;
}

const BASE = "/network-integrations";

export const networkIntegrationService = {
  // -------------------------------------------------------------------------
  // Customer (org-scoped) routes.
  // -------------------------------------------------------------------------

  /** Every integration this organization owns. The customer page filters by
   * location client-side: the list is one row per controller per venue, so it
   * is small, and a location filter the backend has not documented is not one
   * to invent here. */
  async list(): Promise<NetworkIntegrationListResult> {
    const headers = await orgHeaders();
    const { data } = await api.get<unknown>(BASE, { headers });
    const page = unwrapPage<BackendNetworkIntegration>(data, "integrations");
    return {
      rows: page.items.map(toIntegration),
      total: page.total_items,
      totalPages: page.total_pages,
      hasNext: page.has_next,
      hasPrevious: page.has_previous,
    };
  },

  async get(id: string): Promise<NetworkIntegration> {
    const headers = await orgHeaders();
    const { data } = await api.get<BackendNetworkIntegration>(`${BASE}/${id}`, { headers });
    return toIntegration(data);
  },

  async create(payload: CreateNetworkIntegrationPayload): Promise<NetworkIntegration> {
    const headers = await orgHeaders();
    const { data } = await api.post<BackendNetworkIntegration>(
      BASE,
      {
        provider: payload.provider,
        name: payload.name,
        base_url: payload.baseUrl,
        auth_mode: payload.authMode,
        // Spread at the TOP LEVEL, not nested under a `credentials` key.
        // `NetworkIntegrationCreateRequest` extends `_CredentialFields`, so
        // the backend reads `client_id`/`client_secret`/`username`/`password`
        // as siblings of `base_url`. A nested object is not rejected -- it is
        // silently ignored (pydantic's default is `extra="ignore"`), which
        // means a wrong shape here does not fail loudly: it produces a 201
        // for an integration with no stored credentials, permanently
        // UNCONFIGURED, and the venue finds out when Test Connection cannot
        // authenticate. Only the selected mode's pair is included.
        ...credentialsForMode(payload.authMode, payload.credentials),
        ...trustFields(payload),
        location_id: payload.locationId ?? null,
        external_site_id: payload.externalSiteId ?? null,
        external_site_name: payload.externalSiteName ?? null,
        guest_ssid_id: payload.guestSsidId ?? null,
        guest_ssid_name: payload.guestSsidName ?? null,
        session_duration_seconds: payload.sessionDurationSeconds,
        sync_interval_seconds: payload.syncIntervalSeconds,
      },
      { headers },
    );
    return toIntegration(data);
  },

  /** PATCH, and only the keys the caller passed. `undefined` is omitted by
   * `JSON.stringify`, so an absent key means "leave it alone" while an
   * explicit `null` means "clear it" — which is how the wizard un-maps a
   * location without also clearing the site. */
  async update(id: string, payload: UpdateNetworkIntegrationPayload): Promise<NetworkIntegration> {
    const headers = await orgHeaders();
    const { data } = await api.patch<BackendNetworkIntegration>(
      `${BASE}/${id}`,
      {
        name: payload.name,
        is_enabled: payload.isEnabled,
        location_id: payload.locationId,
        external_site_id: payload.externalSiteId,
        external_site_name: payload.externalSiteName,
        guest_ssid_id: payload.guestSsidId,
        guest_ssid_name: payload.guestSsidName,
        session_duration_seconds: payload.sessionDurationSeconds,
        sync_interval_seconds: payload.syncIntervalSeconds,
        ...trustFields(payload),
      },
      { headers },
    );
    return toIntegration(data);
  },

  /**
   * Register this controller as its venue's fleet device.
   *
   * The repair for an integration created from this page before the backend
   * did that on its own: it shows `fleet_device_missing` and has no portal
   * link, because every guest session needs a device to belong to.
   * Idempotent -- a controller that is already registered comes back
   * unchanged -- and refused with `NETWORK_INTEGRATION_LOCATION_REQUIRED`
   * when the integration is not mapped to a venue yet.
   */
  async ensureFleetDevice(id: string): Promise<NetworkIntegration> {
    const headers = await orgHeaders();
    const { data } = await api.post<BackendNetworkIntegration>(
      `${BASE}/${id}/fleet-device`,
      undefined,
      { headers },
    );
    return toIntegration(data);
  },

  async remove(id: string): Promise<void> {
    const headers = await orgHeaders();
    await api.delete(`${BASE}/${id}`, { headers });
  },

  /**
   * The pre-save probe. Credentials are in the body; nothing is persisted.
   *
   * A longer timeout than `api.ts`'s 20s default, deliberately: this makes
   * the backend authenticate against a controller that may be on the far end
   * of a hotel's ADSL line, and the backend's own budget is
   * `omada_api_timeout_seconds` (15s default) *per attempt* with a bounded
   * retry on top of it. Timing out client-side while the server is still
   * waiting produces the worst possible answer — "could not connect" for a
   * controller that was about to reply. Same reasoning as
   * `ispService.runSpeedTest`'s own 75s override.
   */
  async testDraftConnection(
    payload: TestNetworkIntegrationPayload,
  ): Promise<NetworkIntegrationConnectionTest> {
    const headers = await orgHeaders();
    const { data } = await api.post<BackendConnectionTest>(
      `${BASE}/test-connection`,
      {
        provider: payload.provider,
        base_url: payload.baseUrl,
        auth_mode: payload.authMode,
        // Top-level, for the same reason as `create` above --
        // `TestConnectionRequest` extends the same `_CredentialFields`.
        ...credentialsForMode(payload.authMode, payload.credentials),
        // A self-signed controller cannot pass a strict probe, so the draft
        // test has to be able to carry the trust decision it is testing.
        ...trustFields(payload),
      },
      { headers, timeout: 60_000 },
    );
    return toConnectionTest(data);
  },

  /** Re-probe an integration that already exists, using its stored
   * credentials. Nothing is sent — that is the point: this is the button a
   * venue owner presses without having the password to hand. */
  async testConnection(id: string): Promise<NetworkIntegrationConnectionTest> {
    const headers = await orgHeaders();
    const { data } = await api.post<BackendConnectionTest>(
      `${BASE}/${id}/test-connection`,
      undefined,
      { headers, timeout: 60_000 },
    );
    return toConnectionTest(data);
  },

  /**
   * Credential rotation. Write-only in the strongest sense available to a
   * browser: the request carries the new secret, the response carries a
   * status, and no code path anywhere reads one back.
   */
  async replaceCredentials(
    id: string,
    authMode: ControllerAuthMode,
    credentials: NetworkIntegrationCredentials,
  ): Promise<NetworkIntegration> {
    const headers = await orgHeaders();
    const { data } = await api.post<BackendNetworkIntegration>(
      `${BASE}/${id}/credentials`,
      {
        auth_mode: authMode,
        // Top-level: `NetworkIntegrationCredentialRotateRequest` carries the
        // four credential fields directly alongside `auth_mode`.
        ...credentialsForMode(authMode, credentials),
      },
      { headers },
    );
    return toIntegration(data);
  },

  /** Force a poll now instead of waiting for the sweep. Same extended
   * timeout as the connection test: this talks to the controller. */
  async sync(id: string): Promise<NetworkIntegration> {
    const headers = await orgHeaders();
    const { data } = await api.post<BackendNetworkIntegration>(`${BASE}/${id}/sync`, undefined, {
      headers,
      timeout: 60_000,
    });
    return toIntegration(data);
  },

  async getStatus(id: string): Promise<NetworkIntegrationStatusSnapshot> {
    const headers = await orgHeaders();
    const { data } = await api.get<BackendStatusSnapshot>(`${BASE}/${id}/status`, { headers });
    return toStatusSnapshot(data);
  },

  /** Live from the controller, not from our own tables — so it is slower than
   * every other read on the page and is fetched on demand (the wizard's site
   * step, the detail view's refresh), never as part of first paint. */
  async listSites(id: string): Promise<NetworkIntegrationSite[]> {
    const headers = await orgHeaders();
    const { data } = await api.get<unknown>(`${BASE}/${id}/sites`, { headers, timeout: 60_000 });
    return unwrapRows<BackendNetworkIntegrationSite>(data, "sites").map(toSite);
  },

  async listSsids(id: string): Promise<NetworkIntegrationSsid[]> {
    const headers = await orgHeaders();
    const { data } = await api.get<unknown>(`${BASE}/${id}/ssids`, { headers, timeout: 60_000 });
    return unwrapRows<BackendNetworkIntegrationSsid>(data, "ssids").map(toSsid);
  },

  async listDevices(id: string): Promise<NetworkIntegrationDevice[]> {
    const headers = await orgHeaders();
    const { data } = await api.get<unknown>(`${BASE}/${id}/devices`, { headers, timeout: 60_000 });
    return unwrapRows<BackendNetworkIntegrationDevice>(data, "devices").map(toDevice);
  },

  async listClients(id: string): Promise<NetworkIntegrationClient[]> {
    const headers = await orgHeaders();
    const { data } = await api.get<unknown>(`${BASE}/${id}/clients`, { headers, timeout: 60_000 });
    return unwrapRows<BackendNetworkIntegrationClient>(data, "clients").map(toClient);
  },

  async listEvents(
    id: string,
    q: NetworkIntegrationEventQuery = {},
  ): Promise<NetworkIntegrationEventListResult> {
    const headers = await orgHeaders();
    const { data } = await api.get<unknown>(`${BASE}/${id}/events`, {
      params: { page: q.page ?? 1, page_size: q.pageSize ?? 20 },
      headers,
    });
    const page = unwrapPage<BackendNetworkIntegrationEvent>(data, "events");
    return {
      rows: page.items.map(toEvent),
      total: page.total_items,
      totalPages: page.total_pages,
      hasNext: page.has_next,
      hasPrevious: page.has_previous,
    };
  },

  // -------------------------------------------------------------------------
  // Platform (GLOBAL-scope) routes — master console only.
  //
  // No `X-Organization-Id` on any of these. See this module's header: these
  // reads are supposed to span every tenant, `api.ts` already withholds the
  // default header for a global-scope operator, and attaching one here would
  // narrow the master console to a single customer while looking like it
  // worked.
  // -------------------------------------------------------------------------

  async getPlatformSummary(): Promise<NetworkIntegrationPlatformSummary> {
    const { data } = await api.get<BackendPlatformSummary>(`${BASE}/platform/summary`);
    return toSummary(data);
  },

  async listPlatformIntegrations(
    q: PlatformIntegrationQuery = {},
  ): Promise<NetworkIntegrationListResult> {
    const { data } = await api.get<unknown>(`${BASE}/platform/integrations`, {
      params: {
        organization_id: q.organizationId,
        provider: q.provider,
        status: q.status,
        // Trimmed and dropped when empty rather than sent as `""` — an empty
        // `q` is "no filter", and a backend that treats it as "match the
        // empty string" would return nothing.
        q: q.q && q.q.trim() ? q.q.trim() : undefined,
        page: q.page ?? 1,
        page_size: q.pageSize ?? 25,
      },
    });
    const page = unwrapPage<BackendNetworkIntegration>(data, "integrations");
    return {
      rows: page.items.map(toIntegration),
      total: page.total_items,
      totalPages: page.total_pages,
      hasNext: page.has_next,
      hasPrevious: page.has_previous,
    };
  },

  async getPlatformIntegration(id: string): Promise<NetworkIntegration> {
    const { data } = await api.get<BackendNetworkIntegration>(
      `${BASE}/platform/integrations/${id}`,
    );
    return toIntegration(data);
  },

  async listPlatformEvents(
    id: string,
    q: NetworkIntegrationEventQuery = {},
  ): Promise<NetworkIntegrationEventListResult> {
    const { data } = await api.get<unknown>(`${BASE}/platform/integrations/${id}/events`, {
      params: { page: q.page ?? 1, page_size: q.pageSize ?? 20 },
    });
    const page = unwrapPage<BackendNetworkIntegrationEvent>(data, "events");
    return {
      rows: page.items.map(toEvent),
      total: page.total_items,
      totalPages: page.total_pages,
      hasNext: page.has_next,
      hasPrevious: page.has_previous,
    };
  },

  async enablePlatformIntegration(id: string): Promise<NetworkIntegration> {
    const { data } = await api.post<BackendNetworkIntegration>(
      `${BASE}/platform/integrations/${id}/enable`,
    );
    return toIntegration(data);
  },

  async disablePlatformIntegration(id: string): Promise<NetworkIntegration> {
    const { data } = await api.post<BackendNetworkIntegration>(
      `${BASE}/platform/integrations/${id}/disable`,
    );
    return toIntegration(data);
  },

  async testPlatformConnection(id: string): Promise<NetworkIntegrationConnectionTest> {
    const { data } = await api.post<BackendConnectionTest>(
      `${BASE}/platform/integrations/${id}/test-connection`,
      undefined,
      { timeout: 60_000 },
    );
    return toConnectionTest(data);
  },
};

// ---------------------------------------------------------------------------
// The guest-facing half. Different client, and that is the whole point.
// ---------------------------------------------------------------------------

/**
 * The one public portal call, on `guestPortalApi` and never on `api`.
 *
 * `api` carries an admin JWT, a 401-refresh-retry loop, and (via
 * {@link resolveOrganizationId}) an `X-Organization-Id` header read out of
 * `localStorage`. A guest's browser has none of those things and must not
 * appear to: the org header in particular would be a *claim about which
 * tenant this is*, sent by an unauthenticated caller, to an endpoint whose
 * whole job is to check that claim against a real `GuestSession`. The
 * backend ignores it on this route, so this is not a live vulnerability --
 * it is the reason the wrong client must never be used here, stated before
 * somebody reaches for the one the rest of this file uses.
 *
 * `guestPortalApi` is the same client `portal-runtime.service.ts` uses for
 * `/captive-portal/resolve`, `/otp/request` and `/guest/login/otp` -- the
 * calls that already happen on either side of this one in a guest's
 * journey.
 */
export const guestPortalIntegrationService = {
  /**
   * Tell the venue's controller to let this guest's device online.
   *
   * The Omada equivalent of the MikroTik `link-login-only` form POST, and
   * the step that was missing: this endpoint has existed, tested and
   * correct, with no caller anywhere in this repo.
   *
   * The body is passed through verbatim. It is assembled by
   * `src/lib/portal-authorize-body.ts`, which is the single place the wire
   * names are spelled -- top level, snake_case, never nested. This method
   * deliberately does not build or reshape it: the one shipped cross-repo
   * bug in this integration was a frontend nesting fields under a key the
   * backend's `extra="ignore"` then dropped without a word.
   */
  async authorizePortal(body: PortalAuthorizeBody): Promise<PortalAuthorizeResult> {
    const { data } = await guestPortalApi.post<BackendPortalAuthorize>(
      `${BASE}/portal/authorize`,
      body,
    );
    return {
      authorized: !!data.authorized,
      provider: data.provider ?? null,
      expiresAt: data.expires_at ?? null,
      redirectUrl: data.redirect_url ?? null,
    };
  },
};
