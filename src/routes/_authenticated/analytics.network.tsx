import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { EmptyState } from "@/components/common/EmptyState";
import { NetworkInsightsPanel } from "@/components/analytics/customer/CustomerAnalyticsPanels";
import { useDomainNetworkAnalytics, useResolvedOrganizationId } from "@/hooks/useAnalytics";

export const Route = createFileRoute("/_authenticated/analytics/network")({
  component: Page,
});

function Page() {
  const org = useResolvedOrganizationId();
  const query = useDomainNetworkAnalytics(org.data ?? undefined);

  return (
    <PageShell>
      <SectionHeader
        title="Network analytics"
        description="Data volume, throughput, router availability and the heaviest consumers across your network."
      />
      {org.isError ? (
        <EmptyState
          icon={Activity}
          title="No organization in context"
          description="This screen needs an organization to scope network analytics to."
        />
      ) : (
        <NetworkInsightsPanel
          data={query.data}
          isLoading={org.isLoading || query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
        />
      )}
    </PageShell>
  );
}
