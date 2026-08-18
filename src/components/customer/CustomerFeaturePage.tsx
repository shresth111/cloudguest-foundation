import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CUSTOMER_NAVS, customerFeatureHref } from "@/lib/customerNav";
import { AgentsPage } from "@/components/features/AgentsPage";
import { CampaignsPage } from "@/components/features/CampaignsPage";
import { VouchersPage } from "@/components/features/VouchersPage";
import { PortalPage } from "@/components/features/PortalPage";
import PoliciesHub from "@/components/features/PoliciesHub";
import { AdvancedPage } from "@/components/features/FeatureComponents";
import ManageTeamsPage from "@/components/features/ManageTeamsPage";
import WhiteList from "@/components/features/WhiteList";
import UserReports from "@/components/features/UserReports";
import NetworkActivityLog from "@/components/features/NetworkActivityLog";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import AssistantWidget from "@/components/features/AssistantWidget";
import TicketsPage from "@/components/features/TicketsPage";
import BrandAssetPage from "@/components/features/BrandAssetPage";
import { HowItWorksView } from "@/components/customer/HowItWorksPage";
import { NetworkHardwareView } from "@/components/customer/BasicFeatureViews";
import { maskEmail, maskMac, maskPhone, DEMO_PLAN_RENEWAL_ISO } from "@/components/features/HeaderControls";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { useCustomerFeatureData } from "@/hooks/useCustomerDashboard";
import { useIsDemo, useCustomerDashboard, useCustomerUsers, useDataMasking } from "@/hooks/useCustomerDashboard";
import {
  AlertsView, OpenHoursView, NotificationView, IspDetailsView,
  AdminLogsView, MacAuthView, PortForwardingView, DhcpView, VlansView, VoipView,
  WebsiteBlockingView,
  DebuggingView, HotspotView, GenericFeatureView,
} from "@/components/features/OperationsFeatures";
import { toast } from "sonner";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import {
  Wifi, Users, CheckCircle,
  AlertTriangle, Activity, XCircle, Download, Quote,
} from "lucide-react";

/**
 * The shared shell + content-switch for every customer feature page
 * (reports, alerts, campaigns, portal, vouchers, policies, ...) --
 * extracted from what used to be c.$feature.tsx's own route component so
 * each feature can get a real, distinct top-level URL (see e.g.
 * reports.tsx, alerts.tsx) instead of all sharing one `/c/$feature`
 * dynamic route, while still sharing this one ~900-line implementation
 * instead of duplicating it per file.
 *
 * `feature` is now a plain prop (each thin route file passes its own
 * fixed id in) rather than read from `Route.useParams()` -- this
 * component has no route context of its own anymore. The few feature ids
 * that couldn't get their bare name as a URL (campaigns/portal/vouchers
 * already belong to the pre-existing operator-shell/guest-portal routes
 * -- see customerNav.ts's own comment) still pass their real feature id
 * here unchanged; only the URL segment differs, not the id used for
 * sidebar highlighting/permissions/labels.
 */
export function CustomerFeaturePage({ feature }: { feature: string }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  // Every route file rendering this component guards on
  // requireActiveLocationId() in its own beforeLoad before mounting this.
  const locationId = activeLocationId!;
  // Read through the SSR-safe useIsDemo() hook, not isDemo() directly --
  // isDemo() reads localStorage synchronously, so calling it straight in
  // render flips value between the server pass (no window -> false) and
  // the client's first hydration pass (real token -> true), which changes
  // whether PlanRenewalTicket's chip renders at all and threw a real
  // "Hydration failed" (#418) on every feature page load (dashboard's own
  // equivalent computation happened to dodge it, but the same fragile
  // pattern -- fixed here rather than left as a footgun).
  const demoFlag = useIsDemo();
  const billing = useMyBillingDashboard(demoFlag ? undefined : activeLocation?.organizationId, activeLocation?.organizationName);
  const planExpiryIso = demoFlag ? DEMO_PLAN_RENEWAL_ISO : billing.data?.renewalDate;
  const [sidebar, setSidebar] = useState(true);
  const [mobile, setMobile] = useState(false);
  const dataMasking = useDataMasking();
  const masked = dataMasking.masked;
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);

  const handleNav = (id: string) => navigate({ to: customerFeatureHref(id) });
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };
  const handleSwitchLocation = () => { navigate({ to: "/switch-location" }); };

  return (
    <div
      className="flex min-h-screen bg-muted/30"
      style={
        {
          // The indigo brand accent from login/select-location/dashboard
          // never reached this shell -- every feature page nested under it
          // (Reports, Campaigns, Portal, Vouchers, Policies, Whitelist,
          // Devices, Teams, Agents, Alerts, Open Hours, Notification,
          // ISP Details, Admin Logs, Mac Auth, Port Forwarding, DHCP,
          // VLANs, VOIP, ISP Routing, Debugging, Hotspot, Tickets) was
          // still rendering every `text-primary`/`bg-primary`/`ring-primary`
          // utility with the old teal token, which is what kept reading as
          // "still old" no matter how many individual pages got polished.
          // One override here fixes it everywhere at once.
          "--primary": "#6C4EFF",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}
      <CustomerSidebar
        activeId={feature}
        collapsed={!sidebar}
        mobileOpen={mobile}
        onNavigate={handleNav}
        onToggleCollapsed={() => setSidebar(!sidebar)}
        subtitle="Portal"
        dataMasking={dataMasking}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerHeader
          title={
            // Look the breadcrumb label up from the same CUSTOMER_NAVS list
            // the sidebar renders from, instead of hand-rolling a couple of
            // special cases -- the old two-entry ternary here (admin-logs ->
            // "Logs", business-hours -> "Open Hours") quietly fell back to
            // the raw feature id (CSS `capitalize`'d) for every other
            // renamed page, so the breadcrumb kept showing retired technical
            // names like "Whitelist" and "Isp-Details" even after the
            // sidebar/page title below it had already been renamed to
            // "Always Allowed" / "Internet Connection". Falls back to the
            // capitalized raw id for the handful of ids with no sidebar
            // entry (audit, advanced, hotspot).
            <p className="truncate text-sm font-semibold capitalize">{CUSTOMER_NAVS.find((n) => n.id === feature)?.label ?? feature} · {activeLocation?.name ?? ""}</p>
          }
          locationId={locationId}
          planExpiryIso={planExpiryIso}
          onMobileMenuClick={() => setMobile(true)}
          user={user}
          onSwitchLocation={handleSwitchLocation}
          onChangePassword={() => setChangePwOpen(true)}
          onTfaSettings={() => setTfaOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            {feature === "dashboard" && <DashboardView locationId={locationId} masked={masked} />}
            {feature === "users" && <UsersView locationId={locationId} masked={masked} />}
            {feature === "reports" && <UserReports masked={masked} />}
            {feature === "campaigns" && <CampaignsPage locationId={locationId} />}
            {feature === "portal" && <PortalPage locationId={locationId} />}
            {feature === "vouchers" && <VouchersPage locationId={locationId} />}
            {feature === "policies" && <PoliciesHub locationId={locationId} />}
            {feature === "whitelist" && <WhiteList locationId={locationId} />}
            {feature === "devices" && <div className="space-y-4"><NetworkHardwareView locationId={locationId} /><DevicesView locationId={locationId} masked={masked} /></div>}
            {feature === "teams" && <ManageTeamsPage locationId={locationId} />}
            {feature === "agents" && <AgentsPage locationId={locationId} />}
            {feature === "advanced" && <AdvancedPage />}
            {/* "audit" no longer has its own nav entry (merged into Admin
                Logs' Account Activity section) -- keep old bookmarks/links
                to /customer/:id/audit landing somewhere real instead of the
                generic-feature fallback. */}
            {feature === "audit" && <AdminLogsView locationId={locationId} />}
            {feature === "tickets" && <TicketsPage locationId={locationId} />}
            {feature === "how-it-works" && <HowItWorksView />}
            {feature === "alerts" && <AlertsView />}
            {feature === "business-hours" && <OpenHoursView locationId={locationId} />}
            {feature === "background-image" && <BrandAssetPage title="Background Image" description="Set a customized background image on the login screen for a complete branding experience." tableTitle="Current Background Images" tableSubtitle="This shows you a quick snapshot of all the Background Images setup." aspect="wide" />}
            {feature === "notification" && <NotificationView />}
            {feature === "isp-details" && <IspDetailsView locationId={locationId} />}
            {feature === "admin-logs" && <AdminLogsView locationId={locationId} />}
            {feature === "network-activity" && <NetworkActivityLog masked={masked} />}
            {feature === "mac-auth" && <MacAuthView locationId={locationId} />}
            {feature === "port-forwarding" && <PortForwardingView locationId={locationId} />}
            {feature === "dhcp" && <DhcpView locationId={locationId} />}
            {feature === "vlans" && <VlansView locationId={locationId} />}
            {feature === "voip" && <VoipView locationId={locationId} />}
            {feature === "website-blocking" && <WebsiteBlockingView locationId={locationId} />}
            {feature === "debugging" && <DebuggingView locationId={locationId} />}
            {feature === "hotspot" && <HotspotView locationId={locationId} />}
            {/* "audit" is handled above (redirected to AdminLogsView, see
                that render line's own comment) -- excluded here too so it
                doesn't also fall through to the generic placeholder. */}
            {feature !== "audit" && !CUSTOMER_NAVS.some((n) => n.id === feature) && <GenericFeatureView feature={feature} />}
          </div>
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
      <AssistantWidget />
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────
/** Operator-voice lines, not fabricated testimonials -- same idea as the
 * Select Location page's rotating quotes, scoped to this location's own
 * dashboard so the hero's secondary-stat row doesn't leave dead space next
 * to the corner illustration. */
const DASHBOARD_QUOTES = [
  "Uptime is a feature nobody thanks you for — until it's gone.",
  "Check it before a guest has to tell you it's down.",
  "The best network is the one nobody notices.",
  "A dropped connection is a dropped guest.",
  "Numbers you check daily are numbers that stay healthy.",
];

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
        <linearGradient id="watch-shield-grad" x1="54" y1="114" x2="115" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <circle cx="215" cy="70" r="46" fill="#7c3aed" opacity="0.16" filter="url(#watch-illo-glow)" />

      <rect x="118" y="46" width="118" height="80" rx="10" fill="#241f4d" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />
      <rect x="118" y="46" width="118" height="80" rx="10" fill="url(#watch-pulse-stroke)" fillOpacity="0.05" />
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
        animate={shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="228" cy="54" r="13" fill="#1e1b4b" stroke="#22d3ee" strokeWidth="2" />
        <path d="M222 54l4 4 8-8" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>

      <path d="M84.5 116 L112.68 127.07 V147.8 C112.68 165.69 101.25 179.6 84.5 185.5 C67.75 179.6 56.32 165.69 56.32 147.8 V127.07 Z" fill="url(#watch-shield-grad)" />
      <path d="M65.26 138.76a27.54 27.54 0 0 1 38.48 0" stroke="#ffffff" strokeWidth="5.45" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M73.43 148.71a16.76 16.76 0 0 1 22.15 0" stroke="#ffffff" strokeWidth="5.45" strokeLinecap="round" fill="none" />
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

// Real data via useCustomerDashboard (customerService.getDashboard) --
// this used to be entirely hardcoded literal arrays ("John Doe", "1,247
// Online Users") shown to every real customer, not just demo sessions.
// isDemo() gating already lives correctly inside getDashboard() itself;
// this component just has to actually call it.
function DashboardView({ locationId, masked }: { locationId: string; masked: boolean }) {
  const navigate = useNavigate();
  const { data, isLoading } = useCustomerDashboard(locationId);
  const { activeLocation } = useCustomerStore();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setQuoteIndex((i) => (i + 1) % DASHBOARD_QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={2} />
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (!data) {
    return (
      <EmptyState
        icon={Activity}
        title="No dashboard data yet"
        description="This location hasn't started reporting activity. Check back shortly."
      />
    );
  }

  // Consolidated from three separate tile styles (hero numbers + gradient
  // KPI tiles + bordered health tiles) telling the same "how's this
  // location doing" story three times before a single chart rendered.
  // Now: one hero (3 big numbers + a secondary stat line), one thin status
  // strip underneath, then the charts.
  const healthCards = [
    { icon: CheckCircle, label: "System", value: data.health.systemHealth, tone: "primary" as const },
    { icon: Wifi, label: "Routers", value: data.health.routersOnline, tone: "violet" as const },
    { icon: Activity, label: "ISP", value: data.health.isp, tone: "sky" as const },
  ];
  // Context line only where a real same-day reference value exists
  // (peakConcurrent, derived from real hourly session counts in
  // customer.service.ts) -- never a fabricated "vs yesterday" percentage
  // for the other two metrics, which have no real prior-period figure yet.
  const heroKpis = [
    { label: "Online right now", value: data.kpis.onlineUsers.toLocaleString(), context: `Today's peak: ${data.kpis.peakConcurrent.toLocaleString()}` },
    { label: "Active sessions", value: data.kpis.activeSessions.toLocaleString(), context: null as string | null },
    // Omitted (not a fake "--%") when there's no real figure yet -- see
    // customer.service.ts getDashboard()'s own comment.
    ...(data.kpis.slaUptime != null ? [{ label: "SLA uptime", value: `${data.kpis.slaUptime.toFixed(1)}%`, context: null as string | null }] : []),
  ];
  // "Routers online" deliberately left out here -- it's the same
  // data.kpis.routersOnline/totalRouters pair healthCards above already
  // shows as "Routers 1/1" a few pixels away, so this was showing the
  // exact same number twice, not two real signals (the one genuine
  // consolidation gap this file's own comment above didn't catch).
  const secondaryStats = [
    { label: "guests today", value: data.kpis.todayGuests.toLocaleString() },
    { label: "avg session", value: `${data.kpis.avgSession} min` },
  ];
  const TONE_TEXT: Record<string, string> = {
    primary: "text-primary",
    violet: "text-violet-600",
    sky: "text-sky-600",
    fuchsia: "text-fuchsia-600",
  };
  const DEVICE_COLORS = ["#6366f1", "#06b6d4", "#a855f7", "#f472b6", "#22c55e", "#f59e0b"];
  const chartTooltip = {
    background: "hsl(var(--popover, 0 0% 100%))",
    border: "1px solid var(--color-border, #e2e8f0)",
    borderRadius: 12,
    fontSize: 12,
    padding: "8px 10px",
    boxShadow: "0 12px 32px -12px rgba(15,23,42,0.25)",
  } as const;

  return (
    <div className="space-y-8">
      {/* Hero band -- a rich dark gradient instead of the flat neutral
       * admin-tool look everywhere else, carrying the 3 numbers a customer
       * checks first at real size. Ambient glow blobs + a faint dot-grid
       * texture give it depth without needing an uploaded image. The
       * secondary stat line below the numbers absorbs what used to be a
       * separate gradient KPI tile row -- same real values, one home. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-5 text-white shadow-xl shadow-indigo-950/30 sm:p-6">
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
        <div className="pointer-events-none absolute -bottom-2 right-4 hidden sm:block">
          <DashboardWatchIllustration />
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
            This location, right now
          </p>
          <p className="mt-1 text-sm text-white/70">
            How {activeLocation?.name ?? "this location"} is running for your guests at this moment.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {heroKpis.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{k.label}</p>
                <p className="font-display mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl sm:leading-none">
                  {k.value}
                </p>
                {k.context && <p className="mt-1.5 text-xs font-medium text-white/60">{k.context}</p>}
              </motion.div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/10 pt-3 text-xs tabular-nums text-white/70">
            {secondaryStats.map((s) => (
              <span key={s.label}>
                <span className="font-semibold text-white">{s.value}</span>{" "}
                <span className="text-white/50">{s.label}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
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

      {/* Status strip -- the 4 health checks as the hero's footnote, not a
       * second competing card row: one line, icon + label + value. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-3.5 premium-card">
        <p className="shrink-0 text-xs font-medium text-muted-foreground">Core systems, checked continuously</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {healthCards.map((h) => (
            <span key={h.label} className="inline-flex items-center gap-1.5 text-sm">
              <h.icon className={cn("h-3.5 w-3.5", TONE_TEXT[h.tone])} />
              <span className="text-muted-foreground">{h.label}</span>
              <span className="font-semibold">{h.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Real charts, real data -- usersTrend/deviceDistribution/
       * hourlySessions all come from the same getDashboard() response
       * already fetched above, just never rendered before now. */}
      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">Guest activity over the last 24 hours</p>
        <div className="grid gap-6 lg:grid-cols-3">
        <Card className={cn("premium-card premium-card-hover lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="text-sm">Users online (last 24h)</CardTitle>
          </CardHeader>
          <CardContent className="h-56 pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.usersTrend}>
                <defs>
                  <linearGradient id="usersTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <RechartsTooltip contentStyle={chartTooltip} />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fill="url(#usersTrendFill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className={cn("premium-card premium-card-hover")}>
          <CardHeader>
            <CardTitle className="text-sm">Devices</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {data.deviceDistribution.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                No device data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.deviceDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    cornerRadius={6}
                  >
                    {data.deviceDistribution.map((_, i) => (
                      <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={chartTooltip} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {data.hourlySessions.length > 0 && (
        <Card className={cn("premium-card premium-card-hover")}>
          <CardHeader>
            <CardTitle className="text-sm">Sessions by hour</CardTitle>
          </CardHeader>
          <CardContent className="h-44 pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourlySessions}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <RechartsTooltip contentStyle={chartTooltip} />
                <Bar dataKey="sessions" radius={[6, 6, 0, 0]} fill="#6366f1">
                  {data.hourlySessions.map((_, i) => (
                    <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">Who's connected, and what needs your attention.</p>
        <div className="grid gap-6 lg:grid-cols-2">
        <Card className={cn("premium-card premium-card-hover")}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Users</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary"
              onClick={() => navigate({ to: customerFeatureHref("users") })}
            >
              All →
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentUsers.length === 0 ? (
              <p className="px-6 py-8 text-center text-xs text-muted-foreground">
                No guests have connected yet — check back once someone joins the network.
              </p>
            ) : (
              <div className="divide-y">
                {data.recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email ? (masked ? maskEmail(u.email) : u.email) : u.time}</p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
                        u.status === "online" ? "text-emerald-500" : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          u.status === "online" ? "bg-emerald-500" : "bg-muted-foreground",
                        )}
                      />
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className={cn("premium-card premium-card-hover")}>
          <CardHeader>
            <CardTitle className="text-sm">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {data.recentAlerts.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No recent alerts.</p>
            ) : (
              data.recentAlerts.map((a, i) => {
                const border =
                  a.type === "error"
                    ? "border-rose-500"
                    : a.type === "warning"
                      ? "border-amber-500"
                      : a.type === "success"
                        ? "border-emerald-500"
                        : "border-sky-500";
                return (
                  <div key={i} className={cn("flex items-start gap-3 rounded-xl border-l-4 bg-muted/40 py-2.5 pl-3 pr-3", border)}>
                    {a.type === "error" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    ) : a.type === "warning" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    ) : a.type === "success" ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
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
        </div>
      </div>
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────
// Real data via useCustomerUsers (customerService.getUsers) -- same fix
// as DashboardView above, see its own comment. Server-side paginated
// (page is 1-indexed) and server-side filtered by status/search, not a
// client-side slice of a fabricated in-memory array.
function UsersView({ locationId, masked }: { locationId: string; masked: boolean }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCustomerUsers(locationId, {
    search: search || undefined,
    status: tab === "all" ? undefined : tab,
    page,
    pageSize: 20,
  });
  const users = data?.users ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search users…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-10 max-w-xs"
        />
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-0.5">
          {[
            ["all", "All"],
            ["online", "Online"],
            ["offline", "Offline"],
          ].map(([k, v]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                tab === k ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <Card className="premium-card premium-card-hover">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <LoadingSkeleton rows={5} />
            </div>
          ) : users.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No guests match this filter yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">User</TableHead>
                  <TableHead className="hidden text-xs font-medium uppercase tracking-wide sm:table-cell">Phone</TableHead>
                  <TableHead className="hidden text-xs font-medium uppercase tracking-wide sm:table-cell">MAC</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">Duration</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">Download</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-b">
                    <TableCell>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{masked ? maskEmail(u.email) : u.email}</p>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">{masked ? maskPhone(u.phone) : u.phone}</TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{masked ? maskMac(u.mac) : u.mac}</TableCell>
                    <TableCell className="text-xs">{u.duration}</TableCell>
                    <TableCell className="text-xs">{u.download}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          u.status === "online"
                            ? "text-emerald-500"
                            : u.status === "idle"
                              ? "text-amber-500"
                              : "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            u.status === "online"
                              ? "bg-emerald-500"
                              : u.status === "idle"
                                ? "bg-amber-500"
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
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Devices ───────────────────────────────────────────────
const DEMO_DEVICES = [
  {m:"00:1A:2B:3C:4D:5E",i:"10.0.1.42",d:"iPhone 15",fs:"Today",ls:"Just now"},
  {m:"AA:BB:CC:DD:EE:FF",i:"10.0.1.87",d:"MacBook Pro",fs:"Yesterday",ls:"2 min ago"},
  {m:"11:22:33:44:55:66",i:"10.0.2.15",d:"Galaxy S24",fs:"Today",ls:"5 min ago"},
  {m:"AB:CD:EF:01:23:45",i:"10.0.2.34",d:"iPad Air",fs:"2 days ago",ls:"1 hour ago"},
];

function ConnectedDevicesIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const nodes = [
    { x: 12, y: 10, color: "#22d3ee" },
    { x: 12, y: 34, color: "#f0abfc" },
    { x: 68, y: 8, color: "#8B5CF6" },
    { x: 70, y: 36, color: "#22d3ee" },
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 84 46" className="hidden h-11 w-auto shrink-0 sm:block" fill="none">
      {nodes.map((n, i) => (
        <motion.line key={i} x1="42" y1="23" x2={n.x} y2={n.y}
          stroke={n.color} strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="1 4" strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 * i, ease: "easeOut" }} />
      ))}
      {nodes.map((n, i) => (
        <g key={i} transform={`translate(${n.x}, ${n.y})`}>
          <rect x="-6" y="-5" width="12" height="10" rx="2.5" fill="#2e2a5c" stroke={n.color} strokeWidth="1.3" />
          <circle cx="0" cy="0" r="1.4" fill={n.color} />
        </g>
      ))}
      <motion.circle cx="42" cy="23" r="9" fill="#1e1b4b" stroke="#6C4EFF" strokeWidth="2"
        animate={shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.3, repeat: Infinity, ease: "easeInOut" }} />
      <path d="M38 23h8M42 19v8" stroke="#8B5CF6" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DevicesView({ locationId, masked }: { locationId: string; masked: boolean }) {
  const { data, isLoading } = useCustomerFeatureData("devices", locationId);
  const demo = useIsDemo();
  const devices = data?.devices?.length ? data.devices.map((d) => ({ m: d.mac, i: d.ip, d: d.device, fs: d.firstSeen, ls: d.lastSeen })) : (demo ? DEMO_DEVICES : []);
  return (
    <Card className="premium-card premium-card-hover">
      <CardHeader className="flex flex-row items-center justify-between gap-2.5 space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Wifi className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Connected Devices</CardTitle>
        </div>
        <ConnectedDevicesIllustration />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={4} /></div>
        ) : devices.length === 0 ? (
          <EmptyState icon={Wifi} title="No connected devices yet" description="Devices that connect to this location's network will show up here." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead className="text-xs font-medium uppercase tracking-wide">MAC</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide">IP</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide">Device</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide">First Seen</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide">Last Seen</TableHead></TableRow></TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.m} className="border-b"><TableCell className="font-mono text-xs">{masked ? maskMac(d.m) : d.m}</TableCell><TableCell className="font-mono text-xs">{d.i}</TableCell><TableCell>{d.d}</TableCell><TableCell className="text-xs text-muted-foreground">{d.fs}</TableCell><TableCell className="text-xs text-muted-foreground">{d.ls}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
