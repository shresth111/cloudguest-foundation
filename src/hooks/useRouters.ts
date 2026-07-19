import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routerService } from "@/services/router.service";
import type { CreateRouterPayload, RouterListQuery, RouterStatus } from "@/types/router";

export const routerKeys = {
  all: ["routers"] as const,
  list: (q: RouterListQuery) => ["routers", "list", q] as const,
  detail: (id: string) => ["routers", "detail", id] as const,
  devices: (id: string) => ["routers", "devices", id] as const,
  peers: (id: string) => ["routers", "peers", id] as const,
  alerts: (id: string) => ["routers", "alerts", id] as const,
};

export function useRouters(query: RouterListQuery) {
  return useQuery({
    queryKey: routerKeys.list(query),
    queryFn: () => routerService.list(query),
  });
}

export function useRouter(id: string) {
  return useQuery({
    queryKey: routerKeys.detail(id),
    queryFn: () => routerService.get(id),
    enabled: !!id,
  });
}

export function useConnectedDevices(id: string) {
  return useQuery({
    queryKey: routerKeys.devices(id),
    queryFn: () => routerService.connectedDevices(id),
    enabled: !!id,
  });
}

export function useWireGuardPeers(id: string) {
  return useQuery({
    queryKey: routerKeys.peers(id),
    queryFn: () => routerService.wireguardPeers(id),
    enabled: !!id,
  });
}

export function useRouterAlerts(id: string) {
  return useQuery({
    queryKey: routerKeys.alerts(id),
    queryFn: () => routerService.alerts(id),
    enabled: !!id,
  });
}

export function useCreateRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRouterPayload) => routerService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: routerKeys.all }),
  });
}

export function useUpdateRouterStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: RouterStatus }) =>
      routerService.updateStatus(ids, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: routerKeys.all }),
  });
}

export function useDeleteRouters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => routerService.remove(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: routerKeys.all }),
  });
}

export function useRebootRouters() {
  return useMutation({ mutationFn: (ids: string[]) => routerService.reboot(ids) });
}

export function useUpgradeRouters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => routerService.upgrade(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: routerKeys.all }),
  });
}
