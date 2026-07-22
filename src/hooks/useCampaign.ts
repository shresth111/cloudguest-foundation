import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignService } from "@/services/campaign.service";
import type { CampaignListQuery, CreateCampaignPayload, UpdateCampaignPayload } from "@/types/campaign";

export const campaignKeys = {
  list: (q: CampaignListQuery) => ["campaign", "list", q] as const,
  kpis: ["campaign", "kpis"] as const,
};

function invalidateCampaigns(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["campaign", "list"] });
  qc.invalidateQueries({ queryKey: campaignKeys.kpis });
}

export const useCampaigns = (q: CampaignListQuery) =>
  useQuery({ queryKey: campaignKeys.list(q), queryFn: () => campaignService.list(q) });

export const useCampaignKpis = () =>
  useQuery({ queryKey: campaignKeys.kpis, queryFn: campaignService.getKpis });

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCampaignPayload) => campaignService.create(payload),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCampaignPayload }) =>
      campaignService.update(id, payload),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignService.remove(id),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useCloneCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      campaignService.clone(id, newName),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useScheduleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignService.schedule(id),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignService.pause(id),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignService.resume(id),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useEndCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignService.end(id),
    onSuccess: () => invalidateCampaigns(qc),
  });
}
