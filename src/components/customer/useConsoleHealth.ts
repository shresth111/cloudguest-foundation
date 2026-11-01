import { useQuery } from "@tanstack/react-query";
import { customerKeys } from "@/hooks/useCustomerDashboard";
import { customerService } from "@/services/customer.service";
import { useCustomerStore } from "@/stores/customerStore";
import type { LocationLiveness } from "@/lib/location-liveness";

/**
 * Where the top bar's verdict about the active venue comes from.
 *
 * NO FETCH OF ITS OWN. `enabled: false` subscribes to the dashboard query's
 * cache entry without ever requesting it: on the Dashboard the page's own
 * 60s poll feeds this live, and on any page visited after it the last real
 * answer stays readable. Where the cache is empty (a feature page opened
 * directly), it falls back to the verdict recorded when the venue was picked
 * (`customerStore.activeLocation.liveness`, from `listLocations()`), and
 * says so -- `source: "snapshot"` -- rather than presenting it as current.
 * No answer at all returns `null`, and the shell shows nothing.
 */
export function useConsoleHealth(locationId: string | null | undefined): {
  liveness: LocationLiveness;
  source: "live" | "snapshot";
  updatedAt: number | null;
} | null {
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const id = locationId ?? "";
  const live = useQuery({
    queryKey: customerKeys.dashboard(id),
    queryFn: () => customerService.getDashboard(id),
    enabled: false,
  });
  if (live.data?.liveness) {
    return { liveness: live.data.liveness, source: "live", updatedAt: live.dataUpdatedAt || null };
  }
  if (activeLocation?.liveness && (!locationId || activeLocation.id === locationId)) {
    return { liveness: activeLocation.liveness, source: "snapshot", updatedAt: null };
  }
  return null;
}
