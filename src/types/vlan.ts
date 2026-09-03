export type VlanPortMode = "trunk" | "access";

/** Whether a VLAN row has ever reached a real router.
 *
 * Deliberately separate from `isEnabled` (intent) and from the config
 * version pipeline. Until the domain gained a device push, every VLAN was
 * permanently `pending` -- a row and nothing more.
 *
 * `provisioning` is the in-flight state: the push has been accepted but the
 * router has not answered yet, so the row is neither pending nor applied.
 * It settles to `active` or `failed` on its own, which is why the list
 * polls while any row is sitting in it.
 */
export type VlanDevicePushStatus = "pending" | "provisioning" | "active" | "failed";

/** One interface read live off the router, for the VLAN form's pickers.
 *
 * Deliberately not router.ts's `DeviceInterface`: that one is the DHCP
 * picker's list, already narrowed by the backend to interfaces nothing
 * else has claimed. This is the router's whole interface table, unfiltered,
 * because a VLAN parent is allowed to be an interface that already carries
 * addresses and servers. `isBridgePort` is the extra field, and it is the
 * one the Access-port list is filtered on -- see `interfacesForMode`.
 */
export interface VlanDeviceInterface {
  name: string;
  type: string | null;
  running: boolean;
  disabled: boolean;
  /** The bridge this interface is a member of, if any. */
  bridge: string | null;
  isBridgePort: boolean;
  hasIpAddress: boolean;
}

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
  /** Whether traffic from this VLAN is masqueraded out to the internet. */
  natEnabled: boolean;
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
  natEnabled?: boolean;
  description?: string | null;
  isEnabled?: boolean;
  /** Consent to hand the chosen physical port over to this zone, taking it
   * out of the bridge it is in today. The backend REFUSES an access-mode
   * push onto a bridge member without it (409), because doing that to the
   * port an access point sits on takes the Wi-Fi down. */
  confirmTakesPort?: boolean;
}

export interface UpdateVlanPayload {
  vlanId?: number;
  name?: string;
  gatewayIpAddress?: string | null;
  cidr?: string | null;
  interface?: string | null;
  portMode?: VlanPortMode;
  /** See CreateVlanPayload. Changing the interface or port mode clears the
   * stored consent server-side, so an edit that moves the zone to a
   * different port has to be acknowledged again. */
  confirmTakesPort?: boolean;
  enableHotspot?: boolean;
  natEnabled?: boolean;
  description?: string | null;
  isEnabled?: boolean;
}

export interface VlanKpis {
  total: number;
  enabled: number;
  disabled: number;
}
