/** Queries and mutations for ADDENDUM_01: service state and Phase 1b billing. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingService, serviceControl } from "@/services/isp-partner/billing";
import { ispKeys } from "@/hooks/isp-partner/keys";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import type {
  BillingSettingsUpdate,
  CustomerBillingPlan,
  InvoiceCreate,
  InvoiceQuery,
  PaymentCreate,
  PaymentQuery,
  ServiceState,
  SuspendServiceBody,
} from "@/services/isp-partner/billing-types";

export const billingKeys = {
  service: (id: string) => ["isp", "billing", "service", id] as const,
  billing: ["isp", "billing"] as const,
  settings: ["isp", "billing", "settings"] as const,
  plan: (id: string) => ["isp", "billing", "plan", id] as const,
  ledger: (id: string) => ["isp", "billing", "ledger", id] as const,
  invoices: (q: object) => ["isp", "billing", "invoices", q] as const,
  payments: (q: object) => ["isp", "billing", "payments", q] as const,
};

const PENDING = new Set(["suspend_pending", "resume_pending"]);

export function useServiceState(customerId: string) {
  return useQuery({
    queryKey: billingKeys.service(customerId),
    queryFn: () => serviceControl.get(customerId),
    retry: retryUnless4xx,
    // While routers are still being worked on, keep the step list live.
    refetchInterval: (q) => (q.state.data && PENDING.has(q.state.data.state) ? 15_000 : false),
  });
}

function useAfterServiceChange(customerId: string) {
  const qc = useQueryClient();
  return (data: ServiceState) => {
    qc.setQueryData(billingKeys.service(customerId), data);
    return Promise.all([
      qc.invalidateQueries({ queryKey: ispKeys.customers }),
      qc.invalidateQueries({ queryKey: ispKeys.overview }),
      qc.invalidateQueries({ queryKey: billingKeys.ledger(customerId) }),
      qc.invalidateQueries({ queryKey: ["isp", "tr069"] }),
    ]);
  };
}

export function useSuspendService(customerId: string) {
  const after = useAfterServiceChange(customerId);
  return useMutation({
    mutationFn: (v: { body: SuspendServiceBody; key: string }) =>
      serviceControl.suspend(customerId, v.body, v.key),
    onSuccess: after,
  });
}

export function useResumeService(customerId: string) {
  const after = useAfterServiceChange(customerId);
  return useMutation({
    mutationFn: (v: { note: string; key: string }) =>
      serviceControl.resume(customerId, v.note, v.key),
    onSuccess: after,
  });
}

export function useRetryService(customerId: string) {
  const after = useAfterServiceChange(customerId);
  return useMutation({ mutationFn: () => serviceControl.retry(customerId), onSuccess: after });
}

export function useSuspendForDues(customerId: string) {
  const after = useAfterServiceChange(customerId);
  return useMutation({
    mutationFn: (key: string) => billingService.suspendForDues(customerId, key),
    onSuccess: after,
  });
}

// ------------------------------------------------------------------ billing

export function useBillingSettings(enabled = true) {
  return useQuery({
    queryKey: billingKeys.settings,
    queryFn: () => billingService.getSettings(),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useSaveBillingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BillingSettingsUpdate) => billingService.putSettings(body),
    onSuccess: (data) => qc.setQueryData(billingKeys.settings, data),
  });
}

export function useCustomerPlan(customerId: string) {
  return useQuery({
    queryKey: billingKeys.plan(customerId),
    queryFn: () => billingService.getPlan(customerId),
    retry: retryUnless4xx,
  });
}

export function useSaveCustomerPlan(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerBillingPlan) => billingService.putPlan(customerId, body),
    onSuccess: (data) => qc.setQueryData(billingKeys.plan(customerId), data),
  });
}

export function useCustomerLedger(customerId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.ledger(customerId),
    queryFn: () => billingService.ledger(customerId),
    retry: retryUnless4xx,
    enabled: enabled && !!customerId,
  });
}

export function useInvoices(q: InvoiceQuery) {
  return useQuery({
    queryKey: billingKeys.invoices(q),
    queryFn: () => billingService.listInvoices(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function usePayments(q: PaymentQuery) {
  return useQuery({
    queryKey: billingKeys.payments(q),
    queryFn: () => billingService.listPayments(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateBilling() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: billingKeys.billing });
}

export function useCreateInvoice() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (body: InvoiceCreate) => billingService.createInvoice(body),
    onSuccess: () => invalidate(),
  });
}

export function useGenerateDueInvoices() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: () => billingService.generateDue(),
    onSuccess: () => invalidate(),
  });
}

export function useVoidInvoice() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => billingService.voidInvoice(v.id, v.reason),
    onSuccess: () => invalidate(),
  });
}

export function useRecordPayment() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (v: { body: PaymentCreate; key: string }) =>
      billingService.recordPayment(v.body, v.key),
    onSuccess: () => invalidate(),
  });
}

export function useVoidPayment() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => billingService.voidPayment(v.id, v.reason),
    onSuccess: () => invalidate(),
  });
}
