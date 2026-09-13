import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { SectionHeader } from "@/components/ui-ext/SectionHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Users } from "lucide-react";
import { GuestInsightsPanel } from "@/components/analytics/customer/CustomerAnalyticsPanels";
import { useDomainGuestAnalytics, useResolvedOrganizationId } from "@/hooks/useAnalytics";

export const Route = createFileRoute("/_authenticated/analytics/guest")({
  component: Page,
});

function Page() {
  const org = useResolvedOrganizationId();
  const query = useDomainGuestAnalytics(org.data ?? undefined);

  return (
    <PageShell>
      <SectionHeader
        title="Guest analytics"
        description="Repeat visits, dwell time, top devices, languages and locations for your venue."
      />
      {org.isError ? (
        <EmptyState
          icon={Users}
          title="No organization in context"
          description="This screen needs an organization to scope guest analytics to."
        />
      ) : (
        <GuestInsightsPanel
          data={query.data}
          isLoading={org.isLoading || query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
        />
      )}
    </PageShell>
  );
}
