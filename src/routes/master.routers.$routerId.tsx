import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RouterDetailPage } from "@/components/routers/RouterDetailPage";

const searchSchema = z.object({ tab: z.string().optional() });

/**
 * The full router screen, in the Master Console.
 *
 * Router Fleet's drawer has a "Manage this router" button for everything the
 * drawer does not carry -- WireGuard tunnel, config rollback/backup,
 * diagnostics, connected devices, the audit log. It linked to
 * `/routers/$routerId`, which lives under `_authenticated.tsx`; on
 * master.wyfyguest.com that layout sends every non-`/master` path to
 * `/master`, so the button landed on the Master home and the screen was
 * unreachable from the console that needs it.
 *
 * The fix is an address inside the Master tree, not an exception in the
 * hostname guard: this route is a child of `/master`, so `master.tsx`'s
 * `beforeLoad` runs first -- global-scope operators only, on the master host
 * only -- and the "consoles never mix" guarantee is untouched. The page is
 * the same component the old address renders.
 *
 * A child of `master.routers.tsx`, whose `RouterFleetRoute` renders the
 * `<Outlet/>` when a child matches, so this replaces the fleet list rather
 * than rendering under it. The static `setup` / `guided` siblings still win
 * over `$routerId` for their own paths.
 */
export const Route = createFileRoute("/master/routers/$routerId")({
  ssr: false,
  validateSearch: searchSchema,
  component: MasterRouterDetailRoute,
});

function MasterRouterDetailRoute() {
  const { routerId } = Route.useParams();
  const { tab } = Route.useSearch();
  return <RouterDetailPage routerId={routerId} tab={tab} backTo="/master/routers" />;
}
