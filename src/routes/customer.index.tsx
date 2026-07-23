import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Search, Star, MapPin, Wifi, Router, Clock, ArrowRight, RotateCw, LogOut, Bell, Settings, Moon, Activity, Radio, Eye, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import type { CustomerLocationSummary } from "@/services/customer.service";
import { useIspStore } from "@/stores/ispStore";
import { toast } from "sonner";

export const Route = createFileRoute("/customer/")({

  component: CustomerHomePage,
});

const PLANS = ["Enterprise", "Growth", "Starter", "Growth", "Enterprise", "Starter", "Growth", "Enterprise"];
const FLOORS = ["5F", "4F", "3F", "2F", "1F", "GF"];

interface MonitoredDevice { id: string; name: string; mac: string; type: string; floor: string; status: "up" | "down"; lastSeen: string; cpuUsage: number | null; }
// Seeded once a router is configured and MAC addresses are added manually
// from the dashboard (Access Point / Printer / etc, with a floor). Empty
// until then -- these five are what a freshly-configured GF looks like.
const SEED_DEVICES: MonitoredDevice[] = [
  { id: "1", name: "AP TP Link 7", mac: "3C:64:CF:CE:2D:38", type: "Access Point", floor: "GF", status: "up", lastSeen: "00 h 01 m", cpuUsage: 18 },
  { id: "2", name: "EAP225-8C-90-2D-6D-53-26", mac: "8C:90:2D:6D:53:26", type: "Access Point", floor: "GF", status: "down", lastSeen: "Never", cpuUsage: null },
  { id: "3", name: "EAP225-B0-19-21-73-E2-CA", mac: "B0:19:21:73:E2:CA", type: "Access Point", floor: "GF", status: "up", lastSeen: "00 h 01 m", cpuUsage: 34 },
  { id: "4", name: "EAP225-B0-19-21-74-0A-90", mac: "B0:19:21:74:0A:90", type: "Access Point", floor: "GF", status: "up", lastSeen: "00 h 01 m", cpuUsage: 62 },
  { id: "5", name: "EAP225-B0-19-21-74-0A-68", mac: "B0:19:21:74:0A:68", type: "Access Point", floor: "GF", status: "up", lastSeen: "00 h 01 m", cpuUsage: 27 },
];

function CustomerHomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setActiveLocation } = useCustomerStore();
  const { data: locations, isLoading, refetch } = useCustomerLocations();
  const { configs: ispConfigs } = useIspStore();
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("cg-favs") ?? "[]"); } catch { return []; } });
  const [menu, setMenu] = useState(false);
  const [devices] = useState(SEED_DEVICES);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = (locations ?? []).filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase()));
  const toggleFav = (id: string) => { setFavorites((p) => { const n = p.includes(id) ? p.filter((f) => f !== id) : [...p, id]; localStorage.setItem("cg-favs", JSON.stringify(n)); return n; }); };
  const handleSelect = (loc: CustomerLocationSummary) => { setActiveLocation(loc.id, loc); navigate({ to: `/customer/${loc.id}/dashboard` }); };
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };
  const doRefetch = () => { refetch(); setSecondsAgo(0); };

  const filteredDevices = devices.filter((d) => !deviceSearch || d.name.toLowerCase().includes(deviceSearch.toLowerCase()) || d.mac.toLowerCase().includes(deviceSearch.toLowerCase()));
  const downCount = devices.filter((d) => d.status === "down").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">ZIP WiFi</p>
              <p className="text-[10px] text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative h-9 w-9"><Bell className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><Moon className="h-4 w-4" /></Button>
            <div className="relative">
              <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 pl-2 border-l border-border ml-1">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar>
              </button>
              {menu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-popover p-1 shadow-xl">
                  <div className="px-3 py-2"><p className="text-sm font-medium">{user?.name ?? "Admin"}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div>
                  <div className="border-t border-border my-1" />
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8"><h1 className="text-3xl font-bold tracking-tight">Select location</h1><p className="mt-1 text-muted-foreground">Choose a site to monitor and manage.</p></div>

        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search locations…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 pl-10 bg-background" />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border bg-card p-5"><div className="h-4 w-32 rounded bg-muted" /><div className="mt-2 h-3 w-24 rounded bg-muted" /><div className="mt-4 space-y-2"><div className="h-3 rounded bg-muted" /><div className="h-3 w-3/4 rounded bg-muted" /></div></div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground"><MapPin className="mb-4 h-12 w-12 opacity-30" /><p>No locations found</p></div>
            ) : filtered.map((loc, i) => (
              <motion.div key={loc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                role="button" tabIndex={0}
                onClick={() => handleSelect(loc)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(loc); } }}
                className="group relative cursor-pointer rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 text-left w-full"
              >
                <button onClick={(e) => { e.stopPropagation(); toggleFav(loc.id); }} className="absolute right-4 top-4 text-muted-foreground hover:text-amber-500 transition-colors">
                  <Star className={cn("h-4 w-4", favorites.includes(loc.id) && "fill-amber-500 text-amber-500")} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5"><MapPin className="h-5 w-5 text-primary" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{loc.name}</p><p className="text-xs text-muted-foreground">{loc.city} · {loc.organizationName}</p></div>
                </div>
                <div className="mt-4 space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", loc.status === "online" ? "bg-emerald-500" : loc.status === "degraded" ? "bg-amber-500" : "bg-rose-500")} /><span className="capitalize font-medium">{loc.status}</span></span><span className="text-muted-foreground"><Wifi className="h-3 w-3 inline mr-0.5" />{loc.onlineUsers} users</span></div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><Router className="h-3 w-3" />{loc.routerHealth}% health</span><span>{loc.bandwidth}</span></div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{loc.isp}</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{loc.lastSync}</span></div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Open dashboard <ArrowRight className="ml-1 h-3 w-3" /></div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Network Status — live ISP up/down per business unit, driven by ISP Details config */}
        <div className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h2 className="text-lg font-semibold">Network Status</h2></div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
              Live · updated {secondsAgo}s ago
              <button onClick={doRefetch} className="ml-1 rounded-md p-1 hover:bg-accent"><RefreshCw className="h-3 w-3" /></button>
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><th className="px-4 py-2.5">Business Unit</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">WAN Links</th><th className="px-4 py-2.5">Live Status</th></tr></thead>
              <tbody>
                {Object.values(ispConfigs).map((cfg, i) => {
                  const anyDown = cfg.lines.some((l) => l.status === "down");
                  return (
                    <tr key={cfg.businessUnit} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-2.5 font-medium">{cfg.businessUnit}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{PLANS[i % PLANS.length]}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {cfg.lines.map((l) => (
                            <span key={l.wan} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", l.status === "up" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400")}>{l.wan} · {l.provider || "N/A"} · {l.status === "up" ? "UP" : "DOWN"}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", anyDown ? "text-rose-600" : "text-emerald-600")}>
                          <span className="relative flex h-2 w-2">{!anyDown && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}<span className={cn("relative inline-flex h-2 w-2 rounded-full", anyDown ? "bg-rose-500" : "bg-emerald-500")} /></span>
                          {anyDown ? "Attention needed" : "All links live"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Device Monitoring — floor-wise up/down, populated once devices are added from a location dashboard */}
        <div className="mt-10 mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><h2 className="text-lg font-semibold">Device Monitoring</h2></div>
            <p className="text-xs text-muted-foreground">Shows up/down status of each monitored device.</p>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FLOORS.map((f) => {
              const onFloor = devices.filter((d) => d.floor === f);
              const down = onFloor.filter((d) => d.status === "down").length;
              return (
                <div key={f} className="rounded-xl border bg-card p-3 text-center shadow-sm">
                  <p className="text-sm font-bold">{f}</p>
                  <p className={cn("text-xs", down > 0 ? "text-rose-600 font-medium" : "text-muted-foreground")}>{down} of {onFloor.length} down</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{downCount} of {devices.length} devices down</p>
              <div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search device or MAC…" value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} className="h-8 w-56 pl-8 text-xs" /></div>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">MAC ID</th><th className="px-3 py-2">Device</th><th className="px-3 py-2">Floor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">CPU Usage</th><th className="px-3 py-2">Last Seen</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
                <tbody>
                  {filteredDevices.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-xs text-muted-foreground">No devices match your search.</td></tr>
                  ) : filteredDevices.map((d, i) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 text-xs font-medium">{d.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.mac}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.type}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.floor}</td>
                      <td className="px-3 py-2">
                        <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", d.status === "up" ? "text-emerald-600" : "text-rose-600")}>
                          <span className="relative flex h-1.5 w-1.5">{d.status === "up" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}<span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", d.status === "up" ? "bg-emerald-500" : "bg-rose-500")} /></span>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {d.cpuUsage === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", d.cpuUsage >= 80 ? "bg-rose-500" : d.cpuUsage >= 50 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${d.cpuUsage}%` }} /></div>
                            <span className="text-xs tabular-nums text-muted-foreground">{d.cpuUsage}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.lastSeen}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => toast.success(`History for ${d.name}`)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"><Eye className="h-3 w-3" />View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
