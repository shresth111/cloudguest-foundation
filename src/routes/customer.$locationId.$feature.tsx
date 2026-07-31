import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { requireCustomerSession } from "@/lib/authGuards";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { CUSTOMER_NAVS } from "@/lib/customerNav";
import { AgentsPage } from "@/components/features/AgentsPage";
import { CampaignsPage } from "@/components/features/CampaignsPage";
import { VouchersPage } from "@/components/features/VouchersPage";
import { PortalPage } from "@/components/features/PortalPage";
import PoliciesHub from "@/components/features/PoliciesHub";
import { AdvancedPage } from "@/components/features/FeatureComponents";
import ManageTeamsPage from "@/components/features/ManageTeamsPage";
import WhiteList from "@/components/features/WhiteList";
import LocationPolicies from "@/components/features/LocationPolicies";
import BlockUsers from "@/components/features/BlockUsers";
import CreateGroup from "@/components/features/CreateGroup";
import UserReports from "@/components/features/UserReports";
import SmartIdPage from "@/components/features/SmartIdPage";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import AssistantWidget from "@/components/features/AssistantWidget";
import TicketsPage from "@/components/features/TicketsPage";
import BrandAssetPage from "@/components/features/BrandAssetPage";
import { NetworkHardwareView } from "@/components/customer/BasicFeatureViews";
import { OtpMaskToggle, PlanExpiryBadge, BookDemoButton, formatPlanExpiry } from "@/components/features/HeaderControls";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { isDemo } from "@/services/customer.service";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { useCustomerFeatureData } from "@/hooks/useCustomerDashboard";
import { useIsDemo, useCustomerDashboard, useCustomerUsers } from "@/hooks/useCustomerDashboard";
import {
  AlertsView, BusinessHoursView, NotificationView, IspDetailsView,
  AdminLogsView, MacAuthView, PortForwardingView, DhcpView, VlansView, VoipView,
  IspRoutingView, DebuggingView, HotspotView, GenericFeatureView,
} from "@/components/features/OperationsFeatures";
import { toast } from "sonner";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import {
  LogOut, Menu, Wifi, Users, ShieldCheck, CheckCircle,
  AlertTriangle, Activity, XCircle, Download, KeyRound, MapPinned,
} from "lucide-react";

export const Route = createFileRoute("/customer/$locationId/$feature")({
  beforeLoad: ({ context, location }) => requireCustomerSession(context.auth, location),
  component: FeaturePage,
});

function FeaturePage() {
  const { locationId, feature } = Route.useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation } = useCustomerStore();
  const billing = useMyBillingDashboard(isDemo() ? undefined : activeLocation?.organizationId, activeLocation?.organizationName);
  const planExpiry = isDemo() ? "11-Nov-2026" : billing.data ? formatPlanExpiry(billing.data.renewalDate) : undefined;
  const [sidebar, setSidebar] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const [masked, setMasked] = useState(true);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);

  const handleNav = (id: string) => navigate({ to: `/customer/${locationId}/${id}` });
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };
  const handleSwitchLocation = () => { setMenu(false); navigate({ to: "/customer" }); };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}
      <CustomerSidebar
        activeId={feature}
        collapsed={!sidebar}
        mobileOpen={mobile}
        onNavigate={handleNav}
        onToggleCollapsed={() => setSidebar(!sidebar)}
        subtitle={activeLocation?.name ?? feature}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 backdrop-blur-xl px-4 sm:px-6">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          {/* "admin-logs" is special-cased to "Logs" here too -- otherwise
              this generic feature-id breadcrumb (CSS `capitalize`, which
              treats the hyphen as a word boundary) would still show the
              retired "Admin-Logs" label even though the sidebar/page title
              below both say "Logs" now. */}
          <div className="flex-1"><p className="text-sm font-semibold capitalize">{feature === "dashboard" ? "Dashboard" : feature === "admin-logs" ? "Logs" : feature} · {activeLocation?.name ?? ""}</p></div>

          <PlanExpiryBadge expiry={planExpiry} className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex" />
          <BookDemoButton className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent sm:inline-flex" />
          <OtpMaskToggle masked={masked} setMasked={setMasked} className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent sm:inline-flex" />

          <NotificationBell scope="org" viewAllPath={`/customer/${locationId}/alerts`} />

          <div className="relative"><button onClick={() => setMenu(!menu)}><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar></button>
            {menu && (<div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-popover p-1 shadow-xl z-50">
              <div className="px-3 py-2"><p className="text-sm font-medium">{user?.name ?? "Admin"}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div>
              <div className="border-t my-1" />
              <button onClick={handleSwitchLocation} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"><MapPinned className="h-4 w-4" />Switch location</button>
              <button onClick={() => { setMenu(false); setChangePwOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"><KeyRound className="h-4 w-4" />Change password</button>
              <button onClick={() => { setMenu(false); setTfaOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"><ShieldCheck className="h-4 w-4" />2FA settings</button>
              <div className="border-t my-1" />
              <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5"><LogOut className="h-4 w-4" />Sign out</button>
            </div>)}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            {feature === "dashboard" && <DashboardView locationId={locationId} />}
            {feature === "users" && <UsersView locationId={locationId} />}
            {feature === "reports" && <UserReports />}
            {feature === "campaigns" && <CampaignsPage locationId={locationId} />}
            {feature === "portal" && <PortalPage locationId={locationId} />}
            {feature === "vouchers" && <VouchersPage locationId={locationId} />}
            {feature === "policies" && <PoliciesHub locationId={locationId} />}
            {feature === "whitelist" && <WhiteList locationId={locationId} />}
            {feature === "devices" && <div className="space-y-4"><NetworkHardwareView locationId={locationId} /><DevicesView locationId={locationId} /></div>}
            {feature === "teams" && <ManageTeamsPage locationId={locationId} />}
            {feature === "agents" && <AgentsPage locationId={locationId} />}
            {feature === "advanced" && <AdvancedPage />}
            {/* "audit" no longer has its own nav entry (merged into Admin
                Logs' Account Activity section) -- keep old bookmarks/links
                to /customer/:id/audit landing somewhere real instead of the
                generic-feature fallback. */}
            {feature === "audit" && <AdminLogsView locationId={locationId} />}
            {feature === "tickets" && <TicketsPage locationId={locationId} />}
            {feature === "alerts" && <AlertsView />}
            {feature === "business-hours" && <BusinessHoursView />}
            {feature === "background-image" && <BrandAssetPage title="Background Image" description="Set a customized background image on the login screen for a complete branding experience." tableTitle="Current Background Images" tableSubtitle="This shows you a quick snapshot of all the Background Images setup." aspect="wide" />}
            {feature === "notification" && <NotificationView />}
            {feature === "isp-details" && <IspDetailsView locationId={locationId} />}
            {feature === "admin-logs" && <AdminLogsView locationId={locationId} />}
            {feature === "mac-auth" && <MacAuthView locationId={locationId} />}
            {feature === "port-forwarding" && <PortForwardingView locationId={locationId} />}
            {feature === "dhcp" && <DhcpView locationId={locationId} />}
            {feature === "vlans" && <VlansView locationId={locationId} />}
            {feature === "voip" && <VoipView locationId={locationId} />}
            {feature === "isp-routing" && <IspRoutingView locationId={locationId} />}
            {feature === "debugging" && <DebuggingView />}
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
// Real data via useCustomerDashboard (customerService.getDashboard) --
// this used to be entirely hardcoded literal arrays ("John Doe", "1,247
// Online Users") shown to every real customer, not just demo sessions.
// isDemo() gating already lives correctly inside getDashboard() itself;
// this component just has to actually call it.
function DashboardView({ locationId }: { locationId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useCustomerDashboard(locationId);

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
        description="This location hasn't reported any activity yet."
      />
    );
  }

  const healthCards = [
    { icon: CheckCircle, label: "System", value: data.health.systemHealth, tone: "primary" as const },
    { icon: Wifi, label: "Routers", value: data.health.routersOnline, tone: "violet" as const },
    { icon: Activity, label: "ISP", value: data.health.isp, tone: "sky" as const },
    { icon: Activity, label: "Load", value: data.health.networkLoad, tone: "fuchsia" as const },
  ];
  const heroKpis = [
    { label: "Online right now", value: data.kpis.onlineUsers.toLocaleString() },
    { label: "Active sessions", value: data.kpis.activeSessions.toLocaleString() },
    { label: "SLA uptime", value: `${data.kpis.slaUptime}%` },
  ];
  const secondaryKpis = [
    { label: "Routers Online", value: `${data.kpis.routersOnline}/${data.kpis.totalRouters}`, icon: Wifi, grad: "from-violet-600 to-indigo-600" },
    { label: "Today's Guests", value: data.kpis.todayGuests.toLocaleString(), icon: Users, grad: "from-cyan-500 to-blue-600" },
    { label: "Avg Session", value: `${data.kpis.avgSession} min`, icon: Activity, grad: "from-fuchsia-500 to-pink-600" },
  ];
  const TONE_BG: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    fuchsia: "bg-fuchsia-50 text-fuchsia-600",
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
  const cardLift =
    "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg";

  return (
    <div className="space-y-6">
      {/* Hero band -- a rich dark gradient instead of the flat neutral
       * admin-tool look everywhere else, carrying the 3 numbers a customer
       * checks first at real size. Ambient glow blobs + a faint dot-grid
       * texture give it depth without needing an uploaded image. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-6 text-white shadow-xl shadow-indigo-950/30 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
            Live overview
          </p>
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {heroKpis.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <p
                  className="text-4xl font-bold tabular-nums tracking-tight sm:text-[3.25rem] sm:leading-none"
                  style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
                >
                  {k.value}
                </p>
                <p className="mt-2 text-sm text-white/70">{k.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {secondaryKpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md",
              k.grad,
              cardLift,
            )}
          >
            <k.icon className="absolute -right-3 -top-3 h-16 w-16 text-white/15" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <k.icon className="h-4 w-4" />
            </div>
            <p className="relative mt-3 text-xs font-medium uppercase tracking-wide text-white/80">{k.label}</p>
            <p className="relative mt-0.5 text-2xl font-bold tabular-nums">{k.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {healthCards.map((h) => (
          <div key={h.label} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm", cardLift)}>
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_BG[h.tone])}>
              <h.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">{h.label}</p>
              <p className="truncate text-sm font-bold">{h.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Real charts, real data -- usersTrend/deviceDistribution/
       * hourlySessions all come from the same getDashboard() response
       * already fetched above, just never rendered before now. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={cn("border-0 shadow-sm lg:col-span-2", cardLift)}>
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
        <Card className={cn("border-0 shadow-sm", cardLift)}>
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

      {data.hourlySessions.length > 0 && (
        <Card className={cn("border-0 shadow-sm", cardLift)}>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cn("border-0 shadow-sm", cardLift)}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Users</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary"
              onClick={() => navigate({ to: `/customer/${locationId}/users` })}
            >
              All →
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentUsers.length === 0 ? (
              <p className="px-6 py-8 text-center text-xs text-muted-foreground">
                No guests have connected yet.
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
                      <p className="truncate text-xs text-muted-foreground">{u.email || u.time}</p>
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
        <Card className={cn("border-0 shadow-sm", cardLift)}>
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
  );
}

// ── Users ─────────────────────────────────────────────────
// Real data via useCustomerUsers (customerService.getUsers) -- same fix
// as DashboardView above, see its own comment. Server-side paginated
// (page is 1-indexed) and server-side filtered by status/search, not a
// client-side slice of a fabricated in-memory array.
function UsersView({ locationId }: { locationId: string }) {
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
      <Card className="border-0 shadow-sm">
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
                  <TableHead className="text-xs font-medium">User</TableHead>
                  <TableHead className="hidden text-xs font-medium sm:table-cell">MAC</TableHead>
                  <TableHead className="text-xs font-medium">Duration</TableHead>
                  <TableHead className="text-xs font-medium">Download</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-b">
                    <TableCell>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{u.mac}</TableCell>
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

// ── Reports ───────────────────────────────────────────────
function ReportsView() {
  return (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[{n:"Guest Report"},{n:"Bandwidth Report"},{n:"Revenue Report"},{n:"Router Report"},{n:"Voucher Report"},{n:"Portal Report"}].map(r=>(<Card key={r.n} className="shadow-sm border-0 hover:shadow-md cursor-pointer"><CardContent className="p-5"><p className="font-semibold">{r.n}</p><p className="text-xs text-muted-foreground mt-1">Last generated 3d ago</p><div className="flex gap-2 mt-3"><Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>toast.success(`${r.n} exported`)}>PDF</Button><Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>toast.success(`${r.n} exported`)}>CSV</Button></div></CardContent></Card>))}</div>);
}

// ── Devices ───────────────────────────────────────────────
const DEMO_DEVICES = [
  {m:"00:1A:2B:3C:4D:5E",i:"10.0.1.42",d:"iPhone 15",fs:"Today",ls:"Just now"},
  {m:"AA:BB:CC:DD:EE:FF",i:"10.0.1.87",d:"MacBook Pro",fs:"Yesterday",ls:"2 min ago"},
  {m:"11:22:33:44:55:66",i:"10.0.2.15",d:"Galaxy S24",fs:"Today",ls:"5 min ago"},
  {m:"AB:CD:EF:01:23:45",i:"10.0.2.34",d:"iPad Air",fs:"2 days ago",ls:"1 hour ago"},
];

function DevicesView({ locationId }: { locationId: string }) {
  const { data, isLoading } = useCustomerFeatureData("devices", locationId);
  const demo = useIsDemo();
  const devices = data?.devices?.length ? data.devices.map((d) => ({ m: d.mac, i: d.ip, d: d.device, fs: d.firstSeen, ls: d.lastSeen })) : (demo ? DEMO_DEVICES : []);
  return (<Card className="shadow-sm border-0"><CardHeader><CardTitle className="text-sm">Connected Devices</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs font-medium">MAC</TableHead><TableHead className="text-xs font-medium">IP</TableHead><TableHead className="text-xs font-medium">Device</TableHead><TableHead className="text-xs font-medium">First Seen</TableHead><TableHead className="text-xs font-medium">Last Seen</TableHead></TableRow></TableHeader><TableBody>
    {isLoading ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
    : devices.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">No connected devices yet.</TableCell></TableRow>
    : devices.map(d=>(<TableRow key={d.m} className="border-b"><TableCell className="font-mono text-xs">{d.m}</TableCell><TableCell className="font-mono text-xs">{d.i}</TableCell><TableCell>{d.d}</TableCell><TableCell className="text-xs text-muted-foreground">{d.fs}</TableCell><TableCell className="text-xs text-muted-foreground">{d.ls}</TableCell></TableRow>))}
  </TableBody></Table></CardContent></Card>);
}

