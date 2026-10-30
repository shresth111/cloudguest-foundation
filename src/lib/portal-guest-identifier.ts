/**
 * The one spelling the captive portal sends for a guest's phone/email.
 *
 * Mirrors the backend's `normalize_identifier` / `normalize_otp_identifier`
 * (cloud-guest `fix(guest): match portal email identifiers
 * case-insensitively`): surrounding whitespace stripped, and an email
 * address (anything containing `@`) lower-cased. Phone numbers and any other
 * identifier keep their case.
 *
 * Why: mobile keyboards capitalise the first letter of the portal's
 * plain-text "Mobile or email" field, so a guest who signed up as
 * `guest@gmail.com` comes back as `Guest@gmail.com`. The backend now folds
 * case itself; doing it here too means the identifier the portal remembers
 * and submits to the router's hotspot login (the RADIUS User-Name) is the
 * same string the backend stored, not merely an equivalent one.
 *
 * Never apply this to a password, PIN or voucher code.
 */
export function normalizeGuestIdentifier(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}
