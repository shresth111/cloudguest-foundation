import { useQuery } from "@tanstack/react-query";
import { securityService } from "@/services/security.service";

export const securityKeys = {
  overview: () => ["security", "overview"] as const,
  capabilities: () => ["security", "capabilities"] as const,
};

/** The venue's security posture: score, counters, fleet health.
 *
 * No `organizationId` parameter, by the same rule the rest of the customer
 * surface follows -- tenant scope is a header the api client attaches, not an
 * argument (see services/security.service.ts's own note). */
export const useSecurityOverview = () =>
  useQuery({
    queryKey: securityKeys.overview(),
    queryFn: () => securityService.overview(),
  });

/** The capability matrix. Long-lived by nature: what this platform can enforce
 * changes when the platform changes, not when the venue does. */
export const useSecurityCapabilities = () =>
  useQuery({
    queryKey: securityKeys.capabilities(),
    queryFn: () => securityService.capabilities(),
    staleTime: 30 * 60 * 1000,
  });
