import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
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
  });

  return router;
};
