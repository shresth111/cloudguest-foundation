import { Users, UserCheck, UserX, Shield, Sparkles, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatCard, type StatTone } from "@/components/ui-ext";
import { useRbacKpis } from "@/hooks/useRbac";

interface Kpi {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: StatTone;
}

export function RbacKpiGrid() {
  const { data, isLoading, isError, refetch } = useRbacKpis();
  if (isError) return <ErrorState onRetry={refetch} />;

  const kpis: Kpi[] = data
    ? [
        { label: "Total Users", value: data.totalUsers, icon: Users, tone: "primary" },
        { label: "Active Users", value: data.activeUsers, icon: UserCheck, tone: "success" },
        { label: "Inactive Users", value: data.inactiveUsers, icon: UserX, tone: "default" },
        { label: "Total Roles", value: data.totalRoles, icon: Shield, tone: "info" },
        { label: "Custom Roles", value: data.customRoles, icon: Sparkles, tone: "info" },
        { label: "Failed Logins", value: data.failedLogins, icon: ShieldAlert, tone: "danger" },
      ]
    : [];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {isLoading || !data
        ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        : kpis.map((k) => (
            <StatCard key={k.label} label={k.label} value={k.value} tone={k.tone} icon={k.icon} />
          ))}
    </div>
  );
}
