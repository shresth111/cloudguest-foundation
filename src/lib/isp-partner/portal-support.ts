/**
 * QA-021 / ADDENDUM_04 §3 (Portal row): on an ISP's guest portal the footer
 * shows the ISP's support phone/e-mail instead of "Support: ask venue staff".
 *
 * `vite-plugins/isp-portal-support.ts` swaps that one footer expression in the
 * old `PortalShell.tsx` for `<IspPortalSupport fallback={t("supportAskStaff")} />`
 * at build time, and only when the build has `VITE_ISP_PARTNER_ENABLED=true`.
 * With the flag off nothing is transformed and the bundle is byte-identical.
 * At runtime the component asks the backend
 * (`GET /isp/public/portal-support`) only on a host listed below, and renders
 * the fallback, unchanged, everywhere else and on any error. The old file
 * itself is not edited.
 */

/** Guest-portal hostnames that serve ISP customers. Test stacks only for now;
 * production ISP portals get added here when they exist. */
export const ISP_PORTAL_HOSTS: ReadonlySet<string> = new Set([
  // wyfy-isp-test: STAGING_RESULTS.md "Guest portal on wyfy-isp-test".
  "auth-isp.wyfyguest.com",
]);

export interface PortalSupportContact {
  support_phone: string | null;
  support_email: string | null;
}

export function isIspPortalHost(hostname: string): boolean {
  return ISP_PORTAL_HOSTS.has(hostname.toLowerCase());
}

/** "Support: +91 … · help@isp" in the portal's language. The localized label
 * is taken from the fallback ("Support: ask venue staff" → "Support",
 * "सहायता: …" → "सहायता"). Returns the fallback when there is nothing to show. */
export function supportLine(fallback: string, contact: PortalSupportContact | null): string {
  if (!contact) return fallback;
  const parts = [contact.support_phone, contact.support_email]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  const i = fallback.indexOf(":");
  const label = i > 0 ? fallback.slice(0, i).trim() : "Support";
  return `${label}: ${parts.join(" · ")}`;
}

/** The portal page's location id, from its own URL (`?locationId=`). */
export function portalLocationId(search: string): string | null {
  const id = new URLSearchParams(search).get("locationId");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function fetchPortalSupport(
  locationId: string,
  apiBase: string = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || "/api/v1",
): Promise<PortalSupportContact | null> {
  try {
    const res = await fetch(
      `${apiBase.replace(/\/$/, "")}/isp/public/portal-support?location=${encodeURIComponent(locationId)}`,
      { credentials: "omit", headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: PortalSupportContact };
    return body?.data ?? null;
  } catch {
    return null;
  }
}
