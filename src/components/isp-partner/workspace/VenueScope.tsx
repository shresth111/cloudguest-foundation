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
import { useEffect, type ReactNode } from "react";

import { setShimVenue } from "@/lib/isp-partner/api-shim";
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
  useEffect(() => {
    // Same guard every shim-touching component carries: the shim is only ever
    // installed on the network host, so pinning a venue anywhere else would be
    // arming behaviour that cannot fire. Keep the two in step.
    if (typeof window === "undefined" || !isNetworkHost(window.location.hostname)) return;
    setShimVenue(customerId, locationId);
    return () => setShimVenue(null, null);
  }, [customerId, locationId]);

  return (
    <VenueContext.Provider value={{ locationId, locationName, organizationId }}>
      {children}
    </VenueContext.Provider>
  );
}
