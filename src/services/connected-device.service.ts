import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import type {
  ConnectedDevice,
  ConnectedDeviceListResult,
  DeviceSyncRun,
  DeviceSyncSummary,
} from "@/types/connected-device";

interface BackendConnectedDevice {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  mac_address: string;
  ip_address: string | null;
  hostname: string | null;
  vendor: string | null;
  connection_type: string;
  interface: string | null;
  signal_strength_dbm: number | null;
  is_active: boolean;
  connected_at: string | null;
  last_seen_at: string | null;
  comment: string | null;
  guest_id: string | null;
  created_at: string;
}

interface BackendConnectedDeviceListResponse {
  items: BackendConnectedDevice[];
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendDeviceSyncRun {
  id: string;
  router_id: string;
  status: string;
  component_results: Record<string, unknown>;
  started_at: string;
  completed_at: string;
  created_at: string;
}

function toDevice(d: BackendConnectedDevice): ConnectedDevice {
  return {
    id: d.id,
    routerId: d.router_id,
    organizationId: d.organization_id,
    locationId: d.location_id,
    macAddress: d.mac_address,
    ipAddress: d.ip_address,
    hostname: d.hostname,
    vendor: d.vendor,
    connectionType: d.connection_type,
    interface: d.interface,
    signalStrengthDbm: d.signal_strength_dbm,
    isActive: d.is_active,
    connectedAt: d.connected_at,
    lastSeenAt: d.last_seen_at,
    comment: d.comment,
    guestId: d.guest_id,
    createdAt: d.created_at,
  };
}

function toSyncRun(r: BackendDeviceSyncRun): DeviceSyncRun {
  return {
    id: r.id,
    routerId: r.router_id,
    status: r.status,
    componentResults: r.component_results,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

// Same missing-X-Organization-Id gap already fixed on vlan/dhcp/firewall/
// guest-sessions services this session -- the claim in this file's own
// prior comment ("backend still authorizes by router_id ownership") was
// verified false live: every call here 403'd for a real customer with no
// header ("'connected_devices.read' is required at global scope"), 200
// once added.
export const connectedDeviceService = {
  async list(routerId: string, page = 1, pageSize = 50): Promise<ConnectedDeviceListResult> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendConnectedDeviceListResponse>("/connected-devices", {
      params: { router_id: routerId, page, page_size: pageSize },
      headers: { "X-Organization-Id": orgId },
    });
    return {
      rows: data.items.map(toDevice),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async sync(routerId: string): Promise<DeviceSyncSummary> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<{ discovered: number; updated: number; disconnected: number }>(
      `/connected-devices/sync/${routerId}`,
      undefined,
      { headers: { "X-Organization-Id": orgId } },
    );
    return data;
  },

  async comment(deviceId: string, comment: string): Promise<ConnectedDevice> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendConnectedDevice>(
      `/connected-devices/${deviceId}/comment`,
      { comment },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toDevice(data);
  },

  async disconnect(deviceId: string, reason?: string): Promise<ConnectedDevice> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendConnectedDevice>(
      `/connected-devices/${deviceId}/disconnect`,
      { reason: reason ?? null },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toDevice(data);
  },

  async block(deviceId: string, reason?: string): Promise<ConnectedDevice> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendConnectedDevice>(
      `/connected-devices/${deviceId}/block`,
      { reason: reason ?? null },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toDevice(data);
  },

  async unblock(deviceId: string, reason?: string): Promise<ConnectedDevice> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendConnectedDevice>(
      `/connected-devices/${deviceId}/unblock`,
      { reason: reason ?? null },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toDevice(data);
  },

  async whitelist(deviceId: string, reason?: string): Promise<ConnectedDevice> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendConnectedDevice>(
      `/connected-devices/${deviceId}/whitelist`,
      { reason: reason ?? null },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toDevice(data);
  },

  async remove(deviceId: string): Promise<void> {
    const orgId = await resolveOrgId();
    await api.delete(`/connected-devices/${deviceId}`, {
      headers: { "X-Organization-Id": orgId },
    });
  },

  async lastSyncRun(routerId: string): Promise<DeviceSyncRun | null> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<{ items: BackendDeviceSyncRun[] }>("/device-sync/runs", {
      params: { router_id: routerId, page: 1, page_size: 1 },
      headers: { "X-Organization-Id": orgId },
    });
    const run = data.items[0];
    return run ? toSyncRun(run) : null;
  },
};
