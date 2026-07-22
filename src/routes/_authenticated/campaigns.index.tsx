import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { CampaignManagement } from "@/components/campaigns/CampaignManagement";

export const Route = createFileRoute("/_authenticated/campaigns/")({
  component: () => (
    <PageShell>
      <CampaignManagement />
    </PageShell>
  ),
});
