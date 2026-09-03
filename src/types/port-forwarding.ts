/** Whether a rule's real `/ip firewall nat` DSTNAT entry exists on the
 * router right now.
 *
 * Deliberately separate from `isEnabled`, which is only intent ("this rule
 * should forward"): until this domain gained a device push, every rule ever
 * created sat permanently `pending` -- a row and nothing more, on a screen
 * that said "Enabled". Mirrors the backend's
 * `PortForwardingDevicePushStatus`. */
export type PortForwardingDevicePushStatus = "pending" | "active" | "failed";

export interface PortForwardingRule {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  protocol: string; // "tcp" | "udp" | "both"
  sourceAddress: string | null;
  destinationAddress: string | null;
  destinationPort: number;
  internalAddress: string;
  internalPort: number;
  description: string | null;
  isEnabled: boolean;
  devicePushStatus: PortForwardingDevicePushStatus;
  /** Raw device error from the last failed push, shown verbatim. */
  devicePushError: string | null;
  devicePushedAt: string | null;
  createdAt: string;
}

export interface PortForwardingListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
  organizationId?: string;
}

export interface PortForwardingListResult {
  rows: PortForwardingRule[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreatePortForwardingPayload {
  routerId: string;
  name: string;
  protocol?: string;
  sourceAddress?: string | null;
  destinationAddress?: string | null;
  destinationPort: number;
  internalAddress: string;
  internalPort: number;
  description?: string | null;
  isEnabled?: boolean;
  organizationId?: string;
}

export interface UpdatePortForwardingPayload {
  name?: string;
  protocol?: string;
  sourceAddress?: string | null;
  destinationAddress?: string | null;
  destinationPort?: number;
  internalAddress?: string;
  internalPort?: number;
  description?: string | null;
  isEnabled?: boolean;
}

export interface PortForwardingKpis {
  total: number;
  enabled: number;
  disabled: number;
}
