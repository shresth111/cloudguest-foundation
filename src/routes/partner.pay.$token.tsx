import { createFileRoute } from "@tanstack/react-router";
import { PayPage } from "@/components/isp-partner/finance/PayPage";

/** `/partner/pay/<token>` (JAZE-4): the public pay-link page an end customer
 * opens from a WhatsApp reminder. No session; see `isPartnerPublicPath`. */
export const Route = createFileRoute("/partner/pay/$token")({
  ssr: false,
  component: PayRoute,
});

function PayRoute() {
  const { token } = Route.useParams();
  return <PayPage token={token} />;
}
