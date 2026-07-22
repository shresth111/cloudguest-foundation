import {
  Activity,
  AlertTriangle,
  Building2,
  Loader2,
  MapPin,
  PlayCircle,
  Router as RouterIcon,
  ShieldAlert,
  ShieldCheck,
  Signal,
  WifiOff,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import {
  useEvaluateAlertRules,
  usePlatformDashboard,
  useRunHealthChecks,
  useTopologyCounts,
} from "@/hooks/useMonitoring";
import { HEALTH_STATUS_LABEL } from "@/types/monitoring";
import type { AppError } from "@/services/api";
import { cn } from "@/lib/utils";

interface Tile {
  label: string;
  value: string;
  icon: typeof RouterIcon;
  tone: "default" | "success" | "warning" | "danger";
}

const toneClass: Record<Tile["tone"], string> = {
  default: "bg-muted/40 text-foreground",
  success: "bg-emerald-500/10 text-emerald-500",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-red-500/10 text-red-500",
};

export function MonitoringKpiGrid() {
  const { data, isLoading, isError, refetch } = usePlatformDashboard();
  const { data: topology } = useTopologyCounts();
  const runHealthChecks = useRunHealthChecks();
  const evaluateRules = useEvaluateAlertRules();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const activeAlerts =
    (data.alertCountsByStatus.triggered ?? 0) + (data.alertCountsByStatus.acknowledged ?? 0);
  const criticalAlerts = data.alertCountsBySeverity.critical ?? 0;
  const onlineRouters = data.lifecycleStageCounts.online ?? 0;
  const offlineRouters = data.lifecycleStageCounts.offline ?? 0;
  const healthStatus = data.overallHealthStatus;

  const tiles: Tile[] = [
    {
      label: "Overall platform health",
      value: HEALTH_STATUS_LABEL[healthStatus],
      icon: ShieldCheck,
      tone: healthStatus === "healthy" ? "success" : healthStatus === "unknown" ? "default" : "warning",
    },
    { label: "Organizations", value: String(topology?.organizations ?? "—"), icon: Building2, tone: "default" },
    { label: "Locations", value: String(topology?.locations ?? "—"), icon: MapPin, tone: "default" },
    { label: "Total routers", value: String(topology?.routers ?? "—"), icon: RouterIcon, tone: "default" },
    { label: "Online routers", value: String(onlineRouters), icon: ShieldCheck, tone: "success" },
    { label: "Offline routers", value: String(offlineRouters), icon: WifiOff, tone: offlineRouters > 0 ? "danger" : "default" },
    { label: "Pending enrollments", value: String(data.pendingEnrollmentCount), icon: Activity, tone: "default" },
    { label: "Active alerts", value: String(activeAlerts), icon: AlertTriangle, tone: activeAlerts > 0 ? "warning" : "default" },
    { label: "Critical alerts", value: String(criticalAlerts), icon: ShieldAlert, tone: criticalAlerts > 0 ? "danger" : "default" },
  ];

  if (data.availabilityPercentage !== null) {
    tiles.push({
      label: "Availability",
      value: `${data.availabilityPercentage.toFixed(2)}%`,
      icon: Signal,
      tone: data.availabilityPercentage >= 99 ? "success" : "warning",
    });
  }

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
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <Button
            size="sm"
            variant="outline"
            disabled={runHealthChecks.isPending}
            onClick={() =>
              runHealthChecks.mutate(undefined, {
                onSuccess: () => toast.success("Health checks executed"),
                onError: (e) => toast.error((e as unknown as AppError).message),
              })
            }
          >
            {runHealthChecks.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-3.5 w-3.5" />
            )}
            Run health checks now
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={evaluateRules.isPending}
            onClick={() =>
              evaluateRules.mutate(undefined, {
                onSuccess: (result) =>
                  toast.success(
                    `Evaluated rules: ${result.triggered.length} triggered, ${result.resolved.length} resolved`,
                  ),
                onError: (e) => toast.error((e as unknown as AppError).message),
              })
            }
          >
            {evaluateRules.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-2 h-3.5 w-3.5" />
            )}
            Evaluate alert rules now
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Overview refreshes every 30 seconds.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
