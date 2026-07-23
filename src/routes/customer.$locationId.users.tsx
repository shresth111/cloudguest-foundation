import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Bell, Search, Menu, XCircle, Eye, EyeOff, ChevronLeft, ChevronRight, RotateCw, KeyRound, MapPinned, ShieldCheck,
  Users, Wifi, WifiOff, Clock, X, Download, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomerLoginRole, customerNavsForRole } from "@/lib/customerNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerUsers, useDisconnectSession } from "@/hooks/useCustomerDashboard";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";

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
  const [notif, setNotif] = useState(false);
  const [masked, setMasked] = useState(true);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<{ id: string; name: string; email: string; mac: string; device: string; duration: string; download: string; status: string } | null>(null);
  const PAGE_SIZE = 8;

  const { data, isLoading, refetch } = useCustomerUsers(locationId, { search: search || undefined, status: statusTab !== "all" ? statusTab : undefined, page: page + 1, pageSize: PAGE_SIZE });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const handleNav = (id: string) => navigate({ to: `/customer/${locationId}/${id}` });
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };
  const handleSwitchLocation = () => { setMenu(false); navigate({ to: "/customer" }); };
  const filteredNavs = customerNavsForRole(getCustomerLoginRole());

  return (
    <div className="flex min-h-screen bg-muted/30">
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-all lg:static lg:z-auto", sidebar ? "w-60" : "w-0 lg:w-16 overflow-hidden", mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm"><img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" /></div>{sidebar && <div><p className="text-sm font-semibold">ZIP WiFi</p><p className="text-[10px] text-muted-foreground">{activeLocation?.name ?? "Users"}</p></div>}</div>
        <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto">{filteredNavs.map((item) => (<button key={item.id} onClick={() => handleNav(item.id)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm w-full text-left transition-all", item.id === "users" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{sidebar && <span className="truncate">{item.label}</span>}</button>))}</nav>
        <div className="border-t p-2 hidden lg:block"><button onClick={() => setSidebar(!sidebar)} className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent">{sidebar ? "◄" : "►"}</button></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 backdrop-blur-xl px-4 sm:px-6">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex-1"><p className="text-sm font-semibold">Users · {activeLocation?.name ?? ""}</p></div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMasked((m) => !m); toast.success(masked ? "Data unmasked" : "Data masked"); }}
              className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent sm:inline-flex mr-1"
            >
              {masked ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {masked ? "Data masked" : "Data visible"}
            </button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}><RotateCw className="h-4 w-4" /></Button>
            <div className="relative">
              <button onClick={() => setNotif((n) => !n)} className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Bell className="h-4.5 w-4.5" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              </button>
              {notif && <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-popover p-2 shadow-xl z-50"><p className="px-2 py-1 text-xs font-medium text-muted-foreground">No new notifications</p></div>}
            </div>
            <div className="relative"><button onClick={() => setMenu(!menu)} className="ml-2"><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar></button>
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
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-4">
            {data && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "On this page", value: data.users.length, icon: Users, color: "text-primary" },
                  { label: "Online", value: data.users.filter((u) => u.status === "online").length, icon: Wifi, color: "text-emerald-500" },
                  { label: "Idle", value: data.users.filter((u) => u.status === "idle").length, icon: Clock, color: "text-amber-500" },
                  { label: "Offline", value: data.users.filter((u) => u.status === "offline").length, icon: WifiOff, color: "text-muted-foreground" },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">{s.label}</p><s.icon className={cn("h-4 w-4", s.color)} /></div>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
                  </motion.div>
                ))}
              </div>
            )}

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
                  : data.users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setDetailUser(u)}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">{u.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden sm:table-cell">{u.mac}</TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{u.device}</TableCell>
                      <TableCell className="text-xs">{u.duration}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{u.download}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", u.status === "online" ? "text-emerald-500" : u.status === "idle" ? "text-amber-500" : "text-muted-foreground")}>
                          <span className="relative flex h-1.5 w-1.5">
                            {u.status === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
                            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : u.status === "idle" ? "bg-amber-500" : "bg-muted-foreground")} />
                          </span>
                          {u.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDetailUser(u); }}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); disconnect.mutate(u.id); }}><XCircle className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (<div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{data?.total ?? 0} users</span><div className="flex items-center gap-1"><Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>{Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (<Button key={i} variant={page === i ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setPage(i)}>{i + 1}</Button>))}<Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>)}
          </div>
        </main>
      </div>

      {/* Detail slide-over */}
      <AnimatePresence>
        {detailUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40" onClick={() => setDetailUser(null)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11"><AvatarFallback className="bg-primary/10 font-semibold text-primary">{detailUser.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                  <div><p className="font-semibold">{detailUser.name}</p><p className="text-xs text-muted-foreground">{detailUser.email}</p></div>
                </div>
                <button onClick={() => setDetailUser(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">Status</p><span className={cn("mt-1 inline-flex items-center gap-1.5 text-sm font-semibold capitalize", detailUser.status === "online" ? "text-emerald-500" : detailUser.status === "idle" ? "text-amber-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", detailUser.status === "online" ? "bg-emerald-500" : detailUser.status === "idle" ? "bg-amber-500" : "bg-muted-foreground")} />{detailUser.status}</span></div>
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">Duration</p><p className="mt-1 text-sm font-semibold">{detailUser.duration}</p></div>
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">Device</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Smartphone className="h-3.5 w-3.5 text-muted-foreground" />{detailUser.device}</p></div>
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">Data used</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Download className="h-3.5 w-3.5 text-muted-foreground" />{detailUser.download}</p></div>
                </div>
                <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">MAC Address</p><p className="mt-1 font-mono text-sm">{detailUser.mac}</p></div>
              </div>
              <div className="border-t p-4"><Button variant="outline" className="w-full text-destructive" onClick={() => { disconnect.mutate(detailUser.id); setDetailUser(null); }}><XCircle className="mr-2 h-4 w-4" />Disconnect user</Button></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
    </div>
  );
}
