import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader } from "@/components/master/MasterKit";
import { AuditKpiGrid } from "@/components/audit/AuditKpiGrid";
import { AuditFiltersBar } from "@/components/audit/AuditFiltersBar";
import { AuditTable } from "@/components/audit/AuditTable";
import { ActivityTimeline } from "@/components/audit/ActivityTimeline";
import { LoginHistoryPanel } from "@/components/audit/LoginHistoryPanel";
import type { AuditListQuery } from "@/types/audit";

/**
 * This used to be an `MStubPanel` placeholder -- literally showing "Next
 * build pass · wired to its API" to a real operator -- despite this
 * platform's `audit_log_entries` table already holding real, substantial
 * history (1,000+ real rows) and a fully real, already-built Audit page
 * (KPIs, filters, log table, activity timeline, login history) existing at
 * /_authenticated/audit, wired to the real `GET /audit/entries` (see
 * audit.service.ts). None of that page's calls ever send an
 * `X-Organization-Id` header, which the backend (audit/router.py's own
 * module docstring, "Owner-only when organization-scoped") treats as a
 * genuine platform-level/cross-tenant search across every organization --
 * exactly this console's own audience. Reuses that same real service/hook +
 * those same components here, inside MasterShell, rather than rebuilding it
 * (identical precedent to master.analytics.tsx's own "Global Analytics").
 */
export const Route = createFileRoute("/master/audit")({ component: AuditScreen });

type Filters = Omit<AuditListQuery, "page" | "pageSize">;

const EMPTY: Filters = {};

function AuditScreen() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [tab, setTab] = useState("logs");

  return (
    <MasterShell title="Audit Logs">
      <MSectionHeader
        eyebrow="Compliance"
        title="Audit Logs"
        actions={<p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ScrollText className="h-3.5 w-3.5" /> Every operator/customer write action, across every organization</p>}
      />

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
    </MasterShell>
  );
}
