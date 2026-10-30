/**
 * The two reads the "Needs attention" card makes that no existing hook
 * exposes with an honest failure state.
 *
 *  - Open alerts. `getDashboard()`'s own `/alerts` leg turns a failed read
 *    into `recentAlerts: []` (customer.service.ts), which is
 *    indistinguishable from "no alerts" -- fine for a feed, wrong for a card
 *    whose empty state is "All good". So this asks `/alerts` itself, with the
 *    same org + location headers that call sends, and lets the error through.
 *  - Monitored hardware. `useMonitoredHardware` swallows its error into an
 *    empty list (and toasts), which again reads as "no devices down". This
 *    calls the same `deviceHardwareService.list()` through React Query so a
 *    failure stays a failure.
 *
 * Both are disabled until the caller says the user may read them (`enabled`),
 * so a role without the permission is never shown a "couldn't check" for a
 * read it was never allowed to make.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { deviceHardwareService, type MonitoredDeviceRow } from "@/services/deviceHardware.service";
import { useDeviceStore } from "@/stores/deviceStore";

/** The `AlertResponse` fields this card reads (monitoring/schemas.py). */
export interface OpenAlertRow {
  id: string;
  status: string;
  severity: string;
  location_id: string | null;
}

export const needsAttentionKeys = {
  openAlerts: (locationId: string) =>
    ["customer", "needs-attention", "alerts", locationId] as const,
  hardware: (locationId: string) =>
    ["customer", "needs-attention", "hardware", locationId] as const,
};

/** Every alert that is not resolved -- `triggered` (nobody has looked) and
 * `acknowledged` (someone has, it is still open) -- at this venue, plus
 * org-level alerts that name no location. `/alerts` has no `location_id`
 * filter and caps `page_size` at 100, so it asks per status and filters
 * here. Real sessions only; the demo has no `/alerts` to ask. */
export function useVenueOpenAlerts(locationId: string, enabled: boolean) {
  return useQuery({
    queryKey: needsAttentionKeys.openAlerts(locationId),
    queryFn: async (): Promise<OpenAlertRow[]> => {
      const orgId = await resolveOrgId();
      const headers = { "X-Organization-Id": orgId, "X-Location-Id": locationId };
      const statuses = ["triggered", "acknowledged"] as const;
      const pages = await Promise.all(
        statuses.map((status) =>
          api.get<{ items: OpenAlertRow[] }>("/alerts", {
            params: { status, page_size: 100, organization_id: orgId },
            headers,
          }),
        ),
      );
      return pages
        .flatMap((p) => p.data?.items ?? [])
        .filter((a) => a.status !== "resolved")
        .filter((a) => a.location_id == null || a.location_id === locationId);
    },
    enabled: enabled && !!locationId && !isDemo(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/** This venue's monitored hardware. The demo branch reads the same
 * `useDeviceStore` fixture `useMonitoredHardware` does, so the demo card
 * agrees with the demo's own Network Hardware card. */
export function useVenueMonitoredHardware(locationId: string, enabled: boolean) {
  const demo = isDemo();
  const demoDevices = useDeviceStore((s) => s.devices);
  const query = useQuery({
    queryKey: needsAttentionKeys.hardware(locationId),
    queryFn: (): Promise<MonitoredDeviceRow[]> => deviceHardwareService.list(locationId),
    enabled: enabled && !!locationId && !demo,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  if (demo) {
    return {
      data: demoDevices.filter((d) => d.locationId === locationId),
      isLoading: false,
      isError: false,
      error: null,
    };
  }
  return query;
}
