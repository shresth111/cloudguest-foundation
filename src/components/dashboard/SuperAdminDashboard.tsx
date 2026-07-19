import { KpiGrid } from "./KpiGrid";
import { QuickActions } from "./QuickActions";
import {
  AuthStatsChart,
  DailyActiveChart,
  DeviceDistributionChart,
  GuestConnectionsChart,
  MonthlyGrowthChart,
  RevenueChart,
  RouterHealthChart,
  TopOrgsChart,
} from "./DashboardCharts";
import {
  NotificationsWidget,
  RecentAuditWidget,
  RecentLocationsWidget,
  RecentOrgsWidget,
  RecentPaymentsWidget,
  RecentRoutersWidget,
  RecentSessionsWidget,
  RecentTicketsWidget,
} from "./DashboardWidgets";
import { useNotifications } from "@/hooks/useDashboardData";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";

export function SuperAdminDashboard() {
  const { user } = useAuth();
  const notif = useNotifications();

  return (
    <PageShell mesh>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" /> Super admin overview
          </div>
          <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Welcome back,{" "}
            <span className="gradient-text">{user?.name.split(" ")[0]}</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A real-time view across every organization, location, and router on CloudGuest.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Live · updated moments ago
        </Badge>
      </header>

      <KpiGrid />

      <QuickActions />

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Network"
          title="Live network posture"
          description="Guest connections and router health across every deployed site."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GuestConnectionsChart />
          </div>
          <RouterHealthChart />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Revenue & auth"
          title="Business performance"
          description="Subscription revenue and captive-portal authentication trends."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <RevenueChart />
          <AuthStatsChart />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Usage"
          title="Where your guests are"
          description="Top organisations, device mix and daily active guests."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <TopOrgsChart />
          <DeviceDistributionChart />
          <DailyActiveChart />
        </div>
      </section>

      <MonthlyGrowthChart />

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Activity"
          title="Recent activity"
          description="Latest signals from every module across the platform."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <RecentOrgsWidget />
          <RecentLocationsWidget />
          <RecentRoutersWidget />
          <RecentSessionsWidget />
          <RecentPaymentsWidget />
          <RecentTicketsWidget />
          <RecentAuditWidget />
          <NotificationsWidget
            items={notif.data}
            isLoading={notif.isLoading}
            isError={notif.isError}
            onRetry={() => notif.refetch()}
          />
        </div>
      </section>
    </PageShell>
  );
}
