import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RevenuePage, type RevenueSearch } from "@/components/isp-partner/revenue/RevenuePage";
import { REASON_ORDER } from "@/lib/isp-partner/revenue";
import type { RiskReason } from "@/services/isp-partner/revenue-types";

const UUID = /^[0-9a-f-]{36}$/i;

/** `/partner/revenue` (REVENUE-HUB + CHURN-RISK). Every filter is in the URL;
 * `in_zone` (not `zone`: that one belongs to the header's Switch zone). */
export const Route = createFileRoute("/partner/revenue")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): RevenueSearch => {
    const out: RevenueSearch = {};
    if (s.tab === "overview" || s.tab === "risk") out.tab = s.tab;
    if (typeof s.month === "string" && /^\d{4}-\d{2}$/.test(s.month)) out.month = s.month;
    if (typeof s.in_zone === "string" && (s.in_zone === "none" || UUID.test(s.in_zone)))
      out.in_zone = s.in_zone;
    if (typeof s.package === "string" && UUID.test(s.package)) out.package = s.package;
    if (typeof s.reason === "string" && (REASON_ORDER as string[]).includes(s.reason))
      out.reason = s.reason as RiskReason;
    return out;
  },
  component: RevenueRoute,
});

function RevenueRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <RevenuePage
      search={search}
      onSearch={(next) => navigate({ to: "/partner/revenue", search: next, replace: true })}
    />
  );
}
