import { createFileRoute } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { ComingSoonPanel } from "@/components/ui-ext/ComingSoonPanel";

export const Route = createFileRoute("/_authenticated/vouchers/")({
  component: VoucherMasterPage,
});

function VoucherMasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Voucher Master</h1>
        <p className="text-sm text-muted-foreground">
          Central voucher inventory. Every batch is scoped to a Location and a NAS — pick a location to
          generate, print or revoke codes.
        </p>
      </div>
      <ComingSoonPanel
        icon={Ticket}
        title="Voucher inventory rolling out"
        description="The Location → NAS voucher issuance flow is being wired to the platform. Existing per-location voucher screens continue to work from the Location Master."
        bullets={[
          "Bulk generation with prefix, length and expiry rules",
          "Print-ready PDF exports scoped to a NAS",
          "Real-time redemption analytics with fraud signals",
        ]}
      />
    </div>
  );
}
