/**
 * Who may open the partner console, decided from what the session already
 * knows -- before and after `GET /isp/me`.
 *
 * Founder test (2026-10-23): a GLOBAL Super Admin signing in at
 * network-staging got the raw backend text of `UnspecifiedOrganizationScopeError`
 * ("This request did not say which organization...") with Try again / Sign
 * out. `/isp/me` is ORGANIZATION-pinned and the shim had no ISP org to send
 * yet, so the backend rightly asked "which organization?". The answer the
 * person needed was "this is not an ISP account; Master is over there".
 *
 * - Before `/isp/me`: a GLOBAL-scope role, or a session whose roles hold no
 *   `isp-*` role at all, is not an ISP account. (Empty roles = not loaded
 *   yet: ask `/isp/me`.)
 * - After `/isp/me`: ISP_PARTNER_REQUIRED / ISP_ROLE_REQUIRED (our codes),
 *   `organization_required` (the GLOBAL caller's 400) and `permission_denied`
 *   (the pinned RBAC check runs before RequireIspPartner, per the BE lane)
 *   all mean the same thing.
 */
import type { RoleAssignment } from "@/types/auth";
import { requestErrorOf } from "@/services/api";

export type PartnerAccess = "unknown" | "not-partner" | "platform-account";

const NOT_PARTNER_CODES = new Set([
  "ISP_PARTNER_REQUIRED",
  "ISP_ROLE_REQUIRED",
  "organization_required",
  "permission_denied",
]);

export function accessFromRoles(
  roles: readonly RoleAssignment[] | null | undefined,
): PartnerAccess {
  const list = roles ?? [];
  if (list.some((r) => r.scopeType === "global")) return "platform-account";
  if (list.length > 0 && !list.some((r) => (r.roleSlug ?? "").startsWith("isp-"))) {
    return "not-partner";
  }
  return "unknown";
}

/** Both envelopes: our `data.code` and the platform's `data.error_code`. */
export function errorCodeOf(err: unknown): string | null {
  const data = requestErrorOf(err)?.data as Record<string, unknown> | undefined;
  const code = data?.code ?? data?.error_code;
  return typeof code === "string" ? code : null;
}

export function accessFromMeError(err: unknown): PartnerAccess {
  const code = errorCodeOf(err);
  if (code === "organization_required") return "platform-account";
  return code !== null && NOT_PARTNER_CODES.has(code) ? "not-partner" : "unknown";
}

/** Where a Wyfy platform (Master) account should sign in instead. */
export function masterLoginUrl(hostname: string): string {
  if (hostname === "network-staging.wyfyguest.com") {
    return "https://staging-isp.wyfyguest.com/master-login";
  }
  return "https://master.wyfyguest.com/master-login";
}
