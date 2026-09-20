import { useQuery } from "@tanstack/react-query";
import { liveSessionService } from "@/services/live-session.service";
import type { LiveSessionQuery } from "@/types/live-session";

/**
 * Active guest sessions from `GET /sessions/live`. Short `staleTime` and a
 * 15s poll so the "who is online right now" screen stays live without a
 * manual refresh, matching the customer dashboard's own online-now cadence.
 */
export function useLiveSessions(query: LiveSessionQuery) {
  return useQuery({
    queryKey: ["live-sessions", query],
    queryFn: () => liveSessionService.list(query),
    staleTime: 10_000,
    refetchInterval: 15_000,
    // "Who is online right now" is the whole point of this screen, and
    // `refetchIntervalInBackground` is false, so the poll pauses while the
    // tab is away. Focus is the cheapest possible catch-up tick. Explicit
    // because the app-wide default is now `false` (`router.tsx`, #341).
    refetchOnWindowFocus: true,
  });
}
