import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { connectedDeviceService } from "@/services/connected-device.service";

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
