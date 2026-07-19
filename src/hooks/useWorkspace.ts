import { useQueries } from "@tanstack/react-query";
import { customerService, type LocationResources } from "@/services/customer.service";
import { customerKeys } from "@/hooks/useCustomer";
import { useWorkspace } from "@/context/WorkspaceContext";

export interface ScopedLocation {
  id: string;
  name: string;
  city: string;
  siteType: string;
  resources: LocationResources | undefined;
  isLoading: boolean;
}

/** Resolve the workspace scope to a list of locations (all or a single active one)
 *  with resources fetched via TanStack Query. */
export function useWorkspaceScope(): {
  isLoading: boolean;
  scope: ScopedLocation[];
  aggregated: LocationResources;
} {
  const { customer, locations, activeLocationId } = useWorkspace();
  const scoped =
    activeLocationId === "all" ? locations : locations.filter((l) => l.id === activeLocationId);

  const queries = useQueries({
    queries: scoped.map((l) => ({
      queryKey: customerKeys.locationResources(l.id),
      queryFn: () => customerService.getLocationResources(l.id),
      enabled: !!customer,
    })),
  });

  const scope: ScopedLocation[] = scoped.map((l, i) => ({
    id: l.id,
    name: l.name,
    city: l.city,
    siteType: l.siteType,
    resources: queries[i]?.data,
    isLoading: queries[i]?.isLoading ?? false,
  }));

  const isLoading = queries.some((q) => q.isLoading);

  const aggregated: LocationResources = {
    routers: scope.flatMap((s) => s.resources?.routers ?? []),
    staff: scope.flatMap((s) => s.resources?.staff ?? []),
    guests: scope.flatMap((s) => s.resources?.guests ?? []),
    analytics: {
      activeGuests: scope.reduce((a, s) => a + (s.resources?.analytics.activeGuests ?? 0), 0),
      peakConcurrent: scope.reduce(
        (a, s) => Math.max(a, s.resources?.analytics.peakConcurrent ?? 0),
        0,
      ),
      dailySessions: scope.reduce((a, s) => a + (s.resources?.analytics.dailySessions ?? 0), 0),
      dataConsumedGb: scope.reduce((a, s) => a + (s.resources?.analytics.dataConsumedGb ?? 0), 0),
      topDevice: scope[0]?.resources?.analytics.topDevice ?? "—",
      satisfaction: Math.round(
        scope.reduce((a, s) => a + (s.resources?.analytics.satisfaction ?? 0), 0) /
          Math.max(1, scope.length),
      ),
    },
  };

  return { isLoading, scope, aggregated };
}
