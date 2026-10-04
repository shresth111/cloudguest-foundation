/**
 * The live-session actions a venue owner can press on ONE guest -- Disconnect,
 * Extend and Fix-a-Problem's "Reset this guest's session" -- and what to say
 * after one of them ran (DASHBOARD_PLAN P0-D).
 *
 * WHY EXTEND AND RESET FOLLOW DISCONNECT. At a NAS-only venue (Aruba Instant
 * On) nothing this platform has can reach the access point: no controller
 * API, no CoA. Disconnect was already greyed there. Extend only moves the end
 * time on OUR record -- the AP enforces the Session-Timeout it was handed at
 * sign-in and is never told about the extension -- and Reset is the same
 * backend act as Disconnect (`terminate_session` -> `issue_live_disconnect`),
 * which comes back `disconnect_enforced: false` there on every call. Both
 * buttons therefore report success while the guest's device carries on
 * exactly as before, so they take Disconnect's verdict and its sentence.
 *
 * EVERY OTHER VENUE IS UNTOUCHED: the gate is `greyed: false, reason: null`
 * for MikroTik, Omada, a mixed venue and one whose routers could not be read,
 * and the screens render the live button exactly as before.
 */
import { NAS_ONLY_DISCONNECT } from "@/lib/omada-client-controls";
import { isNasOnlyVendor } from "@/lib/router-vendors";

export type LiveSessionAction = "disconnect" | "extend" | "reset-session";

export interface LiveSessionActionGate {
  action: LiveSessionAction;
  /** True only at a NAS-only venue: render the control disabled. */
  greyed: boolean;
  /** PM_SPEC U2, the same sentence Disconnect shows. Null when not greyed. */
  reason: string | null;
}

/**
 * One verdict for all three actions, keyed on the same `vendor` the
 * Disconnect gate reads (`useClientControls().vendor`), so the three buttons
 * on one screen can never disagree about the venue they are on.
 */
export function liveSessionActionGate(
  action: LiveSessionAction,
  vendor: string | null | undefined,
): LiveSessionActionGate {
  if (!isNasOnlyVendor(vendor)) return { action, greyed: false, reason: null };
  return { action, greyed: true, reason: NAS_ONLY_DISCONNECT };
}

/** Tolerant read of `disconnect_enforced` off a session response, with or
 * without the `{data}` envelope (see `guestService.terminateSession`). */
export function readDisconnectEnforced(body: unknown): boolean | null {
  const b = body as
    | { disconnect_enforced?: unknown; data?: { disconnect_enforced?: unknown } | null }
    | null
    | undefined;
  const enforced = b?.disconnect_enforced ?? b?.data?.disconnect_enforced;
  return typeof enforced === "boolean" ? enforced : null;
}
