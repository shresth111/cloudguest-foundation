/**
 * The shared Aruba Instant On RADIUS listener (cloud-guest
 * `app.domains.guest.aruba_shared`): the IP-INDEPENDENT alternative to
 * registering a venue's public IP.
 *
 * The hub listens on its own UDP ports (1912 auth / 1913 accounting) with one
 * platform-wide Aruba shared secret and accepts any source address. The venue
 * is identified from INSIDE each packet: the NAS-Identifier typed into the
 * Instant On RADIUS profile must name this device, and the AP MAC the access
 * point sends in Called-Station-Id must equal the AP MAC recorded on this
 * device. So a venue whose public IP changes (dynamic IP, dual WAN, failover)
 * keeps working.
 *
 * Master-only. The shared secret is shown once, on set/rotate, and rotating it
 * breaks every venue on this listener until it is retyped in each site.
 */

export interface ArubaSharedRadiusServer {
  host: string;
  authPort: number;
  accountingPort: number;
}

/** `shared_listener` on `GET /platform/radius/nas/public/{router_id}`. */
export interface ArubaSharedListener {
  available: boolean;
  radiusServer: ArubaSharedRadiusServer | null;
  authPort: number;
  accountingPort: number;
  nasIdentifier: string;
  apMac: string | null;
  secretConfigured: boolean;
  secretFingerprint: string | null;
  secretLength: number | null;
  secretRotatedAt: string | null;
  hubConfirmed: boolean;
  gaps: string[];
}

/** `GET /platform/radius/aruba-shared` (and the rotate response, which adds
 * the secret once). */
export interface ArubaSharedSecretStatus {
  listenerInstalled: boolean;
  secretConfigured: boolean;
  secretFingerprint: string | null;
  secretLength: number | null;
  secretRotatedAt: string | null;
  hubConfirmed: boolean;
  authPort: number;
  accountingPort: number;
  radiusServer: ArubaSharedRadiusServer | null;
}

export interface ArubaSharedSecretRotated extends ArubaSharedSecretStatus {
  sharedSecret: string;
  deviceAction: string;
}

const SHARED_GAP_COPY: Record<string, string> = {
  listener_not_installed:
    "This platform has no shared Aruba RADIUS listener installed (an engineer sets it up on the RADIUS hub).",
  shared_secret_not_set:
    "The shared Aruba secret has not been set yet. Set it below; it is shown once.",
  hub_not_confirmed:
    "The RADIUS hub has not confirmed the current shared Aruba secret. Rotate it to push it again.",
  nas_not_registered:
    "This device has no NAS-Identifier yet. Use “Use the shared listener for this venue”.",
  no_ap_mac:
    "This device has no AP MAC address on record. The shared listener matches the access point's MAC, so record it on the device first.",
  radius_server_address_not_configured:
    "The RADIUS hub's public address is not configured on this platform.",
};

export function describeSharedListenerGap(code: string): string {
  return SHARED_GAP_COPY[code] ?? code;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- wire mappers */
function toServer(raw: any): ArubaSharedRadiusServer | null {
  if (!raw || typeof raw.host !== "string" || !raw.host) return null;
  return {
    host: raw.host,
    authPort: Number(raw.auth_port ?? 1912),
    accountingPort: Number(raw.accounting_port ?? 1913),
  };
}

function strings(raw: any): string[] {
  return Array.isArray(raw) ? raw.filter((g: unknown): g is string => typeof g === "string") : [];
}

/** Null when the backend predates the shared listener (no field). */
export function toArubaSharedListener(raw: any): ArubaSharedListener | null {
  if (!raw || typeof raw !== "object" || typeof raw.nas_identifier !== "string") return null;
  return {
    available: raw.available === true,
    radiusServer: toServer(raw.radius_server),
    authPort: Number(raw.auth_port ?? 1912),
    accountingPort: Number(raw.accounting_port ?? 1913),
    nasIdentifier: raw.nas_identifier,
    apMac: typeof raw.ap_mac === "string" ? raw.ap_mac : null,
    secretConfigured: raw.secret_configured === true,
    secretFingerprint: raw.secret_fingerprint ?? null,
    secretLength: typeof raw.secret_length === "number" ? raw.secret_length : null,
    secretRotatedAt: raw.secret_rotated_at ?? null,
    hubConfirmed: raw.hub_confirmed === true,
    gaps: strings(raw.gaps),
  };
}

export function toArubaSharedSecretStatus(raw: any): ArubaSharedSecretStatus {
  return {
    listenerInstalled: raw?.listener_installed === true,
    secretConfigured: raw?.secret_configured === true,
    secretFingerprint: raw?.secret_fingerprint ?? null,
    secretLength: typeof raw?.secret_length === "number" ? raw.secret_length : null,
    secretRotatedAt: raw?.secret_rotated_at ?? null,
    hubConfirmed: raw?.hub_confirmed === true,
    authPort: Number(raw?.auth_port ?? 1912),
    accountingPort: Number(raw?.accounting_port ?? 1913),
    radiusServer: toServer(raw?.radius_server),
  };
}

export function toArubaSharedSecretRotated(raw: any): ArubaSharedSecretRotated {
  return {
    ...toArubaSharedSecretStatus(raw),
    sharedSecret: String(raw?.shared_secret ?? ""),
    deviceAction: String(raw?.device_action ?? ""),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The confirm text for a rotation: it is platform-wide, so it says so. */
export const SHARED_ROTATE_CONFIRM =
  "Set a new shared Aruba secret?\n\nThis is ONE secret for EVERY Instant On site on the shared listener (ports 1912/1913). Each of those sites rejects guests until the new secret is typed into its RADIUS profile. Venues registered by public IP (port 1812) are not affected.\n\nThe new secret is shown once.";
