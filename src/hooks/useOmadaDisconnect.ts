/**
 * Hooks behind the per-guest disconnect on an Omada venue.
 *
 * TWO THINGS, AND NO VENDOR LOOKUP
 * --------------------------------
 * 1. Which controller (if any) covers the venue a session belongs to.
 * 2. The mutation that ends the guest's access on it.
 *
 * Step 1 is also the vendor gate -- see `pickIntegrationForLocation`. A
 * venue with no Omada integration yields `null` and the control never
 * mounts, which is how a MikroTik venue keeps rendering exactly as it did.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { networkIntegrationService } from "@/services/network-integration.service";
import { omadaDisconnectService } from "@/services/omada-disconnect.service";
import { guestKeys } from "./useGuests";
import { pickIntegrationForLocation } from "@/lib/omada-disconnect";
import type { OmadaDisconnectRequest, OmadaDisconnectResult } from "@/lib/omada-disconnect";
import type { NetworkIntegration } from "@/types/network-integration";

/**
 * The same key `NetworkIntegrationsPage` reads under, spelled out rather
 * than imported: that page belongs to an open PR this week, and a shared
 * literal is cheaper than a shared import we would have to un-merge. React
 * Query dedupes on the key itself, so an operator who has both screens open
 * still makes one request.
 */
const INTEGRATION_LIST_KEY = ["network-integrations", "list"] as const;

/**
 * The permission the endpoint itself enforces. Checked before the list is
 * even fetched: an operator who cannot act has no reason to spend a request
 * on finding out, and `GET /network-integrations` would 403 them anyway.
 */
export const DISCONNECT_PERMISSION = "network_integrations.update";

/**
 * The Omada controller covering `locationId`, or `null`.
 *
 * `enabled: false` when the caller lacks the permission, so this adds no
 * request to the Guests page for the operators who would never see the
 * control.
 */
export function useVenueIntegration(locationId: string | null): NetworkIntegration | null {
  const { can } = useAuth();
  const allowed = can(DISCONNECT_PERMISSION);

  const { data } = useQuery({
    queryKey: INTEGRATION_LIST_KEY,
    queryFn: () => networkIntegrationService.list(),
    enabled: allowed,
    // A venue's controller does not change between two row clicks. This is
    // one shared read for the whole table, not one per row.
    staleTime: 5 * 60_000,
  });

  if (!allowed || !data) return null;
  return pickIntegrationForLocation(data.rows, locationId);
}

export function useOmadaDisconnect() {
  const qc = useQueryClient();
  return useMutation<
    OmadaDisconnectResult,
    unknown,
    { integrationId: string } & OmadaDisconnectRequest
  >({
    mutationFn: ({ integrationId, clientMac, reason }) =>
      omadaDisconnectService.disconnectClient(integrationId, { clientMac, reason }),
    onSuccess: (result) => {
      // Only refetch sessions when something about them actually moved. A
      // lapsed grant that ended no session leaves the table correct as it
      // stands, and an invalidate would make the row flicker for no reason.
      if (result.guestSessionEnded) {
        qc.invalidateQueries({ queryKey: guestKeys.root });
      }
      // The controller's own counters (active authorizations) did move.
      qc.invalidateQueries({ queryKey: INTEGRATION_LIST_KEY });
    },
  });
}
