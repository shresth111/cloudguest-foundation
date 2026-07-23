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
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { AgentsPage } from "@/components/features/AgentsPage";
import { CampaignsPage } from "@/components/features/CampaignsPage";
import { VouchersPage } from "@/components/features/VouchersPage";
import { PortalPage } from "@/components/features/PortalPage";
import PoliciesHub from "@/components/features/PoliciesHub";
import { TeamsPage, NetworkingPage, AdvancedPage } from "@/components/features/FeatureComponents";
import WhiteList from "@/components/features/WhiteList";
import LocationPolicies from "@/components/features/LocationPolicies";
import BlockUsers from "@/components/features/BlockUsers";
import CreateGroup from "@/components/features/CreateGroup";
import UserReports from "@/components/features/UserReports";
import SmartIdPage from "@/components/features/SmartIdPage";
import { toast } from "sonner";
import {
  ArrowLeft, LogOut, Bell, Menu, Wifi, Users, LayoutDashboard, BarChart3, FileText, Megaphone, Palette, Ticket,
  ShieldCheck, Shield, Monitor, UsersRound, Bot, Network, Settings2, ScrollText, LifeBuoy, RefreshCw, CheckCircle,
  AlertTriangle, Activity, XCircle, Plus, Trash2, Download, Printer, Mail, Eye,
} from "lucide-react";

const NAVS = [
  { id: "dashboard", label: "Dashboard", roles: ["owner","agent"] },
  { id: "users", label: "Users", roles: ["owner","agent"] },
  { id: "analytics", label: "Analytics", roles: ["owner","agent"] },
  { id: "reports", label: "Reports", roles: ["owner","agent"] },
  { id: "campaigns", label: "Campaigns", roles: ["owner"] },
  { id: "portal", label: "Portal", roles: ["owner"] },
  { id: "vouchers", label: "Vouchers", roles: ["owner","agent"] },
  { id: "policies", label: "Policies", roles: ["owner"] },
  { id: "whitelist", label: "Whitelist", roles: ["owner"] },
  { id: "devices", label: "Devices", roles: ["owner","agent"] },
  { id: "teams", label: "Teams", roles: ["owner"] },
  { id: "agents", label: "Agents", roles: ["owner"] },
  { id: "networking", label: "Networking", roles: ["owner"] },
  { id: "advanced", label: "Advanced", roles: ["owner"] },
  { id: "audit", label: "Audit", roles: ["owner","agent"] },
  { id: "help", label: "Help", roles: ["owner","agent"] },
];

function getRole(): string { if (typeof window === "undefined") return "owner"; return localStorage.getItem("cg_login_role") || "owner"; }

export const Route = createFileRoute("/customer/$locationId/$feature")({

  component: FeaturePage,
});

function FeaturePage() {
  const { locationId, feature } = Route.useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation } = useCustomerStore();
  const loginRole = getRole();
  const [sidebar, setSidebar] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);

  const handleNav = (id: string) => navigate({ to: `/customer/${locationId}/${id}` });
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };

  const filteredNavs = NAVS.filter(n => n.roles.includes(loginRole as any));

  return (
    <div className="flex min-h-screen bg-muted/30">
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-all lg:static lg:z-auto", sidebar ? "w-60" : "w-0 lg:w-16 overflow-hidden", mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm"><Wifi className="h-4 w-4" /></div>{sidebar && <div><p className="text-sm font-semibold">BhaiFi</p><p className="text-[10px] text-muted-foreground">{activeLocation?.name ?? feature}</p></div>}</div>
        <div className="px-2 pt-2"><button onClick={() => navigate({ to: "/customer" })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent"><ArrowLeft className="h-3.5 w-3.5" />{sidebar && <span>Locations</span>}</button></div>
        <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto">{filteredNavs.map(item => (
          <button key={item.id} onClick={() => handleNav(item.id)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm w-full text-left transition-all", item.id === feature ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{sidebar && <span className="truncate">{item.label}</span>}</button>
        ))}</nav>
        <div className="border-t p-2 hidden lg:block"><button onClick={() => setSidebar(!sidebar)} className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent">{sidebar ? "◄" : "►"}</button></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 backdrop-blur-xl px-4 sm:px-6">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex-1"><p className="text-sm font-semibold capitalize">{feature === "dashboard" ? "Dashboard" : feature} · {activeLocation?.name ?? ""}</p></div>
          <div className="relative"><button onClick={() => setMenu(!menu)}><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar></button>
            {menu && (<div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-popover p-1 shadow-xl z-50"><div className="px-3 py-2"><p className="text-sm font-medium">{user?.name ?? "Admin"}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div><div className="border-t my-1" /><button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5"><LogOut className="h-4 w-4" />Sign out</button></div>)}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            {feature === "dashboard" && <DashboardView locationId={locationId} />}
            {feature === "users" && <UsersView locationId={locationId} />}
            {feature === "analytics" && <AnalyticsView />}
            {feature === "reports" && <UserReports />}
            {feature === "campaigns" && <CampaignsPage />}
            {feature === "portal" && <PortalPage />}
            {feature === "vouchers" && <VouchersPage />}
            {feature === "policies" && <PoliciesHub />}
            {feature === "whitelist" && <WhiteList />}
            {feature === "devices" && <DevicesView />}
            {feature === "teams" && <TeamsPage />}
            {feature === "agents" && <AgentsPage />}
            {feature === "networking" && <NetworkingPage />}
            {feature === "advanced" && <AdvancedPage />}
            {feature === "audit" && <AuditView />}
            {feature === "help" && <HelpView />}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────
function DashboardView({ locationId }: { locationId: string }) {
  const navigate = useNavigate();
  const kpis = [
    { l: "Online Users", v: "1,247" }, { l: "Active Sessions", v: "892" },
    { l: "Routers Online", v: "18/20" }, { l: "Today's Guests", v: "456" },
    { l: "Avg Session", v: "34 min" }, { l: "SLA Uptime", v: "99.97%" },
  ];
  const users = [
    { n: "John Doe", e: "john@email.com", t: "2m ago", s: "online" },
    { n: "Jane Smith", e: "jane@email.com", t: "5m ago", s: "online" },
    { n: "Raj Kumar", e: "raj@email.com", t: "12m ago", s: "online" },
    { n: "Priya Sharma", e: "priya@email.com", t: "18m ago", s: "online" },
    { n: "Alex Chen", e: "alex@email.com", t: "25m ago", s: "offline" },
  ];
  return (<div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[{i:CheckCircle,l:"System",v:"98%",c:"text-emerald-500"},{i:Wifi,l:"Routers",v:"4/4 Online",c:"text-primary"},{i:Activity,l:"ISP",v:"Tata Communications",c:"text-sky-500"},{i:Activity,l:"Load",v:"42%",c:"text-amber-500"}].map(h => (
        <div key={h.l} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><h.i className={cn("h-5 w-5", h.c)} /></div><div><p className="text-xs font-medium text-muted-foreground uppercase">{h.l}</p><p className="text-lg font-bold">{h.v}</p></div></div>
      ))}
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {kpis.map((k, i) => (<motion.div key={k.l} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}} className="rounded-2xl border bg-card p-4 shadow-sm"><p className="text-xs font-medium text-muted-foreground uppercase">{k.l}</p><p className="text-2xl font-bold mt-1">{k.v}</p></motion.div>))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">Recent Users</CardTitle><Button variant="ghost" size="sm" className="text-xs text-primary" onClick={()=>navigate({to:`/customer/${locationId}/users`})}>All →</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs font-medium">User</TableHead><TableHead className="text-xs font-medium">Time</TableHead><TableHead className="text-xs font-medium">Status</TableHead></TableRow></TableHeader><TableBody>{users.map(u => (<TableRow key={u.n} className="border-b"><TableCell><p className="text-sm font-medium">{u.n}</p><p className="text-xs text-muted-foreground">{u.e}</p></TableCell><TableCell className="text-xs text-muted-foreground">{u.t}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium",u.s==="online"?"text-emerald-500":"text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full",u.s==="online"?"bg-emerald-500":"bg-muted-foreground")}/>{u.s}</span></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-sm">Alerts</CardTitle></CardHeader><CardContent className="divide-y">{[{t:"warning",m:"GW-02 signal degradation"},{t:"success",m:"ISP failover completed"},{t:"error",m:"Bandwidth threshold exceeded"},{t:"info",m:"Firmware update available"}].map(a => (<div key={a.m} className="flex items-start gap-3 py-3">{a.t==="error"?<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"/>:a.t==="warning"?<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/>:a.t==="success"?<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"/>:<Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500"/>}<p className="text-sm">{a.m}</p></div>))}</CardContent></Card>
    </div>
  </div>);
}

// ── Users ─────────────────────────────────────────────────
function UsersView({ locationId }: { locationId: string }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("all"); const [page, setPage] = useState(0);
  const allUsers = Array.from({length:24},(_,i)=>({id:`u-${i}`,name:["John Doe","Jane Smith","Raj Kumar","Priya Sharma","Alex Chen","Sarah Wilson","Mike Brown","Emily Davis"][i%8],email:`user${i+1}@email.com`,mac:`00:1A:${10+i}`,duration:`${15+(i%6)*10}m`,download:`${(Math.random()*500).toFixed(0)}MB`,status:["online","online","online","online","online","online","online","online","online","online","online","online","online","online","online","online","idle","idle","idle","idle","offline","offline","offline","offline"][i]}));
  const filtered = allUsers.filter(u=>(tab==="all"||u.status===tab)&&(!search||u.name.toLowerCase().includes(search))).slice(page*8,(page+1)*8);
  return (<div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><Input placeholder="Search users…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} className="h-10 max-w-xs" /><div className="flex gap-1 border rounded-lg p-0.5 bg-muted/50">{[["all","All"],["online","Online"],["offline","Offline"]].map(([k,v])=>(<button key={k} onClick={()=>{setTab(k);setPage(0)}} className={cn("px-3 py-1.5 text-xs font-medium rounded-md",tab===k?"bg-background shadow-sm":"text-muted-foreground")}>{v}</button>))}</div></div>
    <Card className="border-0 shadow-sm"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs font-medium">User</TableHead><TableHead className="text-xs font-medium hidden sm:table-cell">MAC</TableHead><TableHead className="text-xs font-medium">Duration</TableHead><TableHead className="text-xs font-medium">Download</TableHead><TableHead className="text-xs font-medium">Status</TableHead></TableRow></TableHeader><TableBody>{filtered.map(u=>(<TableRow key={u.id} className="border-b"><TableCell><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell><TableCell className="font-mono text-xs hidden sm:table-cell">{u.mac}</TableCell><TableCell className="text-xs">{u.duration}</TableCell><TableCell className="text-xs">{u.download}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium",u.status==="online"?"text-emerald-500":u.status==="idle"?"text-amber-500":"text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full",u.status==="online"?"bg-emerald-500":u.status==="idle"?"bg-amber-500":"bg-muted-foreground")}/>{u.status}</span></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

// ── Analytics ─────────────────────────────────────────────
function AnalyticsView() {
  return (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{l:"Total Sessions",v:"1,892"},{l:"Unique Guests",v:"847"},{l:"Return Rate",v:"34%"},{l:"Avg Duration",v:"28 min"}].map(k=>(<Card key={k.l} className="shadow-sm border-0"><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground uppercase">{k.l}</p><p className="text-2xl font-bold mt-1">{k.v}</p></CardContent></Card>))}</div>);
}

// ── Reports ───────────────────────────────────────────────
function ReportsView() {
  return (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[{n:"Guest Report"},{n:"Bandwidth Report"},{n:"Revenue Report"},{n:"Router Report"},{n:"Voucher Report"},{n:"Portal Report"}].map(r=>(<Card key={r.n} className="shadow-sm border-0 hover:shadow-md cursor-pointer"><CardContent className="p-5"><p className="font-semibold">{r.n}</p><p className="text-xs text-muted-foreground mt-1">Last generated 3d ago</p><div className="flex gap-2 mt-3"><Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>toast.success(`${r.n} exported`)}>PDF</Button><Button size="sm" variant="outline" className="h-8 text-xs" onClick={()=>toast.success(`${r.n} exported`)}>CSV</Button></div></CardContent></Card>))}</div>);
}

// ── Devices ───────────────────────────────────────────────
function DevicesView() {
  const devices = [
    {m:"00:1A:2B:3C:4D:5E",i:"10.0.1.42",d:"iPhone 15",fs:"Today",ls:"Just now"},
    {m:"AA:BB:CC:DD:EE:FF",i:"10.0.1.87",d:"MacBook Pro",fs:"Yesterday",ls:"2 min ago"},
    {m:"11:22:33:44:55:66",i:"10.0.2.15",d:"Galaxy S24",fs:"Today",ls:"5 min ago"},
    {m:"AB:CD:EF:01:23:45",i:"10.0.2.34",d:"iPad Air",fs:"2 days ago",ls:"1 hour ago"},
  ];
  return (<Card className="shadow-sm border-0"><CardHeader><CardTitle className="text-sm">Connected Devices</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs font-medium">MAC</TableHead><TableHead className="text-xs font-medium">IP</TableHead><TableHead className="text-xs font-medium">Device</TableHead><TableHead className="text-xs font-medium">First Seen</TableHead><TableHead className="text-xs font-medium">Last Seen</TableHead></TableRow></TableHeader><TableBody>{devices.map(d=>(<TableRow key={d.m} className="border-b"><TableCell className="font-mono text-xs">{d.m}</TableCell><TableCell className="font-mono text-xs">{d.i}</TableCell><TableCell>{d.d}</TableCell><TableCell className="text-xs text-muted-foreground">{d.fs}</TableCell><TableCell className="text-xs text-muted-foreground">{d.ls}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>);
}

// ── Audit ─────────────────────────────────────────────────
function AuditView() {
  const items = [
    {a:"Guest login via OTP",w:"guest@email.com",t:"2 min ago"},{a:"Voucher batch created",w:"reception",t:"18 min ago"},
    {a:"Router restart completed",w:"system",t:"1 hour ago"},{a:"Portal branding updated",w:"manager",t:"3 hours ago"},
    {a:"Bandwidth policy changed",w:"admin",t:"5 hours ago"},{a:"New location provisioned",w:"system",t:"1 day ago"},
  ];
  return (<Card className="shadow-sm border-0"><CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader><CardContent className="divide-y">{items.map((ev,i)=>(<div key={i} className="flex items-start gap-3 py-3"><div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0"/><div className="min-w-0 flex-1"><p className="text-sm">{ev.a}</p><p className="text-xs text-muted-foreground truncate">{ev.w} · {ev.t}</p></div></div>))}</CardContent></Card>);
}

// ── Help ──────────────────────────────────────────────────
function HelpView() {
  return (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[{n:"Documentation",d:"Guides and API reference"},{n:"FAQs",d:"Frequently asked questions"},{n:"Video Tutorials",d:"Step-by-step guides"},{n:"Raise Ticket",d:"Contact support"},{n:"Live Chat",d:"Chat with engineer"},{n:"Contact",d:"Email and phone"}].map(h=>(<Card key={h.n} className="shadow-sm border-0 hover:shadow-md cursor-pointer"><CardContent className="p-5"><p className="font-semibold">{h.n}</p><p className="text-xs text-muted-foreground mt-1">{h.d}</p><Button size="sm" variant="outline" className="h-7 text-xs mt-3" onClick={()=>toast.success(`Opening ${h.n}`)}>Open</Button></CardContent></Card>))}</div>);
}
