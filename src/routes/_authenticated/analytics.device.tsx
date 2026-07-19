import { createFileRoute } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/analytics/device")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Device Analytics"
        description="Device mix, OS versions and vendor breakdown for capacity planning."
        icon={Smartphone}
        bullets={["OS & vendor mix","5 GHz adoption","BYOD trend"]}
      />
    </PageShell>
  );
}
