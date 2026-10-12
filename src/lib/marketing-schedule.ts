/**
 * The time the "Schedule campaign" dialog opens on.
 *
 * Dependency-free so scripts/test-marketing-ui.mjs can execute it.
 */

/** A scheduled send has to be at least this far ahead (spec §5.5). */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60_000;

/**
 * How far ahead the dialog's own suggestion has to be. Above the minimum on
 * purpose: the "too soon" rule is checked against the clock on every render,
 * so a suggestion that only just clears it stops clearing it while the owner
 * is still reading the dialog.
 */
export const DEFAULT_SCHEDULE_LEAD_MS = 15 * 60_000;

/**
 * The top of an hour, about an hour from `now`.
 *
 * It was "an hour from now, minutes dropped": at 06:56 that is 07:00, four
 * minutes away, inside the five-minute minimum -- so for the last minutes of
 * every hour the dialog opened on a time it refuses, with Schedule disabled.
 * When the dropped minutes leave too little room, it is the hour after.
 */
export function defaultScheduleTime(now: Date): Date {
  const d = new Date(now.getTime() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  if (d.getTime() - now.getTime() < DEFAULT_SCHEDULE_LEAD_MS) d.setHours(d.getHours() + 1);
  return d;
}
