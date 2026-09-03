import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vlanService } from "@/services/vlan.service";
import type { CreateVlanPayload, UpdateVlanPayload, VlanListQuery } from "@/types/vlan";

export const vlanKeys = {
  list: (q: VlanListQuery) => ["vlan", "list", q] as const,
  kpis: ["vlan", "kpis"] as const,
  deviceInterfaces: (routerId: string) => ["vlan", "device-interfaces", routerId] as const,
};

/** A push is not instant on the device: the row goes `provisioning` and only
 *  settles to `active` or `failed` once the router answers. Nothing on this
 *  page would move it, so poll while any row is still in flight -- and stop
 *  the moment none is, rather than polling the list forever. */
export const useVlans = (q: VlanListQuery) =>
  useQuery({
    queryKey: vlanKeys.list(q),
    queryFn: () => vlanService.list(q),
    refetchInterval: (query) =>
      query.state.data?.rows.some((v) => v.devicePushStatus === "provisioning") ? 4_000 : false,
  });

/** The interfaces that actually exist on a router, for the VLAN form's
 *  parent/access-port pickers. Resolves to `[]` (not an error) when the
 *  router is unreachable -- see `vlanService.listDeviceInterfaces`. */
export const useVlanDeviceInterfaces = (routerId: string) =>
  useQuery({
    queryKey: vlanKeys.deviceInterfaces(routerId),
    queryFn: () => vlanService.listDeviceInterfaces(routerId),
    enabled: !!routerId,
    staleTime: 15_000,
  });

export const useVlanKpis = () =>
  useQuery({ queryKey: vlanKeys.kpis, queryFn: vlanService.getKpis });

export function useCreateVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVlanPayload) => vlanService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vlan", "list"] });
      qc.invalidateQueries({ queryKey: vlanKeys.kpis });
    },
  });
}

/** Realizes a VLAN on its router. Separate from create/update on purpose --
 *  see `vlanService.push`. Invalidates the list so the device-push badge
 *  reflects the new state without a manual refresh. */
export function usePushVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vlanService.push(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vlan", "list"] });
      qc.invalidateQueries({ queryKey: vlanKeys.kpis });
    },
  });
}

export function useUpdateVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVlanPayload }) =>
      vlanService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vlan", "list"] });
      qc.invalidateQueries({ queryKey: vlanKeys.kpis });
    },
  });
}

export function useDeleteVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vlanService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vlan", "list"] });
      qc.invalidateQueries({ queryKey: vlanKeys.kpis });
    },
  });
}
