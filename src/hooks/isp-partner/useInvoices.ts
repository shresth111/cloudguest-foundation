/** Queries and mutations for ADDENDUM_03 (invoices, zones, reports, recharge). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoicesService, zonesService } from "@/services/isp-partner/invoices";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import type { InvoiceListQuery } from "@/services/isp-partner/invoices-types";

export const invoiceKeys = {
  all: ["isp", "billing", "invoices-x"] as const,
  list: (q: object) => ["isp", "billing", "invoices-x", "list", q] as const,
  detail: (id: string) => ["isp", "billing", "invoices-x", "detail", id] as const,
  settings: ["isp", "billing", "invoices-x", "settings"] as const,
  collections: (q: object) => ["isp", "billing", "invoices-x", "collections", q] as const,
  outstanding: (q: object) => ["isp", "billing", "invoices-x", "outstanding", q] as const,
  zones: ["isp", "zones"] as const,
};

export function useInvoiceList(q: InvoiceListQuery) {
  return useQuery({
    queryKey: invoiceKeys.list(q),
    queryFn: () => invoicesService.list(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ""),
    queryFn: () => invoicesService.get(id ?? ""),
    retry: retryUnless4xx,
    enabled: !!id,
  });
}

export function useInvoiceSettings(enabled = true) {
  return useQuery({
    queryKey: invoiceKeys.settings,
    queryFn: () => invoicesService.getSettings(),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useCollections(
  q: { group_by: "zone" | "month" | "package"; since: string; until: string },
  enabled = true,
) {
  return useQuery({
    queryKey: invoiceKeys.collections(q),
    queryFn: () => invoicesService.collections(q),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useOutstanding(q: { as_of?: string; zone_id?: string }, enabled = true) {
  return useQuery({
    queryKey: invoiceKeys.outstanding(q),
    queryFn: () => invoicesService.outstanding(q),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useZones(enabled = true) {
  return useQuery({
    queryKey: invoiceKeys.zones,
    queryFn: () => zonesService.list(),
    retry: retryUnless4xx,
    staleTime: 60_000,
    enabled,
  });
}

/** Mutations here touch invoices, payments, ledgers and subscriber validity:
 * refresh all billing and plans queries. */
export function useInvoiceMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["isp", "billing"] }),
        qc.invalidateQueries({ queryKey: ["isp", "plans"] }),
        qc.invalidateQueries({ queryKey: invoiceKeys.zones }),
      ]),
  });
}
