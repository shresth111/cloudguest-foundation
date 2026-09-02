export type VlanPortMode = "trunk" | "access";

/** Whether a VLAN row has ever reached a real router.
 *
 * Deliberately separate from `isEnabled` (intent) and from the config
 * version pipeline. Until the domain gained a device push, every VLAN was
 * permanently `pending` -- a row and nothing more.
 */
export type VlanDevicePushStatus = "pending" | "active" | "failed";

export interface Vlan {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  vlanId: number; // 802.1Q tag, 1-4094
  name: string;
  gatewayIpAddress: string | null;
  cidr: string | null;
  interface: string | null;
  portMode: VlanPortMode;
  enableHotspot: boolean;
  description: string | null;
  isEnabled: boolean;
  devicePushStatus: VlanDevicePushStatus;
  /** Raw device error from the last failed push, shown verbatim. */
  devicePushError: string | null;
  devicePushedAt: string | null;
  createdAt: string;
}

export interface VlanListQuery {
  routerId?: string;
  locationId?: string;
  page: number;
  pageSize: number;
}

export interface VlanListResult {
  rows: Vlan[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateVlanPayload {
  routerId: string;
  vlanId: number;
  name: string;
  gatewayIpAddress?: string | null;
  cidr?: string | null;
  interface?: string | null;
  portMode?: VlanPortMode;
  enableHotspot?: boolean;
  description?: string | null;
  isEnabled?: boolean;
}

export interface UpdateVlanPayload {
  vlanId?: number;
  name?: string;
  gatewayIpAddress?: string | null;
  cidr?: string | null;
  interface?: string | null;
  portMode?: VlanPortMode;
  enableHotspot?: boolean;
  description?: string | null;
  isEnabled?: boolean;
}

export interface VlanKpis {
  total: number;
  enabled: number;
  disabled: number;
}
