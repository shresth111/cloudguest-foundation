import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { IspManagement } from "@/components/network/IspManagement";

export const Route = createFileRoute("/_authenticated/network/isp")({
  component: () => (
    <PageShell>
      <IspManagement />
    </PageShell>
  ),
});
