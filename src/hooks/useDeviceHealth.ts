/**
 * Device health readings + per-interface traffic for the customer
 * dashboard's Devices page.
 *
 * Two reads compose here, mirroring how the ISP Details page already gets
 * its data: `routerService.listForLocation` for this venue's own devices
 * (it takes an explicit `organizationId` precisely so an ordinary
 * org-owner session never needs the platform-wide `GET /organizations`
 * fan-out, which such a session 403s on -- see that method's own note),
 * then `deviceHealthService.history` for the selected device.
 */
import { useQuery } from "@tanstack/react-query";
import { deviceHealthService } from "@/services/deviceHealth.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { useCustomerStore } from "@/stores/customerStore";
import { demoRouterDevices } from "@/components/customer/devices/demo-fixtures";
import { routerService } from "@/services/router.service";

export const deviceHealthKeys = {
  all: ["device-health"] as const,
  devices: (locationId?: string) => ["device-health", "devices", locationId] as const,
  history: (routerId?: string) => ["device-health", "history", routerId] as const,
};

/** This venue's own network devices, for the device picker. */
export function useLocationDevices(locationId?: string) {
  return useQuery({
    queryKey: deviceHealthKeys.devices(locationId),
    queryFn: async () => {
      // Demo host: no backend to resolve an organization against, so the
      // venue's routers come from the liveness summary the demo already
      // shows everywhere else. Real sessions never reach this branch.
      if (isDemo()) {
        const loc = useCustomerStore.getState().activeLocation;
        return demoRouterDevices(locationId!, loc?.id === locationId ? loc?.liveness?.routers : []);
      }
      const organizationId = await resolveOrgId();
      return routerService.listForLocation(locationId!, organizationId);
    },
    enabled: !!locationId,
    staleTime: 60_000,
  });
}

/**
 * Readings for one device, oldest-first.
 *
 * Refetched every 5 minutes because that is the real SNMP sweep cadence
 * (`ROUTER_SNMP_METRICS_POLL_SWEEP_INTERVAL_SECONDS = 300`) -- polling
 * faster would re-render the same rows and claim a freshness the
 * collection does not have.
 */
export function useDeviceHealthHistory(routerId?: string) {
  return useQuery({
    queryKey: deviceHealthKeys.history(routerId),
    queryFn: async () => {
      // Demo host: the service serves its own fixture and never uses the
      // org id, and resolving one needs a backend the demo does not have.
      if (isDemo()) return deviceHealthService.history(routerId!, "");
      const organizationId = await resolveOrgId();
      return deviceHealthService.history(routerId!, organizationId);
    },
    enabled: !!routerId,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}
