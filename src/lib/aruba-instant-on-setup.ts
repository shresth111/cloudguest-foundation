/**
 * Aruba Instant On setup, Master console only: the shapes of the backend's
 * NAS-only routes (~/wyfy-ops/aruba-ap21/API_CONTRACT.md §2-§3), the words
 * for its gap codes, and a pre-check of the venue IP. Pure, so
 * `scripts/test-portal-aruba.mjs` can exercise it.
 *
 * Nothing here may reach a customer screen: it names RADIUS, the hub and a
 * public IP (PM_SPEC §0.1 item 2, `cloudguest_wireguard_customer_scope`).
 *
 * Every value ops types into Instant On comes from the backend -- the portal
 * URL already split into Instant On's boxes, the RADIUS server, the allowed
 * domains -- so this console never derives a URL or hardcodes the hub's
 * address (the backend reads it from `CLOUDGUEST_HUB_RADIUS_PUBLIC_ADDRESS`).
 */
import { toArubaSharedListener, type ArubaSharedListener } from "@/lib/aruba-shared-listener";

/** Instant On asks for the external portal in separate boxes. */
export interface ArubaPortalUrl {
  url: string;
  serverHost: string;
  serverUrlPath: string;
  serverPort: number;
  useHttps: boolean;
}

export interface ArubaRadiusServer {
  host: string;
  authPort: number;
  accountingPort: number;
}

/** `GET /platform/radius/nas/public/{router_id}`. The secret is never here. */
export interface ArubaSetupStatus {
  routerId: string;
  vendor: string;
  registered: boolean;
  nasId: string | null;
  nasIdentifier: string | null;
  nasIp: string | null;
  nasStatus: string | null;
  secretFingerprint: string | null;
  secretLength: number | null;
  hubConfirmed: boolean;
  radiusServer: ArubaRadiusServer | null;
  allowedDomains: string[];
  /** Null whenever `gaps` is non-empty. */
  portalUrl: ArubaPortalUrl | null;
  gaps: string[];
  /** The IP-independent alternative (shared listener, ports 1912/1913).
   * Null on a backend that predates it. */
  sharedListener: ArubaSharedListener | null;
}

/** `POST /platform/radius/nas/register-public/{router_id}`, and the rotate
 * route's equivalent. `sharedSecret` is returned ONCE and never stored. */
export interface ArubaRegistration {
  nasId: string | null;
  nasIdentifier: string;
  nasIp: string | null;
  sharedSecret: string;
  secretFingerprint: string | null;
  secretLength: number;
  hubConfirmed: boolean;
  rotated: boolean;
  /** The backend's own sentence for the half it cannot do (rotate only). */
  deviceAction: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- wire mappers */
export function toArubaPortalUrl(raw: any): ArubaPortalUrl | null {
  if (!raw || typeof raw !== "object" || typeof raw.url !== "string") return null;
  return {
    url: raw.url,
    serverHost: String(raw.server_host ?? ""),
    serverUrlPath: String(raw.server_url_path ?? ""),
    serverPort: Number(raw.server_port ?? 443),
    useHttps: raw.use_https !== false,
  };
}

export function toArubaSetupStatus(raw: any): ArubaSetupStatus {
  const rs = raw?.radius_server;
  return {
    routerId: String(raw?.router_id ?? ""),
    vendor: String(raw?.vendor ?? ""),
    registered: raw?.registered === true,
    nasId: raw?.nas_id ?? null,
    nasIdentifier: raw?.nas_identifier ?? null,
    nasIp: raw?.nas_ip ?? null,
    nasStatus: raw?.nas_status ?? null,
    secretFingerprint: raw?.secret_fingerprint ?? null,
    secretLength: typeof raw?.secret_length === "number" ? raw.secret_length : null,
    hubConfirmed: raw?.hub_confirmed === true,
    radiusServer:
      rs && typeof rs.host === "string" && rs.host
        ? {
            host: rs.host,
            authPort: Number(rs.auth_port ?? 1812),
            accountingPort: Number(rs.accounting_port ?? 1813),
          }
        : null,
    allowedDomains: Array.isArray(raw?.allowed_domains)
      ? raw.allowed_domains.filter((d: unknown): d is string => typeof d === "string")
      : [],
    portalUrl: toArubaPortalUrl(raw?.portal_url),
    gaps: Array.isArray(raw?.gaps)
      ? raw.gaps.filter((g: unknown): g is string => typeof g === "string")
      : [],
    sharedListener: toArubaSharedListener(raw?.shared_listener),
  };
}

export function toArubaRegistration(raw: any): ArubaRegistration {
  const secret = String(raw?.shared_secret ?? "");
  return {
    nasId: raw?.nas_id ?? raw?.id ?? null,
    nasIdentifier: String(raw?.nas_identifier ?? ""),
    nasIp: raw?.nas_ip ?? raw?.ip_address ?? null,
    sharedSecret: secret,
    secretFingerprint: raw?.secret_fingerprint ?? null,
    secretLength: typeof raw?.secret_length === "number" ? raw.secret_length : secret.length,
    hubConfirmed: raw?.hub_confirmed !== false,
    rotated: raw?.rotated === true || raw?.device_action_required === true,
    deviceAction: typeof raw?.device_action === "string" ? raw.device_action : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The RADIUS profile name ops creates in Instant On (PM_SPEC §0.3 step 1). */
export const ARUBA_RADIUS_PROFILE_NAME = "Wyfy Guest";

/**
 * Whether the checklist may show copyable values. Every backend value must be
 * present AND the backend must report no gap: `portal_url` is null whenever
 * `gaps` is non-empty, but the console does not rely on that alone.
 */
export function arubaSetupIsReady(s: ArubaSetupStatus): boolean {
  return (
    s.gaps.length === 0 && !!s.portalUrl && !!s.radiusServer && !!s.nasIdentifier && s.registered
  );
}

/** The backend's closed gap list, in ops' words. An unknown code is shown as
 * itself rather than dropped -- a gap nobody can read is still a gap. */
const GAP_COPY: Record<string, string> = {
  not_nas_only_vendor: "This device is not recorded as Aruba Instant On.",
  no_location: "This device has no location, so a guest could not be given a session.",
  nas_not_registered: "This venue is not registered with RADIUS yet (above).",
  hub_not_confirmed:
    "The hub has not confirmed this venue's RADIUS client. Register again to retry; until then every sign-in times out.",
  radius_server_address_not_configured:
    "The hub's public RADIUS address is not configured on the server (CLOUDGUEST_HUB_RADIUS_PUBLIC_ADDRESS). Ask an engineer.",
};

export function describeArubaSetupGap(code: string): string {
  return GAP_COPY[code] ?? code;
}

export type PublicIpProblem = "empty" | "not-ipv4" | "private";

/**
 * A pre-check of the venue public IP, for the sentence PM_SPEC §4 asks for.
 * The backend's `validate_controller_nas_address` is the authority and
 * refuses the same things (and more); this only saves a round trip.
 */
export function checkVenuePublicIp(raw: string): PublicIpProblem | null {
  const ip = raw.trim();
  if (!ip) return "empty";
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return "not-ipv4";
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return "not-ipv4";
  const [a, b] = o;
  const nonPublic =
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224;
  return nonPublic ? "private" : null;
}

export const PUBLIC_IP_PROBLEM_COPY: Record<PublicIpProblem, string> = {
  empty: "Enter the venue's public IP.",
  "not-ipv4": "Enter an IPv4 address, like 203.0.113.10.",
  private:
    "That's a private address. Use the venue's public IP, measured from a phone on the venue WiFi.",
};

// ---------------------------------------------------------------------------
// The setup page's header badge.
// ---------------------------------------------------------------------------

/**
 * The status badge on an Aruba row's setup page. NOT the fleet row's
 * `pending_provisioning` ("Awaiting check-in"): an Instant On site has no
 * agent, so nothing ever checks in and that badge would be permanent. What
 * this row actually waits on is RADIUS registration, which the panel below
 * already reads. `undefined` (loading, or the read failed) falls back to the
 * neutral "Set up in Instant On" rather than guessing.
 */
export function arubaSetupBadge(setup: ArubaSetupStatus | undefined): {
  label: string;
  tone: string;
} {
  if (!setup) return { label: "Set up in Instant On", tone: "normal" };
  if (!setup.registered) return { label: "Not registered with RADIUS", tone: "pending" };
  if (!setup.hubConfirmed) return { label: "Registered · hub not confirmed", tone: "warning" };
  return { label: "Registered with RADIUS", tone: "online" };
}

// ---------------------------------------------------------------------------
// Instant On read access (backend #327): `GET /platform/instant-on/sites`.
// ---------------------------------------------------------------------------

/** One mapped site, as `InstantOnSiteStatus` returns it. */
export interface InstantOnSiteStatus {
  routerId: string;
  siteId: string;
  siteName: string | null;
  pollEnabled: boolean;
  customerVisible: boolean;
  /** ok | auth_failed | incompatible | rate_limited | not_invited |
   * upstream_error | not_configured | never_polled */
  apiState: string;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

/** `InstantOnSitesResponse`: the poller's platform-wide switches plus every
 * mapped site. A DB read on the backend, never a call to Instant On. */
export interface InstantOnSitesOverview {
  pollerEnabled: boolean;
  serviceAccountConfigured: boolean;
  sites: InstantOnSiteStatus[];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- wire mapper */
export function toInstantOnSitesOverview(raw: any): InstantOnSitesOverview {
  return {
    pollerEnabled: raw?.poller_enabled === true,
    serviceAccountConfigured: raw?.service_account_configured === true,
    sites: Array.isArray(raw?.sites)
      ? raw.sites.map((s: any) => ({
          routerId: String(s?.router_id ?? ""),
          siteId: String(s?.site_id ?? ""),
          siteName: s?.site_name ?? null,
          pollEnabled: s?.poll_enabled === true,
          customerVisible: s?.customer_visible === true,
          apiState: String(s?.api_state ?? "never_polled"),
          lastSuccessAt: s?.last_success_at ?? null,
          lastErrorCode: s?.last_error_code ?? null,
          lastErrorMessage: s?.last_error_message ?? null,
        }))
      : [],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * One line about whether Wyfy is reading this venue's Instant On data (AP
 * status, clients, SSIDs, alerts) -- in ops' words, never as "connected"
 * unless the last poll actually succeeded.
 */
export function describeInstantOnReadAccess(
  overview: InstantOnSitesOverview,
  routerId: string,
): { state: "reading" | "off" | "failing" | "waiting"; sentence: string } {
  if (!overview.serviceAccountConfigured) {
    return {
      state: "off",
      sentence:
        "Not reading Instant On: the Wyfy Instant On service account is not configured on the platform yet.",
    };
  }
  const site = overview.sites.find((s) => s.routerId === routerId);
  if (!site) {
    return {
      state: "off",
      sentence:
        "Not reading Instant On: this row is not mapped to its Instant On site yet (an engineer maps it through the platform API).",
    };
  }
  const name = site.siteName ? `“${site.siteName}”` : site.siteId;
  if (!overview.pollerEnabled) {
    return {
      state: "off",
      sentence: `Mapped to Instant On site ${name}, but polling is switched off platform-wide.`,
    };
  }
  if (!site.pollEnabled) {
    return {
      state: "off",
      sentence: `Mapped to Instant On site ${name}, but polling is off for this venue.`,
    };
  }
  if (site.apiState === "ok") {
    return {
      state: "reading",
      sentence:
        `Reading Instant On site ${name}` +
        (site.lastSuccessAt ? `, last successful poll ${site.lastSuccessAt}.` : "."),
    };
  }
  if (site.apiState === "never_polled") {
    return {
      state: "waiting",
      sentence: `Mapped to Instant On site ${name}; waiting for the first poll.`,
    };
  }
  return {
    state: "failing",
    sentence:
      `Instant On reads for site ${name} are failing (${site.apiState})` +
      (site.lastErrorMessage ? `: ${site.lastErrorMessage}` : "."),
  };
}
