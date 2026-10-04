/**
 * Customer Instant On reads for one Aruba Instant On venue (DASHBOARD_PLAN
 * P1-K). Organization-scoped, location-keyed; any failure is `unavailable`.
 * Separate from `aruba-instant-on.service.ts`, the Master console's
 * GLOBAL-scoped surface, which the customer app must not import.
 */
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import type { InstantOnKind } from "@/lib/instant-on-views";

export const instantOnCustomerService = {
  async read(locationId: string, kind: InstantOnKind): Promise<unknown> {
    try {
      const orgId = await resolveOrgId();
      const { data } = await api.get<unknown>(
        `/network-integrations/locations/${locationId}/instant-on/${kind}`,
        { headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId } },
      );
      return data;
    } catch {
      return null;
    }
  },
};
