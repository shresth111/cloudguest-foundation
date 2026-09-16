/**
 * Draft/baseline logic for the Open Hours page (OpenHoursView in
 * src/components/features/OperationsFeatures.tsx).
 *
 * The page edits a local draft and only persists on an explicit Save, so
 * it needs two answers the UI cannot eyeball: "is the draft actually
 * different from what is saved?" and "would the backend accept it?".
 * Both live here, pure, so they can be exercised without rendering.
 */
import type {
  BusinessHoursDay,
  BusinessHoursSchedule,
  BusinessHoursWeekday,
} from "@/services/business-hours.service";

export const OPEN_HOURS_WEEKDAYS: BusinessHoursWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export interface OpenHoursDraft {
  enabled: boolean;
  timezone: string;
  schedule: BusinessHoursSchedule;
  closedMessage: string;
}

/**
 * One canonical spelling per day, so equality means "same meaning":
 * a day absent from the stored schedule and a day toggled on then off
 * again (`{open: false}`, or `{open: false, start, end}` left behind) are
 * both "closed", and must not light up Save.
 */
export function normalizeOpenHoursDraft(d: OpenHoursDraft): OpenHoursDraft {
  const schedule: BusinessHoursSchedule = {};
  for (const day of OPEN_HOURS_WEEKDAYS) {
    const entry: BusinessHoursDay | undefined = d.schedule[day];
    schedule[day] =
      entry?.open === true
        ? { open: true, start: entry.start ?? "", end: entry.end ?? "" }
        : { open: false };
  }
  return {
    enabled: d.enabled,
    timezone: d.timezone,
    schedule,
    closedMessage: d.closedMessage,
  };
}

export function openHoursDraftsEqual(a: OpenHoursDraft, b: OpenHoursDraft): boolean {
  const na = normalizeOpenHoursDraft(a);
  const nb = normalizeOpenHoursDraft(b);
  if (
    na.enabled !== nb.enabled ||
    na.timezone !== nb.timezone ||
    na.closedMessage !== nb.closedMessage
  ) {
    return false;
  }
  return OPEN_HOURS_WEEKDAYS.every((day) => {
    const x = na.schedule[day]!;
    const y = nb.schedule[day]!;
    return x.open === y.open && x.start === y.start && x.end === y.end;
  });
}

/** Same pattern the backend enforces (captive_portal/validators.py). */
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Per-day error messages, keyed by weekday; an empty object means valid.
 * Mirrors backend `validate_business_hours_schedule`: an open day needs
 * both times as HH:MM and the close time strictly after the open time.
 * The model has one window per day and no overnight windows, so there is
 * no overlap case to check -- and an overnight venue must be told so
 * rather than silently saved as something else.
 */
export function validateOpenHoursSchedule(
  schedule: BusinessHoursSchedule,
): Partial<Record<BusinessHoursWeekday, string>> {
  const errors: Partial<Record<BusinessHoursWeekday, string>> = {};
  for (const day of OPEN_HOURS_WEEKDAYS) {
    const entry = schedule[day];
    if (entry?.open !== true) continue;
    const { start, end } = entry;
    if (!start || !end || !HHMM.test(start) || !HHMM.test(end)) {
      errors[day] = "Set both an opening and a closing time, or mark the day closed.";
    } else if (start >= end) {
      errors[day] =
        "Closing time must be after opening time. Overnight hours are not supported -- end at 23:59 and open the next day at 00:00.";
    }
  }
  return errors;
}

/**
 * The window an all-day venue is on. 23:59 rather than a second "00:00"
 * because the backend's validator allows one window per day and requires
 * `start < end` with no overnight case (captive_portal/validators.py) --
 * the same rule `validateOpenHoursSchedule` above mirrors, and the same
 * pair this page's own "Open all day" button writes.
 */
export const OPEN_HOURS_ALL_DAY_START = "00:00";
export const OPEN_HOURS_ALL_DAY_END = "23:59";

/** Open every day, all day. */
export function openHoursEveryDay(): BusinessHoursSchedule {
  const schedule: BusinessHoursSchedule = {};
  for (const day of OPEN_HOURS_WEEKDAYS) {
    schedule[day] = { open: true, start: OPEN_HOURS_ALL_DAY_START, end: OPEN_HOURS_ALL_DAY_END };
  }
  return schedule;
}

/**
 * Whether the stored schedule says nothing at all -- the state a venue is
 * in until somebody opens this screen for the first time.
 *
 * Deliberately "no entries", not "no day open". A venue that switched every
 * day off has made a decision ("closed, and I will say when") and must keep
 * it; only a schedule with nothing in it means "never configured".
 */
export function hasNoStoredSchedule(schedule: BusinessHoursSchedule | null | undefined): boolean {
  return !schedule || Object.keys(schedule).length === 0;
}

/**
 * The stored schedule, or the 24/7 default when there is nothing stored.
 *
 * The defect this closes: a venue that had never touched this screen had
 * `business_hours_enabled = false` and `business_hours_schedule = {}` on the
 * backend, which the backend correctly reads as "open 24/7" (`is_open_now`
 * returns True the moment enforcement is off, captive_portal/validators.py)
 * -- while this page drew seven "Closed all day" cards and an enforcement
 * switch reading Off. The screen described the opposite of what guests were
 * actually getting, and an operator who only edited the day grid saw their
 * change do nothing, because the switch it depends on was already in the
 * position they never looked at. Founder QA: "By default should be 24/7
 * enabled".
 *
 * `enabled` is defaulted alongside the schedule for the same reason: the
 * "nothing configured" state is one state, and half-defaulting it (a 24/7
 * grid under an Off switch) would leave the same contradiction.
 */
export function openHoursOrDefault(stored: BusinessHoursSchedule | null | undefined): {
  schedule: BusinessHoursSchedule;
  enabledDefault: boolean;
} {
  return hasNoStoredSchedule(stored)
    ? { schedule: openHoursEveryDay(), enabledDefault: true }
    : { schedule: stored as BusinessHoursSchedule, enabledDefault: false };
}
