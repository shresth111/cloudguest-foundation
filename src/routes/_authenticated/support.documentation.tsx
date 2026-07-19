import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/support/documentation")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Documentation"
        description="Product docs, API references, runbooks and release notes."
        icon={BookOpen}
        bullets={["Product docs","API reference","Runbooks"]}
      />
    </PageShell>
  );
}
