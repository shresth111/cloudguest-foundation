/**
 * Customer-dashboard feature views redesigned from the legacy BhaiFi
 * Cloud App screens (Business Hours, Hotspot Settings, Debugging Tools,
 * RaaS, MAC Auth, Port Forwarding, DHCP, VLANs, VOIP, ISP Routing/Details,
 * Notifications, Top Up, Alerts, Admin Logs). All token-driven so they
 * pick up the Aurora Teal identity automatically. Mock data only -- these
 * are the seam a per-location backend call replaces.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Bug,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  Globe,
  Network,
  Plus,
  RadioTower,
  RotateCcw,
  Router,
  Shield,
  ShieldAlert,
  Signal,
  Terminal,
  Ticket,
  Trash2,
  Wifi,
  XCircle,
  Bell,
  Server,
  Pencil,
  RefreshCw,
  History,
  ScrollText,
  Fingerprint,
  KeyRound,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatTone } from "@/components/ui-ext/StatCard";
import { NumberedPagination } from "@/components/ui-ext/NumberedPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useCustomerFeatureData,
  useAdminLogsDashboardLogins,
  useAdminLogsRouterEvents,
  useAdminLogsAccountActivity,
} from "@/hooks/useCustomerDashboard";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { macAuthorizationService } from "@/services/mac-authorization.service";
import {
  businessHoursService,
  type BusinessHoursDay,
  type BusinessHoursSchedule,
  type BusinessHoursWeekday,
} from "@/services/business-hours.service";
import { routerService } from "@/services/router.service";
import { ispService } from "@/services/isp.service";
import { DhcpManagement } from "@/components/network/DhcpManagement";
import { VlanManagement } from "@/components/network/VlanManagement";
import { PortForwardingManagement } from "@/components/network/PortForwardingManagement";
import { HotspotManagement } from "@/components/network/HotspotManagement";
// Only the pure rule-vocabulary helpers are reused here -- the Master
// Console's own IspManagement component (and its full uplink+rule CRUD UI)
// stays exactly as-is at /network/isp; the customer dashboard's "Internet
// Connection" view (IspDetailsView below) builds its own Routing Rules
// section using these so the two surfaces can't drift on rule-type labels.
import {
  matchFieldLabel,
  matchValueFromRule,
  RULE_TYPES,
} from "@/components/network/IspManagement";
import { QosManagement } from "@/components/network/QosManagement";
import { ContentFilterManagement } from "@/components/network/ContentFilterManagement";
import type { RouterDevice } from "@/types/router";
import type {
  IspLink,
  IspLinkRole,
  IspHealthCheck,
  IspHealthCheckSummary,
  IspManualHealthStatus,
  IspConnectionMode,
  IspRoutingRule,
  IspRoutingRuleType,
  IspSpeedTestResult,
} from "@/types/isp";
import { api } from "@/services/api";
import type { AppError } from "@/services/api";
import { monitoringService } from "@/services/monitoring.service";
import type { AlertRule, NotificationChannel } from "@/types/monitoring";
import { humanizeApiError } from "@/lib/errorMessages";
import { cn } from "@/lib/utils";
import { getCustomerLoginRole } from "@/lib/customerNav";
import { normalizeMac } from "@/lib/device-presentation";
import { FixAProblem } from "@/components/customer/FixAProblem";
import { IspProviderIcon } from "@/components/icons/isp";

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
}

/* ---------- shared building blocks ---------- */

function FeatureHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Optional icon-badge (gradient indigo/violet box, established this
   * session on Dashboard's chart headers) shown left of the title. Omitted
   * by default so existing callers outside this polish pass render
   * unchanged. */
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
            <Icon className="h-[18px] w-[18px] text-white" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// `ToggleRow` used to live here: a switch bound to nothing but its own
// `useState`, which is how NotificationView managed to look finished while
// persisting nothing. Its only caller was that screen; both are gone.
// (The unrelated `ToggleRow` in components/settings/SectionCard.tsx is a
// different component and is still in use.)

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  online: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  enabled: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  degraded: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  pending: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  disabled: "text-muted-foreground bg-muted",
  offline: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
  blocked: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "text-muted-foreground bg-muted",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const TONE_ICON_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-rose-500",
  info: "text-sky-500",
};

// Soft tone-tinted badge background so a KpiRow tile's own status (danger/
// warning/success/etc.) still reads through the icon badge, instead of a
// flat neutral circle that lost the tone's meaning -- while "primary"/
// "default" fall back to the brand gradient used everywhere else.
const TONE_ICON_BADGE: Record<StatTone, string> = {
  default: "bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]",
  primary: "bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]",
  success: "bg-emerald-500/15",
  warning: "bg-amber-500/15",
  danger: "bg-rose-500/15",
  info: "bg-sky-500/15",
};
const TONE_ICON_ON_BADGE: Record<StatTone, string> = {
  default: "text-white",
  primary: "text-white",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-rose-500",
  info: "text-sky-500",
};

function KpiRow({
  items,
}: {
  items: {
    label: string;
    value: string;
    tone?: StatTone;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((k) => {
        const tone = k.tone ?? "default";
        return (
          <div
            key={k.label}
            className="flex items-center gap-3 rounded-2xl border-0 bg-card p-4 shadow-sm"
          >
            {k.icon && (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  TONE_ICON_BADGE[tone],
                )}
              >
                <k.icon className={cn("h-5 w-5", TONE_ICON_ON_BADGE[tone])} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">{k.label}</p>
              <p className="truncate text-lg font-bold">{k.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Alerts ---------- */
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

export function AlertsView() {
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

  const icon = (s: string) =>
    s === "error" ? (
      <XCircle className="h-4 w-4 text-rose-500" />
    ) : s === "warning" ? (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    ) : s === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : (
      <Activity className="h-4 w-4 text-sky-500" />
    );
  const leftBorder = (s: string) =>
    s === "error"
      ? "border-l-rose-500"
      : s === "warning"
        ? "border-l-amber-500"
        : s === "success"
          ? "border-l-emerald-500"
          : "border-l-sky-500";
  const statusBadge = (status: string) =>
    status === "resolved"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
      : status === "acknowledged"
        ? "border-sky-500/20 bg-sky-500/10 text-sky-600"
        : "border-amber-500/20 bg-amber-500/10 text-amber-600";
  const active = alerts.filter((a) => a.status === "open" || a.status === "acknowledged").length;
  const warnings = alerts.filter((a) => a.sev === "warning").length;
  const resolved = alerts.filter((a) => a.status === "resolved").length;
  return (
    <div className="space-y-6">
      {/* "Mark all read" used to sit here with no onClick at all -- a fully
       * dead button on a real customer's alerts page. Removed rather than
       * wired to an unverified endpoint. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FeatureHeader
            title="Alerts"
            description="Live operational alerts across routers, ISPs and the captive portal."
            icon={Bell}
          />
        </div>
        <AlertsIllustration />
      </div>
      <KpiRow
        items={[
          { label: "Open", value: String(active), tone: "danger", icon: AlertTriangle },
          { label: "Warnings", value: String(warnings), tone: "warning", icon: AlertTriangle },
          { label: "Resolved", value: String(resolved), tone: "success", icon: CheckCircle2 },
          { label: "Total", value: String(alerts.length), tone: "primary", icon: Activity },
        ]}
      />
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Recent alerts</CardTitle>
        </CardHeader>
        <CardContent className={cn("space-y-2", alerts.length > 0 && !loading ? "p-3" : "p-0")}>
          {loading ? (
            <div className="px-6 py-4">
              <LoadingSkeleton rows={4} />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="All clear"
              description="No issues right now. We'll flag anything across your routers, ISPs, or captive portal here the moment it happens."
            />
          ) : (
            alerts.map((a, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-xl border-l-4 bg-muted/40 py-2.5 pl-3 pr-3",
                  leftBorder(a.sev),
                )}
              >
                <span className="mt-0.5 shrink-0">{icon(a.sev)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.src}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                      statusBadge(a.status),
                    )}
                  >
                    {a.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.t}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Open Hours (was "Business Hours") ----------
 * Renamed + visually redesigned only -- the old name/layout read too close
 * to a competitor's equivalent feature. The id ("business-hours"), route,
 * businessHoursService contract, and every field below (BH_DAYS,
 * BusinessHoursSchedule, etc.) are all untouched on purpose.
 *
 * Real, guest-facing effect (backend/app/domains/captive_portal --
 * business_hours_enabled/timezone/schedule/closed_message columns,
 * GET /captive-portal/resolve computes is_open_now live from these on
 * every real guest portal load): previously the "Apply" button only
 * showed a toast, nothing was ever persisted or read back on reload --
 * bug report "on/off karne par captive portal 'business is closed'
 * jaisa kuch nahi dikhata tha". Now a real save (PUT /captive-portal-
 * configs/{id}) and a real fetch on load, via businessHoursService.
 */
const BH_DAYS: { key: BusinessHoursWeekday; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const DEMO_BH_SCHEDULE: BusinessHoursSchedule = Object.fromEntries(
  BH_DAYS.map((d, i) => [
    d.key,
    i < 6 ? { open: true, start: "09:00", end: "21:00" } : { open: false },
  ]),
) as BusinessHoursSchedule;

/** Header-accent illustrations for the 5 views below that had an icon-badge
 * but no illustration yet -- same filled-flat-shape language established
 * elsewhere this session (see BlockUsers.tsx/CampaignsPage.tsx etc.).
 * Purely decorative, aria-hidden. */
function AlertsIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <path
        d="M42 10c-7 0-12 5.5-12 13v6l-4 6h32l-4-6v-6c0-7.5-5-13-12-13z"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M37 35a5 5 0 0 0 10 0"
        stroke="#a78bfa"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <motion.circle
        cx="42"
        cy="12"
        r="3.4"
        fill="#f0abfc"
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.25, 1], opacity: [0.75, 1, 0.75] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
        }
      />
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M${42 - (16 + i * 6)} 12a${16 + i * 6} ${16 + i * 6} 0 0 1 ${32 + i * 12} 0`}
          stroke="#22d3ee"
          strokeOpacity={0.55 - i * 0.12}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

/** Sun/moon motif (not a clock face) so the header art reads as "when
 * guests can get online", not a generic settings-clock -- and so it pairs
 * visually with the Sun/Moon icons this view's own status tile and guest
 * preview use, and with the Moon already on the guest-facing closed screen
 * (src/routes/portal.closed.tsx). */
function OpenHoursIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <circle cx="30" cy="26" r="13" fill="#2e2a5c" stroke="#f0abfc" strokeWidth="1.6" />
      <motion.circle
        cx="30"
        cy="26"
        r="6.5"
        fill="#fcd34d"
        animate={
          shouldReduceMotion ? { opacity: 0.95 } : { opacity: [0.75, 1, 0.75], scale: [1, 1.08, 1] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return (
          <motion.line
            key={i}
            x1={30 + 10 * Math.cos(a)}
            y1={26 + 10 * Math.sin(a)}
            x2={30 + 15.5 * Math.cos(a)}
            y2={26 + 15.5 * Math.sin(a)}
            stroke="#fcd34d"
            strokeWidth="1.8"
            strokeLinecap="round"
            initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.05 * i, ease: "easeOut" }}
          />
        );
      })}
      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <path
          d="M62 8a10 10 0 1 0 9 14.5A8 8 0 0 1 62 8z"
          fill="#1e1b4b"
          stroke="#22d3ee"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
}

function NotificationIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 76 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <path
        d="M28 12c0-4.4 3.6-8 8-8s8 3.6 8 8v6c0 6 3 9 5 11H23c2-2 5-5 5-11z"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M32 33a4 4 0 0 0 8 0"
        stroke="#a78bfa"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <motion.circle
        cx="46"
        cy="10"
        r="10"
        fill="#1e1b4b"
        stroke="#22d3ee"
        strokeWidth="1.8"
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <circle cx="46" cy="10" r="3" fill="#22d3ee" />
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M${58 + i * 4} ${8 - i * 2}q4 1 5 5`}
          stroke="#f0abfc"
          strokeOpacity="0.55"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12 * i, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

function IspDetailsIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <circle cx="30" cy="26" r="18" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.6" />
      <ellipse
        cx="30"
        cy="26"
        rx="18"
        ry="7"
        stroke="#4f46e5"
        strokeOpacity="0.6"
        strokeWidth="1.2"
        fill="none"
      />
      <path d="M30 8v36M12 26h36" stroke="#4f46e5" strokeOpacity="0.6" strokeWidth="1.2" />
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M52 ${20 + i * 3}q${10 + i * 3} ${1 - i} ${16 + i * 5} ${6 + i * 3}`}
          stroke={["#22d3ee", "#f0abfc", "#a78bfa"][i]}
          strokeOpacity="0.65"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
      <motion.circle
        cx="30"
        cy="26"
        r="3"
        fill="#22d3ee"
        animate={shouldReduceMotion ? { opacity: 0.9 } : { opacity: [0.6, 1, 0.6] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }
      />
    </svg>
  );
}

function MacAuthIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="8"
        y="10"
        width="26"
        height="32"
        rx="4"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.6"
      />
      <rect x="12" y="15" width="18" height="12" rx="1.5" fill="#1e1b4b" />
      <circle cx="21" cy="34" r="1.4" fill="#a78bfa" />
      <motion.path
        d="M40 26h14"
        stroke="#22d3ee"
        strokeOpacity="0.6"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="1 4"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <path
          d="M68 8l14 5v9c0 10-6 16-14 19-8-3-14-9-14-19v-9z"
          fill="#1e1b4b"
          stroke="#f0abfc"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M62 22l4 4 8-8"
          stroke="#f0abfc"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
}

function DebuggingIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="6"
        y="8"
        width="50"
        height="32"
        rx="4"
        fill="#1e1b4b"
        stroke="#a78bfa"
        strokeWidth="1.6"
      />
      <rect x="6" y="8" width="50" height="32" rx="4" fill="url(#dbg-scan)" fillOpacity="0.08" />
      <defs>
        <linearGradient id="dbg-scan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      <motion.path
        d="M12 28h6l4-10 5 18 4-14 3 6h22"
        stroke="url(#dbg-scan)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <circle cx="70" cy="24" r="10" fill="#2e2a5c" stroke="#22d3ee" strokeWidth="1.8" />
        <path
          d="M66 24h3l1.5-4 2 8 1.5-4h2"
          stroke="#22d3ee"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>
    </svg>
  );
}

export function OpenHoursView({ locationId }: { locationId?: string } = {}) {
  // `demo` itself (a plain isDemo() read, not the SSR-safe useIsDemo()
  // hook) is fine to use in effects/handlers below -- those only ever run
  // client-side. What isn't safe is seeding useState's *initial* value
  // from it directly: isDemo() reads localStorage synchronously, so it
  // resolves differently during the server render pass (no window ->
  // false) than during the client's very first hydration pass (real
  // token -> true), and React throws a real "Hydration failed" the
  // instant that changes a day's Switch/Input's checked/value/disabled
  // attributes (exactly what happened here). Both `schedule` and
  // `loading` below now start at the same neutral value on server and
  // client; the effect fills in the demo seed (or the real fetch)
  // strictly post-mount, which is a normal state update, not a
  // hydration diff.
  const demo = isDemo();
  const [configId, setConfigId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState<BusinessHoursSchedule>({});
  const [closedMessage, setClosedMessage] = useState(
    "We're currently closed. Please check back during business hours.",
  );
  const [isOpenNow, setIsOpenNow] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) {
      setSchedule(DEMO_BH_SCHEDULE);
      setLoading(false);
      return;
    }
    if (!locationId) return;
    let cancelled = false;
    businessHoursService
      .get(locationId)
      .then((cfg) => {
        if (cancelled) return;
        setConfigId(cfg.configId);
        setEnabled(cfg.enabled);
        setSchedule(cfg.schedule);
        setClosedMessage(cfg.closedMessage ?? closedMessage);
        setIsOpenNow(cfg.isOpenNow);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load open hours.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locationId]);

  const dayState = (key: BusinessHoursWeekday): BusinessHoursDay =>
    schedule[key] ?? { open: false };

  const setDay = (key: BusinessHoursWeekday, patch: Partial<BusinessHoursDay>) =>
    setSchedule((prev) => ({ ...prev, [key]: { ...dayState(key), ...patch } }));

  async function handleApply() {
    if (demo) {
      toast.success("Open hours applied");
      return;
    }
    if (!configId) {
      toast.error("No portal config found for this location yet.");
      return;
    }
    // Every "open" day needs real start/end times before saving -- the
    // backend rejects a malformed schedule outright (see the real 400
    // this used to be impossible to trigger, since nothing ever saved).
    for (const { key, label } of BH_DAYS) {
      const d = dayState(key);
      if (d.open && (!d.start || !d.end)) {
        toast.error(`${label}: set both a start and end time, or mark it closed.`);
        return;
      }
    }
    setSaving(true);
    try {
      await businessHoursService.save(configId, {
        enabled,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        schedule,
        closedMessage,
      });
      const refreshed = await businessHoursService.get(locationId!);
      setIsOpenNow(refreshed.isOpenNow);
      toast.success("Open hours applied");
    } catch (err) {
      toast.error((err as AppError).message || "Could not save open hours.");
    } finally {
      setSaving(false);
    }
  }

  // Purely-derived display values (no new fields, no new fetch) -- the KPI
  // tiles below just summarize `schedule`/`enabled`/`isOpenNow`, same as
  // every other view's KpiRow in this file.
  const openDaysCount = BH_DAYS.filter(({ key }) => dayState(key).open).length;
  const liveStatusKnown = !demo && isOpenNow !== null;
  const currentlyOpen = liveStatusKnown ? isOpenNow : null;

  const kpiItems = [
    ...(liveStatusKnown
      ? [
          {
            label: "Right now",
            value: currentlyOpen ? "Open" : "Closed",
            tone: (currentlyOpen ? "success" : "danger") as StatTone,
            icon: currentlyOpen ? Sun : Moon,
          },
        ]
      : []),
    { label: "Days open", value: `${openDaysCount}/7`, tone: "info" as StatTone, icon: Clock },
    {
      label: "Enforced",
      value: enabled ? "On" : "Off",
      tone: (enabled ? "primary" : "default") as StatTone,
      icon: enabled ? CheckCircle2 : XCircle,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FeatureHeader
            title="Open Hours"
            description="Guests can only sign in inside this schedule -- outside it, they see a closed message instead of the portal."
            icon={Sun}
            action={
              <Button size="sm" onClick={handleApply} disabled={loading || saving}>
                {saving ? "Applying…" : "Apply"}
              </Button>
            }
          />
        </div>
        <OpenHoursIllustration />
      </div>

      {!loading && <KpiRow items={kpiItems} />}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Weekly schedule</CardTitle>
          <CardDescription>Tap a day to open it, then set when it starts and ends.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
              {BH_DAYS.map(({ key, label }) => {
                const d = dayState(key);
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex flex-col gap-2.5 rounded-2xl p-3.5 shadow-sm transition-colors",
                      d.open ? "bg-card" : "bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold uppercase",
                            d.open
                              ? "bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {label.slice(0, 2)}
                        </span>
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <Switch checked={d.open} onCheckedChange={(v) => setDay(key, { open: v })} />
                    </div>
                    {d.open ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="time"
                            value={d.start ?? "09:00"}
                            onChange={(e) => setDay(key, { start: e.target.value })}
                            className="h-8 min-w-0 flex-1 px-1.5 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            type="time"
                            value={d.end ?? "18:00"}
                            onChange={(e) => setDay(key, { end: e.target.value })}
                            className="h-8 min-w-0 flex-1 px-1.5 text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setDay(key, { start: "00:00", end: "23:59" })}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Open all day
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Closed all day</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Guest experience</CardTitle>
            <CardDescription>
              What guests see, and how strictly the schedule above is enforced.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1fr_14rem]">
              <div className="space-y-4">
                <label className="flex items-center justify-between gap-4 rounded-xl border-0 bg-muted/40 px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Enforce this schedule</p>
                    <p className="text-xs text-muted-foreground">
                      Outside open hours, guests are shown the closed message below instead of the
                      sign-in page.
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </label>
                <div className="space-y-1.5">
                  <Label className="text-xs">Message shown to guests while closed</Label>
                  <Textarea
                    value={closedMessage}
                    onChange={(e) => setClosedMessage(e.target.value)}
                    placeholder="We're currently closed."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4 shadow-sm">
                <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Guest preview
                </p>
                <div className="rounded-xl bg-card p-4 text-center shadow-sm">
                  <div
                    className={cn(
                      "mx-auto grid h-12 w-12 place-items-center rounded-full",
                      currentlyOpen === false
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
                    )}
                  >
                    {currentlyOpen === false ? (
                      <Moon className="h-6 w-6" />
                    ) : (
                      <Sun className="h-6 w-6" />
                    )}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-foreground">
                    {currentlyOpen === null
                      ? "Preview"
                      : currentlyOpen
                        ? "Open for guests"
                        : "Currently closed"}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    {currentlyOpen === false
                      ? closedMessage.trim() ||
                        "We're currently closed. Please check back during business hours."
                      : "Shown to guests only while the portal is closed."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- Notification ---------- */

/** Channel types a venue owner can actually set up for themselves, with
 * the one config field each needs.
 *
 * The backend's `NotificationChannelType` also has SLACK/TEAMS/DISCORD;
 * those are left out here deliberately rather than forgotten -- they need
 * an incoming-webhook URL created inside a workspace, which is an
 * IT-department task, not something a cafe owner does between orders. They
 * remain available through the operator console's own
 * `NotificationChannelsPanel`.
 *
 * WHATSAPP is deliberately absent for a different and more important
 * reason: the backend's own constants.py calls it "an honest logging-only
 * placeholder" with no real integration behind it. Offering it here would
 * put a switch on a customer's screen that silently delivers nothing --
 * which is the exact failure this whole screen is being rewritten to
 * remove. It comes back when the WhatsApp Business integration is real. */
const CUSTOMER_CHANNEL_TYPES = [
  {
    value: "email",
    label: "Email",
    field: "Email address",
    placeholder: "alerts@yourvenue.com",
    configKey: "to",
    inputType: "email",
  },
  {
    value: "sms",
    label: "SMS",
    field: "Mobile number",
    placeholder: "+91 90000 00000",
    configKey: "to",
    inputType: "tel",
  },
  {
    value: "webhook",
    label: "Webhook",
    field: "POST URL",
    placeholder: "https://example.com/hooks/wyfy",
    configKey: "url",
    inputType: "url",
  },
] as const;

type CustomerChannelType = (typeof CUSTOMER_CHANNEL_TYPES)[number]["value"];

/**
 * Notification preferences: where alerts go, and which rules are live.
 *
 * WHAT THIS REPLACED: every control on this screen used to be a
 * `ToggleRow` holding nothing but its own `useState`, over hardcoded
 * contact strings ("admin@company.com", "+91 •••• •• 4210") that belonged
 * to no one, and a Save button whose entire implementation was
 * `toast.success("Preferences saved")`. There was no fetch, no mutation
 * and no `isDemo()` guard -- so it was fabricated for every account, and a
 * customer who turned "Router offline -> SMS" on got a green success
 * toast and no notification, ever. A customer who turned it *off* still
 * got them. It is the single worst thing the 2026-09-05 audit found,
 * precisely because it looked completely finished.
 *
 * WHAT IT IS NOW: two real surfaces over APIs that already shipped and
 * were, until now, wired only to the operator console.
 *
 *   - Channels are real rows from `GET /notifications/channels`, created
 *     and deleted for real, with the active switch writing
 *     `is_active` through `PUT /notifications/channels/{id}`.
 *   - Events are the organization's real alert rules from
 *     `GET /alerts/rules`; the switch writes `is_active` through
 *     `PUT /alerts/rules/{id}`. These are the same rules whose firing
 *     produces the rows on the Alerts screen and in the header bell, so
 *     what this screen turns off genuinely stops arriving.
 *
 * There is deliberately no Save button any more. Every control commits on
 * change and reports the real outcome; a Save button that batches nothing
 * is how the previous version got away with lying for as long as it did.
 *
 * WHAT IS HONESTLY MISSING: a venue cannot yet author a *new* alert rule
 * here, only enable or disable the ones it has. Rule authoring needs a
 * trigger type, a target component and a threshold config -- a real
 * editor, not a toggle -- and inventing five plausible-sounding event
 * names ("Voucher low balance") over rules that do not exist is what the
 * old screen did. The empty state says so in as many words rather than
 * implying the venue has no alerting.
 */
export function NotificationView() {
  const [demo, setDemo] = useState<boolean | null>(null);
  const [orgId, setOrgId] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState<CustomerChannelType>("email");
  const [newTarget, setNewTarget] = useState("");
  const [creating, setCreating] = useState(false);

  const typeMeta =
    CUSTOMER_CHANNEL_TYPES.find((t) => t.value === newType) ?? CUSTOMER_CHANNEL_TYPES[0];

  // Same neutral-first-paint rule as AlertsView above: `isDemo()` reads a
  // token that exists on the client and not on the server, so seeding
  // state from it in the render body is a real hydration mismatch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isDemo()) {
        if (!cancelled) {
          setDemo(true);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setDemo(false);
      try {
        const org = await resolveOrgId();
        const [channelPage, rulePage] = await Promise.all([
          monitoringService.listNotificationChannels({
            organizationId: org,
            page: 1,
            pageSize: 50,
          }),
          monitoringService.listAlertRules({ organizationId: org, page: 1, pageSize: 50 }),
        ]);
        if (cancelled) return;
        setOrgId(org);
        setChannels(channelPage.items);
        setRules(rulePage.items);
      } catch {
        // An honest failure state. Never a fabricated set of preferences:
        // showing invented toggles here is the bug this screen had.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleChannel(channel: NotificationChannel, next: boolean) {
    setBusyId(channel.id);
    const before = channels;
    setChannels((cs) => cs.map((c) => (c.id === channel.id ? { ...c, isActive: next } : c)));
    try {
      await monitoringService.updateNotificationChannel(channel.id, { isActive: next }, orgId);
      toast.success(next ? `${channel.name} switched on` : `${channel.name} switched off`);
    } catch {
      setChannels(before);
      toast.error(`Could not update ${channel.name}. Nothing was changed.`);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRule(rule: AlertRule, next: boolean) {
    setBusyId(rule.id);
    const before = rules;
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, isActive: next } : r)));
    try {
      await monitoringService.updateAlertRule(rule.id, { isActive: next }, orgId);
      toast.success(next ? `${rule.name} is on` : `${rule.name} is off`);
    } catch {
      setRules(before);
      toast.error(`Could not update ${rule.name}. Nothing was changed.`);
    } finally {
      setBusyId(null);
    }
  }

  async function removeChannel(channel: NotificationChannel) {
    setBusyId(channel.id);
    const before = channels;
    setChannels((cs) => cs.filter((c) => c.id !== channel.id));
    try {
      await monitoringService.deleteNotificationChannel(channel.id, orgId);
      toast.success(`${channel.name} removed`);
    } catch {
      setChannels(before);
      toast.error(`Could not remove ${channel.name}.`);
    } finally {
      setBusyId(null);
    }
  }

  async function createChannel() {
    const target = newTarget.trim();
    if (!target) {
      toast.error(`Enter a ${typeMeta.field.toLowerCase()}.`);
      return;
    }
    setCreating(true);
    try {
      const created = await monitoringService.createNotificationChannel({
        organizationId: orgId,
        channelType: newType as NotificationChannel["channelType"],
        name: `${typeMeta.label} · ${target}`,
        config: { [typeMeta.configKey]: target },
        isActive: true,
      });
      setChannels((cs) => [...cs, created]);
      setAddOpen(false);
      setNewTarget("");
      toast.success(`${typeMeta.label} channel added`);
    } catch (e) {
      toast.error(humanizeApiError(e as AppError, "Could not add that channel."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FeatureHeader
            title="Notifications"
            description="Where alerts are sent, and which ones are switched on. Changes save as you make them."
            icon={Bell}
            action={
              demo === false && !loadError ? (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add channel
                </Button>
              ) : undefined
            }
          />
        </div>
        <NotificationIllustration />
      </div>

      {loading && <LoadingSkeleton rows={4} />}

      {!loading && demo && (
        <EmptyState
          icon={Bell}
          title="Not available on the demo account"
          description="Notification channels and alert rules belong to a real organization, so there is nothing here to show or change. Sign in to a real account to set up where your alerts go."
        />
      )}

      {!loading && demo === false && loadError && (
        <ErrorState
          title="Couldn't load your notification settings"
          description="Your preferences were not changed. Try again in a moment."
        />
      )}

      {!loading && demo === false && !loadError && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Channels</CardTitle>
              <CardDescription className="text-xs">
                Where a notification is delivered when a rule fires.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {channels.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No channels yet"
                  description="Add an email address, a mobile number or a webhook and alerts will start going there."
                />
              ) : (
                channels.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-4 rounded-xl border-0 bg-muted/40 px-4 py-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{c.channelType}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={c.isActive}
                        disabled={busyId === c.id}
                        onCheckedChange={(v) => toggleChannel(c, v)}
                        aria-label={`${c.name} active`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={busyId === c.id}
                        onClick={() => removeChannel(c)}
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Events</CardTitle>
              <CardDescription className="text-xs">
                The alert rules set up for your account. Switching one off stops it firing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {rules.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No alert rules yet"
                  description="Alert rules are set up for your account with our team. Raise a support ticket telling us what you want to be told about, and it will appear here."
                />
              ) : (
                rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 rounded-xl border-0 bg-muted/40 px-4 py-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.description || `${r.severity} · ${r.triggerType}`}
                      </p>
                    </div>
                    <Switch
                      checked={r.isActive}
                      disabled={busyId === r.id}
                      onCheckedChange={(v) => toggleRule(r, v)}
                      aria-label={`${r.name} active`}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a notification channel</DialogTitle>
            <DialogDescription>
              Alerts for your account will be delivered here once it is switched on.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as CustomerChannelType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_CHANNEL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{typeMeta.field}</Label>
              <Input
                type={typeMeta.inputType}
                value={newTarget}
                placeholder={typeMeta.placeholder}
                onChange={(e) => setNewTarget(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createChannel} disabled={creating || !newTarget.trim()}>
              {creating ? "Adding…" : "Add channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Top Up Data ---------- */
export function TopUpView() {
  const packs = [
    { d: "5 GB", p: "₹99", v: "7 days" },
    { d: "20 GB", p: "₹299", v: "30 days" },
    { d: "50 GB", p: "₹599", v: "30 days" },
    { d: "Unlimited", p: "₹999", v: "30 days" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="Top Up Data"
        description="Recharge data balance for a business unit or an individual guest."
      />
      <KpiRow
        items={[
          { label: "Balance", value: "128 GB", tone: "primary", icon: Gauge },
          { label: "Used (month)", value: "412 GB", tone: "info", icon: Activity },
          { label: "Active packs", value: "6", tone: "success", icon: Ticket },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {packs.map((p) => (
          <Card key={p.d} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <p className="text-lg font-semibold">{p.d}</p>
              <p className="text-xs text-muted-foreground">valid {p.v}</p>
              <p className="mt-3 text-2xl font-bold text-primary">{p.p}</p>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => toast.success(`${p.d} pack added`)}
              >
                Top up
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- ISP Details ----------
 * Real per-router WAN uplink model (`app.domains.isp`): an ISP link belongs
 * to a real router, not a fake flat "business unit" list. The customer
 * picks a real router (routerService.listForLocation(), scoped to this
 * location + the session's own org via resolveOrgId() -- routerService's
 * master-console list() fans out across every org via GET /organizations,
 * GLOBAL-scope only, which 403s for an ordinary customer session), then
 * sees/manages that router's real ISP link(s): provider, bandwidth, DNS,
 * priority/role/failover config, and real health-check status written by
 * the isp domain's own 60s Celery sweep (isp_health_checks). All CRUD goes
 * through ispService, which threads X-Organization-Id on every call. */

const LINK_TYPES: { value: string; label: string }[] = [
  { value: "fiber", label: "Fiber" },
  { value: "dsl", label: "DSL" },
  { value: "cable", label: "Cable" },
  { value: "wireless_4g", label: "4G Wireless" },
  { value: "wireless_5g", label: "5G Wireless" },
  { value: "satellite", label: "Satellite" },
  { value: "leased_line", label: "Leased Line" },
  { value: "other", label: "Other" },
];

// The router's own WAN-facing interface this link terminates on --
// informational only (see backend IspLink.interface's own comment), same
// "not branched on internally" scope as LINK_TYPES above. A select of the
// common MikroTik interface names rather than a free-text box -- an admin
// picking from a short, familiar list beats typing a slug from memory,
// and this field was never validated against the router's real interface
// list anyway (this view never contacts the router to fetch one).
const INTERFACE_OPTIONS: { value: string; label: string }[] = [
  { value: "ether1", label: "ether1" },
  { value: "ether2", label: "ether2" },
  { value: "ether3", label: "ether3" },
  { value: "ether4", label: "ether4" },
  { value: "ether5", label: "ether5" },
  { value: "sfp1", label: "sfp1" },
  { value: "wlan1", label: "wlan1" },
  { value: "lte1", label: "lte1 (4G/5G)" },
  { value: "other", label: "Other" },
];

const HEALTH_BADGE: Record<string, { label: string; dot: string; text: string }> = {
  healthy: {
    label: "Online",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  degraded: { label: "Degraded", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  unhealthy: { label: "Offline", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  unknown: { label: "Unknown", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

/** `source` is optional -- callers rendering a bare health-check row (no
 * notion of "current state override") simply omit it. When present and
 * `"manual"`, a small outline tag makes clear this status was an admin's
 * own override, not the real health-check sweep's own reading (see
 * `IspLink.healthStatusSource` / `IspHealthCheck.source`). */
function HealthBadge({ status, source }: { status: string; source?: string }) {
  const b = HEALTH_BADGE[status] ?? HEALTH_BADGE.unknown;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", b.text)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", b.dot)} />
        {b.label}
      </span>
      {source === "manual" && (
        <Badge
          variant="outline"
          className="h-4 px-1 text-[9px] font-normal text-muted-foreground"
          title="Manually set by an admin, not the automated health-check sweep"
        >
          Manual
        </Badge>
      )}
    </span>
  );
}

const TIMELINE_TICK_DOT: Record<string, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  unhealthy: "bg-rose-500",
  unknown: "bg-muted-foreground/30",
};

/** A small, proportionate "up/down over time" visual -- not a historical-
 * uptime analytics system, just the last dozen real `IspHealthCheck` rows
 * (oldest -> newest, left to right) rendered as colored ticks, built
 * entirely from real, persisted history (never computed/fabricated
 * client-side). A manually-set reading (see `HealthBadge`'s own comment)
 * renders with a ring around its tick so it reads as distinct from a real
 * ping. Fetches its own data independently per link/row -- the same
 * "small, self-contained" scope `IspHealthHistoryDialog` above already
 * establishes for a link's own history. */
function IspStatusTimeline({ link, demo }: { link: IspLink; demo: boolean }) {
  const [checks, setChecks] = useState<IspHealthCheck[] | null>(null);
  // Distinguishes "fetched zero rows -- link is genuinely brand new" from
  // "the fetch itself failed" -- both used to render as the exact same
  // "No history yet" caption, which reads as "nothing has happened on this
  // link" when the real cause could be a broken request the customer has
  // no way to tell apart from a real empty history.
  const [fetchFailed, setFetchFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setFetchFailed(false);
    if (demo) {
      const rows: IspHealthCheck[] = (DEMO_HEALTH_HISTORY[link.id] ?? []).map((status, i) => ({
        id: `${link.id}-demo-check-${i}`,
        ispLinkId: link.id,
        checkedAt: new Date(Date.now() - (11 - i) * 5 * 60000).toISOString(),
        status,
        source: "automated",
        latencyMs: null,
        packetLossPercentage: null,
        errorMessage: null,
        // Illustrative-only traffic figures for the demo sparkline below --
        // never fetched from ispService while isDemo() is true.
        downloadMbps: status === "unhealthy" ? null : Math.round((80 + 40 * Math.sin(i)) * 10) / 10,
        uploadMbps: status === "unhealthy" ? null : Math.round((20 + 10 * Math.cos(i)) * 10) / 10,
      }));
      setChecks(rows);
      return;
    }
    setChecks(null);
    ispService
      .listHealthChecks(link.id, { page: 1, pageSize: 12 })
      .then((r) => {
        if (alive) setChecks(r.rows);
      })
      .catch(() => {
        if (alive) {
          setFetchFailed(true);
          setChecks([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [link.id, demo, retryTick]);

  if (checks == null) {
    return (
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="h-4 w-1.5 animate-pulse rounded-sm bg-muted" />
        ))}
      </div>
    );
  }
  if (fetchFailed) {
    return (
      <button
        type="button"
        onClick={() => setRetryTick((n) => n + 1)}
        className="flex items-center gap-1 text-xs text-destructive underline decoration-dotted underline-offset-2 hover:text-destructive/80"
      >
        <AlertTriangle className="h-3 w-3" /> Couldn't load — retry
      </button>
    );
  }
  if (checks.length === 0) {
    return <span className="text-xs text-muted-foreground">No history yet</span>;
  }
  const ordered = [...checks].reverse();
  const hasTraffic = ordered.some((c) => c.downloadMbps != null || c.uploadMbps != null);
  const maxMbps = Math.max(1, ...ordered.flatMap((c) => [c.downloadMbps ?? 0, c.uploadMbps ?? 0]));
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5">
        {/* Each tick's timestamp/status used to be hover-only (the `title`
         * attribute below) -- no help at all on a touch device, where
         * hover doesn't really exist. A click/tap now opens the same
         * detail in a small popover that stays open until dismissed;
         * the `title` stays too, so a desktop mouse-hover still works
         * exactly as before -- purely additive. */}
        {ordered.map((c) => (
          <Popover key={c.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={`${new Date(c.checkedAt).toLocaleString()} — ${HEALTH_BADGE[c.status]?.label ?? c.status}${c.source === "manual" ? " (manually set)" : ""}`}
                className={cn(
                  "h-4 w-1.5 shrink-0 appearance-none rounded-sm border-0 p-0 outline-none transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-ring",
                  TIMELINE_TICK_DOT[c.status] ?? TIMELINE_TICK_DOT.unknown,
                  c.source === "manual" &&
                    "ring-1 ring-foreground/50 ring-offset-1 ring-offset-background",
                )}
              />
            </PopoverTrigger>
            <PopoverContent align="center" className="w-56 space-y-1.5 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {new Date(c.checkedAt).toLocaleString()}
                </span>
                <HealthBadge status={c.status} source={c.source} />
              </div>
              <p className="text-muted-foreground">
                {c.latencyMs != null ? `${c.latencyMs.toFixed(1)} ms` : "No latency reading"}
                {" · "}
                {c.packetLossPercentage != null
                  ? `${c.packetLossPercentage.toFixed(1)}% loss`
                  : "No loss reading"}
              </p>
              {c.errorMessage && (
                <p className="text-rose-600 dark:text-rose-400">{c.errorMessage}</p>
              )}
            </PopoverContent>
          </Popover>
        ))}
      </div>
      {/* Each tick's own timestamp was previously hover-only (the `title`
       * above) -- a real operator watching this after a disconnect had no
       * visible sense of *when* this window of checks actually spans
       * without hovering each bar one at a time. A range caption under the
       * ticks (oldest -> newest, same relative-time formatting the "Last
       * Checked" column already uses) gives that at a glance. */}
      <p className="text-[10px] leading-none text-muted-foreground">
        {timeAgo(ordered[0].checkedAt)} → {timeAgo(ordered[ordered.length - 1].checkedAt)}
      </p>
      {/* Traffic load -- real IspHealthCheck.downloadMbps/uploadMbps rows
       * (the exact same fetch above, never a second call), rendered as a
       * compact two-tone sparkline: download (teal) over upload (violet),
       * height proportional to this window's own max Mbps. Nothing to
       * show (a tick with no computed rate yet) renders as a bare dot,
       * never a fabricated bar. */}
      {hasTraffic && (
        <div
          className="flex h-3 items-end gap-0.5"
          title="Traffic load — download (teal) / upload (violet)"
        >
          {ordered.map((c) => (
            <span
              key={`${c.id}-traffic`}
              className="flex h-3 w-1.5 flex-col-reverse items-center gap-px"
            >
              <span
                className="w-full rounded-sm bg-teal-500/70"
                style={{
                  height:
                    c.downloadMbps != null
                      ? `${Math.max(15, (c.downloadMbps / maxMbps) * 100)}%`
                      : "2px",
                }}
                title={
                  c.downloadMbps != null
                    ? `${c.downloadMbps.toFixed(1)} Mbps down`
                    : "No traffic reading yet"
                }
              />
              <span
                className="w-full rounded-sm bg-violet-500/70"
                style={{
                  height:
                    c.uploadMbps != null
                      ? `${Math.max(15, (c.uploadMbps / maxMbps) * 100)}%`
                      : "2px",
                }}
                title={
                  c.uploadMbps != null
                    ? `${c.uploadMbps.toFixed(1)} Mbps up`
                    : "No traffic reading yet"
                }
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface IspLinkFormState {
  providerName: string;
  linkType: string;
  connectionMode: IspConnectionMode;
  role: IspLinkRole;
  priority: number;
  interfaceName: string;
  gatewayIpAddress: string;
  dnsPrimary: string;
  dnsSecondary: string;
  downloadBandwidthMbps: string;
  uploadBandwidthMbps: string;
  autoFailback: boolean;
}
const emptyLinkForm = (): IspLinkFormState => ({
  providerName: "",
  linkType: "fiber",
  connectionMode: "static",
  role: "primary",
  priority: 0,
  interfaceName: "",
  gatewayIpAddress: "",
  dnsPrimary: "",
  dnsSecondary: "",
  downloadBandwidthMbps: "",
  uploadBandwidthMbps: "",
  autoFailback: true,
});

// Illustrative-only, entirely local demo fixture -- the demo session's
// token never authenticates against the real backend (see
// router.service.ts's own DEMO_ROUTERS comment), so this view never calls
// routerService/ispService while isDemo() is true, mirroring every other
// rebuilt customer view's (MacAuthView, WhiteList, CreateGroup) identical
// demo/real split.
const DEMO_ROUTER: RouterDevice = {
  id: "router-demo-isp",
  locationId: "demo-location",
  locationName: "Demo Location",
  organizationId: "org-demo",
  organizationName: "Demo Org",
  name: "DEMO-EDGE-01",
  serialNumber: "SN-DEMO-ISP",
  macAddress: "AA:BB:CC:DD:EE:FF",
  model: "RB5009UG+S+",
  vendor: "MikroTik",
  routerOsVersion: "7.14",
  managementIpAddress: "10.20.0.1",
  publicIpAddress: "203.0.113.20",
  status: "online",
  lastSeenAt: new Date().toISOString(),
  lastHealthCheckAt: new Date().toISOString(),
  healthStatus: "healthy",
  hasApiCredentials: true,
  settings: {},
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  updatedAt: new Date().toISOString(),
};
const DEMO_LINKS: IspLink[] = [
  {
    id: "isp-demo-1",
    routerId: DEMO_ROUTER.id,
    organizationId: "org-demo",
    locationId: "demo-location",
    providerName: "Airtel",
    linkType: "fiber",
    connectionMode: "static",
    role: "primary",
    isActiveUplink: true,
    autoFailback: true,
    isEnabled: true,
    priority: 0,
    interface: "ether1",
    gatewayIpAddress: "203.0.113.1",
    dnsPrimary: "1.1.1.1",
    dnsSecondary: "8.8.8.8",
    downloadBandwidthMbps: 500,
    uploadBandwidthMbps: 200,
    healthStatus: "healthy",
    healthStatusSource: "automated",
    unhealthySince: null,
    latencyMs: 12.4,
    packetLossPercentage: 0,
    currentDownloadMbps: 118.2,
    currentUploadMbps: 24.6,
    lastCheckedAt: new Date().toISOString(),
    consecutiveUnhealthyCount: 0,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "isp-demo-2",
    routerId: DEMO_ROUTER.id,
    organizationId: "org-demo",
    locationId: "demo-location",
    providerName: "Jio",
    linkType: "wireless_4g",
    connectionMode: "dhcp",
    role: "backup",
    isActiveUplink: false,
    autoFailback: true,
    isEnabled: true,
    priority: 1,
    interface: "lte1",
    gatewayIpAddress: "203.0.113.9",
    dnsPrimary: "1.1.1.1",
    dnsSecondary: null,
    downloadBandwidthMbps: 100,
    uploadBandwidthMbps: 40,
    healthStatus: "degraded",
    healthStatusSource: "automated",
    unhealthySince: null,
    latencyMs: 89.1,
    packetLossPercentage: 3.2,
    currentDownloadMbps: 31.5,
    currentUploadMbps: 8.1,
    lastCheckedAt: new Date().toISOString(),
    consecutiveUnhealthyCount: 0,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

// Small, deterministic local fixture backing IspStatusTimeline's demo-mode
// rendering -- the demo session never calls ispService (see DEMO_ROUTER's
// own comment above), so the timeline's last-12-checks sparkline needs its
// own illustrative-only history rather than a real /health-checks call.
const DEMO_HEALTH_HISTORY: Record<string, string[]> = {
  "isp-demo-1": [
    "healthy",
    "healthy",
    "healthy",
    "healthy",
    "healthy",
    "healthy",
    "degraded",
    "healthy",
    "healthy",
    "healthy",
    "healthy",
    "healthy",
  ],
  "isp-demo-2": [
    "degraded",
    "degraded",
    "healthy",
    "healthy",
    "degraded",
    "unhealthy",
    "degraded",
    "healthy",
    "degraded",
    "healthy",
    "degraded",
    "degraded",
  ],
};

function IspLinkDialog({
  open,
  onOpenChange,
  editing,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: IspLink | null;
  saving: boolean;
  onSave: (form: IspLinkFormState) => void;
}) {
  const [form, setForm] = useState<IspLinkFormState>(emptyLinkForm());
  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            providerName: editing.providerName,
            linkType: editing.linkType,
            connectionMode: editing.connectionMode,
            role: editing.role,
            priority: editing.priority,
            interfaceName: editing.interface ?? "",
            gatewayIpAddress: editing.gatewayIpAddress ?? "",
            dnsPrimary: editing.dnsPrimary ?? "",
            dnsSecondary: editing.dnsSecondary ?? "",
            downloadBandwidthMbps:
              editing.downloadBandwidthMbps != null ? String(editing.downloadBandwidthMbps) : "",
            uploadBandwidthMbps:
              editing.uploadBandwidthMbps != null ? String(editing.uploadBandwidthMbps) : "",
            autoFailback: editing.autoFailback,
          }
        : emptyLinkForm(),
    );
  }, [open, editing]);

  const valid = form.providerName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit ISP Link" : "Add ISP Link"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this router's WAN uplink."
              : "Add a new WAN uplink for the selected router."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Internet Provider *</Label>
              <Input
                placeholder="e.g. Airtel"
                value={form.providerName}
                onChange={(e) => setForm({ ...form, providerName: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Link Type</Label>
              <Select
                value={form.linkType}
                onValueChange={(v) => setForm({ ...form, linkType: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as IspLinkRole })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Priority</Label>
              <Input
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: +e.target.value || 0 })}
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Connection Type</Label>
            <Select
              value={form.connectionMode}
              onValueChange={(v) => setForm({ ...form, connectionMode: v as IspConnectionMode })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Static IP</SelectItem>
                <SelectItem value="dhcp">DHCP Client</SelectItem>
                <SelectItem value="pppoe">PPPoE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">
                Interface{form.connectionMode === "pppoe" && " *"}
              </Label>
              <Select
                value={form.interfaceName}
                onValueChange={(v) => setForm({ ...form, interfaceName: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select interface" />
                </SelectTrigger>
                <SelectContent>
                  {INTERFACE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.connectionMode === "pppoe" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  This interface's own connection state is the health signal for PPPoE.
                </p>
              )}
            </div>
            {form.connectionMode === "static" ? (
              <div>
                <Label className="mb-1 block text-xs">Gateway IP (optional)</Label>
                <Input
                  placeholder="203.0.113.1"
                  value={form.gatewayIpAddress}
                  onChange={(e) => setForm({ ...form, gatewayIpAddress: e.target.value })}
                  className="h-9 font-mono"
                />
              </div>
            ) : (
              <div>
                <Label className="mb-1 block text-xs">Gateway IP</Label>
                <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-[11px] text-muted-foreground">
                  {form.connectionMode === "dhcp"
                    ? "Detected automatically from the router's live DHCP lease"
                    : "Not applicable for PPPoE"}
                </div>
              </div>
            )}
          </div>
          {/* Plan Bandwidth / DNS -- both were already fully wired
              (form state, edit prefill, save payload, and even a table
              column reading them back) but had no actual input in this
              dialog, so there was never a way to set either one (bug
              report: "actual edit ke liye mechanism hai nahi" -- the
              Bandwidth Utilization dashboard card's own "Set it →" link
              landed here and found nothing to fill in). */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Plan Download Speed (Mbps, optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 100"
                value={form.downloadBandwidthMbps}
                onChange={(e) => setForm({ ...form, downloadBandwidthMbps: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Plan Upload Speed (Mbps, optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 20"
                value={form.uploadBandwidthMbps}
                onChange={(e) => setForm({ ...form, uploadBandwidthMbps: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Whatever your ISP advertises for this plan — not independently measured, so utilization
            % is only as accurate as this number.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Primary DNS (optional)</Label>
              <Input
                placeholder="1.1.1.1"
                value={form.dnsPrimary}
                onChange={(e) => setForm({ ...form, dnsPrimary: e.target.value })}
                className="h-9 font-mono"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Secondary DNS (optional)</Label>
              <Input
                placeholder="8.8.8.8"
                value={form.dnsSecondary}
                onChange={(e) => setForm({ ...form, dnsSecondary: e.target.value })}
                className="h-9 font-mono"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form)}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Range picker for the history dialog below -- real, backend-enforced date
// windows (start/end sent straight to ispService.listHealthChecks /
// getHealthCheckSummary as start_date/end_date), not a client-side slice
// of an already-fetched page. 30 days is the founder-requested cap; at the
// sweep's real 60-second cadence that's ~43k rows per link, which is
// exactly why the chart below renders the backend's own bucketed summary
// (hourly/daily aggregates) rather than one bar per raw check.
const HISTORY_RANGES: { value: "24h" | "7d" | "30d"; label: string; hours: number }[] = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
];

/** Uptime-percentage -> bar color, same emerald/amber/rose vocabulary as
 * HEALTH_BADGE/TIMELINE_TICK_DOT elsewhere in this view. */
function bucketColor(uptime: number): string {
  if (uptime >= 99.5) return "#10b981"; // emerald-500
  if (uptime >= 90) return "#f59e0b"; // amber-500
  return "#f43f5e"; // rose-500
}

function formatBucketLabel(iso: string, unit: "hour" | "day"): string {
  const d = new Date(iso);
  return unit === "day"
    ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function IspHealthHistoryDialog({
  linkId,
  open,
  onOpenChange,
}: {
  linkId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  // Which chart the bucketed data below renders as -- two views over the
  // exact same `summary.buckets` fetch, never a second network call.
  // "Bandwidth" backs the founder's own "look back and see WHEN a
  // bandwidth choke happened" ask, using the same avg/max Mbps aggregates
  // IspHealthCheckBucketResponse now carries alongside uptime/latency.
  const [view, setView] = useState<"uptime" | "bandwidth">("uptime");
  const [checks, setChecks] = useState<IspHealthCheck[]>([]);
  const [summary, setSummary] = useState<IspHealthCheckSummary | null>(null);
  const [loading, setLoading] = useState(false);
  // Distinguishes a real "nothing recorded in this range yet" (buckets ==
  // 0 because the sweep genuinely hasn't run/found anything) from the
  // fetch itself failing -- the two used to render identically, including
  // copy telling the customer "the next sweep runs within 60 seconds",
  // which is actively wrong advice when the real problem is a broken
  // request that a 60-second wait will never fix.
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // Back to the default range/view every time the dialog closes, so
  // reopening it (possibly for a different link) never starts on a stale
  // selection.
  useEffect(() => {
    if (!open) {
      setRange("24h");
      setView("uptime");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !linkId) return;
    let alive = true;
    setLoading(true);
    setError(false);
    const hours = HISTORY_RANGES.find((r) => r.value === range)?.hours ?? 24;
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - hours * 3600_000).toISOString();
    Promise.all([
      // The raw, individual-row list below the chart -- always just the
      // most recent page (10 rows) *within the selected range*, never
      // every row in a 7/30-day window.
      ispService.listHealthChecks(linkId, { page: 1, pageSize: 10, startDate, endDate }),
      ispService.getHealthCheckSummary(linkId, { startDate, endDate }),
    ])
      .then(([list, sum]) => {
        if (!alive) return;
        setChecks(list.rows);
        setSummary(sum);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setChecks([]);
        setSummary(null);
        toast.error("Could not load health-check history.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, linkId, range, retryTick]);

  const buckets = summary?.buckets ?? [];
  const totalChecksInRange = buckets.reduce((sum, b) => sum + b.totalChecks, 0);
  const overallUptime =
    totalChecksInRange > 0
      ? (100 * buckets.reduce((sum, b) => sum + (b.totalChecks - b.unhealthyCount), 0)) /
        totalChecksInRange
      : null;
  const chartData = summary
    ? buckets.map((b) => ({
        label: formatBucketLabel(b.bucketStart, summary.bucketUnit),
        uptime: b.uptimePercentage ?? 0,
      }))
    : [];
  // Never a fabricated 0 for a bucket where every check in that window
  // failed to produce a traffic sample -- avgDownloadMbps/avgUploadMbps
  // stay `null` straight through, so Recharts (connectNulls={false})
  // draws a real gap there instead of a false flatline to zero.
  const bandwidthData = summary
    ? buckets.map((b) => ({
        label: formatBucketLabel(b.bucketStart, summary.bucketUnit),
        avgDownload: b.avgDownloadMbps,
        avgUpload: b.avgUploadMbps,
      }))
    : [];
  const hasBandwidthData = buckets.some(
    (b) => b.avgDownloadMbps != null || b.avgUploadMbps != null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Health History</DialogTitle>
          <DialogDescription>
            {view === "uptime"
              ? overallUptime != null
                ? `${overallUptime.toFixed(1)}% uptime across ${totalChecksInRange.toLocaleString()} checks in the selected range.`
                : "Real /tool/ping results from this link's scheduled health-check sweep."
              : "Real traffic-load Mbps, averaged per bucket from this link's scheduled health-check sweep -- look back to see when a bandwidth choke happened."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                range === r.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Uptime vs. Bandwidth -- two views over the same bucketed fetch
         * above, not a second range picker. */}
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
          {(["uptime", "bandwidth"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 font-medium capitalize transition-colors",
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : error ? (
          <ErrorState
            title="Couldn't load this history"
            description="Something went wrong fetching health-check history for this link -- your connection or our servers, not the link itself."
            onRetry={() => setRetryTick((n) => n + 1)}
          />
        ) : buckets.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No health checks recorded yet in this range -- the next sweep runs within 60 seconds, or
            trigger one manually.
          </p>
        ) : view === "uptime" ? (
          <div className="space-y-1">
            {/* Bucketed uptime chart -- backend-aggregated (hourly for 24h/
             * 7d, daily for 30d; see IspService.get_health_check_summary),
             * never one bar per raw check. */}
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted-foreground)"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted-foreground)"
                    width={32}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                      padding: "8px 10px",
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "Uptime"]}
                  />
                  <Bar dataKey="uptime" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={bucketColor(d.uptime)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[10px] text-muted-foreground">
              {summary?.bucketUnit === "day" ? "Daily" : "Hourly"} uptime buckets,{" "}
              {new Date(summary!.start).toLocaleDateString()} →{" "}
              {new Date(summary!.end).toLocaleDateString()}
            </p>
          </div>
        ) : !hasBandwidthData ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No bandwidth samples recorded in this range yet -- a traffic reading needs a successful
            health check to compute from.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Bucketed bandwidth chart -- same SQL-side aggregation as the
             * uptime chart above, AVG(download_mbps)/AVG(upload_mbps) per
             * bucket (see IspRepository.bucketed_health_checks_for_link). */}
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bandwidthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hist-bw-down" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="hist-bw-up" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted-foreground)"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted-foreground)"
                    width={32}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                      padding: "8px 10px",
                    }}
                    formatter={(
                      value: number | string | Array<number | string> | undefined,
                      name: string | number,
                    ) => [
                      typeof value !== "number" ? "No reading" : `${value.toFixed(1)} Mbps`,
                      name === "avgDownload" ? "Avg Download" : "Avg Upload",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgDownload"
                    name="avgDownload"
                    stroke="#14b8a6"
                    fill="url(#hist-bw-down)"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgUpload"
                    name="avgUpload"
                    stroke="#8b5cf6"
                    fill="url(#hist-bw-up)"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[10px] text-muted-foreground">
              Avg Mbps per {summary?.bucketUnit === "day" ? "day" : "hour"},{" "}
              {new Date(summary!.start).toLocaleDateString()} →{" "}
              {new Date(summary!.end).toLocaleDateString()}
            </p>
          </div>
        )}

        {!error && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Most recent checks in this range
            </p>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {loading ? (
                <LoadingSkeleton rows={2} />
              ) : checks.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No individual checks to show.
                </p>
              ) : (
                checks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <HealthBadge status={c.status} source={c.source} />
                      <span className="text-muted-foreground">
                        {new Date(c.checkedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right text-muted-foreground">
                      {c.latencyMs != null ? `${c.latencyMs.toFixed(1)} ms` : "—"} ·{" "}
                      {c.packetLossPercentage != null
                        ? `${c.packetLossPercentage.toFixed(1)}% loss`
                        : "—"}
                      {c.errorMessage && (
                        <p className="mt-0.5 text-rose-600 dark:text-rose-400">{c.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface IspRuleFormState {
  ispLinkId: string;
  ruleType: IspRoutingRuleType;
  name: string;
  description: string;
  priority: number;
  matchValue: string;
  isEnabled: boolean;
}
const emptyRuleForm = (defaultLinkId: string): IspRuleFormState => ({
  ispLinkId: defaultLinkId,
  ruleType: "vlan",
  name: "",
  description: "",
  priority: 0,
  matchValue: "",
  isEnabled: true,
});

/** Create/edit dialog for a routing rule, merged in from the former
 * "Internet Failover" page's own rule dialog (IspManagement.tsx's
 * RuleDialog) -- same real ispService.*RoutingRule endpoints, same
 * rule-type vocabulary (RULE_TYPES/matchFieldLabel/matchValueFromRule
 * imported from that file rather than re-derived), just a plain-state
 * form matching this view's own IspLinkDialog above instead of a second
 * react-hook-form+zod stack. */
function IspRuleDialog({
  open,
  onOpenChange,
  editing,
  links,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: IspRoutingRule | null;
  links: IspLink[];
  saving: boolean;
  onSave: (form: IspRuleFormState) => void;
}) {
  const [form, setForm] = useState<IspRuleFormState>(emptyRuleForm(links[0]?.id ?? ""));
  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            ispLinkId: editing.ispLinkId,
            ruleType: editing.ruleType,
            name: editing.name,
            description: editing.description ?? "",
            priority: editing.priority,
            matchValue: matchValueFromRule(editing),
            isEnabled: editing.isEnabled,
          }
        : emptyRuleForm(links[0]?.id ?? ""),
    );
  }, [open, editing, links]);

  const valid =
    form.name.trim().length > 0 && form.ispLinkId.length > 0 && form.matchValue.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Routing Rule" : "New Routing Rule"}</DialogTitle>
          <DialogDescription>Pin matching traffic to a specific uplink.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs">Name</Label>
            <Input
              placeholder="VLAN 20 via secondary uplink"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Uplink</Label>
              <Select
                value={form.ispLinkId}
                onValueChange={(v) => setForm({ ...form, ispLinkId: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select uplink" />
                </SelectTrigger>
                <SelectContent>
                  {links.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.providerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Rule Type</Label>
              <Select
                value={form.ruleType}
                onValueChange={(v) =>
                  setForm({ ...form, ruleType: v as IspRoutingRuleType, matchValue: "" })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs">{matchFieldLabel(form.ruleType)}</Label>
            <Input
              className="h-9 font-mono"
              value={form.matchValue}
              onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Priority</Label>
              <Input
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: +e.target.value || 0 })}
                className="h-9"
              />
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
                <div className="text-sm font-medium">Enabled</div>
                <Switch
                  checked={form.isEnabled}
                  onCheckedChange={(v) => setForm({ ...form, isEnabled: v })}
                />
              </div>
            )}
          </div>
          <div>
            <Label className="mb-1 block text-xs">Description (optional)</Label>
            <Input
              placeholder="Notes…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form)}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** On-demand "Run Speed Test" state, keyed per-link -- a genuine RouterOS
 * `/tool/fetch` download against that link's own router
 * (`ispService.runSpeedTest`), never a simulated number. See
 * `IspSpeedTestResult`'s own doc comment for why `uploadMbps` is always
 * null. */
type SpeedTestState =
  | { status: "running" }
  | { status: "done"; result: IspSpeedTestResult }
  | { status: "error"; message: string };

export function IspDetailsView({ locationId }: { locationId?: string }) {
  const demo = isDemo();
  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [routersLoading, setRoutersLoading] = useState(true);
  // Distinguishes "the fetch failed" from "there are genuinely zero
  // routers/links yet" -- both used to render the exact same EmptyState
  // ("No routers provisioned" / "No ISP link configured"), which nudges a
  // customer toward "provision a router" / "Add ISP Link" even when the
  // real cause is a broken request that adding a link can't fix.
  const [routersError, setRoutersError] = useState(false);
  const [routersRetryTick, setRoutersRetryTick] = useState(0);
  const [selectedRouterId, setSelectedRouterId] = useState("");
  const [links, setLinks] = useState<IspLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<IspLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  // Per-link so testing the backup uplink never clobbers a still-fresh
  // primary result (or vice versa) -- a location can genuinely have more
  // than one ISP link, and this must work for each independently.
  const [speedTests, setSpeedTests] = useState<Record<string, SpeedTestState>>({});
  const [historyLinkId, setHistoryLinkId] = useState<string | null>(null);
  // Routing rules + failover/failback -- merged in from the former separate
  // "Internet Failover" nav item (isp-routing -> IspManagement.tsx), which
  // used to make a customer navigate to a second page for exactly the same
  // per-router ISP links this view already shows. Same real backend
  // (ispService.triggerFailover/triggerFailback/listRoutingRules/etc, see
  // that service's own comments) -- only the frontend surface changed.
  const [rules, setRules] = useState<IspRoutingRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IspRoutingRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [failoverBusy, setFailoverBusy] = useState<"failover" | "failback" | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRoutersLoading(true);
      setRoutersError(false);
      try {
        const rows = demo
          ? [DEMO_ROUTER]
          : locationId
            ? await routerService.listForLocation(locationId, await resolveOrgId())
            : [];
        if (!alive) return;
        setRouters(rows);
        setSelectedRouterId((prev) =>
          prev && rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? ""),
        );
      } catch {
        if (!alive) return;
        setRoutersError(true);
        setRouters([]);
        toast.error("Could not load routers for this location.");
      } finally {
        if (alive) setRoutersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [locationId, demo, routersRetryTick]);

  // `quiet` backs the auto-refresh poll below: a background refetch
  // shouldn't flash the table into its loading-skeleton state every 20
  // seconds, and a transient failure on one poll tick shouldn't spam an
  // error toast -- the table just keeps showing its last known-good
  // state until the next successful tick.
  const loadLinks = async (routerId: string, opts: { quiet?: boolean } = {}) => {
    if (!routerId) {
      setLinks([]);
      setLinksError(false);
      return;
    }
    if (!opts.quiet) {
      setLinksLoading(true);
      setLinksError(false);
    }
    try {
      if (demo) {
        setLinks(routerId === DEMO_ROUTER.id ? DEMO_LINKS : []);
      } else {
        const result = await ispService.listLinks({ routerId, page: 1, pageSize: 25 });
        setLinks(result.rows);
      }
      if (!opts.quiet) setLinksError(false);
    } catch {
      // A quiet (background poll) failure keeps showing the last known-
      // good `links`/`linksError` state rather than flipping the table
      // into an error banner over one transient blip -- same
      // no-toast-spam intent this poll already documents above.
      if (!opts.quiet) {
        setLinksError(true);
        toast.error("Could not load ISP links for this router.");
        setLinks([]);
      }
    } finally {
      if (!opts.quiet) setLinksLoading(false);
    }
  };

  useEffect(() => {
    loadLinks(selectedRouterId); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selectedRouterId, demo]);

  // Auto-refresh -- an operator previously had to manually reload the
  // whole page to see a link flip healthy/unhealthy after the backend's
  // own 60-second sweep updates it server-side (real, verified live: a
  // WAN disconnect on a real test router correctly flips this table's
  // health status within ~60-90s of the backend's own check). A plain
  // `setInterval` poll -- this file's own established useEffect/useState
  // fetching pattern, no React Query/websocket infra anywhere in this
  // view -- re-fetches this router's links every 20s while the tab is
  // visible, paused via the Page Visibility API while backgrounded so a
  // minimized/unfocused tab doesn't keep hammering the API for nothing.
  const checkingIdRef = useRef(checkingId);
  const statusBusyIdRef = useRef(statusBusyId);
  useEffect(() => {
    checkingIdRef.current = checkingId;
  }, [checkingId]);
  useEffect(() => {
    statusBusyIdRef.current = statusBusyId;
  }, [statusBusyId]);

  const ISP_LINKS_POLL_INTERVAL_MS = 20_000;
  useEffect(() => {
    if (demo || !selectedRouterId) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      // Skip a tick that lands mid-manual-action ("Check health now" /
      // Mark Up / Mark Down) -- that action's own response already
      // updates `links` with the freshest state; a same-moment poll
      // re-fetch racing it could otherwise clobber it right back with a
      // response that started before the manual write landed.
      if (checkingIdRef.current != null || statusBusyIdRef.current != null) return;
      loadLinks(selectedRouterId, { quiet: true });
    };
    const start = () => {
      if (timer == null) timer = setInterval(tick, ISP_LINKS_POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Catch up immediately on refocus instead of waiting out
        // whatever's left of the interval, then resume the normal cadence.
        tick();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouterId, demo]);

  const loadRules = async (routerId: string) => {
    if (!routerId) {
      setRules([]);
      return;
    }
    setRulesLoading(true);
    try {
      // No demo fixture for routing rules -- the demo session never calls
      // ispService at all (see DEMO_ROUTER's own comment above), so demo
      // mode just shows the real "no rules yet" empty state.
      const result = demo
        ? { rows: [] }
        : await ispService.listRoutingRules({ routerId, page: 1, pageSize: 25 });
      setRules(result.rows);
    } catch {
      toast.error("Could not load routing rules for this router.");
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    loadRules(selectedRouterId); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selectedRouterId, demo]);

  const selectedRouter = routers.find((r) => r.id === selectedRouterId) ?? null;

  const openCreate = () => {
    setEditingLink(null);
    setDialogOpen(true);
  };
  const openEdit = (link: IspLink) => {
    setEditingLink(link);
    setDialogOpen(true);
  };

  const saveLink = async (form: IspLinkFormState) => {
    if (demo) {
      toast.error("Sign in to a real account to manage ISP links.");
      return;
    }
    if (!selectedRouterId) return;
    setSaving(true);
    try {
      const payload = {
        routerId: selectedRouterId,
        providerName: form.providerName.trim(),
        linkType: form.linkType,
        connectionMode: form.connectionMode,
        role: form.role,
        priority: form.priority,
        interface: form.interfaceName.trim() || null,
        // Only a STATIC link ever has a manually-entered gateway -- DHCP
        // resolves it live every check, PPPoE has no gateway concept at
        // all (see backend IspService.ping_link's own docstring), so
        // never send a stale/hidden-field value for either.
        gatewayIpAddress:
          form.connectionMode === "static" ? form.gatewayIpAddress.trim() || null : null,
        dnsPrimary: form.dnsPrimary.trim() || null,
        dnsSecondary: form.dnsSecondary.trim() || null,
        downloadBandwidthMbps: form.downloadBandwidthMbps ? +form.downloadBandwidthMbps : null,
        uploadBandwidthMbps: form.uploadBandwidthMbps ? +form.uploadBandwidthMbps : null,
        autoFailback: form.autoFailback,
      };
      if (editingLink) {
        const updated = await ispService.updateLink(editingLink.id, payload);
        setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
        toast.success("ISP link updated");
      } else {
        const created = await ispService.createLink(payload);
        setLinks((ls) => [created, ...ls]);
        toast.success("ISP link added");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not save the ISP link."));
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (link: IspLink) => {
    if (demo) {
      toast.error("Sign in to a real account to manage ISP links.");
      return;
    }
    setLinks((ls) => ls.filter((l) => l.id !== link.id));
    try {
      await ispService.removeLink(link.id);
      toast.success("ISP link removed");
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not remove the ISP link."));
      setLinks((ls) => [link, ...ls]);
    }
  };

  const checkHealth = async (link: IspLink) => {
    if (demo) {
      toast.info("Health checks run against real router hardware -- not available in demo mode.");
      return;
    }
    setCheckingId(link.id);
    try {
      const updated = await ispService.checkLinkHealth(link.id);
      setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
      toast.success(
        `Health check complete — ${HEALTH_BADGE[updated.healthStatus]?.label ?? updated.healthStatus}`,
      );
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Health check failed."));
    } finally {
      setCheckingId(null);
    }
  };

  // A real, on-demand, multi-second action: a genuine RouterOS
  // /tool/fetch download against this link's own router plus a real ping
  // for latency (see backend IspService.run_speed_test's own docstring).
  // Never fabricated -- if the real device action fails, this surfaces
  // that failure honestly rather than showing a number.
  const runSpeedTest = async (link: IspLink) => {
    if (demo) {
      toast.info("Speed tests run against real router hardware -- not available in demo mode.");
      return;
    }
    setSpeedTests((s) => ({ ...s, [link.id]: { status: "running" } }));
    try {
      const result = await ispService.runSpeedTest(link.id);
      setSpeedTests((s) => ({ ...s, [link.id]: { status: "done", result } }));
    } catch (err) {
      const message = humanizeApiError(err as AppError, "Speed test failed.");
      setSpeedTests((s) => ({ ...s, [link.id]: { status: "error", message } }));
      toast.error(message);
    }
  };

  // An admin's own manual up/down override of a link's current status --
  // the one real write this view offers beyond the pre-existing CRUD/
  // failover/failback (never pushes anything to the router; see
  // ispService.setManualStatus's own comment). The very next automated
  // health check (sweep or "Check health now") reclaims the link back to
  // its real, sweep-driven status regardless of this override.
  const setLinkManualStatus = async (link: IspLink, healthStatus: IspManualHealthStatus) => {
    if (demo) {
      toast.info("Manual status overrides aren't available in demo mode.");
      return;
    }
    setStatusBusyId(link.id);
    try {
      const updated = await ispService.setManualStatus(link.id, healthStatus);
      setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
      toast.success(`${link.providerName} marked ${healthStatus === "healthy" ? "Up" : "Down"}`);
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not update ISP link status."));
    } finally {
      setStatusBusyId(null);
    }
  };

  // Failover/failback triggers -- merged in from the former separate
  // "Internet Failover" nav item/page (isp-routing). Router-scoped (a
  // failover switches *this router's* active uplink among its own links),
  // same as the uplinks/rules tables above are already scoped to
  // `selectedRouterId`. Real backend calls (`IspService.trigger_failover`/
  // `trigger_failback`), not a client-side toggle of `isActiveUplink`.
  const triggerFailover = async () => {
    if (demo) {
      toast.info("Failover runs against real router hardware -- not available in demo mode.");
      return;
    }
    if (!selectedRouterId) return;
    setFailoverBusy("failover");
    try {
      await ispService.triggerFailover(selectedRouterId);
      await loadLinks(selectedRouterId);
      toast.success("Failover triggered");
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Failover failed"));
    } finally {
      setFailoverBusy(null);
    }
  };

  const triggerFailback = async () => {
    if (demo) {
      toast.info("Failback runs against real router hardware -- not available in demo mode.");
      return;
    }
    if (!selectedRouterId) return;
    setFailoverBusy("failback");
    try {
      await ispService.triggerFailback(selectedRouterId);
      await loadLinks(selectedRouterId);
      toast.success("Failback triggered");
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Failback failed"));
    } finally {
      setFailoverBusy(null);
    }
  };

  // Routing rules -- also merged in from the former "Internet Failover"
  // page, same real ispService.*RoutingRule endpoints IspManagement.tsx's
  // own rule table already used (see that file's own RULE_TYPES/
  // matchFieldLabel/matchValueFromRule, reused here rather than
  // re-derived).
  const openCreateRule = () => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  };
  const openEditRule = (r: IspRoutingRule) => {
    setEditingRule(r);
    setRuleDialogOpen(true);
  };

  const saveRule = async (form: IspRuleFormState) => {
    if (demo) {
      toast.error("Sign in to a real account to manage routing rules.");
      return;
    }
    if (!selectedRouterId) return;
    setSavingRule(true);
    try {
      const matchFields = {
        vlanId: form.ruleType === "vlan" ? Number(form.matchValue) : null,
        sourceMacAddress: form.ruleType === "user" ? form.matchValue : null,
        ipAddress: form.ruleType === "ip" ? form.matchValue : null,
        sourceCidr: form.ruleType === "source" ? form.matchValue : null,
        interfaceName: form.ruleType === "interface" ? form.matchValue : null,
        policyId: form.ruleType === "policy" ? form.matchValue : null,
      };
      const shared = {
        ispLinkId: form.ispLinkId,
        ruleType: form.ruleType,
        name: form.name.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        ...matchFields,
      };
      if (editingRule) {
        const updated = await ispService.updateRoutingRule(editingRule.id, {
          ...shared,
          isEnabled: form.isEnabled,
        });
        setRules((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
        toast.success("Routing rule updated");
      } else {
        const created = await ispService.createRoutingRule({
          routerId: selectedRouterId,
          ...shared,
        });
        setRules((rs) => [created, ...rs]);
        toast.success("Routing rule added");
      }
      setRuleDialogOpen(false);
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not save the routing rule."));
    } finally {
      setSavingRule(false);
    }
  };

  const removeRule = async (rule: IspRoutingRule) => {
    if (demo) {
      toast.error("Sign in to a real account to manage routing rules.");
      return;
    }
    setRules((rs) => rs.filter((r) => r.id !== rule.id));
    try {
      await ispService.removeRoutingRule(rule.id);
      toast.success("Routing rule removed");
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not remove the routing rule."));
      setRules((rs) => [rule, ...rs]);
    }
  };

  const healthyCount = links.filter((l) => l.healthStatus === "healthy").length;
  const activeLink = links.find((l) => l.isActiveUplink);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FeatureHeader
            title="Internet Connection"
            description="Real WAN uplinks per router -- provider, bandwidth, DNS, live health status, manual/automatic failover, and policy-based routing rules."
            icon={Globe}
            action={
              selectedRouterId ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add ISP Link
                </Button>
              ) : undefined
            }
          />
        </div>
        <IspDetailsIllustration />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div>
            <Label className="mb-1.5 block text-sm">Router *</Label>
            <Select
              value={selectedRouterId}
              onValueChange={setSelectedRouterId}
              disabled={routersLoading || routers.length === 0}
            >
              <SelectTrigger className="h-9 sm:w-1/2">
                <SelectValue
                  placeholder={routersLoading ? "Loading routers…" : "Select a router"}
                />
              </SelectTrigger>
              <SelectContent>
                {routers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}{" "}
                    <span className="text-muted-foreground">
                      ({r.locationName || r.serialNumber})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!routersLoading && routersError && (
            <ErrorState
              title="Couldn't load routers"
              description="Something went wrong fetching the routers for this location -- your connection or our servers, not a real empty account."
              onRetry={() => setRoutersRetryTick((n) => n + 1)}
            />
          )}
          {!routersLoading && !routersError && routers.length === 0 && (
            <EmptyState
              icon={Router}
              title="No routers provisioned"
              description="Provision a router at this location first, then come back here to configure its ISP link."
            />
          )}
        </CardContent>
      </Card>

      {selectedRouter && (
        <>
          <KpiRow
            items={[
              {
                label: "Router Status",
                value:
                  selectedRouter.status === "online"
                    ? "Online"
                    : selectedRouter.status.replace(/_/g, " "),
                tone: selectedRouter.status === "online" ? "success" : "warning",
                icon: Router,
              },
              { label: "ISP Links", value: String(links.length), tone: "default", icon: Network },
              {
                label: "Healthy Links",
                value: linksError ? "—" : `${healthyCount}/${links.length}`,
                tone: linksError
                  ? "danger"
                  : healthyCount === links.length && links.length > 0
                    ? "success"
                    : "warning",
                icon: Signal,
              },
              {
                label: "Active Uplink",
                value: activeLink?.providerName ?? "—",
                tone: "primary",
                icon: Globe,
              },
            ]}
          />

          {links.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-sm">Failover</CardTitle>
                  <CardDescription>
                    Manually switch this router's active uplink, or fail back to its primary once
                    it's healthy again.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={failoverBusy !== null}
                    onClick={triggerFailover}
                  >
                    <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Trigger failover
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={failoverBusy !== null}
                    onClick={triggerFailback}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Trigger failback
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">WAN Uplinks — {selectedRouter.name}</CardTitle>
              <CardDescription>
                Every ISP link configured for this router, with real, sweep-updated health status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {linksLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={4} />
                </div>
              ) : linksError ? (
                <ErrorState
                  title="Couldn't load ISP links"
                  description="Something went wrong fetching this router's ISP links -- your connection or our servers, not a real empty configuration."
                  onRetry={() => loadLinks(selectedRouterId)}
                />
              ) : links.length === 0 ? (
                <EmptyState
                  icon={Network}
                  title="No ISP link configured"
                  description={'Click "Add ISP Link" above to add one for this router.'}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Provider</TableHead>
                      <TableHead className="text-xs font-medium">Type</TableHead>
                      <TableHead className="text-xs font-medium">Role</TableHead>
                      <TableHead className="text-xs font-medium">Bandwidth</TableHead>
                      <TableHead className="text-xs font-medium">DNS</TableHead>
                      <TableHead className="text-xs font-medium">Priority</TableHead>
                      <TableHead className="text-xs font-medium">Health</TableHead>
                      <TableHead className="text-xs font-medium">Status Timeline</TableHead>
                      <TableHead className="text-xs font-medium">Latency / Loss</TableHead>
                      <TableHead className="text-xs font-medium">Last Checked</TableHead>
                      <TableHead className="text-right text-xs font-medium">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((l) => (
                      <TableRow key={l.id} className="border-b">
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            <IspProviderIcon providerName={l.providerName} className="h-4 w-4" />
                            {l.providerName}
                            {l.isActiveUplink && (
                              <Badge variant="outline" className="text-[10px]">
                                Active
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {l.linkType.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {l.role}
                          <p
                            className="mt-0.5 text-[10px] normal-case text-muted-foreground/70"
                            title="Whether this link automatically fails back to primary once healthy again, or stays on the failover uplink until switched back manually"
                          >
                            {l.autoFailback ? "Auto-failback on" : "Auto-failback off"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.downloadBandwidthMbps ?? "—"}↓ / {l.uploadBandwidthMbps ?? "—"}↑ Mbps
                          {(l.currentDownloadMbps != null || l.currentUploadMbps != null) && (
                            <p
                              className="mt-0.5 text-[10px] text-teal-600 dark:text-teal-400"
                              title="Live measured traffic load, not the provisioned plan capacity above"
                            >
                              Live: {l.currentDownloadMbps?.toFixed(1) ?? "—"}↓ /{" "}
                              {l.currentUploadMbps?.toFixed(1) ?? "—"}↑ Mbps
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[l.dnsPrimary, l.dnsSecondary].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.priority}
                        </TableCell>
                        <TableCell>
                          <HealthBadge status={l.healthStatus} source={l.healthStatusSource} />
                          {l.healthStatus === "unhealthy" && l.unhealthySince && (
                            <p
                              className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400"
                              title={new Date(l.unhealthySince).toLocaleString()}
                            >
                              Down since {timeAgo(l.unhealthySince)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <IspStatusTimeline link={l} demo={demo} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>
                            {l.latencyMs != null ? `${l.latencyMs.toFixed(1)} ms` : "—"} /{" "}
                            {l.packetLossPercentage != null
                              ? `${l.packetLossPercentage.toFixed(1)}%`
                              : "—"}
                          </div>
                          {/* Real, on-demand /tool/fetch result -- distinct from
                           * the passive traffic-rate figures above it, so this
                           * only ever shows once a link's own Speed Test button
                           * has actually been run this session. */}
                          {speedTests[l.id]?.status === "running" && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                              </span>
                              Measuring…
                            </div>
                          )}
                          {speedTests[l.id]?.status === "done" && (
                            <div className="mt-0.5 text-[10px]">
                              <span className="font-semibold text-foreground">
                                {(
                                  speedTests[l.id] as { status: "done"; result: IspSpeedTestResult }
                                ).result.downloadMbps.toFixed(1)}{" "}
                                Mbps ↓
                              </span>
                              <span className="text-muted-foreground"> real speed test</span>
                            </div>
                          )}
                          {speedTests[l.id]?.status === "error" && (
                            <div className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                              Speed test failed
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.lastCheckedAt ? timeAgo(l.lastCheckedAt) : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                              title="Mark as Up (healthy)"
                              disabled={statusBusyId === l.id}
                              onClick={() => setLinkManualStatus(l, "healthy")}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600 dark:text-rose-400"
                              title="Mark as Down (unhealthy)"
                              disabled={statusBusyId === l.id}
                              onClick={() => setLinkManualStatus(l, "unhealthy")}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Check health now"
                              disabled={checkingId === l.id}
                              onClick={() => checkHealth(l)}
                            >
                              <RefreshCw
                                className={cn("h-4 w-4", checkingId === l.id && "animate-spin")}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Run a real speed test against this link's router"
                              disabled={speedTests[l.id]?.status === "running"}
                              onClick={() => runSpeedTest(l)}
                            >
                              <Gauge
                                className={cn(
                                  "h-4 w-4",
                                  speedTests[l.id]?.status === "running" && "animate-spin",
                                )}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Health history"
                              onClick={() => setHistoryLinkId(l.id)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit"
                              onClick={() => openEdit(l)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              title="Remove"
                              onClick={() => removeLink(l)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Routing Rules</CardTitle>
                <CardDescription>
                  Pin matching traffic (by VLAN, device, IP, source network, interface, or policy)
                  to a specific uplink.
                </CardDescription>
              </div>
              <Button size="sm" onClick={openCreateRule} disabled={links.length === 0}>
                <Plus className="h-4 w-4" />
                New Rule
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {rulesLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={3} />
                </div>
              ) : rules.length === 0 ? (
                <EmptyState
                  icon={ArrowLeftRight}
                  title="No routing rules yet"
                  description={
                    links.length === 0
                      ? "Add an ISP link above first, then pin specific traffic to it here."
                      : 'Click "New Rule" above to pin matching traffic to a specific uplink.'
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Name</TableHead>
                      <TableHead className="text-xs font-medium">Type</TableHead>
                      <TableHead className="text-xs font-medium">Match</TableHead>
                      <TableHead className="text-xs font-medium">Uplink</TableHead>
                      <TableHead className="text-xs font-medium">Priority</TableHead>
                      <TableHead className="text-xs font-medium">Status</TableHead>
                      <TableHead className="w-[80px] text-right text-xs font-medium">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id} className="border-b">
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">
                          {r.ruleType}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{matchValueFromRule(r)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {links.find((l) => l.id === r.ispLinkId)?.providerName ??
                            r.ispLinkId.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.priority}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.isEnabled ? "default" : "secondary"}>
                            {r.isEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit"
                              onClick={() => openEditRule(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              title="Remove"
                              onClick={() => removeRule(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <IspLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingLink}
        saving={saving}
        onSave={saveLink}
      />
      <IspHealthHistoryDialog
        linkId={historyLinkId}
        open={historyLinkId != null}
        onOpenChange={(v) => !v && setHistoryLinkId(null)}
      />
      <IspRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        editing={editingRule}
        links={links}
        saving={savingRule}
        onSave={saveRule}
      />
    </div>
  );
}

/* ---------- Admin Logs ---------- */

/** Small illustrated empty-state for a log section with zero real rows --
 * a dormant activity pulse, same filled-flat-shape language as
 * ChartEmptyState/UsersEmptyState elsewhere this session (each of those is
 * scoped to its own page file, not exported, so this is a local twin
 * rather than a cross-file import). Purely decorative -- aria-hidden. */
function LogsEmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <svg aria-hidden="true" viewBox="0 0 100 70" className="h-14 w-20" fill="none">
        <ellipse cx="50" cy="60" rx="32" ry="4" fill="#4f46e5" opacity="0.08" />
        <rect
          x="26"
          y="24"
          width="48"
          height="30"
          rx="6"
          fill="#f5f0ff"
          stroke="#a78bfa"
          strokeWidth="2"
        />
        <path
          d="M34 34h32M34 41h22"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.35"
        />
        <circle cx="66" cy="20" r="4" fill="#22d3ee" opacity="0.6" />
      </svg>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Section header for one of the three log tables below -- a distinct
 * gradient hue per section (still within the established indigo/violet/
 * fuchsia brand family) so a reader can tell at a glance which of the
 * three dense tables they're scanning, without reading the title text
 * first. Left-accent bar on the card echoes the same hue. */
function LogSectionHeader({
  icon: Icon,
  title,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  gradient: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
          gradient,
        )}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

export function AdminLogsView({ locationId }: { locationId?: string }) {
  // Owner-only, render-time check -- defense in depth alongside the
  // sidebar/route-nav guard (customerNav.ts / customer.$locationId.$feature
  // .tsx's own NAV_GROUPS) and the backend's own independent enforcement
  // (app.domains.admin_logs.router's RequireRole("organization-owner"),
  // and -- since the "Audit Log" tab's real data was folded into this
  // page's own Account Activity section below -- app.domains.audit
  // .router's matching RequireRole narrowing). A UI guard alone is
  // bypassable (a direct URL hit skips the sidebar filter entirely) --
  // this catches that case; the backend 403 is what actually keeps a
  // non-owner from ever getting the real data either way.
  const role = getCustomerLoginRole();
  // Real data only -- fetched from /admin-logs/dashboard-logins,
  // /admin-logs/router-events, and /audit/entries (all org-scoped,
  // Owner-only), each with its own real server-side page/page_size (see
  // customer.service.ts's own "Logs (real, server-side–paginated)"
  // comment) so each section's numbered pager below can jump straight to
  // any page without fetching the other two pages or the whole table. No
  // Math.random(), no fabricated rows; a failed/blocked fetch resolves to
  // an empty section, never fake log entries.
  const ADMIN_LOGS_PAGE_SIZE = 25;
  const [loginsPage, setLoginsPage] = useState(1);
  const [routerPage, setRouterPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  // Tabbed instead of three long tables stacked one after another -- each
  // section can run to 25+ rows per page, so reaching "Account Activity"
  // used to mean scrolling past two entirely unrelated tables first. All
  // three queries still run unconditionally (below), so switching tabs is
  // instant with no refetch, and each section's own page number is
  // preserved even while its tab isn't active.
  const [section, setSection] = useState<"logins" | "router" | "activity">("logins");
  const loginsQuery = useAdminLogsDashboardLogins(loginsPage, ADMIN_LOGS_PAGE_SIZE);
  const routerQuery = useAdminLogsRouterEvents(routerPage, ADMIN_LOGS_PAGE_SIZE);
  const activityQuery = useAdminLogsAccountActivity(activityPage, ADMIN_LOGS_PAGE_SIZE);

  if (role !== "owner") {
    return (
      <div className="space-y-6">
        <FeatureHeader
          title="Logs"
          description="Who logged into the dashboard and when, router activity, and account changes across every location."
          icon={ScrollText}
        />
        <Card className="border-0 shadow-sm">
          <CardContent>
            <EmptyState
              icon={ShieldAlert}
              title="Owner access only"
              description="Logs shows a security-sensitive login and change-audit trail for the whole organization. Only the Organization Owner can view this page."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const logins = loginsQuery.data?.items ?? [];
  const routerLogs = routerQuery.data?.items ?? [];
  const accountActivity = activityQuery.data?.items ?? [];
  const loginsTotalPages = loginsQuery.data?.meta.totalPages ?? 0;
  const routerTotalPages = routerQuery.data?.meta.totalPages ?? 0;
  const activityTotalPages = activityQuery.data?.meta.totalPages ?? 0;

  const TABS: {
    id: typeof section;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
  }[] = [
    {
      id: "logins",
      label: "Dashboard Logins",
      icon: KeyRound,
      count: loginsQuery.data?.meta.totalItems ?? logins.length,
    },
    {
      id: "router",
      label: "Router Logs",
      icon: Router,
      count: routerQuery.data?.meta.totalItems ?? routerLogs.length,
    },
    {
      id: "activity",
      label: "Account Activity",
      icon: History,
      count: activityQuery.data?.meta.totalItems ?? accountActivity.length,
    },
  ];

  return (
    <div className="space-y-6">
      <FeatureHeader
        title="Logs"
        description="Real login activity, router events, and account/config changes across every location in your organization."
        icon={ScrollText}
      />

      <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              section === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                section === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {section === "logins" && (
        <div className="space-y-3">
          <LogSectionHeader
            icon={KeyRound}
            title="Dashboard Logins"
            gradient="from-[#4f46e5] to-[#818cf8]"
          />
          <Card className="border-0 border-l-4 border-l-[#4f46e5] shadow-sm">
            <CardContent className="p-0">
              {loginsQuery.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={5} />
                </div>
              ) : logins.length === 0 ? (
                <LogsEmptyState label="No dashboard logins yet -- login activity for this organization will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Email</TableHead>
                      <TableHead className="text-xs font-medium">IP Address</TableHead>
                      <TableHead className="text-xs font-medium">Result</TableHead>
                      <TableHead className="text-xs font-medium">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logins.map((l) => (
                      <TableRow key={l.id} className="border-b">
                        <TableCell className="py-2 font-medium">{l.email}</TableCell>
                        <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                          {l.ipAddress}
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              l.success
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                l.success ? "bg-emerald-500" : "bg-rose-500",
                              )}
                            />
                            {l.success ? "Success" : (l.failureReason ?? "Failed")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {l.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {loginsTotalPages > 1 && (
              <div className="border-t border-border/70 px-4 py-3">
                <NumberedPagination
                  page={loginsPage}
                  totalPages={loginsTotalPages}
                  onPageChange={setLoginsPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {section === "router" && (
        <div className="space-y-3">
          <LogSectionHeader
            icon={Router}
            title="Router Logs by Location"
            gradient="from-[#7c3aed] to-[#a78bfa]"
          />
          <Card className="border-0 border-l-4 border-l-[#7c3aed] shadow-sm">
            <CardContent className="p-0">
              {routerQuery.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={5} />
                </div>
              ) : routerLogs.length === 0 ? (
                <LogsEmptyState label="No router events yet -- router activity across your locations will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Location</TableHead>
                      <TableHead className="text-xs font-medium">Router</TableHead>
                      <TableHead className="text-xs font-medium">Event</TableHead>
                      <TableHead className="text-xs font-medium">Message</TableHead>
                      <TableHead className="text-xs font-medium">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routerLogs.map((e) => (
                      <TableRow key={e.id} className="border-b">
                        <TableCell className="py-2 font-medium">{e.locationName}</TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {e.routerName}
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-medium",
                              e.isError
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                e.isError ? "bg-rose-500" : "bg-slate-400",
                              )}
                            />
                            {e.eventType.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {e.message ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {e.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {routerTotalPages > 1 && (
              <div className="border-t border-border/70 px-4 py-3">
                <NumberedPagination
                  page={routerPage}
                  totalPages={routerTotalPages}
                  onPageChange={setRouterPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {section === "activity" && (
        <div className="space-y-3">
          {/* Real administrative change-audit trail (role assignments,
            location/member changes, etc.) -- what used to be the
            standalone "Audit Log" tab, now merged in here as its own
            section rather than kept as a second nav entry. Same real
            /audit/entries data (app.domains.audit), same real
            server-side pagination as the two sections above -- see
            customer.service.ts's own getAdminLogsAccountActivity comment.
            Fetched with exclude_view_events=true, so this is only real
            changes -- never the "*_viewed" access-logging noise that
            would otherwise bury it. */}
          <LogSectionHeader
            icon={History}
            title="Account Activity"
            gradient="from-[#c026d3] to-[#f0abfc]"
          />
          <Card className="border-0 border-l-4 border-l-[#c026d3] shadow-sm">
            <CardContent className="p-0">
              {activityQuery.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={5} />
                </div>
              ) : accountActivity.length === 0 ? (
                <LogsEmptyState label="No account activity yet -- role assignments and account/config changes across your organization will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Change</TableHead>
                      <TableHead className="text-xs font-medium">Actor</TableHead>
                      <TableHead className="text-xs font-medium">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountActivity.map((a) => (
                      <TableRow key={a.id} className="border-b">
                        <TableCell className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                                actionTone(a.action),
                              )}
                            >
                              {formatAuditAction(a.action)}
                            </span>
                            {a.description && (
                              <span className="text-sm text-foreground">{a.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {a.actor}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {a.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {activityTotalPages > 1 && (
              <div className="border-t border-border/70 px-4 py-3">
                <NumberedPagination
                  page={activityPage}
                  totalPages={activityTotalPages}
                  onPageChange={setActivityPage}
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/** "role_assigned" -> "Role assigned"; title-cased just the leading word so
 * multi-word actions (the common case) still read as a sentence fragment
 * rather than shouty Title Case Everywhere. */
function formatAuditAction(action: string): string {
  const words = action.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Colors the action badge by what kind of change it was -- destructive
 * (removed/deleted/revoked/deactivated/archived) reads as rose, additive
 * (created/assigned/added/approved/activated) as emerald, everything else
 * (updated/changed/published/...) as neutral slate -- the same
 * create/destructive/neutral language the two tables above this one
 * already use for their own status pills. */
function actionTone(action: string): string {
  if (/removed|deleted|revoked|deactivated|archived|rejected|denied/.test(action)) {
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
  }
  if (/created|assigned|added|approved|activated|invited|accepted|published/.test(action)) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300";
}

/* ---------- MAC Authorization ---------- */
interface MacAuthEntry {
  id: string;
  mac: string;
  type: string;
  expiresAt: string | null;
  comment: string | null;
  enabled: boolean;
}

export function MacAuthView({ locationId }: { locationId?: string }) {
  // `isError`/`refetch` are read because customerService.getFeatureData no
  // longer resolves with demo fixtures when the fetch fails (see its own
  // docstring). Without an error branch below, a failed load would fall
  // through to the "No MAC addresses authorized" empty state -- which
  // asserts this location has no trusted devices, a claim we cannot make
  // when we never got an answer. For an access-control list that is the
  // one thing worth being careful about.
  const { data, isLoading, isError, refetch } = useCustomerFeatureData(
    "mac-auth",
    locationId ?? "",
  );
  const [entries, setEntries] = useState<MacAuthEntry[]>([]);
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (data?.macAuth && !synced) {
      setEntries(data.macAuth);
      setSynced(true);
    }
  }, [data, synced]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ mac: "", type: "permanent", comment: "" });
  const [macError, setMacError] = useState<string | null>(null);

  const addEntry = async () => {
    // Real-world MACs get pasted in every notation (dashes, no separators,
    // mixed case -- e.g. the dash format a router's own MAC is shown in
    // elsewhere in this app). A strict colon-only regex silently rejected
    // all of those: the dialog just sat there with a transient toast as
    // the only feedback, reading as "the Add button doesn't work" (the
    // same bug already fixed in NetworkHardwareView's Add Device dialog --
    // see BasicFeatureViews.normalizeMac). Normalize first, and surface a
    // real inline error instead of only a fading toast.
    const normalizedMac = normalizeMac(form.mac);
    if (!normalizedMac) {
      const msg = "Enter a valid MAC address, e.g. AA:BB:CC:DD:EE:FF";
      setMacError(msg);
      toast.error(msg);
      return;
    }
    const payload = {
      macAddress: normalizedMac,
      authorizationType: form.type as "permanent" | "temporary",
      comment: form.comment || null,
      isEnabled: true,
    };
    try {
      if (!isDemo() && locationId) {
        const created = await macAuthorizationService.create({ ...payload, locationId });
        setEntries((e) => [
          {
            id: created.id,
            mac: created.macAddress,
            type: created.authorizationType,
            expiresAt: created.expiresAt,
            comment: created.comment,
            enabled: created.isEnabled,
          },
          ...e,
        ]);
      } else {
        setEntries((e) => [
          {
            id: String(Date.now()),
            mac: payload.macAddress,
            type: payload.authorizationType,
            expiresAt: null,
            comment: payload.comment,
            enabled: true,
          },
          ...e,
        ]);
      }
      toast.success("MAC address authorized");
      setForm({ mac: "", type: "permanent", comment: "" });
      setMacError(null);
      setOpen(false);
    } catch (err) {
      // Surface the backend's real message (e.g. its duplicate-MAC 409)
      // instead of a generic "check the connection" -- a genuine rejection
      // needs to read as a rejection, not a dead click.
      const msg =
        (err as AppError).message || "Could not save — check the connection and try again.";
      setMacError(msg);
      toast.error(msg);
    }
  };

  const toggleEntry = async (entry: MacAuthEntry) => {
    setEntries((es) => es.map((e) => (e.id === entry.id ? { ...e, enabled: !e.enabled } : e)));
    if (!isDemo()) {
      try {
        await macAuthorizationService.update(entry.id, { isEnabled: !entry.enabled });
      } catch {
        toast.error("Could not update on the server.");
        setEntries((es) =>
          es.map((e) => (e.id === entry.id ? { ...e, enabled: entry.enabled } : e)),
        );
      }
    }
  };

  const removeEntry = async (entry: MacAuthEntry) => {
    setEntries((es) => es.filter((e) => e.id !== entry.id));
    toast.success("Entry removed");
    if (!isDemo()) {
      try {
        await macAuthorizationService.remove(entry.id);
      } catch {
        toast.error("Could not remove on the server.");
        setEntries((es) => [entry, ...es]);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FeatureHeader
            title="Trusted Devices"
            description="Bypass hotspot authentication on a few devices."
            icon={Fingerprint}
            action={
              <Button
                size="sm"
                onClick={() => {
                  setMacError(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add MAC
              </Button>
            }
          />
        </div>
        <MacAuthIllustration />
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Authorized Devices</CardTitle>
          <CardDescription>
            Devices allowed onto the network without going through the captive portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <LoadingSkeleton rows={4} />
            </div>
          ) : isError && entries.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load trusted devices"
              description="This list is not available right now, so we can't show which devices are authorized. Nothing has changed — try again in a moment."
              action={{ label: "Try again", onClick: () => void refetch() }}
            />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No MAC addresses authorized"
              description='Click "Add MAC" above to let a device bypass the captive portal.'
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium">MAC Address</TableHead>
                  <TableHead className="text-xs font-medium">Type</TableHead>
                  <TableHead className="text-xs font-medium">Expires</TableHead>
                  <TableHead className="text-xs font-medium">Comment</TableHead>
                  <TableHead className="text-xs font-medium">Enabled</TableHead>
                  <TableHead className="text-right text-xs font-medium">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} className="border-b">
                    <TableCell className="font-mono text-xs">{e.mac}</TableCell>
                    <TableCell className="text-xs capitalize">{e.type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.expiresAt ? new Date(e.expiresAt).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.comment || "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={e.enabled} onCheckedChange={() => toggleEntry(e)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => removeEntry(e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setMacError(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add MAC Address</DialogTitle>
            <DialogDescription>Authorize a device to skip the captive portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>MAC Address</Label>
              <Input
                placeholder="AA:BB:CC:DD:EE:FF"
                value={form.mac}
                onChange={(e) => {
                  setForm({ ...form, mac: e.target.value });
                  if (macError) setMacError(null);
                }}
                className={cn(
                  "font-mono",
                  macError && "border-destructive focus-visible:ring-destructive/20",
                )}
                aria-invalid={!!macError}
              />
              <p className="text-[11px] text-muted-foreground">
                Dashes, spaces, or no separators are fine too -- e.g. AA-BB-CC-DD-EE-FF.
              </p>
              {macError && <p className="text-xs font-medium text-destructive">{macError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Input
                placeholder="e.g. Front desk tablet"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addEntry}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Port Forwarding ----------
 * Was a NetworkCrudTable over an empty hardcoded seed with a decorative Edit
 * button (no onClick at all -- a dead click, plus even Add/Delete never
 * reached a backend). The real domain already exists end-to-end
 * (app.domains.port_forwarding, the `port_forwarding_rules` table,
 * portForwardingService/usePortForwarding on the frontend) and already backs
 * PortForwardingManagement -- reused here, scoped to this location, the same
 * way DhcpView/VlansView are. */
export function PortForwardingView({ locationId }: { locationId?: string }) {
  return <PortForwardingManagement locationId={locationId} />;
}

/* ---------- DHCP Pool ----------
 * Was a NetworkCrudTable over hardcoded seed rows with a decorative Edit
 * button (no onClick at all -- a dead click, plus even Add/Delete never
 * reached a backend). The real domain already exists end-to-end
 * (app.domains.dhcp, the `dhcp_pools` table, dhcpService/useDhcp on the
 * frontend) and already backs DhcpManagement -- reused here, scoped to
 * this location, the same way IspDetailsView/MacAuthView are. */
export function DhcpView({ locationId }: { locationId?: string }) {
  return <DhcpManagement locationId={locationId} />;
}

/* ---------- VLANs ----------
 * Was a NetworkCrudTable over hardcoded seed rows with a decorative Edit
 * button (no onClick at all -- a dead click, plus even Add/Delete never
 * reached a backend). The real domain already exists end-to-end
 * (app.domains.vlan, the `vlans` table, vlanService/useVlan on the
 * frontend) and already backs VlanManagement -- reused here, scoped to
 * this location, the same way DhcpView/IspDetailsView/MacAuthView are. */
export function VlansView({ locationId }: { locationId?: string }) {
  return <VlanManagement locationId={locationId} />;
}

/* ---------- VOIP Priority ----------
 * Was a page of decorative ToggleRows and a plain local useState switch --
 * "Enable / Disable VOIP Priority" and the SIP/RTP prioritization toggles
 * only ever fired a toast, nothing was ever read from or written to a
 * backend, and a reload silently discarded every change; the KPI tiles
 * above them ("Active calls", "Jitter", "Packet loss") were hardcoded
 * display values with no live source, so they're dropped here rather than
 * faked. The real domain already exists end-to-end (app.domains.qos, the
 * `qos_traffic_rules` table -- literally named "QoS & VOIP Priority" in its
 * own module docstring) -- unlike VLAN/DHCP/Port Forwarding/Hotspot/ISP
 * Routing, no frontend component existed yet to reuse, so QosManagement is
 * new (qos.service.ts/useQos.ts alongside it), scoped to this location the
 * same way DhcpView/VlansView are. */
export function VoipView({ locationId }: { locationId?: string }) {
  return <QosManagement locationId={locationId} />;
}

/* ---------- Website Blocking ----------
 * New nav entry, new feature -- no prior placeholder page existed for
 * this at all (unlike VOIP Priority/DHCP/VLAN/etc., which all replaced an
 * existing fake page). The real domain (app.domains.content_filtering,
 * the `content_filter_rules` table) and its frontend component
 * (ContentFilterManagement, content_filter.service.ts/useContentFilter.ts
 * alongside it) are both new this session, following QosManagement's own
 * structure/conventions.
 *
 * That last sentence used to read "rules apply the next time this router's
 * config is pushed ... there is no separate per-rule device-push endpoint/
 * status to surface here." Both halves are now false, and the first was
 * never load-bearing: `render_network_config` ships over SSH on port 22,
 * which is filtered on the fleet, so nothing was ever applied that way.
 * The domain now has a real `POST /content-filter-rules/{id}/push` and a
 * `device_push_status` per row, and ContentFilterManagement surfaces both
 * as an "On router" column plus an always-visible Apply button. */
export function WebsiteBlockingView({ locationId }: { locationId?: string }) {
  return <ContentFilterManagement locationId={locationId} />;
}

/* ---------- "Fix a Problem" (feature id `debugging`, was "Connection
 * Tools", and "Network Diagnostics" before that) ----------
 * The implementation moved to components/customer/FixAProblem.tsx; this
 * stays as the delegating export the feature switch already imports, the
 * same shape as WebsiteBlockingView/HotspotView/DhcpView above.
 *
 * WHY IT MOVED RATHER THAN BEING EDITED IN PLACE. The old view was a
 * ping box, a traceroute button and an input asking a cafe owner for a
 * guest's private LAN IP -- feature for feature a competitor's Network
 * Tools page, which is why renaming and restyling it once already failed
 * to shift the complaint. Rebuilding it around the venue's question
 * rather than the router's command set replaced essentially all of it,
 * and 400 lines of new page do not belong in a 5,000-line module that is
 * already eight unrelated screens.
 *
 * The real calls it always made are unchanged and still real:
 * networkDiagnosticsService.ping/traceroute against RouterOS, and
 * guestService.terminateSession. Ping and traceroute are now the
 * implementation of "can my guest open this site" instead of being
 * buttons named after themselves. */
export function DebuggingView({
  locationId,
  masked,
}: { locationId?: string; masked?: boolean } = {}) {
  return <FixAProblem locationId={locationId} masked={masked} />;
}

/* ---------- Hotspot Settings ----------
 * Was a page of decorative ToggleRows -- "Apply settings" just fired a toast,
 * nothing was ever read from or written to a backend, and a reload silently
 * discarded every change. The real domain already exists end-to-end
 * (app.domains.hotspot, the `hotspot_profiles` table,
 * hotspotService/useHotspot on the frontend) and already backs
 * HotspotManagement -- reused here, scoped to this location, the same way
 * DhcpView/VlansView/PortForwardingView are. */
export function HotspotView({ locationId }: { locationId?: string }) {
  return <HotspotManagement locationId={locationId} />;
}

/* ---------- RaaS: Dashboard ---------- */
export function RaasDashboardView() {
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="RaaS Dashboard"
        description="Reporting-as-a-Service overview across your managed business units."
        action={
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All spaces</SelectItem>
              <SelectItem value="hostel">The Hosteller</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-[image:var(--gradient-primary)] p-5 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-2 text-sm/none opacity-90">
            <Server className="h-4 w-4" /> Total Users
          </div>
          <p className="mt-2 text-3xl font-bold">3,241</p>
        </div>
        <div className="rounded-2xl bg-[image:var(--gradient-accent)] p-5 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-2 text-sm/none opacity-90">
            <Wifi className="h-4 w-4" /> Total Active Users
          </div>
          <p className="mt-2 text-3xl font-bold">1,188</p>
        </div>
      </div>
      <KpiRow
        items={[
          { label: "Data consumed", value: "4.2 TB", tone: "info", icon: Gauge },
          { label: "Avg session", value: "34 min", tone: "primary", icon: Clock },
          { label: "New users (7d)", value: "612", tone: "success", icon: Activity },
          { label: "Online now", value: "142", tone: "primary", icon: Signal },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business unit</TableHead>
                <TableHead>Plan expiry</TableHead>
                <TableHead>Online users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { n: "The Hosteller Marathahalli", e: "31 Dec 2026", o: "48" },
                { n: "Hosteller Staff · Marathahalli", e: "31 Dec 2026", o: "9" },
                { n: "The Hosteller Indira Nagar", e: "15 Jan 2027", o: "22" },
              ].map((r) => (
                <TableRow key={r.n}>
                  <TableCell className="font-medium">{r.n}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.e}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.o}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- RaaS: Manage Users ---------- */
export function RaasUsersView() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="RaaS · Manage Users"
        description="Add single or bulk users for a business unit and review current users."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add single user</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input placeholder="+91 •••••" className="h-9" />
            </div>
            <Button
              size="sm"
              onClick={() => {
                toast.success("User created");
                setName("");
                setEmail("");
              }}
            >
              Create user
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add bulk users</CardTitle>
            <CardDescription>Upload a CSV (max ~200 records) using the template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
              <Download className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop CSV here or browse</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                Download template
              </Button>
              <Button size="sm" onClick={() => toast.success("Users uploaded")}>
                Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { n: "Aarav Mehta", e: "aarav@stay.com", c: "12 Jul 2026", s: "active" },
                { n: "Diya Nair", e: "diya@stay.com", c: "10 Jul 2026", s: "active" },
                { n: "Kabir Rao", e: "kabir@stay.com", c: "02 Jul 2026", s: "disabled" },
              ].map((u) => (
                <TableRow key={u.e}>
                  <TableCell className="font-medium">{u.n}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.e}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.c}</TableCell>
                  <TableCell>
                    <StatusPill status={u.s} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- RaaS: Reports ---------- */
export function RaasReportsView() {
  const reports = [
    { n: "User Report", d: "Sign-ups and activity per business unit" },
    { n: "Voucher Report", d: "Issued, redeemed and expired vouchers" },
    { n: "Campaign Report", d: "Reach and conversions per campaign" },
    { n: "Data Report", d: "Consumption and charges by rate/GB" },
    { n: "OTP SMS Report", d: "Delivery success and latency" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader
        title="RaaS · Reports"
        description="Generate cross-business-unit reports in different formats."
        action={
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All report types</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.n} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <p className="font-semibold">{r.n}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.d}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => toast.success(`${r.n} · PDF`)}
                >
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => toast.success(`${r.n} · CSV`)}
                >
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- fallback for any not-yet-built feature ---------- */
export function GenericFeatureView({ feature }: { feature: string }) {
  const label = feature.replace(/-/g, " ");
  return (
    <div className="space-y-6">
      <FeatureHeader
        title={label.replace(/\b\w/g, (c) => c.toUpperCase())}
        description="This module is provisioned for your location."
      />
      <Card className="border-0 shadow-sm">
        <CardContent>
          <EmptyState
            icon={Network}
            title="Not configured yet"
            description={`Configuration for ${label} will appear here.`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
