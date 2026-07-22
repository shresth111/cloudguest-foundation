import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { RotateCw, Wifi, Activity, TrendingUp, TrendingDown, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomerShell, LoadingSkeleton } from "@/components/customer/CustomerShell";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerDashboard, useCustomerUsers, useCustomerFeatureData } from "@/hooks/useCustomerDashboard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customer/$locationId/$feature")({
  beforeLoad: ({ context }) => { if (context.auth?.status === "anonymous") throw redirect({ to: "/login" }); },
  component: CustomerFeatureRoute,
});

function CustomerFeatureRoute() {
  const { locationId, feature } = Route.useParams();
  const { activeLocationId } = useCustomerStore();
  const navigate = useNavigate();

  if (activeLocationId !== locationId) {
    return <div className="min-h-screen bg-[#0d1117] flex items-center justify-center"><p className="text-[#8b949e]">Location not found</p></div>;
  }

  return <FeaturePageShell locationId={locationId} feature={feature} />;
}

function FeaturePageShell({ locationId, feature }: { locationId: string; feature: string }) {
  const dashData = useCustomerDashboard(locationId);
  const usersData = useCustomerUsers(locationId, { page: 1, pageSize: 8 });
  const featureData = useCustomerFeatureData(feature, locationId);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  if (dashData.isLoading) return <CustomerShell locationId={locationId} feature={feature}><LoadingSkeleton /></CustomerShell>;

  const d = dashData.data;

  return (
    <CustomerShell locationId={locationId} feature={feature}>
      <div className="max-w-7xl mx-auto space-y-6">
        {feature === "dashboard" && d && (
          <>
            {/* Health Row */}
            <div className="flex flex-wrap gap-6 bg-[#161b22] border border-[#30363d] p-4 rounded">
              {[
                { icon: CheckCircle, label: "System", value: d.health.systemHealth, color: "text-emerald-500" },
                { icon: Wifi, label: "Routers", value: d.health.routersOnline, color: "text-emerald-500" },
                { icon: Activity, label: "ISP", value: d.health.isp, color: "text-emerald-500" },
                { icon: TrendingUp, label: "Load", value: d.health.networkLoad, color: "text-emerald-500" },
              ].map((item) => (<div key={item.label} className="flex items-center gap-3"><item.icon className={cn("h-5 w-5", item.color)} /><div><p className="text-xs text-[#8b949e] uppercase tracking-wider">{item.label}</p><p className="text-sm font-semibold text-[#c9d1d9]">{item.value}</p></div></div>))}
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {[
                { l: "Online", v: d.kpis.onlineUsers }, { l: "Sessions", v: d.kpis.activeSessions },
                { l: "Routers", v: `${d.kpis.routersOnline}/${d.kpis.totalRouters}` }, { l: "Today Guests", v: d.kpis.todayGuests },
                { l: "Avg Session", v: `${d.kpis.avgSession}m` }, { l: "SLA", v: `${d.kpis.slaUptime}%` },
              ].map((kpi) => (
                <div key={kpi.l} className="bg-[#161b22] border border-[#30363d] p-4 rounded hover:border-[#ec3013] transition-colors">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8b949e]">{kpi.l}</p>
                  <p className="text-xl font-bold text-[#c9d1d9] mt-1">{kpi.v}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] p-4 rounded">
                <p className="text-sm font-semibold text-[#c9d1d9] mb-3">Users (24h)</p>
                <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={d.usersTrend}><defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec3013" stopOpacity={0.3} /><stop offset="100%" stopColor="#ec3013" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#30363d" /><XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#8b949e" }} /><YAxis tick={{ fontSize: 10, fill: "#8b949e" }} /><Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d" }} /><Area type="monotone" dataKey="users" stroke="#ec3013" fill="url(#ug)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
              </div>
              <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] p-4 rounded">
                <p className="text-sm font-semibold text-[#c9d1d9] mb-3">Devices</p>
                <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={d.deviceDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">{d.deviceDistribution.map((_, i) => <Cell key={i} fill={["#ec3013","#f05a3a","#f4856a","#f7b0a0","#fad5cd","#e5e5e5"][i % 6]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              </div>
              <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] p-4 rounded">
                <p className="text-sm font-semibold text-[#c9d1d9] mb-3">Sessions</p>
                <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.hourlySessions}><CartesianGrid strokeDasharray="3 3" stroke="#30363d" /><XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#8b949e" }} /><YAxis tick={{ fontSize: 10, fill: "#8b949e" }} /><Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d" }} /><Bar dataKey="sessions" fill="#ec3013" /></BarChart></ResponsiveContainer></div>
              </div>
            </div>

            {/* Tables */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-[#161b22] border border-[#30363d] rounded">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]"><p className="text-sm font-semibold text-[#c9d1d9]">Recent Users</p><Button variant="ghost" size="sm" className="text-xs text-[#ec3013]" onClick={() => navigate({ to: `/customer/${locationId}/users` })}>All →</Button></div>
                <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-b border-[#30363d]"><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">User</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e] hidden md:table-cell">Device</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Status</TableHead></TableRow></TableHeader>
                <TableBody>{d.recentUsers.map((u) => (<TableRow key={u.id} className="border-b border-[#30363d]"><TableCell><p className="text-sm font-medium text-[#c9d1d9]">{u.name}</p><p className="text-xs text-[#8b949e]">{u.email}</p></TableCell><TableCell className="text-sm text-[#c9d1d9] hidden md:table-cell">{u.device}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : "text-[#8b949e]")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : "bg-[#8b949e]")} />{u.status}</span></TableCell></TableRow>))}</TableBody></Table></div>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]"><p className="text-sm font-semibold text-[#c9d1d9]">Alerts</p><Button variant="ghost" size="sm" className="text-xs text-[#ec3013]">All →</Button></div>
                <div className="divide-y divide-[#30363d]">{d.recentAlerts.map((a) => (<div key={a.msg} className="flex items-start gap-3 px-4 py-3">
                  {a.type === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                  {a.type === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                  {a.type === "success" && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                  {a.type === "info" && <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />}
                  <div className="min-w-0 flex-1"><p className="text-sm text-[#c9d1d9]">{a.msg}</p><p className="text-xs text-[#8b949e]">{a.time}</p></div>
                </div>))}</div>
              </div>
            </div>
          </>
        )}

        {feature === "users" && <UsersView locationId={locationId} />}
        {feature === "analytics" && <AnalyticsView locationId={locationId} />}
        {feature === "reports" && <ReportsView />}
        {feature === "campaigns" && <CampaignsView locationId={locationId} />}
        {feature === "vouchers" && <VouchersView />}
        {feature === "portal" && <PortalView />}
        {feature === "audit" && <AuditView locationId={locationId} />}
        {feature === "devices" && <DevicesView locationId={locationId} />}
        {["policies","whitelist","teams","agents","networking","advanced","help"].includes(feature) && <PlaceholderView feature={feature} />}
      </div>
    </CustomerShell>
  );
}

function UsersView({ locationId }: { locationId: string }) {
  const { data, isLoading } = useCustomerUsers(locationId, { page: 1, pageSize: 10 });
  if (isLoading) return <LoadingSkeleton />;
  return (<div className="bg-[#161b22] border border-[#30363d] rounded overflow-x-auto"><Table><TableHeader><TableRow className="border-b border-[#30363d]"><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">User</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e] hidden sm:table-cell">MAC</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Duration</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Download</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Status</TableHead></TableRow></TableHeader>
  <TableBody>{(data?.users ?? []).length === 0 ? (<TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-[#8b949e]">No users</TableCell></TableRow>) : data?.users.map((u) => (<TableRow key={u.id} className="border-b border-[#30363d]"><TableCell><p className="text-sm font-medium text-[#c9d1d9]">{u.name}</p><p className="text-xs text-[#8b949e]">{u.email}</p></TableCell><TableCell className="font-mono text-xs text-[#8b949e] hidden sm:table-cell">{u.mac}</TableCell><TableCell className="text-xs text-[#c9d1d9]">{u.duration}</TableCell><TableCell className="text-xs text-[#c9d1d9]">{u.download}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : u.status === "idle" ? "text-amber-500" : "text-[#8b949e]")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : u.status === "idle" ? "bg-amber-500" : "bg-[#8b949e]")} />{u.status}</span></TableCell></TableRow>))}</TableBody></Table></div>);
}

function AnalyticsView(_props: { locationId: string }) {
  return (<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{l:"Total Sessions",v:"1,892"},{l:"Unique Guests",v:"847"},{l:"Return Rate",v:"34%"},{l:"Avg Duration",v:"28 min"}].map((k)=> (<div key={k.l} className="bg-[#161b22] border border-[#30363d] p-4 rounded"><p className="text-[10px] font-semibold uppercase text-[#8b949e]">{k.l}</p><p className="text-xl font-bold text-[#c9d1d9] mt-1">{k.v}</p></div>))}</div>);
}

function ReportsView() {
  return (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[{n:"Guest Report"},{n:"Bandwidth Report"},{n:"Revenue Report"},{n:"Router Report"},{n:"Voucher Report"},{n:"Portal Report"}].map((r)=>(<div key={r.n} className="bg-[#161b22] border border-[#30363d] p-4 rounded hover:border-[#ec3013] transition-colors"><p className="text-sm font-semibold text-[#c9d1d9]">{r.n}</p><p className="text-xs text-[#8b949e] mt-1">Generate PDF/CSV</p><div className="flex gap-2 mt-3"><Button size="sm" variant="outline" className="h-7 text-xs border-[#30363d] text-[#c9d1d9]">PDF</Button><Button size="sm" variant="outline" className="h-7 text-xs border-[#30363d] text-[#c9d1d9]">CSV</Button></div></div>))}</div>);
}

function CampaignsView(_props: { locationId: string }) {
  return (<div className="bg-[#161b22] border border-[#30363d] rounded"><div className="px-4 py-3 border-b border-[#30363d]"><p className="text-sm font-semibold text-[#c9d1d9]">Campaigns</p></div><Table><TableHeader><TableRow className="border-b border-[#30363d]"><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Name</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Status</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Impressions</TableHead></TableRow></TableHeader>
  <TableBody>{[{n:"Summer Promo",s:"active",i:2841},{n:"New Year",s:"draft",i:0},{n:"Weekend Special",s:"active",i:1520}].map((c)=>(<TableRow key={c.n} className="border-b border-[#30363d]"><TableCell className="text-sm font-medium text-[#c9d1d9]">{c.n}</TableCell><TableCell><Badge className="bg-[#21262d] text-[#c9d1d9] border border-[#30363d] capitalize text-[10px]">{c.s}</Badge></TableCell><TableCell className="text-sm text-[#c9d1d9]">{c.i}</TableCell></TableRow>))}</TableBody></Table></div>);
}

function VouchersView() {
  return (<div className="bg-[#161b22] border border-[#30363d] rounded"><div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]"><p className="text-sm font-semibold text-[#c9d1d9]">Vouchers</p><Button size="sm" className="bg-[#ec3013] text-white text-xs hover:bg-[#d42a11]">Generate</Button></div><Table><TableHeader><TableRow className="border-b border-[#30363d]"><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Code</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Plan</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Status</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Used</TableHead></TableRow></TableHeader>
  <TableBody>{[{c:"VCH-8821",p:"1h",s:"active",u:3},{c:"VCH-8822",p:"24h",s:"active",u:12},{c:"VCH-8823",p:"1h",s:"active",u:1},{c:"VCH-8824",p:"3d",s:"unused",u:0}].map((v)=>(<TableRow key={v.c} className="border-b border-[#30363d]"><TableCell className="font-mono text-xs text-[#c9d1d9]">{v.c}</TableCell><TableCell className="text-sm text-[#c9d1d9]">{v.p}</TableCell><TableCell><Badge className="bg-[#21262d] text-[#c9d1d9] border border-[#30363d] capitalize text-[10px]">{v.s}</Badge></TableCell><TableCell className="text-sm text-[#c9d1d9]">{v.u}</TableCell></TableRow>))}</TableBody></Table></div>);
}

function PortalView() {
  return (<div className="grid gap-4 lg:grid-cols-2"><div className="bg-[#161b22] border border-[#30363d] p-4 rounded"><p className="text-sm font-semibold text-[#c9d1d9] mb-3">Portal Config</p>{[{l:"Status",v:"Live"},{l:"Theme",v:"Enterprise"},{l:"Auth",v:"OTP, SMS, Voucher"},{l:"Languages",v:"EN, HI, AR"}].map((f)=>(<div key={f.l} className="flex justify-between border-b border-[#30363d] pb-2 mb-2"><span className="text-sm text-[#8b949e]">{f.l}</span><span className="text-sm font-medium text-[#c9d1d9]">{f.v}</span></div>))}</div><div className="bg-[#161b22] border border-[#30363d] p-4 rounded flex flex-col items-center justify-center"><p className="text-sm font-semibold text-[#c9d1d9] mb-2">QR Code</p><div className="grid h-32 w-32 place-items-center bg-[#21262d] border border-[#30363d] rounded"><svg className="h-16 w-16 text-[#8b949e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div><p className="text-xs text-[#8b949e] mt-2">portal.cloudguest.io</p></div></div>);
}

function AuditView(_props: { locationId: string }) {
  const items = [{a:"Guest login via OTP",w:"guest@email.com",t:"2m ago"},{a:"Voucher VCH-8824 created",w:"reception",t:"18m ago"},{a:"Router restart completed",w:"system",t:"1h ago"},{a:"Portal branding updated",w:"manager",t:"3h ago"}];
  return (<div className="bg-[#161b22] border border-[#30363d] rounded"><div className="px-4 py-3 border-b border-[#30363d]"><p className="text-sm font-semibold text-[#c9d1d9]">Audit Trail</p></div><div className="divide-y divide-[#30363d]">{items.map((ev,i)=>(<div key={i} className="flex items-start gap-3 px-4 py-3"><div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5"/><div><p className="text-sm text-[#c9d1d9]">{ev.a}</p><p className="text-xs text-[#8b949e]">{ev.w} · {ev.t}</p></div></div>))}</div></div>);
}

function DevicesView(_props: { locationId: string }) {
  return (<div className="bg-[#161b22] border border-[#30363d] rounded"><div className="px-4 py-3 border-b border-[#30363d]"><p className="text-sm font-semibold text-[#c9d1d9]">Connected Devices</p></div><Table><TableHeader><TableRow className="border-b border-[#30363d]"><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">MAC</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">IP</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Device</TableHead><TableHead className="text-[10px] font-semibold uppercase text-[#8b949e]">Last Seen</TableHead></TableRow></TableHeader>
  <TableBody>{[{m:"00:1A:2B:3C:4D:5E",i:"10.0.1.42",d:"iPhone 15",ls:"Just now"},{m:"AA:BB:CC:DD:EE:FF",i:"10.0.1.87",d:"MacBook Pro",ls:"2m ago"}].map((dv)=>(<TableRow key={dv.m} className="border-b border-[#30363d]"><TableCell className="font-mono text-xs text-[#c9d1d9]">{dv.m}</TableCell><TableCell className="font-mono text-xs text-[#c9d1d9]">{dv.i}</TableCell><TableCell className="text-sm text-[#c9d1d9]">{dv.d}</TableCell><TableCell className="text-xs text-[#8b949e]">{dv.ls}</TableCell></TableRow>))}</TableBody></Table></div>);
}

function PlaceholderView({ feature }: { feature: string }) {
  const descriptions: Record<string, string> = {
    policies: "Authentication, bandwidth, and access policies via GET /policies/resolve, POST /policies",
    whitelist: "MAC whitelist via GET /guest-access/device-rules, POST /guest-access/device-rules",
    teams: "Guest teams with shared quotas via GET /guest-teams, POST /guest-teams",
    agents: "Agent permissions via GET /roles/suggested, GET /permissions/tree",
    networking: "VLAN, DHCP, DNS, Firewall, Hotspot, ISP management",
    advanced: "System configuration, integrations, and advanced tools",
    help: "Documentation, FAQs, video tutorials, and support",
  };
  return (<div className="bg-[#161b22] border border-[#30363d] p-8 rounded text-center"><p className="text-sm font-semibold text-[#c9d1d9] mb-2 capitalize">{feature}</p><p className="text-xs text-[#8b949e]">{descriptions[feature] ?? "Module available"}</p></div>);
}
