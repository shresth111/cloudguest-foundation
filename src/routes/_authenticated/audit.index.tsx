import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditKpiGrid } from "@/components/audit/AuditKpiGrid";
import { AuditFiltersBar } from "@/components/audit/AuditFiltersBar";
import { AuditTable } from "@/components/audit/AuditTable";
import { AuditDetailsDrawer } from "@/components/audit/AuditDetailsDrawer";
import { ActivityTimeline } from "@/components/audit/ActivityTimeline";
import { EventList } from "@/components/audit/EventList";
import { UserActivityPanel } from "@/components/audit/UserActivityPanel";
import { AuditAnalytics } from "@/components/audit/AuditAnalyticsPanel";
import { AuditRetentionPanel } from "@/components/audit/AuditRetentionPanel";
import { LiveActivityFeed } from "@/components/audit/LiveActivityFeed";
import { AuditNotifications } from "@/components/audit/AuditNotifications";
import { AuditQuickActions } from "@/components/audit/AuditQuickActions";
import { auditService } from "@/services/audit.service";
import type { AuditFilters } from "@/types/audit";

export const Route = createFileRoute("/_authenticated/audit/")({
  component: AuditPage,
});

const EMPTY: AuditFilters = {
  search: "",
  organizationId: "all",
  locationId: "all",
  userId: "all",
  category: "all",
  action: "all",
  module: "all",
  severity: "all",
  status: "all",
  ipAddress: "",
};

function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY);
  const [tab, setTab] = useState("logs");
  const [detailId, setDetailId] = useState<string | null>(null);
  const facets = useMemo(() => auditService.facets(), []);

  const openDetails = (id: string) => setDetailId(id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit logs & activity center</h1>
          <p className="text-sm text-muted-foreground">
            Complete visibility into user, system and network activity across CloudGuest.
          </p>
        </div>
        <AuditQuickActions
          onOpenTimeline={() => setTab("timeline")}
          onClearFilters={() => setFilters(EMPTY)}
        />
      </header>

      <AuditKpiGrid />

      <Card className="border-border/60">
        <CardContent className="p-4">
          <AuditFiltersBar
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onClear={() => setFilters(EMPTY)}
            facets={facets}
          />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex min-w-max">
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="logs" className="space-y-4">
          <AuditTable filters={filters} onOpenDetails={openDetails} />
        </TabsContent>

        <TabsContent value="timeline">
          <ActivityTimeline onOpenDetails={openDetails} />
        </TabsContent>

        <TabsContent value="security" className="grid gap-4 lg:grid-cols-2">
          <EventList
            title="Security events"
            description="Failed logins, MFA changes, permission and API-key events."
            actions={[
              "security.failed_login",
              "security.multiple_failed_logins",
              "user.password_reset",
              "user.mfa_enabled",
              "user.mfa_disabled",
              "security.api_key_created",
              "security.api_key_deleted",
              "security.permission_changed",
              "security.suspicious_activity",
              "security.unauthorized_access",
            ]}
            onOpenDetails={openDetails}
          />
          <AuditNotifications />
        </TabsContent>

        <TabsContent value="system">
          <EventList
            title="System events"
            description="Servers, backups, migrations, caches, queues and infrastructure."
            actions={[
              "system.server_started",
              "system.server_restarted",
              "system.backup_completed",
              "system.backup_failed",
              "system.database_migration",
              "system.cache_cleared",
              "system.queue_restarted",
              "system.redis_connected",
              "system.redis_failed",
              "system.api_restarted",
            ]}
            onOpenDetails={openDetails}
          />
        </TabsContent>

        <TabsContent value="network">
          <EventList
            title="Network events"
            description="Router health, WireGuard tunnels, RADIUS auth and guest sessions."
            actions={[
              "router.online",
              "router.offline",
              "network.wireguard_connected",
              "network.wireguard_disconnected",
              "network.radius_authentication",
              "network.authentication_failed",
              "portal.published",
              "guest.session_started",
              "guest.session_ended",
            ]}
            onOpenDetails={openDetails}
          />
        </TabsContent>

        <TabsContent value="users">
          <UserActivityPanel />
        </TabsContent>

        <TabsContent value="live" className="grid gap-4 lg:grid-cols-2">
          <LiveActivityFeed onOpenDetails={openDetails} />
          <AuditNotifications />
        </TabsContent>

        <TabsContent value="analytics">
          <AuditAnalytics />
        </TabsContent>

        <TabsContent value="retention">
          <AuditRetentionPanel />
        </TabsContent>
      </Tabs>

      <AuditDetailsDrawer id={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} />
    </div>
  );
}
