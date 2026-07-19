import { createFileRoute } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/guests/blocklist")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Blocklist"
        description="Block MACs, IPs or CIDRs and audit block reason across the tenant."
        icon={Ban}
        bullets={["MAC / IP / CIDR","Reason ledger","Auto-expire"]}
      />
    </PageShell>
  );
}
