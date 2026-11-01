import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FinancePage, type FinanceTab } from "@/components/isp-partner/finance/FinancePage";

const TABS = [
  "template",
  "products",
  "packages",
  "leases",
  "deposits",
  "zones",
  "automation",
  "messages",
] as const;

/** `/partner/finance` (JAZE-4, ADDENDUM_05). */
export const Route = createFileRoute("/partner/finance")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: FinanceTab } =>
    typeof search.tab === "string" && (TABS as readonly string[]).includes(search.tab)
      ? { tab: search.tab as FinanceTab }
      : {},
  component: FinanceRoute,
});

function FinanceRoute() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <FinancePage
      tab={tab ?? "template"}
      onTab={(t) =>
        navigate({
          to: "/partner/finance",
          search: t === "template" ? {} : { tab: t },
          replace: true,
        })
      }
    />
  );
}
