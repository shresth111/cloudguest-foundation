import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoring.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";

/** "org" -- the signed-in customer session's own organization only.
 *  "platform" -- every organization, Super Admin / master console only.
 * These are two different real data sources (see AlertResponse.organization_id
 * in backend/app/domains/monitoring/schemas.py) -- never conflate them. */
export type AlertsFeedScope = "org" | "platform";

export const alertsFeedKeys = {
  feed: (scope: AlertsFeedScope) => ["alerts-feed", scope] as const,
};

/** Real recent-alerts feed for the header notification bell, backed by the
 * same GET /alerts endpoint the (real, backend-wired) customer Alerts page
 * (OperationsFeatures.tsx's AlertsView) already uses. Demo sessions get an
 * empty feed -- there is no fabricated notification data, same discipline
 * as every other real-data seam in this app. */
export function useAlertsFeed(scope: AlertsFeedScope) {
  return useQuery({
    queryKey: alertsFeedKeys.feed(scope),
    queryFn: async () => {
      if (scope === "org" && isDemo()) return [];
      const organizationId = scope === "org" ? await resolveOrgId() : undefined;
      const { items } = await monitoringService.listAlerts({
        organizationId,
        page: 1,
        pageSize: 20,
      });
      // Most recent first regardless of what the backend's default sort is.
      return [...items].sort(
        (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
      );
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

/** Marks a single alert read via the real POST /alerts/{id}/acknowledge
 * endpoint -- there is no separate in-app "read" flag on Alert, so
 * acknowledged is the genuine backend state for "a human has seen this". */
export function useAcknowledgeAlert(scope: AlertsFeedScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => monitoringService.acknowledgeAlert(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: alertsFeedKeys.feed(scope) }),
  });
}
