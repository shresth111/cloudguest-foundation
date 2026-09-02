import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retired entry point, kept only as a redirect.
 *
 * The server-driven provisioning wizard is no longer offered from Router
 * Fleet -- see the sibling `master.routers.guided.$routerId.tsx` for the
 * full reasoning behind keeping these URLs alive rather than deleting
 * them.
 *
 * Worth recording why THIS one in particular stopped being a recommended
 * path: the wizard renders its script server-side and every step past
 * bootstrap pushes through the device gateway, so it cannot get a
 * factory-fresh box onto the network -- there is no agent and no tunnel
 * yet for it to talk through. A live provisioning session stranded an
 * operator at step 2 of 13 on a fresh router. Advanced generates the
 * script client-side, so frontend fixes actually reach it.
 *
 * Note this is the PATH `/master/routers/setup/$routerId` (the wizard),
 * which is a different thing from the `?setup=<id>` SEARCH param on
 * `/master/routers` -- that one is a legacy alias for `?advanced=<id>`
 * and still resolves to the Advanced panel directly. Both now land in
 * the same place, which is the point.
 *
 * `RouterFleetSetupWizard` (`@/components/routers/fleet-wizard/`) is
 * deliberately left in the tree; this change is about entry points.
 */
export const Route = createFileRoute("/master/routers/setup/$routerId")({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/master/routers",
      search: { advanced: params.routerId },
      replace: true,
    });
  },
});
