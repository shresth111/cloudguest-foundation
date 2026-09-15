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
