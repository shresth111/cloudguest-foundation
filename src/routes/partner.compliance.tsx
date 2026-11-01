import { createFileRoute } from "@tanstack/react-router";
import { CompliancePage } from "@/components/isp-partner/compliance/CompliancePage";

/** `/partner/compliance` (lane JAZE-3). `?tab=` picks the section. */
export const Route = createFileRoute("/partner/compliance")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: string } =>
    typeof search.tab === "string" && search.tab ? { tab: search.tab } : {},
  component: CompliancePage,
});
