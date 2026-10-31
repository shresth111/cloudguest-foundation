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
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  Cpu,
  Gauge,
  Router as RouterIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "@/components/customer/console";
import {
  CONSOLE_TOOLTIP_STYLE,
  PanelTitle,
  StatusDot,
} from "@/components/customer/dashboard/overview/console-ui";
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
import { SHOW_ROUTER_TRAFFIC_EVENT } from "@/components/customer/devices/fleet-model";

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

// The chart tooltip is the console's shared one (CONSOLE_TOOLTIP_STYLE), the
// same box the Overview charts use, so light/dark and the border match.

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center px-6 py-8 text-center">
      <p className="max-w-md text-xs leading-relaxed text-[var(--wy-text-muted)]">{children}</p>
    </div>
  );
}

/**
 * Health dot for the device picker. `null` health is rendered as its own
 * neutral state -- never as healthy.
 */
function healthStatus(status: string | null): "ok" | "crit" | "unknown" {
  if (status === "healthy") return "ok";
  if (status === "unhealthy") return "crit";
  return "unknown";
}

/**
 * Recharts' default `minTickGap` is 5px, so with `preserveStartEnd` a chart
 * of ~30 readings printed ~30 clock labels on top of each other. 48px keeps
 * roughly one label per ~50px of width: a handful on a phone, more on a
 * desktop, and the first and last always.
 */
const X_TICK_GAP = 48;

/** True when a port earns attention: it is up, or it carried traffic. */
function portIsActive(s: InterfaceSeries): boolean {
  return s.up === true || s.totalInOctets + s.totalOutOctets > 0;
}

const SERIES_1 = "var(--wy-series-1)";
const SERIES_2 = "var(--wy-series-2)";

/** A legend entry that is also the series' on/off switch. */
function LegendToggle({
  color,
  label,
  value,
  on,
  onToggle,
}: {
  color: string;
  label: string;
  value?: ReactNode;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-[var(--wy-radius)] px-1.5 text-[11px] transition-opacity duration-150 hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] motion-reduce:transition-none",
        !on && "opacity-45",
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: on ? color : "transparent", boxShadow: `inset 0 0 0 1.5px ${color}` }}
      />
      <span className="text-[var(--wy-text-muted)]">{label}</span>
      {value != null && <span className="tabular-nums text-[var(--wy-text)]">{value}</span>}
    </button>
  );
}

function axisProps() {
  return {
    tick: { fontSize: 10, fill: "var(--wy-text-faint)" },
    tickLine: false,
  } as const;
}

/** One port's throughput: In/Out areas, a dashed crosshair and tooltip. */
function PortTrafficChart({
  series: s,
  showIn,
  showOut,
}: {
  series: InterfaceSeries;
  showIn: boolean;
  showOut: boolean;
}) {
  const gid = `p${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const data = useMemo(
    () =>
      s.points.map((p, i) => ({
        i,
        label: timeLabel(p.at),
        down: p.downMbps,
        up: p.upMbps,
      })),
    [s.points],
  );
  return (
    <div
      className="h-52 sm:h-56"
      data-wy="port-chart"
      role="img"
      aria-label={`Traffic on ${s.ifName}: peak in ${formatMbps(s.peakDownMbps)}, peak out ${formatMbps(s.peakUpMbps)}; ${formatOctets(s.totalInOctets)} in, ${formatOctets(s.totalOutOctets)} out in this window.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id={`${gid}-in`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES_1} stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id={`${gid}-out`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_2} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES_2} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--wy-border)" />
          <XAxis
            dataKey="i"
            type="category"
            tickFormatter={(i: number) => data[i]?.label ?? ""}
            interval="preserveStartEnd"
            minTickGap={X_TICK_GAP}
            axisLine={{ stroke: "var(--wy-border)" }}
            {...axisProps()}
          />
          <YAxis
            width={36}
            domain={[0, "auto"]}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 10 || v === 0 ? v.toFixed(0) : v.toFixed(1))}
            {...axisProps()}
          />
          <Tooltip
            contentStyle={CONSOLE_TOOLTIP_STYLE}
            cursor={{ stroke: "var(--wy-border-strong)", strokeDasharray: "3 3" }}
            labelFormatter={(i: number) => data[i]?.label ?? ""}
            formatter={(value: unknown, name: unknown) => [
              typeof value === "number" ? formatMbps(value) : "No reading",
              name === "down" ? "In" : "Out",
            ]}
          />
          {/* connectNulls={false} is load-bearing: a null point means the
              rate could not be measured (counter reset, missing reading,
              or too long a gap). Bridging it would draw a line through
              data that does not exist. */}
          {showIn && (
            <Area
              type="monotone"
              dataKey="down"
              name="down"
              stroke={SERIES_1}
              fill={`url(#${gid}-in)`}
              strokeWidth={2}
              connectNulls={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--wy-surface)" }}
              isAnimationActive={false}
            />
          )}
          {showOut && (
            <Area
              type="monotone"
              dataKey="up"
              name="up"
              stroke={SERIES_2}
              fill={`url(#${gid}-out)`}
              strokeWidth={2}
              connectNulls={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--wy-surface)" }}
              isAnimationActive={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The port selector: one chip per port, busiest-looking first, each with
 * its link state and totals. A radiogroup (arrow keys move the choice). No
 * port is hidden: idle and down ports sit at the end, dimmed, still
 * selectable -- this replaces the old "Show all ports" disclosure.
 */
function PortSelector({
  ports,
  value,
  onChange,
}: {
  ports: InterfaceSeries[];
  value: string;
  onChange: (key: string) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const keyOf = (s: InterfaceSeries) => `${s.ifIndex}-${s.ifName}`;
  const onKey = (e: KeyboardEvent) => {
    const i = ports.findIndex((p) => keyOf(p) === value);
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || i < 0) return;
    e.preventDefault();
    const next = (i + step + ports.length) % ports.length;
    onChange(keyOf(ports[next]));
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Port"
      onKeyDown={onKey}
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]"
    >
      {ports.map((s, idx) => {
        const selected = keyOf(s) === value;
        const active = portIsActive(s);
        return (
          <button
            key={keyOf(s)}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(keyOf(s))}
            className={cn(
              "flex min-w-[7.5rem] shrink-0 flex-col items-start gap-0.5 rounded-[var(--wy-radius)] border px-2.5 py-1.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] motion-reduce:transition-none",
              selected
                ? "border-[var(--wy-accent)] bg-[var(--wy-accent-soft)]"
                : "border-[var(--wy-border)] bg-[var(--wy-surface)] hover:border-[var(--wy-border-strong)]",
              !active && !selected && "opacity-70",
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--wy-text)]">
              {/* A port with no `up` reading is neither up nor down. */}
              <StatusDot
                status={s.up === true ? "ok" : s.up === false ? "crit" : "unknown"}
                label={
                  s.up === true ? "Link up" : s.up === false ? "Link down" : "Link not reported"
                }
              />
              <span className="font-[family-name:var(--wy-font-mono)]">{s.ifName}</span>
            </span>
            <span className="text-[10px] tabular-nums text-[var(--wy-text-faint)]">
              {active
                ? `${formatOctets(s.totalInOctets)} in · ${formatOctets(s.totalOutOctets)} out`
                : s.up === false
                  ? "Down · no traffic"
                  : "No traffic"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-3 py-2">
      <p className="text-[11px] font-medium text-[var(--wy-text-muted)]">{label}</p>
      <div className="mt-0.5 text-[13px] text-[var(--wy-text)]">{children}</div>
    </div>
  );
}

export function DeviceHealthTrafficView({ locationId }: { locationId?: string }) {
  const devices = useLocationDevices(locationId);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [portKey, setPortKey] = useState<string | null>(null);
  const [showIn, setShowIn] = useState(true);
  const [showOut, setShowOut] = useState(true);
  const [showCpu, setShowCpu] = useState(true);
  const [showMem, setShowMem] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  // Validated, not trusted: a wrong-shaped body renders as "no devices", not
  // a crash.
  const deviceList = useMemo(
    () => (Array.isArray(devices.data) ? devices.data : []),
    [devices.data],
  );
  const activeId = selectedId ?? deviceList[0]?.id;
  const activeDevice = deviceList.find((d) => d.id === activeId);

  // The inventory drawer's "Traffic and load" on a router row lands here.
  useEffect(() => {
    const onShow = (e: Event) => {
      const id = (e as CustomEvent<{ routerId?: string }>).detail?.routerId;
      if (!id) return;
      setSelectedId(id);
      setPortKey(null);
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    };
    window.addEventListener(SHOW_ROUTER_TRAFFIC_EVENT, onShow);
    return () => window.removeEventListener(SHOW_ROUTER_TRAFFIC_EVENT, onShow);
  }, []);

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
    () => (Array.isArray(history.data?.readings) ? history.data.readings : []),
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

  // Every port with any measurable point, ports that are up or carried
  // traffic first (busiest first), then the idle and down ones.
  const ports = useMemo(() => {
    const chartable = series.filter((s) =>
      s.points.some((p) => p.downMbps != null || p.upMbps != null),
    );
    // Busiest by peak incoming rate -- the same measure as the "Busiest
    // port" callout, so the chart opens on the port the callout names.
    const peak = (s: InterfaceSeries) => s.peakDownMbps ?? -1;
    return [
      ...chartable.filter(portIsActive).sort((a, b) => peak(b) - peak(a)),
      ...chartable.filter((s) => !portIsActive(s)),
    ];
  }, [series]);
  const quietCount = ports.filter((s) => !portIsActive(s)).length;
  const selectedPort =
    ports.find((s) => `${s.ifIndex}-${s.ifName}` === portKey) ?? ports[0] ?? null;
  const portsReportingLink = series.filter((s) => s.up != null).length;
  const portsUp = series.filter((s) => s.up === true).length;

  const healthChart = useMemo(
    () =>
      readings.map((r, i) => ({
        i,
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

  const title = <PanelTitle icon={<Activity />}>Device health &amp; interface traffic</PanelTitle>;

  /* ── No location context (the /agent preview passes none) ── */
  if (!locationId) {
    return (
      <Panel title={title}>
        <EmptyNote>Pick a venue to see how its network devices have been performing.</EmptyNote>
      </Panel>
    );
  }

  return (
    <div ref={rootRef} className="scroll-mt-20" data-wy="traffic-panel">
      <Panel
        title={title}
        description={
          <>
            How much traffic each network port has carried, and how your hardware has been holding
            up.
            {span ? ` Showing the last ${span} of readings.` : ""}
          </>
        }
        bodyClassName="space-y-5"
      >
        {/* Device picker + what the readings are from. In the body, not the
            panel header, so the title and picker both fit at 390px. */}
        {(deviceList.length > 0 || activeDevice) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {activeDevice ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--wy-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <RouterIcon aria-hidden className="h-3.5 w-3.5 text-[var(--wy-text-faint)]" />
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
                    <span className="rounded-full border border-[var(--wy-border)] px-2 py-0.5 text-[11px]">
                      via {metricsSourceLabel(latest.metricsSource)}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span />
            )}
            {deviceList.length > 0 && (
              <Select
                value={activeId}
                onValueChange={(v) => {
                  setSelectedId(v);
                  setPortKey(null);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-[240px] text-[13px]"
                  aria-label="Choose a device"
                >
                  <SelectValue placeholder="Choose a device" />
                </SelectTrigger>
                <SelectContent className="wy-console">
                  {deviceList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        {/* No health dot on a controller. The dot is a
                            verdict on a health check nothing runs here, and
                            its neutral "unknown" colour reads as "we looked and
                            could not tell" rather than "nothing looks". */}
                        {!isControllerManaged(d.vendor) && (
                          <StatusDot status={healthStatus(d.healthStatus)} />
                        )}
                        {d.name}
                        {isControllerManaged(d.vendor) && (
                          <span className="text-[var(--wy-text-faint)]">
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
            )}
          </div>
        )}

        {/* ── Loading / no devices / read failed ── */}
        {devices.isLoading ? (
          <Skeleton className="h-48 w-full bg-[var(--wy-surface-2)]" />
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
          <Skeleton className="h-48 w-full bg-[var(--wy-surface-2)]" />
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
            {/* ── The "when did my uplink saturate" answer ── */}
            {(busiest || portsReportingLink > 0) && (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                {busiest && (
                  <Tile label="Busiest port">
                    <span className="font-medium font-[family-name:var(--wy-font-mono)]">
                      {busiest.name}
                    </span>{" "}
                    peaked at{" "}
                    <span className="font-semibold tabular-nums">{formatMbps(busiest.mbps)}</span>{" "}
                    incoming around <span className="font-medium">{whenLabel(busiest.at)}</span>.
                  </Tile>
                )}
                {/* Counted only over ports that reported a link state; a port
                    with no `up` reading is neither up nor down. */}
                {portsReportingLink > 0 && (
                  <Tile label="Ports up">
                    <span className="font-semibold tabular-nums">{portsUp}</span>
                    <span className="text-[var(--wy-text-muted)]"> of {portsReportingLink}</span>
                  </Tile>
                )}
              </div>
            )}

            {/* ── Per-interface traffic: pick a port, read its chart ── */}
            <section className="space-y-3" aria-labelledby="traffic-by-port">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="traffic-by-port" className="text-xs font-semibold">
                  Traffic by port
                </h3>
                {hasRateData && selectedPort && (
                  <div className="flex items-center gap-1" role="group" aria-label="Series">
                    <LegendToggle
                      color={SERIES_1}
                      label="In"
                      value={
                        <span className="inline-flex items-center gap-0.5">
                          <ArrowDownRight
                            aria-hidden
                            className="h-3 w-3 text-[var(--wy-text-faint)]"
                          />
                          {formatOctets(selectedPort.totalInOctets)}
                        </span>
                      }
                      on={showIn}
                      onToggle={() => setShowIn((v) => !v || !showOut)}
                    />
                    <LegendToggle
                      color={SERIES_2}
                      label="Out"
                      value={
                        <span className="inline-flex items-center gap-0.5">
                          <ArrowUpRight
                            aria-hidden
                            className="h-3 w-3 text-[var(--wy-text-faint)]"
                          />
                          {formatOctets(selectedPort.totalOutOctets)}
                        </span>
                      }
                      on={showOut}
                      onToggle={() => setShowOut((v) => !v || !showIn)}
                    />
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
              ) : ports.length === 0 || !selectedPort ? (
                <p className="text-xs text-[var(--wy-text-muted)]">
                  No port reported as up or carried traffic in this window.
                </p>
              ) : (
                <>
                  <PortSelector
                    ports={ports}
                    value={`${selectedPort.ifIndex}-${selectedPort.ifName}`}
                    onChange={setPortKey}
                  />
                  {quietCount > 0 && (
                    <p className="text-[11px] text-[var(--wy-text-faint)]">
                      {quietCount} other port{quietCount === 1 ? "" : "s"} carried no traffic in
                      this window; they are listed last.
                    </p>
                  )}
                  <PortTrafficChart series={selectedPort} showIn={showIn} showOut={showOut} />
                  <p className="text-[11px] text-[var(--wy-text-faint)]">
                    In Mbps. Gaps mean no rate could be measured (a missed reading or the device
                    restarting), not zero traffic.
                  </p>
                </>
              )}
            </section>

            {/* ── Device health over time ── */}
            <section
              className="space-y-2 border-t border-[var(--wy-border)] pt-4"
              aria-labelledby="device-load"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="device-load" className="flex items-center gap-2 text-xs font-semibold">
                  <Gauge aria-hidden className="h-3.5 w-3.5 text-[var(--wy-text-faint)]" /> Device
                  load
                </h3>
                <div className="flex items-center gap-1" role="group" aria-label="Series">
                  <LegendToggle
                    color={SERIES_1}
                    label="Processor"
                    value={
                      latest?.cpuUsagePercent != null
                        ? `${latest.cpuUsagePercent.toFixed(0)}%`
                        : undefined
                    }
                    on={showCpu}
                    onToggle={() => setShowCpu((v) => !v || !showMem)}
                  />
                  <LegendToggle
                    color={SERIES_2}
                    label="Memory"
                    value={
                      latest?.memoryUsagePercent != null
                        ? `${latest.memoryUsagePercent.toFixed(0)}%`
                        : undefined
                    }
                    on={showMem}
                    onToggle={() => setShowMem((v) => !v || !showCpu)}
                  />
                </div>
              </div>
              <div
                className="h-40"
                role="img"
                aria-label={`Processor and memory use over the last ${span ?? "readings"}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={healthChart} margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--wy-border)" />
                    <XAxis
                      dataKey="i"
                      type="category"
                      tickFormatter={(i: number) => healthChart[i]?.label ?? ""}
                      interval="preserveStartEnd"
                      minTickGap={X_TICK_GAP}
                      axisLine={{ stroke: "var(--wy-border)" }}
                      {...axisProps()}
                    />
                    <YAxis
                      width={44}
                      domain={[0, 100]}
                      unit="%"
                      axisLine={false}
                      {...axisProps()}
                    />
                    <Tooltip
                      contentStyle={CONSOLE_TOOLTIP_STYLE}
                      cursor={{ stroke: "var(--wy-border-strong)", strokeDasharray: "3 3" }}
                      labelFormatter={(i: number) => healthChart[i]?.label ?? ""}
                      formatter={(value: unknown, name: unknown) => [
                        typeof value === "number" ? `${value.toFixed(0)}%` : "No reading",
                        name === "cpu" ? "Processor" : "Memory",
                      ]}
                    />
                    {showCpu && (
                      <Line
                        type="monotone"
                        dataKey="cpu"
                        name="cpu"
                        stroke={SERIES_1}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--wy-surface)" }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    )}
                    {showMem && (
                      <Line
                        type="monotone"
                        dataKey="memory"
                        name="memory"
                        stroke={SERIES_2}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--wy-surface)" }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--wy-text-faint)]">
                <Cpu aria-hidden className="h-3 w-3" />
                Gaps mean no reading was taken, not zero usage.
              </p>
            </section>
          </>
        )}
      </Panel>
    </div>
  );
}

export default DeviceHealthTrafficView;
