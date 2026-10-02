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
