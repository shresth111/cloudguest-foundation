import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { VoucherManagement } from "@/components/vouchers/VoucherManagement";

export const Route = createFileRoute("/_authenticated/vouchers/")({
  component: () => (
    <PageShell>
      <VoucherManagement />
    </PageShell>
  ),
});
