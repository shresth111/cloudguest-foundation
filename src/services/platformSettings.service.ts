/**
 * Platform (Master-console, GLOBAL-scope) settings service.
 *
 * Three read/write surfaces, all deliberately **unscoped** -- none attaches
 * `X-Organization-Id`. A Master operator holds their permissions at GLOBAL
 * scope, so `api`'s request interceptor already skips the org header for
 * them (`hasGlobalScopeRole()` in `services/api.ts`); these calls resolve
 * platform-wide on the backend, the same way `master.settings.tsx`'s
 * existing `GET /roles` call does.
 *
 * - `listFeatures()`   -> `GET /features`         (global feature catalog, read-only)
 * - `getPlatformSettings()` / `updatePlatformSettings()` -> `GET`/`PUT /system-settings`
 * - `listPlanOptions()` -> `GET /plans`           (id/name for the plan picker)
 */

import { api } from "@/services/api";

// -- Feature catalog ----------------------------------------------------------

export type FeatureType = "boolean" | "limit" | "tier";

export interface PlatformFeature {
  key: string;
  name: string;
  description: string | null;
  category: string;
  type: FeatureType;
  defaultEnabled: boolean;
  tierOptions: string[];
  defaultTierValue: string | null;
}

interface BackendFeature {
  key: string;
  name: string;
  description?: string | null;
  category?: string;
  type?: string;
  default_enabled?: boolean;
  tier_options?: string[];
  default_tier_value?: string | null;
}

interface BackendFeatureList {
  features: BackendFeature[];
}

function toFeature(f: BackendFeature): PlatformFeature {
  const type = (f.type ?? "boolean") as FeatureType;
  return {
    key: f.key,
    name: f.name,
    description: f.description ?? null,
    category: f.category ?? "general",
    type: type === "limit" || type === "tier" ? type : "boolean",
    defaultEnabled: Boolean(f.default_enabled),
    tierOptions: Array.isArray(f.tier_options) ? f.tier_options : [],
    defaultTierValue: f.default_tier_value ?? null,
  };
}

// -- Platform settings (new-customer defaults) --------------------------------

export interface FeatureOverride {
  featureKey: string;
  enabled: boolean;
}

export interface PlatformSettings {
  newCustomerDefaultPlanId: string | null;
  newCustomerDefaultFeatureOverrides: FeatureOverride[];
}

interface BackendFeatureOverride {
  feature_key: string;
  enabled: boolean;
}

interface BackendPlatformSettings {
  new_customer_default_plan_id: string | null;
  new_customer_default_feature_overrides: BackendFeatureOverride[];
}

export interface UpdatePlatformSettingsPayload {
  /** `null` leaves the plan untouched; `""` positively clears the default. */
  newCustomerDefaultPlanId?: string | null;
  newCustomerDefaultFeatureOverrides?: FeatureOverride[];
}

function toPlatformSettings(s: BackendPlatformSettings): PlatformSettings {
  return {
    newCustomerDefaultPlanId: s.new_customer_default_plan_id ?? null,
    newCustomerDefaultFeatureOverrides: (s.new_customer_default_feature_overrides ?? []).map(
      (o) => ({ featureKey: o.feature_key, enabled: o.enabled }),
    ),
  };
}

// -- Plan options (for the picker) --------------------------------------------

export interface PlanOption {
  id: string;
  name: string;
  planType: string;
  isActive: boolean;
}

interface BackendPlanLite {
  id: string;
  name: string;
  plan_type: string;
  is_active: boolean;
}

interface BackendPlanList {
  items: BackendPlanLite[];
}

export const platformSettingsService = {
  async listFeatures(): Promise<PlatformFeature[]> {
    const { data } = await api.get<BackendFeatureList>("/features");
    return (data.features ?? []).map(toFeature);
  },

  async getPlatformSettings(): Promise<PlatformSettings> {
    const { data } = await api.get<BackendPlatformSettings>("/system-settings");
    return toPlatformSettings(data);
  },

  async updatePlatformSettings(payload: UpdatePlatformSettingsPayload): Promise<PlatformSettings> {
    const body: Partial<BackendPlatformSettings> = {};
    if (payload.newCustomerDefaultPlanId !== undefined) {
      body.new_customer_default_plan_id = payload.newCustomerDefaultPlanId;
    }
    if (payload.newCustomerDefaultFeatureOverrides !== undefined) {
      body.new_customer_default_feature_overrides = payload.newCustomerDefaultFeatureOverrides.map(
        (o) => ({
          feature_key: o.featureKey,
          enabled: o.enabled,
        }),
      );
    }
    const { data } = await api.put<BackendPlatformSettings>("/system-settings", body);
    return toPlatformSettings(data);
  },

  /** The plan catalog, reduced to what the picker needs. `include_private`
   * surfaces non-public plans too (a Master operator picking a default may
   * legitimately want one). Only active plans are offered -- the backend's
   * `list_plans` defaults `is_active=true` -- which is the right set to pick
   * a *default* from: you would never want to place every new customer onto
   * a deactivated plan. */
  async listPlanOptions(): Promise<PlanOption[]> {
    const { data } = await api.get<BackendPlanList>("/plans", {
      params: { include_private: true, page_size: 100 },
    });
    return (data.items ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      planType: p.plan_type,
      isActive: p.is_active,
    }));
  },
};
