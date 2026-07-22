import { useQuery } from "@tanstack/react-query";
import { auditService } from "@/services/audit.service";
import type { AuditExportQuery, AuditListQuery } from "@/types/audit";

export const auditKeys = {
  list: (q: AuditListQuery) => ["audit", "list", q] as const,
  kpis: ["audit", "kpis"] as const,
};

export const useAuditList = (q: AuditListQuery) =>
  useQuery({ queryKey: auditKeys.list(q), queryFn: () => auditService.list(q) });

export const useAuditKpis = () =>
  useQuery({ queryKey: auditKeys.kpis, queryFn: auditService.getKpis });

export async function downloadAuditCsv(q: AuditExportQuery) {
  const { blob, truncated } = await auditService.exportCsv(q);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return { truncated };
}
