import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ChevronLeft, Bell, Search, Sun, Moon, LayoutDashboard, Users as UsersIcon, BarChart3,
  FileText, Megaphone, Palette, Ticket, ShieldCheck, Shield, Monitor,
  UsersRound, Bot, Network, Settings2, ScrollText, LifeBuoy, Menu, X, RotateCw,
  Wifi, Router, Activity, Signal, Download, Upload, Clock, TrendingUp,
  TrendingDown, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerDashboard } from "@/hooks/useCustomerDashboard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "portal", label: "Portal", icon: Palette },
  { id: "vouchers", label: "Vouchers", icon: Ticket },
  { id: "policies", label: "Policies", icon: ShieldCheck },
  { id: "whitelist", label: "Whitelist", icon: Shield },
  { id: "devices", label: "Devices", icon: Monitor },
  { id: "teams", label: "Teams", icon: UsersRound },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "networking", label: "Networking", icon: Network },
  { id: "advanced", label: "Advanced", icon: Settings2 },
  { id: "audit", label: "Audit Logs", icon: ScrollText },
  { id: "help", label: "Help", icon: LifeBuoy },
];

const DEVICE_COLORS = ["#ec3013", "#f05a3a", "#f4856a", "#f7b0a0", "#fad5cd", "#e5e5e5"];

export const Route = createFileRoute("/customer/$locationId/dashboard")({
  beforeLoad: ({ context }) => {
    if (context.auth?.status === "anonymous") throw redirect({ to: "/login" });
  },
  component: CustomerDashboardPage,
});

function CustomerDashboardPage() {
  const { locationId } = Route.useParams();
  const navigate = useNavigate();
  const { activeLocation, activeLocationId } = useCustomerStore();
  const { data: dashData, isLoading, isError, refetch } = useCustomerDashboard(locationId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => { const n = theme === "light" ? "dark" : "light"; setTheme(n); document.documentElement.classList.toggle("dark", n === "dark"); };
  const handleNav = (id: string) => {
    if (id === "dashboard") navigate({ to: `/customer/${locationId}/dashboard` });
    else if (id === "users") navigate({ to: `/customer/${locationId}/users` });
    else navigate({ to: `/customer/${locationId}/${id}` });
    setMobileOpen(false);
  };

  if (activeLocationId !== locationId) {
    return (
      <div className="customer-theme min-h-screen flex items-center justify-center bg-[#f3f2f2] dark:bg-neutral-900">
        <div className="text-center"><p className="text-muted-foreground mb-4">Location not found.</p>
        <Button variant="outline" className="border-2 border-border rounded-none" onClick={() => navigate({ to: "/customer" })}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to locations
        </Button></div>
      </div>
    );
  }

  return (
    <div className={cn("customer-theme flex min-h-screen", theme === "dark" && "dark")}>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r-2 border-border lg:static lg:z-auto", sidebarOpen ? "w-56" : "w-14", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="flex items-center gap-3 border-b-2 border-border px-3 h-14 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center bg-[#ec3013] text-white text-xs font-bold">CG</div>
          {sidebarOpen && <p className="text-sm font-semibold truncate">{activeLocation?.name ?? "CloudGuest"}</p>}
        </div>
        <button className="absolute right-2 top-3 lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
        <div className="px-2 pt-2"><button onClick={() => navigate({ to: "/customer" })} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" />{sidebarOpen && <span>All locations</span>}</button></div>
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon; const isActive = item.id === "dashboard";
            return (<button key={item.id} onClick={() => handleNav(item.id)} className={cn("flex w-full items-center gap-3 px-3 py-2 text-sm border-l-2", isActive ? "border-l-[#ec3013] bg-[#f3f2f2] dark:bg-neutral-800 text-[#ec3013] font-semibold" : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50")}><Icon className="h-4 w-4 shrink-0" />{sidebarOpen && <span className="truncate">{item.label}</span>}</button>);
          })}
        </nav>
        <div className="border-t-2 border-border p-2 hidden lg:block"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex w-full items-center justify-center px-3 py-2 text-xs text-muted-foreground">{sidebarOpen ? "◄ Collapse" : "►"}</button></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b-2 border-border bg-card px-4">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <p className="text-sm font-semibold flex-1 truncate">{activeLocation?.name ?? "Dashboard"}</p>
          <button className="flex h-8 w-8 items-center justify-center text-muted-foreground"><Search className="h-4 w-4" /></button>
          <div className="relative"><button onClick={() => setNotifOpen(!notifOpen)} className="flex h-8 w-8 items-center justify-center text-muted-foreground relative"><Bell className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-3 w-3 bg-[#ec3013] text-[7px] font-bold text-white flex items-center justify-center">3</span></button></div>
          <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center text-muted-foreground">{theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <button onClick={() => refetch()} className="flex h-8 w-8 items-center justify-center text-muted-foreground"><RotateCw className="h-4 w-4" /></button>
        </header>

        <main className="flex-1 bg-[#f3f2f2] dark:bg-neutral-900 p-6 space-y-6 max-w-7xl">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="flex gap-6 border-2 border-border bg-card p-4"><div className="h-12 w-full bg-muted" /></div>
              <div className="grid grid-cols-6 gap-3">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-2 border-border bg-card p-4 h-24"><div className="h-3 w-16 bg-muted mb-2" /><div className="h-6 w-20 bg-muted" /></div>)}</div>
              <div className="grid grid-cols-3 gap-6">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="border-2 border-border bg-card p-4 h-72"><div className="h-4 w-32 bg-muted mb-4" /><div className="h-56 bg-muted" /></div>)}</div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20"><p className="text-muted-foreground mb-4">Failed to load dashboard</p>
            <Button variant="outline" className="border-2 border-border rounded-none" onClick={() => refetch()}><RotateCw className="mr-2 h-4 w-4" /> Retry</Button></div>
          ) : dashData ? (
            <>
              {/* Health Row */}
              <div className="flex flex-wrap gap-6 border-2 border-border bg-card p-4">
                {[
                  { icon: CheckCircle, label: "System Health", value: dashData.health.systemHealth },
                  { icon: Router, label: "Routers", value: dashData.health.routersOnline },
                  { icon: Activity, label: "ISP", value: dashData.health.isp },
                  { icon: Wifi, label: "Network Load", value: dashData.health.networkLoad },
                ].map((item) => {
                  const Icon = item.icon;
                  return (<div key={item.label} className="flex items-center gap-3"><Icon className="h-5 w-5 text-emerald-500" /><div><p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p><p className="text-sm font-semibold">{item.value}</p></div></div>);
                })}
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {[
                  { label: "Online Users", value: dashData.kpis.onlineUsers, icon: Wifi, change: `${dashData.kpis.newToday} today`, trend: "up" as const },
                  { label: "Active Sessions", value: dashData.kpis.activeSessions, icon: Activity, change: "active", trend: "flat" as const },
                  { label: "Routers Online", value: `${dashData.kpis.routersOnline}/${dashData.kpis.totalRouters}`, icon: Router, change: `${dashData.kpis.totalRouters - dashData.kpis.routersOnline} offline`, trend: "down" as const },
                  { label: "Avg Signal", value: `${dashData.kpis.avgSignal}%`, icon: Signal, change: "", trend: "flat" as const },
                  { label: "Today's Guests", value: dashData.kpis.todayGuests, icon: UsersIcon, change: "today", trend: "up" as const },
                  { label: "Bandwidth Used", value: `${typeof dashData.kpis.bandwidthUsed === 'number' ? dashData.kpis.bandwidthUsed + ' MB' : dashData.kpis.bandwidthUsed}`, icon: Download, change: "current", trend: "flat" as const },
                  { label: "Avg Session", value: `${dashData.kpis.avgSession} min`, icon: Clock, change: "average", trend: "flat" as const },
                  { label: "Peak Concurrent", value: dashData.kpis.peakConcurrent, icon: TrendingUp, change: "peak", trend: "up" as const },
                  { label: "Failed Logins", value: dashData.kpis.failedLogins, icon: XCircle, change: "today", trend: "down" as const },
                  { label: "New Today", value: dashData.kpis.newToday, icon: TrendingUp, change: "new", trend: "up" as const },
                  { label: "SLA Uptime", value: `${dashData.kpis.slaUptime}%`, icon: CheckCircle, change: "30d avg", trend: "flat" as const },
                ].map((kpi, i) => (
                  <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="border-2 border-border bg-card p-4 transition-all hover:border-[#ec3013]">
                    <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</p><kpi.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
                    <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
                    <div className="mt-1 flex items-center gap-1">
                      {kpi.trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                      {kpi.trend === "down" && <TrendingDown className="h-3 w-3 text-rose-500" />}
                      <span className={cn("text-[11px] font-medium", kpi.trend === "up" ? "text-emerald-500" : kpi.trend === "down" ? "text-rose-500" : "text-muted-foreground")}>{kpi.change}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="border-2 border-border lg:col-span-1">
                  <CardHeader><CardTitle className="text-sm font-semibold">Users Trend (24h)</CardTitle></CardHeader>
                  <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dashData.usersTrend.length > 0 ? dashData.usersTrend : Array.from({length:24},(_,i)=>({hour:`${i}`,users:0}))}><defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec3013" stopOpacity={0.3} /><stop offset="100%" stopColor="#ec3013" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Area type="monotone" dataKey="users" stroke="#ec3013" fill="url(#ug)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card className="border-2 border-border lg:col-span-1">
                  <CardHeader><CardTitle className="text-sm font-semibold">Device Distribution</CardTitle></CardHeader>
                  <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashData.deviceDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">{dashData.deviceDistribution.map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card className="border-2 border-border lg:col-span-1">
                  <CardHeader><CardTitle className="text-sm font-semibold">Hourly Sessions</CardTitle></CardHeader>
                  <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashData.hourlySessions}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="sessions" fill="#ec3013" /></BarChart></ResponsiveContainer></div></CardContent>
                </Card>
              </div>

              {/* Tables */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-2 border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-2 border-border"><CardTitle className="text-sm font-semibold">Recent Users</CardTitle><Button variant="ghost" size="sm" className="text-xs text-[#ec3013]" onClick={() => handleNav("users")}>View all</Button></CardHeader>
                  <CardContent className="p-0"><Table><TableHeader><TableRow className="border-b-2 border-border"><TableHead className="text-[10px] font-semibold uppercase">User</TableHead><TableHead className="text-[10px] font-semibold uppercase hidden md:table-cell">Device</TableHead><TableHead className="text-[10px] font-semibold uppercase">Time</TableHead><TableHead className="text-[10px] font-semibold uppercase">Status</TableHead></TableRow></TableHeader><TableBody>
                    {dashData.recentUsers.length === 0 ? (<TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No recent users</TableCell></TableRow>)
                    : dashData.recentUsers.map((u) => (<TableRow key={u.id} className="border-b border-border"><TableCell><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell><TableCell className="text-sm hidden md:table-cell">{u.device}</TableCell><TableCell className="text-xs text-muted-foreground">{u.time}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : "bg-muted-foreground")} />{u.status}</span></TableCell></TableRow>))}
                  </TableBody></Table></CardContent>
                </Card>
                <Card className="border-2 border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-2 border-border"><CardTitle className="text-sm font-semibold">Recent Alerts</CardTitle><Button variant="ghost" size="sm" className="text-xs text-[#ec3013]">View all</Button></CardHeader>
                  <CardContent className="divide-y-2 divide-border">
                    {dashData.recentAlerts.length === 0 ? (<div className="py-8 text-center text-sm text-muted-foreground">No recent alerts</div>)
                    : dashData.recentAlerts.map((a) => (<div key={a.msg} className="flex items-start gap-3 py-3 first:pt-0">
                      {a.type === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                      {a.type === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                      {a.type === "success" && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                      {a.type === "info" && <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />}
                      <div><p className="text-sm">{a.msg}</p><p className="text-xs text-muted-foreground">{a.time}</p></div>
                    </div>))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
