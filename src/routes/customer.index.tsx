import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Search, Star, MapPin, Wifi, Router, Clock, ArrowRight, RotateCw, Router as RouterIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import type { CustomerLocationSummary } from "@/services/customer.service";

export const Route = createFileRoute("/customer/")({
  beforeLoad: ({ context }) => { if (context.auth?.status === "anonymous") throw redirect({ to: "/login" }); },
  component: CustomerHomePage,
});

function CustomerHomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("cg-favs") ?? "[]"); } catch { return []; } });
  const { setActiveLocation } = useCustomerStore();
  const { data: locations, isLoading, isError, refetch } = useCustomerLocations();
  const filtered = (locations ?? []).filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase()));
  const toggleFav = (id: string) => { setFavorites((p) => { const n = p.includes(id) ? p.filter((f) => f !== id) : [...p, id]; localStorage.setItem("cg-favs", JSON.stringify(n)); return n; }); };
  const handleSelect = (loc: CustomerLocationSummary) => { setActiveLocation(loc.id, loc); navigate({ to: `/customer/${loc.id}/dashboard` }); };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold tracking-tight text-[#c9d1d9]">Locations</h1><p className="text-sm text-[#8b949e] mt-1">Select a site to manage</p></div>
          <span className="flex items-center gap-2 text-xs text-[#8b949e]"><span className="h-2 w-2 rounded-full bg-emerald-500" /> System Online</span>
        </div>
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b949e]" />
          <Input placeholder="Search locations…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9 bg-[#161b22] border border-[#30363d] text-[#c9d1d9] placeholder:text-[#8b949e] rounded" />
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-[#161b22] border border-[#30363d] p-5 rounded animate-pulse"><div className="h-4 w-32 bg-[#21262d] mb-3" /><div className="h-3 w-24 bg-[#21262d] mb-4" /><div className="h-3 w-full bg-[#21262d]" /></div>)}
          </div>
        ) : isError ? (
          <div className="text-center py-20"><p className="text-[#8b949e] mb-4">Failed to load</p><Button variant="outline" className="border-[#30363d] text-[#c9d1d9]" onClick={() => refetch()}><RotateCw className="mr-2 h-4 w-4" />Retry</Button></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.length === 0 ? <div className="col-span-full text-center py-20 text-[#8b949e]">No locations found</div>
            : filtered.map((loc, i) => (<motion.button key={loc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => handleSelect(loc)}
              className="group relative bg-[#161b22] border border-[#30363d] p-5 text-left transition-all hover:border-[#ec3013] hover:shadow-lg hover:shadow-[#ec3013]/5 rounded text-left w-full"
            >
              <button onClick={(e) => { e.stopPropagation(); toggleFav(loc.id); }} className="absolute right-3 top-3 text-[#8b949e] hover:text-amber-500"><Star className={cn("h-4 w-4", favorites.includes(loc.id) && "fill-amber-500 text-amber-500")} /></button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-[#21262d] border border-[#30363d] rounded"><MapPin className="h-5 w-5 text-[#ec3013]" /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-[#c9d1d9]">{loc.name}</p><p className="text-xs text-[#8b949e]">{loc.city}</p></div>
              </div>
              <div className="mt-4 space-y-2 border-t border-[#30363d] pt-3">
                <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", loc.status === "online" ? "bg-emerald-500" : loc.status === "degraded" ? "bg-amber-500" : "bg-rose-500")} /><span className="capitalize text-[#c9d1d9]">{loc.status}</span></span><span className="text-[#8b949e]"><Wifi className="h-3 w-3 inline mr-1" />{loc.onlineUsers}</span></div>
                <div className="flex items-center justify-between text-xs text-[#8b949e]"><span><Router className="h-3 w-3 inline mr-1" />{loc.routerHealth}%</span><span>{loc.bandwidth}</span></div>
                <div className="flex items-center justify-between text-xs text-[#8b949e]"><span>{`${loc.routersOnline}/${loc.routersTotal} routers`}</span><span><Clock className="h-3 w-3 inline mr-1" />{loc.lastSync}</span></div>
              </div>
              <div className="mt-3 flex items-center justify-end text-xs font-medium text-[#ec3013] opacity-0 group-hover:opacity-100">Open <ArrowRight className="ml-1 h-3 w-3" /></div>
            </motion.button>))}
          </div>
        )}
      </div>
    </div>
  );
}
