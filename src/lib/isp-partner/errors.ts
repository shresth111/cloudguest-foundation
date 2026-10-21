/**
 * The ISP API's machine error codes (API_CONTRACT §9) and what the partner
 * UI says for each.
 *
 * The code travels in the error envelope's `data.code`. `toAppError` keeps
 * `data` intact but sets its own `code` (`forbidden`, `validation_error`, a
 * slug of the message), so `data.code` has to be read explicitly.
 */
import { requestErrorOf, type AppError } from "@/services/api";

export function ispErrorCode(err: unknown): string | null {
  const e = requestErrorOf(err);
  const code = e?.data?.code;
  return typeof code === "string" ? code : null;
}

export function ispErrorStatus(err: unknown): number | null {
  return requestErrorOf(err)?.status ?? null;
}

const MESSAGES: Record<string, string> = {
  ISP_PARTNER_REQUIRED: "This account is not an ISP partner account.",
  ISP_ROLE_REQUIRED: "This account is not an ISP partner account.",
  ISP_PARTNER_SUSPENDED: "This ISP account is suspended. Contact Wyfy Guest support.",
  ISP_CUSTOMER_NOT_FOUND: "That customer does not exist, or you do not have access to it.",
  ISP_LOCATION_NOT_FOUND: "That location does not exist, or you do not have access to it.",
  ISP_ROUTER_NOT_FOUND: "That router does not exist, or you do not have access to it.",
  ISP_PORTAL_CONFIG_NOT_FOUND: "That portal does not exist, or you do not have access to it.",
  ISP_USER_NOT_FOUND: "That user does not exist in your ISP.",
  ISP_CUSTOMER_LIMIT: "Your ISP has reached its customer limit. Contact Wyfy Guest to raise it.",
  ISP_CUSTOMER_SLUG_TAKEN: "That slug is already used by another customer. Pick another one.",
  ISP_EXTERNAL_REF_TAKEN: "Another customer already uses that account number.",
  ISP_LAST_OWNER: "This is the last active ISP Owner. Add another owner first.",
  ISP_ROLE_INVALID: "That role cannot be given through this console.",
  ISP_ROLE_ESCALATION: "Only an ISP Owner can grant the Owner or Admin role.",
  ISP_CONFINEMENT_NOT_ALLOWED:
    "Owners and admins always see every customer, so they cannot be restricted.",
  ISP_CUSTOMER_REQUIRED: "Pick a customer first.",
  ISP_RANGE_TOO_LONG: "Pick a range of 92 days or less.",
  ISP_VENDOR_NOT_SUPPORTED: "Only MikroTik routers are supported for now.",
  ISP_FORCE_NOT_ALLOWED: "Forcing a new cloud link is not allowed from the partner console.",
  ISP_SCOPE_HEADERS_NOT_ALLOWED: "The request carried a header this console must not send.",
  TR069_NOT_ENABLED: "TR-069 is not switched on for this platform yet.",
  TR069_DEVICE_NOT_FOUND: "That device does not exist, or you do not have access to it.",
  TR069_DISABLED_FOR_CUSTOMER:
    "TR-069 is switched off for this device's customer. Turn it on in the customer's TR-069 tab first.",
  TR069_TASK_PENDING:
    "A task of this kind is already queued for this device. It runs at the device's next check-in.",
  TR069_ACS_UNAVAILABLE:
    "The device management server did not answer. Nothing was queued; try again in a minute.",
};

/** One sentence for any request failure. Known codes get our wording; the
 * rest show the backend's own message, never a generic "success". */
export function ispErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  const code = ispErrorCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const e: AppError | null = requestErrorOf(err);
  if (!e) return fallback;
  if (e.status === 403) return "You do not have permission to do this.";
  return e.message || fallback;
}

/** 422 field errors keyed by field name, when the backend sent them. */
export function ispFieldErrors(err: unknown): Record<string, string> {
  return requestErrorOf(err)?.fieldErrors ?? {};
}

export function isForbidden(err: unknown): boolean {
  return ispErrorStatus(err) === 403;
}

export function isNotFound(err: unknown): boolean {
  return ispErrorStatus(err) === 404;
}
