import { createFileRoute } from "@tanstack/react-router";
import { Cable } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { EmptyState } from "@/components/common/EmptyState";
import { IspInsightsPanel } from "@/components/analytics/customer/CustomerAnalyticsPanels";
import {
  useDomainNetworkAnalytics,
  useDomainRouterAnalytics,
  useResolvedOrganizationId,
} from "@/hooks/useAnalytics";

export const Route = createFileRoute("/_authenticated/analytics/isp")({
  component: Page,
});

function Page() {
  const org = useResolvedOrganizationId();
  const network = useDomainNetworkAnalytics(org.data ?? undefined);
  const routers = useDomainRouterAnalytics(org.data ?? undefined);

  return (
    <PageShell>
      <SectionHeader
        title="ISP & uplink analytics"
        description="Internet reachability and traffic per router. Link-quality metrics (jitter, loss, SLA) aren't measured on this fleet."
      />
      {org.isError ? (
        <EmptyState
          icon={Cable}
          title="No organization in context"
          description="This screen needs an organization to scope uplink analytics to."
        />
      ) : (
        <IspInsightsPanel
          network={network.data}
          routers={routers.data}
          isLoading={org.isLoading || network.isLoading || routers.isLoading}
          isError={network.isError || routers.isError}
          onRetry={() => {
            network.refetch();
            routers.refetch();
          }}
        />
      )}
    </PageShell>
  );
}
