import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AppLoadingIndicator } from "@/components/AppLoadingIndicator";
import { ErrorComponent } from "@/routes/__root";
import type { RouterAuthContext } from "@/context/AuthContext";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, auth: undefined as RouterAuthContext | undefined },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // TanStack Router's default is 500ms, and it is an ANTI-FLICKER guarantee:
    // "once a pending component has been shown, keep it on screen for at least
    // this long", so a loader that resolves in 30ms doesn't strobe a spinner.
    // That trade only pays off if there IS a pending component. Grepped: not
    // one route in this app defines `pendingComponent`, so the thing being
    // held on screen for a guaranteed minimum of half a second is `null`.
    //
    // On any `ssr: false` route -- which is every authenticated surface,
    // including /master -- the match starts out pending on the client, so this
    // fires on every cold load. Combined with __root.tsx removing
    // `#initial-loader` the moment RootComponent mounts (root mount != the
    // matched route having rendered), the sequence a cold load actually
    // produced was: boot spinner -> spinner removed -> guaranteed >= 500ms of
    // blank white -> page. Measured in real Chromium against a real
    // `.output/` build (30Mbps/40ms link): the master dashboard's shell
    // appeared at 1111ms with 423ms of that a white void; with this at 0 the
    // shell appears at ~600ms and the void is gone -- the spinner now hands
    // straight over to content in the same frame.
    //
    // Setting this to 0 does NOT reintroduce spinner flicker: `pendingMs`
    // (1000ms, left at its default) still governs when a pending component may
    // be shown at all, so a client-side navigation keeps rendering the
    // previous page for up to a second rather than flashing anything.
    defaultPendingMinMs: 0,
    // The other half of the same problem, and the half that survived the fix
    // above. `defaultPendingMinMs: 0` removed the GUARANTEED >=500ms of blank,
    // but not the blank itself: with no pending component defined anywhere,
    // what a pending match renders is still `null`, for however long the match
    // actually takes. When auth is slow -- and it is, because the access token
    // is 15min and refresh is reactive-only, so a cold load fires its queries
    // with a stale token, takes a wall of 401s, refreshes, and retries -- that
    // window is long enough to see. Hence the reports of a blank master
    // console that "loads after a while".
    //
    // Note this alone would NOT fix a cold load, because `pendingMs` (1000ms)
    // means this component cannot appear for the first second -- exactly the
    // window a cold load lives in. The cold-load half is fixed in
    // `__root.tsx`, by not removing `#initial-loader` until the matched route
    // has actually rendered. The two changes cover different windows and both
    // are required; neither is redundant with the other.
    defaultPendingComponent: () => <AppLoadingIndicator />,
    // Without this, a route that throws before its match resolves spins
    // forever. `__root.tsx` sets `errorComponent`, but that only covers
    // errors thrown *inside* a resolved match -- a `validateSearch` failure
    // happens earlier, in `matchRoutes`, so the match never resolves, the
    // pending component stays up, and the page is a spinner with no end
    // state and no message.
    //
    // Found on 2026-09-04: opening /preview/portal/<id> without its
    // required `?organizationId=` search param produced an infinite
    // spinner. The console carried a precise zod error the whole time
    // ("organizationId: Required"), so the app knew exactly what was wrong
    // and showed the user nothing. A truncated link in a chat message, or
    // a bookmark from before a param was added, is enough to reach this.
    //
    // A spinner is a promise that something is coming. Making the same
    // component the root already uses keeps that promise honest across
    // every route rather than only the ones that manage to match.
    defaultErrorComponent: ErrorComponent,
  });

  return router;
};
