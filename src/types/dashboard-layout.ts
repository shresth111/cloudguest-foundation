import type { FeatureFlag, ModuleId, PermissionAction } from "./permissions";

export type WidgetSize = "sm" | "md" | "lg" | "xl";

export type WidgetKind =
  | "kpi-grid"
  | "trend-chart"
  | "health-chart"
  | "usage-chart"
  | "recent-activity"
  | "notifications-preview"
  | "top-locations"
  | "quick-actions"
  | "welcome"
  | "custom";

/**
 * Backend-shaped dashboard descriptor. The frontend renders each
 * widget through a registry keyed on `kind`. Ordering, sizing and
 * visibility are all owned by the API — no hardcoded widget lists.
 */
export interface DashboardWidget {
  id: string;
  kind: WidgetKind;
  title?: string;
  description?: string;
  size: WidgetSize;
  order: number;
  /** Widget only renders when the caller has the given module + action. */
  requires?: { module: ModuleId; action?: PermissionAction };
  /** Widget only renders when this feature flag is enabled. */
  featureFlag?: FeatureFlag;
  /** Backend-supplied props merged into the widget component. */
  props?: Record<string, unknown>;
}

export interface DashboardLayout {
  variant: "super-admin" | "customer" | "location" | "support" | "read-only";
  greeting?: string;
  widgets: DashboardWidget[];
}
