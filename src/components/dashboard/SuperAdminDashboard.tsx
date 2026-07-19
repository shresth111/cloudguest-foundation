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

export function SuperAdminDashboard() {
  const { user } = useAuth();
  const notif = useNotifications();

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Super admin overview
          </div>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {user?.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A real-time view across every organization, location, and router on CloudGuest.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">Live · updated moments ago</Badge>
      </header>

      <KpiGrid />

      <QuickActions />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><GuestConnectionsChart /></div>
        <RouterHealthChart />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueChart />
        <AuthStatsChart />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopOrgsChart />
        <DeviceDistributionChart />
        <DailyActiveChart />
      </div>

      <MonthlyGrowthChart />

      <div className="grid gap-4 xl:grid-cols-2">
        <RecentOrgsWidget />
        <RecentLocationsWidget />
        <RecentRoutersWidget />
        <RecentSessionsWidget />
        <RecentPaymentsWidget />
        <RecentTicketsWidget />
        <RecentAuditWidget />
        <NotificationsWidget items={notif.data} isLoading={notif.isLoading} isError={notif.isError} onRetry={() => notif.refetch()} />
      </div>
    </div>
  );
}
