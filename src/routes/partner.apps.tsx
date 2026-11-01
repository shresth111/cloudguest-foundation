import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { APPS_TABS, AppsPage, type AppsTab } from "@/components/isp-partner/apps/AppsPage";

/** `/partner/apps` (APPS-FE). `?tab=` picks the app. */
export const Route = createFileRoute("/partner/apps")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: AppsTab } =>
    typeof search.tab === "string" && (APPS_TABS as readonly string[]).includes(search.tab)
      ? { tab: search.tab as AppsTab }
      : {},
  component: AppsRoute,
});

function AppsRoute() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AppsPage
      tab={tab ?? "helpdesk"}
      onTab={(t) =>
        navigate({ to: "/partner/apps", search: t === "helpdesk" ? {} : { tab: t }, replace: true })
      }
    />
  );
}
