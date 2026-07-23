import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft, LogOut, Bell, Search, Menu, Wifi, Users, LayoutDashboard, BarChart3, FileText, Megaphone, Palette, Ticket,
  ShieldCheck, Shield, Monitor, UsersRound, Bot, Network, Settings2, ScrollText, LifeBuoy, XCircle, Eye, ChevronLeft, ChevronRight, RotateCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerUsers, useDisconnectSession } from "@/hooks/useCustomerDashboard";

const NAVS = [
  { id: "dashboard", label: "Dashboard" }, { id: "users", label: "Users" },
  { id: "analytics", label: "Analytics" }, { id: "reports", label: "Reports" },
  { id: "campaigns", label: "Campaigns" }, { id: "portal", label: "Portal" },
  { id: "vouchers", label: "Vouchers" }, { id: "policies", label: "Policies" },
  { id: "whitelist", label: "Whitelist" }, { id: "devices", label: "Devices" },
  { id: "teams", label: "Teams" }, { id: "agents", label: "Agents" },
  { id: "networking", label: "Networking" }, { id: "advanced", label: "Advanced" },
  { id: "audit", label: "Audit" }, { id: "help", label: "Help" },
];

export const Route = createFileRoute("/customer/$locationId/users")({

  component: CustomerUsersPage,
});

function CustomerUsersPage() {
  const { locationId } = Route.useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation } = useCustomerStore();
  const disconnect = useDisconnectSession();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [page, setPage] = useState(0);
  const [sidebar, setSidebar] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const PAGE_SIZE = 8;

  const { data, isLoading, refetch } = useCustomerUsers(locationId, { search: search || undefined, status: statusTab !== "all" ? statusTab : undefined, page: page + 1, pageSize: PAGE_SIZE });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const handleNav = (id: string) => navigate({ to: `/customer/${locationId}/${id}` });
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-all lg:static lg:z-auto", sidebar ? "w-60" : "w-0 lg:w-16 overflow-hidden", mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm"><Wifi className="h-4 w-4" /></div>{sidebar && <div><p className="text-sm font-semibold">BhaiFi</p><p className="text-[10px] text-muted-foreground">{activeLocation?.name ?? "Users"}</p></div>}</div>
        <div className="px-2 pt-2"><button onClick={() => navigate({ to: "/customer" })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent"><ArrowLeft className="h-3.5 w-3.5" />{sidebar && <span>All locations</span>}</button></div>
        <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto">{NAVS.map((item) => (<button key={item.id} onClick={() => handleNav(item.id)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm w-full text-left transition-all", item.id === "users" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{sidebar && <span className="truncate">{item.label}</span>}</button>))}</nav>
        <div className="border-t p-2 hidden lg:block"><button onClick={() => setSidebar(!sidebar)} className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent">{sidebar ? "◄" : "►"}</button></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 backdrop-blur-xl px-4 sm:px-6">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex-1"><p className="text-sm font-semibold">Users · {activeLocation?.name ?? ""}</p></div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}><RotateCw className="h-4 w-4" /></Button>
            <div className="relative"><button onClick={() => setMenu(!menu)} className="ml-2"><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar></button>
              {menu && (<div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-popover p-1 shadow-xl z-50"><div className="px-3 py-2"><p className="text-sm font-medium">{user?.name ?? "Admin"}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div><div className="border-t my-1" /><button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5"><LogOut className="h-4 w-4" />Sign out</button></div>)}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search users…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="h-10 pl-9 bg-background" /></div>
              <div className="flex gap-1 border rounded-lg p-0.5 bg-muted/50">{["all", "online", "offline"].map((tab) => (<button key={tab} onClick={() => { setStatusTab(tab); setPage(0); }} className={cn("px-3 py-1.5 text-xs font-medium rounded-md capitalize", statusTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>{tab}</button>))}</div>
            </div>

            <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="text-xs font-medium uppercase">User</TableHead><TableHead className="text-xs font-medium uppercase hidden sm:table-cell">MAC</TableHead><TableHead className="text-xs font-medium uppercase hidden md:table-cell">Device</TableHead><TableHead className="text-xs font-medium uppercase">Duration</TableHead><TableHead className="text-xs font-medium uppercase hidden lg:table-cell">Download</TableHead><TableHead className="text-xs font-medium uppercase">Status</TableHead><TableHead className="text-xs font-medium uppercase text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-full animate-pulse rounded bg-muted" /></TableCell>))}</TableRow>))
                  : !data || data.users.length === 0 ? (<TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No users found</TableCell></TableRow>)
                  : data.users.map((u) => (<TableRow key={u.id} className="border-b"><TableCell><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell><TableCell className="font-mono text-xs hidden sm:table-cell">{u.mac}</TableCell><TableCell className="text-xs hidden md:table-cell">{u.device}</TableCell><TableCell className="text-xs">{u.duration}</TableCell><TableCell className="text-xs hidden lg:table-cell">{u.download}</TableCell><TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : u.status === "idle" ? "text-amber-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : u.status === "idle" ? "bg-amber-500" : "bg-muted-foreground")} />{u.status}</span></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => disconnect.mutate(u.id)}><XCircle className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (<div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{data?.total ?? 0} users</span><div className="flex items-center gap-1"><Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>{Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (<Button key={i} variant={page === i ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setPage(i)}>{i + 1}</Button>))}<Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>)}
          </div>
        </main>
      </div>
    </div>
  );
}
