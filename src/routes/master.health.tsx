import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader } from "@/components/master/MasterKit";
import { HealthDashboard } from "@/components/monitoring/HealthDashboard";

/**
 * This used to be an `MStubPanel` placeholder -- literally showing "Next
 * build pass · wired to its API" to a real operator -- despite a fully
 * real, already-built Health Engine (real `service_health`/`health_checks`
 * tables, a real `GET /monitoring/health` dashboard, and a real
 * `POST /monitoring/health/run` that actually executes live dependency
 * checks) already existing at /_authenticated/monitoring's own "Health" tab.
 * Neither call sends an `X-Organization-Id` header (platform-wide by
 * design, confirmed live), so it's safe to reuse directly here rather than
 * rebuild it -- identical precedent to master.analytics.tsx's "Global
 * Analytics" and master.audit.tsx's "Audit Logs".
 *
 * Real data note: both tables are genuinely empty right now (0 rows) on
 * this platform -- no health check has ever been run -- so this honestly
 * renders an empty board with a "run one now" prompt rather than a
 * fabricated all-green status.
 */
export const Route = createFileRoute("/master/health")({ component: HealthScreen });

function HealthScreen() {
  return (
    <MasterShell title="System Health">
      <MSectionHeader
        eyebrow="Reliability"
        title="System Health"
        actions={<p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Live dependency checks -- API, database, cache</p>}
      />
      <HealthDashboard />
    </MasterShell>
  );
}
