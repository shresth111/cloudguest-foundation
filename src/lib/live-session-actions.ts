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
 * 2026-10-05: the Guests table's own Disconnect is LIVE at a NAS-only venue
 * (it ends the Wyfy session and, with Instant On cloud control on, drops the
 * device) and says what it does -- see `lib/aruba-disconnect.ts`. Extend and
 * Reset stay greyed here; the "disconnect" verdict below is kept for callers
 * that still ask it. 2026-10-05: Extend's greyed reason is its own
 * (`NAS_ONLY_EXTEND`), not the disconnect sentence.
 *
 * EVERY OTHER VENUE IS UNTOUCHED: the gate is `greyed: false, reason: null`
 * for MikroTik, Omada, a mixed venue and one whose routers could not be read,
 * and the screens render the live button exactly as before.
 */
import { NAS_ONLY_DISCONNECT } from "@/lib/omada-client-controls";

/**
 * Extend at an Aruba Instant On venue. MEASURED 2026-10-03 (AP21, V1): the
 * access point ends the session itself at the Session-Timeout it was given
 * at sign-in and sends Accounting-Stop, which ends the Wyfy session. Nothing
 * re-authorises a guest mid-session (no CoA, no re-auth), so a longer end
 * time on our record never reaches the access point. Greyed, with the reason
 * that is actually true -- not the disconnect sentence.
 */
export const NAS_ONLY_EXTEND =
  "Extending isn't possible on Aruba Instant On access points: they end the session at the " +
  "time it was given when the guest signed in, and Wyfy can't change that while they're " +
  "online. When it ends, the guest can sign in again for a new session.";
import { isNasOnlyVendor } from "@/lib/router-vendors";

export type LiveSessionAction = "disconnect" | "extend" | "reset-session";

export interface LiveSessionActionGate {
  action: LiveSessionAction;
  /** True only at a NAS-only venue: render the control disabled. */
  greyed: boolean;
  /** Why it is greyed (`NAS_ONLY_EXTEND` for extend, PM_SPEC U2 otherwise).
   * Null when not greyed. */
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
  return {
    action,
    greyed: true,
    reason: action === "extend" ? NAS_ONLY_EXTEND : NAS_ONLY_DISCONNECT,
  };
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
