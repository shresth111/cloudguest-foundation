/**
 * Real backend for a venue's own monitored network hardware (Access
 * Points, Printers, Routers, Cameras, Other) -- backend `POST/GET/DELETE
 * /monitored-hardware`. Replaces the fake `useDeviceStore` (browser
 * localStorage only, hardcoded seed data for a fake "loc-1" location, a
 * random-from-MAC-hash "up/down" status -- see `stores/deviceStore.ts`'s
 * own comment) for every REAL account. That bug report: "devices I add
 * seem to disappear" -- because nothing was ever persisted to any server,
 * so a different browser/device/session (or localStorage getting
 * cleared) wiped it. Demo accounts keep using `useDeviceStore` exactly as
 * before -- see each call site's own `isDemo()` branch, unchanged by this
 * file.
 *
 * Response shape mirrors `stores/deviceStore.ts`'s `MonitoredDevice`
 * field names deliberately (`locationId`/`mac`/`type`/`statusChangedAt`,
 * not the backend's own `location_id`/`mac_address`/`device_type`/
 * `last_seen_at`), so every existing consumer's filter/map/derived-stat
 * logic (built against that shape across three call sites) keeps working
 * unchanged -- only the fetch mechanism itself was ever the bug.
 *
 * Status is never fabricated here either -- "up"/"down"/"unknown" come
 * straight from the backend's own honest derivation (see
 * `app.domains.monitored_hardware`'s module docstring): a real join
 * against `connected_devices`' own router-synced presence data, never a
 * ping this frontend or backend invents.
 */
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import type { DeviceType } from "@/stores/deviceStore";

export interface MonitoredDeviceRow {
  id: string;
  locationId: string;
  name: string;
  mac: string;
  type: DeviceType;
  floor: string;
  status: "up" | "down" | "unknown";
  /** Real `ConnectedDevice.last_seen_at` when the backend has ever
   * observed this MAC, `null` for "unknown" (never seen). */
  statusChangedAt: string | null;
}

interface RawMonitoredHardware {
  id: string;
  location_id: string;
  name: string;
  mac_address: string;
  device_type: string;
  floor: string | null;
  status: "up" | "down" | "unknown";
  last_seen_at: string | null;
}

function toRow(r: RawMonitoredHardware): MonitoredDeviceRow {
  return {
    id: r.id,
    locationId: r.location_id,
    name: r.name,
    mac: r.mac_address,
    type: r.device_type as DeviceType,
    floor: r.floor ?? "",
    status: r.status,
    statusChangedAt: r.last_seen_at,
  };
}

export const deviceHardwareService = {
  /** `locationId` omitted fetches every device across the whole
   * organization (needed by the location-picker's own cross-location
   * "N devices down" summary) -- the backend's own `location_id` query
   * param is optional for exactly this reason. When a `locationId` IS
   * given, `X-Location-Id` goes out alongside `X-Organization-Id` --
   * without it, RBAC infers ORGANIZATION scope for the `monitored_hardware
   * .read` check (see rbac/dependencies.py's `_infer_scope_type`), which a
   * location-scoped staff role's own grant can never satisfy no matter
   * what the role holds. Omitted (org-wide) calls keep sending only
   * X-Organization-Id, unchanged -- that request is genuinely org-scoped
   * by design, not a location-specific read. */
  async list(locationId?: string): Promise<MonitoredDeviceRow[]> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<{ items: RawMonitoredHardware[] }>("/monitored-hardware", {
      params: { location_id: locationId, page_size: 200 },
      headers: locationId
        ? { "X-Organization-Id": orgId, "X-Location-Id": locationId }
        : { "X-Organization-Id": orgId },
    });
    return (data?.items ?? []).map(toRow);
  },

  async register(
    locationId: string,
    name: string,
    mac: string,
    type: DeviceType,
    floor: string,
  ): Promise<MonitoredDeviceRow> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<RawMonitoredHardware>(
      "/monitored-hardware",
      { location_id: locationId, name, mac_address: mac, device_type: type, floor },
      { headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId } },
    );
    return toRow(data);
  },

  async remove(id: string): Promise<void> {
    const orgId = await resolveOrgId();
    await api.delete(`/monitored-hardware/${id}`, { headers: { "X-Organization-Id": orgId } });
  },
};
