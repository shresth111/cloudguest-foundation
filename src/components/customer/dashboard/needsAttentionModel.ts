/**
 * The pure half of "Needs attention": the item model and the one function
 * that turns source answers into the venue's issue list. No hooks and no
 * service imports, so the top bar (health pill, bell) can share the exact
 * same derivation without pulling the dashboard's data layer into every
 * page. `useNeedsAttention.ts` is the hook that feeds it.
 */
import { locationIsNasOnly, type LocationLiveness } from "@/lib/location-liveness";
import { hardwareLivenessIsMeasured, isRouterUnreadable } from "@/lib/device-liveness";
import type { MonitoredDeviceRow } from "@/services/deviceHardware.service";
import type { MyBillingSummary } from "@/types/billing";
import type { IspLink } from "@/types/isp";
import type { RouterLiveness } from "@/lib/location-liveness";

export type AttentionSeverity = "error" | "warning" | "info";

export type AttentionSource = "routers" | "alerts" | "devices" | "isp" | "staffLogins" | "plan";

export type AttentionKind =
  | "venueOffline"
  | "routersPartlyOffline"
  | "noRouter"
  | "criticalAlerts"
  | "warningAlerts"
  | "devicesDown"
  | "devicesUnstable"
  | "ispDown"
  | "ispDegraded"
  | "failedLogins"
  | "planExpired"
  | "planPastDue"
  | "planExpiring";

export interface AttentionItem {
  kind: AttentionKind;
  severity: AttentionSeverity;
  /** Interpolation values for the row's copy. */
  params: { count?: number; total?: number; days?: number; date?: string; names?: string };
  /** Routers kinds only: the routers that are not checking in, with the
   * liveness module's own words, so the row can say which ones and what to
   * do (this replaced the separate "Partly live" explainer panel). */
  routers?: RouterLiveness[];
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
  /** The venue's internet lines, as the dashboard's WAN read returned them.
   * Optional: a caller that has not read them leaves it out (skipped). */
  isp?: SourceAnswer<IspLineInput[]>;
  /** Whether this user can open a customer nav page (role + permission,
   * the same two filters the sidebar applies). */
  canOpen: (navId: string) => boolean;
  now?: Date;
}

export type IspLineInput = Pick<
  IspLink,
  "id" | "providerName" | "healthStatus" | "isEnabled" | "isActiveUplink"
>;

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
    const silent = (lv.routers ?? []).filter((r) => r.status !== "pass");
    switch (lv.state) {
      case "not-live":
        checked.push("routers");
        items.push({
          kind: "venueOffline",
          severity: "error",
          params: { total: lv.routersTotal ?? undefined },
          routers: silent,
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
          routers: silent,
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
    // Answering but unhealthy (the Devices page's "Unstable" / "Not
    // responding"): the backend's own `health.state`, never a guess. Rows
    // without a health object (older backend) cannot contribute.
    const unstable = devices.filter(
      (d) =>
        d.status !== "down" &&
        d.health?.state === "degraded" &&
        hardwareLivenessIsMeasured(d) &&
        !isRouterUnreadable(d.observationIssue),
    ).length;
    if (unstable > 0) {
      items.push({
        kind: "devicesUnstable",
        severity: "warning",
        params: { count: unstable },
        actionId: action("devices"),
      });
    }
  });

  if (input.isp) {
    settle("isp", input.isp, (lines) => {
      checked.push("isp");
      const enabled = lines.filter((l) => l.isEnabled !== false);
      const down = enabled.filter((l) => l.healthStatus === "unhealthy");
      const degraded = enabled.filter((l) => l.healthStatus === "degraded");
      if (down.length > 0) {
        items.push({
          kind: "ispDown",
          // The line guests are on right now is an outage; a dead backup is
          // a warning -- guests are still online through the other line.
          severity: down.some((l) => l.isActiveUplink) ? "error" : "warning",
          params: { count: down.length, names: down.map((l) => l.providerName).join(", ") },
          actionId: action("isp-details"),
        });
      }
      if (degraded.length > 0) {
        items.push({
          kind: "ispDegraded",
          severity: "warning",
          params: {
            count: degraded.length,
            names: degraded.map((l) => l.providerName).join(", "),
          },
          actionId: action("isp-details"),
        });
      }
    });
  }

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
