import { Cloud, Building2, MapPin, Router as RouterIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useTopologyCounts } from "@/hooks/useMonitoring";

export function TopologyView() {
  const { data, isLoading, isError, refetch } = useTopologyCounts();

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const nodes = [
    { key: "cloud", label: "CloudGuest Platform", sub: "Global control plane", icon: Cloud, color: "bg-sky-500/15 text-sky-500" },
    { key: "org", label: "Organizations", sub: `${data.organizations} tenant${data.organizations === 1 ? "" : "s"}`, icon: Building2, color: "bg-violet-500/15 text-violet-500" },
    { key: "loc", label: "Locations", sub: `${data.locations} site${data.locations === 1 ? "" : "s"}`, icon: MapPin, color: "bg-emerald-500/15 text-emerald-500" },
    { key: "router", label: "Routers", sub: `${data.routers} device${data.routers === 1 ? "" : "s"} registered`, icon: RouterIcon, color: "bg-amber-500/15 text-amber-500" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Platform topology</CardTitle>
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
