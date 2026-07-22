import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Search, Star, MapPin, Wifi, Router, Clock, ArrowRight, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import type { CustomerLocationSummary } from "@/services/customer.service";

export const Route = createFileRoute("/customer/")({
  beforeLoad: ({ context }) => {
    if (context.auth?.status === "anonymous") throw redirect({ to: "/login" });
  },
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

  if (isLoading) return (<div className="min-h-screen bg-[#f3f2f2] dark:bg-neutral-900 p-6 customer-theme"><div className="max-w-6xl mx-auto"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({length:6}).map((_,i)=>(<div key={i} className="border-2 border-border bg-card p-5 animate-pulse"><div className="h-10 w-10 bg-muted mb-3"/><div className="h-4 w-32 bg-muted mb-2"/><div className="h-3 w-24 bg-muted mb-4"/><div className="space-y-2 border-t-2 border-border pt-3"><div className="h-3 w-full bg-muted"/><div className="h-3 w-3/4 bg-muted"/></div></div>))}</div></div></div>);
  if (isError) return (<div className="min-h-screen bg-[#f3f2f2] dark:bg-neutral-900 p-6 customer-theme"><div className="max-w-6xl mx-auto text-center py-20"><p className="text-muted-foreground mb-4">Failed to load locations</p><Button onClick={()=>refetch()} variant="outline" className="border-2 border-border rounded-none"><RotateCw className="mr-2 h-4 w-4"/>Retry</Button></div></div>);

  return (
    <div className="min-h-screen bg-[#f3f2f2] dark:bg-neutral-900 p-6 customer-theme">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight">Select location</h1><p className="text-sm text-muted-foreground mt-1">Choose a site to monitor and manage.</p></div>
        <div className="relative max-w-md mb-6"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search locations…" value={search} onChange={(e)=>setSearch(e.target.value)} className="h-10 pl-9 border-2 border-border rounded-none"/></div>
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground"><MapPin className="mx-auto h-12 w-12 mb-3 opacity-30"/><p>No locations found</p></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((loc,i)=>(
              <motion.button key={loc.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}} onClick={()=>handleSelect(loc)} className="group relative border-2 border-border bg-card p-5 text-left transition-all hover:border-[#ec3013] hover:shadow-lg rounded-none">
                <button onClick={(e)=>{e.stopPropagation();toggleFav(loc.id);}} className="absolute right-3 top-3 text-muted-foreground hover:text-amber-500"><Star className={cn("h-4 w-4",favorites.includes(loc.id)&&"fill-amber-500 text-amber-500")}/></button>
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center bg-[#f3f2f2] dark:bg-neutral-800"><MapPin className="h-5 w-5"/></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{loc.name}</p><p className="text-xs text-muted-foreground">{loc.city}</p></div></div>
                <div className="mt-4 space-y-2 border-t-2 border-border pt-3">
                  <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full",loc.status==="online"?"bg-emerald-500":loc.status==="degraded"?"bg-amber-500":"bg-rose-500")}/><span className="capitalize">{loc.status}</span></span><span className="flex items-center gap-1"><Wifi className="h-3 w-3"/>{loc.onlineUsers}</span></div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><Router className="h-3 w-3"/>{loc.routerHealth}%</span><span>{loc.bandwidth}</span></div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{`${loc.routersOnline}/${loc.routersTotal} routers`}</span><span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{loc.lastSync}</span></div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs font-medium text-[#ec3013] opacity-0 group-hover:opacity-100">Open dashboard <ArrowRight className="ml-1 h-3 w-3"/></div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
