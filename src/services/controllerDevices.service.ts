/**
 * Read-only client for a venue's own Omada controller device inventory --
 * the controller and the APs adopted under it.
 *
 * Backed by the customer-facing, organization-scoped backend endpoint
 * `GET /network-integrations/locations/{id}/controller-devices` (deliberately
 * NOT the Master-console GLOBAL `network-integrations/*` routes, which 403 for
 * a venue owner). There is no write counterpart, by design: the customer
 * observes their controller, never operates it.
 */
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";

/** Three genuinely different states the dashboard must not conflate: the
 *  location has no Omada controller at all (`no_controller` -- e.g. a MikroTik
 *  venue), the controller exists but did not answer (`unreachable`), or it
 *  answered (`ok`, with `devices` -- which may legitimately be empty for a
 *  controller that has nothing adopted yet). */
export type ControllerInventoryStatus = "ok" | "no_controller" | "unreachable";

export type ControllerDeviceRow = {
  mac: string;
  name: string | null;
  deviceType: string;
  model: string | null;
  status: string;
  ipAddress: string | null;
  firmwareVersion: string | null;
  uptimeSeconds: number | null;
  clientCount: number | null;
};

export type ControllerInventory = {
  status: ControllerInventoryStatus;
  devices: ControllerDeviceRow[];
};

type RawDevice = {
  mac: string;
  name: string | null;
  device_type: string;
  model: string | null;
  status: string;
  ip_address: string | null;
  firmware_version: string | null;
  uptime_seconds: number | null;
  client_count: number | null;
};

const KNOWN_STATUSES: ControllerInventoryStatus[] = ["ok", "no_controller", "unreachable"];

export const controllerDevicesService = {
  async list(locationId: string): Promise<ControllerInventory> {
    const orgId = await resolveOrgId();
    // The shared interceptor has already unwrapped the ApiResponse envelope,
    // so `data` is the inner `{status, devices}` payload.
    const { data } = await api.get<{ status: string; devices: RawDevice[] }>(
      `/network-integrations/locations/${locationId}/controller-devices`,
      { headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId } },
    );
    // An unrecognised status is treated as `no_controller` (show nothing)
    // rather than assumed `ok` -- never invent a device list from a state we
    // do not understand.
    const status = (
      KNOWN_STATUSES.includes(data.status as ControllerInventoryStatus)
        ? data.status
        : "no_controller"
    ) as ControllerInventoryStatus;
    return {
      status,
      devices: (data.devices ?? []).map((d) => ({
        mac: d.mac,
        name: d.name,
        deviceType: d.device_type,
        model: d.model,
        status: d.status,
        ipAddress: d.ip_address,
        firmwareVersion: d.firmware_version,
        uptimeSeconds: d.uptime_seconds,
        clientCount: d.client_count,
      })),
    };
  },
};
