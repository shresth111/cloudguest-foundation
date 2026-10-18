import { requestErrorOf } from "@/services/api";
import type { LoginChannel } from "@/types/login-messaging";

export const CHANNEL_LABEL: Record<LoginChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
};

const ERROR_COPY: Record<string, string> = {
  byo_not_allowed:
    "Using your own provider for login codes isn't turned on for your account. Ask the Wyfy Guest team.",
  verification_code_invalid: "That isn't the code we sent. Check the message and try again.",
  verification_not_started: "Send a new code first. The settings changed or the code expired.",
  verification_rate_limited: "Too many tries. Wait ten minutes, then send a new code.",
  invalid_phone: "Enter a mobile number with country code, e.g. +91 98765 43210.",
  provider_encryption_unavailable:
    "Provider details can't be saved right now. The Wyfy Guest team has been told.",
  organization_not_found: "This customer no longer exists.",
  permission_denied: "Your role can't change login messaging.",
  forbidden: "Your role can't change login messaging.",
};

/** The server's `data.error_code` mapped to plain copy, else its message.
 * A vendor's own refusal (`provider_send_failed`) carries a scrubbed
 * `detail`, shown as is. */
export function loginMessagingError(err: unknown, fallback: string): string {
  const e = requestErrorOf(err);
  if (!e) return fallback;
  const code = (e.data?.error_code as string | undefined) ?? e.code;
  if (code === "provider_send_failed" && typeof e.data?.detail === "string") {
    return `Your provider didn't accept the code: ${e.data.detail}`;
  }
  if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  return e.message || fallback;
}
