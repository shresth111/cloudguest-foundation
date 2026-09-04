/**
 * Shared "Network Hardware" data source for all three real call sites
 * (Dashboard's `DeviceStatusCard`, the Devices page's `NetworkHardwareView`,
 * and the location-picker's own cross-location device panel) -- one hook,
 * so each keeps reading/writing through the exact same real backend
 * (`deviceHardware.service.ts`) instead of three separate ad-hoc fetches
 * drifting out of sync.
 *
 * Demo accounts are untouched: `useDeviceStore`'s existing localStorage
 * fixture keeps working exactly as it did before this file existed --
 * `MonitoredDevice`'s field shape (`id`/`locationId`/`name`/`mac`/`type`/
 * `floor`/`status`/`statusChangedAt`) was deliberately mirrored by
 * `deviceHardware.service.ts`'s own `MonitoredDeviceRow`, so no reshaping
 * is needed between the two branches below.
 */
import { useCallback, useEffect, useState } from "react";
import { deviceHardwareService, type MonitoredDeviceRow } from "@/services/deviceHardware.service";
import { isDemo } from "@/services/customer.service";
import { useDeviceStore, type DeviceType } from "@/stores/deviceStore";

/**
 * `locationId` has three meanings here, and they are not interchangeable:
 *
 *   - omitted (`undefined`) -- deliberately org-wide, every location at once.
 *     `switch-location.tsx`'s cross-location "N devices down" summary wants
 *     exactly this, and the backend's `location_id` is optional for it.
 *   - a real id -- that one location.
 *   - `""` -- a caller that IS location-scoped but whose id has not resolved
 *     yet. `switch-location.tsx` computes
 *     `deviceLocationId || locations?.[0]?.id || ""`, so `AddDeviceDialog`
 *     (which mounts with the route, open or not) held `""` until the
 *     locations list landed.
 *
 * That third case used to fetch anyway. `location_id` is a `uuid.UUID | None`
 * on the backend (app/domains/monitored_hardware/router.py) and axios
 * serialises an empty string as a present-but-empty param -- `null` and
 * `undefined` it drops -- so the request went out as
 * `GET /monitored-hardware?location_id=&page_size=200` and came back 422 on
 * every load of that route, then refetched once the id arrived. Waiting is
 * the whole fix: an unresolved location has nothing to ask about yet.
 */
export function useMonitoredHardware(locationId?: string) {
  const demo = isDemo();
  const demoStore = useDeviceStore();
  const [realDevices, setRealDevices] = useState<MonitoredDeviceRow[]>([]);
  const pendingLocation = locationId === "";
  const [loading, setLoading] = useState(!demo);

  const refetch = useCallback(async () => {
    if (demo || pendingLocation) return;
    setLoading(true);
    try {
      setRealDevices(await deviceHardwareService.list(locationId));
    } catch {
      // Honest empty state on failure (e.g. a staff role without
      // monitored_hardware.read) -- never fabricated rows, same posture
      // this codebase's other real-data fetches already take.
      setRealDevices([]);
    } finally {
      setLoading(false);
    }
  }, [demo, locationId, pendingLocation]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // The demo fixture is a flat, unfiltered array (unlike the real branch,
  // which already asked the backend for just this location) -- filter it
  // client-side the same way every demo call site already did before this
  // hook existed, so an omitted `locationId` still means "every location"
  // for both branches alike.
  const devices: MonitoredDeviceRow[] = demo
    ? locationId
      ? demoStore.devices.filter((d) => d.locationId === locationId)
      : demoStore.devices
    : realDevices;

  const addDevice = useCallback(
    async (locId: string, name: string, mac: string, type: DeviceType, floor: string) => {
      if (demo) {
        demoStore.addDevice(locId, name, mac, type, floor);
        return;
      }
      await deviceHardwareService.register(locId, name, mac, type, floor);
      await refetch();
    },
    [demo, demoStore, refetch],
  );

  const removeDevice = useCallback(
    async (id: string) => {
      if (demo) {
        demoStore.removeDevice(id);
        return;
      }
      await deviceHardwareService.remove(id);
      await refetch();
    },
    [demo, demoStore, refetch],
  );

  return { devices, loading, addDevice, removeDevice, refetch };
}
