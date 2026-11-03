/**
 * Customer Instant On reads for one Aruba Instant On venue. Organization-scoped,
 * location-keyed. A real failure reads as unavailable; a route that isn't there
 * or isn't allowed for this user reads as off, which isn't a fault. Separate from
 * `aruba-instant-on.service.ts`, the Master console's GLOBAL-scoped surface.
 */
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import { instantOnReadFailure, type InstantOnKind } from "@/lib/instant-on-views";

export const instantOnCustomerService = {
  async read(locationId: string, kind: InstantOnKind): Promise<unknown> {
    try {
      const orgId = await resolveOrgId();
      const { data } = await api.get<unknown>(
        `/network-integrations/locations/${locationId}/instant-on/${kind}`,
        { headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId } },
      );
      return data;
    } catch (err) {
      return instantOnReadFailure((err as { status?: number | null } | null)?.status);
    }
  },
};
