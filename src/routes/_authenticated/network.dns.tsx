import { createFileRoute } from "@tanstack/react-router";
import { Server } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/dns")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="DNS"
        description="Recursive resolvers, split-horizon zones and DNS filtering profiles."
        icon={Server}
        bullets={["Recursive resolvers","Split-horizon zones","DNS filtering"]}
      />
    </PageShell>
  );
}
