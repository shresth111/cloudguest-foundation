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
 *  - isp       the dashboard's own `useWanSummary` read (`GET /isp/links`
 *              + health checks), handed in by the caller -- never fetched
 *              here, so asking costs no request. Absent = skipped.
 *
 * This list is THE venue's issue list: the dashboard computes it once and
 * publishes it (`@/components/customer/venueIssues`), and the top bar's
 * health pill and notification bell read that same list, so the three can
 * never disagree about how many things are wrong.
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
import type { CustomerDashboardData } from "@/services/customer.service";
import type { MonitoredDeviceRow } from "@/services/deviceHardware.service";
import type { WanSummaryState } from "./dashboard.types";
import {
  useVenueMonitoredHardware,
  useVenueOpenAlerts,
  type OpenAlertRow,
} from "./needsAttentionSources";
import {
  buildNeedsAttention,
  type IspLineInput,
  type NeedsAttentionInput,
  type NeedsAttentionState,
  type SourceAnswer,
} from "./needsAttentionModel";

export * from "./needsAttentionModel";

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

/** The WAN summary the dashboard already holds, as a source answer. `empty`
 * means no line on file (or a failed read -- `useWanSummary` does not tell
 * the two apart), so it is a skip, never a claim that the lines are fine. */
export function ispAnswerFromWan(wan: WanSummaryState | undefined): SourceAnswer<IspLineInput[]> {
  if (!wan) return { state: "skip" };
  if (wan.status === "loading") return { state: "loading" };
  if (wan.status === "empty") return { state: "skip" };
  return { state: "ready", value: wan.links };
}

export type NeedsAttentionResult = NeedsAttentionState & { loading: boolean };

export function useNeedsAttention(
  locationId: string,
  opts: { wan?: WanSummaryState } = {},
): NeedsAttentionResult {
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
    isp: ispAnswerFromWan(opts.wan),
    canOpen,
  });
  const total = state.checked.length + state.unchecked.length + state.pending.length;
  return { ...state, loading: total > 0 && state.pending.length === total };
}
