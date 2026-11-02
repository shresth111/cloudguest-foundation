import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCustomerStore } from "@/stores/customerStore";
import { customerService } from "@/services/customer.service";
import type { LocationLiveness } from "@/lib/location-liveness";
import { reconcileVenueLiveness, venueSnapshotNeedsRefresh } from "@/lib/venue-snapshot";

/**
 * Write a fresh venue verdict into the persisted snapshot, when
 * `reconcileVenueLiveness` allows it (Aruba Instant On venues only; a failed
 * read never replaces a known verdict). DASHBOARD_PLAN P1-J.
 */
export function useWriteBackVenueLiveness(
  locationId: string | null | undefined,
  fresh: LocationLiveness | null | undefined,
): void {
  useEffect(() => {
    if (!locationId || !fresh) return;
    const { activeLocationId, activeLocation, setActiveLocation } = useCustomerStore.getState();
    if (!activeLocation || activeLocationId !== locationId) return;
    const next = reconcileVenueLiveness(activeLocation.liveness, fresh);
    if (!next || next === activeLocation.liveness) return;
    setActiveLocation(locationId, {
      ...activeLocation,
      liveness: next,
      routersOnline: next.routersOnline,
      routersTotal: next.routersTotal,
    });
  }, [locationId, fresh]);
}

/**
 * On app load (any customer page but the dashboard, whose own read does
 * this), re-read the active venue's routers ONCE -- only when the stored
 * snapshot is Aruba Instant On. A MikroTik, Omada or failed-read snapshot
 * never makes the request.
 */
export function useVenueSnapshotRefresh(enabled: boolean): void {
  const locationId = useCustomerStore((s) => s.activeLocationId);
  const stored = useCustomerStore((s) => s.activeLocation?.liveness);
  const wanted = enabled && !!locationId && venueSnapshotNeedsRefresh(stored);
  const q = useQuery({
    queryKey: ["venue-snapshot-refresh", locationId],
    queryFn: () => customerService.readVenueLiveness(locationId!),
    enabled: wanted,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 0,
  });
  useWriteBackVenueLiveness(locationId, wanted ? q.data : null);
}
