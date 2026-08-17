import type { AppError } from "@/services/api";

/**
 * Humanizes an `AppError` for a customer-facing `toast.error(...)`.
 *
 * `toAppError` (`services/api.ts`) passes the backend's own
 * `envelope.message` straight through with no allowlist -- fine for an
 * admin-only surface, but several domain exceptions (see e.g.
 * `app/domains/isp/exceptions.py`) are written for the *operator/engineer*
 * reading a log line, not a customer reading a toast: they interpolate raw
 * entity UUIDs (`IspLinkNotFoundError`, `IspLinkDisabledError`,
 * `IspHealthCheckTargetUnavailableError`, ...) and internal implementation
 * terms ("health-check target", "dynamic default route", RouterOS
 * operation names). A real incident showed a customer exactly that: an ISP
 * link UUID plus "health-check target unavailable: DHCP mode but no
 * dynamic default route currently present on the router".
 *
 * This defaults *closed*: unless a backend message is explicitly known to
 * already be written in plain, customer-facing English (see
 * `SAFE_EXACT_MESSAGES` below -- mirrors the allowlist
 * `lib/portal-guest-errors.ts` keeps for the guest-auth exceptions that
 * *are* written for an end user), the caller's own contextual `fallback`
 * is shown instead of the raw backend text. A message containing anything
 * that looks like a UUID is never shown verbatim, full stop, regardless of
 * the allowlist -- a defense-in-depth backstop against a future exception
 * message being edited to interpolate an ID under an otherwise-safe
 * prefix.
 */

const GENERIC_FALLBACK = "Something went wrong. Please try again.";

// Backend messages already written in plain English, with no interpolated
// ID or internal terminology -- safe to surface verbatim. Deliberately
// small; add to this list only after confirming (by reading the raising
// exception class) that it can never interpolate a raw ID or jargon.
const SAFE_EXACT_MESSAGES = new Set<string>([
  // CrossOrganizationIspLinkAccessError / the router domain's equivalent --
  // fixed text, never interpolates an ID.
  "Cannot access an ISP link belonging to another organization",
  "Cannot access a router belonging to another organization",
  // toAppError's own network_error message -- already customer-facing.
  "Unable to reach the server",
]);

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isSafeToShowVerbatim(message: string): boolean {
  if (!message) return false;
  if (UUID_PATTERN.test(message)) return false;
  return SAFE_EXACT_MESSAGES.has(message);
}

/**
 * `humanizeApiError(err, "Could not save the ISP link.")` -- drop-in
 * replacement for the `(err as AppError).message || "Could not save the
 * ISP link."` pattern used across the dashboard's `catch` blocks. Keeps
 * exactly the same call shape (an `AppError` plus the contextual fallback
 * every call site already wrote) so no call site needs to invent new copy;
 * it only changes what wins when the backend's real message isn't safe to
 * show as-is.
 */
export function humanizeApiError(err: AppError, fallback: string = GENERIC_FALLBACK): string {
  // A speed-test/OTP-style cooldown (see `AppError.data`'s own comment in
  // services/api.ts) carries a real, live TTL -- e.g.
  // `IspSpeedTestCooldownError` -- worth surfacing even though the raw
  // message itself embeds a link UUID and gets filtered out below.
  const retryAfter = err.data?.retry_after_seconds;
  if (err.status === 429 && typeof retryAfter === "number") {
    return `That ran too recently -- try again in ${retryAfter}s.`;
  }
  if (isSafeToShowVerbatim(err.message)) return err.message;
  return fallback;
}
