import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dnsService } from "@/services/dns.service";
import type { CreateDnsRecordPayload, DnsRecordListQuery, UpdateDnsRecordPayload } from "@/types/dns";

export const dnsKeys = {
  list: (q: DnsRecordListQuery) => ["dns", "list", q] as const,
};

export const useDnsRecords = (q: DnsRecordListQuery) =>
  useQuery({ queryKey: dnsKeys.list(q), queryFn: () => dnsService.list(q) });

export function useCreateDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDnsRecordPayload) => dnsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns", "list"] }),
  });
}

export function useUpdateDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      organizationId,
    }: {
      id: string;
      payload: UpdateDnsRecordPayload;
      organizationId?: string;
    }) => dnsService.update(id, payload, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns", "list"] }),
  });
}

export function useDeleteDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      dnsService.remove(id, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns", "list"] }),
  });
}
