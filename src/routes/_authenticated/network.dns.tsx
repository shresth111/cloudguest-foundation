import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { DnsManagement } from "@/components/network/DnsManagement";

export const Route = createFileRoute("/_authenticated/network/dns")({
  component: () => (
    <PageShell>
      <DnsManagement />
    </PageShell>
  ),
});
