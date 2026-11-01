import { createFileRoute } from "@tanstack/react-router";
import { RouterDetailPage } from "@/components/isp-partner/routers/RouterDetailPage";

export const Route = createFileRoute("/partner/routers/$ispRouterId")({
  ssr: false,
  component: RouterDetailRoute,
});

function RouterDetailRoute() {
  const { ispRouterId } = Route.useParams();
  return <RouterDetailPage key={ispRouterId} routerId={ispRouterId} />;
}
