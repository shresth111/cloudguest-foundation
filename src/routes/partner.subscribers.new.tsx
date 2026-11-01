import { createFileRoute } from "@tanstack/react-router";
import { OnboardPage } from "@/components/isp-partner/onboarding/OnboardPage";

/** `/partner/subscribers/new` (ONBOARD-1): add a subscriber on one page.
 * `?lead_id=` (LEFTOVERS, APPS-2 #4) prefills from an Apps lead. */
export const Route = createFileRoute("/partner/subscribers/new")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { lead_id?: string } =>
    typeof search.lead_id === "string" && /^[0-9a-f-]{36}$/i.test(search.lead_id)
      ? { lead_id: search.lead_id }
      : {},
  component: OnboardRoute,
});

function OnboardRoute() {
  const { lead_id } = Route.useSearch();
  return <OnboardPage leadId={lead_id} />;
}
