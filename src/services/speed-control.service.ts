/**
 * Customer read: does this Aruba Instant On location have a Wyfy MikroTik
 * gateway applying each guest's speed? See `lib/aruba-speed-gateway.ts`.
 *
 * Read-only and org-scoped (`locations.read`). A 404 (an older backend, or a
 * location that is not the caller's -- the backend makes the two look the
 * same) is "no", never an error: the screen then keeps its existing answer.
 */
import { api } from "./api";
import { resolveOrganizationId } from "./organization-id";
import { toSpeedControl, type SpeedControlRead } from "@/lib/aruba-speed-gateway";

const NOTHING: SpeedControlRead = { perGuestSpeed: false, instantOnCloudControl: false };

export const speedControlService = {
  /** Per-guest speed (hybrid gateway) and Instant On cloud control, in one
   * read. A 404 is "neither", never an error. */
  async readSpeedControl(locationId: string): Promise<SpeedControlRead> {
    try {
      const { data } = await api.get<unknown>(
        `/network-integrations/locations/${locationId}/speed-control`,
        {
          headers: {
            "X-Organization-Id": await resolveOrganizationId(),
            "X-Location-Id": locationId,
          },
        },
      );
      return toSpeedControl(data);
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      if (status === 404) return NOTHING;
      throw error;
    }
  },
};
