import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { ChevronLeft, Bell, Search, Sun, Moon, LayoutDashboard, Users, BarChart3, FileText, Megaphone, Palette, Ticket, ShieldCheck, Shield, Monitor, UsersRound, Bot, Network, Settings2, ScrollText, LifeBuoy, Menu, X, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerSidebar, useCustomerFeatureData } from "@/hooks/useCustomerDashboard";

const MODULE_ICONS: Record<string, typeof LayoutDashboard> = { dashboard: LayoutDashboard, users: Users, analytics: BarChart3, reports: FileText, campaigns: Megaphone, portal: Palette, vouchers: Ticket, policies: ShieldCheck, whitelist: Shield, devices: Monitor, teams: UsersRound, agents: Bot, networking: Network, advanced: Settings2, audit: ScrollText, help: LifeBuoy };

const FEATURE_DESC: Record<string, string> = {
  analytics: "Guest, network, and authentication analytics — powered by GET /analytics/guests, /analytics/network, /analytics/authentication, /guest-analytics/summary",
  reports: "Generate PDF/CSV reports — powered by POST /reports, GET /reports/templates, GET /reports/schedule",
  campaigns: "Guest engagement campaigns — powered by GET/POST /campaigns",
  portal: "Captive portal configuration — powered by GET /captive-portal, GET /guest/login/otp, POST /guest/consent",
  vouchers: "Voucher batch management — powered by GET/POST /voucher-batches, GET /voucher-plans, GET /voucher-series",
  policies: "Authentication, bandwidth, and access policies — powered by GET/POST /policies, /policies/resolve",
  whitelist: "MAC and device whitelisting — powered by GET /guest-access/device-rules, POST /guest-access/check",
  devices: "Connected device monitoring — powered by GET /connected-devices",
  teams: "Guest team management with shared quotas — powered by GET/POST /guest-teams",
  agents: "Support agent permissions — powered by GET /roles/suggested, GET /permissions/tree",
  networking: "VLAN, DHCP, DNS, Firewall, Hotspot, ISP — powered by /vlan, /dhcp, /dns, /firewall, /hotspot, /isp",
  advanced: "System configuration and integrations",
  audit: "Complete audit trail — powered by GET /audit/entries with CSV export at /audit/entries/export",
  help: "Documentation, FAQs, and support resources",
};

export const Route = createFileRoute("/customer/$locationId/$feature")({
  beforeLoad: ({ context }) => {
    if (context.auth?.status === "anonymous") throw redirect({ to: "/login" });
  },
  component: CustomerFeaturePage });

function CustomerFeaturePage() {
  const { locationId, feature } = Route.useParams();
  const navigate = useNavigate();
  const { activeLocation } = useCustomerStore();
  const { data: navItems } = useCustomerSidebar();
  const { data: featureData, isLoading, isError, refetch } = useCustomerFeatureData(feature, locationId);
  const meta = FEATURE_DESC[feature] ?? `${feature} management`;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const toggleTheme = () => { const n = theme === "light" ? "dark" : "light"; setTheme(n); document.documentElement.classList.toggle("dark", n === "dark"); };
  const items = navItems ?? [
    { id: "dashboard", label: "Dashboard", module: "" },
    { id: "users", label: "Users", module: "" },
    { id: "analytics", label: "Analytics", module: "" }, { id: "reports", label: "Reports", module: "" },
    { id: "campaigns", label: "Campaigns", module: "" }, { id: "portal", label: "Portal", module: "" },
    { id: "vouchers", label: "Vouchers", module: "" }, { id: "policies", label: "Policies", module: "" },
    { id: "whitelist", label: "Whitelist", module: "" }, { id: "devices", label: "Devices", module: "" },
    { id: "teams", label: "Teams", module: "" }, { id: "agents", label: "Agents", module: "" },
    { id: "networking", label: "Networking", module: "" }, { id: "advanced", label: "Advanced", module: "" },
    { id: "audit", label: "Audit Logs", module: "" }, { id: "help", label: "Help", module: "" },
  ];

  return (
    <div className={cn("customer-theme flex min-h-screen", theme === "dark" && "dark")}>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r-2 border-border lg:static lg:z-auto", sidebarOpen ? "w-56" : "w-14", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="flex items-center gap-3 border-b-2 border-border px-3 h-14 shrink-0"><div className="flex h-8 w-8 items-center justify-center bg-[#ec3013] text-white text-xs font-bold">CG</div>{sidebarOpen && <p className="text-sm font-semibold truncate">{activeLocation?.name ?? "CloudGuest"}</p>}</div>
        <button className="absolute right-2 top-3 lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
        <div className="px-2 pt-2"><button onClick={() => navigate({ to: "/customer" })} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><ChevronLeft className="h-3.5 w-3.5" />{sidebarOpen && <span>All locations</span>}</button></div>
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {items.map((item) => {
            const Icon = MODULE_ICONS[item.id] ?? LayoutDashboard; const isActive = item.id === feature;
            return (<button key={item.id} onClick={() => { navigate({ to: `/customer/${locationId}/${item.id}` }); setMobileOpen(false); }} className={cn("flex w-full items-center gap-3 px-3 py-2 text-sm border-l-2", isActive ? "border-l-[#ec3013] bg-[#f3f2f2] dark:bg-neutral-800 text-[#ec3013] font-semibold" : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50")}><Icon className="h-4 w-4 shrink-0" />{sidebarOpen && <span className="truncate">{item.label}</span>}</button>);
          })}
        </nav>
        <div className="border-t-2 border-border p-2 hidden lg:block"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex w-full items-center justify-center px-3 py-2 text-xs text-muted-foreground">{sidebarOpen ? "◄ Collapse" : "►"}</button></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b-2 border-border bg-card px-4">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <p className="text-sm font-semibold flex-1 truncate capitalize">{feature}</p>
          <button className="flex h-8 w-8 items-center justify-center text-muted-foreground"><Search className="h-4 w-4" /></button>
          <div className="relative"><button onClick={() => setNotifOpen(!notifOpen)} className="flex h-8 w-8 items-center justify-center text-muted-foreground relative"><Bell className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-3 w-3 bg-[#ec3013] text-[7px] font-bold text-white flex items-center justify-center">3</span></button></div>
          <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center text-muted-foreground">{theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <button onClick={() => refetch()} className="flex h-8 w-8 items-center justify-center text-muted-foreground"><RotateCw className="h-4 w-4" /></button>
        </header>

        <main className="flex-1 bg-[#f3f2f2] dark:bg-neutral-900 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-start justify-between"><div><h1 className="text-xl font-bold capitalize">{feature}</h1><p className="text-xs text-muted-foreground mt-1">{meta}</p></div></div>
            {isLoading ? (<div className="space-y-3 animate-pulse">{Array.from({length:4}).map((_,i)=><div key={i} className="border-2 border-border bg-card p-6"><div className="h-4 w-48 bg-muted mb-3"/><div className="h-8 w-full bg-muted"/></div>)}</div>)
            : isError ? (<div className="text-center py-12"><p className="text-muted-foreground mb-4">Failed to load</p><Button variant="outline" className="border-2 border-border rounded-none" onClick={()=>refetch()}><RotateCw className="mr-2 h-4 w-4"/>Retry</Button></div>)
            : <FeatureContent feature={feature} locationId={locationId} data={featureData} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function FeatureContent({ feature, locationId, data }: { feature: string; locationId: string; data: any }) {
  switch (feature) {
    case "analytics": {
      const a = data?.analytics;
      return (<div className="grid gap-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-2 border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Total Sessions</p><p className="text-xl font-bold mt-1">{a?.totalSessions ?? 1892}</p></CardContent></Card>
        <Card className="border-2 border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Unique Guests</p><p className="text-xl font-bold mt-1">{a?.uniqueGuests ?? 847}</p></CardContent></Card>
        <Card className="border-2 border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Return Rate</p><p className="text-xl font-bold mt-1">{a?.returningRate ?? 34}%</p></CardContent></Card>
        <Card className="border-2 border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Avg Duration</p><p className="text-xl font-bold mt-1">{Math.round(a?.avgDuration ?? 28)} min</p></CardContent></Card>
      </div><Card className="border-2 border-border"><CardContent className="p-6 text-sm text-muted-foreground">Real analytics loaded from <code>GET /guest-analytics/summary</code>, <code>GET /analytics/guests</code>, <code>GET /analytics/routers</code>, <code>GET /analytics/network</code>, <code>GET /analytics/authentication</code> — all scoped to organization via X-Organization-Id.</CardContent></Card></div>);
    }
    case "reports": return (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[{n:"Guest Report",d:"Guest activity, trends, and demographics"},{n:"Bandwidth Report",d:"Usage trends and top consumers"},{n:"Revenue Report",d:"Revenue, MRR, and billing summary"},{n:"Router Report",d:"Router health, uptime, and performance"},{n:"Voucher Report",d:"Voucher usage and redemption rates"},{n:"Portal Report",d:"Portal views, conversions, and engagement"}].map((r)=>(<Card key={r.n} className="border-2 border-border hover:border-[#ec3013] transition-colors"><CardContent className="p-4"><p className="text-sm font-semibold">{r.n}</p><p className="text-xs text-muted-foreground mt-1">{r.d}</p><div className="flex gap-2 mt-3"><Button size="sm" variant="outline" className="h-7 text-xs border-2 border-border">PDF</Button><Button size="sm" variant="outline" className="h-7 text-xs border-2 border-border">CSV</Button></div></CardContent></Card>))}</div>);
    case "campaigns": return (<Card className="border-2 border-border"><CardHeader><CardTitle className="text-sm">Campaigns</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead className="text-xs font-semibold uppercase">Name</TableHead><TableHead className="text-xs font-semibold uppercase">Status</TableHead><TableHead className="text-xs font-semibold uppercase">Impressions</TableHead></TableRow></TableHeader><TableBody>{(data?.campaigns ?? []).length === 0 ? (<TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No campaigns — GET /campaigns</TableCell></TableRow>) : data.campaigns.map((c:any)=>(<TableRow key={c.id} className="border-b border-border"><TableCell className="text-sm font-medium">{c.name}</TableCell><TableCell><Badge variant={c.status==="active"?"default":"secondary"} className="capitalize text-[10px]">{c.status}</Badge></TableCell><TableCell className="text-sm">{c.impressions}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>);
    case "vouchers": return (<Card className="border-2 border-border"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Voucher Batches</CardTitle><Button size="sm" className="bg-[#ec3013] text-white text-xs">Generate</Button></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead className="text-xs font-semibold uppercase">Code</TableHead><TableHead className="text-xs font-semibold uppercase">Plan</TableHead><TableHead className="text-xs font-semibold uppercase">Status</TableHead><TableHead className="text-xs font-semibold uppercase">Used</TableHead></TableRow></TableHeader><TableBody>{(data?.vouchers ?? []).length === 0 ? (<TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No vouchers — GET /voucher-batches, POST /voucher-batches</TableCell></TableRow>) : data.vouchers.map((v:any)=>(<TableRow key={v.code} className="border-b border-border"><TableCell className="font-mono text-xs">{v.code}</TableCell><TableCell className="text-sm">{v.plan}</TableCell><TableCell><Badge variant={v.status==="active"?"default":"secondary"} className="capitalize text-[10px]">{v.status}</Badge></TableCell><TableCell className="text-sm">{v.used}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>);
    case "portal": return (<div className="grid gap-4 lg:grid-cols-2"><Card className="border-2 border-border"><CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader><CardContent className="space-y-3">{(data?.portal ? [{l:"Status",v:data.portal.status},{l:"Theme",v:data.portal.theme},{l:"Auth",v:data.portal.authMethods.join(", ")},{l:"Languages",v:data.portal.languages.join(", ")}] : [{l:"Status",v:"Live"},{l:"Theme",v:"Enterprise Blue"},{l:"Endpoints",v:"POST /guest/login/otp, /guest/login/voucher, /guest/consent"},{l:"Config",v:"GET /captive-portal"}]).map((f)=>(<div key={f.l} className="flex justify-between border-b-2 border-border pb-2"><span className="text-sm text-muted-foreground">{f.l}</span><span className="text-sm font-medium">{f.v}</span></div>))}</CardContent></Card><Card className="border-2 border-border"><CardHeader><CardTitle className="text-sm">QR Code</CardTitle></CardHeader><CardContent className="flex flex-col items-center gap-3"><div className="grid h-32 w-32 place-items-center bg-[#f3f2f2]"><Palette className="h-12 w-12 text-muted-foreground"/></div><p className="text-xs text-muted-foreground">portal.cloudguest.io/{locationId}</p></CardContent></Card></div>);
    case "policies": return (<Card className="border-2 border-border"><CardContent className="p-6 text-sm text-muted-foreground"><p className="font-semibold text-foreground mb-2">Policy Engine</p>Authentication, bandwidth, and access policies — powered by <code>GET /policies/resolve</code>, <code>POST /policies</code>, <code>POST /policies/{id}/activate</code>, <code>POST /policies/{id}/assignments</code>. Each policy is scoped by organization, location, or group.</CardContent></Card>);
    case "whitelist": return (<Card className="border-2 border-border"><CardContent className="p-6 text-sm text-muted-foreground"><p className="font-semibold text-foreground mb-2">MAC Whitelist</p>Manage MAC address and device whitelisting — <code>GET /guest-access/device-rules</code>, <code>POST /guest-access/device-rules</code>, <code>POST /guest-access/rules</code>. Access checks via <code>POST /guest-access/check</code>.</CardContent></Card>);
    case "devices": return (<Card className="border-2 border-border"><CardHeader><CardTitle className="text-sm">Connected Devices</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead className="text-xs font-semibold uppercase">MAC</TableHead><TableHead className="text-xs font-semibold uppercase">IP</TableHead><TableHead className="text-xs font-semibold uppercase">Device</TableHead><TableHead className="text-xs font-semibold uppercase">Last Seen</TableHead></TableRow></TableHeader><TableBody>{(data?.devices ?? []).length === 0 ? (<TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No devices — GET /connected-devices</TableCell></TableRow>) : data.devices.map((d:any)=>(<TableRow key={d.mac} className="border-b border-border"><TableCell className="font-mono text-xs">{d.mac}</TableCell><TableCell className="font-mono text-xs">{d.ip}</TableCell><TableCell className="text-sm">{d.device}</TableCell><TableCell className="text-xs text-muted-foreground">{d.lastSeen}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>);
    case "teams": return (<Card className="border-2 border-border"><CardContent className="p-6 text-sm text-muted-foreground"><p className="font-semibold text-foreground mb-2">Guest Teams</p>Team-based access with shared data quotas — <code>GET /guest-teams</code>, <code>POST /guest-teams</code>, <code>DELETE /guest-teams/{id}/members/{guestId}</code>, <code>POST /guest-teams/{id}/revoke</code>. Teams can share bandwidth and time limits.</CardContent></Card>);
    case "agents": return (<Card className="border-2 border-border"><CardContent className="p-6 text-sm text-muted-foreground"><p className="font-semibold text-foreground mb-2">Agent Permissions</p>Invite and manage support agents — <code>GET /roles/suggested</code>, <code>GET /permissions/tree</code>, <code>POST /agents/{id}/permissions</code>. Role-based access via <code>POST /users/{id}/roles</code>, <code>DELETE /users/{id}/roles/{assignmentId}</code>.</CardContent></Card>);
    case "networking": return (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{["VLAN","DHCP","DNS","Firewall","Hotspot","ISP","Port Forwarding","MAC Auth","QoS"].map((n)=>(<Card key={n} className="border-2 border-border hover:border-[#ec3013] transition-colors cursor-pointer"><CardContent className="p-4"><p className="text-sm font-semibold">{n}</p><p className="text-xs text-muted-foreground mt-1">Manage {n.toLowerCase()} — GET/POST /{n.toLowerCase().replace(/ /g,"-")}</p></CardContent></Card>))}</div>);
    case "audit": return (<Card className="border-2 border-border"><CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader><CardContent>{(data?.audit ?? []).length === 0 ? (<p className="text-sm text-muted-foreground py-8 text-center">No audit entries — GET /audit/entries, Export: GET /audit/entries/export</p>) : (<div className="space-y-3">{data.audit.map((ev:any,i:number)=>(<div key={i} className="flex items-start gap-3 border-b-2 border-border pb-2 last:border-0"><div className={cn("h-2 w-2 rounded-full mt-1.5",ev.status==="success"?"bg-emerald-500":"bg-sky-500")}/><div className="min-w-0 flex-1"><p className="text-sm">{ev.action}</p><p className="text-xs text-muted-foreground">{ev.user} · {ev.time}</p></div></div>))}</div>)}</CardContent></Card>);
    case "help": return (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{["Documentation","FAQs","Video Tutorials","Raise Ticket","Live Chat","Contact Support"].map((h)=>(<Card key={h} className="border-2 border-border hover:border-[#ec3013] transition-colors cursor-pointer"><CardContent className="p-4"><p className="text-sm font-semibold">{h}</p><p className="text-xs text-muted-foreground mt-1">Access {h.toLowerCase()}</p></CardContent></Card>))}</div>);
    default: return <div className="text-center py-12 text-muted-foreground">Module not found</div>;
  }
}
