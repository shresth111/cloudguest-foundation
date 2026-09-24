import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RouterDetailPage } from "@/components/routers/RouterDetailPage";

const searchSchema = z.object({ tab: z.string().optional() });

/** The older Platform Console's router screen. The page itself lives in
 * `@/components/routers/RouterDetailPage` so the Master Console can mount
 * the same screen at `/master/routers/$routerId`. */
export const Route = createFileRoute("/_authenticated/routers/$routerId")({
  validateSearch: searchSchema,
  component: LegacyRouterDetailRoute,
});

function LegacyRouterDetailRoute() {
  const { routerId } = Route.useParams();
  const { tab } = Route.useSearch();
  return <RouterDetailPage routerId={routerId} tab={tab} backTo="/routers" />;
}
