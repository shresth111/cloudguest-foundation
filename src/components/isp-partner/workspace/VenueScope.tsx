/**
 * Pins one venue for a subtree, and for the request shim.
 *
 * Takes the ids rather than reading them: the partner workspace gets them from
 * its route params, so there is one source of truth and no way for the request
 * headers and the mounted view to disagree about which venue is open.
 *
 * The cleanup matters more than the setup. Clearing `setShimVenue` on unmount
 * means that with no venue pinned the shim rewrites nothing, so a customer path
 * reaches its original endpoint and fails closed rather than being rewritten
 * into a twin that cannot resolve a target.
 */
import { useEffect, useState, type ReactNode } from "react";

import { setShimVenue } from "@/lib/isp-partner/api-shim";
import { resetSessionScopeCaches } from "@/lib/session-scope-cache";
import { isNetworkHost } from "@/lib/isp-partner/network-host";
import { VenueContext } from "@/lib/venue";

export interface VenueScopeProps {
  customerId: string;
  locationId: string;
  locationName?: string | null;
  organizationId?: string | null;
  children: ReactNode;
}

export function VenueScope({
  customerId,
  locationId,
  locationName = null,
  organizationId = null,
  children,
}: VenueScopeProps) {
  // Children render only once THIS venue is pinned. React runs a child's
  // effects before its parent's, so without the gate a mounted customer page
  // (PortalPage) fires its first fetches before the shim knows the venue --
  // they would go out unrewritten and 403.
  const key = `${customerId}:${locationId}`;
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    // Same guard every shim-touching component carries: the shim is only ever
    // installed on the network host, so pinning a venue anywhere else would be
    // arming behaviour that cannot fire. Keep the two in step.
    if (typeof window === "undefined" || !isNetworkHost(window.location.hostname)) {
      setPinned(key);
      return;
    }
    setShimVenue(customerId, locationId);
    // Customer pages resolve "my organization" once and cache it
    // (services/organization-id.ts). Drop that cache on every pin and unpin so
    // the page re-asks -- through the venue twin -- and gets THIS customer,
    // never the ISP or the previously open customer.
    resetSessionScopeCaches();
    setPinned(key);
    return () => {
      setShimVenue(null, null);
      resetSessionScopeCaches();
    };
  }, [customerId, locationId, key]);

  return (
    <VenueContext.Provider value={{ locationId, locationName, organizationId }}>
      {pinned === key ? children : null}
    </VenueContext.Provider>
  );
}
