import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin, Activity, Users, Router, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MapLocation {
  id: string;
  name: string;
  city: string;
  status: "online" | "offline" | "degraded";
  onlineDevices: number;
  totalDevices: number;
  users: number;
  isp: string;
  routerCount: number;
  x: number;
  y: number;
}

const LOCATIONS: MapLocation[] = [
  { id: "loc-1", name: "Mumbai HQ", city: "Mumbai", status: "online", onlineDevices: 24, totalDevices: 26, users: 142, isp: "Tata Communications", routerCount: 3, x: 18, y: 45 },
  { id: "loc-2", name: "Delhi Office", city: "Delhi", status: "online", onlineDevices: 18, totalDevices: 18, users: 98, isp: "Airtel", routerCount: 2, x: 42, y: 25 },
  { id: "loc-3", name: "Bangalore DC", city: "Bangalore", status: "degraded", onlineDevices: 12, totalDevices: 15, users: 76, isp: "Jio", routerCount: 2, x: 35, y: 72 },
  { id: "loc-4", name: "Chennai Office", city: "Chennai", status: "online", onlineDevices: 8, totalDevices: 8, users: 54, isp: "ACT Fibernet", routerCount: 1, x: 58, y: 80 },
  { id: "loc-5", name: "Hyderabad DC", city: "Hyderabad", status: "offline", onlineDevices: 0, totalDevices: 12, users: 45, isp: "Airtel", routerCount: 2, x: 65, y: 55 },
  { id: "loc-6", name: "Kolkata Office", city: "Kolkata", status: "online", onlineDevices: 6, totalDevices: 6, users: 32, isp: "Tata Communications", routerCount: 1, x: 82, y: 30 },
  { id: "loc-7", name: "Pune Office", city: "Pune", status: "online", onlineDevices: 10, totalDevices: 10, users: 67, isp: "Jio", routerCount: 1, x: 28, y: 60 },
  { id: "loc-8", name: "Ahmedabad DC", city: "Ahmedabad", status: "online", onlineDevices: 14, totalDevices: 14, users: 89, isp: "BSNL", routerCount: 2, x: 10, y: 30 },
];

const STATUS_STYLES = {
  online: { dot: "bg-emerald-500", glow: "shadow-emerald-500/40", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  degraded: { dot: "bg-amber-500", glow: "shadow-amber-500/40", badge: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  offline: { dot: "bg-rose-500", glow: "shadow-rose-500/40", badge: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
};

export const Route = createFileRoute("/_authenticated/locations/map")({
  component: LocationMapPage,
});

function LocationMapPage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  const onlineCount = LOCATIONS.filter((l) => l.status === "online").length;
  const offlineCount = LOCATIONS.filter((l) => l.status === "offline").length;
  const degradedCount = LOCATIONS.filter((l) => l.status === "degraded").length;
  const totalUsers = LOCATIONS.reduce((s, l) => s + l.users, 0);
  const totalRouters = LOCATIONS.reduce((s, l) => s + l.routerCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Location map" description="Geographical overview of all sites with real-time status." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600"><Activity className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Online</p><p className="text-lg font-bold text-emerald-600">{onlineCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600"><Activity className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Degraded</p><p className="text-lg font-bold text-amber-600">{degradedCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600"><Activity className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Offline</p><p className="text-lg font-bold text-rose-600">{offlineCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Total users</p><p className="text-lg font-bold">{totalUsers.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground"><Router className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">Routers</p><p className="text-lg font-bold">{totalRouters}</p></div>
          </CardContent>
        </Card>
      </div>
      <Card className="relative overflow-hidden">
        <div className="relative h-[500px] w-full bg-gradient-to-br from-sky-500/5 via-background to-emerald-500/5">
          <svg className="absolute inset-0 h-full w-full opacity-20">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          {LOCATIONS.map((loc) => {
            const styles = STATUS_STYLES[loc.status];
            const isHovered = hovered === loc.id;
            return (
              <motion.button
                key={loc.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 }}
                style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                className={cn("absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-200", isHovered && "z-20")}
                onMouseEnter={() => setHovered(loc.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate({ to: `/locations/${loc.id}` })}
              >
                <div className={cn("flex items-center justify-center rounded-full p-2 shadow-lg transition-all duration-200", styles.dot, isHovered && "scale-150 shadow-xl")}>
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                {isHovered && (
                  <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2">
                    <Card className="border shadow-xl">
                      <CardContent className="p-3 text-left">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{loc.name}</p>
                          <Badge variant="outline" className={cn("h-4 px-1 text-[9px] capitalize", styles.badge)}>{loc.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{loc.city}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span>{loc.onlineDevices}/{loc.totalDevices} devices</span>
                          <span>{loc.users} users</span>
                          <span>{loc.routerCount} routers</span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">ISP: {loc.isp}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
