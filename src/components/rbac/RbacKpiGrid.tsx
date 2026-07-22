import { Users, UserCheck, UserX, Shield, Sparkles, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useRbacKpis } from "@/hooks/useRbac";

interface Kpi {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: string;
}

export function RbacKpiGrid() {
  const { data, isLoading, isError, refetch } = useRbacKpis();
  if (isError) return <ErrorState onRetry={refetch} />;

  const kpis: Kpi[] = data
    ? [
        {
          label: "Total Users",
          value: data.totalUsers,
          icon: Users,
          tone: "from-sky-500/20 to-indigo-500/10 text-sky-500",
        },
        {
          label: "Active Users",
          value: data.activeUsers,
          icon: UserCheck,
          tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
        },
        {
          label: "Inactive Users",
          value: data.inactiveUsers,
          icon: UserX,
          tone: "from-slate-500/20 to-slate-500/5 text-slate-500",
        },
        {
          label: "Total Roles",
          value: data.totalRoles,
          icon: Shield,
          tone: "from-violet-500/20 to-violet-500/5 text-violet-500",
        },
        {
          label: "Custom Roles",
          value: data.customRoles,
          icon: Sparkles,
          tone: "from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-500",
        },
        {
          label: "Failed Logins",
          value: data.failedLogins,
          icon: ShieldAlert,
          tone: "from-red-500/20 to-red-500/5 text-red-500",
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {isLoading || !data
        ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        : kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label} className="overflow-hidden">
                <CardContent className="relative p-4">
                  <div className={`absolute inset-0 -z-0 bg-gradient-to-br ${k.tone} opacity-60`} />
                  <div className="relative z-10 flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums">{k.value}</p>
                    </div>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background/60 backdrop-blur">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
    </div>
  );
}
