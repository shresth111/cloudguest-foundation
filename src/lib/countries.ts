/**
 * The countries this platform provisions venues in, and the timezone each one
 * defaults to.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two defects, both found by walking the Master console's provisioning flow,
 * and they are the same defect at two severities.
 *
 * The visible one: the Country picker offered raw ISO codes -- `US, GB, IN,
 * SG, AE, DE, AU, CA` -- with US first and no names anywhere. An operator
 * provisioning a hotel in Bengaluru has to know that `IN` is India and not
 * Indonesia (`ID`), and the two sit four rows apart in an alphabet of
 * two-letter codes. A picker that requires you to already know the answer is
 * not a picker.
 *
 * The costly one: choosing `IN` left Timezone on `UTC`. Timezone is not
 * decoration on a venue -- it is the frame every timestamp that venue ever
 * produces is read in. Session start and end times, the daily and monthly
 * report boundaries, business-hours rules, voucher validity windows and
 * scheduled campaign sends all resolve through it. A venue provisioned in
 * India with `UTC` is five and a half hours out on every one of those, and
 * nothing downstream reports an error: the numbers are all plausible, just
 * wrong, and they stay wrong until somebody notices that "yesterday's" report
 * covers half of the day before. That is the expensive kind of wrong, and the
 * fix is to stop asking two questions when the operator only knows the answer
 * to one.
 *
 * The default is a DEFAULT, not a derivation. It is applied when the operator
 * has not chosen a timezone themselves, and it stops being applied the moment
 * they do -- see `PlatformLocationWizard`'s `timezoneTouched`. Several of
 * these countries span more than one zone (the US spans six; Australia five),
 * so this can only ever be "the one you most likely meant", and an operator
 * provisioning a venue in Perth must be able to say so without the next
 * keystroke undoing it.
 */

export interface CountryOption {
  /** ISO 3166-1 alpha-2, and the value actually stored on the location. */
  code: string;
  /** What a human reads. */
  name: string;
  /**
   * The IANA zone to default to for a venue in this country.
   *
   * For the multi-zone countries this is the most populous / most commonly
   * provisioned one rather than a claim that the country has one zone. It is
   * a starting point the operator can override, which is the honest shape for
   * a fact this module genuinely cannot know.
   */
  defaultTimezone: string;
}

/**
 * Ordered with India first, then the rest alphabetically by NAME.
 *
 * Not alphabetically by code, and not with the US first as it was: this
 * platform's venues are overwhelmingly Indian, and the first row of a picker
 * is the one that gets chosen by accident. Putting the most likely answer
 * where the accident lands is the cheapest correctness there is.
 */
export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: "IN", name: "India", defaultTimezone: "Asia/Kolkata" },
  { code: "AU", name: "Australia", defaultTimezone: "Australia/Sydney" },
  { code: "CA", name: "Canada", defaultTimezone: "America/Toronto" },
  { code: "DE", name: "Germany", defaultTimezone: "Europe/Berlin" },
  { code: "SG", name: "Singapore", defaultTimezone: "Asia/Singapore" },
  { code: "AE", name: "United Arab Emirates", defaultTimezone: "Asia/Dubai" },
  { code: "GB", name: "United Kingdom", defaultTimezone: "Europe/London" },
  { code: "US", name: "United States", defaultTimezone: "America/New_York" },
];

/** Every timezone a country above defaults to, plus UTC. The picker's list. */
export const TIMEZONE_OPTIONS: readonly string[] = [
  "UTC",
  ...Array.from(new Set(COUNTRY_OPTIONS.map((c) => c.defaultTimezone))).sort(),
];

/** "India (IN)" -- the code kept alongside the name rather than replaced by
 * it, because the code is what the operator will see again on the location
 * record, in the CSV export and in a support conversation. */
export function countryLabel(code: string): string {
  const found = COUNTRY_OPTIONS.find((c) => c.code === code);
  return found ? `${found.name} (${found.code})` : code;
}

/**
 * The timezone a venue in this country should start on, or `null` when the
 * country is not one this module knows.
 *
 * `null` rather than a fallback to UTC on purpose: a caller that gets null
 * must leave the operator's current choice alone, and silently resetting an
 * unknown country's venue to UTC would reintroduce the exact defect this
 * module exists to close.
 */
export function defaultTimezoneForCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.defaultTimezone ?? null;
}
