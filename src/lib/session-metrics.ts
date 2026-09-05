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
