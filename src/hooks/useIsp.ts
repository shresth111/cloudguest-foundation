import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ispService } from "@/services/isp.service";
import type {
  CreateIspLinkPayload,
  CreateIspRoutingRulePayload,
  IspLinkListQuery,
  IspRoutingRuleListQuery,
  UpdateIspLinkPayload,
  UpdateIspRoutingRulePayload,
} from "@/types/isp";

export const ispKeys = {
  links: (q: IspLinkListQuery) => ["isp", "links", q] as const,
  rules: (q: IspRoutingRuleListQuery) => ["isp", "routing-rules", q] as const,
};

export const useIspLinks = (q: IspLinkListQuery) =>
  useQuery({ queryKey: ispKeys.links(q), queryFn: () => ispService.listLinks(q) });

export function useCreateIspLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIspLinkPayload) => ispService.createLink(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "links"] }),
  });
}

export function useUpdateIspLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIspLinkPayload }) =>
      ispService.updateLink(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "links"] }),
  });
}

export function useDeleteIspLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ispService.removeLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "links"] }),
  });
}

export function useCheckIspLinkHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ispService.checkLinkHealth(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "links"] }),
  });
}

export function useTriggerIspFailover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routerId, reason }: { routerId: string; reason?: string }) =>
      ispService.triggerFailover(routerId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "links"] }),
  });
}

export function useTriggerIspFailback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routerId, reason }: { routerId: string; reason?: string }) =>
      ispService.triggerFailback(routerId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "links"] }),
  });
}

export const useIspRoutingRules = (q: IspRoutingRuleListQuery) =>
  useQuery({ queryKey: ispKeys.rules(q), queryFn: () => ispService.listRoutingRules(q) });

export function useCreateIspRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIspRoutingRulePayload) => ispService.createRoutingRule(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "routing-rules"] }),
  });
}

export function useUpdateIspRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIspRoutingRulePayload }) =>
      ispService.updateRoutingRule(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "routing-rules"] }),
  });
}

export function useDeleteIspRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ispService.removeRoutingRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "routing-rules"] }),
  });
}
