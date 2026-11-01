/**
 * The ISP partner console's hostnames (API_CONTRACT §0, TASKS FS-3).
 *
 * network.wyfyguest.com is a third hostname of this same SPA, next to the
 * customer app and the Master console. Everything partner-specific (the
 * `/partner` routes, the setup-script request shim, the bare-root branch in
 * `routes/index.tsx`) asks this module first.
 *
 * Inert unless the build sets `VITE_ISP_PARTNER_ENABLED=true`: with the flag
 * unset, `isNetworkHost()` is false on every hostname, so the product behaves
 * exactly as it did before this module existed.
 */

export const NETWORK_HOSTNAMES = ["network.wyfyguest.com", "network-staging.wyfyguest.com"];

/** Where the partner console lives in production. */
export const NETWORK_HOST_URL = "https://network.wyfyguest.com";

/** The build-time feature flag. Default off. */
export function isIspPartnerFeEnabled(): boolean {
  return import.meta.env.VITE_ISP_PARTNER_ENABLED === "true";
}

/** True only when the flag is on and `hostname` is a partner host (or a
 * localhost dev session with `VITE_FORCE_NETWORK_HOST=1`). */
export function isNetworkHost(hostname: string): boolean {
  if (!isIspPartnerFeEnabled()) return false;
  if (NETWORK_HOSTNAMES.includes(hostname)) return true;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocal && import.meta.env.VITE_FORCE_NETWORK_HOST === "1";
}
