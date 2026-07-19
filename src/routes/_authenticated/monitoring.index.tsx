import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitoringKpiGrid } from "@/components/monitoring/MonitoringKpiGrid";
import { NetworkOverview } from "@/components/monitoring/NetworkOverview";
import { LiveRouterTable } from "@/components/monitoring/LiveRouterTable";
import { PerformanceCharts } from "@/components/monitoring/PerformanceCharts";
import { AlertManagement } from "@/components/monitoring/AlertManagement";
import { IncidentManagement } from "@/components/monitoring/IncidentManagement";
import { TopologyView } from "@/components/monitoring/TopologyView";
import { HealthDashboard } from "@/components/monitoring/HealthDashboard";
import { NotificationCenter } from "@/components/monitoring/NotificationCenter";
import { MonitoringSettingsPanel } from "@/components/monitoring/MonitoringSettingsPanel";
import { MonitoringQuickActions } from "@/components/monitoring/MonitoringQuickActions";

export const Route = createFileRoute("/_authenticated/monitoring/")({
  component: MonitoringPage,
});

function MonitoringPage() {
  const qc = useQueryClient();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitoring & alerts</h1>
          <p className="text-sm text-muted-foreground">
            Real-time visibility across routers, services, alerts, and incidents.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { qc.invalidateQueries({ queryKey: ["monitoring"] }); toast.success("Monitoring refreshed"); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.success("Report export started")}>
            <Download className="mr-2 h-4 w-4" /> Export report
          </Button>
        </div>
      </div>

      <MonitoringKpiGrid />

      <Tabs defaultValue="overview">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="routers">Live routers</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="topology">Topology</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <NetworkOverview />
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <TopologyView />
            <MonitoringQuickActions />
          </div>
        </TabsContent>
        <TabsContent value="routers" className="mt-4"><LiveRouterTable /></TabsContent>
        <TabsContent value="performance" className="mt-4"><PerformanceCharts /></TabsContent>
        <TabsContent value="alerts" className="mt-4"><AlertManagement /></TabsContent>
        <TabsContent value="incidents" className="mt-4"><IncidentManagement /></TabsContent>
        <TabsContent value="topology" className="mt-4"><TopologyView /></TabsContent>
        <TabsContent value="health" className="mt-4"><HealthDashboard /></TabsContent>
        <TabsContent value="notifications" className="mt-4"><NotificationCenter /></TabsContent>
        <TabsContent value="settings" className="mt-4"><MonitoringSettingsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
