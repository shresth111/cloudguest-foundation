/**
 * The decisions behind the Master console's guest-portal-contract control for
 * an Omada integration: when the switch and the RADIUS NAS registration may be
 * offered, what an operator must acknowledge first, and how the backend's
 * refusals read.
 *
 * Kept out of `master.integrations.tsx` so the rules are executed by a test
 * (`scripts/test-master-omada-radius-mode.mjs`) rather than restated by one.
 *
 * Backend references (cloud-guest `origin/main`):
 *  - `PATCH /network-integrations/platform/integrations/{id}` accepts
 *    `portal_mode` via `PlatformNetworkIntegrationUpdateRequest` (schemas.py).
 *  - `POST /network-integrations/platform/integrations/{id}/radius-nas` takes
 *    `ControllerRadiusNasRequest { controller_ip? }` and answers
 *    `ControllerRadiusNasResponse` (201). It refuses with 400
 *    `NETWORK_INTEGRATION_SETUP_INCOMPLETE` (`RadiusNasPreconditionsError`)
 *    when the row is not in RADIUS mode, has no fleet device, or the address is
 *    not a literal public IP; and with 502 when the hub agent refuses the
 *    stanza write.
 *  - Runbook: `backend/ops/runbooks/omada-radius-mode.md`. Design:
 *    `wyfy-omada/RADIUS-PORTAL-MODE.md` §11.
 */
import type { AppError } from "@/services/api";
import type { IntegrationPortalMode } from "@/types/network-integration";

/** `RadiusNasPreconditionsError`'s `data.code`. */
export const RADIUS_NAS_PRECONDITION_CODE = "NETWORK_INTEGRATION_SETUP_INCOMPLETE";

/**
 * What an operator must have in place, and must know, before a venue is moved
 * to RADIUS mode. Every item is confirmed individually in the dialog -- the
 * switch itself is only a database write and arranges NONE of these, and the
 * first three are what every guest at the venue pays for if they are missing.
 */
export const RADIUS_MODE_PREREQUISITES: readonly { key: string; title: string; detail: string }[] =
  [
    {
      key: "security_group",
      title: "The hub accepts RADIUS from this controller's public IP",
      detail:
        "The RADIUS hub's security group must allow UDP 1812 and 1813 from the controller's PUBLIC egress IP (a single /32). Today it allows the WireGuard overlay and the VPC only, and the 0.0.0.0/0 catch-all client must be removed from clients.conf BEFORE that port is opened. Until then every guest login times out.",
    },
    {
      key: "nas_public_ip",
      title: "The NAS client is keyed on the controller's public IP",
      detail:
        "Register the controller with RADIUS (below, after switching) using the address its Access-Requests arrive FROM, not the address this platform reaches it on. FreeRADIUS silently drops a request from an address it has no client for.",
    },
    {
      key: "raw_json_failures",
      title: "Guests see raw JSON when anything fails",
      detail:
        'On this contract a failed sign-in -- a RADIUS timeout, a reject, a missing field -- renders as the controller\'s JSON blob in the guest\'s browser (e.g. {"errorCode":-41530,"msg":"Connecting to the RADIUS server times out."}). No code of ours can intercept it.',
    },
    {
      key: "accounting_off",
      title: "RADIUS accounting stays OFF on the Omada RADIUS profile",
      detail:
        "Enabling accounting on the controller's RADIUS profile made every authentication fail with -41501 in testing, and no accounting packet was sent. Leave it disabled.",
    },
    {
      key: "controller_config",
      title: "Nothing on the controller changes when you switch",
      detail:
        "This records the contract and changes the portal link's parameters. The controller still needs its RADIUS profile (the hub's address, the shared secret, PAP) and a portal with RADIUS authentication and External Web Portal set by hand. Apply to controller cannot do this -- it only writes External Portal Server.",
    },
  ];

/** Why the portal-mode control cannot be used, or `null` when it can. */
export function portalModeSwitchBlock(portalMode: IntegrationPortalMode | null): string | null {
  if (portalMode === null) {
    return "This backend did not report a portal mode, so it cannot store one — a switch would be accepted and ignored. Deploy cloud-guest #236 (migration 0125) first.";
  }
  return null;
}

/**
 * Why `Preview changes` / `Apply to controller` must not run for this mode.
 *
 * `configure-controller` has no RADIUS branch: it always writes an External
 * Portal Server (authType 4) portal onto the SSID. Run against a RADIUS-mode
 * venue it would put the controller back on the other contract while the row
 * still says RADIUS -- the controller and this platform disagreeing about who
 * authorises guests, with nothing on either screen saying so.
 */
export function configureControllerPortalModeBlock(
  portalMode: IntegrationPortalMode | null,
): string | null {
  if (portalMode === "radius") {
    return "This venue is on RADIUS mode. Automatic setup only writes an External Portal Server portal and would move the controller off RADIUS. Configure the RADIUS portal on the controller by hand, or switch the venue back first.";
  }
  return null;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * The backend's default for `controller_ip`: the host of `base_url`, but only
 * when it is already a literal IP (`router._controller_host` +
 * `validate_controller_nas_address`, which refuses a hostname). `null` when
 * the host is a name, so the drawer can require the field instead of letting
 * the backend refuse it.
 *
 * Whether the IP is PUBLIC is still the backend's call -- this only mirrors
 * the literal-IP half, so the form never claims an address is acceptable.
 */
export function controllerIpDefaultFromBaseUrl(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return null;
  }
  if (IPV4.test(host)) return host;
  if (host.startsWith("[") && host.endsWith("]") && host.includes(":")) return host.slice(1, -1);
  return null;
}

/** Why "Register controller with RADIUS" cannot be pressed, or `null`. Each
 * reason is one of the backend's own 400 refusals, said before the click. */
export function radiusNasRegisterBlock(args: {
  portalMode: IntegrationPortalMode | null;
  routerId: string | null;
  baseUrl: string | null | undefined;
  controllerIpInput: string;
}): string | null {
  if (args.portalMode !== "radius") {
    return "Switch this venue to RADIUS mode first. A NAS client for an External Portal Server venue is a live secret on the RADIUS hub that nothing will ever use.";
  }
  if (!args.routerId) {
    return "This integration has no fleet device, and a RADIUS NAS client is registered against one. Pair it from Router Fleet first.";
  }
  if (!args.controllerIpInput.trim() && !controllerIpDefaultFromBaseUrl(args.baseUrl)) {
    return "The controller address is a hostname. Enter the controller's public IP — the one its RADIUS requests arrive from.";
  }
  return null;
}

/** A radius-nas failure, as the drawer shows it. */
export interface RadiusNasFailure {
  title: string;
  detail: string;
  /** Pressing Register again is the documented recovery. */
  retry: boolean;
}

export function describeRadiusNasFailure(err: unknown): RadiusNasFailure {
  const e = err as Partial<AppError> | undefined;
  const message = typeof e?.message === "string" && e.message.trim() ? e.message.trim() : null;
  const code = typeof e?.data?.code === "string" ? e.data.code.toUpperCase() : null;

  if (e?.status === 400 && code === RADIUS_NAS_PRECONDITION_CODE) {
    return {
      title: "Not registered — a precondition is not met",
      // The backend names exactly one fixable thing; its sentence is the copy.
      detail: message ?? "The backend refused the registration without saying why.",
      retry: false,
    };
  }
  if (e?.status === 502) {
    return {
      title: "The RADIUS hub refused the write",
      detail:
        (message ? `${message} ` : "") +
        "If this was the first registration, the NAS record may now exist without a stanza on the hub. Register again: it takes the rotate path and converges.",
      retry: true,
    };
  }
  if (e?.status === 403) {
    return {
      title: "Not permitted",
      detail:
        "Registering a RADIUS NAS client needs the platform-scope network_integrations.update permission.",
      retry: false,
    };
  }
  return {
    title: "Registration failed",
    // The backend's own sentence when there is one, and ALWAYS the second
    // half: an unrecognised failure says nothing about whether the hub was
    // written, and a screen that goes quiet reads as "probably fine".
    detail: `${message ? `${message} ` : ""}The request did not complete. Nothing on this screen confirms the hub was changed.`,
    retry: true,
  };
}
