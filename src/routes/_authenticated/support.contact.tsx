import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/support/contact")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Contact Support"
        description="Open a ticket, chat with support or check platform status."
        icon={MessageSquare}
        bullets={["Priority tickets","Live chat","Status page"]}
      />
    </PageShell>
  );
}
