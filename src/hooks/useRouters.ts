import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routerService } from "@/services/router.service";
import type { CreateRouterPayload, RouterListQuery, RouterStatus } from "@/types/router";

export const routerKeys = {
  all: ["routers"] as const,
  list: (q: RouterListQuery) => ["routers", "list", q] as const,
  detail: (id: string) => ["routers", "detail", id] as const,
  wireguardPeer: (id: string) => ["routers", "wireguard-peer", id] as const,
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

export function useWireGuardPeer(id: string) {
  return useQuery({
    queryKey: routerKeys.wireguardPeer(id),
    queryFn: () => routerService.getWireGuardPeer(id),
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

export function useGenerateProvisioningToken() {
  return useMutation({
    mutationFn: (routerId: string) => routerService.generateProvisioningToken(routerId),
  });
}

export function useCreateWireGuardPeer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routerId: string) => routerService.createWireGuardPeer(routerId),
    onSuccess: (_data, routerId) =>
      qc.invalidateQueries({ queryKey: routerKeys.wireguardPeer(routerId) }),
  });
}

export function useRotateWireGuardPeer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routerId: string) => routerService.rotateWireGuardPeer(routerId),
    onSuccess: (_data, routerId) =>
      qc.invalidateQueries({ queryKey: routerKeys.wireguardPeer(routerId) }),
  });
}

export function useRevokeWireGuardPeer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routerId: string) => routerService.revokeWireGuardPeer(routerId),
    onSuccess: (_data, routerId) =>
      qc.invalidateQueries({ queryKey: routerKeys.wireguardPeer(routerId) }),
  });
}
