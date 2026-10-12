import { Suspense, lazy, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, Clock, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/ui-ext";
import { useFeatureEntitled, useIsDemo } from "@/hooks/useCustomerDashboard";
import { useSupportRequest } from "@/hooks/useMarketing";
import { useTrafficLensStatus, useTrafficLensSummary } from "@/hooks/useTrafficLens";
import { requestErrorMessage } from "@/services/api";
import { lensRefusal } from "@/services/traffic-lens.service";
import {
  NOT_MEASURED,
  atLeast,
  flowBytes,
  isLowerBound,
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
} from "@/lib/traffic-lens-shared";
import {
  LENS_DEFAULT_RANGE,
  LENS_ENABLE_SUBJECT,
  LENS_LOCKED_POINTS,
  LENS_NOTICES,
  LENS_PRESETS,
  LENS_SERIES_COLORS,
  LENS_SWITCH_ON_SUBJECT,
  LENS_TAGLINE,
  LENS_VIEWS,
  TRAFFIC_LENS_NAME,
  lensDestinationsState,
  lensDeviceLabel,
  lensFreshness,
  lensLowerBoundNote,
  lensNotMeasured,
  lensRangeBounds,
  lensScreen,
  lensStoppedNotice,
  type LensNotice,
  type LensRange,
} from "@/lib/traffic-lens-customer";
import {
  TIMELINE_CHART_H,
  type TimelineMode,
} from "@/components/traffic-lens/TrafficLensTimelineChart";
import {
  TrafficLensDestinations,
  TrafficLensServiceDestinations,
} from "@/components/traffic-lens/TrafficLensDestinations";
import {
  FLOW_RETENTION_DAYS,
  customRangeFromInputs,
  rangeLabel,
  serviceFromKey,
  toLocalInput,
} from "@/lib/traffic-flow-destinations";
import { TRAFFIC_LENS_FEATURE_KEY } from "@/types/traffic-lens";

// recharts stays behind a dynamic import, as on every other chart screen.
const TrafficLensTimelineChart = lazy(() =>
  import("@/components/traffic-lens/TrafficLensTimelineChart").then((m) => ({
    default: m.TrafficLensTimelineChart,
  })),
);

type LensViewId = (typeof LENS_VIEWS)[number]["id"];

/**
 * Customer dashboard -> Network -> Traffic Lens, for the selected venue.
 * Read-only: there is no switch here, and nothing to configure.
 *
 * Which screen shows is decided by `lensScreen` from what the backend said:
 * the add-on is not enabled (the lock screen, like Guest Messaging's), the
 * venue is not switched on yet, its equipment cannot report this, the
 * request failed, or there is data. With data, a period that holds nothing
 * reads "Not measured for this period" -- never a row of zeros.
 *
 * Services are the main block: share and rate per service, a stacked
 * timeline, and the protocol breakdown. A service is a protocol and a port
 * with the port's standard name; nothing here names an app or a site.
 *
 * Top devices and top destinations are two SEPARATE lists. A device is
 * never shown beside a destination or a service and there is nothing to
 * click through. A device is its local address plus whether it was a guest
 * login; the guest's details stay in Guest Connection Records.
 *
 * Built to take more views: the page is a list of views (`LENS_VIEWS`) that
 * share one venue and one range, and the range is one control
 * (`LensRangeControl`) over one type (`LensRange`).
 */
export function TrafficLensView({ locationId }: { locationId: string }) {
  const demo = useIsDemo();
  const entitled = useFeatureEntitled(TRAFFIC_LENS_FEATURE_KEY);
  const [range, setRange] = useState<LensRange>(LENS_DEFAULT_RANGE);
  const [view, setView] = useState<LensViewId>(LENS_VIEWS[0].id);
  const [at, setAt] = useState(() => Date.now());
  // `/me/entitlements` saying "off" spares a request that will only 402.
  const status = useTrafficLensStatus(locationId, !demo && entitled !== false);
  const screen = lensScreen({
    demo,
    entitled,
    statusLoading: status.isLoading,
    statusRefusal: lensRefusal(status.error),
    statusFailed: status.isError && lensRefusal(status.error) === null,
    status: status.data,
  });
  const summary = useTrafficLensSummary(locationId, range, at, screen.kind === "data");
  const now = Date.now();

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted-foreground">{LENS_TAGLINE}</p>

      {screen.kind === "locked" ? (
        <LockedScreen />
      ) : screen.kind === "loading" ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : screen.kind !== "data" ? (
        <NoticeCard
          notice={LENS_NOTICES[screen.kind]}
          action={
            screen.kind === "failed" ? (
              <Button variant="outline" size="sm" onClick={() => void status.refetch()}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {LENS_VIEWS.length > 1 && (
                <Tabs value={view} onValueChange={(v) => setView(v as LensViewId)}>
                  <TabsList>
                    {LENS_VIEWS.map((v) => (
                      <TabsTrigger key={v.id} value={v.id}>
                        {v.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
              <LensRangeControl
                value={range}
                onChange={(r) => {
                  setAt(Date.now());
                  setRange(r);
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {lensFreshness(summary.data?.latest_data ?? status.data?.latest_data, now)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAt(Date.now());
                  void status.refetch();
                }}
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>

          {(() => {
            const stopped = lensStoppedNotice(
              screen.stopped,
              summary.data?.latest_data ?? status.data?.latest_data,
              now,
            );
            return stopped ? <NoticeCard notice={stopped} tone="warning" /> : null;
          })()}

          {view === "overview" && (
            <OverviewView
              query={summary}
              rangeMs={lensRangeBounds(range, at).ms}
              now={now}
              onRetry={() => setAt(Date.now())}
              locationId={locationId}
              bounds={lensRangeBounds(range, at)}
            />
          )}
          {view === "destinations" && (
            <TrafficLensDestinations
              locationId={locationId}
              rangeAt={(moment) => lensRangeBounds(range, moment)}
            />
          )}

          <p className="text-[11px] text-muted-foreground">
            Figures come from traffic records and are kept for {status.data?.retention_days ?? 7}{" "}
            days. They are not your billing figure; Guest Connection Records remain the per-guest
            record. For the internet line's speed over time, see{" "}
            <Link to="/isp-details" className="font-medium text-primary hover:underline">
              Internet Connection
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

/** The one place the period is chosen. A custom start and end is added
 * here (and as a `LensRange` kind), nowhere else. */
function LensRangeControl({
  value,
  onChange,
}: {
  value: LensRange;
  onChange: (next: LensRange) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const earliest = toLocalInput(Date.now() - FLOW_RETENTION_DAYS * 86_400_000);

  const apply = () => {
    const result = customRangeFromInputs(since, until, Date.now());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setEditing(false);
    onChange({ kind: "custom", ...result.range });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={editing || value.kind === "custom" ? "custom" : value.window}
        onValueChange={(v) => {
          setError(null);
          if (v === "custom") {
            // Opens on the period already in use, or the last hour.
            const now = Date.now();
            const custom = value.kind === "custom" ? value : null;
            setSince(toLocalInput(custom ? Date.parse(custom.since) : now - 3_600_000));
            setUntil(toLocalInput(custom ? Date.parse(custom.until) : now));
            setEditing(true);
            return;
          }
          const preset = LENS_PRESETS.find((p) => p.value === v);
          if (preset) {
            setEditing(false);
            onChange({ kind: "preset", window: preset.value });
          }
        }}
      >
        <TabsList aria-label="Period">
          {LENS_PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>
              {p.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>
      {value.kind === "custom" && !editing && (
        <span className="text-xs text-muted-foreground">{rangeLabel(value)}</span>
      )}
      {editing && (
        <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
          <label className="block w-52 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input
              type="datetime-local"
              value={since}
              min={earliest}
              max={toLocalInput(Date.now())}
              onChange={(e) => setSince(e.target.value)}
            />
          </label>
          <label className="block w-52 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input
              type="datetime-local"
              value={until}
              min={earliest}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          <Button size="sm" onClick={apply}>
            Use this period
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <p className="w-full text-[11px] text-muted-foreground">
            Your local time, to the minute. Figures are kept for {FLOW_RETENTION_DAYS} days, and a
            period may be at most {FLOW_RETENTION_DAYS} days long. Figures are per five-minute
            window, so a period covers the windows that start inside it.
          </p>
          {error && (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The Overview view: totals, services, devices, destinations. */
function OverviewView({
  query,
  rangeMs,
  now,
  onRetry,
  locationId,
  bounds,
}: {
  query: ReturnType<typeof useTrafficLensSummary>;
  rangeMs: number;
  now: number;
  onRetry: () => void;
  locationId: string;
  /** The period on screen, for the drill-down from a service. */
  bounds: { since: string; until: string };
}) {
  const [mode, setMode] = useState<TimelineMode>("service");
  /** The service row whose destinations are open, and for which period. */
  const [opened, setOpened] = useState<{ key: string; label: string; period: string } | null>(null);
  const period = `${bounds.since}|${bounds.until}`;
  const open = opened && opened.period === period ? opened : null;
  const s = query.data;
  const slots = useMemo(() => timelineSlots(s), [s]);

  if (query.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  if (query.isError || !s) {
    const refusal = lensRefusal(query.error);
    return (
      <NoticeCard
        notice={
          refusal === "forbidden"
            ? LENS_NOTICES.forbidden
            : refusal === "licence"
              ? LENS_NOTICES.licence
              : LENS_NOTICES.failed
        }
        action={
          refusal === null ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          ) : undefined
        }
      />
    );
  }

  const totals = totalsView(s);
  if (!totals.measured) return <NoticeCard notice={lensNotMeasured(s.data_oldest, now)} />;

  const services = servicesView(s);
  const protocols = protocolRows(s);
  const gapNote = timelineGapNote(slots);
  const noServiceSteps = slots.filter((x) => x.measured && !x.servicesMeasured).length;
  const devicesLb = isLowerBound(s, "devices");
  const destLb = isLowerBound(s, "destinations");
  const dest = lensDestinationsState(s.destinations, s.windows);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Download"
          value={totals.download}
          hint={`average ${totals.downloadRate}`}
          icon={ArrowDown}
        />
        <StatCard
          label="Upload"
          value={totals.upload}
          hint={`average ${totals.uploadRate}`}
          icon={ArrowUp}
        />
        <StatCard
          label="Devices at once"
          value={totals.devicesPeakCount}
          hint="most at any one time, not a total"
        />
        <StatCard
          label="Outside addresses at once"
          value={totals.destinationsPeakCount}
          hint="most at any one time, not a total"
        />
      </div>

      <Section
        title="Services"
        note="A service is a kind of traffic identified by its protocol and port, with the port's standard name where it has one. It is not an app or a website: nothing looks inside the traffic."
        actions={
          <Tabs value={mode} onValueChange={(v) => setMode(v as TimelineMode)}>
            <TabsList>
              <TabsTrigger value="service">By service</TabsTrigger>
              <TabsTrigger value="direction">Download / upload</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <Suspense fallback={<div style={{ height: TIMELINE_CHART_H }} />}>
          <TrafficLensTimelineChart
            slots={slots}
            series={s.timeline?.series ?? []}
            mode={mode}
            rangeMs={rangeMs}
            colors={LENS_SERIES_COLORS}
          />
        </Suspense>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Speed over time, {stepLabel(s.step_seconds)}.{gapNote ? ` ${gapNote}` : ""}
          {mode === "service" && noServiceSteps > 0
            ? ` ${noServiceSteps} step${noServiceSteps === 1 ? " has" : "s have"} traffic but no per-service detail and are blank in this view; switch to Download / upload to see them.`
            : ""}
        </p>

        <div className="mt-4 grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            {services.kind === "not_measured" ? (
              <Empty title="Services not measured for this period.">
                The records for this period did not say which service the traffic was. That is not
                the same as no services.
              </Empty>
            ) : services.kind === "empty" ? (
              <Empty title="No service traffic recorded in this period." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service (port)</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead>Average speed</TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...services.rows, ...(services.other ? [services.other] : [])].map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-sm"
                            style={{
                              background:
                                seriesColor(s, r.key, LENS_SERIES_COLORS) ?? "transparent",
                            }}
                          />
                          <span className="font-medium">{r.label}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <ShareBar width={r.barWidth} label={r.share} />
                      </TableCell>
                      <TableCell className="tabular-nums">{r.rate}</TableCell>
                      <TableCell className="tabular-nums">{r.down}</TableCell>
                      <TableCell className="tabular-nums">{r.up}</TableCell>
                      <TableCell className="text-right">
                        {serviceFromKey(r.key) && (
                          <Button
                            size="sm"
                            variant={open?.key === r.key ? "default" : "outline"}
                            aria-expanded={open?.key === r.key}
                            onClick={() =>
                              setOpened(
                                open?.key === r.key ? null : { key: r.key, label: r.label, period },
                              )
                            }
                          >
                            Destinations
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {open && (
              <TrafficLensServiceDestinations
                key={`${open.key}@${period}`}
                locationId={locationId}
                range={bounds}
                serviceKey={open.key}
                label={open.label}
                onClose={() => setOpened(null)}
              />
            )}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Protocols
            </h4>
            {protocols === null ? (
              <p className="text-xs text-muted-foreground">{NOT_MEASURED} for this period.</p>
            ) : protocols.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No protocol traffic recorded in this period.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {protocols.map((p) => (
                  <li key={p.label} className="text-sm">
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
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          title="Top devices"
          note="Devices on your network by their local address. This list stands on its own: it does not say where any device's traffic went."
        >
          {(s.devices?.items ?? []).length === 0 ? (
            <Empty title="No device traffic recorded in this period." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s.devices?.items ?? []).map((d) => (
                  <TableRow key={`${d.router_id ?? ""}-${d.ip}`}>
                    <TableCell>
                      <span className="font-mono text-xs">{d.ip}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {lensDeviceLabel(d.match)}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {atLeast(flowBytes(d.bytes_down), devicesLb)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {atLeast(flowBytes(d.bytes_up), devicesLb)}
                    </TableCell>
                    <TableCell>
                      <ShareBar
                        width={shareBarWidth(d.share_at_least)}
                        label={atLeast(shareLabel(d.share_at_least), devicesLb)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Footnotes
            other={otherAtMostLabel(s.devices?.other_bytes_at_most, devicesLb)}
            what="All other devices"
            notes={[
              lensLowerBoundNote(devicesLb, "devices"),
              (s.devices?.items ?? []).some((d) => d.match === "session")
                ? "A guest login's name and data used are in Guest Connection Records."
                : null,
            ]}
          />
          {(s.devices?.items ?? []).some((d) => d.match === "session") && (
            <Link
              to="/network-activity"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Open Guest Connection Records
            </Link>
          )}
        </Section>

        <Section
          title="Top destinations"
          note="Outside addresses the venue as a whole exchanged traffic with. Addresses only: no site name is attached, and this list does not say which device went where."
        >
          {dest.kind === "all_withheld" ? (
            <Empty title={dest.message} />
          ) : dest.kind === "empty" ? (
            <Empty title="No destination traffic recorded in this period." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outside address</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s.destinations?.items ?? []).map((d) => (
                  <TableRow key={d.ip}>
                    <TableCell className="font-mono text-xs">{d.ip}</TableCell>
                    <TableCell className="tabular-nums">
                      {atLeast(flowBytes(d.bytes_down), destLb)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {atLeast(flowBytes(d.bytes_up), destLb)}
                    </TableCell>
                    <TableCell>
                      <ShareBar
                        width={shareBarWidth(d.share_at_least)}
                        label={atLeast(shareLabel(d.share_at_least), destLb)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {dest.kind !== "all_withheld" && (
            <Footnotes
              other={
                dest.kind === "rows"
                  ? otherAtMostLabel(s.destinations?.other_bytes_at_most, destLb)
                  : null
              }
              what="All other outside addresses"
              notes={[
                dest.note,
                dest.kind === "rows" ? lensLowerBoundNote(destLb, "destinations") : null,
              ]}
            />
          )}
        </Section>
      </div>
    </>
  );
}

/** The lock screen: what it does, what it does not, and one real action.
 * No sample charts and no demo numbers. Same shape as Guest Messaging's. */
function LockedScreen() {
  return (
    <Card className="premium-card overflow-hidden">
      <CardContent className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-start">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
            <Lock className="h-3 w-3" aria-hidden />
            Add-on
          </span>
          <h2 className="text-xl font-semibold tracking-tight">{TRAFFIC_LENS_NAME} is an add-on</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            It is not enabled for your organisation.
          </p>
          <ul className="space-y-2">
            {LENS_LOCKED_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:w-60">
          <AskWyfy
            subject={LENS_ENABLE_SUBJECT}
            description={`Please enable the ${TRAFFIC_LENS_NAME} add-on for our organisation.`}
            label="Ask Wyfy to enable it"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Files one real support ticket, through the same call Support Tickets
 * uses. "Request sent" shows only after the ticket came back; an open
 * request shows as pending and is never filed twice. */
function AskWyfy({
  subject,
  description,
  label,
}: {
  subject: string;
  description: string;
  label: string;
}) {
  const { existing, request } = useSupportRequest(subject);
  const pending = existing.data ?? null;
  if (pending)
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className="h-4 w-4 text-amber-600" aria-hidden />
          Request pending
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Ticket #{pending.id.slice(0, 8)} is open. We'll update it there.
        </p>
        <Link
          to="/tickets"
          className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          View in Support Tickets
        </Link>
      </div>
    );
  if (request.isSuccess)
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
          Request sent
        </p>
      </div>
    );
  return (
    <div className="space-y-2">
      <Button
        disabled={request.isPending || existing.isLoading}
        onClick={() =>
          request.mutate(description, {
            onSuccess: (ticket) => toast.success(`Request sent: ticket #${ticket.id.slice(0, 8)}`),
            onError: (err) =>
              toast.error(requestErrorMessage(err, "Couldn't send the request. Try again.")),
          })
        }
      >
        {request.isPending ? "Sending request…" : label}
      </Button>
      {existing.isError && (
        <p className="text-[11px] text-muted-foreground">
          Couldn't check for an earlier request. Sending one now files a new ticket.
        </p>
      )}
    </div>
  );
}

function NoticeCard({
  notice,
  tone,
  action,
}: {
  notice: LensNotice;
  tone?: "warning";
  action?: ReactNode;
}) {
  return (
    <Card
      className={
        tone === "warning" ? "border-amber-500/40 bg-amber-500/5" : "border-dashed bg-transparent"
      }
    >
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold">{notice.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{notice.body}</p>
        </div>
        {notice.ask ? (
          <AskWyfy
            subject={LENS_SWITCH_ON_SUBJECT}
            description={`Please switch on ${TRAFFIC_LENS_NAME} for this venue, or check why it has stopped reporting.`}
            label="Ask Wyfy support"
          />
        ) : (
          action
        )}
      </CardContent>
    </Card>
  );
}

function Section({
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
    <Card className="premium-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            {note && <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{note}</p>}
          </div>
          {actions}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-xs text-muted-foreground">{children}</p>}
    </div>
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

function Footnotes({
  other,
  what,
  notes,
}: {
  other: string | null;
  what: string;
  notes: (string | null)[];
}) {
  const shown = notes.filter((n): n is string => !!n);
  if (!other && shown.length === 0) return null;
  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      {other && (
        <p>
          {what}: {other}.
        </p>
      )}
      {shown.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}
