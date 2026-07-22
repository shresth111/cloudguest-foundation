import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitoringKpiGrid } from "@/components/monitoring/MonitoringKpiGrid";
import { NetworkOverview } from "@/components/monitoring/NetworkOverview";
import { TopologyView } from "@/components/monitoring/TopologyView";
import { HealthDashboard } from "@/components/monitoring/HealthDashboard";
import { AlertRulesPanel } from "@/components/monitoring/AlertRulesPanel";
import { AlertManagement } from "@/components/monitoring/AlertManagement";
import { NotificationChannelsPanel } from "@/components/monitoring/NotificationChannelsPanel";
import { IncidentManagement } from "@/components/monitoring/IncidentManagement";
import { SlaPanel } from "@/components/monitoring/SlaPanel";
import { ZtpFleetPanel } from "@/components/monitoring/ZtpFleetPanel";

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
            Real health checks, alert rules, notifications, incidents, SLA reports, and device
            fleet status across the platform.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["monitoring"] });
            toast.success("Monitoring refreshed");
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <MonitoringKpiGrid />

      <Tabs defaultValue="overview">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="alert-rules">Alert rules</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="fleet">Device fleet</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <NetworkOverview />
          <TopologyView />
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <HealthDashboard />
        </TabsContent>
        <TabsContent value="alert-rules" className="mt-4">
          <AlertRulesPanel />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertManagement />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationChannelsPanel />
        </TabsContent>
        <TabsContent value="incidents" className="mt-4">
          <IncidentManagement />
        </TabsContent>
        <TabsContent value="sla" className="mt-4">
          <SlaPanel />
        </TabsContent>
        <TabsContent value="fleet" className="mt-4">
          <ZtpFleetPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
