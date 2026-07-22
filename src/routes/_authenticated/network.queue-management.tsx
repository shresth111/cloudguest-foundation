import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { QueueManagement } from "@/components/network/QueueManagement";

export const Route = createFileRoute("/_authenticated/network/queue-management")({
  component: () => (
    <PageShell>
      <QueueManagement />
    </PageShell>
  ),
});
