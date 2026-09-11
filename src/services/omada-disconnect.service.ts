/**
 * The one call that ends a guest's access on an Omada controller.
 *
 * WHY A SEPARATE SERVICE FILE rather than a method on
 * `network-integration.service.ts`: that file is owned by an open PR
 * (#256) this week. This is one endpoint with no shared wire shapes, so a
 * new file costs nothing and avoids a merge conflict on a 800-line module.
 * If both land, folding this in is a two-line move.
 *
 * Backend: cloud-guest #214,
 *   POST /api/v1/network-integrations/{integration_id}/clients/disconnect
 *   permission network_integrations.update
 *
 * The MAC is sent exactly as we hold it. The backend normalizes colon,
 * hyphen and bare-hex forms itself, and reformatting client-side would only
 * add a second place to get it wrong.
 */
import { api } from "./api";
import { resolveOrganizationId } from "./organization-id";
import type { OmadaDisconnectRequest, OmadaDisconnectResult } from "@/lib/omada-disconnect";

const BASE = "/network-integrations";

/** The wire shape, snake_case, exactly as #214's response model writes it. */
interface BackendDisconnectResponse {
  disconnected: boolean;
  provider: string;
  client_mac: string;
  had_active_authorization: boolean;
  deauthorized_at: string | null;
  guest_session_id: string | null;
  guest_session_ended: boolean;
}

/**
 * The envelope is `{ success, message, data, request_id }`. A missing
 * `data` is not defaulted to anything cheerful -- `disconnected` falls back
 * to `false`, which renders as "not confirmed", because the alternative is
 * a green tick over a guest who is still online.
 */
function toResult(payload: unknown, sentMac: string): OmadaDisconnectResult {
  const envelope = payload as { data?: Partial<BackendDisconnectResponse> } | null;
  const body = envelope?.data ?? {};
  return {
    disconnected: body.disconnected === true,
    provider: body.provider ?? "omada",
    // Echoes what the controller matched on when it says so, and what we
    // sent when it does not -- never an empty string, which would render as
    // a disconnect of nothing in particular.
    clientMac: body.client_mac ?? sentMac,
    hadActiveAuthorization: body.had_active_authorization === true,
    deauthorizedAt: body.deauthorized_at ?? null,
    guestSessionId: body.guest_session_id ?? null,
    guestSessionEnded: body.guest_session_ended === true,
  };
}

export const omadaDisconnectService = {
  async disconnectClient(
    integrationId: string,
    payload: OmadaDisconnectRequest,
  ): Promise<OmadaDisconnectResult> {
    const headers = { "X-Organization-Id": await resolveOrganizationId() };
    const body: Record<string, string> = { client_mac: payload.clientMac };
    const reason = payload.reason?.trim();
    if (reason) body.reason = reason;

    const { data } = await api.post<unknown>(
      `${BASE}/${integrationId}/clients/disconnect`,
      body,
      // The controller round-trip is a live HTTP call from the backend to
      // hardware on the venue's LAN; the sibling reads use the same ceiling.
      { headers, timeout: 60_000 },
    );
    return toResult(data, payload.clientMac);
  },
};
