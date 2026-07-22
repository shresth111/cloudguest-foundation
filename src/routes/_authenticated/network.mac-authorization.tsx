import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { MacAuthorizationManagement } from "@/components/network/MacAuthorizationManagement";

export const Route = createFileRoute("/_authenticated/network/mac-authorization")({
  component: () => (
    <PageShell>
      <MacAuthorizationManagement />
    </PageShell>
  ),
});
