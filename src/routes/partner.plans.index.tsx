import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlansPage, type PlansTab } from "@/components/isp-partner/plans/PlansPage";

const TABS = ["groups", "packages", "coupons", "subscribers"] as const;

/** `/partner/plans` (ADDENDUM_02). */
export const Route = createFileRoute("/partner/plans/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: PlansTab } =>
    typeof search.tab === "string" && (TABS as readonly string[]).includes(search.tab)
      ? { tab: search.tab as PlansTab }
      : {},
  component: PlansRoute,
});

function PlansRoute() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <PlansPage
      tab={tab ?? "groups"}
      onTab={(t) =>
        navigate({ to: "/partner/plans", search: t === "groups" ? {} : { tab: t }, replace: true })
      }
    />
  );
}
