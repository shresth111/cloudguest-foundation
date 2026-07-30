import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";

export type BusinessHoursWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface BusinessHoursDay {
  open: boolean;
  start?: string;
  end?: string;
}

export type BusinessHoursSchedule = Partial<Record<BusinessHoursWeekday, BusinessHoursDay>>;

export interface BusinessHoursConfig {
  configId: string;
  enabled: boolean;
  timezone: string;
  schedule: BusinessHoursSchedule;
  closedMessage: string | null;
  isOpenNow: boolean;
}

interface BackendResolvedConfig {
  id: string;
  business_hours_enabled: boolean;
  business_hours_timezone: string;
  business_hours_schedule: BusinessHoursSchedule;
  business_hours_closed_message: string | null;
  is_open_now: boolean;
}

/**
 * Backs the real Business Hours admin page (src/components/features/
 * OperationsFeatures.tsx's BusinessHoursView) -- previously the "Apply"
 * button only showed a toast, nothing was ever persisted or read back
 * (bug report: toggling a day on/off in the dashboard had zero effect on
 * what a real guest saw). Reuses the same GET /captive-portal/resolve
 * every guest's device calls to find this location's real config id and
 * current business-hours fields, then PUT /captive-portal-configs/{id}
 * (the real, existing admin CRUD endpoint -- same one src/services/
 * portal.service.ts's Portal Builder uses for every other field) to save.
 */
export const businessHoursService = {
  async get(locationId: string): Promise<BusinessHoursConfig> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendResolvedConfig>("/captive-portal/resolve", {
      params: { organization_id: orgId, location_id: locationId },
    });
    return {
      configId: data.id,
      enabled: data.business_hours_enabled,
      timezone: data.business_hours_timezone,
      schedule: data.business_hours_schedule ?? {},
      closedMessage: data.business_hours_closed_message,
      isOpenNow: data.is_open_now,
    };
  },

  async save(
    configId: string,
    input: {
      enabled: boolean;
      timezone: string;
      schedule: BusinessHoursSchedule;
      closedMessage: string | null;
    },
  ): Promise<void> {
    const orgId = await resolveOrgId();
    await api.put(
      `/captive-portal-configs/${configId}`,
      {
        business_hours_enabled: input.enabled,
        business_hours_timezone: input.timezone,
        business_hours_schedule: input.schedule,
        business_hours_closed_message: input.closedMessage,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
  },
};
