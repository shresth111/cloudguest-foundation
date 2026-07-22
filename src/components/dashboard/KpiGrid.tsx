import {
  Building2,
  CircleDollarSign,
  CreditCard,
  Gauge,
  MapPin,
  Router,
  Signal,
  UserCheck,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenueDashboard, useUnifiedDashboard } from "@/hooks/useDashboardData";
import type { GrowthPoint } from "@/types/dashboard";
import { StatCard, type StatTrend } from "@/components/ui-ext/StatCard";

/**
 * Normalize the backend's free-form growth direction string into the
 * StatCard's trend union, falling back to the sign of deltaPercent when
 * the direction string doesn't match a known value.
 */
function resolveTrend(growth: GrowthPoint): StatTrend | undefined {
  const dir = growth.direction?.toLowerCase();
  if (dir === "up" || dir === "increasing" || dir === "increase") return "up";
  if (dir === "down" || dir === "decreasing" || dir === "decrease") return "down";
  if (dir === "flat" || dir === "stable" || dir === "unchanged") return "flat";
  if (growth.deltaPercent == null) return undefined;
  if (growth.deltaPercent > 0) return "up";
  if (growth.deltaPercent < 0) return "down";
  return "flat";
}

function resolveDelta(growth: GrowthPoint): string | undefined {
  if (growth.deltaPercent == null) return undefined;
  const sign = growth.deltaPercent > 0 ? "+" : "";
  return `${sign}${growth.deltaPercent.toFixed(1)}%`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-center justify-between py-6">
        <p className="text-sm text-muted-foreground">{message}</p>
        <button className="text-sm font-medium text-primary hover:underline" onClick={onRetry}>
          Retry
        </button>
      </CardContent>
    </Card>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

export function KpiGrid() {
  const platformQuery = useUnifiedDashboard();
  const revenueQuery = useRevenueDashboard(12);

  const platformLoading = platformQuery.isLoading;
  const platformError = platformQuery.isError || !platformQuery.data;
  const revenueLoading = revenueQuery.isLoading;
  const revenueError = revenueQuery.isError || !revenueQuery.data;

  if (platformLoading && revenueLoading) {
    return <SkeletonGrid count={14} />;
  }

  const platform = platformQuery.data?.platform;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {platformLoading ? (
        <SkeletonGrid count={10} />
      ) : platformError || !platform ? (
        <div className="col-span-full">
          <ErrorCard message="Failed to load platform KPIs." onRetry={() => platformQuery.refetch()} />
        </div>
      ) : (
        <>
          <StatCard
            label="Total organizations"
            value={platform.totalOrganizations}
            delta={resolveDelta(platform.organizationGrowth)}
            trend={resolveTrend(platform.organizationGrowth)}
            icon={Building2}
            tone="primary"
          />
          <StatCard
            label="Total locations"
            value={platform.totalLocations}
            delta={resolveDelta(platform.locationGrowth)}
            trend={resolveTrend(platform.locationGrowth)}
            icon={MapPin}
            tone="info"
          />
          <StatCard
            label="Total routers"
            value={platform.totalRouters}
            delta={resolveDelta(platform.routerGrowth)}
            trend={resolveTrend(platform.routerGrowth)}
            icon={Router}
            tone="primary"
          />
          <StatCard
            label="Routers online"
            value={platform.routersOnline}
            icon={Signal}
            tone="success"
          />
          <StatCard
            label="Routers offline"
            value={platform.routersOffline}
            icon={Signal}
            tone="danger"
          />
          <StatCard
            label="Total guests"
            value={platform.totalGuests}
            delta={resolveDelta(platform.guestGrowth)}
            trend={resolveTrend(platform.guestGrowth)}
            icon={Users}
            tone="primary"
          />
          <StatCard label="Today's guests" value={platform.todaysGuests} icon={UserCheck} tone="success" />
          <StatCard
            label="Active sessions"
            value={platform.activeSessions}
            delta={resolveDelta(platform.networkGrowth)}
            trend={resolveTrend(platform.networkGrowth)}
            icon={Wifi}
            tone="info"
          />
          <StatCard
            label="Peak concurrent sessions"
            value={platform.peakConcurrentSessions}
            icon={Gauge}
            tone="warning"
          />
          <StatCard label="Trial customers" value={platform.trialCustomers} icon={Users} tone="default" />
          <StatCard label="Paid customers" value={platform.paidCustomers} icon={UserCheck} tone="success" />
        </>
      )}

      {revenueLoading ? (
        <SkeletonGrid count={3} />
      ) : revenueError || !revenueQuery.data ? (
        <div className="col-span-full">
          <ErrorCard message="Failed to load revenue KPIs." onRetry={() => revenueQuery.refetch()} />
        </div>
      ) : (
        <>
          <StatCard
            label="MRR"
            value={formatCurrency(revenueQuery.data.mrr)}
            icon={CircleDollarSign}
            tone="warning"
          />
          <StatCard
            label="ARR"
            value={formatCurrency(revenueQuery.data.arr)}
            icon={CircleDollarSign}
            tone="warning"
          />
          <StatCard
            label="Active paying subscriptions"
            value={revenueQuery.data.activePayingSubscriptionCount}
            icon={CreditCard}
            tone="success"
          />
        </>
      )}
    </div>
  );
}
