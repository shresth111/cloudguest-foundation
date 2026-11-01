import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CollectionsPage } from "@/components/isp-partner/collections/CollectionsPage";
import { COLLECTIONS_TABS, type CollectionsTab } from "@/lib/isp-partner/collections";

/** `/partner/collections` (COLLECTIONS-1). `?tab=` picks the view. */
export const Route = createFileRoute("/partner/collections")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: CollectionsTab } =>
    typeof search.tab === "string" && (COLLECTIONS_TABS as readonly string[]).includes(search.tab)
      ? { tab: search.tab as CollectionsTab }
      : {},
  component: CollectionsRoute,
});

function CollectionsRoute() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <CollectionsPage
      tab={tab ?? "overdue"}
      onTab={(t) =>
        navigate({
          to: "/partner/collections",
          search: t === "overdue" ? {} : { tab: t },
          replace: true,
        })
      }
    />
  );
}
