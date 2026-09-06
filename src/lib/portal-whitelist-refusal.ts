import type { AppError } from "@/services/api";

/**
 * "Was this 403 a whitelist-only refusal, or a blocklist denial?"
 *
 * ## Why this file exists at all
 *
 * The backend draws the distinction properly. `WhitelistOnlyAccessDenied
 * Error` and `GuestAccessDeniedError` are two different exception classes
 * in `cloud-guest-repo/backend/app/domains/guest_access/exceptions.py`,
 * and the former's own docstring is explicit that they are different
 * facts: a blocklist hit means "an operator wrote a rule about *you*", a
 * whitelist-only refusal means "an operator wrote a rule about *everyone
 * else*" and this guest did nothing.
 *
 * **That distinction does not currently survive the trip to the browser.**
 * Both exceptions call `super().__init__(message, status_code=403)` with
 * no `data=`, so the app-wide handler (`app/common/exceptions.py`)
 * serialises both as `{success: false, message: <text>, data: {}}` with
 * an identical 403. This frontend's own `toAppError` (`src/services/
 * api.ts`) then collapses *every* 403 to `code: "forbidden"`. So on the
 * wire, today, the only thing that differs between the two is the human
 * `message` string.
 *
 * That is a real contract gap and it should be closed on the backend --
 * one line, `data={"code": "whitelist_only_access_denied"}` on the
 * exception. Until it is, this module is how the portal tells them apart,
 * and it is built so that closing the gap needs no change here: the code
 * check below runs *first* and wins, so the day the backend starts
 * sending one, the string matching stops being load-bearing.
 *
 * ## Why the string matching is safe, and not a guess
 *
 * This is not fuzzy matching on prose. A `WhitelistOnlyAccessDeniedError`
 * message is provably one of exactly two strings:
 *
 *   1. the venue's own `whitelist_only_denied_message`, which this portal
 *      *already has a copy of* from `GET /captive-portal/resolve`; or
 *   2. `DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE`, a fixed backend constant
 *      mirrored below,
 *
 * because the exception's constructor is literally
 * `(denied_message or "").strip() or DEFAULT_...`. So an exact match
 * against those two known values identifies it precisely. A blocklist
 * message ("Access denied by an active guest access control rule: ...")
 * cannot collide with either.
 *
 * ## The safety property that matters more than the matching
 *
 * Even a false positive here cannot leak anything, and that is by
 * construction rather than by luck. `/portal/not-listed` never renders
 * `AppError.message`. It renders the venue message it independently
 * resolved from `/captive-portal/resolve`, or its own localized default.
 * So an operator-authored blocklist `reason` -- "ex-employee, do not
 * readmit" -- has no path onto that screen even if this function were
 * wrong about which error it was handed.
 *
 * (The inverse leak is real and pre-existing, and is NOT introduced by
 * this module: a blocklist denial still falls through to
 * `friendlyGuestAuthError`, which returns `e.message` verbatim for any
 * 403 -- reason included. That is worth fixing, and is called out in this
 * change's PR rather than silently widened here.)
 */

/** Mirrors `DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE` in the backend's
 * `app/domains/guest_access/exceptions.py`, byte for byte. Copied rather
 * than imported because the two live in different repositories; if the
 * backend ever edits its default, this comparison stops matching and the
 * portal degrades to the generic auth error it showed before this feature
 * existed -- a visibly worse screen, never a wrong or leaky one. */
export const BACKEND_DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE =
  "This WiFi is limited to guests the venue has added to its allowed list. " +
  "Please ask reception to add you.";

/** The machine-readable codes this module will honour the moment the
 * backend starts sending one. Both spellings are accepted so the fix can
 * land on the backend in whichever convention that repo settles on
 * without needing a matching frontend release. */
const WHITELIST_ONLY_CODES = new Set([
  "whitelist_only_access_denied",
  "whitelist_only_denied",
  "whitelistonlyaccessdeniederror",
]);

/** Trim, collapse internal runs of whitespace, and casefold -- so a stored
 * venue message that differs from the returned one only by a trailing
 * newline or a double space still matches. The backend `.strip()`s but
 * does not otherwise normalise, and an operator pasting from a document
 * is a completely ordinary way for that skew to arise. */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function codeOf(e: AppError): string | undefined {
  const raw = e.data?.["code"] ?? e.data?.["error_code"];
  return typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
}

/**
 * True when `e` is the backend refusing this guest because the property
 * admits only guests on its Always Allowed list.
 *
 * @param venueDeniedMessage the venue's own `whitelistOnlyDeniedMessage`
 *   from the resolved portal config, when it has set one. Passing it lets
 *   a customised refusal be recognised as precisely as the default one;
 *   omitting it only narrows the match, never widens it.
 */
export function isWhitelistOnlyRefusal(e: AppError, venueDeniedMessage?: string | null): boolean {
  // The refusal is an authorization decision on a well-formed request, so
  // it is always a 403 -- and checking the status first means a venue that
  // (perversely) set its denied message to the text of some unrelated
  // 400/500 error still cannot be mistaken for one.
  if (e.status !== 403) return false;

  // Preferred path: a real machine-readable code, if the backend has one
  // by the time this runs. Deliberately first, and deliberately a
  // definitive answer in both directions is NOT taken here -- a code that
  // is present but unrecognised falls through to the string check rather
  // than returning false, because the alternative is a portal that breaks
  // on a backend that renamed its own code.
  const code = codeOf(e);
  if (code !== undefined && WHITELIST_ONLY_CODES.has(code)) return true;

  const message = normalize(e.message ?? "");
  if (!message) return false;

  if (message === normalize(BACKEND_DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE)) return true;

  const venue = venueDeniedMessage?.trim();
  if (venue && message === normalize(venue)) return true;

  return false;
}
