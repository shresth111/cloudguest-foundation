import { useMemo } from "react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

/**
 * The `search` object for a `<Link>`/`navigate()` that stays inside
 * `/portal`.
 *
 * ## Why a hook and not the literal
 *
 * This used to be six independent copies of
 *
 *     const portalSearch = { organizationId, locationId, routerId };
 *
 * in `PortalShell`, `useGuestSignIn`, `portal.terms`, `portal.session`,
 * `portal.success` and `portal.auth.$method`. Whole-object `search`, so the
 * router built each destination URL from those three keys and dropped the
 * NAS's `mac`/`ip`/`dst`/`link-login-only` -- which cost a real guest on a
 * real iPhone two sign-ins in production on 7 Sep 2026. The full write-up,
 * and the router middleware that now makes the truncation impossible
 * regardless of what any caller passes, are in `src/lib/portal-search.ts`.
 *
 * The middleware is the guarantee; this hook is what stops the pattern that
 * needed one from being re-typed a seventh time.
 * `scripts/test-portal-search-retention.mjs` fails if it is.
 *
 * ## Why these three keys are still worth passing at all
 *
 * `search={(prev) => prev}` would now be equivalent for a URL that already
 * carries them -- but not for one that does not. `PortalRuntimeLayout` falls
 * back to `loadPersistedRuntimeIds()` when the URL is missing an ID (a
 * reload, an OS captive-portal re-probe, a back-forward navigation onto a
 * bare URL), so the runtime context can hold real IDs the current URL does
 * not. Sourcing them from the context rather than from `prev` puts them back
 * on the URL instead of propagating the gap.
 *
 * ## And why `netProvider` is the fourth
 *
 * Same argument, sharper consequence. It says which vendor's gate stands
 * between this guest and the internet, and `/portal/success` branches on
 * it: `"omada"` means call the controller's authorize endpoint, anything
 * else means the RouterOS `link-login-only` form POST. Lose it on one
 * `<Link>` and a guest at an Omada venue completes sign-in, is told they
 * are connected, and is not -- because the success page fired the wrong
 * vendor's step, or none at all.
 *
 * `retainSearchParams` already carries it for a URL that has it; the
 * context is what restores it for a URL that does not, out of the same
 * mirror that restores the three IDs (`loadPersistedOmadaContext` in
 * PortalRuntimeContext).
 *
 * The controller's own nine redirect parameters are deliberately NOT here.
 * They reach the authorize call from the runtime context
 * (`omadaRedirect`), never off a link's search object, so putting them on
 * every `<Link>` would widen every portal URL by nine keys to no end --
 * and would re-introduce, nine keys wider, the hand-built-search-object
 * pattern this hook exists to prevent.
 */
export function usePortalLinkSearch() {
  const { organizationId, locationId, routerId, netProvider } = usePortalRuntime();
  return useMemo(
    () => ({ organizationId, locationId, routerId, netProvider }),
    [organizationId, locationId, routerId, netProvider],
  );
}
