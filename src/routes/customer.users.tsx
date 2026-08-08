import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, XCircle, Eye, ChevronLeft, ChevronRight,
  Users, X, Download, Smartphone, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerUsers, useCustomerOnlineNow, useDisconnectSession, useIsDemo, useDataMasking } from "@/hooks/useCustomerDashboard";
import type { AppError } from "@/services/api";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import { maskEmail, maskMac, maskPhone, DEMO_PLAN_RENEWAL_ISO } from "@/components/features/HeaderControls";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { customerFeatureHref } from "@/lib/customerNav";

/**
 * Shared empty-state graphic for the Users table -- a magnifying glass over
 * a dormant signal dish, same filled-flat-shape character language as the
 * other illustrations added this session (ChartEmptyState/
 * DashboardWatchIllustration). Used for both "no users at all" and "search/
 * filter found nothing" via the label prop, so a dead table row still feels
 * designed instead of a bare sentence. Purely decorative -- aria-hidden.
 */
function UsersEmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <svg aria-hidden="true" viewBox="0 0 100 80" className="h-16 w-20" fill="none">
        <ellipse cx="50" cy="68" rx="30" ry="4" fill="#6C4EFF" opacity="0.08" />
        <path d="M50 20a18 18 0 0 1 18 18" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35" />
        <circle cx="50" cy="46" r="3" fill="#22d3ee" opacity="0.6" />
        <circle cx="42" cy="34" r="14" stroke="#6C4EFF" strokeWidth="3" fill="#f5f0ff" />
        <path d="M52 44l9 9" stroke="#6C4EFF" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="42" cy="34" r="5" fill="#8B5CF6" opacity="0.3" />
      </svg>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export const Route = createFileRoute("/customer/users")({
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: CustomerUsersPage,
});

function CustomerUsersPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  // beforeLoad's requireActiveLocationId() already guarantees this is set
  // before the component ever mounts.
  const locationId = activeLocationId!;
  const disconnect = useDisconnectSession();
  // useIsDemo(), not isDemo() directly -- see the identical fix in
  // customer.$locationId.$feature.tsx/dashboard.tsx: calling isDemo()
  // straight in render flips between the SSR pass (no window -> false)
  // and the client's first hydration pass (real token -> true), which
  // changes whether PlanRenewalTicket's chip renders and threw a real
  // "Hydration failed" (#418) on every hard load of this page.
  const demoFlag = useIsDemo();
  const billing = useMyBillingDashboard(demoFlag ? undefined : activeLocation?.organizationId, activeLocation?.organizationName);
  const planExpiryIso = demoFlag ? DEMO_PLAN_RENEWAL_ISO : billing.data?.renewalDate;
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [page, setPage] = useState(0);
  const [sidebar, setSidebar] = useState(true);
  const [mobile, setMobile] = useState(false);
  const dataMasking = useDataMasking();
  const masked = dataMasking.masked;
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<{ id: string; name: string; email: string; phone: string; mac: string; ip: string; device: string; duration: string; download: string; status: string; guestId: string | null } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ id: string; name: string; guestId: string | null } | null>(null);
  const PAGE_SIZE = 8;

  const { data, isLoading, refetch } = useCustomerUsers(locationId, { search: search || undefined, status: statusTab !== "all" ? statusTab : undefined, page: page + 1, pageSize: PAGE_SIZE });
  // Real, location-wide count -- independent of this page's search/tab/
  // pagination state, see useCustomerOnlineNow's own docstring.
  const onlineNow = useCustomerOnlineNow(locationId);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const handleNav = (id: string) => navigate({ to: customerFeatureHref(id) });
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };
  const handleSwitchLocation = () => { navigate({ to: "/customer" }); };

  return (
    <div
      className="flex min-h-screen bg-muted/30"
      style={
        {
          "--primary": "#6C4EFF",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}
      {/* Same shared sidebar/grouped-nav data source every other customer
          page uses (see src/components/customer/CustomerSidebar.tsx) --
          this page used to hand-roll its own flat, ungrouped copy with a
          hardcoded `item.id === "users"` active check, which is exactly the
          kind of drift that component was extracted to prevent. */}
      <CustomerSidebar
        activeId="users"
        collapsed={!sidebar}
        mobileOpen={mobile}
        onNavigate={handleNav}
        onToggleCollapsed={() => setSidebar(!sidebar)}
        subtitle="Portal"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerHeader
          title={<p className="truncate text-sm font-semibold">Connected guests · {activeLocation?.name ?? ""}</p>}
          locationId={locationId}
          planExpiryIso={planExpiryIso}
          dataMasking={dataMasking}
          onMobileMenuClick={() => setMobile(true)}
          onRefresh={() => refetch()}
          user={user}
          onSwitchLocation={handleSwitchLocation}
          onChangePassword={() => setChangePwOpen(true)}
          onTfaSettings={() => setTfaOpen(true)}
          onLogout={handleLogout}
        />
        {/* Slim on-brand accent instead of a full dark hero -- this page's
         * job is fast row-scanning, not a glance-dashboard, so a tall hero
         * would just push the actual table below the fold. */}
        <div aria-hidden className="h-[3px] bg-gradient-to-r from-[#6C4EFF] via-[#8B5CF6] to-transparent" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-4">
            {/* Previously 4 tiles (On this page/Online/Idle/Offline)
             * computed from data.users -- but that's only the current
             * paginated slice (8 rows), not this location's real totals,
             * so "Online: 3" silently meant "3 of the 8 rows on THIS page"
             * while reading as a location-wide live count. Collapsed down
             * to just "Total guests" at the time.
             *
             * "Online now" restores a real online count -- but unlike that
             * removed tile, this one is genuinely location-wide (server-
             * side `status=active` total via useCustomerOnlineNow, not a
             * client-side count of the current page), which is exactly the
             * total-vs-currently-online distinction that was causing
             * confusion. */}
            <div className="flex flex-wrap gap-3">
              {data && (
                <div className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 premium-card premium-card-hover">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]"><Users className="h-4 w-4 text-white" /></div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total guests</p>
                    <p className="text-lg font-bold tracking-tight tabular-nums leading-tight">{data.total.toLocaleString()}</p>
                  </div>
                </div>
              )}
              <div className="inline-flex items-center gap-3 rounded-2xl px-4 py-3 premium-card premium-card-hover">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                  <Wifi className="h-4 w-4 text-white" />
                  {(onlineNow.data ?? 0) > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-emerald-400" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Online now</p>
                  <p className="text-lg font-bold tracking-tight tabular-nums leading-tight">
                    {onlineNow.isLoading ? <span className="inline-block h-5 w-8 animate-pulse rounded bg-muted align-middle" /> : (onlineNow.data ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search users…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="h-10 pl-9 bg-background" /></div>
              <div className="flex gap-1 border rounded-lg p-0.5 bg-muted/50">{["all", "online", "offline"].map((tab) => (<button key={tab} onClick={() => { setStatusTab(tab); setPage(0); }} className={cn("px-3 py-1.5 text-xs font-medium rounded-md capitalize", statusTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>{tab}</button>))}</div>
            </div>

            <div className="rounded-2xl overflow-x-auto premium-card">
              <Table>
                <TableHeader><TableRow><TableHead className="text-xs font-medium uppercase tracking-wide">User</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide hidden sm:table-cell">Phone</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide hidden sm:table-cell">MAC</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide hidden xl:table-cell">IP</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide hidden md:table-cell">Device</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide">Duration</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide hidden lg:table-cell">Download</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide">Status</TableHead><TableHead className="text-xs font-medium uppercase tracking-wide text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => (<TableCell key={j}><div className="h-4 w-full animate-pulse rounded bg-muted" /></TableCell>))}</TableRow>))
                  : !data || data.users.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="p-0">
                      <UsersEmptyState label={search || statusTab !== "all" ? "No guests match your search or filter." : "No guests have connected yet."} />
                    </TableCell></TableRow>
                  )
                  : data.users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setDetailUser(u)}
                      className="cursor-pointer border-b border-l-2 border-l-transparent transition-colors last:border-b-0 hover:border-l-[#6C4EFF] hover:bg-accent/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">{u.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-muted-foreground">{masked ? maskEmail(u.email) : u.email}</p></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">{masked ? maskPhone(u.phone) : u.phone}</TableCell>
                      <TableCell className="font-mono text-xs hidden sm:table-cell">{masked ? maskMac(u.mac) : u.mac}</TableCell>
                      <TableCell className="font-mono text-xs hidden xl:table-cell">{u.ip || "—"}</TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{u.device}</TableCell>
                      <TableCell className="text-xs">{u.duration}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{u.download}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", u.status === "online" ? "text-emerald-500" : u.status === "idle" ? "text-amber-500" : "text-muted-foreground")}>
                          <span className="relative flex h-2 w-2">
                            {u.status === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
                            <span className={cn("relative inline-flex h-2 w-2 rounded-full", u.status === "online" ? "bg-emerald-500" : u.status === "idle" ? "bg-amber-500" : "bg-muted-foreground")} />
                          </span>
                          {u.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDetailUser(u); }}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive disabled:text-muted-foreground"
                            disabled={u.status === "offline" || disconnect.isPending}
                            title={u.status === "offline" ? "Already offline" : "Disconnect"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDisconnect({ id: u.id, name: u.name, guestId: u.guestId });
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
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
                  <div className="relative">
                    <div aria-hidden className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6] opacity-20 blur-md" />
                    <Avatar className="relative h-11 w-11"><AvatarFallback className="bg-primary/10 font-semibold text-primary">{detailUser.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                  </div>
                  <div><p className="font-semibold">{detailUser.name}</p><p className="text-xs text-muted-foreground">{masked ? maskEmail(detailUser.email) : detailUser.email}</p></div>
                </div>
                <button onClick={() => setDetailUser(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5",
                  detailUser.status === "online" ? "border-emerald-500/20 bg-emerald-500/5" : detailUser.status === "idle" ? "border-amber-500/20 bg-amber-500/5" : "bg-muted/40",
                )}>
                  <span className="relative flex h-3 w-3 shrink-0">
                    {detailUser.status === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
                    <span className={cn("relative inline-flex h-3 w-3 rounded-full", detailUser.status === "online" ? "bg-emerald-500" : detailUser.status === "idle" ? "bg-amber-500" : "bg-muted-foreground")} />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                    <p className={cn("text-sm font-semibold capitalize", detailUser.status === "online" ? "text-emerald-600" : detailUser.status === "idle" ? "text-amber-600" : "text-foreground")}>{detailUser.status}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">Duration</p><p className="mt-1 text-sm font-semibold">{detailUser.duration}</p></div>
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">Device</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Smartphone className="h-3.5 w-3.5 text-muted-foreground" />{detailUser.device}</p></div>
                  <div className="rounded-xl border p-3 col-span-2"><p className="text-[11px] font-medium text-muted-foreground">Data used</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Download className="h-3.5 w-3.5 text-muted-foreground" />{detailUser.download}</p></div>
                </div>
                <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">Phone</p><p className="mt-1 text-sm">{masked ? maskPhone(detailUser.phone) : detailUser.phone}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">MAC Address</p><p className="mt-1 font-mono text-sm">{masked ? maskMac(detailUser.mac) : detailUser.mac}</p></div>
                  <div className="rounded-xl border p-3"><p className="text-[11px] font-medium text-muted-foreground">IP Address</p><p className="mt-1 font-mono text-sm">{detailUser.ip || "—"}</p></div>
                </div>
              </div>
              <div className="border-t p-4">
                <Button
                  variant="outline"
                  className="w-full text-destructive disabled:text-muted-foreground"
                  disabled={detailUser.status === "offline" || disconnect.isPending}
                  onClick={() => setConfirmDisconnect({ id: detailUser.id, name: detailUser.name, guestId: detailUser.guestId })}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {detailUser.status === "offline" ? "Already offline" : "Disconnect user"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />

      {/* Disconnecting immediately kicked a real guest off their session
       * with a single click, no confirmation -- a misclick had a real
       * consequence for a real person. Now routed through this dialog from
       * both the table row action and the detail panel. */}
      <AlertDialog open={!!confirmDisconnect} onOpenChange={(o) => !o && setConfirmDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {confirmDisconnect?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This ends their session and forces their device off this network's router (Wi-Fi
              registration + DHCP lease) -- not just our own record of it. They'll see the login
              page again if they try to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmDisconnect) return;
                disconnect.mutate({ sessionId: confirmDisconnect.id, guestId: confirmDisconnect.guestId, locationId }, {
                  onSuccess: (result) => {
                    // Honest about a partial success -- the session-level
                    // disconnect above is always real and already done by
                    // this point, but the router-level device clear is
                    // best-effort (see disconnectSession()'s docstring): a
                    // guest can have zero tracked ConnectedDevice rows if
                    // the router-sync mechanism hasn't discovered them yet.
                    if (result.deviceDisconnected) toast.success(`${confirmDisconnect.name} disconnected -- session ended and device cleared from the router`);
                    else toast.warning(`${confirmDisconnect.name}'s session ended -- device-level disconnect wasn't available for this guest`);
                  },
                  onError: (err) => toast.error((err as unknown as AppError).message || "Couldn't disconnect this session"),
                });
                setConfirmDisconnect(null);
                setDetailUser(null);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
