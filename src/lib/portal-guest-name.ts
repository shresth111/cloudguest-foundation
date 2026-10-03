/**
 * Name required at sign-in -- the portal's half of the contract.
 *
 * Backend contract (cloud-guest `feat/portal-require-guest-name`):
 *
 *   - `POST /guest/login/otp` (and `GET /guest/session/active`) return
 *     `name_required: true` when the venue requires a name, the session is
 *     an OTP session, and the guest has none on file.
 *   - `POST /guest/sign-in-name { guest_id, session_id, display_name }`
 *     stores it. An empty/whitespace/too-long name is a 400 with
 *     `data.code === "guest_name_invalid"`.
 *   - Until then every step that opens the network refuses the session:
 *     `POST /network-integrations/portal/authorize` and
 *     `/portal/radius-authorize` answer 403 with
 *     `data.code === "guest_name_required"`; RADIUS Authorize rejects; the
 *     router agent's bypass list leaves the MAC out.
 *
 * Zero imports on purpose: the regression suite loads this file directly.
 */

export const GUEST_NAME_REQUIRED_CODE = "guest_name_required";
export const GUEST_NAME_INVALID_CODE = "guest_name_invalid";

/** Same cleaning the backend applies (`normalize_guest_display_name`):
 * trim, and collapse internal whitespace runs to one space. */
export function cleanGuestName(raw: string | null | undefined): string {
  return (raw ?? "").split(/\s+/).filter(Boolean).join(" ");
}

function codeOf(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const data = (err as { data?: Record<string, unknown> }).data;
  const raw = data?.["code"] ?? data?.["error_code"];
  return typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
}

/** True when an error is the backend refusing to open the network because
 * this session still needs its name. */
export function isGuestNameRequiredError(err: unknown): boolean {
  return codeOf(err) === GUEST_NAME_REQUIRED_CODE;
}

/** The i18n key for a failed `POST /guest/sign-in-name`. */
export function guestNameErrorKey(err: unknown): "errNameRequired" | "errNameSaveFailed" {
  const code = codeOf(err);
  return code === GUEST_NAME_INVALID_CODE || code === GUEST_NAME_REQUIRED_CODE
    ? "errNameRequired"
    : "errNameSaveFailed";
}

/** Whether `/portal/success` must show the name screen before it opens the
 * network. The SERVER's per-session bit only -- never derived from the
 * venue flag, because only the server knows whether a name is on file. */
export function needsNameStep(session: { nameRequired?: boolean } | null | undefined): boolean {
  return !!session?.nameRequired;
}
