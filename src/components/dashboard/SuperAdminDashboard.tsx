import { KpiGrid } from "./KpiGrid";
import { QuickActions } from "./QuickActions";
import {
  LicenseStatusChart,
  RevenueChart,
  RouterHealthChart,
  SubscriptionStatusChart,
} from "./DashboardCharts";
import {
  RecentAuditWidget,
  RecentLocationsWidget,
  RecentOrgsWidget,
  RecentRoutersWidget,
} from "./DashboardWidgets";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";

export function SuperAdminDashboard() {
  const { user } = useAuth();

  return (
    <PageShell mesh>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" /> Platform Console
          </div>
          <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Welcome back,{" "}
            <span className="gradient-text">{user?.name.split(" ")[0]}</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Provisioning, licensing and infrastructure across every CloudGuest customer.
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
          eyebrow="Infrastructure"
          title="NAS fleet posture"
          description="Revenue trend and NAS device health across all customers."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <RouterHealthChart />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Revenue"
          title="Subscriptions & licensing"
          description="Subscription status and license mix across the platform."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <SubscriptionStatusChart />
          <LicenseStatusChart />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Activity"
          title="Recent platform activity"
          description="New customers, locations, NAS registrations, plan changes and policy assignments."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <RecentOrgsWidget />
          <RecentLocationsWidget />
          <RecentRoutersWidget />
          <RecentAuditWidget />
        </div>
      </section>
    </PageShell>
  );
}
