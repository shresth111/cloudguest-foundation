/**
 * `/partner/incidents` (INCIDENTS-1): the network health headline, open and
 * past outages (history with MTTR), and "Open incident" on a router, fiber
 * node or zone. Detail opens in a drawer (`?incident=`). Everything 404s
 * while `ISP_INCIDENTS_ENABLED` is off, and the page then says so.
 */
import { useState } from "react";
import { Activity, AlertTriangle, Plus, Siren, Timer } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSectionHeader,
  MSeg,
  MStat,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import { ErrorBlock, LoadingBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { IncidentDrawer } from "@/components/isp-partner/incidents/IncidentDrawer";
import { NewIncidentDialog } from "@/components/isp-partner/incidents/NewIncidentDialog";
import { useIncidents, useNetworkHealth } from "@/hooks/isp-partner/useIncidents";
import { isNotFound } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  SCOPE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  formatMinutes,
  healthTone,
  severityTone,
  statusTone,
} from "@/lib/isp-partner/incidents";

type View = "open" | "resolved" | "all";

export function IncidentsPage({
  incidentId,
  onIncident,
}: {
  incidentId: string | null;
  onIncident: (id: string | null) => void;
}) {
  const { can } = usePartner();
  const health = useNetworkHealth();
  const [view, setView] = useState<View>("open");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useIncidents({
    open_only: view === "open" || undefined,
    status: view === "resolved" ? "resolved" : undefined,
    page,
  });
  if (health.isLoading) return <LoadingBlock />;
  if (health.error && isNotFound(health.error)) {
    return (
      <MEmptyState
        icon={Siren}
        title="Incidents are not switched on"
        description="Outage incidents are not switched on for your network. Ask Wyfy Guest support to turn them on."
      />
    );
  }
  const h = health.data;
  const items = q.data?.items ?? [];
  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Network"
        title="Incidents"
        description="Outages on a router, a fiber node or a zone: who is affected, what was done, and the reason for outage."
        actions={
          can("isp_incidents.manage") ? (
            <MButton onClick={() => setCreating(true)}>
              <Plus /> Open incident
            </MButton>
          ) : undefined
        }
      />
      {health.error ? (
        <ErrorBlock error={health.error} onRetry={() => health.refetch()} what="network health" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MStat
            label="Network health"
            value={h?.health_percent === null || !h ? "Not measured" : `${h.health_percent}%`}
            delta={h ? `${h.routers_up} of ${h.routers_up + h.routers_down} routers up` : undefined}
            icon={Activity}
            tone={healthTone(h?.health_percent ?? null)}
          />
          <MStat
            label="Routers down"
            value={h?.routers_down ?? 0}
            delta={
              h?.routers_not_reporting ? `${h.routers_not_reporting} not reporting yet` : undefined
            }
            icon={AlertTriangle}
            tone={h?.routers_down ? "danger" : "default"}
          />
          <MStat
            label="Open incidents"
            value={h?.open_incidents ?? 0}
            icon={Siren}
            tone={h?.open_incidents ? "warning" : "default"}
          />
          <MStat
            label="Mean time to resolve"
            value={formatMinutes(q.data?.summary.mttr_minutes)}
            delta={
              q.data?.summary.resolved
                ? `${q.data.summary.resolved} resolved in this view`
                : undefined
            }
            icon={Timer}
          />
        </div>
      )}
      {h && <p className="text-xs text-muted-foreground">{h.basis}</p>}
      <MSeg<View>
        value={view}
        onChange={(v) => {
          setView(v);
          setPage(1);
        }}
        options={[
          { value: "open", label: "Open" },
          { value: "resolved", label: "History" },
          { value: "all", label: "All" },
        ]}
      />
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="incidents" />
      ) : !q.isLoading && items.length === 0 ? (
        <MEmptyState
          icon={Siren}
          title={view === "open" ? "No open incidents" : "No incidents here"}
          description={
            view === "open"
              ? "When a router, fiber node or zone goes down, open an incident to track it and tell the affected subscribers."
              : "Resolved incidents show here with their reason for outage."
          }
        />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Incident</MTh>
              <MTh>Where</MTh>
              <MTh>Status</MTh>
              <MTh>Started</MTh>
              <MTh className="text-right">Duration</MTh>
              <MTh className="text-right">Affected</MTh>
              <MTh>Reason</MTh>
            </>
          }
        >
          {items.map((i) => (
            <MTr key={i.id} onClick={() => onIncident(i.id)}>
              <MTd>
                <div className="font-mono text-xs">{i.code}</div>
                <div className="font-medium">{i.title}</div>
                <MTag label={SEVERITY_LABEL[i.severity]} tone={severityTone(i.severity)} />
              </MTd>
              <MTd>
                <div className="text-xs text-muted-foreground">{SCOPE_LABEL[i.scope_kind]}</div>
                <div>{i.scope_label}</div>
              </MTd>
              <MTd>
                <MTag label={STATUS_LABEL[i.status]} tone={statusTone(i.status)} />
              </MTd>
              <MTd className="text-xs">{formatDateTime(i.started_at)}</MTd>
              <MTd className="text-right tabular-nums">{formatMinutes(i.duration_minutes)}</MTd>
              <MTd className="text-right tabular-nums">{i.affected_visible}</MTd>
              <MTd className="text-xs">{i.rfo_label ?? "–"}</MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {q.data && (
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(q.data.total / 50))}
          total={q.data.total}
          onPage={setPage}
        />
      )}
      {creating && (
        <NewIncidentDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onIncident(id);
          }}
        />
      )}
      {incidentId && <IncidentDrawer id={incidentId} onClose={() => onIncident(null)} />}
    </div>
  );
}
