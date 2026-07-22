import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft, Bell, Search, Sun, Moon, LayoutDashboard, Users as UsersIcon, BarChart3,
  FileText, Megaphone, Palette, Ticket, ShieldCheck, Shield, Monitor,
  UsersRound, Bot, Network, Settings2, ScrollText, LifeBuoy, Menu, X, RotateCw,
  Download, XCircle, Ban, Eye, ChevronLeft as PageLeft, ChevronRight as PageRight,
  CheckSquare, Square, ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerUsers, useDisconnectSession } from "@/hooks/useCustomerDashboard";

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

export const Route = createFileRoute("/customer/$locationId/users")({
  component: CustomerUsersPage,
});

function CustomerUsersPage() {
  const { locationId } = Route.useParams();
  const navigate = useNavigate();
  const { activeLocation } = useCustomerStore();
  const disconnectMutation = useDisconnectSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerUser, setDrawerUser] = useState<any>(null);
  const PAGE_SIZE = 20;

  const { data: usersData, isLoading, isError, refetch } = useCustomerUsers(
    locationId,
    { search: search || undefined, status: statusTab !== "all" ? statusTab : undefined, page: page + 1, pageSize: PAGE_SIZE }
  );

  const toggleTheme = () => { const n = theme === "light" ? "dark" : "light"; setTheme(n); document.documentElement.classList.toggle("dark", n === "dark"); };
  const toggleSelect = (id: string) => { setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleAll = () => { if (!usersData) return; if (selected.size === usersData.users.length) setSelected(new Set()); else setSelected(new Set(usersData.users.map((u) => u.id))); };
  const totalPages = usersData ? Math.ceil(usersData.total / PAGE_SIZE) : 0;

  return (
    <div className={cn("customer-theme flex min-h-screen", theme === "dark" && "dark")}>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r-2 border-border lg:static lg:z-auto", sidebarOpen ? "w-56" : "w-14", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="flex items-center gap-3 border-b-2 border-border px-3 h-14 shrink-0"><div className="flex h-8 w-8 items-center justify-center bg-[#ec3013] text-white text-xs font-bold">CG</div>{sidebarOpen && <p className="text-sm font-semibold truncate">{activeLocation?.name ?? "CloudGuest"}</p>}</div>
        <button className="absolute right-2 top-3 lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
        <div className="px-2 pt-2"><button onClick={() => navigate({ to: "/customer" })} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><ChevronLeft className="h-3.5 w-3.5" />{sidebarOpen && <span>All locations</span>}</button></div>
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon; const isActive = item.id === "users";
            return (<button key={item.id} onClick={() => { if (item.id === "dashboard") navigate({ to: `/customer/${locationId}/dashboard` }); setMobileOpen(false); }} className={cn("flex w-full items-center gap-3 px-3 py-2 text-sm border-l-2", isActive ? "border-l-[#ec3013] bg-[#f3f2f2] dark:bg-neutral-800 text-[#ec3013] font-semibold" : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50")}><Icon className="h-4 w-4 shrink-0" />{sidebarOpen && <span className="truncate">{item.label}</span>}</button>);
          })}
        </nav>
        <div className="border-t-2 border-border p-2 hidden lg:block"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex w-full items-center justify-center px-3 py-2 text-xs text-muted-foreground">{sidebarOpen ? "◄ Collapse" : "►"}</button></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b-2 border-border bg-card px-4">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <p className="text-sm font-semibold flex-1 truncate">{activeLocation?.name ?? "Users"}</p>
          <button className="flex h-8 w-8 items-center justify-center text-muted-foreground"><Search className="h-4 w-4" /></button>
          <div className="relative"><button onClick={() => setNotifOpen(!notifOpen)} className="flex h-8 w-8 items-center justify-center text-muted-foreground relative"><Bell className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-3 w-3 bg-[#ec3013] text-[7px] font-bold text-white flex items-center justify-center">3</span></button></div>
          <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center text-muted-foreground">{theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <button onClick={() => refetch()} className="flex h-8 w-8 items-center justify-center text-muted-foreground"><RotateCw className="h-4 w-4" /></button>
        </header>

        <main className="flex-1 bg-[#f3f2f2] dark:bg-neutral-900 p-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search users…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="h-10 pl-9 border-2 border-border rounded-none" />
              </div>
              {selected.size > 0 && <div className="flex items-center gap-2"><span className="text-xs">{selected.size} selected</span><Button variant="outline" size="sm" className="h-8 border-2 border-border text-xs"><XCircle className="mr-1.5 h-3.5 w-3.5" />Disconnect</Button><Button variant="outline" size="sm" className="h-8 border-2 border-border text-xs"><Ban className="mr-1.5 h-3.5 w-3.5" />Blacklist</Button><Button variant="outline" size="sm" className="h-8 border-2 border-border text-xs"><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button></div>}
            </div>

            <div className="flex gap-0 border-b-2 border-border">
              {["all", "online", "offline"].map((tab) => (
                <button key={tab} onClick={() => { setStatusTab(tab); setPage(0); }} className={cn("px-4 py-2 text-xs font-semibold uppercase border-b-2 -mb-[2px]", statusTab === tab ? "border-[#ec3013] text-[#ec3013]" : "border-transparent text-muted-foreground")}>
                  {tab}<Badge variant="outline" className="ml-2 h-4 px-1 text-[9px]">{usersData?.total ?? 0}</Badge>
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="border-2 border-border bg-card p-4 animate-pulse space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-muted" />)}
              </div>
            ) : isError ? (
              <div className="text-center py-12"><p className="text-muted-foreground mb-4">Failed to load users</p>
              <Button variant="outline" className="border-2 border-border rounded-none" onClick={() => refetch()}><RotateCw className="mr-2 h-4 w-4" /> Retry</Button></div>
            ) : (
              <div className="overflow-x-auto border-2 border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-10"><button onClick={toggleAll}>{selected.size === (usersData?.users.length ?? 0) && (usersData?.users.length ?? 0) > 0 ? <CheckSquare className="h-4 w-4 text-[#ec3013]" /> : <Square className="h-4 w-4" />}</button></TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase">User</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase hidden sm:table-cell">MAC</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase hidden md:table-cell">Device</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase">Duration</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase hidden lg:table-cell">Download</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase">Status</TableHead>
                      <TableHead className="w-20 text-right text-[10px] font-semibold uppercase">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!usersData || usersData.users.length === 0 ? (<TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No users found</TableCell></TableRow>)
                    : usersData.users.map((u) => (
                      <TableRow key={u.id} className="border-b border-border">
                        <TableCell><button onClick={() => toggleSelect(u.id)}>{selected.has(u.id) ? <CheckSquare className="h-4 w-4 text-[#ec3013]" /> : <Square className="h-4 w-4" />}</button></TableCell>
                        <TableCell><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                        <TableCell className="font-mono text-xs hidden sm:table-cell">{u.mac}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{u.device}</TableCell>
                        <TableCell className="text-xs">{u.duration}</TableCell>
                        <TableCell className="text-xs hidden lg:table-cell">{u.download}</TableCell>
                        <TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : u.status === "idle" ? "text-amber-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : u.status === "idle" ? "bg-amber-500" : "bg-muted-foreground")} />{u.status}</span></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDrawerUser(u)}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => disconnectMutation.mutate(u.id)}><XCircle className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{usersData?.total ?? 0} users</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-2 border-border" disabled={page === 0} onClick={() => setPage(page - 1)}><PageLeft className="h-4 w-4" /></Button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (<Button key={i} variant={page === i ? "default" : "outline"} size="sm" className={cn("h-8 w-8 p-0 border-2", page === i ? "bg-[#ec3013] text-white border-[#ec3013]" : "border-border")} onClick={() => setPage(i)}>{i + 1}</Button>))}
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-2 border-border" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><PageRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {drawerUser && (
              <div className="fixed inset-0 z-50 flex justify-end">
                <div className="w-full max-w-lg border-l-2 border-border bg-card flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b-2 border-border">
                    <div><p className="font-semibold">{drawerUser.name}</p><p className="text-xs text-muted-foreground">{drawerUser.email}</p></div>
                    <Button variant="ghost" size="sm" onClick={() => setDrawerUser(null)}>✕</Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "MAC", value: drawerUser.mac }, { label: "IP", value: drawerUser.ip },
                        { label: "Device", value: drawerUser.device }, { label: "Duration", value: drawerUser.duration },
                        { label: "Download", value: drawerUser.download },
                      ].map((f) => (
                        <div key={f.label} className="border-2 border-border p-3">
                          <p className="text-xs text-muted-foreground">{f.label}</p>
                          <p className="mt-0.5 text-sm font-medium">{f.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" className="flex-1 bg-[#ec3013] hover:bg-[#d42a11] text-white" onClick={() => { disconnectMutation.mutate(drawerUser.id); setDrawerUser(null); }}>
                        <XCircle className="mr-2 h-4 w-4" /> Disconnect
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 border-2 border-border"><Ban className="mr-2 h-4 w-4" /> Blacklist</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
