/**
 * How a guest's presence is described -- the ONE place that decides it.
 *
 * ## The defect this exists to prevent
 *
 * The badge read `session.status === "active"`, so it was really answering
 * "does this session row still exist?", not "is this person on the WiFi?".
 * Those are different questions, and a session row outlives the connection:
 * a guest whose device had dropped off the network kept reading "Online"
 * until the timeout sweep reached them -- and a session with no
 * `sessionTimeoutMinutes` is never reached at all, so it read "Online"
 * forever.
 *
 * The backend now derives `isOnline` (the session is active **and** the
 * device has not been observed as gone -- see
 * `GuestSessionResponse.is_online`), and every surface must read that rather
 * than re-deriving presence from `status`. Extracted here, like
 * `guest-identity.ts` and `guest-counts.ts`, so the rule is stated once and
 * cannot be quietly reimplemented slightly differently by the next surface
 * that needs it.
 */

export type GuestPresence = "online" | "disconnected" | "ended";

/**
 * Presence, from the server's own answer plus the session's own state.
 *
 * Three outcomes, not two, because the middle one is the whole point: a
 * session can be open while the device is gone, and collapsing that into
 * either "Online" or "Ended" misreports what the venue would find if they
 * walked to the front desk.
 */
export function guestPresence(session: { isOnline: boolean; status: string }): GuestPresence {
  if (session.isOnline) return "online";
  // The session is still open, but the network has stopped seeing the
  // device -- the state that used to render as "Online".
  return session.status === "active" ? "disconnected" : "ended";
}

export const GUEST_PRESENCE_LABEL: Record<GuestPresence, string> = {
  online: "Online",
  disconnected: "Disconnected",
  ended: "Ended",
};
