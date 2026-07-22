import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { GuestTeamManagement } from "@/components/guests/GuestTeamManagement";

export const Route = createFileRoute("/_authenticated/guests/teams")({
  component: () => (
    <PageShell>
      <GuestTeamManagement />
    </PageShell>
  ),
});
