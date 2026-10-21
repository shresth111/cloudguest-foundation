import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BillingPage, type BillingTab } from "@/components/isp-partner/billing/BillingPage";

const TABS = ["dues", "invoices", "payments", "settings"] as const;

/** `/partner/billing` (ADDENDUM_01 Phase 1b). */
export const Route = createFileRoute("/partner/billing")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: BillingTab } =>
    typeof search.tab === "string" && (TABS as readonly string[]).includes(search.tab)
      ? { tab: search.tab as BillingTab }
      : {},
  component: BillingRoute,
});

function BillingRoute() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <BillingPage
      tab={tab ?? "dues"}
      onTab={(t) =>
        navigate({ to: "/partner/billing", search: t === "dues" ? {} : { tab: t }, replace: true })
      }
    />
  );
}
