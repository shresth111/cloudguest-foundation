/**
 * `GET /isp/routers/{id}/as-router-device` -> the `RouterDevice` the existing
 * `RouterSetupDrilldown` takes as its `router` prop.
 *
 * The backend returns the existing `GET /routers/{id}` body (BE imports the
 * same response model), so this is field-for-field the same mapping as
 * `router.service.ts`'s private `toRouter`. It is repeated here rather than
 * reached through `routerService.get`, because that call also lists every
 * location to fill in the names, which an ISP user cannot do; the twin
 * fills `organization_name`/`location_name` itself.
 */
import { isControllerState } from "@/lib/router-vendors";
import type { IspRouterAsDevice } from "@/services/isp-partner/types";
import type { RouterDevice, RouterStatus } from "@/types/router";

export function toRouterDevice(
  r: IspRouterAsDevice,
  fallbackNames: { organizationName?: string; locationName?: string } = {},
): RouterDevice {
  return {
    id: r.id,
    locationId: r.location_id,
    locationName: r.location_name ?? fallbackNames.locationName ?? "",
    organizationId: r.organization_id,
    organizationName: r.organization_name ?? fallbackNames.organizationName ?? "",
    name: r.name,
    serialNumber: r.serial_number,
    macAddress: r.mac_address,
    model: r.model,
    vendor: r.vendor,
    routerOsVersion: r.routeros_version,
    managementIpAddress: r.management_ip_address,
    publicIpAddress: r.public_ip_address,
    status: r.status as RouterStatus,
    lastSeenAt: r.last_seen_at,
    lastHealthCheckAt: r.last_health_check_at,
    healthStatus: r.health_status,
    hasApiCredentials: r.has_api_credentials,
    controllerState: isControllerState(r.controller_state) ? r.controller_state : null,
    controllerStateReason: r.controller_state_reason ?? null,
    controllerLastContactedAt: r.controller_last_contacted_at ?? null,
    vendorClaimIsContradicted: r.vendor_claim_is_contradicted === true,
    settings: r.settings ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
