/**
 * Backend-enforced length limits for the two venue-authored captive-portal
 * splash strings (cloud-guest backend PR #39, live in production).
 *
 * The contract, verbatim from the backend -- do not re-derive:
 *
 *   - `splash_headline`         max 26 code points, counted over the TRIMMED
 *                               value ("Page title" / "Headline" in the UI).
 *   - `splash_welcome_message`  max 78 code points, trimmed. 78 (not the
 *                               92 of an earlier draft) comes from real Noto
 *                               Sans Tamil metrics: a Tamil message can never
 *                               push the sign-in button below the fold on a
 *                               360px phone.
 *
 * Counting is Unicode CODE POINTS, never UTF-16 units: `[...value].length`
 * matches Python's `len(str)` server-side, while `value.length` would count a
 * Devanagari or Tamil string wrong (and split emoji into surrogate halves).
 *
 * The backend rejects an over-limit write with HTTP 400 and envelope
 * `data: { field, max_length, actual_length }` -- but only when the
 * over-limit field itself is being CHANGED. Existing over-limit rows are
 * grandfathered: saving other fields around them stays allowed, and the
 * dashboard mirrors that rule (see `PortalPage.tsx` / `PortalSeoPanel`).
 */

export const SPLASH_HEADLINE_MAX = 26;
export const SPLASH_WELCOME_MAX = 78;

/** Code-point count over the trimmed value -- the exact number the backend
 * compares against the limits above. */
export function countSplashLength(value: string): number {
  return [...value.trim()].length;
}

/** True when `value` would be REJECTED by the backend: over the limit AND
 * actually changed from the stored value (compared trimmed, the same basis
 * the count uses). An unchanged grandfathered over-limit value passes. */
export function splashOverLimitBlocked(value: string, max: number, stored: string): boolean {
  return countSplashLength(value) > max && value.trim() !== stored.trim();
}

const SPLASH_FIELD_LABELS: Record<string, string> = {
  splash_headline: "Headline",
  splash_welcome_message: "Welcome message",
};

/**
 * Recognizes the backend's over-limit 400 (`data: { field, max_length,
 * actual_length }`) on an `AppError` (services/api.ts converts every axios
 * failure into that shape) and turns it into a specific, actionable message.
 * Returns `null` for anything else so callers fall through to their normal
 * error path. The client-side gates above should make this unreachable, but
 * an older tab that predates them can still race a save through.
 */
export function splashLimitErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const { status, data } = err as { status?: unknown; data?: unknown };
  if (status !== 400 || !data || typeof data !== "object") return null;
  const { field, max_length, actual_length } = data as Record<string, unknown>;
  if (typeof field !== "string") return null;
  const label = SPLASH_FIELD_LABELS[field];
  if (!label || typeof max_length !== "number" || typeof actual_length !== "number") return null;
  return `${label} is ${actual_length} characters long — the limit is ${max_length}. Shorten it and save again.`;
}
