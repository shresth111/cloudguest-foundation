import type { ComponentType } from "react";
import {
  Activity,
  Building2,
  CircleDollarSign,
  LifeBuoy,
  MapPin,
  Router,
  ShieldCheck,
  Signal,
  TicketCheck,
  UserCheck,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKpis } from "@/hooks/useDashboardData";
import type { Kpi } from "@/types/dashboard";
import { StatCard, type StatTone } from "@/components/ui-ext/StatCard";

/** Icon + tone lookup keyed by the KPI identifier from the backend. */
const KPI_META: Record<string, { icon: ComponentType<{ className?: string }>; tone: StatTone }> = {
  totalOrgs: { icon: Building2, tone: "primary" },
  activeOrgs: { icon: Building2, tone: "success" },
  totalLocations: { icon: MapPin, tone: "info" },
  activeLocations: { icon: MapPin, tone: "success" },
  totalRouters: { icon: Router, tone: "primary" },
  onlineRouters: { icon: Signal, tone: "success" },
  offlineRouters: { icon: Signal, tone: "danger" },
  totalGuests: { icon: Users, tone: "primary" },
  activeGuests: { icon: UserCheck, tone: "success" },
  bandwidth: { icon: Activity, tone: "info" },
  revenue: { icon: CircleDollarSign, tone: "warning" },
  mrr: { icon: CircleDollarSign, tone: "warning" },
  tickets: { icon: LifeBuoy, tone: "danger" },
  openTickets: { icon: TicketCheck, tone: "warning" },
  security: { icon: ShieldCheck, tone: "info" },
};

const DEFAULT_META = { icon: Wifi, tone: "default" as StatTone };

function resolveMeta(k: Kpi) {
  return KPI_META[k.key] ?? DEFAULT_META;
}

/**
 * Attempt to convert the KPI's display string ("$32.4K", "12,345",
 * "78%") into a raw number for the animated counter. Falls back to
 * the raw string when it doesn't parse cleanly.
 */
function parseValue(v: string): number | string {
  if (!v) return v;
  const cleaned = v.replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-") return v;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return v;
  // Preserve suffix like "K", "M", "%" or "$" by treating original as final display.
  const hasNonNumeric = /[^\d.,\s-]/.test(v);
  return hasNonNumeric ? v : n;
}

export function KpiGrid() {
  const { data, isLoading, isError, refetch } = useKpis();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between py-6">
          <p className="text-sm text-muted-foreground">Failed to load KPIs.</p>
          <button
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((k) => {
        const { icon, tone } = resolveMeta(k);
        return (
          <StatCard
            key={k.key}
            label={k.label}
            value={parseValue(k.value)}
            hint={k.hint}
            delta={k.delta}
            trend={k.trend}
            icon={icon}
            tone={tone}
          />
        );
      })}
    </div>
  );
}
