import type { ReactElement } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { KpiGrid } from "./KpiGrid";
import { QuickActions } from "./QuickActions";
import {
  DailyActiveChart,
  DeviceDistributionChart,
  MonthlyGrowthChart,
  RouterHealthChart,
} from "./DashboardCharts";
import {
  NotificationsWidget,
  RecentAuditWidget,
  RecentLocationsWidget,
} from "./DashboardWidgets";
import { useNotifications } from "@/hooks/useDashboardData";
import type { DashboardWidget, WidgetKind, WidgetSize } from "@/types/dashboard-layout";
import { useAuth } from "@/context/AuthContext";
import { primaryRoleLabel } from "@/lib/roles";

/**
 * Backend-driven widget registry. Every widget the dashboard can
 * render lives here. The route iterates the layout returned by
 * `permissionsService.getDashboardLayout()` and looks each one up
 * by `kind`. No route may hardcode a widget list.
 */
export const dashboardWidgetRegistry: Record<WidgetKind, (w: DashboardWidget) => ReactElement> = {
  welcome: () => <WelcomeWidget />,
  "kpi-grid": () => <KpiGrid />,
  "trend-chart": () => <MonthlyGrowthChart />,
  "health-chart": () => <RouterHealthChart />,
  "usage-chart": () => <DailyActiveChart />,
  "top-locations": () => <RecentLocationsWidget />,
  "recent-activity": () => <RecentAuditWidget />,
  "notifications-preview": () => <NotificationsBinding />,
  "quick-actions": () => <QuickActions />,
  custom: () => <DeviceDistributionChart />,
};

function NotificationsBinding() {
  const { data, isLoading, isError, refetch } = useNotifications();
  return (
    <NotificationsWidget
      items={data}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}

function WelcomeWidget() {
  const { user, roles } = useAuth();
  if (!user) return null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3" /> Live from backend
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every module, widget and action below is rendered from your assigned permissions.
        </p>
      </div>
      <Badge variant="secondary" className="h-6">
        {primaryRoleLabel(roles)}
      </Badge>
    </div>
  );
}

export function EmptyDashboard() {
  return (
    <Card className="rounded-2xl border-dashed">
      <CardHeader>
        <CardTitle>No widgets available</CardTitle>
        <CardDescription>
          Your administrator has not assigned any dashboard widgets to this workspace yet.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}

const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "col-span-12 md:col-span-3",
  md: "col-span-12 md:col-span-6 xl:col-span-4",
  lg: "col-span-12 xl:col-span-8",
  xl: "col-span-12",
};

export function widgetSizeClass(size: WidgetSize): string {
  return SIZE_CLASS[size];
}
