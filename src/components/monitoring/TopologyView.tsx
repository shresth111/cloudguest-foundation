import { Cloud, Building2, MapPin, Router as RouterIcon, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

const nodes = [
  { key: "cloud", label: "CloudGuest Platform", sub: "Global control plane", icon: Cloud, color: "bg-sky-500/15 text-sky-500" },
  { key: "org", label: "Organizations", sub: "128 tenants", icon: Building2, color: "bg-violet-500/15 text-violet-500" },
  { key: "loc", label: "Locations", sub: "612 sites", icon: MapPin, color: "bg-emerald-500/15 text-emerald-500" },
  { key: "router", label: "Routers", sub: "1,240 devices online", icon: RouterIcon, color: "bg-amber-500/15 text-amber-500" },
  { key: "guest", label: "Guest devices", sub: "24,812 connected", icon: Smartphone, color: "bg-pink-500/15 text-pink-500" },
];

export function TopologyView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Live topology</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto flex max-w-md flex-col items-center gap-2">
          {nodes.map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={n.key} className="w-full">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${n.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{n.label}</div>
                    <div className="text-xs text-muted-foreground">{n.sub}</div>
                  </div>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                </motion.div>
                {i < nodes.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="h-6 w-px bg-gradient-to-b from-border to-transparent" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
