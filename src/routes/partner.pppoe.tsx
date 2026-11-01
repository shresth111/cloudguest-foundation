import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PPPOE_TABS, PppoePage, type PppoeTab } from "@/components/isp-partner/pppoe/PppoePage";

/** `/partner/pppoe` (lane JAZE-6, Phase 2b). `?tab=` picks the section. */
export const Route = createFileRoute("/partner/pppoe")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: PppoeTab } =>
    typeof search.tab === "string" && (PPPOE_TABS as readonly string[]).includes(search.tab)
      ? { tab: search.tab as PppoeTab }
      : {},
  component: PppoeRoute,
});

function PppoeRoute() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <PppoePage
      tab={tab ?? "sessions"}
      onTab={(t) =>
        navigate({
          to: "/partner/pppoe",
          search: t === "sessions" ? {} : { tab: t },
          replace: true,
        })
      }
    />
  );
}
