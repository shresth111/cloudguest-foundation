import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft, LogOut, Bell, Settings, Moon, Wifi, Router, Activity, Users, TrendingUp, TrendingDown,
  CheckCircle, XCircle, AlertTriangle, Download, Upload, Clock, Signal, Search, RefreshCw, Menu,
  KeyRound, MapPinned, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomerLoginRole, customerNavsForRole } from "@/lib/customerNav";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import { OtpMaskToggle, PlanExpiryBadge, BookDemoButton } from "@/components/features/HeaderControls";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerDashboard, useCustomerUsers } from "@/hooks/useCustomerDashboard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export const Route = createFileRoute("/customer/$locationId/dashboard")({

  component: CustomerDashboardPage,
});

function CustomerDashboardPage() {
  const { locationId } = Route.useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  const { data: d, isLoading, refetch } = useCustomerDashboard(locationId);
  const { data: uData } = useCustomerUsers(locationId, { page: 1, pageSize: 6 });
  const [sidebar, setSidebar] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [notif, setNotif] = useState(false);
  const [masked, setMasked] = useState(true);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);

  if (activeLocationId !== locationId) return <div className="flex min-h-screen items-center justify-center"><Button variant="outline" onClick={() => navigate({ to: "/customer" })}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></div>;

  const handleNav = (id: string) => navigate({ to: `/customer/${locationId}/${id}` });
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };
  const handleSwitchLocation = () => { setMenu(false); navigate({ to: "/customer" }); };
  const filteredNavs = customerNavsForRole(getCustomerLoginRole());

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Mobile overlay */}
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-all lg:static lg:z-auto",
        sidebar ? "w-60" : "w-0 lg:w-16 overflow-hidden",
        mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm"><img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" /></div>
          {sidebar && <div><p className="text-sm font-semibold">ZIP WiFi</p><p className="text-[10px] text-muted-foreground">{activeLocation?.name ?? "Portal"}</p></div>}
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto">
          {filteredNavs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => handleNav(item.id)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all w-full text-left", item.id === "dashboard" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebar && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t p-2 hidden lg:block">
          <button onClick={() => setSidebar(!sidebar)} className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent">{sidebar ? "◄" : "►"}</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 backdrop-blur-xl px-4 sm:px-6">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Wifi className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm font-semibold truncate">{activeLocation?.name ?? "Dashboard"}</p>
            <span className={cn("h-2 w-2 rounded-full", activeLocation?.status === "online" ? "bg-emerald-500" : activeLocation?.status === "degraded" ? "bg-amber-500" : "bg-rose-500")} />
            <span className="hidden sm:inline text-xs text-muted-foreground capitalize">{activeLocation?.status}</span>
          </div>
          <div className="flex items-center gap-1">
            <PlanExpiryBadge className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex mr-1" />
            <BookDemoButton />
            <OtpMaskToggle masked={masked} setMasked={setMasked} />
            <Button variant="ghost" size="icon" className="h-9 w-9"><Search className="h-4 w-4" /></Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="h-9 w-9 relative" onClick={() => setNotif(!notif)}><Bell className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" /></Button>
              {notif && <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-popover p-2 shadow-xl"><p className="px-2 py-1 text-xs font-medium text-muted-foreground">No new notifications</p></div>}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
            <div className="relative">
              <button onClick={() => setMenu(!menu)} className="ml-2"><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar></button>
              {menu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-popover p-1 shadow-xl z-50">
                  <div className="px-3 py-2"><p className="text-sm font-medium">{user?.name ?? "Admin"}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div>
                  <div className="border-t my-1" />
                  <button onClick={handleSwitchLocation} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"><MapPinned className="h-4 w-4" />Switch location</button>
                  <button onClick={() => { setMenu(false); setChangePwOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"><KeyRound className="h-4 w-4" />Change password</button>
                  <button onClick={() => { setMenu(false); setTfaOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"><ShieldCheck className="h-4 w-4" />2FA settings</button>
                  <div className="border-t my-1" />
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}</div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted" />)}</div>
              <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 rounded-2xl bg-muted" />)}</div>
            </div>
          ) : d ? (
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Health Row */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { icon: CheckCircle, label: "System Health", value: d.health.systemHealth, color: "text-emerald-500" },
                  { icon: Router, label: "Routers", value: d.health.routersOnline, color: "text-emerald-500" },
                  { icon: Activity, label: "ISP Status", value: d.health.isp, color: "text-emerald-500" },
                  { icon: Wifi, label: "Network Load", value: d.health.networkLoad, color: "text-emerald-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><item.icon className={cn("h-5 w-5", item.color)} /></div>
                    <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p><p className="text-lg font-bold">{item.value}</p></div>
                  </div>
                ))}
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {[
                  { l: "Online Users", v: d.kpis.onlineUsers, c: TrendingUp },
                  { l: "Active Sessions", v: d.kpis.activeSessions, c: Activity },
                  { l: "Routers", v: `${d.kpis.routersOnline}/${d.kpis.totalRouters}`, c: Router },
                  { l: "Today's Guests", v: d.kpis.todayGuests, c: Users },
                  { l: "Avg Session", v: `${d.kpis.avgSession}m`, c: Clock },
                  { l: "SLA Uptime", v: `${d.kpis.slaUptime}%`, c: CheckCircle },
                ].map((kpi) => (
                  <motion.div key={kpi.l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.l}</p><kpi.c className="h-4 w-4 text-muted-foreground" /></div>
                    <p className="text-2xl font-bold tracking-tight">{kpi.v}</p>
                  </motion.div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1 border-0 shadow-sm">
                  <CardHeader><CardTitle className="text-sm">Users Trend (24h)</CardTitle></CardHeader>
                  <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={d.usersTrend}><defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" className="stroke-border/50" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))" }} /><Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#ug)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card className="lg:col-span-1 border-0 shadow-sm">
                  <CardHeader><CardTitle className="text-sm">Device Distribution</CardTitle></CardHeader>
                  <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={d.deviceDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">{d.deviceDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card className="lg:col-span-1 border-0 shadow-sm">
                  <CardHeader><CardTitle className="text-sm">Hourly Sessions</CardTitle></CardHeader>
                  <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.hourlySessions}><CartesianGrid strokeDasharray="3 3" className="stroke-border/50" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: "12px" }} /><Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
                </Card>
              </div>

              {/* Tables */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Recent Users</CardTitle><Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => handleNav("users")}>View all →</Button></CardHeader>
                  <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs font-medium uppercase">User</TableHead><TableHead className="text-xs font-medium uppercase hidden md:table-cell">Device</TableHead><TableHead className="text-xs font-medium uppercase">Time</TableHead><TableHead className="text-xs font-medium uppercase">Status</TableHead></TableRow></TableHeader>
                  <TableBody>{(d.recentUsers.length === 0 ? [{ id: "0", name: "No users", email: "", device: "", time: "", status: "offline" }] : d.recentUsers).map((u) => (<TableRow key={u.id} className="border-b"><TableCell><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell><TableCell className="text-sm hidden md:table-cell">{u.device}</TableCell><TableCell className="text-xs text-muted-foreground">{u.time}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : "bg-muted-foreground")} />{u.status}</span></TableCell></TableRow>))}</TableBody></Table></CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardHeader><CardTitle className="text-sm">Recent Alerts</CardTitle></CardHeader>
                  <CardContent className="divide-y">{d.recentAlerts.map((a) => (<div key={a.msg} className="flex items-start gap-3 py-3">
                    {a.type === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                    {a.type === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                    {a.type === "success" && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                    {a.type === "info" && <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />}
                    <div className="min-w-0 flex-1"><p className="text-sm">{a.msg}</p><p className="text-xs text-muted-foreground">{a.time}</p></div>
                  </div>))}</CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground"><p className="mb-4">Failed to load</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>
          )}
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
    </div>
  );
}
