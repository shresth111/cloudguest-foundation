import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingService } from "@/services/billing.service";
import type {
  BillingReportFormat,
  Coupon,
  OverviewOrganization,
  PaymentGateway,
  Plan,
  ScheduledBillingReport,
  TaxRate,
} from "@/types/billing";

const KEY = ["billing", "snapshot"] as const;

export function useBillingSnapshot() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => billingService.getSnapshot(),
    staleTime: 30_000,
  });
}

/** The 3-request billing slice the Platform Overview's charts and MRR tile
 * need, so they don't sit behind getSnapshot's `5 + 4N`-request per-org
 * fan-out. Separate cache key on purpose: both can be in flight at once and
 * each card renders off whichever has landed. See billingService.getOverview. */
export function useBillingOverview() {
  return useQuery({
    queryKey: ["billing", "overview"],
    queryFn: () => billingService.getOverview(),
    staleTime: 30_000,
  });
}

/** The Platform Overview's expiry reminders ("Starter plan expires in 3 days"),
 * which are the one part of that page's Billing Reminders card the cheap
 * useBillingOverview cannot derive -- see billingService.getExpiringReminders.
 *
 * Deliberately its own query key rather than part of useBillingOverview: it
 * costs one request per organization and only the reminders card waits on it,
 * while the KPI tiles, both charts and the Organizations table render off the
 * overview alone. Gated on the overview having resolved, since the
 * organization rows it fans out over come from there. */
export function useExpiringReminders(organizations: OverviewOrganization[] | undefined) {
  const organizationIds = organizations?.map((o) => o.organizationId) ?? [];
  return useQuery({
    queryKey: ["billing", "expiring", organizationIds],
    queryFn: () => billingService.getExpiringReminders(organizations!),
    enabled: organizationIds.length > 0,
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
    mutationFn: (input: Parameters<typeof billingService.createSubscription>[0]) =>
      billingService.createSubscription(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingService.cancelSubscription(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpgradeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingService.upgradeSubscription(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetAutoRenew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; autoRenew: boolean }) =>
      billingService.setAutoRenew(input.id, input.autoRenew),
    onSuccess: () => invalidate(qc),
  });
}

export function useDowngradeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingService.downgradeSubscription(id),
    onSuccess: () => invalidate(qc),
  });
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
  return useMutation({
    mutationFn: (id: string) => billingService.deletePlan(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useSaveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Coupon, "id" | "used"> & { id?: string }) =>
      billingService.saveCoupon(input),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingService.deleteCoupon(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useToggleGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: PaymentGateway) => billingService.toggleGateway(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingService.refundPayment(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useScheduledBillingReports() {
  return useQuery({
    queryKey: ["billing", "scheduled"],
    queryFn: () => billingService.listScheduledReports(),
  });
}

export function useCreateScheduledBillingReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ScheduledBillingReport, "id" | "nextRunAt">) =>
      billingService.createScheduledReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "scheduled"] }),
  });
}

export function useToggleScheduledBillingReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      billingService.toggleScheduledReport(input.id, input.enabled),
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
    mutationFn: (input: { type: string; format: BillingReportFormat }) =>
      billingService.generateReport(input.type, input.format),
  });
}

export function useTaxRates() {
  return useQuery({
    queryKey: ["billing", "tax-rates"],
    queryFn: () => billingService.listTaxRates(),
  });
}

export function useSaveTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<TaxRate, "id" | "createdAt" | "updatedAt"> & { id?: string }) =>
      billingService.saveTaxRate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "tax-rates"] }),
  });
}

export function useDownloadInvoice() {
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      billingService.generateInvoice(id, organizationId),
  });
}

export function useGenerateAndSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      subscriptionId,
    }: {
      organizationId: string;
      subscriptionId?: string;
    }) => billingService.generateAndSendInvoice(organizationId, subscriptionId),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateManualInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      lineItems,
    }: {
      organizationId: string;
      lineItems: { description: string; quantity: number; unitPrice: number }[];
    }) => billingService.createManualInvoice(organizationId, lineItems),
    onSuccess: () => invalidate(qc),
  });
}

// Tenant-facing "my billing" summary (real GET /billing/dashboard/me) --
// used by the Subscription center and workspace Billing pages, which are a
// different, org-scoped audience than useBillingSnapshot's Super Admin view.
export function useMyBillingDashboard(
  organizationId: string | undefined,
  organizationName: string | undefined,
) {
  return useQuery({
    queryKey: ["billing", "me", organizationId],
    queryFn: () => billingService.getMyBillingDashboard(organizationId!, organizationName ?? ""),
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}

// No reminder-dispatch endpoint exists in backend/app/domains/billing --
// billingService.sendReminder is intentionally still mocked (see its own
// comment); this hook just routes RemindersPanel's "Send" button through
// that one existing mock instead of a bare, unbacked toast.
export function useSendReminder() {
  return useMutation({ mutationFn: (id: string) => billingService.sendReminder(id) });
}
