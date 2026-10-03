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
import { toPerGuestSpeed } from "@/lib/aruba-speed-gateway";

export const speedControlService = {
  async readPerGuestSpeed(locationId: string): Promise<boolean> {
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
      return toPerGuestSpeed(data);
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      if (status === 404) return false;
      throw error;
    }
  },
};
