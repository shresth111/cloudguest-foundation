/**
 * Partner console password reset (founder ask 2026-10-23).
 *
 * - Request: `POST /isp/auth/forgot-password` (cloud-guest #449). It issues the
 *   token through the existing AuthService and mails a link to
 *   `<partner host>/partner/reset-password?token=...`. Same reply whether or
 *   not the address is an ISP account.
 * - Reset: the existing, unchanged `POST /auth/reset-password`
 *   (`authService.resetPassword`). Single-use token, one-hour expiry.
 */
import axios, { type AxiosError } from "axios";
import { api, toAppError, type BackendEnvelope } from "@/services/api";

/** Pages under `/partner` that render without a session. */
export const PARTNER_PUBLIC_PATHS = [
  "/partner/login",
  "/partner/forgot-password",
  "/partner/reset-password",
] as const;

export function isPartnerPublicPath(pathname: string): boolean {
  const p = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return (PARTNER_PUBLIC_PATHS as readonly string[]).includes(p);
}

export async function requestPartnerPasswordReset(email: string): Promise<void> {
  await api.post("/isp/auth/forgot-password", { email: email.trim() });
}

/**
 * `POST /auth/reset-password` (unchanged endpoint), sent with the bare axios
 * rather than the shared `api` instance. Measured on the test box 2026-10-23:
 * a spent link answers 401, and the shared instance treats every non-login
 * 401 as an expired session (clearSession + /session-expired), so the visitor
 * never saw "this link can't be used". Nothing here is session-bound, so there
 * is nothing for that interceptor to refresh or tear down.
 */
export async function resetPartnerPassword(token: string, newPassword: string): Promise<void> {
  try {
    await axios.post(
      `${api.defaults.baseURL ?? ""}/auth/reset-password`,
      { token, new_password: newPassword },
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (axios.isAxiosError(err)) throw toAppError(err as AxiosError<BackendEnvelope<unknown>>);
    throw err;
  }
}

/** `?reset=done` on `/partner/login` shows the "password updated" note. */
export const RESET_DONE = "done";
