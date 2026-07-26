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
export type GuestAuthErrorContext = "otp_request" | "otp_verify" | "password" | "voucher";

const RAW_VALIDATION_MESSAGE = "Request validation failed";
const RAW_IDENTIFIER_PATTERN = /is not a valid identifier for channel/i;

const FRIENDLY_BY_CONTEXT: Record<GuestAuthErrorContext, string> = {
  otp_request: "That doesn't look like a valid mobile number or email address -- please check it and try again.",
  otp_verify: "That code didn't match -- check your messages and try again.",
  password: "Please double-check your phone number/email and password and try again.",
  voucher: "That voucher code doesn't look right -- please check it and try again.",
};

export function friendlyGuestAuthError(e: AppError, context: GuestAuthErrorContext): string {
  const isRawValidationError =
    e.status === 422 && (e.message === RAW_VALIDATION_MESSAGE || RAW_IDENTIFIER_PATTERN.test(e.message));
  return isRawValidationError ? FRIENDLY_BY_CONTEXT[context] : e.message;
}
