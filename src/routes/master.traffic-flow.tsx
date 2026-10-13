import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Settings2 } from "lucide-react";
import { MasterShell, useOperatorCaps } from "@/components/master/MasterShell";
import {
  MButton,
  MPageShell,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { TrafficFlowDestinations } from "@/components/master/TrafficFlowDestinations";
import { TrafficFlowRecords } from "@/components/master/TrafficFlowRecords";
import { TrafficFlowRouterDrawer } from "@/components/master/TrafficFlowRouterDrawer";
import { TrafficFlowVenueView } from "@/components/master/TrafficFlowVenueView";
import { useTrafficFlowStatus } from "@/hooks/useTrafficFlow";
import { requestErrorOf } from "@/services/api";
import { flowRange } from "@/services/traffic-flow.service";
import {
  FLOW_STATE_FILTER_OPTIONS,
  TRAFFIC_FLOW_MODULE_NAME,
  bytesLastHourLabel,
  filterRouters,
  flowState,
  lastDataLabel,
  stateLabel,
  statusBanners,
  verdictLabel,
  windowsLastHourLabel,
  type FlowBanner,
} from "@/lib/traffic-flow";
import type { FleetFilters, FlowExportState, FlowScope } from "@/types/traffic-flow";

export const Route = createFileRoute("/master/traffic-flow")({
  component: TrafficFlowScreen,
});

type Tab = "fleet" | "venue" | "destinations" | "flows";

const EMPTY_FILTERS: FleetFilters = { organizationId: "", locationId: "", state: "", q: "" };
const EMPTY_SCOPE: FlowScope = { window: "1h", locationId: "", routerId: "" };

const BANNER_CLASS: Record<FlowBanner["tone"], string> = {
  info: "border-amber-500/30 bg-amber-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  error: "border-destructive/30 bg-destructive/5",
};

/**
 * Master -> Traffic Lens: what venue traffic is made of, from the flow
 * records MikroTik routers export (NetFlow/IPFIX). Read with
 * traffic_flows.read; Apply / Remove on a router need traffic_flows.update.
 * Both are pinned to GLOBAL on the backend. Operator-only: guest traffic
 * metadata never reaches a customer surface (~/wyfy-ops/netflow/DESIGN.md §7).
 *
 * Four tabs. Fleet (M1) is the current state of every router, from GET
 * /status; it has no time range. Venue view (M2) is one venue or router over
 * a range, from GET /summary. Destinations is a search over one venue's
 * destination records, venue-level and audited. Flows is a search over
 * individual flow records (GET /flows): the one table with a device's
 * address beside the address it reached, on this console only and audited.
 * The venue and the range are shared by the last three. The setup drawer
 * (M3) opens from the first two.
 *
 * Honest states, never a zero that reads as "all quiet": the feature off,
 * a router not set up, set up but never heard from, silent, an unsupported
 * vendor, and a failed request are each said in words.
 */
function TrafficFlowScreen() {
  const caps = useOperatorCaps();
  const canApply = caps.has("traffic-flow.apply");
  const status = useTrafficFlowStatus();
  const [tab, setTab] = useState<Tab>("fleet");
  const [filters, setFilters] = useState<FleetFilters>(EMPTY_FILTERS);
  const [scope, setScope] = useState<FlowScope>(EMPTY_SCOPE);
  const [openRouter, setOpenRouter] = useState<string | null>(null);
  /** The moment the Flows tab's range ends at. It moves only on Refresh and
   * when the venue or range is changed there, so the tab loads once per
   * change and never by itself. */
  const [flowsAt, setFlowsAt] = useState(() => Date.now());

  const routers = useMemo(() => status.data?.routers ?? [], [status.data]);
  const windowSeconds = status.data?.window_seconds ?? 0;
  const customers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (r.organization_id) m.set(r.organization_id, r.organization_name ?? r.organization_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers]);
  const venues = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (
        r.location_id &&
        (!filters.organizationId || r.organization_id === filters.organizationId)
      )
        m.set(r.location_id, r.location_name ?? r.location_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers, filters.organizationId]);
  const rows = filterRouters(routers, filters);
  const anySetUp = routers.some((r) => r.configured);
  const set = (patch: Partial<FleetFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const now = Date.now();

  return (
    <MasterShell title={TRAFFIC_FLOW_MODULE_NAME}>
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title={TRAFFIC_FLOW_MODULE_NAME}
          description="What venue traffic is made of, by service, device address and outside address, from the flow records MikroTik routers export over their WireGuard tunnel. Addresses and ports only: nothing here inspects contents or names an app. Operator-only."
          actions={
            <div className="flex gap-2">
              <MSeg
                options={[
                  { value: "fleet", label: "Fleet" },
                  { value: "venue", label: "Venue view" },
                  { value: "destinations", label: "Destinations" },
                  { value: "flows", label: "Flows" },
                ]}
                value={tab}
                onChange={setTab}
              />
              <MButton
                variant="outline"
                onClick={() => {
                  setFlowsAt(Date.now());
                  void status.refetch();
                }}
              >
                <RefreshCw /> Refresh
              </MButton>
            </div>
          }
        />

        {status.isError ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Couldn't load {TRAFFIC_FLOW_MODULE_NAME} status.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {requestErrorOf(status.error)?.message ?? "The server did not answer."} No router is
              listed, because an error is not an empty fleet.
            </p>
          </div>
        ) : status.data ? (
          <div className="mt-4 space-y-2">
            {statusBanners(status.data, now).map((b) => (
              <div
                key={b.title}
                className={`rounded-lg border p-4 text-sm ${BANNER_CLASS[b.tone]}`}
              >
                <p className="font-medium">{b.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "fleet" ? (
          <section className="mt-6 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <select
                aria-label="Customer"
                className={`${M_INPUT} w-auto`}
                value={filters.organizationId}
                onChange={(e) => set({ organizationId: e.target.value, locationId: "" })}
              >
                <option value="">All customers</option>
                {customers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Venue"
                className={`${M_INPUT} w-auto`}
                value={filters.locationId}
                onChange={(e) => set({ locationId: e.target.value })}
              >
                <option value="">All venues</option>
                {venues.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="State"
                className={`${M_INPUT} w-auto`}
                value={filters.state}
                onChange={(e) => set({ state: e.target.value as FlowExportState | "" })}
              >
                {FLOW_STATE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Search router name"
                placeholder="Router name…"
                className={`${M_INPUT} w-48`}
                maxLength={100}
                value={filters.q}
                onChange={(e) => set({ q: e.target.value })}
              />
            </div>

            {status.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-muted" />
            ) : status.isError ? null : routers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                The platform listed no router at all. That is an empty fleet, not a quiet one.
              </p>
            ) : (
              <>
                {!anySetUp && (
                  <p className="text-sm text-muted-foreground">
                    No router has been set up yet. Use “Setup” on a MikroTik row to start with one.
                  </p>
                )}
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No router matches these filters ({routers.length} in the fleet).
                  </p>
                ) : (
                  <MTable
                    head={
                      <>
                        <MTh>Router</MTh>
                        <MTh>Venue</MTh>
                        <MTh>State</MTh>
                        <MTh>Last data</MTh>
                        <MTh>Last hour</MTh>
                        <MTh>Read-back</MTh>
                        <MTh />
                      </>
                    }
                  >
                    {rows.map((r) => {
                      const st = flowState(r.state);
                      const v = verdictLabel(r.last_verdict_ok);
                      return (
                        <MTr
                          key={r.router_id}
                          onClick={() => {
                            setScope((sc) => ({
                              ...sc,
                              locationId: r.location_id ?? "",
                              routerId: r.router_id,
                            }));
                            setTab("venue");
                          }}
                        >
                          <MTd className="font-medium">
                            {r.router_name ?? r.router_id}
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              {r.vendor ?? "unknown vendor"}
                            </span>
                          </MTd>
                          <MTd>
                            {r.location_name ?? "—"}
                            <span className="block text-[11px] text-muted-foreground">
                              {r.organization_name ?? ""}
                            </span>
                          </MTd>
                          <MTd>
                            <MTag label={stateLabel(r, now)} tone={st.tone} />
                            {r.state === "awaiting_first_data" && (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                Unknown, not quiet.
                              </span>
                            )}
                            {!r.configured && (r.state === "receiving" || r.state === "silent") && (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                Removed; earlier data still held.
                              </span>
                            )}
                          </MTd>
                          <MTd className="text-xs">{lastDataLabel(r, now)}</MTd>
                          <MTd className="text-xs tabular-nums">
                            {windowsLastHourLabel(r, windowSeconds)}
                            <span className="block text-[11px] text-muted-foreground">
                              {bytesLastHourLabel(r)}
                            </span>
                          </MTd>
                          <MTd>
                            <MTag label={v.label} tone={v.tone} />
                            {r.last_verdict_ok === false && r.last_verdict_detail && (
                              <span className="mt-0.5 block font-mono text-[11px] text-destructive">
                                {r.last_verdict_detail}
                              </span>
                            )}
                          </MTd>
                          <MTd>
                            <MButton
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenRouter(r.router_id);
                              }}
                            >
                              <Settings2 /> Setup
                            </MButton>
                          </MTd>
                        </MTr>
                      );
                    })}
                  </MTable>
                )}
                <p className="text-[11px] text-muted-foreground">
                  “Last hour” is windows received out of those expected, and the client traffic in
                  them. A dash means there is no reading, not zero. Click a row to open its venue
                  view.
                </p>
              </>
            )}
          </section>
        ) : tab === "venue" ? (
          <TrafficFlowVenueView
            routers={routers}
            scope={scope}
            onScope={setScope}
            onSetup={setOpenRouter}
          />
        ) : tab === "destinations" ? (
          <TrafficFlowDestinations
            routers={routers}
            scope={scope}
            onScope={setScope}
            rangeAt={(at) => flowRange(scope, at)}
          />
        ) : (
          <TrafficFlowRecords
            routers={routers}
            scope={scope}
            // A new venue, router or range is a new load, as of now.
            onScope={(next) => {
              setFlowsAt(Date.now());
              setScope(next);
            }}
            bounds={flowRange(scope, flowsAt)}
          />
        )}

        <TrafficFlowRouterDrawer
          key={openRouter ?? "none"}
          routerId={openRouter}
          onClose={() => setOpenRouter(null)}
          canApply={canApply}
          windowSeconds={windowSeconds}
        />
      </MPageShell>
    </MasterShell>
  );
}
