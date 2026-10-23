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
import { api } from "@/services/api";

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

/** `?reset=done` on `/partner/login` shows the "password updated" note. */
export const RESET_DONE = "done";
