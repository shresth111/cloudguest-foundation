/**
 * Disconnect at an Aruba Instant On venue: what it does, said before and after
 * the click, and how a signed-out row reads until the access point lets go.
 *
 * WHAT ACTUALLY HAPPENS (backend `disconnect_session` -> `issue_live_disconnect`
 * -> `LiveSessionTerminator._end_on_nas_only_cloud`):
 *
 *  - The guest's Wyfy session ends, always. From then on the RADIUS authorize
 *    path refuses that session, so the next time the access point checks the
 *    guest with Wyfy it is told no.
 *  - Instant On has no "disconnect" command and no CoA. When Instant On cloud
 *    control is switched on for this venue (backend gates, OFF by default),
 *    Wyfy blocks the device's MAC in the Instant On cloud, reads the block
 *    back, and lifts it again after a short hold: the AP drops the device.
 *    The response then carries `disconnect_enforced: true`.
 *  - Otherwise (`false`, or `null` when nothing was tried) the device keeps
 *    its WiFi until the Session-Timeout the AP was handed at sign-in runs out
 *    -- measured on the AP21 2026-10-03: it obeys Session-Timeout. That
 *    timeout is at most the session's own `session_timeout_minutes` counted
 *    from when it started, which is the time quoted to the owner ("by about
 *    HH:MM"). When the session carries no timeout we say so without a time.
 *
 * Nothing here is shown at a MikroTik or Omada venue: every caller gates on
 * the venue being NAS-only first.
 */

export interface ArubaDisconnectRowFacts {
  /** Presence verdict the table already renders ("online" | "idle" | "offline"). */
  status: string;
  connectedAt: string;
  disconnectedAt: string | null;
  /** `GuestSessionResponse.disconnect_enforced`, carried through as-is. */
  disconnectEnforced?: boolean | null;
  /** `GuestSessionResponse.session_timeout_minutes`. */
  sessionTimeoutMinutes?: number | null;
}

/**
 * The latest moment the access point can still be letting this session's
 * device on: start + the session's own timeout. Null when the session has no
 * timeout on record or the dates do not parse -- never a guessed time.
 */
export function arubaAccessCutoff(
  connectedAt: string,
  sessionTimeoutMinutes: number | null | undefined,
): Date | null {
  if (typeof sessionTimeoutMinutes !== "number" || !(sessionTimeoutMinutes > 0)) return null;
  const start = new Date(connectedAt).getTime();
  if (!Number.isFinite(start)) return null;
  return new Date(start + sessionTimeoutMinutes * 60_000);
}

/**
 * For a row Wyfy ended but the access point was NOT told to drop
 * (`disconnectEnforced === false`): until when its device may still have
 * WiFi. Null for every other row -- online rows, rows the AP itself ended
 * (`null` enforced: Accounting-Stop / Session-Timeout), rows the Instant On
 * cloud dropped (`true`), and rows whose window has already passed.
 */
export function arubaSignedOutUntil(row: ArubaDisconnectRowFacts, now: Date): Date | null {
  if (row.status === "online" || row.status === "idle") return null;
  if (row.disconnectEnforced !== false || !row.disconnectedAt) return null;
  const cutoff = arubaAccessCutoff(row.connectedAt, row.sessionTimeoutMinutes);
  if (!cutoff) return null;
  const ended = new Date(row.disconnectedAt).getTime();
  if (cutoff.getTime() <= now.getTime() || cutoff.getTime() <= ended) return null;
  return cutoff;
}

export type ArubaDisconnectOutcome =
  /** Instant On confirmed the device is blocked: it is off the WiFi now. */
  | "dropped"
  /** Signed out in Wyfy; the device keeps WiFi until the AP's timeout. */
  | "signed-out";

/** Every session the action ended must have been confirmed dropped. */
export function arubaDisconnectOutcome(
  enforced: ReadonlyArray<boolean | null>,
): ArubaDisconnectOutcome {
  return enforced.length > 0 && enforced.every((e) => e === true) ? "dropped" : "signed-out";
}

/** "14:35" in the viewer's locale, for the copy below. */
export function formatCutoff(cutoff: Date | null): string | null {
  if (!cutoff) return null;
  return cutoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
