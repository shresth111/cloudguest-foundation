/**
 * RAKESH-P1 BE routes. Each is behind its own flag (404 while off):
 * - ISP_TEMPLATE_RULES_ENABLED: device rules on speed templates.
 * - ISP_CYCLE_BASIS_ENABLED: billing cycle from the package or the subscriber.
 * - ISP_ZONE_COUPON_RIGHTS_ENABLED: per-zone coupon right for franchisees.
 */
import api from "@/services/api";

export interface TemplateDeviceRules {
  speed_group_id: string;
  configured: boolean;
  /** devices per coupon / login (the package's max_devices), 1..50 */
  max_devices: number;
  /** auto-bind the first N device MACs (0 = off), 0..16 */
  mac_bind_count: number;
  /** only bound MACs may connect */
  mac_restriction: boolean;
  /** devices online at once, 1..64, or null for no limit */
  max_simultaneous: number | null;
}

export type TemplateDeviceRulesBody = Omit<TemplateDeviceRules, "speed_group_id" | "configured">;

export interface RulesApplyItem {
  package_id: string;
  name: string;
  status: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface RulesApplyResult {
  speed_group_id: string;
  dry_run: boolean;
  rules: TemplateDeviceRules;
  packages: RulesApplyItem[];
  would_change: number;
  unchanged: number;
}

export type CycleBasis = "package" | "subscriber";

export const CYCLE_BASIS_LABEL: Record<CycleBasis, string> = {
  package: "From the package validity",
  subscriber: "On the subscriber's billing day",
};

export interface ZoneCouponRight {
  zone_id: string;
  /** null = inherits from the parent zone */
  explicit: boolean | null;
  allow_generate: boolean;
  decided_by_zone_id: string | null;
}

export const p1Service = {
  async listTemplateRules(): Promise<TemplateDeviceRules[]> {
    const { data } = await api.get<{ items: TemplateDeviceRules[] }>(
      "/isp/speed-group-device-rules",
    );
    return data.items;
  },
  async getTemplateRules(groupId: string): Promise<TemplateDeviceRules> {
    const { data } = await api.get<TemplateDeviceRules>(
      `/isp/speed-groups/${groupId}/device-rules`,
    );
    return data;
  },
  async putTemplateRules(
    groupId: string,
    body: TemplateDeviceRulesBody,
  ): Promise<TemplateDeviceRules> {
    const { data } = await api.put<TemplateDeviceRules>(
      `/isp/speed-groups/${groupId}/device-rules`,
      body,
    );
    return data;
  },
  async applyTemplateRules(groupId: string, dryRun: boolean): Promise<RulesApplyResult> {
    const { data } = await api.post<RulesApplyResult>(
      `/isp/speed-groups/${groupId}/device-rules/apply`,
      { dry_run: dryRun },
    );
    return data;
  },
  async listCycleBasis(): Promise<{ package_id: string; basis: CycleBasis }[]> {
    const { data } = await api.get<{ items: { package_id: string; basis: CycleBasis }[] }>(
      "/isp/package-cycle-basis",
    );
    return data.items;
  },
  async putCycleBasis(packageId: string, basis: CycleBasis): Promise<void> {
    await api.put(`/isp/packages/${packageId}/cycle-basis`, { basis });
  },
  async listZoneCouponRights(): Promise<ZoneCouponRight[]> {
    const { data } = await api.get<{ items: ZoneCouponRight[] }>("/isp/zone-coupon-rights");
    return data.items;
  },
  async putZoneCouponRight(zoneId: string, allow: boolean | null): Promise<ZoneCouponRight> {
    const { data } = await api.put<ZoneCouponRight>(`/isp/zones/${zoneId}/coupon-right`, {
      allow_generate: allow,
    });
    return data;
  },
};
