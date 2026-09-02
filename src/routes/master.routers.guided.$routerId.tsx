import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retired entry point, kept only as a redirect.
 *
 * Router Fleet used to offer three ways to provision one router --
 * Guided, Wizard and Advanced. It now offers one, Advanced, and this
 * route's button is gone from both the fleet table and the router
 * drawer.
 *
 * The file stays behind because this URL was linkable and is very likely
 * bookmarked: operators open it standing at a rack mid-provision, and a
 * dead link at that moment is worse than an unexpected-but-working one.
 * Same reasoning the repo already applied to `/background-image` when
 * that surface was folded into Portal -> Design.
 *
 * `/master`'s own `beforeLoad` guard runs first (this is a descendant of
 * that layout route), so an expired bookmark still lands on
 * `/master-login`, not on the operator console.
 *
 * `$routerId` is carried across as the `advanced` search param rather
 * than dropped, so the redirect lands on the SAME router the operator
 * asked for. A stale id is handled there -- `master.routers.tsx` renders
 * "Couldn't find that router" with a way back to the fleet, rather than
 * a 404 or an empty page.
 *
 * `GuidedSetup` itself (`@/components/routers/guided-setup/`) is
 * deliberately NOT deleted: it is large, it has its own gated suites
 * (`test:guided-i18n`, `test:guided-i18n-state`,
 * `test:guided-i18n-switch`, `test:output-analyser`) that import it
 * directly rather than through this route, and removing the component
 * tree is a separate change from removing the entry point.
 */
export const Route = createFileRoute("/master/routers/guided/$routerId")({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/master/routers",
      search: { advanced: params.routerId },
      replace: true,
    });
  },
});
