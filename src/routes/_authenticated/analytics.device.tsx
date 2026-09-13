import { createFileRoute } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { EmptyState } from "@/components/common/EmptyState";
import { DeviceInsightsPanel } from "@/components/analytics/customer/CustomerAnalyticsPanels";
import { useDomainGuestAnalytics, useResolvedOrganizationId } from "@/hooks/useAnalytics";

export const Route = createFileRoute("/_authenticated/analytics/device")({
  component: Page,
});

function Page() {
  const org = useResolvedOrganizationId();
  // Device mix comes from the guest endpoint's device breakdown
  // (by OS / browser / device type), classified from session user-agents.
  const query = useDomainGuestAnalytics(org.data ?? undefined);

  return (
    <PageShell>
      <SectionHeader
        title="Device analytics"
        description="Operating system, browser and device-type mix across guest sessions."
      />
      {org.isError ? (
        <EmptyState
          icon={Smartphone}
          title="No organization in context"
          description="This screen needs an organization to scope device analytics to."
        />
      ) : (
        <DeviceInsightsPanel
          data={query.data}
          isLoading={org.isLoading || query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
        />
      )}
    </PageShell>
  );
}
