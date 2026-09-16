/**
 * The ONE set of guest-counting rules for the venue (workspace + Users)
 * surfaces. QA: "guests are being counted separately even when a user is
 * reconnecting at the same interval; it should be unique users / daily
 * unique users." Any number labelled with a people-word (guests / users /
 * online now) must be a distinct-`guestId` count; raw session rows may only
 * be presented under session-word labels (visits / sessions / logins).
 *
 * WHY `guestId`, NEVER `guestIdentifier`: the backend's session payload
 * carries no identifier (it is null on every row -- see
 * useWorkspace.ts's LocationGuestSessionSummary), so the only stable
 * per-person key a session row offers is `guestId`. All helpers here ignore
 * rows whose `guestId` is null (demo rows, sessions without a guest join).
 */
export function distinctGuestCount<T extends { guestId: string | null }>(
  rows: readonly T[],
  where?: (row: T) => boolean,
): number {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.guestId && (!where || where(row))) seen.add(row.guestId);
  }
  return seen.size;
}

/** Distinct guests who are on the network *now* -- the people-word number
 *  the dashboard labels "Online now".
 *
 *  Keyed on `isOnline` (the server's own answer: session active AND the
 *  device not observed as gone), never on `status === "active"`. The two
 *  differ for a guest whose device has dropped off the network while their
 *  session row is still open, and that guest is not online. */
export function distinctOnlineGuests<T extends { guestId: string | null; isOnline: boolean }>(
  rows: readonly T[],
): number {
  return distinctGuestCount(rows, (row) => row.isOnline);
}

/** Distinct guests whose session started at or after ``sinceMs`` -- the
 *  daily-unique window (local midnight) the venue dashboards mean by
 *  "today's guests". */
export function distinctGuestsSince<T extends { guestId: string | null; startedAt: string }>(
  rows: readonly T[],
  sinceMs: number,
): number {
  return distinctGuestCount(rows, (row) => Date.parse(row.startedAt) >= sinceMs);
}
