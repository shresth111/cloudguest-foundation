/**
 * Which guest-portal origin a setup script generated in the ISP partner
 * console points routers at.
 *
 * The generator bakes `GUEST_PORTAL_PUBLIC_BASE` ("https://auth.wyfyguest.com",
 * RouterDetailTabs.tsx) into the hotspot login pages and the walled garden.
 * That is right for production, and wrong for a self-contained test stack: a
 * router enrolled against the test API would send its guests to the PROD
 * portal, which has never heard of the test stack's org/location/router ids.
 *
 * `vite-plugins/isp-portal-host.ts` rewrites that one constant, at build time,
 * into a call to `ispGuestPortalBase(<the original literal>)`. This function
 * returns the original value everywhere except on a partner host that has its
 * own portal listed below, so production (including `network.wyfyguest.com`)
 * is unchanged. The old file itself is not edited.
 */
import { isNetworkHost } from "./network-host";

/** Partner-console hostname -> guest portal origin for scripts generated there.
 * Only test stacks belong here; production uses the generator's default. */
export const ISP_GUEST_PORTAL_BASES: Readonly<Record<string, string>> = {
  // wyfy-isp-test (13.207.70.7): STAGING_RESULTS.md "Guest portal on wyfy-isp-test".
  "network-staging.wyfyguest.com": "https://auth-isp.wyfyguest.com",
};

function currentHostname(): string {
  return typeof window !== "undefined" && window.location ? window.location.hostname : "";
}

/** `fallback` unless this is a partner host with its own portal listed above. */
export function ispGuestPortalBase(fallback: string, hostname: string = currentHostname()): string {
  if (!hostname || !isNetworkHost(hostname)) return fallback;
  return ISP_GUEST_PORTAL_BASES[hostname] ?? fallback;
}
