import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditKpiGrid } from "@/components/audit/AuditKpiGrid";
import { AuditFiltersBar } from "@/components/audit/AuditFiltersBar";
import { AuditTable } from "@/components/audit/AuditTable";
import { ActivityTimeline } from "@/components/audit/ActivityTimeline";
import { LoginHistoryPanel } from "@/components/audit/LoginHistoryPanel";
import type { AuditListQuery } from "@/types/audit";

export const Route = createFileRoute("/_authenticated/audit/")({
  component: AuditPage,
});

type Filters = Omit<AuditListQuery, "page" | "pageSize">;

const EMPTY: Filters = {};

function AuditPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [tab, setTab] = useState("logs");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
        <p className="text-sm text-muted-foreground">
          Every write action recorded across the platform, read directly from the audit trail.
        </p>
      </header>

      <AuditKpiGrid />

      <Card className="border-border/60">
        <CardContent className="p-4">
          <AuditFiltersBar
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onClear={() => setFilters(EMPTY)}
          />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="logins">Login history</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <AuditTable filters={filters} />
        </TabsContent>

        <TabsContent value="timeline">
          <ActivityTimeline />
        </TabsContent>

        <TabsContent value="logins">
          <LoginHistoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
