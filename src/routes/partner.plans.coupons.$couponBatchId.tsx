import { createFileRoute } from "@tanstack/react-router";
import { CouponBatchPage } from "@/components/isp-partner/plans/CouponBatchPage";

export const Route = createFileRoute("/partner/plans/coupons/$couponBatchId")({
  ssr: false,
  component: CouponBatchRoute,
});

function CouponBatchRoute() {
  const { couponBatchId } = Route.useParams();
  return <CouponBatchPage key={couponBatchId} batchId={couponBatchId} />;
}
