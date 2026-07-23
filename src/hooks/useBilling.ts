import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingService } from "@/services/billing.service";
import type { BillingReportFormat, Coupon, PaymentGateway, Plan, ScheduledBillingReport, TaxRate } from "@/types/billing";

const KEY = ["billing", "snapshot"] as const;

export function useBillingSnapshot() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => billingService.getSnapshot(),
    staleTime: 30_000,
  });
}

export function useOrganizationsList() {
  return useQuery({
    queryKey: ["billing", "orgs"],
    queryFn: () => billingService.listOrganizations(),
    staleTime: 5 * 60_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["billing"] });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof billingService.createSubscription>[0]) => billingService.createSubscription(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => billingService.cancelSubscription(id), onSuccess: () => invalidate(qc) });
}

export function useUpgradeSubscription() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => billingService.upgradeSubscription(id), onSuccess: () => invalidate(qc) });
}

export function useDowngradeSubscription() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => billingService.downgradeSubscription(id), onSuccess: () => invalidate(qc) });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Plan, "id"> & { id?: string }) => billingService.savePlan(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => billingService.deletePlan(id), onSuccess: () => invalidate(qc) });
}

export function useSaveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Coupon, "id" | "used"> & { id?: string }) => billingService.saveCoupon(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => billingService.deleteCoupon(id), onSuccess: () => invalidate(qc) });
}

export function useToggleGateway() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: PaymentGateway) => billingService.toggleGateway(id), onSuccess: () => invalidate(qc) });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => billingService.refundPayment(id), onSuccess: () => invalidate(qc) });
}

export function useScheduledBillingReports() {
  return useQuery({ queryKey: ["billing", "scheduled"], queryFn: () => billingService.listScheduledReports() });
}

export function useCreateScheduledBillingReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ScheduledBillingReport, "id" | "nextRunAt">) => billingService.createScheduledReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "scheduled"] }),
  });
}

export function useToggleScheduledBillingReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) => billingService.toggleScheduledReport(input.id, input.enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "scheduled"] }),
  });
}

export function useDeleteScheduledBillingReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingService.deleteScheduledReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "scheduled"] }),
  });
}

export function useGenerateBillingReport() {
  return useMutation({
    mutationFn: (input: { type: string; format: BillingReportFormat }) => billingService.generateReport(input.type, input.format),
  });
}

export function useTaxRates() {
  return useQuery({ queryKey: ["billing", "tax-rates"], queryFn: () => billingService.listTaxRates() });
}

export function useSaveTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<TaxRate, "id" | "createdAt" | "updatedAt"> & { id?: string }) => billingService.saveTaxRate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "tax-rates"] }),
  });
}

export function useDownloadInvoice() {
  return useMutation({ mutationFn: (id: string) => billingService.generateInvoice(id) });
}
