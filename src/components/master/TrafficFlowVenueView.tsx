import { Suspense, lazy, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Globe, MonitorSmartphone, RefreshCw } from "lucide-react";
import {
  MButton,
  MSeg,
  MStat,
  MTable,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { CHART_BODY_H } from "@/components/master/chart-layout";
import { TrafficFlowGeoBlock } from "@/components/master/TrafficFlowGeoBlock";
import { useFlowGeo, useFlowSummary } from "@/hooks/useTrafficFlow";
import { requestErrorOf } from "@/services/api";
import { FLOW_WINDOW_MS } from "@/services/traffic-flow.service";
import {
  NOT_COUNTED_ITEMS,
  NOT_MEASURED,
  NOT_YET_CHECKED,
  TRAFFIC_FLOW_MODULE_NAME,
  atLeast,
  deviceMatchLabel,
  flowBytes,
  freshnessLine,
  isLowerBound,
  lowerBoundNote,
  notMeasuredMessage,
  otherAtMostLabel,
  protocolRows,
  seriesColor,
  servicesView,
  shareBarWidth,
  shareLabel,
  stepLabel,
  timelineGapNote,
  timelineSlots,
  totalsView,
} from "@/lib/traffic-flow";
import type { TimelineMode } from "@/components/master/TrafficFlowTimelineChart";
import type { FlowScope, FlowWindow, RouterFlowStatus } from "@/types/traffic-flow";

// recharts stays behind a dynamic import (see PlatformOverviewCharts).
const TrafficFlowTimelineChart = lazy(() =>
  import("@/components/master/TrafficFlowTimelineChart").then((m) => ({
    default: m.TrafficFlowTimelineChart,
  })),
);

const WINDOWS: { value: FlowWindow; label: string }[] = [
  { value: "1h", label: "1 h" },
  { value: "6h", label: "6 h" },
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 d" },
];

/**
 * Master -> Traffic Lens -> venue view (screen M2), from GET /summary.
 *
 * Main block: Services -- share and rate per service, a stacked timeline
 * with one band per service plus "Other", and the protocol breakdown. A
 * service is a protocol and a port with the port's IANA label; this screen
 * never names an application.
 *
 * Below it, top devices and top destinations as two SEPARATE lists. Nothing
 * here places a device beside a destination or a service, there is no
 * drill-down from one list into another, and the API holds no such pairing.
 *
 * Then "Where traffic goes" (TrafficFlowGeoBlock): countries, and the
 * networks inside a country. A fourth independent list -- it holds no
 * address, and a network is never called anything but a network.
 *
 * Three empties are kept apart: not set up, not measured for this period,
 * and measured-and-empty. Only the last may show a zero.
 */
export function TrafficFlowVenueView({
  routers,
  scope,
  onScope,
  onSetup,
}: {
  routers: RouterFlowStatus[];
  scope: FlowScope;
  onScope: (next: FlowScope) => void;
  /** Opens the setup drawer for a router. */
  onSetup: (routerId: string) => void;
}) {
  const [organizationId, setOrganizationId] = useState("");
  const [at, setAt] = useState(() => Date.now());
  const [mode, setMode] = useState<TimelineMode>("service");
  const q = useFlowSummary(scope, at);
  const s = q.data;
  // By country: its own request for the same pinned range, and only once
  // the summary says the range was measured at all.
  const geoQ = useFlowGeo(scope, at, s?.measured === true);
  const now = Date.now();

  const customers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (r.organization_id) m.set(r.organization_id, r.organization_name ?? r.organization_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers]);
  const venues = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (r.location_id && (!organizationId || r.organization_id === organizationId))
        m.set(r.location_id, r.location_name ?? r.location_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers, organizationId]);
  const routerOptions = routers.filter(
    (r) =>
      (!organizationId || r.organization_id === organizationId) &&
      (!scope.locationId || r.location_id === scope.locationId),
  );
  const inScope = routers.filter((r) =>
    scope.routerId ? r.router_id === scope.routerId : r.location_id === scope.locationId,
  );
  const picked = !!(scope.locationId || scope.routerId);

  const set = (patch: Partial<FlowScope>) => {
    setAt(Date.now());
    onScope({ ...scope, ...patch });
  };

  const totals = totalsView(s);
  const slots = useMemo(() => timelineSlots(s), [s]);
  const gapNote = timelineGapNote(slots);
  const noServiceSteps = slots.filter((x) => x.measured && !x.servicesMeasured).length;
  const services = servicesView(s);
  const protocols = protocolRows(s);
  const rangeMs = FLOW_WINDOW_MS[scope.window];

  return (
    <section className="mt-6 space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <select
          aria-label="Customer"
          className={`${M_INPUT} w-auto`}
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            set({ locationId: "", routerId: "" });
          }}
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
          value={scope.locationId}
          onChange={(e) => set({ locationId: e.target.value, routerId: "" })}
        >
          <option value="">Pick a venue</option>
          {venues.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Router"
          className={`${M_INPUT} w-auto`}
          value={scope.routerId}
          onChange={(e) => {
            const r = routers.find((x) => x.router_id === e.target.value);
            set({ routerId: e.target.value, locationId: r?.location_id ?? scope.locationId });
          }}
        >
          <option value="">
            {scope.locationId ? "All routers at this venue" : "Pick a router"}
          </option>
          {routerOptions.map((r) => (
            <option key={r.router_id} value={r.router_id}>
              {r.router_name ?? r.router_id}
            </option>
          ))}
        </select>
        <MSeg options={WINDOWS} value={scope.window} onChange={(w) => set({ window: w })} />
        <MButton variant="outline" disabled={!picked} onClick={() => setAt(Date.now())}>
          <RefreshCw /> Refresh
        </MButton>
      </div>

      {!picked ? (
        <Notice title="Pick a venue or a router.">
          Nothing is requested until one is picked. You can also click a router in the Fleet tab.
        </Notice>
      ) : q.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : q.isError || !s ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Couldn't load traffic for this scope.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {requestErrorOf(q.error)?.message ?? "The server did not answer."} Nothing is shown,
            because an error is not an empty venue.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {freshnessLine(s, now)} · Volumes are from traffic records, not the billing figure;
            Guest Connection Records remain the per-guest source of truth.
          </p>

          {!totals.measured ? (
            (() => {
              const m = notMeasuredMessage(
                s,
                inScope.map((r) => r.state),
                now,
              );
              const target = inScope.find((r) => r.state === "not_configured");
              return (
                <Notice title={m.title}>
                  {m.body}
                  {m.offerSetup && target && (
                    <span className="mt-2 block">
                      <MButton onClick={() => onSetup(target.router_id)}>
                        Set up this router
                      </MButton>
                    </span>
                  )}
                </Notice>
              );
            })()
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MStat
                  label="Download"
                  value={totals.download}
                  delta={`average ${totals.downloadRate}`}
                  icon={ArrowDown}
                />
                <MStat
                  label="Upload"
                  value={totals.upload}
                  delta={`average ${totals.uploadRate}`}
                  icon={ArrowUp}
                />
                <MStat
                  label="Devices at once"
                  value={totals.devicesPeakCount}
                  delta="most in any one window, not a total"
                  icon={MonitorSmartphone}
                />
                <MStat
                  label="Outside addresses at once"
                  value={totals.destinationsPeakCount}
                  delta="most in any one window, not a total"
                  icon={Globe}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Counted apart and in no list below: venue-internal traffic{" "}
                {totals.internal ?? NOT_MEASURED}
                {totals.unclassified ? ` · unclassified ${totals.unclassified}` : ""}. Internal
                traffic is excluded from destinations.
              </p>

              <Block
                title="Services"
                note="A service is a protocol and a port, with the port's standard name where it has one. It is not an application: nothing here inspects traffic contents."
                actions={
                  <MSeg
                    options={[
                      { value: "service", label: "By service" },
                      { value: "direction", label: "Download / upload" },
                    ]}
                    value={mode}
                    onChange={setMode}
                  />
                }
              >
                <Suspense fallback={<div style={{ height: CHART_BODY_H }} />}>
                  <TrafficFlowTimelineChart
                    slots={slots}
                    series={s.timeline?.series ?? []}
                    mode={mode}
                    rangeMs={rangeMs}
                  />
                </Suspense>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Rate over time, {stepLabel(s.step_seconds)}.{gapNote ? ` ${gapNote}` : ""}
                  {mode === "service" && noServiceSteps > 0
                    ? ` ${noServiceSteps} step${noServiceSteps === 1 ? " has" : "s have"} traffic but no per-service detail and are blank in this view; switch to Download / upload to see them.`
                    : ""}
                </p>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    {services.kind === "not_measured" ? (
                      <Notice title="Services not measured for this period.">
                        The records carried no protocol or port. That is not the same as no
                        services.
                      </Notice>
                    ) : services.kind === "empty" ? (
                      <Notice title="No service traffic recorded in this period." />
                    ) : (
                      <MTable
                        head={
                          <>
                            <MTh>Service (port)</MTh>
                            <MTh>Share</MTh>
                            <MTh>Average rate</MTh>
                            <MTh>Download</MTh>
                            <MTh>Upload</MTh>
                          </>
                        }
                      >
                        {[...services.rows, ...(services.other ? [services.other] : [])].map(
                          (r) => (
                            <MTr key={r.key}>
                              <MTd className="text-xs">
                                <span className="flex items-center gap-2">
                                  <span
                                    aria-hidden
                                    className="h-2 w-2 shrink-0 rounded-sm"
                                    style={{ background: seriesColor(s, r.key) ?? "transparent" }}
                                  />
                                  <span className="font-medium">{r.label}</span>
                                </span>
                              </MTd>
                              <MTd>
                                <ShareBar width={r.barWidth} label={r.share} />
                              </MTd>
                              <MTd className="text-xs tabular-nums">{r.rate}</MTd>
                              <MTd className="text-xs tabular-nums">{r.down}</MTd>
                              <MTd className="text-xs tabular-nums">{r.up}</MTd>
                            </MTr>
                          ),
                        )}
                      </MTable>
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Protocols
                    </h4>
                    {protocols === null ? (
                      <p className="text-xs text-muted-foreground">
                        {NOT_MEASURED} for this period.
                      </p>
                    ) : protocols.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No protocol traffic recorded in this period.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {protocols.map((p) => (
                          <li key={p.label} className="text-xs">
                            <div className="flex justify-between">
                              <span className="font-medium">{p.label}</span>
                              <span className="tabular-nums text-muted-foreground">{p.bytes}</span>
                            </div>
                            <ShareBar width={p.barWidth} label={p.share} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Block>

              <div className="grid gap-4 xl:grid-cols-2">
                <Block
                  title="Top devices"
                  note="Local addresses. This list is independent of the destinations and services lists: nothing stored says which device reached which address or service."
                >
                  {(s.devices?.items ?? []).length === 0 ? (
                    <Notice title="No device traffic recorded in this period." />
                  ) : (
                    <MTable
                      head={
                        <>
                          <MTh>Device address</MTh>
                          <MTh>Download</MTh>
                          <MTh>Upload</MTh>
                          <MTh>Share</MTh>
                          <MTh>Matched to</MTh>
                        </>
                      }
                    >
                      {(s.devices?.items ?? []).map((d) => {
                        const lb = isLowerBound(s, "devices");
                        return (
                          <MTr key={`${d.router_id ?? ""}-${d.ip}`}>
                            <MTd className="font-mono text-xs">{d.ip}</MTd>
                            <MTd className="text-xs tabular-nums">
                              {atLeast(flowBytes(d.bytes_down), lb)}
                            </MTd>
                            <MTd className="text-xs tabular-nums">
                              {atLeast(flowBytes(d.bytes_up), lb)}
                            </MTd>
                            <MTd>
                              <ShareBar
                                width={shareBarWidth(d.share_at_least)}
                                label={atLeast(shareLabel(d.share_at_least), lb)}
                              />
                            </MTd>
                            <MTd className="text-xs">
                              {deviceMatchLabel(d.match)}
                              {d.guest_session_id && (
                                <span className="ml-1 font-mono text-muted-foreground">
                                  {d.guest_session_id.slice(0, 8)}
                                </span>
                              )}
                            </MTd>
                          </MTr>
                        );
                      })}
                    </MTable>
                  )}
                  <BoundFootnote
                    note={lowerBoundNote(s, "devices")}
                    other={otherAtMostLabel(
                      s.devices?.other_bytes_at_most,
                      isLowerBound(s, "devices"),
                    )}
                    what="All other devices"
                  />
                </Block>

                <Block
                  title="Top destinations"
                  note="Outside addresses only; no site, owner or country name is attached. Independent of the devices and services lists."
                >
                  {(s.destinations?.items ?? []).length === 0 ? (
                    <Notice title="No destination traffic recorded in this period." />
                  ) : (
                    <MTable
                      head={
                        <>
                          <MTh>Outside address</MTh>
                          <MTh>Download</MTh>
                          <MTh>Upload</MTh>
                          <MTh>Share</MTh>
                        </>
                      }
                    >
                      {(s.destinations?.items ?? []).map((d) => {
                        const lb = isLowerBound(s, "destinations");
                        return (
                          <MTr key={d.ip}>
                            <MTd className="font-mono text-xs">{d.ip}</MTd>
                            <MTd className="text-xs tabular-nums">
                              {atLeast(flowBytes(d.bytes_down), lb)}
                            </MTd>
                            <MTd className="text-xs tabular-nums">
                              {atLeast(flowBytes(d.bytes_up), lb)}
                            </MTd>
                            <MTd>
                              <ShareBar
                                width={shareBarWidth(d.share_at_least)}
                                label={atLeast(shareLabel(d.share_at_least), lb)}
                              />
                            </MTd>
                          </MTr>
                        );
                      })}
                    </MTable>
                  )}
                  <BoundFootnote
                    note={lowerBoundNote(s, "destinations")}
                    other={otherAtMostLabel(
                      s.destinations?.other_bytes_at_most,
                      isLowerBound(s, "destinations"),
                    )}
                    what="All other outside addresses"
                  />
                </Block>
              </div>

              <TrafficFlowGeoBlock
                geo={geoQ.data}
                loading={geoQ.isLoading}
                error={
                  geoQ.isError
                    ? (requestErrorOf(geoQ.error)?.message ?? "The server did not answer.")
                    : null
                }
              />
            </>
          )}

          <Block
            title="What is not counted"
            note={`${TRAFFIC_FLOW_MODULE_NAME} has not been checked against hardware yet. Until each of these is measured on this router, read the figures above as possibly incomplete.`}
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {NOT_COUNTED_ITEMS.map((i) => (
                <li key={i.title} className="rounded-lg border border-border p-3 text-xs">
                  <p className="font-medium">{i.title}</p>
                  <p className="mt-0.5 text-muted-foreground">{i.body}</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-400">{NOT_YET_CHECKED}</p>
                </li>
              ))}
            </ul>
          </Block>
        </>
      )}
    </section>
  );
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-sm">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

function Block({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {note && <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">{note}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** A share as a thin bar with its value beside it in ink, so the number
 * never depends on reading the bar. */
function ShareBar({ width, label }: { width: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
      <span className="whitespace-nowrap text-xs tabular-nums">{label}</span>
    </div>
  );
}

function BoundFootnote({
  note,
  other,
  what,
}: {
  note: string | null;
  other: string | null;
  what: string;
}) {
  if (!note && !other) return null;
  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      {other && (
        <p>
          {what}: {other}.
        </p>
      )}
      {note && <p>{note}</p>}
    </div>
  );
}
