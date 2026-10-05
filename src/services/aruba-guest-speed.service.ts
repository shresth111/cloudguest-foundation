/**
 * Customer read/write of the guest WiFi network's speed at an Aruba Instant On
 * venue (one cap for every device on the network). See `lib/aruba-guest-speed.ts`.
 *
 * Keyed on the location and nothing else; the backend resolves the Instant On
 * site from the caller's own organization and that location. A 404 (an older
 * backend) reads as "cloud control not enabled": the screen then offers no
 * write.
 */
import { api } from "./api";
import { resolveOrganizationId } from "./organization-id";
import { toVenueGuestSpeed, type VenueGuestSpeed } from "@/lib/aruba-guest-speed";

const path = (locationId: string) =>
  `/network-integrations/locations/${locationId}/instant-on/guest-speed`;

async function headers(locationId: string) {
  return {
    "X-Organization-Id": await resolveOrganizationId(),
    "X-Location-Id": locationId,
  };
}

export const arubaGuestSpeedService = {
  async read(locationId: string): Promise<VenueGuestSpeed> {
    try {
      const { data } = await api.get<unknown>(path(locationId), {
        headers: await headers(locationId),
      });
      return toVenueGuestSpeed(data);
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      if (status === 404) return toVenueGuestSpeed({ status: "unavailable" });
      throw error;
    }
  },

  async apply(
    locationId: string,
    request: { networkId: string; downloadMbps: number | null; uploadMbps: number | null },
  ): Promise<VenueGuestSpeed> {
    const { data } = await api.put<unknown>(
      path(locationId),
      {
        network_id: request.networkId,
        download_mbps: request.downloadMbps,
        upload_mbps: request.uploadMbps,
      },
      { headers: await headers(locationId) },
    );
    return toVenueGuestSpeed(data);
  },
};
