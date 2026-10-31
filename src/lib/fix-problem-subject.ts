/**
 * Which router Fix a Problem is ABOUT, when a venue has more than one.
 *
 * It used to be the first agent-managed router, full stop. At a venue with
 * two routers where the second has gone quiet (Bangalore DC in the demo, and
 * any real multi-router venue), that picked the healthy one, and the page
 * told the owner "Your internet is working" while the dashboard said a
 * router was silent. An owner opens this page because something is wrong,
 * so a router that has stopped checking in is the one to talk about.
 *
 * Order: an agent-managed router that has gone silent, then any
 * agent-managed router, then whatever the venue has. Pure, so the
 * cross-screen demo test can exercise it.
 */
import { HEARTBEAT_SILENT_AFTER_MINUTES, minutesSince } from "@/lib/location-liveness";
import { isAgentManaged } from "@/lib/router-vendors";

export interface SubjectRouterRow {
  vendor: string | null | undefined;
  lastSeenAt: string | null;
}

export function pickSubjectRouter<T extends SubjectRouterRow>(
  routers: readonly T[],
  now: Date = new Date(),
): T | null {
  const agent = routers.filter((r) => isAgentManaged(r.vendor));
  const silent = agent.find((r) => {
    const mins = minutesSince(r.lastSeenAt, now);
    return mins !== null && mins >= HEARTBEAT_SILENT_AFTER_MINUTES;
  });
  return silent ?? agent[0] ?? routers[0] ?? null;
}
