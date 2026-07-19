import { createFileRoute } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/guests/smart-id")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Smart ID"
        description="Reusable guest identity vault with cross-visit personalization and preferences."
        icon={QrCode}
        bullets={["Reusable IDs","Preference sync","Consent ledger"]}
      />
    </PageShell>
  );
}
