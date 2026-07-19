import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/guests/voucher")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Vouchers"
        description="Prepaid access vouchers with time, data and speed caps and bulk printing."
        icon={Ticket}
        bullets={["Time / data / speed caps","Bulk printing","Redemption analytics"]}
      />
    </PageShell>
  );
}
