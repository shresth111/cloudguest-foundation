/**
 * GAP-SWEEP: hide a flag-gated nav item while its feature is switched off.
 *
 * Apps and Revenue already hide their nav item through their own probes
 * (useAppsEnabled / useRevenueEnabled). Collections, Incidents, Referrals,
 * PPPoE and Fiber plant only said "not switched on" once the page was open,
 * so with every flag off (the prod default) the sidebar listed five dead
 * pages. Each probe is a cheap read the page itself makes.
 *
 * Hidden ONLY on the flag-off answer (lib/isp-partner/nav-flags.ts isFlagOff).
 * Loading, 403, 5xx, a network error or no permission to probe keep the item,
 * so a slow or failing API never hides a page that is switched on.
 */
import { useQueries } from "@tanstack/react-query";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { isFlagOff, NAV_FLAG_PATHS, type NavFlagPath } from "@/lib/isp-partner/nav-flags";
import { collectionsService } from "@/services/isp-partner/collections";
import { fiberService } from "@/services/isp-partner/fiber";
import { incidentsService } from "@/services/isp-partner/incidents";
import { pppoeService } from "@/services/isp-partner/pppoe";
import { referralsService } from "@/services/isp-partner/referrals";

const PROBES: Record<NavFlagPath, () => Promise<unknown>> = {
  "/partner/collections": () => collectionsService.promises({ page: 1, page_size: 1 }),
  "/partner/incidents": () => incidentsService.health(),
  "/partner/referrals": () => referralsService.settings(),
  "/partner/pppoe": () => pppoeService.status(),
  "/partner/fiber": () => fiberService.nodes({ page: 1, page_size: 1 }),
};

const PATHS = Object.keys(NAV_FLAG_PATHS) as NavFlagPath[];

/** Nav paths whose feature flag is off (their probe gave the flag-off answer). */
export function useFlagOffNav(): Set<string> {
  const { can } = usePartner();
  const results = useQueries({
    queries: PATHS.map((to) => ({
      queryKey: ["isp", "nav-flag-probe", to],
      queryFn: PROBES[to],
      enabled: can(NAV_FLAG_PATHS[to]),
      retry: false,
      staleTime: 10 * 60_000,
    })),
  });
  const off = new Set<string>();
  PATHS.forEach((to, i) => {
    const r = results[i];
    if (can(NAV_FLAG_PATHS[to]) && r.isError && isFlagOff(r.error)) off.add(to);
  });
  return off;
}
