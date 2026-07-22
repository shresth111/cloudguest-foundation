import { useQuery, useQueries } from "@tanstack/react-query";
import { routerService } from "@/services/router.service";
import { guestService } from "@/services/guest.service";
import type { RouterStatus } from "@/types/router";
import type { GuestAuthMethod, GuestSessionStatus } from "@/types/guest";
import { useWorkspace } from "@/context/WorkspaceContext";

export interface LocationRouterSummary {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  routerOsVersion: string | null;
  status: RouterStatus;
  publicIpAddress: string | null;
  lastSeenAt: string | null;
}

export interface LocationGuestSessionSummary {
  id: string;
  guestIdentifier: string;
  ipAddress: string | null;
  authMethod: GuestAuthMethod;
  status: GuestSessionStatus;
  startedAt: string;
  dataMb: number;
}

export interface LocationResources {
  routers: LocationRouterSummary[];
  guestSessions: LocationGuestSessionSummary[];
  analytics: {
    activeSessions: number;
    totalSessions: number;
    dataConsumedGb: number;
  };
}

const EMPTY_RESOURCES: LocationResources = {
  routers: [],
  guestSessions: [],
  analytics: { activeSessions: 0, totalSessions: 0, dataConsumedGb: 0 },
};

export const locationResourcesKeys = {
  forLocation: (id: string) => ["workspace", "locationResources", id] as const,
};

async function fetchLocationResources(locationId: string): Promise<LocationResources> {
  const [routersResult, sessionsResult] = await Promise.allSettled([
    routerService.list({ locationId, page: 1, pageSize: 100 }),
    guestService.listSessions({ locationId, page: 1, pageSize: 100 }),
  ]);

  const routers =
    routersResult.status === "fulfilled"
      ? routersResult.value.rows.map((r) => ({
          id: r.id,
          name: r.name,
          model: r.model,
          serialNumber: r.serialNumber,
          routerOsVersion: r.routerOsVersion,
          status: r.status,
          publicIpAddress: r.publicIpAddress,
          lastSeenAt: r.lastSeenAt,
        }))
      : [];

  const sessionRows = sessionsResult.status === "fulfilled" ? sessionsResult.value.rows : [];
  const guestSessions = sessionRows.map((s) => ({
    id: s.id,
    guestIdentifier: s.guestIdentifier,
    ipAddress: s.ipAddress,
    authMethod: s.authMethod,
    status: s.status,
    startedAt: s.startedAt,
    dataMb: (s.bytesUploaded + s.bytesDownloaded) / 1e6,
  }));

  return {
    routers,
    guestSessions,
    analytics: {
      activeSessions: guestSessions.filter((s) => s.status === "active").length,
      totalSessions:
        sessionsResult.status === "fulfilled" ? sessionsResult.value.total : guestSessions.length,
      dataConsumedGb: guestSessions.reduce((sum, s) => sum + s.dataMb, 0) / 1000,
    },
  };
}

export function useLocationResources(locationId: string) {
  return useQuery({
    queryKey: locationResourcesKeys.forLocation(locationId),
    queryFn: () => fetchLocationResources(locationId),
    enabled: !!locationId,
  });
}

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
      queryKey: locationResourcesKeys.forLocation(l.id),
      queryFn: () => fetchLocationResources(l.id),
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

  const aggregated: LocationResources = scope.reduce<LocationResources>(
    (acc, s) => ({
      routers: [...acc.routers, ...(s.resources?.routers ?? [])],
      guestSessions: [...acc.guestSessions, ...(s.resources?.guestSessions ?? [])],
      analytics: {
        activeSessions: acc.analytics.activeSessions + (s.resources?.analytics.activeSessions ?? 0),
        totalSessions: acc.analytics.totalSessions + (s.resources?.analytics.totalSessions ?? 0),
        dataConsumedGb: acc.analytics.dataConsumedGb + (s.resources?.analytics.dataConsumedGb ?? 0),
      },
    }),
    { ...EMPTY_RESOURCES, routers: [], guestSessions: [] },
  );

  return { isLoading, scope, aggregated };
}
