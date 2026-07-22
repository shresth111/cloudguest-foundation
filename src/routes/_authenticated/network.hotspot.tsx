import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { HotspotManagement } from "@/components/network/HotspotManagement";

export const Route = createFileRoute("/_authenticated/network/hotspot")({
  component: () => (
    <PageShell>
      <HotspotManagement />
    </PageShell>
  ),
});
