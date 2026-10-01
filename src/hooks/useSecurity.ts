import { useQuery } from "@tanstack/react-query";
import { useCustomerStore } from "@/stores/customerStore";
import { securityService } from "@/services/security.service";
import type { SecurityActivityWindow } from "@/types/security";

export const securityKeys = {
  // The venue is part of the key, not just of the request. Without it,
  // switching venue would serve the previous venue's posture from cache: the
  // page would re-render with the new venue's name in the header and the old
  // venue's numbers underneath it, which is worse than a stale reload because
  // nothing about it looks wrong.
  //
  // Read synchronously off the store rather than resolved by an async lookup,
  // deliberately -- an id that arrives after the first render changes the key
  // once it settles and fires every read on the page twice, which is the
  // reason dns.service.ts stopped taking an organizationId at all.
  overview: (locationId: string | null) => ["security", "overview", locationId] as const,
  capabilities: () => ["security", "capabilities"] as const,
  activity: (locationId: string | null, window: SecurityActivityWindow) =>
    ["security", "activity", locationId, window] as const,
};

/** The venue's security posture: score, counters, fleet health.
 *
 * No `organizationId` parameter, by the same rule the rest of the customer
 * surface follows -- tenant scope is a header the api client attaches, not an
 * argument. The venue is different: it is named per request and is part of the
 * query key, because it is what the numbers below are about. */
export const useSecurityOverview = () => {
  const locationId = useCustomerStore((s) => s.activeLocationId);
  return useQuery({
    queryKey: securityKeys.overview(locationId),
    queryFn: () => securityService.overview(locationId),
  });
};

/** The capability matrix. Long-lived by nature: what this platform can enforce
 * changes when the platform changes, not when the venue does -- so no venue in
 * the key, and none sent. */
export const useSecurityCapabilities = () =>
  useQuery({
    queryKey: securityKeys.capabilities(),
    queryFn: () => securityService.capabilities(),
    staleTime: 30 * 60 * 1000,
  });

/** What the protections did in the window. Venue in the key for the same
 * reason as the overview; the counters behind it change hourly, so a
 * five-minute stale time costs nothing. */
export const useSecurityActivity = (window: SecurityActivityWindow) => {
  const locationId = useCustomerStore((s) => s.activeLocationId);
  return useQuery({
    queryKey: securityKeys.activity(locationId, window),
    queryFn: () => securityService.activity(window, locationId),
    staleTime: 5 * 60 * 1000,
  });
};
