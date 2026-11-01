import { createFileRoute } from "@tanstack/react-router";
import { AuditLogPage } from "@/components/isp-partner/audit/AuditLogPage";

/** `/partner/audit-log` (AUDIT-LOG): owner/admin only. */
export const Route = createFileRoute("/partner/audit-log")({
  ssr: false,
  component: AuditLogPage,
});
