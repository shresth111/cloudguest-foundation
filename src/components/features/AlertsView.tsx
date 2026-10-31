/**
 * Alerts (Home › Alerts): the venue's recent operational alerts, on the
 * console primitives -- PageHeader, four StatTiles and one Panel list with
 * token-coloured severity icons and StatusBadges. Moved out of
 * OperationsFeatures.tsx (which re-exports it) with its data path unchanged:
 * demo sessions get DEMO_ALERTS, real ones GET /alerts once, post-mount.
 */
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Bell, CheckCircle2, XCircle } from "lucide-react";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  EmptyState as ConsoleEmptyState,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
  StatusDot,
  type ConsoleStatus,
  type PageScope,
} from "@/components/customer/console";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
}

interface AlertRow {
  sev: string;
  title: string;
  src: string;
  t: string;
  status: string;
}

const DEMO_ALERTS: AlertRow[] = [
  {
    sev: "error",
    title: "Bandwidth threshold exceeded",
    src: "GW-02 · Marathahalli",
    t: "4 min ago",
    status: "open",
  },
  {
    sev: "warning",
    title: "Signal degradation detected",
    src: "AP-14 · Lobby",
    t: "22 min ago",
    status: "open",
  },
  {
    sev: "success",
    title: "ISP failover completed",
    src: "System",
    t: "1 hour ago",
    status: "resolved",
  },
  {
    sev: "info",
    title: "Firmware update available",
    src: "Router fleet",
    t: "3 hours ago",
    status: "open",
  },
  {
    sev: "warning",
    title: "OTP delivery delayed",
    src: "Telecom gateway",
    t: "5 hours ago",
    status: "open",
  },
];

interface RawAlert {
  severity: string;
  message: string;
  triggered_at: string;
  status: string;
  router_id: string | null;
  router_name: string | null;
}

export function AlertsView({ scope }: { scope?: PageScope } = {}) {
  // Both start neutral (empty/loading) on server and client alike --
  // seeding straight from isDemo() here (server: no window -> false,
  // client's first hydration pass: real token -> true) made the KPI
  // row's counts (and the empty-vs-populated list below it) disagree
  // between the SSR'd HTML and the client's hydration render, which is a
  // real "Hydration failed" (#418), not just a cosmetic flash. The demo
  // seed (or the real fetch) is applied from the effect below instead,
  // strictly post-mount.
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo()) {
      setAlerts(DEMO_ALERTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const orgId = await resolveOrgId();
        const { data } = await api.get<{ items: RawAlert[] }>("/alerts", {
          params: { page_size: 50, organization_id: orgId },
          headers: { "X-Organization-Id": orgId },
        });
        if (cancelled) return;
        setAlerts(
          (data?.items ?? []).map((a) => ({
            sev:
              a.severity === "critical"
                ? "error"
                : a.severity === "warning"
                  ? "warning"
                  : a.status === "resolved"
                    ? "success"
                    : "info",
            // Backend fix: was showing the raw router_id UUID as visible text
            // whenever a router-scoped alert had no other label to fall back
            // to -- real router_name now comes straight from the API
            // (monitoring/service.py's get_router_names_for_alerts), never a
            // raw ID left for a customer to see.
            title: a.message,
            src: a.router_name ?? "System",
            t: timeAgo(a.triggered_at),
            status: a.status,
          })),
        );
      } catch {
        // Leave alerts empty -- the "no alerts" state is accurate.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const SEVERITY: Record<string, { status: ConsoleStatus; Icon: typeof XCircle }> = {
    error: { status: "crit", Icon: XCircle },
    warning: { status: "warn", Icon: AlertTriangle },
    success: { status: "ok", Icon: CheckCircle2 },
  };
  const severity = (s: string) => SEVERITY[s] ?? { status: "info" as const, Icon: Activity };
  const statusTone = (status: string): ConsoleStatus =>
    status === "resolved" ? "ok" : status === "acknowledged" ? "info" : "warn";
  const active = alerts.filter((a) => a.status === "open" || a.status === "acknowledged").length;
  const warnings = alerts.filter((a) => a.sev === "warning").length;
  const resolved = alerts.filter((a) => a.status === "resolved").length;
  return (
    // `.wy-console` on its own root: the agent view (config/customerFeatures)
    // mounts this outside the customer shell, and nested inside the shell's
    // own wrapper it resolves to the same tokens.
    <div className="wy-console space-y-5">
      {/* "Mark all read" used to sit here with no onClick at all -- a fully
       * dead button on a real customer's alerts page. Removed rather than
       * wired to an unverified endpoint. Under the customer shell this is
       * the page's only header: the shell passes the tab name and venue. */}
      <PageHeader
        title={scope?.title ?? "Alerts"}
        venue={scope?.venue}
        description="Live operational alerts across routers, ISPs and the captive portal."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open"
          value={String(active)}
          loading={loading}
          leading={<StatusDot status="crit" label="Open" size="sm" />}
        />
        <StatTile
          label="Warnings"
          value={String(warnings)}
          loading={loading}
          leading={<StatusDot status="warn" label="Warnings" size="sm" />}
        />
        <StatTile
          label="Resolved"
          value={String(resolved)}
          loading={loading}
          leading={<StatusDot status="ok" label="Resolved" size="sm" />}
        />
        <StatTile label="Total" value={String(alerts.length)} loading={loading} />
      </div>
      <Panel flush title="Recent alerts">
        {loading ? (
          <div className="px-4 py-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : alerts.length === 0 ? (
          <ConsoleEmptyState
            icon={Bell}
            title="All clear"
            description="No issues right now. We'll flag anything across your routers, ISPs, or captive portal here the moment it happens."
          />
        ) : (
          <ul className="divide-y divide-[var(--wy-border)]">
            {alerts.map((a, i) => {
              const sev = severity(a.sev);
              return (
                <li key={i} className="flex min-h-12 items-start gap-3 px-4 py-3">
                  <sev.Icon
                    aria-hidden
                    className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_TEXT_CLASS[sev.status])}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--wy-text)]">{a.title}</p>
                    <p className="text-xs text-[var(--wy-text-muted)]">{a.src}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={statusTone(a.status)} className="capitalize">
                      {a.status}
                    </StatusBadge>
                    <span className="text-xs tabular-nums text-[var(--wy-text-faint)]">{a.t}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const STATUS_TEXT_CLASS: Record<ConsoleStatus, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  info: "text-[var(--wy-info)]",
  offline: "text-[var(--wy-offline)]",
};
