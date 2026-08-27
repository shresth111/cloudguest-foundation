import { api } from "@/services/api";

export type FleetPeerStatus =
  | "tracked_connected"
  | "tracked_stale"
  | "untracked_connected"
  | "tracked_missing_from_hub";

interface BackendFleetPeerStatus {
  status: FleetPeerStatus;
  public_key: string;
  router_id: string | null;
  router_name: string | null;
  tunnel_ip_address: string | null;
  last_handshake_at: string | null;
}

interface BackendFleetStatus {
  summary: Record<FleetPeerStatus, number>;
  peers: BackendFleetPeerStatus[];
}

export interface FleetPeer {
  status: FleetPeerStatus;
  publicKey: string;
  routerId: string | null;
  routerName: string | null;
  tunnelIpAddress: string | null;
  lastHandshakeAt: string | null;
}

export interface FleetStatus {
  summary: Record<FleetPeerStatus, number>;
  peers: FleetPeer[];
}

export const wireguardService = {
  /** `GET /wireguard/fleet-status` -- the platform's own peer table
   * compared against the hub's live `wg show` state. See that endpoint's
   * own docstring (app/domains/wireguard/router.py) for why this reads
   * the hub directly rather than trusting the database alone. */
  async getFleetStatus(): Promise<FleetStatus> {
    const { data } = await api.get<BackendFleetStatus>("/wireguard/fleet-status");
    return {
      summary: data.summary,
      peers: data.peers.map((p) => ({
        status: p.status,
        publicKey: p.public_key,
        routerId: p.router_id,
        routerName: p.router_name,
        tunnelIpAddress: p.tunnel_ip_address,
        lastHandshakeAt: p.last_handshake_at,
      })),
    };
  },
};
