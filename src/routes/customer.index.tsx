import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Search, Star, MapPin, Wifi, Router, Clock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCustomerStore, type CustomerLocation } from "@/stores/customerStore";

const LOCATIONS: CustomerLocation[] = [
  { id: "loc-1", name: "Mumbai HQ", city: "Mumbai", status: "online", onlineUsers: 142, routerHealth: 98, bandwidth: "450 Mbps", isp: "Tata Communications", lastSync: "Just now" },
  { id: "loc-2", name: "Delhi Office", city: "Delhi", status: "online", onlineUsers: 98, routerHealth: 95, bandwidth: "300 Mbps", isp: "Airtel", lastSync: "2 min ago" },
  { id: "loc-3", name: "Bangalore DC", city: "Bangalore", status: "degraded", onlineUsers: 76, routerHealth: 72, bandwidth: "180 Mbps", isp: "Jio", lastSync: "5 min ago" },
  { id: "loc-4", name: "Chennai Office", city: "Chennai", status: "online", onlineUsers: 54, routerHealth: 99, bandwidth: "250 Mbps", isp: "ACT Fibernet", lastSync: "1 min ago" },
  { id: "loc-5", name: "Hyderabad DC", city: "Hyderabad", status: "offline", onlineUsers: 0, routerHealth: 0, bandwidth: "0 Mbps", isp: "Airtel", lastSync: "15 min ago" },
  { id: "loc-6", name: "Kolkata Office", city: "Kolkata", status: "online", onlineUsers: 32, routerHealth: 91, bandwidth: "200 Mbps", isp: "Tata Communications", lastSync: "3 min ago" },
  { id: "loc-7", name: "Pune Office", city: "Pune", status: "online", onlineUsers: 67, routerHealth: 97, bandwidth: "350 Mbps", isp: "Jio", lastSync: "Just now" },
  { id: "loc-8", name: "Ahmedabad DC", city: "Ahmedabad", status: "online", onlineUsers: 89, routerHealth: 93, bandwidth: "280 Mbps", isp: "BSNL", lastSync: "4 min ago" },
];

export const Route = createFileRoute("/customer/")({
  component: CustomerHomePage,
});

function CustomerHomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("cg-favs") ?? "[]"); } catch { return []; }
  });
  const { setActiveLocation } = useCustomerStore();

  const filtered = LOCATIONS.filter((l) =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase())
  );

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      localStorage.setItem("cg-favs", JSON.stringify(next));
      return next;
    });
  };

  const handleSelect = (loc: CustomerLocation) => {
    setActiveLocation(loc.id, loc);
    navigate({ to: `/customer/${loc.id}/dashboard` });
  };

  return (
    <div className="min-h-screen bg-[#f3f2f2] dark:bg-neutral-900 p-6 customer-theme">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Select location</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a site to monitor and manage.</p>
        </div>
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search locations…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9 border-2 border-border rounded-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((loc, i) => (
            <motion.button
              key={loc.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleSelect(loc)}
              className="group relative border-2 border-border bg-card p-5 text-left transition-all hover:border-[#ec3013] hover:shadow-lg rounded-none"
            >
              <button onClick={(e) => { e.stopPropagation(); toggleFav(loc.id); }} className="absolute right-3 top-3 text-muted-foreground hover:text-amber-500">
                <Star className={cn("h-4 w-4", favorites.includes(loc.id) && "fill-amber-500 text-amber-500")} />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-[#f3f2f2] dark:bg-neutral-800"><MapPin className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{loc.name}</p><p className="text-xs text-muted-foreground">{loc.city}</p></div>
              </div>
              <div className="mt-4 space-y-2 border-t-2 border-border pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2", loc.status === "online" ? "bg-emerald-500" : loc.status === "degraded" ? "bg-amber-500" : "bg-rose-500")} />
                    <span className="capitalize">{loc.status}</span>
                  </span>
                  <span className="flex items-center gap-1"><Wifi className="h-3 w-3" />{loc.onlineUsers}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Router className="h-3 w-3" />{loc.routerHealth}%</span>
                  <span>{loc.bandwidth}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{loc.isp}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{loc.lastSync}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end text-xs font-medium text-[#ec3013] opacity-0 group-hover:opacity-100">
                Open dashboard <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
