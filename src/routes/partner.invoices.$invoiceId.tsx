import { createFileRoute } from "@tanstack/react-router";
import { InvoiceDetailPage } from "@/components/isp-partner/invoices/InvoiceDetailPage";

export const Route = createFileRoute("/partner/invoices/$invoiceId")({
  ssr: false,
  component: InvoiceDetailRoute,
});

function InvoiceDetailRoute() {
  const { invoiceId } = Route.useParams();
  return <InvoiceDetailPage key={invoiceId} invoiceId={invoiceId} />;
}
