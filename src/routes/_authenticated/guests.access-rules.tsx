import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { GuestAccessManagement } from "@/components/guests/GuestAccessManagement";

export const Route = createFileRoute("/_authenticated/guests/access-rules")({
  component: () => (
    <PageShell>
      <GuestAccessManagement />
    </PageShell>
  ),
});
