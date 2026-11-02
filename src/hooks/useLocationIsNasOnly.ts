import { useQuery } from "@tanstack/react-query";
import { isNasOnlyVendor } from "@/lib/router-vendors";
import { routerService } from "@/services/router.service";

/**
 * Master screens only: is every router at this location NAS-only (Aruba Instant
 * On)? The customer screens read this from the active location instead. `false`
 * while loading, on a failed read, and with no location, so nothing changes
 * unless the answer is known.
 */
export function useLocationIsNasOnly(
  locationId: string | null | undefined,
  organizationId: string | null | undefined,
): boolean {
  const { data } = useQuery({
    queryKey: ["location-is-nas-only", organizationId, locationId],
    queryFn: () =>
      routerService.list({
        locationId: locationId as string,
        // Goes straight to the location; without it the service fans out over every org.
        organizationId: organizationId as string,
        page: 1,
        pageSize: 50,
      }),
    enabled: !!locationId && !!organizationId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const rows = data?.rows ?? [];
  return rows.length > 0 && rows.every((r) => isNasOnlyVendor(r.vendor));
}
