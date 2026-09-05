/**
 * Pure derivations over guest-session rows, kept out of
 * `customer.service.ts` so they can be exercised directly by
 * `scripts/test-customer-kpis.mjs` without bundling the whole API client.
 */

/** The two timestamps every duration calculation needs. Deliberately
 * narrower than `RawGuestSession` so callers elsewhere (the Users table,
 * reports) can reuse this with their own row shapes. */
export interface SessionSpan {
  started_at?: string | null;
  ended_at?: string | null;
}

/** Mean session length, in whole minutes, over the sessions handed in.
 *
 * This KPI used to be computed in `getDashboard()` as
 * `sum(bytes_downloaded) / sessions.length / 1e6` -- i.e. the average
 * megabytes a session downloaded -- and was then rendered by
 * `CustomerDashboardPage` as `${avgSession} min`. So the dashboard's
 * "avg session" tile was a data-volume figure wearing a time unit, and it
 * had no way to be right: at a venue where guests stream it read high,
 * where they check email it read near zero, and in both cases it was
 * answering a question nobody asked. Both timestamps needed to compute it
 * honestly were already on the row, and were already being used a few
 * hundred lines below for the Users table's own `duration` column.
 *
 * A row with no `ended_at` is still running, so it is measured to `now`
 * rather than skipped -- dropping live sessions would bias the mean toward
 * guests who had already left, which at a busy venue means the short
 * visits. Rows that are unparseable or inverted are skipped rather than
 * clamped to zero, so one bad row cannot quietly drag the average down.
 *
 * Returns 0 when nothing is countable, matching the shape the caller
 * already expects (it renders that as "0 min", not as a gap).
 */
/** How many sessions *began* in each hour-of-day bucket, 0..23.
 *
 * This is the honest series for "Sessions by hour": it answers "when do
 * people arrive", which is what a venue schedules staff around. */
export function sessionStartsByHour(sessions: SessionSpan[]): number[] {
  const buckets = new Array(24).fill(0) as number[];
  for (const s of sessions) {
    if (!s.started_at) continue;
    const start = new Date(s.started_at);
    const h = start.getHours();
    if (Number.isFinite(start.getTime()) && h >= 0 && h < 24) buckets[h] += 1;
  }
  return buckets;
}

/** How many sessions were *open* during each hour-of-day bucket, 0..23.
 *
 * This is the honest series for "Guests online, last 24h": a guest who
 * connected at 14:10 and left at 16:30 was online at 14:00, 15:00 and
 * 16:00, and should appear in all three -- which is what "how busy was
 * the WiFi at 3pm" means.
 *
 * WHY THIS FUNCTION EXISTS AT ALL: the dashboard used to derive BOTH
 * charts from one array of per-hour session *starts*, so "Guests online,
 * last 24h" and "Sessions by hour" rendered identical numbers in two
 * different chart shapes. Nobody noticed because the demo fixtures seed
 * the two separately (a 24-point curve and 6 bars), which is exactly what
 * the product video shows -- the duplication was only ever visible on a
 * real account.
 *
 * A session still running is counted through to `now` and no further, so
 * an open session never fills the rest of the day with guests who are not
 * there yet.
 */
export function sessionsOpenByHour(sessions: SessionSpan[], now: number = Date.now()): number[] {
  const buckets = new Array(24).fill(0) as number[];
  for (const s of sessions) {
    if (!s.started_at) continue;
    const startMs = new Date(s.started_at).getTime();
    if (!Number.isFinite(startMs)) continue;
    const rawEnd = s.ended_at ? new Date(s.ended_at).getTime() : now;
    const endMs = Number.isFinite(rawEnd) ? Math.max(startMs, Math.min(rawEnd, now)) : now;

    // Walk hour boundaries from the session's start to its end. Capped at
    // 24 buckets so a very long session (a hotel guest's multi-day
    // session) marks each hour at most once instead of looping for days.
    const cursor = new Date(startMs);
    cursor.setMinutes(0, 0, 0);
    const seen = new Set<number>();
    for (let i = 0; i < 24 && cursor.getTime() <= endMs; i++) {
      const h = cursor.getHours();
      if (!seen.has(h)) {
        seen.add(h);
        buckets[h] += 1;
      }
      cursor.setTime(cursor.getTime() + 3_600_000);
    }
  }
  return buckets;
}

export function avgSessionMinutes(sessions: SessionSpan[], now: number = Date.now()): number {
  let totalMs = 0;
  let counted = 0;
  for (const s of sessions) {
    if (!s.started_at) continue;
    const start = new Date(s.started_at).getTime();
    if (!Number.isFinite(start)) continue;
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    if (!Number.isFinite(end) || end < start) continue;
    totalMs += end - start;
    counted += 1;
  }
  return counted > 0 ? Math.round(totalMs / counted / 60_000) : 0;
}
