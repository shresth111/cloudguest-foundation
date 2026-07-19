import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/firewall")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Firewall"
        description="Filter, NAT and mangle rules with staging, dry-run and per-rule hit counters."
        icon={Shield}
        bullets={["Filter / NAT / mangle","Staging & dry-run","Per-rule counters"]}
      />
    </PageShell>
  );
}
