import {
  Activity,
  Building2,
  DollarSign,
  MapPin,
  Router as RouterIcon,
  TrendingUp,
  Users,
  UserCheck,
  Timer,
  LogIn,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { cn } from "@/lib/utils";
import type { AnalyticsKpis } from "@/types/analytics";

interface Props {
  data?: AnalyticsKpis;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

interface Tile {
  label: string;
  value: string;
  icon: typeof Users;
  tone: "default" | "success" | "warning" | "info";
  hint?: string;
}

const toneClass: Record<Tile["tone"], string> = {
  default: "bg-muted/40 text-foreground",
  success: "bg-emerald-500/10 text-emerald-500",
  warning: "bg-amber-500/10 text-amber-600",
  info: "bg-sky-500/10 text-sky-500",
};

const fmt = new Intl.NumberFormat();
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function AnalyticsKpiGrid({ data, isLoading, isError, onRetry }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={onRetry} />;

  const tiles: Tile[] = [
    { label: "Total organizations", value: fmt.format(data.totalOrganizations), icon: Building2, tone: "default" },
    { label: "Total locations", value: fmt.format(data.totalLocations), icon: MapPin, tone: "default" },
    { label: "Total routers", value: fmt.format(data.totalRouters), icon: RouterIcon, tone: "info" },
    { label: "Active routers", value: fmt.format(data.activeRouters), icon: Activity, tone: "success" },
    { label: "Total guests", value: fmt.format(data.totalGuests), icon: Users, tone: "default" },
    { label: "Active guests", value: fmt.format(data.activeGuests), icon: UserCheck, tone: "success" },
    { label: "Total sessions", value: fmt.format(data.totalSessions), icon: LogIn, tone: "info" },
    { label: "Avg. session duration", value: `${data.avgSessionDuration}m`, icon: Timer, tone: "default" },
    { label: "Daily logins", value: fmt.format(data.dailyLogins), icon: CalendarDays, tone: "info" },
    { label: "Monthly logins", value: fmt.format(data.monthlyLogins), icon: TrendingUp, tone: "default" },
    { label: "Revenue", value: money.format(data.revenue), icon: DollarSign, tone: "success" },
    { label: "Growth rate", value: `${data.growthRate.toFixed(1)}%`, icon: Sparkles, tone: data.growthRate >= 0 ? "success" : "warning" },
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
    </div>
  );
}
