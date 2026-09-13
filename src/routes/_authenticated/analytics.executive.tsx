import { createFileRoute } from "@tanstack/react-router";
import { PieChart } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { EmptyState } from "@/components/common/EmptyState";
import { ExecutiveInsightsPanel } from "@/components/analytics/customer/CustomerAnalyticsPanels";
import {
  useDomainAuthAnalytics,
  useDomainGuestAnalytics,
  useDomainNetworkAnalytics,
  useResolvedOrganizationId,
} from "@/hooks/useAnalytics";

export const Route = createFileRoute("/_authenticated/analytics/executive")({
  component: Page,
});

function Page() {
  const org = useResolvedOrganizationId();
  const guests = useDomainGuestAnalytics(org.data ?? undefined);
  const network = useDomainNetworkAnalytics(org.data ?? undefined);
  const auth = useDomainAuthAnalytics(org.data ?? undefined);

  return (
    <PageShell>
      <SectionHeader
        title="Executive summary"
        description="Top-line guest, network and authentication figures for your venue."
      />
      {org.isError ? (
        <EmptyState
          icon={PieChart}
          title="No organization in context"
          description="This screen needs an organization to scope the executive summary to."
        />
      ) : (
        <ExecutiveInsightsPanel
          guests={guests.data}
          network={network.data}
          auth={auth.data}
          isLoading={org.isLoading || guests.isLoading || network.isLoading || auth.isLoading}
          isError={guests.isError || network.isError || auth.isError}
          onRetry={() => {
            guests.refetch();
            network.refetch();
            auth.refetch();
          }}
        />
      )}
    </PageShell>
  );
}
