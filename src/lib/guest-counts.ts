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

export function distinctActiveGuests<T extends { guestId: string | null; status: string }>(
  rows: readonly T[],
): number {
  return distinctGuestCount(rows, (row) => row.status === "active");
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
