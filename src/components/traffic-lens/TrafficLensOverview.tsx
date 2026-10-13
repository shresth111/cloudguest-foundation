import { Suspense, lazy, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Flag, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { useTrafficLensFindings, useTrafficLensSummary } from "@/hooks/useTrafficLens";
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
  LENS_NOTICES,
  LENS_SERIES_COLORS,
  lensDestinationsState,
  lensDeviceLabel,
  lensLowerBoundNote,
  lensNotMeasured,
  type LensRange,
} from "@/lib/traffic-lens-customer";
import {
  LENS_STRIP_REST_KEY,
  lensChecks,
  lensChecksSummary,
  lensComposition,
  lensHeaviestDevice,
  lensPeak,
  lensPeriodPhrase,
  lensTopService,
  lensVolume,
  serviceDisplayNames,
  type LensCheck,
  type StripSegment,
} from "@/lib/traffic-lens-insights";
import {
  TIMELINE_CHART_H,
  type TimelineMode,
} from "@/components/traffic-lens/TrafficLensTimelineChart";
import { TrafficLensServiceDestinations } from "@/components/traffic-lens/TrafficLensDestinations";
import { TrafficLensFindings } from "@/components/traffic-lens/TrafficLensFindings";
import { NoticeCard } from "@/components/traffic-lens/TrafficLensParts";
import { Empty, Footnotes, Panel, RankBar } from "@/components/traffic-lens/TrafficLensLayout";
import { serviceFromKey } from "@/lib/traffic-flow-destinations";

// recharts stays behind a dynamic import, as on every other chart screen.
const TrafficLensTimelineChart = lazy(() =>
  import("@/components/traffic-lens/TrafficLensTimelineChart").then((m) => ({
    default: m.TrafficLensTimelineChart,
  })),
);

/** The grey "everything else" segment: hatched, so it never reads as one
 * more service. */
const REST_FILL =
  "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.22) 0 6px, rgb(255 255 255 / 0.1) 6px 12px)";

/**
 * Traffic Lens -> Overview. Top to bottom, in the order a venue owner asks:
 *
 *   1. the answer    one sentence and one very large figure, computed from
 *                    the summary by src/lib/traffic-lens-insights.ts, with
 *                    three smaller answers and the traffic strip
 *   2. worth a look  three fixed checks, each flagged, clear or unchecked
 *   3. the picture   speed through the period
 *   4. services      what the traffic was used for, ranked
 *   5. devices and outside addresses, two SEPARATE lists
 *
 * A device is never shown beside a destination or a service, and there is
 * nothing to click through from one to the other. A period that holds
 * nothing reads "Not measured for this period", never a row of zeros.
 */
export function TrafficLensOverview({
  query,
  findings,
  range,
  rangeMs,
  now,
  onRetry,
  locationId,
  bounds,
  onOpenRecords,
  onOpenCountries,
}: {
  query: ReturnType<typeof useTrafficLensSummary>;
  /** The server's checks for the same period. */
  findings: ReturnType<typeof useTrafficLensFindings>;
  range: LensRange;
  rangeMs: number;
  now: number;
  onRetry: () => void;
  locationId: string;
  /** The period on screen, for the drill-down from a service. */
  bounds: { since: string; until: string };
  onOpenRecords: () => void;
  onOpenCountries: () => void;
}) {
  const [mode, setMode] = useState<TimelineMode>("service");
  /** The service row whose destinations are open, and for which period. */
  const [opened, setOpened] = useState<{ key: string; label: string; period: string } | null>(null);
  const period = `${bounds.since}|${bounds.until}`;
  const open = opened && opened.period === period ? opened : null;
  const s = query.data;
  const slots = useMemo(() => timelineSlots(s), [s]);

  if (query.isLoading)
    return (
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-3xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
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

  const phrase = lensPeriodPhrase(range);
  const top = lensTopService(s, phrase);
  const peak = lensPeak(s, now);
  const heaviest = lensHeaviestDevice(s);
  const volume = lensVolume(s, phrase);
  const checks = lensChecks(s);
  const strip = lensComposition(s, LENS_SERIES_COLORS);

  const services = servicesView(s);
  const names = serviceDisplayNames(s.services?.items ?? []);
  const protocols = protocolRows(s);
  const gapNote = timelineGapNote(slots);
  const noServiceSteps = slots.filter((x) => x.measured && !x.servicesMeasured).length;
  const devicesLb = isLowerBound(s, "devices");
  const destLb = isLowerBound(s, "destinations");
  const topN = s.list_accuracy?.per_window_top_n;
  const dest = lensDestinationsState(s.destinations, s.windows);
  const devices = s.devices?.items ?? [];
  const addresses = s.destinations?.items ?? [];

  return (
    <div className="space-y-5">
      {/* 1. The answer -------------------------------------------------- */}
      <section
        aria-label="Summary of this period"
        className="relative overflow-hidden rounded-3xl bg-sidebar text-sidebar-foreground shadow-[var(--shadow-elevated)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-36 h-96 w-96 rounded-full opacity-45 blur-3xl"
          style={{ background: "var(--primary)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--chart-1)" }}
        />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-5 lg:gap-10 lg:p-10">
          <div className="lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Your WiFi, {phrase}
            </p>
            {top.figure && (
              <p className="mt-4 font-display text-7xl font-bold leading-none tracking-tighter text-white tabular-nums sm:text-8xl">
                {top.figure}
              </p>
            )}
            <h2 className="mt-4 max-w-xl font-display text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
              {top.headline}
            </h2>
            {top.detail && <p className="mt-3 max-w-xl text-sm text-white/70">{top.detail}</p>}
          </div>
          <dl className="grid gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">
            <AnswerTile label="Busiest time" headline={peak.headline} detail={peak.detail} />
            <AnswerTile
              label="Heaviest device"
              headline={heaviest.headline}
              detail={heaviest.detail}
              flagged={heaviest.flagged}
            />
            <AnswerTile
              label="Total used"
              headline={volume.headline}
              detail={[volume.detail, ...volume.facts].filter(Boolean).join(" · ")}
            />
          </dl>
        </div>
        {strip.length > 0 && <TrafficStrip segments={strip} />}
      </section>

      {/* 2. Worth a look ------------------------------------------------ */}
      {/* The server's five checks. If they cannot be loaded, the three
          checks this page can work out from the summary are shown instead:
          fewer, but never a failed request dressed as "nothing flagged". */}
      <TrafficLensFindings
        data={findings.data}
        isLoading={findings.isLoading}
        isError={findings.isError}
        now={now}
        surface="customer"
        fallback={<WorthALook checks={checks} />}
      />

      {/* 3. The picture ------------------------------------------------- */}
      <Panel
        title="Through the period"
        note="How fast traffic was moving, step by step. A blank step was not measured; it is not a quiet one."
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
        <p className="mt-2 text-[11px] text-muted-foreground">
          Speed over time, {stepLabel(s.step_seconds)}.{gapNote ? ` ${gapNote}` : ""}
          {mode === "service" && noServiceSteps > 0
            ? ` ${noServiceSteps} step${noServiceSteps === 1 ? " has" : "s have"} traffic but no per-service detail and are blank in this view; switch to Download / upload to see them.`
            : ""}{" "}
          To compare the busiest speed with what your internet plan allows, see{" "}
          <Link to="/isp-details" className="font-medium text-primary hover:underline">
            Internet Connection
          </Link>
          .
        </p>
      </Panel>

      {/* 4. Services ---------------------------------------------------- */}
      <Panel
        title="What it was used for"
        note="Each row is a kind of traffic, told apart by its port. The plain name comes from the port's standard name; it is not an app or a website, and nothing looks inside the traffic."
      >
        {services.kind === "not_measured" ? (
          <Empty title="Services not measured for this period.">
            The records for this period did not say which service the traffic was. That is not the
            same as no services.
          </Empty>
        ) : services.kind === "empty" ? (
          <Empty title="No service traffic recorded in this period." />
        ) : (
          <ol className="divide-y divide-border">
            {[...services.rows, ...(services.other ? [services.other] : [])].map((r, i) => {
              const name = names.get(r.key) ?? r.label;
              const color = seriesColor(s, r.key, LENS_SERIES_COLORS);
              return (
                <li key={r.key} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-0 basis-full items-center gap-4 sm:flex-1 sm:basis-0">
                      <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums text-muted-foreground">
                        {serviceFromKey(r.key) ? i + 1 : ""}
                      </span>
                      <span
                        aria-hidden
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{
                          background: color ?? "var(--muted-foreground)",
                          opacity: color ? 1 : 0.35,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {name !== r.label ? (
                            <span className="font-mono">{r.label}</span>
                          ) : (
                            "Service (port)"
                          )}
                          {" · "}average {r.rate}
                          {serviceFromKey(r.key) ? ` · download ${r.down} · upload ${r.up}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="ml-14 font-display text-2xl font-semibold tabular-nums sm:ml-0">
                      {r.share}
                    </span>
                    {serviceFromKey(r.key) && (
                      <Button
                        size="sm"
                        className="ml-auto sm:ml-0"
                        variant={open?.key === r.key ? "default" : "outline"}
                        aria-expanded={open?.key === r.key}
                        onClick={() =>
                          setOpened(
                            open?.key === r.key ? null : { key: r.key, label: r.label, period },
                          )
                        }
                      >
                        Where it went
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 pl-10">
                    <RankBar width={r.barWidth} color={color ?? "var(--muted-foreground)"} />
                  </div>
                </li>
              );
            })}
          </ol>
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
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">By protocol: </span>
          {protocols === null
            ? `${NOT_MEASURED} for this period.`
            : protocols.length === 0
              ? "No protocol traffic recorded in this period."
              : protocols.map((p) => `${p.label} ${p.share} (${p.bytes})`).join(" · ")}
        </p>
      </Panel>

      {/* 5. Devices and outside addresses: two separate lists ----------- */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Who used the most"
          note="Devices on your network, by their local address. This list stands on its own: it does not say where any device's traffic went."
        >
          {devices.length === 0 ? (
            <Empty title="No device traffic recorded in this period." />
          ) : (
            <ol className="space-y-4">
              {devices.map((d, i) => (
                <li key={`${d.router_id ?? ""}-${d.ip}`}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm font-medium">{d.ip}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {lensDeviceLabel(d.match)}
                    </span>
                    <span className="ml-auto font-display text-lg font-semibold tabular-nums">
                      {atLeast(shareLabel(d.share_at_least), devicesLb)}
                    </span>
                  </div>
                  <div className="mt-2 pl-9">
                    <RankBar width={shareBarWidth(d.share_at_least)} />
                    <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                      Download {atLeast(flowBytes(d.bytes_down), devicesLb)} · upload{" "}
                      {atLeast(flowBytes(d.bytes_up), devicesLb)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <Footnotes
            notes={[
              otherLine(
                "All other devices",
                otherAtMostLabel(s.devices?.other_bytes_at_most, devicesLb),
              ),
              lensLowerBoundNote(devicesLb, "devices", topN),
            ]}
          />
        </Panel>

        <Panel
          title="Where it went"
          note="Outside addresses the venue as a whole exchanged traffic with. Addresses only: no site name is attached, and this list does not say which device went where."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onOpenCountries}>
                By country <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenRecords}>
                See every record <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          }
        >
          {dest.kind === "all_withheld" ? (
            <Empty title={dest.message} />
          ) : dest.kind === "empty" ? (
            <Empty title="No destination traffic recorded in this period." />
          ) : (
            <ol className="space-y-4">
              {addresses.map((a, i) => (
                <li key={a.ip}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm font-medium">{a.ip}</span>
                    <span className="ml-auto font-display text-lg font-semibold tabular-nums">
                      {atLeast(shareLabel(a.share_at_least), destLb)}
                    </span>
                  </div>
                  <div className="mt-2 pl-9">
                    <RankBar width={shareBarWidth(a.share_at_least)} color="var(--chart-1)" />
                    <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                      Download {atLeast(flowBytes(a.bytes_down), destLb)} · upload{" "}
                      {atLeast(flowBytes(a.bytes_up), destLb)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {dest.kind !== "all_withheld" && (
            <Footnotes
              notes={[
                dest.kind === "rows"
                  ? otherLine(
                      "All other outside addresses",
                      otherAtMostLabel(s.destinations?.other_bytes_at_most, destLb),
                    )
                  : null,
                dest.note,
                dest.kind === "rows" ? lensLowerBoundNote(destLb, "destinations", topN) : null,
              ]}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

const otherLine = (what: string, amount: string | null) => (amount ? `${what}: ${amount}.` : null);

/** One of the three smaller answers on the slab. */
function AnswerTile({
  label,
  headline,
  detail,
  flagged = false,
}: {
  label: string;
  headline: string;
  detail: string | null;
  flagged?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur-sm ${
        flagged ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/5"
      }`}
    >
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
        {flagged && <Flag className="h-3 w-3 text-amber-400" aria-label="Worth a look" />}
        {label}
      </dt>
      <dd className="mt-1.5">
        <p className="font-display text-lg font-semibold leading-snug text-white">{headline}</p>
        {detail && <p className="mt-1 text-xs leading-relaxed text-white/65">{detail}</p>}
      </dd>
    </div>
  );
}

/** One bar that is all of the venue's traffic, cut by service. The same
 * colour means the same service here, in the timeline and in the list. The
 * legend under it carries every name and figure, so nothing rests on colour
 * or on a label fitting inside a segment. */
function TrafficStrip({ segments }: { segments: StripSegment[] }) {
  return (
    <div className="relative border-t border-white/10 p-6 sm:px-8 lg:px-10">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
        All traffic, split by service
      </p>
      <div
        role="img"
        aria-label={`All traffic split by service: ${segments.map((g) => `${g.name} ${g.share}`).join(", ")}`}
        className="flex h-14 w-full gap-0.5 overflow-hidden rounded-xl sm:h-16"
      >
        {segments.map((g) => (
          <div
            key={g.key}
            className="flex min-w-1.5 items-center overflow-hidden px-3 transition-[width] duration-500"
            style={{
              width: `${g.width}%`,
              background: g.key === LENS_STRIP_REST_KEY ? REST_FILL : (g.color ?? REST_FILL),
            }}
          >
            {g.width >= 14 && (
              <span
                className={`hidden truncate text-sm font-semibold sm:block ${
                  g.key === LENS_STRIP_REST_KEY ? "text-white" : "text-slate-950"
                }`}
              >
                <span className="font-display text-lg tabular-nums">{g.share}</span> {g.name}
              </span>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
        {segments.map((g) => (
          <li key={g.key} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-0.5 h-3 w-3 shrink-0 rounded-sm"
              style={{
                background: g.key === LENS_STRIP_REST_KEY ? REST_FILL : (g.color ?? REST_FILL),
              }}
            />
            <span className="min-w-0">
              <span className="block font-medium text-white">
                {g.name} <span className="tabular-nums text-white/70">{g.share}</span>
              </span>
              <span className="block text-white/55">
                {g.label ? <span className="font-mono">{g.label}</span> : "Smaller services"} ·{" "}
                {g.bytes}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The three checks, always all three. A flag is an amber outline and a flag
 * icon with the measurement in words; a check without data says so. */
function WorthALook({ checks }: { checks: LensCheck[] }) {
  const summary = lensChecksSummary(checks);
  const flagged = checks.filter((c) => c.state === "flagged").length;
  return (
    <section aria-label="Worth a look" className="premium-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold tracking-tight">Worth a look</h3>
        <p className="text-xs text-muted-foreground">
          {flagged > 0
            ? `${flagged} of ${checks.length} checks flagged for this period`
            : `${checks.length} checks, run on this period's figures`}
        </p>
      </div>
      {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {checks.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl border p-4 ${
              c.state === "flagged"
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-border bg-transparent"
            }`}
          >
            <p className="flex items-start gap-2 text-sm font-semibold">
              {c.state === "flagged" ? (
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              ) : c.state === "clear" ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>
                {c.name}
                <span className="sr-only">
                  {c.state === "flagged"
                    ? " (flagged)"
                    : c.state === "clear"
                      ? " (not flagged)"
                      : " (could not be checked)"}
                </span>
              </span>
            </p>
            <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
