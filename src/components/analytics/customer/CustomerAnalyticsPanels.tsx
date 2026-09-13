/**
 * Customer-facing analytics panels for the org-scoped Analytics pages
 * (analytics.guest/network/device/isp/executive). Each panel consumes the
 * real domain-analytics hooks (`useDomain*Analytics` →
 * `GET /analytics/{guests,network,authentication,routers}`) and renders
 * only the fields those endpoints actually return.
 *
 * The backend is deliberate about honestly-unavailable figures: an
 * unavailable metric is `null` with an `available: false` flag, never a
 * fabricated zero. This layer preserves that — a missing reading renders as
 * an em dash or a plain "not measured" note, and metrics this fleet cannot
 * produce (per-app DPI, jitter/packet-loss/SLA, PMS/social login) are not
 * charted at all rather than shown as zero.
 *
 * These are separate from the Master-Console `GuestAnalyticsPanel` etc.,
 * which consume the platform-wide snapshot shape (`AnalyticsSnapshot`); the
 * domain shapes here (`DomainGuestAnalytics` etc.) are org/location-scoped
 * aggregates and top-N breakdowns, a different contract.
 */
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatCard } from "@/components/ui-ext";
import { ChartCard } from "@/components/analytics/ChartCard";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "@/components/analytics/chart-theme";
import { formatBitrate, formatBytes, formatCount, formatPercent } from "@/lib/analytics-format";
import { formatDuration } from "@/lib/device-liveness";
import type {
  DomainAuthAnalytics,
  DomainGuestAnalytics,
  DomainNetworkAnalytics,
  DomainRouterAnalytics,
} from "@/types/analytics";

export interface PanelState {
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

/** Shared loading/error gate so every panel behaves identically. Returns
 * the fallback node to render, or null when it's safe to render real
 * content. */
function gateFallback(state: PanelState, hasData: boolean): ReactNode | null {
  if (state.isError) return <ErrorState onRetry={state.onRetry} />;
  if (state.isLoading && !hasData) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  return null;
}

/** A small note explaining a metric this platform genuinely cannot produce,
 * so the page never silently omits *why* something board-level is absent. */
function UnavailableNote({ children }: { children: ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

// ============================================================================
// Guest analytics
// ============================================================================

export function GuestInsightsPanel({
  data,
  ...state
}: { data?: DomainGuestAnalytics } & PanelState) {
  const gate = gateFallback(state, !!data);
  if (gate) return gate;

  const retention = data?.retention;
  const langs = (data?.languages.byLanguage ?? []) as {
    language?: string;
    session_count?: number;
  }[];
  const languageRows = langs
    .map((l) => ({ language: String(l.language ?? "—"), value: Number(l.session_count ?? 0) }))
    .filter((l) => l.value > 0);

  return (
    <div className="space-y-4">
      <KpiGrid>
        <StatCard label="Unique guests" value={formatCount(data?.uniqueGuests)} />
        <StatCard label="New guests" value={formatCount(data?.newGuests)} />
        <StatCard label="Returning guests" value={formatCount(data?.returningGuests)} />
        <StatCard label="Repeat visits" value={formatCount(data?.repeatVisits)} />
        <StatCard
          label="Avg session length"
          value={
            data?.averageSessionDurationSeconds != null
              ? formatDuration(data.averageSessionDurationSeconds)
              : "—"
          }
        />
        <StatCard label="Avg data / guest" value={formatBytes(data?.averageDataUsageBytes)} />
        <StatCard
          label="Guest retention"
          value={retention?.available ? formatPercent(retention.retentionRatePercent) : "—"}
          hint={
            retention?.available
              ? `vs. previous ${retention.periodDays} days`
              : "Not enough history in the previous period"
          }
        />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Top locations by sessions" isEmpty={!data?.topLocations.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topLocations ?? []} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeOpacity={0.15} horizontal={false} />
              <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="locationName"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="sessionCount" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Languages"
          description="Primary language of guest devices"
          isEmpty={!languageRows.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={languageRows}
                dataKey="value"
                nameKey="language"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {languageRows.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Top device (MAC)</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Unique guests</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.topDevices ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      No device data for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.topDevices.map((d) => (
                    <TableRow key={d.macAddress}>
                      <TableCell className="font-mono text-xs">{d.macAddress}</TableCell>
                      <TableCell className="text-right">{formatCount(d.sessionCount)}</TableCell>
                      <TableCell className="text-right">
                        {formatCount(d.uniqueGuestCount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Network analytics
// ============================================================================

export function NetworkInsightsPanel({
  data,
  ...state
}: { data?: DomainNetworkAnalytics } & PanelState) {
  const gate = gateFallback(state, !!data);
  if (gate) return gate;

  const avail = data?.networkAvailability;
  return (
    <div className="space-y-4">
      <KpiGrid>
        <StatCard label="Total data" value={formatBytes(data?.totalBytes)} highlight />
        <StatCard label="Downloaded" value={formatBytes(data?.downloadBytes)} />
        <StatCard label="Uploaded" value={formatBytes(data?.uploadBytes)} />
        <StatCard label="Avg speed" value={formatBitrate(data?.averageSpeedBytesPerSecond)} />
        <StatCard
          label="Peak (busiest day)"
          value={data?.peakBandwidth.available ? formatBytes(data.peakBandwidth.peakBytes) : "—"}
          hint={
            data?.peakBandwidth.available
              ? "Bytes moved in the busiest daily rollup"
              : "No daily rollup history yet"
          }
        />
        <StatCard
          label="Router availability"
          value={formatPercent(avail?.availabilityPercent)}
          hint={
            avail
              ? `${avail.availableRouterCount}/${avail.totalRouterCount} routers online`
              : undefined
          }
        />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Top data consumers"
          description="Guests by total data used"
          isEmpty={!data?.topConsumers.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topConsumers ?? []} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeOpacity={0.15} horizontal={false} />
              <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="identifier"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number | string) => formatBytes(Number(value))}
              />
              <Bar dataKey="totalBytes" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top routers by traffic" isEmpty={!data?.topRouters.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topRouters ?? []} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeOpacity={0.15} horizontal={false} />
              <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="routerName"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number | string) => formatBytes(Number(value))}
              />
              <Bar dataKey="totalBytes" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <UnavailableNote>
        Per-application (DPI) traffic breakdown isn&apos;t available: this fleet has no
        deep-packet-inspection source, so it is not shown rather than estimated.
      </UnavailableNote>
    </div>
  );
}

// ============================================================================
// Device analytics (from the guest endpoint's device breakdown)
// ============================================================================

function DeviceDonut({
  title,
  items,
}: {
  title: string;
  items: { label: string; sessionCount: number }[];
}) {
  const rows = items.filter((i) => i.sessionCount > 0);
  return (
    <ChartCard title={title} isEmpty={!rows.length}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="sessionCount"
            nameKey="label"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={2}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DeviceInsightsPanel({
  data,
  ...state
}: { data?: DomainGuestAnalytics } & PanelState) {
  const gate = gateFallback(state, !!data);
  if (gate) return gate;

  const devices = data?.devices;
  const coverage =
    devices && devices.sessionsTotal > 0
      ? (devices.sessionsWithData / devices.sessionsTotal) * 100
      : null;

  return (
    <div className="space-y-4">
      <KpiGrid>
        <StatCard label="Sessions" value={formatCount(devices?.sessionsTotal)} />
        <StatCard
          label="With device data"
          value={formatCount(devices?.sessionsWithData)}
          hint="Sessions that reported a user-agent"
        />
        <StatCard label="Coverage" value={formatPercent(coverage)} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <DeviceDonut title="Operating systems" items={devices?.byOs ?? []} />
        <DeviceDonut title="Browsers" items={devices?.byBrowser ?? []} />
        <DeviceDonut title="Device types" items={devices?.byDeviceType ?? []} />
      </div>

      <UnavailableNote>
        Device mix is classified from the browser user-agent each guest session reported; sessions
        without one are excluded from the breakdown. Hardware vendor/model isn&apos;t captured on
        this path, so it isn&apos;t shown.
      </UnavailableNote>
    </div>
  );
}

// ============================================================================
// ISP analytics (uplink reachability, from network + router analytics)
// ============================================================================

export function IspInsightsPanel({
  network,
  routers,
  ...state
}: {
  network?: DomainNetworkAnalytics;
  routers?: DomainRouterAnalytics;
} & PanelState) {
  const gate = gateFallback(state, !!network || !!routers);
  if (gate) return gate;

  const avail = network?.networkAvailability;
  const routerRows = routers?.routers ?? [];

  return (
    <div className="space-y-4">
      <KpiGrid>
        <StatCard
          label="Uplink availability"
          value={formatPercent(avail?.availabilityPercent)}
          hint="Routers reporting internet reachable"
          highlight
        />
        <StatCard label="Routers online" value={formatCount(avail?.availableRouterCount)} />
        <StatCard label="Total routers" value={formatCount(avail?.totalRouterCount)} />
        <StatCard label="Total data moved" value={formatBytes(network?.totalBytes)} />
      </KpiGrid>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Router</TableHead>
                  <TableHead>Internet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routerRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No routers in scope.
                    </TableCell>
                  </TableRow>
                ) : (
                  routerRows.map((r) => (
                    <TableRow key={r.routerId}>
                      <TableCell>{r.routerName}</TableCell>
                      <TableCell>{r.internetAvailable ? "Reachable" : "Unreachable"}</TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                      <TableCell className="text-right">
                        {formatBytes(r.bandwidthTotalBytes)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UnavailableNote>
        Uplink quality metrics (jitter, packet loss, latency and per-ISP SLA) aren&apos;t measured
        on this fleet — the routers expose no such probe — so this page reports internet
        reachability and traffic rather than fabricating link-quality numbers.
      </UnavailableNote>
    </div>
  );
}

// ============================================================================
// Executive summary (guest + network + auth)
// ============================================================================

export function ExecutiveInsightsPanel({
  guests,
  network,
  auth,
  ...state
}: {
  guests?: DomainGuestAnalytics;
  network?: DomainNetworkAnalytics;
  auth?: DomainAuthAnalytics;
} & PanelState) {
  const gate = gateFallback(state, !!guests || !!network || !!auth);
  if (gate) return gate;

  const authTotal = auth ? auth.successTotal + auth.failureTotal : 0;
  const authSuccessRate = authTotal > 0 ? (auth!.successTotal / authTotal) * 100 : null;

  return (
    <div className="space-y-4">
      <KpiGrid>
        <StatCard label="Unique guests" value={formatCount(guests?.uniqueGuests)} highlight />
        <StatCard label="Total data" value={formatBytes(network?.totalBytes)} />
        <StatCard
          label="Uplink availability"
          value={formatPercent(network?.networkAvailability.availabilityPercent)}
        />
        <StatCard
          label="Login success rate"
          value={formatPercent(authSuccessRate)}
          hint={authTotal > 0 ? `${formatCount(authTotal)} attempts` : "No attempts in window"}
        />
      </KpiGrid>

      <ChartCard
        title="Authentication trend"
        description="Successful vs failed logins per day"
        isEmpty={!auth?.trends.length}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={auth?.trends ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="successCount"
              name="Success"
              stroke={CHART_COLORS[1]}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="failureCount"
              name="Failed"
              stroke={CHART_COLORS[4]}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <UnavailableNote>
        Revenue and NPS aren&apos;t part of the customer analytics endpoints, so this executive view
        summarises the guest, network and authentication figures the platform actually measures
        rather than board metrics it doesn&apos;t hold.
      </UnavailableNote>
    </div>
  );
}
