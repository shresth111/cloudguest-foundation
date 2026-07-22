import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ChevronLeft, Bell, Search, Sun, Moon, LayoutDashboard, Users, BarChart3,
  FileText, Megaphone, Palette, Ticket, ShieldCheck, Shield, Monitor,
  UsersRound, Bot, Network, Settings2, ScrollText, LifeBuoy, Menu, X,
  Wifi, Router, Activity, Signal, Download, Upload, Clock, TrendingUp,
  TrendingDown, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCustomerStore } from "@/stores/customerStore";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
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

const KPI_DATA = [
  { label: "Online Users", value: "1,247", icon: Wifi, change: "+12%", trend: "up" },
  { label: "Active Sessions", value: "892", icon: Activity, change: "+5%", trend: "up" },
  { label: "Routers Online", value: "18/20", icon: Router, change: "2 offline", trend: "down" },
  { label: "Avg Signal", value: "87%", icon: Signal, change: "+3%", trend: "up" },
  { label: "Today's Guests", value: "456", icon: Users, change: "+22%", trend: "up" },
  { label: "Bandwidth Used", value: "2.4 Gbps", icon: Download, change: "+8%", trend: "up" },
  { label: "Avg Session", value: "34 min", icon: Clock, change: "-2 min", trend: "down" },
  { label: "Upload Total", value: "680 Mbps", icon: Upload, change: "+15%", trend: "up" },
  { label: "Peak Concurrent", value: "234", icon: TrendingUp, change: "2:30 PM", trend: "flat" },
  { label: "Failed Logins", value: "12", icon: XCircle, change: "-8%", trend: "down" },
  { label: "New Today", value: "89", icon: TrendingUp, change: "+18%", trend: "up" },
  { label: "SLA Uptime", value: "99.97%", icon: CheckCircle, change: "30d avg", trend: "flat" },
];

const USERS_TREND = [
  { hour: "00", users: 120 }, { hour: "02", users: 80 }, { hour: "04", users: 65 },
  { hour: "06", users: 90 }, { hour: "08", users: 240 }, { hour: "10", users: 380 },
  { hour: "12", users: 420 }, { hour: "14", users: 480 }, { hour: "16", users: 520 },
  { hour: "18", users: 490 }, { hour: "20", users: 350 }, { hour: "22", users: 200 },
];

const DEVICES = [
  { name: "iOS", value: 35 }, { name: "Android", value: 28 }, { name: "Windows", value: 18 },
  { name: "macOS", value: 12 }, { name: "Linux", value: 5 }, { name: "Other", value: 2 },
];

const SESSIONS = [
  { hour: "00", sessions: 45 }, { hour: "04", sessions: 22 }, { hour: "08", sessions: 156 },
  { hour: "12", sessions: 289 }, { hour: "16", sessions: 342 }, { hour: "20", sessions: 198 },
];

const COLORS = ["#ec3013", "#f05a3a", "#f4856a", "#f7b0a0", "#fad5cd", "#e5e5e5"];

const RECENT_USERS = [
  { id: "u1", name: "John Doe", email: "john@email.com", device: "iPhone 15", time: "2 min ago", status: "online" },
  { id: "u2", name: "Jane Smith", email: "jane@email.com", device: "Samsung S24", time: "5 min ago", status: "online" },
  { id: "u3", name: "Raj Kumar", email: "raj@email.com", device: "MacBook Pro", time: "12 min ago", status: "online" },
  { id: "u4", name: "Priya Sharma", email: "priya@email.com", device: "Pixel 8", time: "18 min ago", status: "online" },
  { id: "u5", name: "Alex Chen", email: "alex@email.com", device: "iPad Air", time: "25 min ago", status: "online" },
  { id: "u6", name: "Sarah Wilson", email: "sarah@email.com", device: "Windows Laptop", time: "32 min ago", status: "offline" },
];

const ALERTS = [
  { type: "warning", msg: "Router GW-02 signal degradation", time: "2 min ago" },
  { type: "success", msg: "ISP failover completed", time: "8 min ago" },
  { type: "error", msg: "Bandwidth threshold at Mumbai HQ", time: "15 min ago" },
  { type: "info", msg: "Firmware update for GW-05", time: "22 min ago" },
];

export const Route = createFileRoute("/customer/$locationId/dashboard")({
  component: CustomerDashboardPage,
});

function CustomerDashboardPage() {
  const { locationId } = Route.useParams();
  const navigate = useNavigate();
  const { activeLocation, activeLocationId } = useCustomerStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const handleNav = (id: string) => {
    if (id === "dashboard") navigate({ to: `/customer/${locationId}/dashboard` });
    else if (id === "users") navigate({ to: `/customer/${locationId}/users` });
    setMobileOpen(false);
  };

  return (
    <div className={cn("customer-theme flex min-h-screen", theme === "dark" && "dark")}>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r-2 border-border transition-all duration-200 lg:static lg:z-auto",
        sidebarOpen ? "w-56" : "w-14",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="flex items-center gap-3 border-b-2 border-border px-3 h-14 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center bg-[#ec3013] text-white text-xs font-bold rounded-none">CG</div>
          {sidebarOpen && <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{activeLocation?.name ?? "CloudGuest"}</p></div>}
        </div>
        <button className="absolute right-2 top-3 lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
        <div className="px-2 pt-2">
          <button onClick={() => { navigate({ to: "/customer" }); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />{sidebarOpen && <span>All locations</span>}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === "dashboard";
            return (
              <button key={item.id} onClick={() => handleNav(item.id)} className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors border-l-2",
                isActive ? "border-l-[#ec3013] bg-[#f3f2f2] dark:bg-neutral-800 text-[#ec3013] font-semibold" : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}>
                <Icon className="h-4 w-4 shrink-0" />{sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t-2 border-border p-2 hidden lg:block">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex w-full items-center justify-center px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            {sidebarOpen ? "◄ Collapse" : "►"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b-2 border-border bg-card px-4">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{activeLocation?.name ?? "Dashboard"}</p></div>
          <div className="flex items-center gap-1.5">
            <button className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"><Search className="h-4 w-4" /></button>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground relative">
                <Bell className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#ec3013] text-[7px] font-bold text-white flex items-center justify-center">3</span>
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 border-2 border-border bg-card shadow-lg z-50">
                  <div className="p-3 border-b-2 border-border"><p className="text-xs font-semibold uppercase">Notifications</p></div>
                  {[{ t: "Router GW-02 Offline", d: "2 min ago" }, { t: "Bandwidth at 85%", d: "15 min ago" }, { t: "Firmware available", d: "1 hr ago" }].map((n, i) => (
                    <div key={i} className="p-3 border-b-2 border-border last:border-0 hover:bg-muted/50"><p className="text-sm font-medium">{n.t}</p><p className="text-xs text-muted-foreground">{n.d}</p></div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground">
              {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 bg-[#f3f2f2] dark:bg-neutral-900 p-6 space-y-6 max-w-7xl">
          {/* Health Row */}
          <div className="flex flex-wrap gap-6 border-2 border-border bg-card p-4">
            {[
              { icon: CheckCircle, label: "System Health", value: "98%" },
              { icon: Router, label: "Routers", value: "4/4 Online" },
              { icon: Activity, label: "ISP", value: activeLocation?.isp ?? "Active" },
              { icon: Wifi, label: "Network Load", value: "42%" },
            ].map((item) => {
              const Icon = item.icon;
              return (<div key={item.label} className="flex items-center gap-3"><Icon className="h-5 w-5 text-emerald-500" /><div><p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p><p className="text-sm font-semibold">{item.value}</p></div></div>);
            })}
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {KPI_DATA.map((kpi, i) => (
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
              <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={USERS_TREND}><defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec3013" stopOpacity={0.3} /><stop offset="100%" stopColor="#ec3013" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 0.08)" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Area type="monotone" dataKey="users" stroke="#ec3013" fill="url(#ug)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
            </Card>
            <Card className="border-2 border-border lg:col-span-1">
              <CardHeader><CardTitle className="text-sm font-semibold">Device Distribution</CardTitle></CardHeader>
              <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={DEVICES} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">{DEVICES.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="flex flex-wrap justify-center gap-3 mt-2">{DEVICES.map((d, i) => (<span key={d.name} className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />{d.name} {d.value}%</span>))}</div></div></CardContent>
            </Card>
            <Card className="border-2 border-border lg:col-span-1">
              <CardHeader><CardTitle className="text-sm font-semibold">Hourly Sessions</CardTitle></CardHeader>
              <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={SESSIONS}><CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 0.08)" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="sessions" fill="#ec3013" /></BarChart></ResponsiveContainer></div></CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-2 border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-2 border-border"><CardTitle className="text-sm font-semibold">Recent Users</CardTitle><Button variant="ghost" size="sm" className="text-xs text-[#ec3013]">View all</Button></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow className="border-b-2 border-border"><TableHead className="text-[10px] font-semibold uppercase">User</TableHead><TableHead className="text-[10px] font-semibold uppercase hidden md:table-cell">Device</TableHead><TableHead className="text-[10px] font-semibold uppercase">Time</TableHead><TableHead className="text-[10px] font-semibold uppercase">Status</TableHead></TableRow></TableHeader><TableBody>{RECENT_USERS.map((u) => (<TableRow key={u.id} className="border-b border-border"><TableCell><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell><TableCell className="text-sm hidden md:table-cell">{u.device}</TableCell><TableCell className="text-xs text-muted-foreground">{u.time}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : "bg-muted-foreground")} />{u.status}</span></TableCell></TableRow>))}</TableBody></Table></CardContent>
            </Card>
            <Card className="border-2 border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-2 border-border"><CardTitle className="text-sm font-semibold">Recent Alerts</CardTitle><Button variant="ghost" size="sm" className="text-xs text-[#ec3013]">View all</Button></CardHeader>
              <CardContent className="divide-y-2 divide-border">{ALERTS.map((a) => (<div key={a.msg} className="flex items-start gap-3 py-3 first:pt-0">
                {a.type === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                {a.type === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                {a.type === "success" && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                {a.type === "info" && <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />}
                <div className="min-w-0 flex-1"><p className="text-sm">{a.msg}</p><p className="text-xs text-muted-foreground">{a.time}</p></div>
              </div>))}</CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
