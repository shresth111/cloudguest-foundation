import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routerService } from "@/services/router.service";
import api from "@/services/api";
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

/** Allocates (or reuses) this router's WireGuard peer THROUGH THE HUB
 * BRIDGE -- `POST /routers/{id}/wireguard-peer/allocate-external`.
 *
 * Replaces `useCreateWireGuardPeer`/`useRotateWireGuardPeer`, which are gone
 * (2026-09-01). Those posted to `/routers/{id}/wireguard-peer` and
 * `.../wireguard-peer/rotate`, the paths where the PLATFORM generates the
 * keypair -- and the backend refuses both with `HubCannotLearnPlatformKeyError`
 * because the hub agent has no verb to be told a public key it did not
 * generate itself, so the tunnel would never establish. See
 * `routerService.allocateWireGuardPeerFromHub`'s docstring.
 *
 * `rotate: true` asks for a NEW peer instead of reusing the existing one.
 * Every non-reused allocation is permanent and unreclaimable on the hub
 * (no delete verb), so the caller should treat it as destructive and
 * confirm it. */
export function useAllocateWireGuardPeer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routerId, rotate }: { routerId: string; rotate?: boolean }) =>
      routerService.allocateWireGuardPeerFromHub(routerId, { rotate }),
    // Same invalidation set RouterSetupScriptAdvanced uses after this exact
    // call: allocate-external can move the peer's tunnel IP, and the WireGuard
    // tab (`wireguardPeer`), the detail header and the fleet list all render
    // from it. Skipping any of them leaves the console showing pre-allocation
    // state indefinitely -- the confirmed 2026-08-27 "the tunnel that appears
    // is the OLD one" report.
    onSuccess: (_data, { routerId }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: routerKeys.wireguardPeer(routerId) }),
        qc.invalidateQueries({ queryKey: routerKeys.detail(routerId) }),
        qc.invalidateQueries({ queryKey: routerKeys.all }),
      ]),
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

export function useUpdateRouterVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, vendor }: { id: string; vendor: string }) =>
      api.put(`/routers/${id}`, { vendor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: routerKeys.all }),
  });
}
