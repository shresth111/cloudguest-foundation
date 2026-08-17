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

// 20s poll, matching the customer dashboard's own IspDetailsView
// (OperationsFeatures.tsx) auto-refresh -- added there after a real,
// verified-live incident: an admin/operator watching this table had no way
// to see a link flip healthy/unhealthy after the backend's own 60-second
// health-check sweep updates it server-side without a manual reload or a
// mutation of their own. `refetchIntervalInBackground` defaults to
// `false`, so (like that same page's Page Visibility-gated interval) this
// pauses while the tab isn't focused and catches up via React Query's own
// default `refetchOnWindowFocus` on return -- no custom visibility
// wiring needed here. Quiet by construction: React Query only flips
// `isLoading` on the *first* fetch, so a background refetch never flashes
// the table into its loading state, and this hook raises no toast of its
// own on a blip -- same "keep showing last known-good state" intent.
const ISP_LINKS_POLL_INTERVAL_MS = 20_000;

export const useIspLinks = (q: IspLinkListQuery) =>
  useQuery({
    queryKey: ispKeys.links(q),
    queryFn: () => ispService.listLinks(q),
    refetchInterval: ISP_LINKS_POLL_INTERVAL_MS,
  });

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
