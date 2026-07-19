import {
  Activity,
  AlertTriangle,
  Cpu,
  Gauge,
  MemoryStick,
  Radio,
  Router as RouterIcon,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Users,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useMonitoringKpis } from "@/hooks/useMonitoring";
import { cn } from "@/lib/utils";

interface Tile {
  label: string;
  value: string;
  icon: typeof Cpu;
  tone: "default" | "success" | "warning" | "danger";
  hint?: string;
}

const toneClass: Record<Tile["tone"], string> = {
  default: "bg-muted/40 text-foreground",
  success: "bg-emerald-500/10 text-emerald-500",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-red-500/10 text-red-500",
};

export function MonitoringKpiGrid() {
  const { data, isLoading, isError, refetch } = useMonitoringKpis();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const tiles: Tile[] = [
    { label: "Total routers", value: String(data.totalRouters), icon: RouterIcon, tone: "default" },
    { label: "Online routers", value: String(data.onlineRouters), icon: ShieldCheck, tone: "success" },
    { label: "Offline routers", value: String(data.offlineRouters), icon: WifiOff, tone: "danger" },
    { label: "WireGuard tunnels", value: String(data.activeWireGuardTunnels), icon: Radio, tone: "default" },
    { label: "RADIUS servers", value: String(data.activeRadiusServers), icon: ShieldCheck, tone: "success" },
    { label: "Internet uptime", value: `${data.internetUptime.toFixed(2)}%`, icon: Signal, tone: "success" },
    { label: "Active guest sessions", value: data.activeGuestSessions.toLocaleString(), icon: Users, tone: "default" },
    { label: "Active alerts", value: String(data.activeAlerts), icon: AlertTriangle, tone: "warning" },
    { label: "Critical alerts", value: String(data.criticalAlerts), icon: ShieldAlert, tone: "danger" },
    { label: "Warning alerts", value: String(data.warningAlerts), icon: AlertTriangle, tone: "warning" },
    { label: "Avg. CPU usage", value: `${data.avgCpu}%`, icon: Cpu, tone: data.avgCpu > 70 ? "warning" : "default" },
    { label: "Avg. memory usage", value: `${data.avgMemory}%`, icon: MemoryStick, tone: data.avgMemory > 75 ? "warning" : "default" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((t, i) => {
        const Icon = t.icon;
        return (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">{t.value}</div>
                  {t.hint && <div className="text-[11px] text-muted-foreground">{t.hint}</div>}
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneClass[t.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
      <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
        <CardContent className="flex items-center gap-3 p-3 text-xs text-muted-foreground">
          <Gauge className="h-4 w-4" />
          Live values refresh every 15 seconds. Adjust in Monitoring settings.
          <Activity className="ml-auto h-3.5 w-3.5 animate-pulse text-emerald-500" />
        </CardContent>
      </Card>
    </div>
  );
}
