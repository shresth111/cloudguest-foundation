import type { RuntimeSession, RuntimeSessionAuthMethod } from "@/types/portal-runtime";

/**
 * Demo-only helpers for the prospect-facing captive-portal DEMO
 * (src/routes/preview.portal.demo.tsx, gated on `PortalRuntimeState.demoMode`).
 *
 * None of this touches the network, a backend, SMS/RADIUS or the NAS -- it is
 * the believable DUMMY substitute for the real `portalRuntimeService.*` login
 * calls, so a prospect clicking the demo sees the whole flow run
 * (identifier -> OTP -> "You're connected") instead of a dead placeholder.
 * Kept out of any component module on purpose (react-refresh only wants
 * component exports in a component file, and both of these are plain data).
 */

/** The OTP the demo pre-fills into the code field so a prospect can tap
 * Verify immediately. Any 6-digit code is accepted in demo mode; this is
 * only the convenient default the field starts on. */
export const DEMO_OTP_CODE = "123456";

/**
 * A fully-shaped, fake in-memory `RuntimeSession` for the demo's "connected"
 * screen. Every id is an obvious demo placeholder; `hasPassword` is false so
 * the demo mirrors a first-time OTP guest. Nothing here is ever sent anywhere
 * -- it exists only to drive the self-contained connected card.
 */
export function buildDemoSession(
  identifier: string,
  authMethod: RuntimeSessionAuthMethod,
): RuntimeSession {
  const nowIso = new Date().toISOString();
  return {
    guestId: "demo-guest",
    identifier,
    sessionId: "demo-session",
    deviceId: "demo-device",
    routerId: "demo",
    locationId: "demo",
    organizationId: "demo",
    authMethod,
    status: "active",
    startedAt: nowIso,
    endedAt: null,
    lastActivityAt: nowIso,
    ipAddress: "192.0.2.10",
    bytesUploaded: 0,
    bytesDownloaded: 0,
    dataLimitMb: null,
    sessionTimeoutMinutes: null,
    isNewGuest: true,
    deviceMacAddress: null,
    deviceName: "This device",
    hasPassword: false,
  };
}
