import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { connectedDeviceService } from "@/services/connected-device.service";
import type { ConnectedDevice } from "@/types/connected-device";

const K = {
  list: (routerId: string) => ["connected-devices", "list", routerId] as const,
  lastSync: (routerId: string) => ["connected-devices", "last-sync", routerId] as const,
};

export const useConnectedDevices = (routerId: string) =>
  useQuery({
    queryKey: K.list(routerId),
    queryFn: () => connectedDeviceService.list(routerId),
    enabled: !!routerId,
  });

export const useLastDeviceSyncRun = (routerId: string) =>
  useQuery({
    queryKey: K.lastSync(routerId),
    queryFn: () => connectedDeviceService.lastSyncRun(routerId),
    enabled: !!routerId,
  });

function useDeviceMutation(
  routerId: string,
  fn: (deviceId: string, reason?: string) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, reason }: { deviceId: string; reason?: string }) =>
      fn(deviceId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.list(routerId) }),
  });
}

export const useSyncConnectedDevices = (routerId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => connectedDeviceService.sync(routerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.list(routerId) });
      qc.invalidateQueries({ queryKey: K.lastSync(routerId) });
    },
  });
};

export const useDisconnectDevice = (routerId: string) =>
  useDeviceMutation(routerId, connectedDeviceService.disconnect);
export const useBlockDevice = (routerId: string) =>
  useDeviceMutation(routerId, connectedDeviceService.block);
export const useUnblockDevice = (routerId: string) =>
  useDeviceMutation(routerId, connectedDeviceService.unblock);
export const useWhitelistDevice = (routerId: string) =>
  useDeviceMutation(routerId, connectedDeviceService.whitelist);

/** At most this many pages of 100 -- a venue's own devices plus a busy
 * evening of guests. Past it the search covers what was loaded, and the
 * list says so. */
const MAX_DEVICE_PAGES = 5;

/** The devices the router sees (the connected-devices inventory, synced
 * from the router's DHCP leases and ARP table every few minutes). Fetched
 * only while a picker is open. */
export function usePickerDevices(routerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["firewall", "picker-devices", routerId] as const,
    enabled: !!routerId && enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<{ rows: ConnectedDevice[]; truncated: boolean }> => {
      const first = await connectedDeviceService.list(routerId, 1, 100);
      const rows = [...first.rows];
      const last = Math.min(first.totalPages, MAX_DEVICE_PAGES);
      for (let page = 2; page <= last; page += 1) {
        rows.push(...(await connectedDeviceService.list(routerId, page, 100)).rows);
      }
      return { rows, truncated: first.totalPages > MAX_DEVICE_PAGES };
    },
  });
}
