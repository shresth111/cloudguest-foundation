/**
 * "What do I need to do right now at this venue?" -- one list, built only
 * from reads the dashboard already trusts. Nothing here is a guess:
 *
 *  - routers   `useCustomerDashboard` -> `customerService.getDashboard()`
 *              -> `d.liveness` (`deriveLocationLiveness` over
 *              `GET /locations/{id}/routers`).
 *  - logins    the same call's `d.kpis.failedLogins`
 *              (`GET /admin-logs/dashboard-logins`, Owner-only; `null` when
 *              the read failed or was refused).
 *  - alerts    `useVenueOpenAlerts` -> `GET /alerts` (triggered +
 *              acknowledged). Demo: the dashboard's own demo `recentAlerts`.
 *  - devices   `useVenueMonitoredHardware` -> `deviceHardwareService.list()`
 *              (`GET /monitored-hardware`).
 *  - plan      `useMyBillingDashboard` -> `GET /billing/dashboard/me`
 *              (`current_period_end`, `auto_renew`, status). Demo:
 *              `DEMO_PLAN_RENEWAL_ISO`, as the header uses.
 *
 * Every source ends in exactly one of three places: an item, `unchecked`
 * ("we asked and could not tell"), or `skipped` (this user may not read it,
 * or there is nothing to read -- e.g. a NAS-only venue's routers, which this
 * platform never measures). Only a source that answered may contribute to
 * "All good", so a failed read can never hide behind the empty state.
 */
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerDashboard, useIsDemo, useMyPermissions } from "@/hooks/useCustomerDashboard";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { DEMO_PLAN_RENEWAL_ISO } from "@/components/features/HeaderControls";
import { CUSTOMER_NAVS, getCustomerLoginRole } from "@/lib/customerNav";
import { navItemAllowed } from "@/lib/customerNavPermissions";
import { locationIsNasOnly, type LocationLiveness } from "@/lib/location-liveness";
import { hardwareLivenessIsMeasured, isRouterUnreadable } from "@/lib/device-liveness";
import type { CustomerDashboardData } from "@/services/customer.service";
import type { MonitoredDeviceRow } from "@/services/deviceHardware.service";
import type { MyBillingSummary } from "@/types/billing";
import {
  useVenueMonitoredHardware,
  useVenueOpenAlerts,
  type OpenAlertRow,
} from "./needsAttentionSources";

export type AttentionSeverity = "error" | "warning" | "info";

export type AttentionSource = "routers" | "alerts" | "devices" | "staffLogins" | "plan";

export type AttentionKind =
  | "venueOffline"
  | "routersPartlyOffline"
  | "noRouter"
  | "criticalAlerts"
  | "warningAlerts"
  | "devicesDown"
  | "failedLogins"
  | "planExpired"
  | "planPastDue"
  | "planExpiring";

export interface AttentionItem {
  kind: AttentionKind;
  severity: AttentionSeverity;
  /** Interpolation values for the row's copy. */
  params: { count?: number; total?: number; days?: number; date?: string };
  /** Customer nav id the action opens, or `null` when there is no page to
   * send them to, or this user cannot open it. */
  actionId: string | null;
}

export interface NeedsAttentionState {
  items: AttentionItem[];
  /** Sources that were asked and could not answer. */
  unchecked: AttentionSource[];
  /** Sources still loading. */
  pending: AttentionSource[];
  /** Sources that answered (with or without a problem). */
  checked: AttentionSource[];
}

/** Each source's answer, as handed to `buildNeedsAttention`. */
export type SourceAnswer<T> =
  | { state: "loading" }
  | { state: "error" }
  | { state: "skip" }
  | { state: "ready"; value: T };

export interface NeedsAttentionInput {
  liveness: SourceAnswer<LocationLiveness>;
  failedLogins: SourceAnswer<number>;
  alerts: SourceAnswer<{ critical: number; warning: number }>;
  devices: SourceAnswer<MonitoredDeviceRow[]>;
  plan: SourceAnswer<Pick<MyBillingSummary, "status" | "renewalDate" | "autoRenewal">>;
  /** Whether this user can open a customer nav page (role + permission,
   * the same two filters the sidebar applies). */
  canOpen: (navId: string) => boolean;
  now?: Date;
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Inside this many days a plan that will not renew by itself is flagged --
 * the same window the header's renewal pill uses (`RENEWAL_VISIBLE_DAYS`). */
export const PLAN_WARN_DAYS = 7;

function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now.getTime()) / 86_400_000);
}

/** Pure: turns the five answers into rows + bookkeeping. Exported for tests. */
export function buildNeedsAttention(input: NeedsAttentionInput): NeedsAttentionState {
  const now = input.now ?? new Date();
  const items: AttentionItem[] = [];
  const unchecked: AttentionSource[] = [];
  const pending: AttentionSource[] = [];
  const checked: AttentionSource[] = [];
  const action = (id: string) => (input.canOpen(id) ? id : null);

  function settle<T>(source: AttentionSource, answer: SourceAnswer<T>, read: (v: T) => void) {
    if (answer.state === "loading") pending.push(source);
    else if (answer.state === "error") unchecked.push(source);
    else if (answer.state === "ready") read(answer.value);
  }

  settle("routers", input.liveness, (lv) => {
    switch (lv.state) {
      case "not-live":
        checked.push("routers");
        items.push({
          kind: "venueOffline",
          severity: "error",
          params: { total: lv.routersTotal ?? undefined },
          actionId: action("debugging"),
        });
        return;
      case "partly-live": {
        checked.push("routers");
        const total = lv.routersTotal ?? 0;
        const online = lv.routersOnline ?? 0;
        items.push({
          kind: "routersPartlyOffline",
          severity: "warning",
          params: { count: total - online, total },
          actionId: action("debugging"),
        });
        return;
      }
      case "no-router":
        checked.push("routers");
        // Routers are added by Wyfy during setup, not from a customer page,
        // so there is no button to offer -- just the fact.
        items.push({ kind: "noRouter", severity: "info", params: {}, actionId: null });
        return;
      case "live":
        checked.push("routers");
        return;
      case "unknown":
        // A NAS-only venue's access points are never measured here, by
        // design -- that is not a failed check, it is no check at all.
        if (!locationIsNasOnly(lv)) unchecked.push("routers");
        return;
    }
  });

  settle("staffLogins", input.failedLogins, (n) => {
    checked.push("staffLogins");
    if (n > 0) {
      items.push({
        kind: "failedLogins",
        severity: "warning",
        params: { count: n },
        actionId: action("admin-logs"),
      });
    }
  });

  settle("alerts", input.alerts, ({ critical, warning }) => {
    checked.push("alerts");
    if (critical > 0) {
      items.push({
        kind: "criticalAlerts",
        severity: "error",
        params: { count: critical },
        actionId: action("alerts"),
      });
    }
    if (warning > 0) {
      items.push({
        kind: "warningAlerts",
        severity: "warning",
        params: { count: warning },
        actionId: action("alerts"),
      });
    }
  });

  settle("devices", input.devices, (devices) => {
    checked.push("devices");
    // Same rule as DeviceStatusCard's "down" count: a measured device that
    // is down, and not merely unobservable because its router cannot be read.
    const down = devices.filter(
      (d) =>
        d.status === "down" &&
        hardwareLivenessIsMeasured(d) &&
        !isRouterUnreadable(d.observationIssue),
    ).length;
    if (down > 0) {
      items.push({
        kind: "devicesDown",
        severity: "warning",
        params: { count: down },
        actionId: action("devices"),
      });
    }
  });

  settle("plan", input.plan, (plan) => {
    checked.push("plan");
    // No customer-facing renewal flow exists (the header's renewal pill is
    // display-only), so plan rows carry no button.
    if (plan.status === "past_due") {
      items.push({ kind: "planPastDue", severity: "error", params: {}, actionId: null });
      return;
    }
    const days = daysUntil(plan.renewalDate, now);
    if (days === null) return;
    if (days < 0) {
      items.push({
        kind: "planExpired",
        severity: "error",
        params: { date: plan.renewalDate },
        actionId: null,
      });
      return;
    }
    // A plan that renews itself is not something to act on.
    const willRenew = plan.autoRenewal && plan.status !== "canceled";
    if (days <= PLAN_WARN_DAYS && !willRenew) {
      items.push({
        kind: "planExpiring",
        severity: "warning",
        params: { days, date: plan.renewalDate },
        actionId: null,
      });
    }
  });

  // Stable sort: within a severity, sources keep the order above.
  const ranked = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity] || a.i - b.i)
    .map(({ item }) => item);

  return { items: ranked, unchecked, pending, checked };
}

/** HTTP status off the `AppError` the api client rejects with. */
function errorStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
}

/** Turns a React Query result into a `SourceAnswer`. A 403 is "this user
 * may not read it" (skip), never "couldn't check". */
function answerOf<T>(
  q: { data?: T; isLoading: boolean; isError: boolean; error: unknown },
  opts: { enabled: boolean; skipStatuses?: number[] },
): SourceAnswer<T> {
  if (!opts.enabled) return { state: "skip" };
  if (q.data !== undefined) return { state: "ready", value: q.data };
  if (q.isError) {
    const status = errorStatus(q.error);
    if (status !== null && (status === 403 || opts.skipStatuses?.includes(status))) {
      return { state: "skip" };
    }
    return { state: "error" };
  }
  return { state: "loading" };
}

function isOwnerRole(roles: { roleSlug: string; roleName?: string; scopeType: string }[]): boolean {
  // Same test CustomerDashboardPage applies to its failed-login pill.
  return roles.some(
    (r) =>
      r.roleSlug === "owner" ||
      r.roleSlug === "organization-owner" ||
      r.roleName?.toLowerCase().includes("owner") ||
      r.scopeType === "global",
  );
}

export function useNeedsAttention(locationId: string): NeedsAttentionState & { loading: boolean } {
  const demo = useIsDemo();
  const { roles } = useAuth();
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const { data: permissions } = useMyPermissions();
  const dash = useCustomerDashboard(locationId);

  // Fail open exactly like the sidebar: no grant set (loading, failed,
  // demo, empty) means "don't know", which never hides anything.
  const granted = permissions && permissions.length > 0 ? new Set(permissions) : null;
  const permitted = (navId: string) => (granted ? navItemAllowed(navId, granted) : true);
  const role = getCustomerLoginRole();
  const canOpen = (navId: string) => {
    const item = CUSTOMER_NAVS.find((n) => n.id === navId);
    return !!item && item.roles.includes(role) && permitted(navId);
  };

  const alertsAllowed = permitted("alerts");
  const devicesAllowed = permitted("devices");
  const alertsQ = useVenueOpenAlerts(locationId, alertsAllowed);
  const devicesQ = useVenueMonitoredHardware(locationId, devicesAllowed);
  const billingQ = useMyBillingDashboard(
    demo ? undefined : activeLocation?.organizationId,
    activeLocation?.organizationName,
  );

  const d: CustomerDashboardData | undefined = dash.data;
  const dashAnswer = <T>(read: (d: CustomerDashboardData) => T): SourceAnswer<T> =>
    d
      ? { state: "ready", value: read(d) }
      : dash.isError
        ? { state: "error" }
        : { state: "loading" };

  const owner = isOwnerRole(roles);
  const failedLogins: SourceAnswer<number> = (() => {
    if (!d)
      return dash.isError && owner
        ? { state: "error" }
        : dash.isError
          ? { state: "skip" }
          : { state: "loading" };
    const n = d.kpis.failedLogins;
    if (n === null) return owner ? { state: "error" } : { state: "skip" };
    return { state: "ready", value: n };
  })();

  const alerts: SourceAnswer<{ critical: number; warning: number }> = demo
    ? dashAnswer((x) => ({
        critical: x.recentAlerts.filter((a) => a.type === "error").length,
        warning: x.recentAlerts.filter((a) => a.type === "warning").length,
      }))
    : (() => {
        const a = answerOf<OpenAlertRow[]>(alertsQ, { enabled: alertsAllowed });
        if (a.state !== "ready") return a;
        return {
          state: "ready",
          value: {
            critical: a.value.filter((x) => x.severity === "critical").length,
            warning: a.value.filter((x) => x.severity === "warning").length,
          },
        };
      })();

  const plan: NeedsAttentionInput["plan"] = demo
    ? {
        state: "ready",
        value: { status: "active", renewalDate: DEMO_PLAN_RENEWAL_ISO, autoRenewal: false },
      }
    : // 404: no licence/subscription on file -- nothing to renew, not a failure.
      answerOf(billingQ, { enabled: !!activeLocation?.organizationId, skipStatuses: [404] });

  const state = buildNeedsAttention({
    liveness: dashAnswer((x) => x.liveness),
    failedLogins,
    alerts,
    devices: answerOf<MonitoredDeviceRow[]>(devicesQ, { enabled: devicesAllowed }),
    plan,
    canOpen,
  });
  const total = state.checked.length + state.unchecked.length + state.pending.length;
  return { ...state, loading: total > 0 && state.pending.length === total };
}
