import { Clock, Database, KeyRound, UserCheck, Users, Wifi } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAnalyticsSummary, useAnalyticsOtpSuccessRate, useSessions } from "@/hooks/useGuests";

interface KpiDef {
  label: string;
  icon: LucideIcon;
  value: number | undefined;
  format: (v: number) => string;
  accent: string;
}

export function GuestKpiGrid() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: otp, isLoading: otpLoading } = useAnalyticsOtpSuccessRate();
  const { data: activeSessions, isLoading: sessionsLoading } = useSessions({
    status: "active",
    page: 1,
    pageSize: 1,
  });

  const kpis: KpiDef[] = [
    {
      label: "Unique Guests",
      icon: Users,
      value: summary?.uniqueGuests,
      format: (v) => v.toLocaleString(),
      accent: "text-indigo-500",
    },
    {
      label: "Returning Guests",
      icon: UserCheck,
      value: summary?.returningGuests,
      format: (v) => v.toLocaleString(),
      accent: "text-emerald-500",
    },
    {
      label: "Active Sessions",
      icon: Wifi,
      value: activeSessions?.total,
      format: (v) => v.toLocaleString(),
      accent: "text-sky-500",
    },
    {
      label: "Avg Session",
      icon: Clock,
      value: summary ? Math.round(summary.averageSessionDurationSeconds / 60) : undefined,
      format: (v) => `${v}m`,
      accent: "text-cyan-500",
    },
    {
      label: "Total Bandwidth",
      icon: Database,
      value: summary ? summary.totalBandwidthBytes / 1024 ** 3 : undefined,
      format: (v) => `${v.toFixed(1)} GB`,
      accent: "text-rose-500",
    },
    {
      label: "OTP Success Rate",
      icon: KeyRound,
      value: otp ? otp.successRate * 100 : undefined,
      format: (v) => `${v.toFixed(0)}%`,
      accent: "text-teal-500",
    },
  ];

  const isLoading = summaryLoading || otpLoading || sessionsLoading;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <Card
            key={k.label}
            className="group rounded-2xl border-border/70 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </span>
              <Icon className={cn("h-4 w-4", k.accent)} />
            </div>
            <div className="mt-3 h-8">
              {isLoading || k.value == null ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {k.format(k.value)}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
