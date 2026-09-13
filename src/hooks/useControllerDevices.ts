/**
 * Loads a location's Omada controller device inventory (read-only) for the
 * customer dashboard, mirroring `useMonitoredHardware`'s shape: demo accounts
 * never hit the backend, an unresolved location (`""`) waits, and a failed
 * read degrades to an honest empty state rather than a fabricated one.
 */
import { useCallback, useEffect, useState } from "react";
import {
  controllerDevicesService,
  type ControllerInventory,
} from "@/services/controllerDevices.service";
import { isDemo } from "@/services/customer.service";

const EMPTY: ControllerInventory = { status: "no_controller", devices: [] };

export function useControllerDevices(locationId?: string) {
  const demo = isDemo();
  const pendingLocation = locationId === "";
  const [inventory, setInventory] = useState<ControllerInventory>(EMPTY);
  const [loading, setLoading] = useState(!demo && !pendingLocation && !!locationId);

  const refetch = useCallback(async () => {
    // No controller inventory in the demo fixture, and nothing to ask about
    // for an unresolved or absent location id.
    if (demo || pendingLocation || !locationId) {
      setInventory(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setInventory(await controllerDevicesService.list(locationId));
    } catch {
      // e.g. a staff role without locations.read -- honest empty, never a
      // guessed device list.
      setInventory(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [demo, pendingLocation, locationId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { ...inventory, loading, refetch };
}
