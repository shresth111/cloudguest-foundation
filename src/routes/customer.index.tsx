import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Search, Star, MapPin, Wifi, Router, Clock, ArrowRight, RotateCw, LogOut, Bell, Settings, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import type { CustomerLocationSummary } from "@/services/customer.service";

export const Route = createFileRoute("/customer/")({

  component: CustomerHomePage,
});

function CustomerHomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setActiveLocation } = useCustomerStore();
  const { data: locations, isLoading, refetch } = useCustomerLocations();
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("cg-favs") ?? "[]"); } catch { return []; } });
  const [menu, setMenu] = useState(false);

  const filtered = (locations ?? []).filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase()));
  const toggleFav = (id: string) => { setFavorites((p) => { const n = p.includes(id) ? p.filter((f) => f !== id) : [...p, id]; localStorage.setItem("cg-favs", JSON.stringify(n)); return n; }); };
  const handleSelect = (loc: CustomerLocationSummary) => { setActiveLocation(loc.id, loc); navigate({ to: `/customer/${loc.id}/dashboard` }); };
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
              <Wifi className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">BhaiFi</p>
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
      </main>
    </div>
  );
}
