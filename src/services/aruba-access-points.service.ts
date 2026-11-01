/**
 * Customer read of an Aruba Instant On venue's access points
 * (DASHBOARD_PLAN P0-A2/P0-A3). Organization-scoped: the backend checks the
 * caller's organization AND that the location belongs to it, so the headers
 * name both, the same way `controllerDevicesService` does.
 *
 * Separate from `aruba-instant-on.service.ts` on purpose: that file is the
 * Master console's GLOBAL-scoped surface and the customer dashboard must not
 * import it.
 *
 * Any failure (403 for a role without `locations.read`, a network error)
 * and a `200 {applicable: false}` (a location the list does not apply to) are
 * "unavailable" -- never an empty list.
 */
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import { toArubaAccessPointsState, type ArubaAccessPointsState } from "@/lib/aruba-access-points";

export const arubaAccessPointsService = {
  async list(locationId: string): Promise<ArubaAccessPointsState> {
    try {
      const orgId = await resolveOrgId();
      const { data } = await api.get<unknown>(`/locations/${locationId}/access-points`, {
        // "Today" is the viewer's day: the backend counts sessions_today and
        // the byte totals from local midnight at this offset (IST = 330).
        params: { tz_offset_minutes: -new Date().getTimezoneOffset() },
        headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId },
      });
      return toArubaAccessPointsState(data);
    } catch {
      return { status: "unavailable" };
    }
  },
};
