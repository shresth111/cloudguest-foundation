/** Queries/mutations for the fiber registry (J22, lane JAZE-6 B). A 404 on
 * the list means `ISP_FIBER_ENABLED` is off: no retry. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fiberService } from "@/services/isp-partner/fiber";
import type { FiberNodeQuery } from "@/services/isp-partner/fiber-types";

export const fiberKeys = {
  all: ["isp", "fiber"] as const,
  nodes: (q: FiberNodeQuery) => ["isp", "fiber", "nodes", q] as const,
  node: (id: string) => ["isp", "fiber", "node", id] as const,
  ports: (id: string) => ["isp", "fiber", "ports", id] as const,
  downstream: (id: string) => ["isp", "fiber", "downstream", id] as const,
  subscriber: (id: string) => ["isp", "fiber", "subscriber", id] as const,
};

export function useFiberNodes(q: FiberNodeQuery, enabled = true) {
  return useQuery({
    queryKey: fiberKeys.nodes(q),
    queryFn: () => fiberService.nodes(q),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useFiberNode(id: string | null) {
  return useQuery({
    queryKey: fiberKeys.node(id ?? ""),
    queryFn: () => fiberService.node(id as string),
    enabled: !!id,
    retry: false,
  });
}

export function useFiberPorts(id: string | null, enabled = true) {
  return useQuery({
    queryKey: fiberKeys.ports(id ?? ""),
    queryFn: () => fiberService.ports(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}

export function useFiberDownstream(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: fiberKeys.downstream(id ?? ""),
    queryFn: () => fiberService.downstream(id as string),
    enabled: enabled && !!id,
    retry: false,
  });
}

export function useFiberSubscriberLocation(subscriberId: string | null) {
  return useQuery({
    queryKey: fiberKeys.subscriber(subscriberId ?? ""),
    queryFn: () => fiberService.subscriberLocation(subscriberId as string),
    enabled: !!subscriberId,
    retry: false,
  });
}

export function useFiberMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: fiberKeys.all }),
  });
}
