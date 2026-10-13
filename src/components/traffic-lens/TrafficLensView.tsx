import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureEntitled, useIsDemo } from "@/hooks/useCustomerDashboard";
import {
  useTrafficLensFindings,
  useTrafficLensStatus,
  useTrafficLensSummary,
} from "@/hooks/useTrafficLens";
import { lensRefusal } from "@/services/traffic-lens.service";
import {
  LENS_DEFAULT_RANGE,
  LENS_ENABLE_SUBJECT,
  LENS_LOCKED_POINTS,
  LENS_NOTICES,
  LENS_PRESETS,
  LENS_TAGLINE,
  LENS_VIEWS,
  TRAFFIC_LENS_NAME,
  lensFreshness,
  lensRangeBounds,
  lensScreen,
  lensStoppedNotice,
  type LensRange,
} from "@/lib/traffic-lens-customer";
import { TrafficLensDestinations } from "@/components/traffic-lens/TrafficLensDestinations";
import { TrafficLensFlowRecords } from "@/components/traffic-lens/TrafficLensFlowRecords";
import { TrafficLensGeo } from "@/components/traffic-lens/TrafficLensGeo";
import { TrafficLensOverview } from "@/components/traffic-lens/TrafficLensOverview";
import { AskWyfy, NoticeCard } from "@/components/traffic-lens/TrafficLensParts";
import {
  FLOW_RETENTION_DAYS,
  customRangeFromInputs,
  rangeLabel,
  toLocalInput,
} from "@/lib/traffic-flow-destinations";
import { retentionNote } from "@/lib/flow-records";
import { lensRecordsMode } from "@/lib/traffic-lens-flow-records";
import { TRAFFIC_LENS_FEATURE_KEY, TRAFFIC_LENS_RECORDS_FEATURE_KEY } from "@/types/traffic-lens";

type LensViewId = (typeof LENS_VIEWS)[number]["id"];

/**
 * Customer dashboard -> Network -> Traffic Lens, for the selected venue.
 * Read-only: there is no switch here, and nothing to configure.
 *
 * Which screen shows is decided by `lensScreen` from what the backend said:
 * the add-on is not enabled (the lock screen), the venue is not switched on
 * yet, its equipment cannot report this, the request failed, or there is
 * data. With data, a period that holds nothing reads "Not measured for this
 * period" -- never a row of zeros.
 *
 * The page is a list of views (`LENS_VIEWS`, one array) that share one venue
 * and one period, and the period is one control (`LensRangeControl`) over
 * one type (`LensRange`):
 *
 *   - Overview (TrafficLensOverview): the answer in plain words, then the
 *     picture, then the ranked lists.
 *   - Records (TrafficLensDestinations): the venue's destination records in
 *     one table, with search, sort, a column chooser and the download.
 *   - Countries (TrafficLensGeo): where the traffic went, by country and by
 *     network inside one. A country is an estimate, and the view says so.
 *
 * See wyfy-specs/flow-visibility/UX-REDESIGN.md for why it is laid out so.
 */
export function TrafficLensView({
  locationId,
  timeZone,
}: {
  locationId: string;
  /** The venue's time zone, for the Records table's Start and End. */
  timeZone?: string | null;
}) {
  const demo = useIsDemo();
  const entitled = useFeatureEntitled(TRAFFIC_LENS_FEATURE_KEY);
  // The second add-on (connection records), as `/me/entitlements` reports it.
  const recordsMode = lensRecordsMode(useFeatureEntitled(TRAFFIC_LENS_RECORDS_FEATURE_KEY));
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
  // Asked only while the Overview is on screen: no other view shows them.
  const findings = useTrafficLensFindings(
    locationId,
    range,
    at,
    screen.kind === "data" && view === "overview",
  );
  const now = Date.now();

  if (screen.kind === "locked") return <LockedScreen />;
  if (screen.kind === "loading")
    return (
      <div className="space-y-4">
        <div className="h-10 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-72 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  if (screen.kind !== "data")
    return (
      <div className="space-y-4">
        <p className="max-w-3xl text-sm text-muted-foreground">{LENS_TAGLINE}</p>
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
      </div>
    );

  const latest = summary.data?.latest_data ?? status.data?.latest_data;
  const stopped = lensStoppedNotice(screen.stopped, latest, now);
  const bounds = lensRangeBounds(range, at);

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted-foreground">{LENS_TAGLINE}</p>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-start gap-3">
          {LENS_VIEWS.length > 1 && (
            <Tabs value={view} onValueChange={(v) => setView(v as LensViewId)}>
              <TabsList aria-label="View">
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
        <div className="flex flex-wrap items-center gap-3">
          {/* How far back anything exists, beside the period control, so
              nobody searches beyond it. From the API, not a constant. */}
          {retentionNote(status.data?.retention_days) && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {retentionNote(status.data?.retention_days)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{lensFreshness(latest, now)}</span>
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

      {stopped && <NoticeCard notice={stopped} tone="warning" />}

      {view === "overview" && (
        <TrafficLensOverview
          query={summary}
          findings={findings}
          range={range}
          rangeMs={bounds.ms}
          now={now}
          onRetry={() => setAt(Date.now())}
          locationId={locationId}
          bounds={bounds}
          onOpenRecords={() => setView("destinations")}
          onOpenCountries={() => setView("geo")}
        />
      )}
      {/* One Records view, two tables: which one is decided from what the
          backend reports about the second add-on, never worked out here. */}
      {view === "destinations" && recordsMode === "connections" && (
        <TrafficLensFlowRecords
          locationId={locationId}
          rangeAt={(moment) => lensRangeBounds(range, moment)}
          timeZone={timeZone}
        />
      )}
      {view === "destinations" && recordsMode !== "connections" && (
        <TrafficLensDestinations
          locationId={locationId}
          rangeAt={(moment) => lensRangeBounds(range, moment)}
          timeZone={timeZone}
          locked={recordsMode === "venue_locked"}
        />
      )}
      {view === "geo" && (
        <TrafficLensGeo
          locationId={locationId}
          range={range}
          at={at}
          onRetry={() => setAt(Date.now())}
        />
      )}

      <p className="text-[11px] text-muted-foreground">
        Figures come from traffic records and are kept for {status.data?.retention_days ?? 7} days.
        They are not your billing figure. For the internet line's speed over time, see{" "}
        <Link to="/isp-details" className="font-medium text-primary hover:underline">
          Internet Connection
        </Link>
        .
      </p>
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
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <Tabs
        className="max-w-full"
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
        <TabsList aria-label="Period" className="max-w-full justify-start overflow-x-auto">
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

/** The lock screen: the same dark slab the answer sits on, what the add-on
 * does and does not do, and one real action. No sample chart and no demo
 * numbers: nothing here is a figure. */
function LockedScreen() {
  return (
    <section
      aria-label={`${TRAFFIC_LENS_NAME} is an add-on`}
      className="relative overflow-hidden rounded-3xl bg-sidebar text-sidebar-foreground shadow-[var(--shadow-elevated)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-36 h-96 w-96 rounded-full opacity-45 blur-3xl"
        style={{ background: "var(--primary)" }}
      />
      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-5 lg:p-14">
        <div className="lg:col-span-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
            <Lock className="h-3 w-3" aria-hidden />
            Add-on
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {TRAFFIC_LENS_NAME} is an add-on
          </h2>
          <p className="mt-4 max-w-xl text-base text-white/70">
            It is not enabled for your organisation.
          </p>
          <div className="mt-8">
            <AskWyfy
              onInk
              subject={LENS_ENABLE_SUBJECT}
              description={`Please enable the ${TRAFFIC_LENS_NAME} add-on for our organisation.`}
              label="Ask Wyfy to enable it"
            />
          </div>
        </div>
        <ul className="space-y-3 lg:col-span-2">
          {LENS_LOCKED_POINTS.map((p, i) => {
            const not = i === LENS_LOCKED_POINTS.length - 1;
            return (
              <li
                key={p}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/85"
              >
                {not ? (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden />
                ) : (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                )}
                <span>{p}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
