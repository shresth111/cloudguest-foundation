import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { voucherService } from "@/services/voucher.service";
import type { CreateVoucherBatchPayload } from "@/types/voucher";

export const voucherKeys = {
  batches: (page: number) => ["voucher", "batches", page] as const,
  kpis: ["voucher", "kpis"] as const,
  plans: (orgId?: string) => ["voucher", "plans", orgId ?? "all"] as const,
  vouchers: (batchId: string) => ["voucher", "vouchers", batchId] as const,
  stats: (batchId: string) => ["voucher", "stats", batchId] as const,
};

export const useVoucherBatches = (page = 1) =>
  useQuery({ queryKey: voucherKeys.batches(page), queryFn: () => voucherService.listBatches(page) });

export const useVoucherKpis = () =>
  useQuery({ queryKey: voucherKeys.kpis, queryFn: voucherService.kpis });

export const useVoucherPlans = (organizationId?: string) =>
  useQuery({
    queryKey: voucherKeys.plans(organizationId),
    queryFn: () => voucherService.listPlans(organizationId),
    enabled: !!organizationId,
  });

export const useBatchVouchers = (batchId: string, organizationId: string) =>
  useQuery({
    queryKey: voucherKeys.vouchers(batchId),
    queryFn: () => voucherService.listVouchers(batchId, organizationId),
    enabled: !!batchId && !!organizationId,
  });

export const useBatchStats = (batchId: string, organizationId: string) =>
  useQuery({
    queryKey: voucherKeys.stats(batchId),
    queryFn: () => voucherService.getStats(batchId, organizationId),
    enabled: !!batchId && !!organizationId,
  });

function invalidateBatches(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["voucher", "batches"] });
  qc.invalidateQueries({ queryKey: voucherKeys.kpis });
}

export function useCreateVoucherBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVoucherBatchPayload) => voucherService.createBatch(payload),
    onSuccess: () => invalidateBatches(qc),
  });
}

export function useApproveVoucherBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId: string }) =>
      voucherService.approveBatch(id, organizationId),
    onSuccess: () => invalidateBatches(qc),
  });
}

export function useRevokeVoucherBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      organizationId,
      reason,
    }: {
      id: string;
      organizationId: string;
      reason?: string;
    }) => voucherService.revokeBatch(id, organizationId, reason),
    onSuccess: () => invalidateBatches(qc),
  });
}
