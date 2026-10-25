/**
 * "Device health & interface traffic" -- the venue owner's read-only view
 * of how their own network hardware has been behaving.
 *
 * THE TWO QUESTIONS THIS EXISTS TO ANSWER
 *   - "When did my uplink saturate?" -> the per-interface throughput
 *     chart, plus the peak callout that names the interface and the time.
 *   - "Which of my devices is unhealthy?" -> the device picker's health
 *     dot and the CPU/memory chart for the selected device.
 *
 * NAMING: never "SNMP logs", never "logs" -- see `@/types/deviceHealth`
 * for the full reasoning and `docs/ipdr-logs-syslog-spec.md` §5 for the
 * precedent. These are periodic measurements, not an event stream, and
 * the transport is not the product.
 *
 * SCOPE: metrics only, read-only, this organization's own devices. SNMP
 * *configuration* -- community string, version, port, enabled flag -- is
 * Master-console territory and is neither fetched nor rendered here.
 * `metricsSource` is shown because it is provenance of a reading (and
 * explains why some readings carry interface detail and others do not),
 * not because it is a setting anyone here can change.
 */
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Cpu,
  Gauge,
  Router as RouterIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TOOLTIP_STYLE } from "@/components/analytics/chart-theme";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceHealthHistory, useLocationDevices } from "@/hooks/useDeviceHealth";
import {
  formatMbps,
  formatOctets,
  isTunnelInterfaceName,
  metricsSourceLabel,
  readingSpanLabel,
  toInterfaceSeries,
} from "@/lib/device-health";
import type { DeviceHealthReading } from "@/types/deviceHealth";
import type { InterfaceSeries } from "@/lib/device-health";
import { cn } from "@/lib/utils";
import {
  controllerDeviceMetricsReason,
  isControllerManaged,
  routerVendorLabel,
  isNasOnlyVendor,
} from "@/lib/router-vendors";

/** Short clock label for an axis tick. */
function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function whenLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The chart tooltip is read from the shared theme, not spelled locally: the
// local copy set only a border and font size, so recharts fell back to its
// own light default box -- a white tooltip with dark text on a dark chart.
// Every other chart in this app already uses this constant; this one now
// does too. See `@/components/analytics/chart-theme`.

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center px-6 py-8 text-center">
      <p className="max-w-md text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * Health dot for the device picker. `null` health is rendered as its own
 * muted state -- never as healthy.
 */
function healthTone(status: string | null): string {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "unhealthy") return "bg-rose-500";
  return "bg-muted-foreground/40";
}

/**
 * Recharts' default `minTickGap` is 5px, so with `preserveStartEnd` a chart
 * of ~30 readings printed ~30 clock labels on top of each other. 48px keeps
 * roughly one label per ~50px of width: a handful on a phone, more on a
 * desktop, and the first and last always.
 */
const X_TICK_GAP = 48;

/** True when a port earns a full chart: it is up, or it carried traffic. */
function portIsActive(s: InterfaceSeries): boolean {
  return s.up === true || s.totalInOctets + s.totalOutOctets > 0;
}

/** One port's throughput chart. Same series, same honesty rules as before. */
function PortTrafficPanel({ series: s }: { series: InterfaceSeries }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{s.ifName}</span>
          {s.up != null && (
            <Badge
              variant="outline"
              className={cn(
                "font-normal",
                s.up
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
              )}
            >
              {s.up ? "Up" : "Down"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ArrowDownRight className="h-3.5 w-3.5 text-teal-500" />
            {formatOctets(s.totalInOctets)} in
          </span>
          <span className="flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-violet-500" />
            {formatOctets(s.totalOutOctets)} out
          </span>
        </div>
      </div>

      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={s.points.map((p) => ({
              label: timeLabel(p.at),
              down: p.downMbps,
              up: p.upMbps,
            }))}
            margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`iface-down-${s.ifIndex}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`iface-up-${s.ifIndex}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={X_TICK_GAP}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} width={38} domain={[0, "auto"]} tickLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: unknown, name: unknown) => [
                typeof value === "number" ? formatMbps(value) : "No reading",
                name === "down" ? "In" : "Out",
              ]}
            />
            {/* connectNulls={false} is load-bearing: a null point means the
                rate could not be measured (counter reset, missing reading,
                or too long a gap). Bridging it would draw a line through
                data that does not exist. */}
            <Area
              type="monotone"
              dataKey="down"
              name="down"
              stroke="#14b8a6"
              fill={`url(#iface-down-${s.ifIndex})`}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="up"
              name="up"
              stroke="#8b5cf6"
              fill={`url(#iface-up-${s.ifIndex})`}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DeviceHealthTrafficView({ locationId }: { locationId?: string }) {
  const devices = useLocationDevices(locationId);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [showAllPorts, setShowAllPorts] = useState(false);

  const deviceList = useMemo(() => devices.data ?? [], [devices.data]);
  const activeId = selectedId ?? deviceList[0]?.id;
  const activeDevice = deviceList.find((d) => d.id === activeId);

  /**
   * Contract §11.5. This whole card is CPU, memory and per-interface octet
   * counters, and all three come from a measurement path a controller has no
   * part in: the router agent's RouterOS reads and the SNMP sweep against the
   * device. `/device-health/{id}/history` for a controller row therefore
   * returns nothing, forever -- and this card rendered that as per-port
   * RouterOS charts, a model string and a "via Not recorded" provenance
   * badge, for a device the dashboard one screen away calls a TP-Link Omada
   * controller.
   *
   * The request is not made at all rather than made and explained away: it
   * cannot answer, and "no readings recorded yet" (which is what it would
   * produce) is a measurement claim -- it says we looked.
   */
  const activeIsController = isControllerManaged(activeDevice?.vendor);
  const history = useDeviceHealthHistory(activeIsController ? undefined : activeId);
  const readings: DeviceHealthReading[] = useMemo(
    () => history.data?.readings ?? [],
    [history.data],
  );

  const series = useMemo(() => toInterfaceSeries(readings), [readings]);
  const span = readingSpanLabel(readings);

  // Provenance of the most recent reading, and whether any reading at all
  // carried a per-interface breakdown.
  const latest = readings[readings.length - 1];
  // Two different absences, and they must not share a message.
  //
  // `hasRateData` asks whether a *rate* could be computed, which needs
  // two readings -- a single cumulative octet count is not a throughput.
  // `hasCounters` asks the weaker question: did any reading carry a
  // per-interface breakdown at all?
  //
  // Collapsing them tells an operator "this device isn't being measured"
  // during the window after the very first reading arrives, when it
  // demonstrably is. That window used to be permanent (nothing populated
  // these counters at all), which is why one message was once enough.
  //
  // Counted over the interfaces this screen may actually SHOW, not over every
  // interface the device reported: the management tunnel is filtered out by
  // `toInterfaceSeries` (it must never appear on a customer surface), and a
  // device whose only counter was the tunnel would otherwise satisfy this
  // check and then render an empty chart under "port traffic is being
  // measured" -- true of the device, and not of anything on this page.
  const hasCounters = readings.some((r) =>
    (r.interfaceTrafficCounters ?? []).some((c) => !isTunnelInterfaceName(c.ifName)),
  );
  const hasRateData = series.some((s) => s.points.some((p) => p.downMbps != null));

  // Same set of ports the old per-port list charted (any measurable point),
  // split by whether they are worth a chart of their own.
  const { activePorts, quietPorts } = useMemo(() => {
    const chartable = series.filter((s) =>
      s.points.some((p) => p.downMbps != null || p.upMbps != null),
    );
    return {
      activePorts: chartable.filter(portIsActive),
      quietPorts: chartable.filter((s) => !portIsActive(s)),
    };
  }, [series]);
  const portsReportingLink = series.filter((s) => s.up != null).length;
  const portsUp = series.filter((s) => s.up === true).length;

  const healthChart = useMemo(
    () =>
      readings.map((r) => ({
        label: timeLabel(r.recordedAt),
        cpu: r.cpuUsagePercent,
        memory: r.memoryUsagePercent,
      })),
    [readings],
  );

  // The single loudest fact on the page: the busiest interface and when.
  const busiest = useMemo(() => {
    let best: { name: string; mbps: number; at: string | null } | null = null;
    for (const s of series) {
      if (s.peakDownMbps != null && (best == null || s.peakDownMbps > best.mbps)) {
        best = { name: s.ifName, mbps: s.peakDownMbps, at: s.peakDownAt };
      }
    }
    return best;
  }, [series]);

  /* ── No location context (the /agent preview passes none) ── */
  if (!locationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Device health &amp; interface traffic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyNote>Pick a venue to see how its network devices have been performing.</EmptyNote>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Device health &amp; interface traffic
            </CardTitle>
            <CardDescription>
              How much traffic each network port has carried, and how your hardware has been holding
              up.
              {span ? ` Showing the last ${span} of readings.` : ""}
            </CardDescription>
          </div>

          {deviceList.length > 0 && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Select value={activeId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full sm:w-[220px]" aria-label="Choose a device">
                  <SelectValue placeholder="Choose a device" />
                </SelectTrigger>
                <SelectContent>
                  {deviceList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        {/* No health dot on a controller. The dot is a
                            verdict on a health check nothing runs here, and
                            its muted "unknown" colour reads as "we looked and
                            could not tell" rather than "nothing looks". */}
                        {!isControllerManaged(d.vendor) && (
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 shrink-0 rounded-full ${healthTone(d.healthStatus)}`}
                          />
                        )}
                        {d.name}
                        {isControllerManaged(d.vendor) && (
                          <span className="text-muted-foreground">
                            (
                            {isNasOnlyVendor(d.vendor)
                              ? `${routerVendorLabel(d.vendor)} access points`
                              : `${routerVendorLabel(d.vendor)} controller`}
                            )
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {activeDevice && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <RouterIcon className="h-3.5 w-3.5" />
              {/* Vendor label first for a controller, and never the `model`
                  column: on a synthesised controller row that column carries
                  whatever was typed at onboarding, which in production was a
                  MikroTik model string sitting under a TP-Link Omada badge. */}
              {activeIsController
                ? `${routerVendorLabel(activeDevice.vendor)} ${isNasOnlyVendor(activeDevice.vendor) ? "access points" : "controller"}`
                : activeDevice.model || activeDevice.vendor || "Network device"}
            </span>
            {/* No provenance badge either. `metricsSourceLabel(null)` renders
                "Not recorded", which is a statement about a reading; there is
                no reading here to have a source. */}
            {!activeIsController && latest && (
              <>
                <span aria-hidden="true">·</span>
                <span>Last reading {whenLabel(latest.recordedAt)}</span>
                <span aria-hidden="true">·</span>
                {/* Provenance, not configuration: it explains why some
                    readings carry per-port detail and others do not. */}
                <Badge variant="outline" className="font-normal">
                  via {metricsSourceLabel(latest.metricsSource)}
                </Badge>
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Loading / no devices / read failed ── */}
        {devices.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : devices.isError ? (
          <EmptyNote>
            We could not read this venue&apos;s devices just now, so we can&apos;t say how they are
            performing. This is a problem reading the data, not a report that anything is wrong.
          </EmptyNote>
        ) : deviceList.length === 0 ? (
          <EmptyNote>
            No network devices have been added to this venue yet. Once one is set up, its
            performance history appears here.
          </EmptyNote>
        ) : activeIsController ? (
          // Contract §11.5. Before the charts, the spinners and every
          // "no readings yet" branch below -- all of which would be saying
          // something about a measurement, and there is none to speak of.
          <EmptyNote>{controllerDeviceMetricsReason(activeDevice?.vendor)}</EmptyNote>
        ) : history.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : history.isError ? (
          <EmptyNote>
            We could not read this device&apos;s history just now. Nothing is necessarily wrong with
            the device — this is a problem fetching its readings.
          </EmptyNote>
        ) : readings.length === 0 ? (
          <EmptyNote>
            No readings recorded for this device yet. Measurements are taken automatically every few
            minutes and will appear here.
          </EmptyNote>
        ) : (
          <>
            {/* ── Peak callout: the "when did my uplink saturate" answer ── */}
            {(busiest || portsReportingLink > 0) && (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                {busiest && (
                  <div className="rounded-lg border bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Busiest port</p>
                    <p className="mt-0.5 text-sm">
                      <span className="font-medium">{busiest.name}</span> peaked at{" "}
                      <span className="font-medium">{formatMbps(busiest.mbps)}</span> incoming
                      around <span className="font-medium">{whenLabel(busiest.at)}</span>.
                    </p>
                  </div>
                )}
                {/* Counted only over ports that reported a link state; a port
                    with no `up` reading is neither up nor down. */}
                {portsReportingLink > 0 && (
                  <div className="rounded-lg border bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Ports up</p>
                    <p className="mt-0.5 text-sm">
                      <span className="font-medium tabular-nums">{portsUp}</span>
                      <span className="text-muted-foreground"> of {portsReportingLink}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Per-interface traffic ──
                Active ports get a chart each; idle and down ports collapse
                into one row of chips. Before, every port printed its own
                full chart -- on a 12-port router that was a dozen
                near-identical flat "Down · 0 B" panels to scroll past to
                find the two ports carrying traffic. Nothing is hidden: the
                chips still carry each port's status and totals, and
                "Show all ports" brings their charts back. */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Traffic by port</h3>
                {hasRateData && (
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-teal-500" />
                      In
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-violet-500" />
                      Out
                    </span>
                  </div>
                )}
              </div>

              {!hasRateData ? (
                hasCounters ? (
                  <EmptyNote>
                    Port traffic is being measured, but throughput needs two readings to compare —
                    the next one is due within a few minutes. Its overall health is below in the
                    meantime.
                  </EmptyNote>
                ) : (
                  <EmptyNote>
                    Per-port traffic isn&apos;t being measured for this device, so we can only show
                    its overall health below. Ask support if you need port-level traffic here.
                  </EmptyNote>
                )
              ) : (
                <>
                  {activePorts.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {activePorts.map((s) => (
                        <PortTrafficPanel key={`${s.ifIndex}-${s.ifName}`} series={s} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No port reported as up or carried traffic in this window.
                    </p>
                  )}

                  {quietPorts.length > 0 && (
                    <div className="space-y-3 rounded-lg border border-dashed p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {quietPorts.length} other port{quietPorts.length === 1 ? "" : "s"} carried
                          no traffic in this window
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          aria-expanded={showAllPorts}
                          aria-controls="quiet-port-charts"
                          onClick={() => setShowAllPorts((v) => !v)}
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              showAllPorts && "rotate-180",
                            )}
                          />
                          {showAllPorts ? "Hide their charts" : "Show all ports"}
                        </Button>
                      </div>
                      <ul className="flex flex-wrap gap-1.5" aria-label="Other ports">
                        {quietPorts.map((s) => (
                          <li
                            key={`${s.ifIndex}-${s.ifName}`}
                            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]"
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                s.up === false ? "bg-rose-500" : "bg-muted-foreground/40",
                              )}
                            />
                            <span className="font-medium">{s.ifName}</span>
                            {s.up != null && (
                              <span className="text-muted-foreground">{s.up ? "Up" : "Down"}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {/* Always in the DOM so `aria-controls` points at
                          something; the charts mount only when asked for. */}
                      <div
                        id="quiet-port-charts"
                        className={cn("grid gap-3 lg:grid-cols-2", !showAllPorts && "hidden")}
                      >
                        {showAllPorts &&
                          quietPorts.map((s) => (
                            <PortTrafficPanel key={`${s.ifIndex}-${s.ifName}`} series={s} />
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── Device health over time ── */}
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="h-4 w-4" /> Device load
              </h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={healthChart} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      minTickGap={X_TICK_GAP}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 10 }} width={34} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: unknown, name: unknown) => [
                        typeof value === "number" ? `${value.toFixed(0)}%` : "No reading",
                        name === "cpu" ? "Processor" : "Memory",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      name="cpu"
                      stroke="#6C4EFF"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="memory"
                      name="memory"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Cpu className="h-3 w-3" />
                Gaps mean no reading was taken, not zero usage.
              </p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default DeviceHealthTrafficView;
