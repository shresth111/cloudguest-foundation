import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Wifi,
  Router,
  Activity,
  Users,
  TrendingUp,
  Globe,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Quote,
  HardDrive,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import {
  CustomerCommandPalette,
  useCustomerCommandPalette,
} from "@/components/customer/CustomerCommandPalette";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import AssistantWidget from "@/components/features/AssistantWidget";
import { maskEmail, DEMO_PLAN_RENEWAL_ISO } from "@/components/features/HeaderControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerDashboard, useIsDemo, useDataMasking } from "@/hooks/useCustomerDashboard";
import { isDemo } from "@/services/customer.service";
import {
  LocationLivenessBadge,
  LocationLivenessExplainer,
} from "@/components/customer/LocationLiveness";
import {
  livenessTone,
  locationLivenessIsReassuring,
  CHECKING_LIVENESS,
  UNKNOWN_LIVENESS,
} from "@/lib/location-liveness";
import type { LocationLiveness, LivenessTone } from "@/lib/location-liveness";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { customerFeatureHref } from "@/lib/customerNav";
import { ispService } from "@/services/isp.service";
import type { AppError } from "@/services/api";
import type { IspLink, IspHealthCheck, IspSpeedTestResult } from "@/types/isp";
import { IspProviderIcon } from "@/components/icons/isp";
import { DEVICE_TYPES, formatSince } from "@/stores/deviceStore";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import { DEVICE_TYPE_META } from "@/lib/device-presentation";
import { formatUptimePercent } from "@/lib/uptime-format";
import { BlurFade } from "@/components/magicui/blur-fade";
import { BackgroundBoxes } from "@/components/aceternity/background-boxes";

// Moved out of src/routes/c.index.tsx (see that file's own note) -- this
// component (and its recharts/framer-motion/etc. dependencies) is real,
// substantial UI, but it was never actually reachable through the "/c/"
// route's own createFileRoute() registration (that route is just a
// beforeLoad redirect to "/", see c.index.tsx). It was only ever imported
// cross-file by index.tsx ("/") to render the real dashboard in place.
//
// Keeping it inside c.index.tsx anyway was a real, live production bug:
// routeTree.gen.ts statically imports every route file (c.index.tsx
// included, purely to register the "/c/" redirect) into the app's
// root/entry chunk -- the one every route loads, guest captive portal
// included. Since JS modules execute as a whole unit, that static import
// pulled this entire file's top-level code along with it, recharts import
// and ~1000 lines of dashboard JSX included, regardless of the fact that
// none of it is used by "/c/"'s own beforeLoad. TanStack Router's
// automatic code-splitting only extracts a route's own `component`/
// `loader`/etc. properties -- it has no visibility into an unrelated named
// export living in the same file, so this never had a chance to be split
// away as long as it lived in a route-registered file.
//
// A guest hitting /portal/welcome (no chart anywhere on that page) was
// downloading the full ~418KB recharts vendor chunk as a direct result --
// confirmed via a real browser network trace, not just static bundle
// analysis (see docs/captive-portal-v5-design-spec.md's own note on why
// static analysis alone missed this). Living here, in a plain component
// file no route file imports, this module is only ever reachable through
// index.tsx's own already-correctly-split `component` (IndexRedirect),
// same as any other regular component.

// Categorical, brand-checked -- indigo/cyan/magenta/orange/violet. The old
// palette here included green, which conflicts with this project's
// "never green as a decorative/brand accent" rule (semantic status green
// elsewhere is a different, intentional thing).
const DEVICE_COLORS = ["#4338ca", "#0891b2", "#c026d3", "#c2410c", "#6d28d9"];

/** Narrow-viewport fallback for the header's liveness badge. `neutral`
 * ("no router yet" / "can't tell") gets a slate dot, not the red one the
 * old ternary's else-branch handed it. */
/** Icon tint for the "Core systems" strip. Emerald is earned, not default. */
const CORE_ICON: Record<LivenessTone, string> = {
  live: "text-emerald-500",
  warn: "text-amber-500",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const HEADER_DOT: Record<LivenessTone, string> = {
  live: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-rose-400",
  neutral: "bg-white/40",
};

/** Operator-voice lines, not fabricated testimonials -- same pattern used
 * on the Select Location page's hero, scoped here so the hero's secondary
 * stat row doesn't leave dead space beside the corner illustration. */
const DASHBOARD_QUOTES = [
  "Uptime is a feature nobody thanks you for — until it's gone.",
  "Check it before a guest has to tell you it's down.",
  "The best network is the one nobody notices.",
  "A dropped connection is a dropped guest.",
  "Numbers you check daily are numbers that stay healthy.",
  "A quiet dashboard is the goal, not a boring one.",
];

/**
 * Shared empty-state graphic for any chart/table on this page with no data
 * yet -- a dormant signal dish, same filled-flat-shape character language
 * as the hero illustration, so "nothing here yet" still feels designed
 * instead of a bare sentence on white. Purely decorative -- aria-hidden.
 */
function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <svg aria-hidden="true" viewBox="0 0 100 70" className="h-14 w-20" fill="none">
        <ellipse cx="50" cy="60" rx="34" ry="4" fill="#6C4EFF" opacity="0.08" />
        <path d="M50 55V30" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="55" r="4" fill="#7c3aed" />
        <path
          d="M28 30a22 22 0 0 1 44 0"
          stroke="#6C4EFF"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.35"
        />
        <circle cx="50" cy="22" r="3" fill="#22d3ee" opacity="0.6" />
      </svg>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Real per-router-uplink connectivity status, keyed off the same
 * `app.domains.isp` domain the "Internet Connection" feature page
 * (`IspDetailsView`, see `customer.$locationId.$feature.tsx`) already
 * reads/writes. Deliberately distinct from the hero's own "Core systems"
 * strip ISP pill above (`d.health.isp`) -- that value is only ever
 * "Active"/"Unknown", derived from whether `/dashboard/organization`
 * answered at all (see `customer.service.ts`'s `getDashboard`), never a
 * real per-link ping. This card is the real thing: `IspLink.healthStatus`
 * plus its last dozen `IspHealthCheck` rows, so a founder can tell whether
 * THIS location's actual uplink is up without opening Internet Connection.
 */
const WAN_HEALTH_STYLE: Record<string, { label: string; dot: string; text: string; bar: string }> =
  {
    healthy: {
      label: "Online",
      dot: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
    },
    degraded: {
      label: "Degraded",
      dot: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    },
    unhealthy: {
      label: "Offline",
      dot: "bg-rose-500",
      text: "text-rose-600 dark:text-rose-400",
      bar: "bg-rose-500",
    },
    unknown: {
      label: "Unknown",
      dot: "bg-muted-foreground/40",
      text: "text-muted-foreground",
      bar: "bg-muted-foreground/30",
    },
  };
const WAN_CONNECTION_MODE_LABEL: Record<string, string> = {
  static: "Static IP",
  dhcp: "DHCP",
  pppoe: "PPPoE",
};

/** "Down since 3h 12m ago" -- built from `IspLink.unhealthySince`, which is
 * itself computed server-side from real health-check history (never
 * calculated client-side, see the field's own doc comment in
 * `types/isp.ts`). Only ever called while healthStatus is "unhealthy". */
function formatDownDuration(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  if (ms < 60_000) return "under a minute";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/** Demo-session fixture -- this app's own established "a demo login never
 * calls the real backend" convention (see `getDashboard`'s DEMO branch
 * above, or `OperationsFeatures.tsx`'s identical `DEMO_LINKS`/
 * `DEMO_HEALTH_HISTORY` pair). Kept local and self-contained rather than
 * importing the Internet Connection page's own demo fixture, matching
 * every other rebuilt view's "each real surface stays self-contained"
 * precedent. "Tata Communications" echoes the same provider name the
 * hero's own demo `d.health.isp` value already uses, so the two don't
 * contradict each other on screen.
 */
const DEMO_WAN_LINK: IspLink = {
  id: "isp-demo-dashboard",
  routerId: "router-demo",
  organizationId: "org-demo",
  locationId: "demo-location",
  providerName: "Airtel Business",
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
  latencyMs: 14.2,
  packetLossPercentage: 0,
  currentDownloadMbps: 132.4,
  currentUploadMbps: 28.1,
  lastCheckedAt: new Date().toISOString(),
  consecutiveUnhealthyCount: 0,
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
};
/** The demo's backup uplink -- standby, never carrying live traffic, which
 * is exactly why it has no `currentDownloadMbps`/`currentUploadMbps` (that
 * field only ever gets a real value once a link is actually the active
 * uplink, see its own doc comment above). Its `autoFailback: true` is what
 * `WanStatusCard` reads to say the primary reclaims traffic automatically
 * once it's healthy again -- the *initial* failover onto this link,
 * separately, is always automatic once the primary crosses its unhealthy
 * threshold (see backend `IspService._maybe_transition_uplink`), not
 * gated by any per-link flag.
 */
const DEMO_WAN_BACKUP_LINK: IspLink = {
  id: "isp-demo-dashboard-backup",
  routerId: "router-demo",
  organizationId: "org-demo",
  locationId: "demo-location",
  providerName: "Jio Fiber",
  linkType: "fiber",
  connectionMode: "dhcp",
  role: "backup",
  isActiveUplink: false,
  autoFailback: true,
  isEnabled: true,
  priority: 1,
  interface: "ether2",
  gatewayIpAddress: null,
  dnsPrimary: "1.1.1.1",
  dnsSecondary: "8.8.8.8",
  downloadBandwidthMbps: 300,
  uploadBandwidthMbps: 150,
  healthStatus: "healthy",
  healthStatusSource: "automated",
  unhealthySince: null,
  latencyMs: 19.6,
  packetLossPercentage: 0,
  currentDownloadMbps: null,
  currentUploadMbps: null,
  lastCheckedAt: new Date().toISOString(),
  consecutiveUnhealthyCount: 0,
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
};
const DEMO_WAN_CHECKS: IspHealthCheck[] = [
  "healthy",
  "healthy",
  "healthy",
  "degraded",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
].map((status, i) => ({
  id: `demo-wan-check-${i}`,
  ispLinkId: DEMO_WAN_LINK.id,
  checkedAt: new Date(Date.now() - (11 - i) * 5 * 60000).toISOString(),
  status,
  source: "automated",
  latencyMs: status === "degraded" ? 92 : 12 + i,
  packetLossPercentage: status === "degraded" ? 2.1 : 0,
  errorMessage: null,
  downloadMbps: 100 + i * 2,
  uploadMbps: 20 + i,
}));

/** Demo-session fixture for the "Bandwidth Utilization" live graph --
 * illustrative-only, never fetched from ispService while isDemo() is true
 * (same posture as IspStatusTimeline's own demo traffic figures). 60
 * one-minute-apart points (matching the real card's own pageSize: 60
 * poll) with a brief mid-window dip so the demo actually shows what the
 * founder's own ask looks like -- a real drop, visible on a graph --
 * without ever slapping an invented "congested" label on it. */
const DEMO_BANDWIDTH_CHECKS: IspHealthCheck[] = Array.from({ length: 60 }, (_, i) => {
  const dip = i >= 28 && i <= 33;
  const download = dip ? 16 + (i % 3) * 2 : Math.round((95 + 25 * Math.sin(i / 5)) * 10) / 10;
  const upload = dip ? 3 + (i % 2) : Math.round((22 + 6 * Math.sin(i / 5 + 1)) * 10) / 10;
  return {
    id: `demo-bandwidth-check-${i}`,
    ispLinkId: DEMO_WAN_LINK.id,
    checkedAt: new Date(Date.now() - (59 - i) * 60_000).toISOString(),
    status: dip ? "degraded" : "healthy",
    source: "automated",
    latencyMs: dip ? 86 : 13,
    packetLossPercentage: dip ? 2.8 : 0,
    errorMessage: null,
    downloadMbps: download,
    uploadMbps: upload,
  };
}).reverse(); // newest-first, matching listHealthChecks' own real ordering.

type WanSummaryState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; links: IspLink[]; checks: IspHealthCheck[] };

/** Picks the uplink(s) worth surfacing at a glance for this location: the
 * active link first, then its standby backup if one is configured (at
 * most 2 -- a location with more links than that still gets one clear
 * primary/backup story here; "Manage" links through to Internet
 * Connection for the full breakdown). Health-check history is fetched for
 * whichever link sorts first (the active one, almost always the primary). */
function useWanSummary(locationId: string): WanSummaryState {
  const [state, setState] = useState<WanSummaryState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    if (isDemo()) {
      setState({
        status: "ready",
        links: [DEMO_WAN_LINK, DEMO_WAN_BACKUP_LINK],
        checks: DEMO_WAN_CHECKS,
      });
      return;
    }
    (async () => {
      try {
        const { rows } = await ispService.listLinks({ page: 1, pageSize: 100, locationId });
        const links = rows
          .filter((l) => l.locationId === locationId)
          .sort((a, b) => {
            if (a.isActiveUplink !== b.isActiveUplink) return a.isActiveUplink ? -1 : 1;
            if (a.role !== b.role) return a.role === "primary" ? -1 : 1;
            return a.priority - b.priority;
          })
          .slice(0, 2);
        if (!alive) return;
        if (links.length === 0) {
          setState({ status: "empty" });
          return;
        }
        const checks = await ispService
          .listHealthChecks(links[0].id, { page: 1, pageSize: 12, locationId })
          .then((r) => r.rows)
          .catch(() => []);
        if (!alive) return;
        setState({ status: "ready", links, checks });
      } catch {
        // Covers both "genuinely nothing configured yet" and any read
        // failure (e.g. a staff role without isp.read) -- same lenient
        // fallback IspStatusTimeline's own fetch already uses on this
        // domain. The empty-state copy below is worded to stay honest
        // either way, never asserting a specific cause it can't confirm.
        if (alive) setState({ status: "empty" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [locationId]);
  return state;
}

type BandwidthSeriesState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; link: IspLink; checks: IspHealthCheck[]; otherLinks: IspLink[] };

// Same 20s cadence the Internet Connection page's own links table already
// polls at (OperationsFeatures.tsx's ISP_LINKS_POLL_INTERVAL_MS) -- reused
// here rather than re-invented, so "live" means the same thing everywhere
// in this app.
const BANDWIDTH_POLL_INTERVAL_MS = 20_000;

/** Live rolling bandwidth series for this location's active uplink -- the
 * real, per-tick `IspHealthCheck.downloadMbps`/`uploadMbps` rows (see
 * backend `IspService.sample_link_traffic`'s own docstring for exactly how
 * these are computed from real router interface byte-counter deltas), the
 * exact same numbers `WanStatusCard`'s "Bandwidth · live" stat and
 * `IspStatusTimeline`'s sparkline already read elsewhere. This hook is
 * self-contained (its own fetch + its own poll), matching this file's own
 * "each card fetches independently" precedent (`useWanSummary` above) --
 * not derived from it, so this card keeps working even if WanStatusCard's
 * own fetch ever changes shape.
 *
 * Two-phase: the active link is resolved once per `locationId` (mirroring
 * `useWanSummary`'s own active-link selection exactly, so this card and
 * WanStatusCard always agree on which uplink is "the" live one), then that
 * link's own recent checks are polled independently on
 * `BANDWIDTH_POLL_INTERVAL_MS`, paused while the tab is hidden -- the same
 * Page Visibility API pattern `IspDetailsView`'s own auto-refresh already
 * establishes, so a backgrounded dashboard tab doesn't keep hammering the
 * API for nothing.
 *
 * Also resolves `otherLinks` -- every other enabled link at this location
 * (e.g. a standby backup), from that same first-phase list fetch. Nothing
 * about the chart itself changes for these: they're surfaced as a compact
 * status row only (see `BandwidthUtilizationCard`), never separately
 * polled/charted here -- a location with a backup link shouldn't go
 * completely invisible on the one screen an admin checks daily, but this
 * card's own detail view stays scoped to the single active link it's
 * always been built around. */
function useBandwidthSeries(locationId: string): BandwidthSeriesState {
  const [phase, setPhase] = useState<"loading" | "empty" | "ready">("loading");
  const [link, setLink] = useState<IspLink | null>(null);
  const [otherLinks, setOtherLinks] = useState<IspLink[]>([]);
  const [checks, setChecks] = useState<IspHealthCheck[]>([]);

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    setLink(null);
    setOtherLinks([]);
    setChecks([]);
    if (isDemo()) {
      setLink(DEMO_WAN_LINK);
      setOtherLinks([DEMO_WAN_BACKUP_LINK]);
      setChecks(DEMO_BANDWIDTH_CHECKS);
      setPhase("ready");
      return;
    }
    (async () => {
      try {
        const { rows } = await ispService.listLinks({ page: 1, pageSize: 100, locationId });
        const links = rows.filter((l) => l.locationId === locationId);
        const active = links.find((l) => l.isActiveUplink) ?? links[0];
        if (!alive) return;
        if (!active) {
          setPhase("empty");
          return;
        }
        setLink(active);
        setOtherLinks(links.filter((l) => l.id !== active.id));
      } catch {
        if (alive) setPhase("empty");
      }
    })();
    return () => {
      alive = false;
    };
  }, [locationId]);

  useEffect(() => {
    if (isDemo() || !link) return;
    let alive = true;
    const load = () => {
      ispService
        .listHealthChecks(link.id, { page: 1, pageSize: 60, locationId })
        .then((r) => {
          if (alive) {
            setChecks(r.rows);
            setPhase("ready");
          }
        })
        .catch(() => {
          // A transient poll failure keeps showing the last known-good
          // series rather than flashing to an error/empty state -- same
          // lenient `quiet` poll posture `IspDetailsView.loadLinks` uses.
        });
    };
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer == null) timer = setInterval(load, BANDWIDTH_POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
        start();
      } else {
        stop();
      }
    };
    load();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [link]);

  if (phase === "empty") return { status: "empty" };
  if (phase === "ready" && link) return { status: "ready", link, checks, otherLinks };
  return { status: "loading" };
}

/** Oldest -> newest, left to right -- the exact same "last dozen real
 * checks as colored ticks" reading `IspStatusTimeline` (Internet
 * Connection page) already established, so this widget's timeline isn't a
 * visually-unrelated second idiom for the same underlying data. */
function WanRecentChecks({ checks }: { checks: IspHealthCheck[] }) {
  if (checks.length === 0) {
    return <p className="text-xs text-muted-foreground">No health-check history yet.</p>;
  }
  const ordered = [...checks].reverse();
  return (
    <div className="flex items-center gap-1" title="Recent health checks, oldest to newest">
      {ordered.map((c) => {
        const style = WAN_HEALTH_STYLE[c.status] ?? WAN_HEALTH_STYLE.unknown;
        return (
          <span
            key={c.id}
            title={`${new Date(c.checkedAt).toLocaleString()} — ${style.label}`}
            className={cn("h-5 w-1.5 rounded-sm", style.bar)}
          />
        );
      })}
    </div>
  );
}

/**
 * Empty-state illustration for the WAN Status card: a router waiting on a
 * dashed, animated link up to an outline-only globe -- deliberately never
 * a solid connected line or filled globe, either of which would visually
 * claim a connection that doesn't exist yet. Same filled-flat-shape
 * language and palette as this file's own `ChartEmptyState`/
 * `DashboardWatchIllustration` (indigo/violet/cyan), sized for a light
 * card background rather than the hero's dark one. Purely decorative --
 * aria-hidden. The dashed line and one LED loop, both respecting
 * useReducedMotion.
 */
function WanSetupIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 200 130" className="h-24 w-auto" fill="none">
      <ellipse cx="100" cy="119" rx="66" ry="5" fill="#6C4EFF" opacity="0.07" />

      <circle
        cx="136"
        cy="42"
        r="24"
        stroke="#8B5CF6"
        strokeWidth="2"
        strokeDasharray="4 5"
        opacity="0.55"
      />
      <path
        d="M112 42h48M136 18a32 32 0 0 1 0 48 32 32 0 0 1 0-48z"
        stroke="#8B5CF6"
        strokeWidth="1.4"
        opacity="0.4"
      />

      <motion.path
        d="M92 100C100 78 114 58 126 48"
        stroke="#22d3ee"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 7"
        animate={shouldReduceMotion ? undefined : { strokeDashoffset: [0, -16] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "linear" }
        }
      />

      <rect x="48" y="90" width="58" height="28" rx="7" fill="#4338ca" />
      <rect x="48" y="90" width="58" height="28" rx="7" fill="#7c3aed" opacity="0.15" />
      <rect x="56" y="84" width="4" height="8" rx="2" fill="#4338ca" />
      <rect x="94" y="84" width="4" height="8" rx="2" fill="#4338ca" />
      <circle cx="60" cy="104" r="2.6" fill="white" />
      <motion.circle
        cx="70"
        cy="104"
        r="2.6"
        fill="#22d3ee"
        animate={shouldReduceMotion ? { opacity: 0.7 } : { opacity: [0.25, 1, 0.25] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <circle cx="80" cy="104" r="2.6" fill="white" opacity="0.5" />
    </svg>
  );
}

type SpeedTestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: IspSpeedTestResult }
  | { status: "error"; message: string };

/** One uplink row plus its own on-demand "Run Speed Test" action -- a real,
 * genuine RouterOS `/tool/fetch` download against THIS link's own router
 * (`ispService.runSpeedTest`, see backend `IspService.run_speed_test`),
 * never a simulated/estimated number. Each link gets its own independent
 * state so testing the backup doesn't clobber a still-fresh primary result
 * (or vice versa) -- a location can have more than one ISP link, and this
 * must work for however many it has, one at a time per link. The founder
 * framed this explicitly as "like speedtest.net" -- the multi-second real
 * wait gets a visible "measuring…" pulse rather than a silent spinner, and
 * upload is honestly labeled as not measurable rather than guessed at (see
 * `IspSpeedTestResult.uploadMbps`'s own doc comment).
 */
function UplinkRow({ link }: { link: IspLink }) {
  const [state, setState] = useState<SpeedTestState>({ status: "idle" });

  const runSpeedTest = async () => {
    if (isDemo()) {
      toast.info("Speed tests run against real router hardware — not available in demo mode.");
      return;
    }
    setState({ status: "running" });
    try {
      const result = await ispService.runSpeedTest(link.id);
      setState({ status: "done", result });
    } catch (err) {
      const message = (err as AppError).message || "Speed test failed.";
      setState({ status: "error", message });
      toast.error(message);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <IspProviderIcon providerName={link.providerName} className="h-4 w-4" />
          <span className="truncate font-medium text-foreground">{link.providerName}</span>
          <span className="shrink-0 text-muted-foreground">
            {link.role === "primary" ? "Primary" : "Backup"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant={link.isActiveUplink ? "default" : "secondary"}
            className="h-5 shrink-0 px-1.5 text-[10px]"
          >
            {link.isActiveUplink ? "Active" : "Standby"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-1.5 text-[10px] font-medium text-primary hover:text-primary"
            disabled={state.status === "running"}
            onClick={runSpeedTest}
            title="Run a real speed test against this link's router"
          >
            <Gauge className={cn("h-3 w-3", state.status === "running" && "animate-spin")} />
            {state.status === "running" ? "Testing…" : "Speed Test"}
          </Button>
        </span>
      </div>
      {state.status === "running" && (
        <div className="flex items-center gap-1.5 pl-[22px] text-[10px] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Measuring real download speed — real traffic, can take up to a minute…
        </div>
      )}
      {state.status === "done" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[22px] text-[10px]">
          <span className="font-semibold text-foreground">
            {state.result.downloadMbps.toFixed(1)} Mbps{" "}
            <span className="font-normal text-muted-foreground">↓</span>
          </span>
          {state.result.latencyMs != null && (
            <span className="text-muted-foreground">
              {state.result.latencyMs.toFixed(0)}ms latency
            </span>
          )}
          <span className="text-muted-foreground/70">upload not measurable on this hardware</span>
        </div>
      )}
    </div>
  );
}

/**
 * The dashboard's own WAN/Internet Connection status widget: real up/down
 * state + a real recent-history timeline for this location's primary
 * uplink, or an honest setup prompt when no `IspLink` is configured yet.
 * Visual weight (border-0 shadow-sm card, same header pattern) matches its
 * row-mates (Recent Users/Recent Alerts) exactly so it doesn't read as a
 * bolted-on afterthought.
 */
function WanStatusCard({ locationId, onManage }: { locationId: string; onManage: () => void }) {
  const wan = useWanSummary(locationId);
  return (
    <Card className="premium-card premium-card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Globe className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Internet Connection</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={onManage}>
          Manage →
        </Button>
      </CardHeader>
      <CardContent>
        {wan.status === "loading" && (
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="h-5 w-1.5 animate-pulse rounded-sm bg-muted" />
              ))}
            </div>
          </div>
        )}
        {wan.status === "empty" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-4 py-6 text-center">
            <WanSetupIllustration />
            <div>
              <p className="text-sm font-semibold text-foreground">No WAN link configured</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect this location's internet uplink to see live up/down status here.
              </p>
            </div>
            <Button size="sm" variant="outline" className="mt-1 text-xs" onClick={onManage}>
              Set up Internet Connection
            </Button>
          </div>
        )}
        {wan.status === "ready" &&
          (() => {
            const active = wan.links.find((l) => l.isActiveUplink) ?? wan.links[0];
            const backup = wan.links.find((l) => l.id !== active.id);
            // Auto fail-BACK (returning to primary once it's healthy again)
            // is gated by the *primary* link's own `autoFailback` flag, not
            // whichever link happens to be active right now -- see backend
            // `IspService._maybe_transition_uplink`'s own primary-role check.
            const primary = wan.links.find((l) => l.role === "primary") ?? active;
            const style = WAN_HEALTH_STYLE[active.healthStatus] ?? WAN_HEALTH_STYLE.unknown;
            const hasBandwidth =
              active.currentDownloadMbps != null || active.currentUploadMbps != null;
            return (
              <div className="space-y-4">
                {/* Connection status -- the headline: is the guest network up
                 * right now, on what provider, and (if not) for how long. */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                      <span className={cn("text-base font-semibold leading-none", style.text)}>
                        {style.label}
                      </span>
                      {active.healthStatusSource === "manual" && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[9px] font-normal text-muted-foreground"
                          title="Manually set by an admin, not the automated health-check sweep"
                        >
                          Manual
                        </Badge>
                      )}
                    </div>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <IspProviderIcon providerName={active.providerName} className="h-4 w-4" />
                      <span className="truncate">
                        {active.providerName} ·{" "}
                        {WAN_CONNECTION_MODE_LABEL[active.connectionMode] ?? active.connectionMode}
                      </span>
                    </span>
                  </div>
                  {active.healthStatus === "unhealthy" && active.unhealthySince && (
                    <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                      Down for {formatDownDuration(active.unhealthySince)}
                    </p>
                  )}
                  <div className="mt-2">
                    <WanRecentChecks checks={wan.checks} />
                  </div>
                </div>

                {/* Bandwidth -- the one number worth calling out on its own,
                 * separated from the denser uplink details below rather than
                 * buried in the same inline stat row as latency/loss. */}
                {hasBandwidth && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Bandwidth · live
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                      {active.currentDownloadMbps != null && (
                        <span className="text-lg font-semibold tabular-nums text-foreground">
                          {active.currentDownloadMbps.toFixed(0)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">Mbps ↓</span>
                        </span>
                      )}
                      {active.currentUploadMbps != null && (
                        <span className="text-lg font-semibold tabular-nums text-foreground">
                          {active.currentUploadMbps.toFixed(0)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">Mbps ↑</span>
                        </span>
                      )}
                      {active.latencyMs != null && (
                        <span className="text-xs text-muted-foreground">
                          {active.latencyMs.toFixed(0)}ms latency
                        </span>
                      )}
                      {active.packetLossPercentage != null && (
                        <span className="text-xs text-muted-foreground">
                          {active.packetLossPercentage.toFixed(1)}% loss
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Uplinks -- primary + backup side by side, so the failover
                 * story (who's active, who's standing by, whether it fails
                 * back automatically) is visible at a glance instead of only
                 * ever showing the one currently-active link. */}
                <div className="space-y-2.5 border-t border-border/60 pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Uplinks
                  </p>
                  {wan.links.map((l) => (
                    <UplinkRow key={l.id} link={l} />
                  ))}
                  {backup && (
                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                      Automatic failover armed — switches to Backup if Primary fails repeated health
                      checks
                      {primary.autoFailback
                        ? ", and returns automatically once Primary recovers."
                        : "; a manual failback is required once Primary recovers."}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
      </CardContent>
    </Card>
  );
}

/**
 * Bandwidth Utilization -- a live, rolling graph of this location's active
 * uplink's real traffic-load rate, `useBandwidthSeries`'s own
 * `IspHealthCheck.downloadMbps`/`uploadMbps` rows plotted over time. This
 * is the founder's own stated ask, directly: not just today's single
 * instantaneous "Bandwidth · live" number (`WanStatusCard` already shows
 * that), but a real, continuously-updating graph so a bandwidth choke is
 * *visible as it happens*, not just inferred after the fact from one
 * static reading.
 *
 * Full width, its own row between the "Charts" grid above and the
 * "Activity" 2-column split below -- adding a third card into either
 * existing column (beside WanStatusCard, or beside Recent Users) would
 * have unbalanced a layout this session already spent two rounds getting
 * even; a dedicated full-width row leaves both of those splits untouched
 * while still sitting immediately above WanStatusCard's own column in
 * reading order.
 *
 * Plots a real dashed reference line at the link's own provisioned
 * `downloadBandwidthMbps` (set on the ISP Link itself, e.g. "this is a
 * 100 Mbps Airtel plan" -- Internet Connection page's Add/Edit ISP Link
 * form, already fully wired) and shows current usage as a % of it, so
 * "all our guests together are choking a 100 Mbps line" is visible at a
 * glance, not just inferred from a raw Mbps number the founder has to
 * mentally compare against a plan they remember. This was the actual,
 * explicit ask behind the whole feature. When no capacity is configured
 * for this link (still true for some real links -- it's an optional
 * field on the ISP Link form, not always filled in), this never
 * fabricates one: no reference line, no %, just the real Mbps numbers,
 * plus a small prompt pointing at where to set it.
 */
function BandwidthUtilizationCard({
  locationId,
  onManage,
}: {
  locationId: string;
  onManage: () => void;
}) {
  const bw = useBandwidthSeries(locationId);
  // Oldest -> newest, left to right -- same convention as WanRecentChecks/
  // IspStatusTimeline above. `listHealthChecks` itself returns newest-first.
  const ordered = bw.status === "ready" ? [...bw.checks].reverse() : [];
  const hasTraffic = ordered.some((c) => c.downloadMbps != null || c.uploadMbps != null);
  // Never a fabricated 0 for a tick where the health check itself failed
  // (unreachable link) -- downloadMbps/uploadMbps stay `null` straight
  // through into the chart's own data, so Recharts (connectNulls={false})
  // draws a real gap instead of a false flatline to zero.
  const chartData = ordered.map((c) => ({
    label: new Date(c.checkedAt).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    download: c.downloadMbps,
    upload: c.uploadMbps,
  }));
  const latest =
    bw.status === "ready"
      ? bw.checks.find((c) => c.downloadMbps != null || c.uploadMbps != null)
      : undefined;
  // Real, provisioned plan capacity for this link -- null for a link
  // where it was never entered (optional field), never a guessed value.
  const capacityDownload = bw.status === "ready" ? bw.link.downloadBandwidthMbps : null;
  const utilizationPct =
    capacityDownload != null && capacityDownload > 0 && latest?.downloadMbps != null
      ? Math.round((latest.downloadMbps / capacityDownload) * 100)
      : null;
  // The single-point "% of plan" badge above only answers "right now" --
  // a coworking space with no per-user cap sees genuinely bursty traffic,
  // so a single reading can easily land low even on a link that's choking
  // for real chunks of the day (or read high on a link that briefly
  // spiked once and is otherwise fine). The real founder question ("is my
  // bandwidth actually choking, should I upgrade my plan") needs a
  // frequency, not a snapshot: of the real samples in this window
  // (~10h at the sweep's own ~10min cadence), how many genuinely hit 90%+
  // of the provisioned plan. Never shown with fewer than 3 real samples --
  // not enough data yet to say anything honest about a pattern.
  const capacitySamples =
    capacityDownload != null && capacityDownload > 0
      ? ordered.filter((c) => c.downloadMbps != null)
      : [];
  const nearCapacityCount = capacitySamples.filter(
    (c) => (c.downloadMbps as number) / (capacityDownload as number) >= 0.9,
  ).length;
  const congestionSummary =
    capacitySamples.length >= 3
      ? {
          count: nearCapacityCount,
          total: capacitySamples.length,
          pct: Math.round((nearCapacityCount / capacitySamples.length) * 100),
        }
      : null;

  return (
    <Card className="premium-card premium-card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Gauge className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm">Bandwidth Utilization</CardTitle>
            <p className="text-xs text-muted-foreground">
              Traffic on {bw.status === "ready" ? bw.link.providerName : "your primary uplink"}, new
              reading roughly every 30 sec
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {latest && (
            <span className="hidden items-baseline gap-3 text-xs sm:flex">
              {latest.downloadMbps != null && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  <span className="font-semibold tabular-nums text-foreground">
                    {latest.downloadMbps.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">Mbps ↓</span>
                </span>
              )}
              {latest.uploadMbps != null && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <span className="font-semibold tabular-nums text-foreground">
                    {latest.uploadMbps.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">Mbps ↑</span>
                </span>
              )}
              {utilizationPct != null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-semibold tabular-nums",
                    utilizationPct >= 90
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                      : utilizationPct >= 70
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
                  )}
                  title={`${latest?.downloadMbps?.toFixed(1)} of ${capacityDownload} Mbps plan (as advertised by your ISP, not independently measured)`}
                >
                  {utilizationPct}% of plan
                </span>
              )}
            </span>
          )}
          <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={onManage}>
            Manage →
          </Button>
        </div>
      </CardHeader>
      {/* A location with a second (usually backup/failover) ISP link
       * shouldn't have that link go completely invisible just because
       * this card's own detail chart only ever tracks one at a time --
       * compact status chips, not a second full-size chart, so a backup
       * link's real health/live-Mbps is visible at a glance without a
       * click-through to Internet Connection, and without disrupting this
       * card's existing single-chart layout rhythm. */}
      {bw.status === "ready" && bw.otherLinks.length > 0 && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Also here
          </span>
          {bw.otherLinks.map((l) => {
            const style = WAN_HEALTH_STYLE[l.healthStatus] ?? WAN_HEALTH_STYLE.unknown;
            return (
              <span
                key={l.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-[11px]"
                title={`${l.providerName} (${l.role === "primary" ? "Primary" : "Backup"}) — ${style.label}`}
              >
                <IspProviderIcon providerName={l.providerName} className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[8rem] truncate font-medium text-foreground">
                  {l.providerName}
                </span>
                <span className="text-muted-foreground">
                  {l.role === "primary" ? "Primary" : "Backup"}
                </span>
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
                <span className={cn("font-medium", style.text)}>{style.label}</span>
                {l.currentDownloadMbps != null && (
                  <span className="text-muted-foreground tabular-nums">
                    {l.currentDownloadMbps.toFixed(0)} Mbps↓
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
      {/* The real "should I upgrade my plan" answer -- always visible
       * (unlike the point-in-time badge above, which is `hidden sm:flex`
       * and only ever shows one instant), and a frequency, not a single
       * reading, since that's what actually tells a coworking space with
       * no per-user cap whether its link is genuinely choking under real
       * combined guest load or just saw one busy moment. */}
      {congestionSummary && (
        <div
          className={cn(
            "mx-4 mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
            congestionSummary.pct >= 30
              ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
              : congestionSummary.count > 0
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
          )}
        >
          <AlertTriangle
            className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", congestionSummary.count === 0 && "hidden")}
          />
          <span>
            {congestionSummary.count === 0 ? (
              <>
                Comfortably under {capacityDownload} Mbps across the last {congestionSummary.total}{" "}
                readings.
              </>
            ) : (
              <>
                Hit 90%+ of your {capacityDownload} Mbps plan in {congestionSummary.count} of the
                last {congestionSummary.total} readings ({congestionSummary.pct}%)
                {congestionSummary.pct >= 30
                  ? " — your guests are likely feeling this. Consider upgrading your plan."
                  : "."}
              </>
            )}
          </span>
        </div>
      )}
      <CardContent>
        <div className="h-56">
          {bw.status === "loading" ? (
            <div className="flex h-full items-end gap-1 px-2 pb-2" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="w-full animate-pulse rounded-t bg-muted"
                  style={{ height: `${20 + (i % 5) * 12}%` }}
                />
              ))}
            </div>
          ) : bw.status === "empty" ? (
            <ChartEmptyState label="No internet connection configured yet." />
          ) : !hasTraffic ? (
            <ChartEmptyState label="No bandwidth samples yet — the next health-check sweep runs within 60 seconds." />
          ) : (
            // Settles in once real data replaces the loading skeleton/empty
            // state -- mounts fresh into this branch each time bw.status
            // flips to "ready", so it fades the *first real render*, not
            // every subsequent poll tick (the chart itself keeps
            // `isAnimationActive={false}` on its own Areas, untouched).
            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bw-down" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bw-up" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={32}
                    domain={
                      capacityDownload != null
                        ? [0, (dataMax: number) => Math.max(dataMax, capacityDownload) * 1.1]
                        : [0, "auto"]
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                    formatter={(
                      value: number | string | Array<number | string> | undefined,
                      name: string | number,
                    ) => [
                      typeof value !== "number" ? "No reading" : `${value.toFixed(1)} Mbps`,
                      name === "download" ? "Download" : "Upload",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="download"
                    name="download"
                    stroke="#14b8a6"
                    fill="url(#bw-down)"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    name="upload"
                    stroke="#8b5cf6"
                    fill="url(#bw-up)"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {/* Real, provisioned plan capacity -- the actual founder ask
                    behind this whole card ("all our guests together
                    choking a 100 Mbps line" should be visible, not just
                    inferred). Only drawn when a real value was entered on
                    the ISP Link itself; never a guessed threshold. */}
                  {capacityDownload != null && (
                    <ReferenceLine
                      y={capacityDownload}
                      stroke="#14b8a6"
                      strokeDasharray="5 4"
                      strokeOpacity={0.7}
                      label={{
                        value: `${capacityDownload} Mbps plan`,
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "#14b8a6",
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </BlurFade>
          )}
        </div>
        {bw.status === "ready" && capacityDownload == null && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Set {bw.link.providerName}'s plan speed to see utilization as a %.{" "}
            <button
              type="button"
              onClick={onManage}
              className="font-medium text-primary hover:underline"
            >
              Set it →
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Per-device-type hardware summary for this location's monitored network
 * hardware (Access Points, Printers, Routers, Cameras, Other) -- the same
 * `useDeviceStore` records and `d.locationId === locationId` filter the
 * Devices page's own `NetworkHardwareView` (BasicFeatureViews.tsx) already
 * uses, and the exact same `DEVICE_TYPE_META` icon/color map, imported from
 * there rather than re-declared here, so a "Router" reads as the same
 * indigo-violet `Router` icon everywhere in the app, not a second
 * lookalike-but-different palette. Up/down counts are real, derived from
 * each device's own `deriveStatus`-computed `status`, not decorative.
 * Sibling to WanStatusCard immediately above it in the layout -- same card
 * shell, header badge, and "Manage ->" pattern, just pointed at the
 * Devices feature page instead of Internet Connection.
 */
function DeviceStatusCard({ locationId, onManage }: { locationId: string; onManage: () => void }) {
  const { devices } = useMonitoredHardware(locationId);
  const downCount = devices.filter((d) => d.status === "down").length;
  const unknownCount = devices.filter((d) => d.status === "unknown").length;

  return (
    <Card className="premium-card premium-card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <HardDrive className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Network Hardware</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={onManage}>
          Manage →
        </Button>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-lg border border-dashed border-border bg-card/40 px-4 py-6 text-center">
            {/* The one Aceternity moment this surface gets (design v3 Part
             * 4): a low-frequency, first-run "connect your first
             * router"-adjacent empty state, and nowhere else on this page.
             * See background-boxes.tsx's own comment for why it's a small
             * static re-author, not the registry component verbatim. */}
            <BackgroundBoxes />
            {/* Everything a user actually reads/clicks stays in its own
             * `relative` stacking layer, painted after (so: above) the
             * absolutely-positioned decorative grid regardless of DOM
             * order inside it -- otherwise the plain-flow Button below
             * would paint *under* an `absolute` sibling per normal CSS
             * stacking rules. */}
            <div className="relative flex flex-col items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No hardware set up yet</p>
                {/* Sitting right below the "routers online" KPI at the top of
                 * this same dashboard, an unqualified "no hardware" read as
                 * contradicting it (bug report from a product review: "wait,
                 * don't I have a router?"). This card only tracks *other*
                 * hardware you add yourself (APs, printers, etc.) -- your
                 * router is already monitored automatically and isn't meant
                 * to show up here, so that needs to be said explicitly. */}
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a device by MAC address to start monitoring it. Your router is already tracked
                  separately above.
                </p>
              </div>
              <Button size="sm" variant="outline" className="mt-1 text-xs" onClick={onManage}>
                Set up hardware
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {DEVICE_TYPES.map((type) => {
                const typeDevices = devices.filter((d) => d.type === type);
                if (typeDevices.length === 0) return null;
                const meta = DEVICE_TYPE_META[type];
                const Icon = meta.icon;
                const typeDown = typeDevices.filter((d) => d.status === "down").length;
                return (
                  <div key={type} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span
                        title={type}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white",
                          meta.gradient,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {type}
                        {typeDevices.length !== 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{typeDevices.length}</span>
                      {typeDown > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400"> · {typeDown} down</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400"> · all up</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
              <span className="text-muted-foreground">
                {devices.length} device{devices.length !== 1 ? "s" : ""} total
              </span>
              {downCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {downCount} down · longest{" "}
                  {formatSince(
                    devices
                      .filter(
                        (d): d is typeof d & { statusChangedAt: string } =>
                          d.status === "down" && d.statusChangedAt != null,
                      )
                      .sort(
                        (a, b) =>
                          new Date(a.statusChangedAt).getTime() -
                          new Date(b.statusChangedAt).getTime(),
                      )[0].statusChangedAt,
                  )}
                </span>
              ) : unknownCount > 0 ? (
                // Never conflated with "up" -- a device just registered (or
                // whose router hasn't synced yet) hasn't actually been
                // confirmed reachable, see useMonitoredHardware's own
                // honesty note on "unknown" status.
                <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  {unknownCount} not yet observed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  All devices up
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact corner illustration for the Dashboard hero card: a mini brand
 * shield-and-signal mark beside a live pulse-monitor with a calm "all
 * clear" checkmark, and a signal-bars motif -- same filled-flat-shape
 * character language as the Select Location page's hero illustration
 * (both now built from the same shield mark), but a quieter pose sized
 * for a hero-card corner accent rather than a full side panel, since this
 * page is a data-first "check the numbers" moment, not a "which venue"
 * moment. Kept small and semi-transparent so it never competes with the
 * three big KPI numbers already carrying this card. Replaces the earlier
 * cartoon figure, which read as consumer clip-art rather than enterprise
 * network monitoring.
 *
 * Purely decorative -- aria-hidden. The pulse sweep and "all clear" ring
 * loop, so both respect useReducedMotion.
 */
function DashboardWatchIllustration() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 210"
      className="h-auto w-full max-w-[260px] opacity-90"
      fill="none"
    >
      <defs>
        <filter id="watch-illo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <linearGradient id="watch-pulse-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <linearGradient
          id="watch-shield-grad"
          x1="54"
          y1="114"
          x2="115"
          y2="190"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <circle
        cx="215"
        cy="70"
        r="46"
        fill="#7c3aed"
        opacity="0.16"
        filter="url(#watch-illo-glow)"
      />

      <rect
        x="118"
        y="46"
        width="118"
        height="80"
        rx="10"
        fill="#241f4d"
        stroke="white"
        strokeOpacity="0.12"
        strokeWidth="1.5"
      />
      <rect
        x="118"
        y="46"
        width="118"
        height="80"
        rx="10"
        fill="url(#watch-pulse-stroke)"
        fillOpacity="0.05"
      />
      <motion.path
        d="M130 90h16l8-22 10 40 8-28 6 10h56"
        stroke="url(#watch-pulse-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
      />
      <rect x="164" y="126" width="26" height="10" rx="2" fill="#241f4d" />
      <rect x="150" y="136" width="54" height="5" rx="2.5" fill="white" fillOpacity="0.1" />

      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <circle cx="228" cy="54" r="13" fill="#1e1b4b" stroke="#22d3ee" strokeWidth="2" />
        <path
          d="M222 54l4 4 8-8"
          stroke="#22d3ee"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>

      <path
        d="M84.5 116 L112.68 127.07 V147.8 C112.68 165.69 101.25 179.6 84.5 185.5 C67.75 179.6 56.32 165.69 56.32 147.8 V127.07 Z"
        fill="url(#watch-shield-grad)"
      />
      <path
        d="M65.26 138.76a27.54 27.54 0 0 1 38.48 0"
        stroke="#ffffff"
        strokeWidth="5.45"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      <path
        d="M73.43 148.71a16.76 16.76 0 0 1 22.15 0"
        stroke="#ffffff"
        strokeWidth="5.45"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="84.5" cy="157.58" r="4.3" fill="#ffffff" />

      <g>
        {[0, 1, 2, 3].map((i) => (
          <motion.rect
            key={i}
            x={20 + i * 10}
            y={188 - (i + 1) * 9}
            width="6"
            height={(i + 1) * 9}
            rx="2"
            fill={["#8B5CF6", "#22d3ee", "#f0abfc", "#8B5CF6"][i]}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.08, ease: "easeOut" }}
          />
        ))}
      </g>

      <line x1="10" y1="196" x2="250" y2="196" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
    </svg>
  );
}

/** The real customer dashboard, rendered both at the bare "/" root
 * (index.tsx, the normal path for an authenticated customer) and as the
 * redirect target every "/c" (c.index.tsx) alias resolves to. Lives in its
 * own file, not a route file -- see this file's header comment for why
 * that split matters (routeTree.gen.ts eagerly imports every route file,
 * so a route file was the one place this could NOT safely live). */
export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  // index.tsx (this component's only real caller now) already guarantees
  // activeLocationId is set before rendering this -- non-null assertion
  // documents that invariant rather than threading an unnecessary
  // undefined check through every hook call below that expects a plain
  // string.
  const locationId = activeLocationId!;
  const { data: d, isLoading, refetch } = useCustomerDashboard(locationId);
  // There was a `useCustomerUsers(locationId, { page: 1, pageSize: 6 })`
  // here whose result was never read by anything -- the "Recent Users"
  // table below renders `d.recentUsers`, which `getDashboard()` builds from
  // its own `/guest-sessions?page_size=100` leg. It survived because
  // `@typescript-eslint/no-unused-vars` is off in this repo's eslint
  // config, so nothing ever flagged the binding.
  //
  // It was not free: `customerService.getUsers()` issues THREE requests --
  // `/guest-sessions?page=1&page_size=6`, `/connected-devices?page_size=100`
  // and `/guests?page_size=100`. That last one is byte-identical to the
  // `/guests` read `getDashboard()` already makes for the same table's
  // identities, which is how a live capture of app.wyfyguest.com caught
  // `/guests` twice per load. It was not even a useful cache warm: no other
  // caller asks for pageSize 6 (the Users page uses 8, the feature-page
  // Users view 20), so the entry it filled was never read either.
  // Read through the SSR-safe useIsDemo() hook, not isDemo() directly --
  // isDemo() reads localStorage synchronously, so calling it straight in
  // render can flip value between the server pass (no window -> false)
  // and the client's first hydration pass (real token -> true), which
  // changes whether PlanRenewalTicket's chip renders at all (a real
  // "Hydration failed" #418 -- see the sibling fix in
  // customer.$locationId.$feature.tsx for the concrete repro).
  const demoFlag = useIsDemo();
  const billing = useMyBillingDashboard(
    demoFlag ? undefined : activeLocation?.organizationId,
    activeLocation?.organizationName,
  );
  // Raw ISO, not pre-formatted -- CustomerHeader's PlanRenewalTicket needs
  // the real date to compute a live countdown/urgency tier, not just a label.
  const planExpiryIso = demoFlag ? DEMO_PLAN_RENEWAL_ISO : billing.data?.renewalDate;
  // A `useCustomerLocations()` fetch and a store-resync effect/guard used
  // to sit here. Their original argument, kept verbatim so it can be
  // answered rather than deleted:
  //
  //   "The store's activeLocationId is only populated by clicking a
  //    location card on /customer (see customer.index.tsx's handleSelect)
  //    -- a direct deep link/bookmark/refresh of this URL arrives with it
  //    unset or pointing at a different location. Previously that
  //    hard-blocked the whole page behind a bare 'Back' button even though
  //    every fetch here (useCustomerDashboard/useCustomerUsers) is already
  //    keyed off the URL's own locationId, not the store. Resync the store
  //    from the same locations list /customer itself uses instead of
  //    blocking."
  //
  // That was right when this component took its locationId from the URL.
  // It no longer does. Since the move to the bare "/" route this file's
  // header comment describes, the route carries no params and `locationId`
  // is assigned from `activeLocationId` five lines above -- so
  // `activeLocationId !== locationId` is not merely usually false, it is
  // false by construction, on every render, forever. The effect returned on
  // its first line and the guard's whole branch (spinner / "Location not
  // found" / `return null`) was unreachable.
  //
  // The fetch behind it was not free. `customerService.listLocations()`
  // fans out `/organizations/{id}/locations` and then, per location,
  // `/locations/{id}/routers?page_size=100` and
  // `/guest-sessions?location_id=…&page_size=50`. That routers read is
  // byte-identical -- same params, same X-Organization-Id + X-Location-Id
  // -- to the one `getDashboard()` makes for this same location's liveness,
  // which is the second `/locations/{id}/routers` a live capture of
  // app.wyfyguest.com found on every dashboard load.
  //
  // Nothing rendered changes: no JSX read `locationsList`. The one thing
  // lost is a cache warm of `customerKeys.locations`, which only the legacy
  // `/customer/$locationId/*` compat redirects consume (via
  // `resolveCustomerLocationById`) and which /switch-location fetches for
  // itself anyway -- neither is reachable *from* this page without a
  // navigation that would fetch it regardless.
  //
  // IF THIS COMPONENT EVER TAKES A locationId FROM THE URL AGAIN, restore
  // the resync (git history has it): the guard becomes live the moment
  // `locationId` stops being `activeLocationId`.
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCustomerCommandPalette();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const dataMasking = useDataMasking();
  const masked = dataMasking.masked;
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setQuoteIndex((i) => (i + 1) % DASHBOARD_QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  // The header renders above the `isLoading ? ... : d ? ...` split, so it
  // needs an answer in all three of those states. Two of them are not
  // "offline":
  //  - still loading -> "Checking…", not a red dot;
  //  - loaded but no liveness on the object (a location summary persisted
  //    by an older build of this app, read back out of zustand's
  //    localStorage) -> "Can't tell", not a colour chosen by an else.
  const headerLiveness: LocationLiveness =
    d?.liveness ?? activeLocation?.liveness ?? (isLoading ? CHECKING_LIVENESS : UNKNOWN_LIVENESS);

  // (The `activeLocationId !== locationId` guard that stood here -- spinner
  // / "Location not found" / `return null` -- was unreachable by
  // construction and is gone with the fetch that fed it. See the comment
  // above the `sidebar` state for the full argument and for exactly what
  // would have to change to make it live again.)

  const handleNav = (id: string) => navigate({ to: customerFeatureHref(id) });
  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };
  const handleSwitchLocation = () => {
    navigate({ to: "/switch-location" });
  };

  return (
    <SidebarProvider
      className="bg-muted/30"
      style={
        {
          "--primary": "#6C4EFF",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      {/* Sidebar -- same shared component/grouped-nav data source every
          other customer page (Reports, Campaigns, Policies, Vouchers,
          Portal, Devices, ISP Details, Admin Logs, etc., all rendered via
          customer.$locationId.$feature.tsx) uses, so Dashboard can't drift
          out of visual/structural sync with its siblings again. */}
      <CustomerSidebar
        activeFeatureId="dashboard"
        subtitle={activeLocation?.name}
        dataMasking={dataMasking}
      />

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerHeader
          title={
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Wifi className="h-5 w-5 shrink-0 text-white/70" />
              <p className="truncate text-sm font-semibold">
                {activeLocation?.name ?? "Dashboard"}
              </p>
              {/* Was a three-way ternary over `activeLocation?.status`
               * whose else-branch was a red dot -- so a location that had
               * simply not loaded yet, or whose routers could not be read,
               * rendered as a confident "offline", and the label beside it
               * was the raw backend enum word `capitalize`d.
               *
               * Reads the live dashboard query's own verdict rather than
               * the persisted store: `activeLocation` comes out of a
               * zustand `persist` store, so a summary written before this
               * field existed has no `liveness` at all -- which must show
               * as "can't tell", never as a colour picked by an else. */}
              <LocationLivenessBadge
                liveness={headerLiveness}
                surface="dark"
                className="hidden sm:inline-flex"
              />
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full sm:hidden",
                  HEADER_DOT[livenessTone(headerLiveness.state)],
                )}
              />
            </div>
          }
          locationId={locationId}
          planExpiryIso={planExpiryIso}
          onOpenSearch={() => setPaletteOpen(true)}
          onRefresh={() => refetch()}
          user={user}
          onSwitchLocation={handleSwitchLocation}
          onChangePassword={() => setChangePwOpen(true)}
          onTfaSettings={() => setTfaOpen(true)}
          onLogout={handleLogout}
        />

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl bg-muted" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-muted" />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-72 rounded-2xl bg-muted" />
                ))}
              </div>
            </div>
          ) : d ? (
            <div>
              {/* Full-bleed dark section -- was a floating rounded-3xl card
               * on a plain page (4 surface changes: dark card -> light page
               * -> light status strip -> light charts). Now the hero AND
               * the status strip live on one continuous dark surface that
               * spans the content column edge-to-edge (negative margins
               * cancel <main>'s own padding), and the page transitions from
               * dark to light exactly once, right before the charts. */}
              <div className="-mx-4 -mt-4 relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] text-white shadow-xl shadow-indigo-950/30 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#6C4EFF]/30 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-[#8B5CF6]/20 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.15]"
                  style={{
                    backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />
                <div className="relative mx-auto max-w-7xl px-4 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-5 lg:px-8">
                  {/* Illustration scoped to its own relative sub-container
                   * covering only the eyebrow/headline/3-number portion --
                   * it was previously absolute-positioned against the WHOLE
                   * hero including the status strip below, so once that
                   * strip moved into this same dark section the card grew
                   * taller and the "bottom-right" anchor drifted down onto
                   * the status strip instead of sitting quietly in this
                   * top portion's corner. */}
                  <div className="relative">
                    <div className="pointer-events-none absolute -top-2 right-0 hidden w-[110px] sm:block lg:w-[160px]">
                      <DashboardWatchIllustration />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
                      This location, right now
                    </p>
                    {/* Each metric gets a label above the number and, only
                     * where a real comparison value actually exists in
                     * `d.kpis` (never fabricated), a context line below it --
                     * "Online right now" is the one metric with a genuine
                     * same-day reference point (peakConcurrent, derived from
                     * real hourly session counts, see customer.service.ts).
                     * Uptime has no real day-over-day or prior-period figure
                     * to compare against yet, so it intentionally shows label
                     * + number only rather than inventing a trend.
                     *
                     * "Guests today" leads. It used to sit in the secondary
                     * strip below at `text-xs` while an "Active sessions"
                     * tile -- fed by the same variable as "Online right now",
                     * see customer.service.ts's note -- took a 36-48px slot
                     * beside it. So the number a venue owner opens this page
                     * to find was the smallest thing in the hero and its
                     * duplicate was the largest. Dropping the duplicate frees
                     * exactly the slot "Guests today" needed.
                     *
                     * "SLA uptime" is now "Uptime": a cafe owner has no SLA,
                     * and the word was ours, not theirs. */}
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {[
                        {
                          label: "Guests today",
                          value: d.kpis.todayGuests.toLocaleString(),
                          context: null,
                        },
                        {
                          label: "Online right now",
                          value: d.kpis.onlineUsers.toLocaleString(),
                          context: `Today's peak: ${d.kpis.peakConcurrent.toLocaleString()}`,
                        },
                        // Omitted entirely (not a fake "--%") when there's no
                        // active uplink / no health-check data yet to compute
                        // a real figure from -- see getDashboard()'s comment.
                        ...(d.kpis.slaUptime != null
                          ? [
                              {
                                label: "Uptime",
                                value: formatUptimePercent(d.kpis.slaUptime),
                                context: null,
                              },
                            ]
                          : []),
                      ].map((k, i) => (
                        <motion.div
                          key={k.label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                            {k.label}
                          </p>
                          <p className="font-display mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl sm:leading-none">
                            {k.value}
                          </p>
                          {k.context && (
                            <p className="mt-1 text-xs font-medium text-white/60">{k.context}</p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  {/* "Routers online" deliberately left out of this row --
                   * it's the exact same onR/routers.length pair the "Core
                   * systems" status strip right below already shows as
                   * "Routers 1/1" (see customer.service.ts's getDashboard,
                   * both read off the same two variables), so showing it
                   * here too was pure duplication a few pixels apart, not a
                   * second real signal. This row now owns guest-activity
                   * numbers only; the strip below owns infrastructure
                   * health only -- each stat has exactly one home. */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/10 pt-2.5 text-xs tabular-nums text-white/70">
                    {/* "guests today" was promoted out of this strip into the
                     * hero row above -- it is the question the page is opened
                     * to answer, and it was the smallest number on it. */}
                    {[{ label: "avg session", value: `${d.kpis.avgSession} min` }].map((s) => (
                      <span key={s.label}>
                        <span className="font-semibold text-white">{s.value}</span>{" "}
                        <span className="text-white/50">{s.label}</span>
                      </span>
                    ))}
                    {/* Surfaced only when it matters -- a security-relevant
                     * number that was in the data but never shown anywhere.
                     * Silent when zero, so it never clutters a clean day. */}
                    {d.kpis.failedLogins > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/15 px-2.5 py-0.5 font-medium text-rose-200">
                        <AlertTriangle className="h-3 w-3" />
                        {d.kpis.failedLogins} failed login{d.kpis.failedLogins === 1 ? "" : "s"}{" "}
                        today
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-white/50">
                    <Quote className="h-3 w-3 shrink-0 text-white/30" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={quoteIndex}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.4 }}
                      >
                        {DASHBOARD_QUOTES[quoteIndex]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="mx-auto max-w-7xl space-y-8 pt-6">
                {/* Status strip -- moved out of the dark hero into its own
                 * light card (same treatment as the chart cards below it)
                 * so the hero itself stays short instead of the health
                 * checks adding another full row of dark-surface height. */}
                {/* The two icons that used to be hard-coded
                 * `text-emerald-500` regardless of value now read off the
                 * real verdict, so "Routers 0/1" can no longer sit behind
                 * a green tick. The ISP pill keeps NO status icon at all:
                 * `d.health.isp` is derived from `/dashboard/organization`
                 * answering, not from any uplink's health (see
                 * getDashboard()), and a green tick on it would be the
                 * same fabricated reassurance as the "WireGuard:
                 * Reachable" stat the fleet wizard had to remove. */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-3 premium-card">
                    <p className="shrink-0 text-xs font-medium text-muted-foreground">
                      Core systems, checked continuously
                    </p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <CheckCircle
                          aria-hidden
                          className={cn("h-3.5 w-3.5", CORE_ICON[livenessTone(d.liveness.state)])}
                        />
                        <span className="text-muted-foreground">System</span>
                        <span className="font-semibold text-foreground">
                          {d.health.systemHealth}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Router
                          aria-hidden
                          className={cn("h-3.5 w-3.5", CORE_ICON[livenessTone(d.liveness.state)])}
                        />
                        <span className="text-muted-foreground">Routers</span>
                        <span className="font-semibold text-foreground">
                          {d.health.routersOnline}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Activity aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">ISP</span>
                        <span className="font-semibold text-foreground">{d.health.isp}</span>
                      </span>
                      {locationLivenessIsReassuring(d.liveness) && (
                        <LocationLivenessBadge liveness={d.liveness} />
                      )}
                    </div>
                  </div>

                  {/* Which precondition is unmet, in the operator's words,
                   * plus when we last actually heard from the router.
                   * Renders nothing when the venue is plainly live. */}
                  <LocationLivenessExplainer liveness={d.liveness} />
                </div>

                {/* Charts */}
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Traffic and hardware, over the last 24 hours.
                  </p>
                  <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-1 premium-card premium-card-hover">
                      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
                          <TrendingUp className="h-3.5 w-3.5 text-white" />
                        </div>
                        <CardTitle className="text-sm">Guests online, last 24h</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-56">
                          {/* Real (non-demo) dashboards always hand back a
                           * full 24-bucket array here -- one entry per hour,
                           * `users: 0` for every hour nothing happened --
                           * never a genuinely empty array, so checking every
                           * bucket for `users === 0` (true for both a
                           * genuinely empty array and an all-zero one) is
                           * what actually catches "no guest activity today." */}
                          {d.usersTrend.every((h) => h.users === 0) ? (
                            <ChartEmptyState label="No guest activity yet today." />
                          ) : (
                            // Settles in rather than popping on mount -- Magic
                            // UI's "Blur Fade" idea, wrapping the chart's
                            // container only; Recharts' own render/animation
                            // props are untouched (design v3 Part 4).
                            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                  data={d.usersTrend}
                                  margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                                >
                                  <defs>
                                    <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                                      <stop
                                        offset="0%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0.35}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0.02}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="var(--border)"
                                    strokeOpacity={0.6}
                                  />
                                  <XAxis
                                    dataKey="hour"
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={3}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={38}
                                  />
                                  <Tooltip
                                    cursor={{ stroke: "var(--primary)", strokeOpacity: 0.35 }}
                                    contentStyle={{
                                      borderRadius: "12px",
                                      border: "1px solid var(--border)",
                                      background: "var(--popover)",
                                      color: "var(--popover-foreground)",
                                      fontSize: 12,
                                      boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
                                    }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="users"
                                    stroke="var(--primary)"
                                    fill="url(#ug)"
                                    strokeWidth={2.25}
                                    activeDot={{
                                      r: 4,
                                      strokeWidth: 2,
                                      stroke: "var(--background)",
                                    }}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </BlurFade>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="lg:col-span-1 premium-card premium-card-hover">
                      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
                          <Router className="h-3.5 w-3.5 text-white" />
                        </div>
                        <CardTitle className="text-sm">What's connected</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-56">
                          {d.deviceDistribution.length === 0 ? (
                            <ChartEmptyState label="No devices connected yet." />
                          ) : (
                            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
                              <div className="flex h-full flex-col justify-center gap-2.5">
                                {(() => {
                                  const max = Math.max(
                                    ...d.deviceDistribution.map((x) => x.value),
                                    1,
                                  );
                                  return d.deviceDistribution.map((item, i) => (
                                    <div key={item.name} className="flex items-center gap-3">
                                      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                                        {item.name}
                                      </span>
                                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${(item.value / max) * 100}%`,
                                            backgroundColor:
                                              DEVICE_COLORS[i % DEVICE_COLORS.length],
                                          }}
                                        />
                                      </div>
                                      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums">
                                        {item.value}
                                      </span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </BlurFade>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="lg:col-span-1 premium-card premium-card-hover">
                      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
                          <Activity className="h-3.5 w-3.5 text-white" />
                        </div>
                        <CardTitle className="text-sm">Sessions by hour</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-56">
                          {/* Same real-data shape as usersTrend above -- a
                           * full 24-hour array of `sessions: 0` buckets, not
                           * an empty one, so the "all zero" check (not just
                           * "empty") is what actually catches a quiet day. */}
                          {d.hourlySessions.every((h) => h.sessions === 0) ? (
                            <ChartEmptyState label="No session activity yet today." />
                          ) : (
                            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={d.hourlySessions}
                                  margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                                >
                                  <defs>
                                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                                      <stop
                                        offset="0%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0.95}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="var(--chart-1)"
                                        stopOpacity={0.55}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="var(--border)"
                                    strokeOpacity={0.6}
                                  />
                                  <XAxis
                                    dataKey="hour"
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={38}
                                  />
                                  <Tooltip
                                    cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
                                    contentStyle={{
                                      borderRadius: "12px",
                                      border: "1px solid var(--border)",
                                      background: "var(--popover)",
                                      color: "var(--popover-foreground)",
                                      fontSize: 12,
                                      boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
                                    }}
                                  />
                                  <Bar
                                    dataKey="sessions"
                                    fill="url(#sg)"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={26}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </BlurFade>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Bandwidth Utilization -- a real, live-updating graph
                 * (not just a single "right now" number), so a congestion
                 * spike or drop is visible on-screen as it happens. Its
                 * own full-width row, deliberately not folded into either
                 * the 3-card "Charts" grid above (a 4th card there would
                 * wrap 3+1) or either column of the "Activity" split below
                 * (which stays exactly as balanced as it already was) --
                 * see BandwidthUtilizationCard's own comment for the full
                 * reasoning. */}
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Bandwidth on your primary uplink, sampled roughly every 30 seconds.
                  </p>
                  <BandwidthUtilizationCard
                    locationId={locationId}
                    onManage={() => handleNav("isp-details")}
                  />
                </div>

                {/* Activity -- Recent Users stays a data table (it already
                 * is one, correctly); Recent Alerts becomes a left-accent
                 * timeline instead of a second plain list, so the two cards
                 * read as different kinds of information, not visual
                 * twins. Their `time` fields are pre-formatted strings
                 * ("2 min ago"), not real timestamps, so they aren't
                 * safely mergeable into one interleaved feed.
                 *
                 * Both columns are a real 2-card stack, not a 1-vs-3 split.
                 * An earlier pass put Recent Alerts, Internet Connection,
                 * AND Network Hardware all in the right column with
                 * `items-start` so the short Recent Users table stopped
                 * being CSS-stretched to match -- that fixed the stretch
                 * bug but not the actual complaint: the right column still
                 * ran ~2x taller than the left, leaving a wide strip of
                 * empty page background beside Recent Users. Moving
                 * Network Hardware over here (a compact per-type summary,
                 * not a big card) instead of leaving it in the tall stack
                 * brings both columns to comparable real content height --
                 * a genuine rebalance, not another alignment tweak. */}
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Who showed up, what needed a look, and whether the internet's up.
                  </p>
                  {/* items-start still matters even with two balanced 2-card
                   * columns: their exact heights won't ever match to the
                   * pixel (a table's row count vs. prose content), so this
                   * keeps each column sized to its own content rather than
                   * Grid stretching one to match the other. */}
                  <div className="grid items-start gap-6 lg:grid-cols-2">
                    <div className="flex flex-col gap-6">
                      <Card className="premium-card premium-card-hover">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-sm">Recent Users</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary"
                            onClick={() => handleNav("users")}
                          >
                            View all →
                          </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                          {d.recentUsers.length === 0 ? (
                            <p className="px-6 py-8 text-center text-xs text-muted-foreground">
                              No guests have connected yet — check back once someone joins the
                              network.
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                                    User
                                  </TableHead>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide hidden md:table-cell">
                                    Device
                                  </TableHead>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                                    Time
                                  </TableHead>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                                    Status
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {d.recentUsers.map((u) => (
                                  <TableRow key={u.id} className="border-b">
                                    <TableCell>
                                      <p className="text-sm font-medium">{u.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {masked ? maskEmail(u.email) : u.email}
                                      </p>
                                    </TableCell>
                                    <TableCell className="text-sm hidden md:table-cell">
                                      {u.device}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {u.time}
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1 text-xs font-medium",
                                          u.status === "online"
                                            ? "text-emerald-500"
                                            : "text-muted-foreground",
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            u.status === "online"
                                              ? "bg-emerald-500"
                                              : "bg-muted-foreground",
                                          )}
                                        />
                                        {u.status}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                      {/* Internet Connection pairs with Recent Users (both
                       * naturally the fuller of their row -- a real 6-row
                       * table and, once the on-demand Speed Test/Uplinks UI
                       * was added, the taller of the two bottom cards) so
                       * this column and the Recent Alerts/Network Hardware
                       * one stay comparable in real content height. Network
                       * Hardware's empty state is genuinely short whenever a
                       * location has no monitored hardware yet, same as
                       * Recent Alerts' "All clear" state is short when
                       * there's nothing to flag -- pairing the two short
                       * ones together (and the two full ones together)
                       * rebalances the columns without any CSS stretch
                       * trick, matching the comment above this grid. */}
                      <WanStatusCard
                        locationId={locationId}
                        onManage={() => handleNav("isp-details")}
                      />
                    </div>
                    <div className="flex flex-col gap-6">
                      <Card className="premium-card premium-card-hover">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-sm">Recent Alerts</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary"
                            onClick={() => handleNav("alerts")}
                          >
                            All →
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-2 p-3">
                          {d.recentAlerts.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                              All clear. Nothing needs your attention right now.
                            </p>
                          ) : (
                            d.recentAlerts.map((a, i) => {
                              const border =
                                a.type === "error"
                                  ? "border-rose-500"
                                  : a.type === "warning"
                                    ? "border-amber-500"
                                    : a.type === "success"
                                      ? "border-emerald-500"
                                      : "border-sky-500";
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-start gap-3 rounded-xl border-l-4 bg-muted/40 py-2.5 pl-3 pr-3",
                                    border,
                                  )}
                                >
                                  {a.type === "error" && (
                                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                                  )}
                                  {a.type === "warning" && (
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                  )}
                                  {a.type === "success" && (
                                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                  )}
                                  {a.type === "info" && (
                                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm">{a.msg}</p>
                                    <p className="text-xs text-muted-foreground">{a.time}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                      <DeviceStatusCard
                        locationId={locationId}
                        onManage={() => handleNav("devices")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Couldn't load this dashboard</p>
              <p className="mb-4 text-sm">Your connection or our servers hiccuped — try again.</p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
      <CustomerCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AssistantWidget />
    </SidebarProvider>
  );
}
