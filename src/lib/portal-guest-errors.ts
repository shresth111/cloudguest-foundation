import type { AppError } from "@/services/api";

/**
 * A real backend error reason is meant to be shown to the guest verbatim
 * wherever one exists -- see e.g. `GuestPasswordLoginFailedError`'s own
 * docstring, or `OtpCodeMismatchError`/`OtpExpiredError`/`VoucherExpiredError`
 * -- those already read as plain, actionable English ("Incorrect
 * verification code.", "This voucher has expired") and this deliberately
 * never rewrites them into something vaguer.
 *
 * The one thing that's never fit to show a guest verbatim is
 * `app.common.exceptions`'s generic `RequestValidationError` handler,
 * whose "Request validation failed" message (plus its raw
 * `'<value>' is not a valid identifier for channel '<channel>'` per-field
 * sibling from `InvalidOtpIdentifierError`) is a framework/debugging string,
 * not a guest-facing sentence -- a real guest who mistyped or waited too
 * long for their code has no way to tell from that text whether they
 * mistyped, the code expired, or something else entirely. This maps just
 * those raw shapes to plain, reassuring copy for the specific form that hit
 * them, and passes every other real backend message through unchanged.
 */
export type GuestAuthErrorContext =
  | "otp_request"
  | "otp_verify"
  | "password"
  | "voucher"
  | "team_join"
  /** The post-connect profile card. It is not an auth surface -- the guest
   * is already online and nothing here can affect the gate -- but its
   * errors must read like every other guest-facing form's, and routing it
   * through the same function is what stops a sixth surface hand-rolling a
   * sixth error string that drifts from the other five. */
  | "profile";

const RAW_VALIDATION_MESSAGE = "Request validation failed";
const RAW_IDENTIFIER_PATTERN = /is not a valid identifier for channel/i;

const FRIENDLY_BY_CONTEXT: Record<GuestAuthErrorContext, string> = {
  otp_request:
    "That doesn't look like a valid mobile number or email address -- please check it and try again.",
  otp_verify: "That code didn't match -- check your messages and try again.",
  password: "Please double-check your phone number/email and password and try again.",
  voucher: "That voucher code doesn't look right -- please check it and try again.",
  // GuestTeamJoinRequest.team_code (1-32 chars) rarely 422s past client-
  // side `required`/`maxLength`, but keeps this consistent with every
  // other guest-facing form's fallback for the one raw, non-guest-facing
  // shape the backend can return.
  team_join: "That team code doesn't look right -- please check it and try again.",
  // Deliberately says the internet is working. A guest watching a failure
  // on a captive portal assumes the WiFi broke; by the time this card can
  // render, the RADIUS session is authorised and it did not.
  profile: "Couldn't save that. Your internet is working -- try again.",
};

/**
 * `localizedFallback` exists because the map above is English-only, and so
 * is every real backend message it passes through -- a pre-existing gap on
 * the sign-in surfaces, which are English-first. The post-connect profile
 * card is not: it ships in ten languages, and a guest reading the portal in
 * Malayalam should not be handed an English sentence for the one thing that
 * went wrong. A caller with a translated string for its own context passes
 * it here and it replaces the generic fallback ONLY -- a real, specific
 * backend reason still wins, unchanged, exactly as this module's docstring
 * requires.
 */
export function friendlyGuestAuthError(
  e: AppError,
  context: GuestAuthErrorContext,
  localizedFallback?: string,
): string {
  const isRawValidationError =
    e.status === 422 &&
    (e.message === RAW_VALIDATION_MESSAGE || RAW_IDENTIFIER_PATTERN.test(e.message));
  if (!isRawValidationError && e.message) return e.message;
  return localizedFallback || FRIENDLY_BY_CONTEXT[context];
}
