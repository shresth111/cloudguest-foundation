import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrafficLensGeo } from "@/hooks/useTrafficLens";
import { requestErrorMessage } from "@/services/api";
import {
  GEO_BLOCK_NOTE,
  GEO_BLOCK_TITLE,
  GEO_ESTIMATE_NOTE,
  GEO_NETWORK_HEADING,
  GEO_WITHHELD_WHY,
  geoAttribution,
  geoCountryRows,
  geoCoverageNote,
  geoDataDateNote,
  geoLead,
  geoMeasuredEmpty,
  geoNetworksWithheldSentence,
  geoStaleNote,
  geoState,
  geoTailRows,
  geoWithheldNote,
  type GeoCountryRow,
} from "@/lib/traffic-flow-geo";
import type { LensRange } from "@/lib/traffic-lens-customer";
import { Panel, RankBar } from "@/components/traffic-lens/TrafficLensLayout";
import type { FlowGeoSummary } from "@/types/traffic-flow-geo";

/**
 * Traffic Lens -> Countries (customer dashboard): where this venue's traffic
 * goes, by country, and inside a country by network.
 *
 * Laid out like the Overview: one sentence first (`geoLead`, a pure tested
 * function), then the ranked list, then what the list leaves out. A country
 * is an estimate from the address, and the view says so beside the sentence,
 * not in a footnote.
 *
 * For the venue as a whole. Nothing here names an address or says which
 * guest; a network is whoever announces the address on the internet and is
 * never called anything else. Country totals are always shown. A network is
 * named only for periods in which at least five devices were connected: the
 * server withholds the rest, and the screen says how much that was instead
 * of showing a shorter list.
 *
 * The country data's licence requires a link back to its publisher on any
 * page that shows results from it, so the attribution line is rendered for
 * every answer, including the empty ones.
 *
 * Read-only, and asked for only while this view is open.
 */
export function TrafficLensGeo({
  locationId,
  range,
  at,
  onRetry,
}: {
  locationId: string;
  range: LensRange;
  /** The page's pinned moment, so every view describes the same period. */
  at: number;
  onRetry: () => void;
}) {
  const query = useTrafficLensGeo(locationId, range, at, true);
  return (
    <TrafficLensGeoTable
      geo={query.data}
      loading={query.isLoading}
      error={
        query.isError
          ? requestErrorMessage(query.error, "The country breakdown did not load.")
          : null
      }
      onRetry={onRetry}
    />
  );
}

/** The view itself, from a response. No request of its own. */
export function TrafficLensGeoTable({
  geo,
  loading,
  error,
  onRetry,
}: {
  geo: FlowGeoSummary | null | undefined;
  loading: boolean;
  /** A request that failed. Shown as a failure, never as an empty list. */
  error: string | null;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const state = geoState(geo, "customer");
  const lead = geoLead(geo);
  const rows = geoCountryRows(geo);
  const tail = geoTailRows(geo);
  const coverage = geoCoverageNote(geo);
  const stale = geoStaleNote(geo, "customer");
  const withheld = geoWithheldNote(geo);
  const attribution = geoAttribution(geo);
  const dataDate = geoDataDateNote(geo);
  const withheldSentence = geoNetworksWithheldSentence(geo?.networks_min_devices);

  return (
    <Panel title={GEO_BLOCK_TITLE} note={GEO_BLOCK_NOTE}>
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      ) : error !== null ? (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div>
            <p className="text-sm font-semibold">Couldn't load countries for this period.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error} Nothing is shown, because an error is not an empty list.
            </p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          )}
        </div>
      ) : state.kind !== "ok" ? (
        <BigNotice title={state.title} body={state.body} />
      ) : (
        <div className="space-y-6">
          {stale && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              {stale}
            </p>
          )}
          {geoMeasuredEmpty(geo) ? (
            <BigNotice title="No traffic to outside addresses in this period." />
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-5">
                {lead && (
                  <div className="lg:col-span-3">
                    {lead.figure && (
                      <p className="font-display text-6xl font-bold leading-none tracking-tighter tabular-nums sm:text-7xl">
                        {lead.figure}
                      </p>
                    )}
                    <p className="mt-3 max-w-xl font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                      {lead.headline}
                    </p>
                    {lead.detail && (
                      <p className="mt-2 text-sm text-muted-foreground">{lead.detail}</p>
                    )}
                  </div>
                )}
                <div className="rounded-xl border border-border bg-muted/40 p-4 lg:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Read this as an estimate
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">{GEO_ESTIMATE_NOTE}</p>
                </div>
              </div>

              <ol className="divide-y divide-border border-t border-border">
                {rows.map((row, i) => (
                  <li key={row.key} className="py-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="w-6 shrink-0 font-display text-lg font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        {row.expandable ? (
                          <button
                            type="button"
                            aria-expanded={open.has(row.key)}
                            aria-controls={`lens-geo-networks-${row.key}`}
                            onClick={() => toggle(row.key)}
                            className="flex items-center gap-1.5 rounded text-left text-base font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span>{row.name}</span>
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              {row.code}
                            </span>
                            {open.has(row.key) ? (
                              <ChevronDown aria-hidden className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
                            )}
                            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                              {open.has(row.key) ? "Hide networks" : "Show networks"}
                            </span>
                          </button>
                        ) : (
                          <p className="text-base font-semibold">{row.name}</p>
                        )}
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {row.bytes} · download {row.down} · upload {row.up}
                        </p>
                      </div>
                      <span className="font-display text-2xl font-semibold tabular-nums">
                        {row.share}
                      </span>
                    </div>
                    <div className="mt-3 pl-10">
                      <RankBar width={row.barWidth} color="var(--chart-1)" />
                    </div>
                    {row.expandable && open.has(row.key) && (
                      <Networks row={row} withheldSentence={withheldSentence} />
                    )}
                  </li>
                ))}
                {tail.map((row) => (
                  <li key={row.key} className="py-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="w-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-muted-foreground">{row.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.bytes} · {row.hint}
                        </p>
                      </div>
                      <span className="font-display text-2xl font-semibold tabular-nums text-muted-foreground">
                        {row.share}
                      </span>
                    </div>
                    <div className="mt-3 pl-10">
                      <RankBar width={row.barWidth} color="var(--muted-foreground)" />
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
          {(withheld || coverage) && (
            <div className="space-y-2 rounded-xl border border-dashed border-border p-4 text-sm">
              {withheld && (
                <div>
                  <p className="font-medium">{withheld}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{GEO_WITHHELD_WHY}</p>
                </div>
              )}
              {coverage && <p className="text-xs text-muted-foreground">{coverage}</p>}
            </div>
          )}
        </div>
      )}

      {/* The condition the country data is published under: a link back,
          wherever results are shown. Rendered for every answer. */}
      {!loading && error === null && (
        <p
          className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground"
          data-testid="lens-geo-attribution"
        >
          <a
            href={attribution.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {attribution.text}
          </a>
          {dataDate ? ` · ${dataDate}` : ""}
        </p>
      )}
    </Panel>
  );
}

/** The networks inside one country. The share here is of the country, and
 * says so. */
function Networks({ row, withheldSentence }: { row: GeoCountryRow; withheldSentence: string }) {
  const rest = [
    row.networksOther ? `Other networks: ${row.networksOther}` : null,
    row.networksUnknown ? `Network not known: ${row.networksUnknown}` : null,
  ].filter(Boolean);
  return (
    <div
      id={`lens-geo-networks-${row.key}`}
      className="ml-10 mt-4 space-y-3 rounded-xl bg-muted/40 p-4"
    >
      {row.networks.length > 0 && (
        <p className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span>{GEO_NETWORK_HEADING}</span>
          <span>Share of {row.name}</span>
        </p>
      )}
      {row.networks.map((n) => (
        <div key={n.key}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-medium">{n.name}</span>
            {n.asn !== n.name && (
              <span className="font-mono text-xs text-muted-foreground">{n.asn}</span>
            )}
            <span className="ml-auto font-display text-base font-semibold tabular-nums">
              {n.share}
            </span>
          </div>
          <div className="mt-1.5">
            <RankBar width={n.barWidth} color="var(--muted-foreground)" />
          </div>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {n.bytes} · download {n.down} · upload {n.up}
          </p>
        </div>
      ))}
      {rest.length > 0 && <p className="text-xs text-muted-foreground">{rest.join(" · ")}</p>}
      {row.networksWithheld && (
        <p className="text-xs text-muted-foreground">
          {withheldSentence}: {row.networksWithheld} of {row.name}'s traffic is in its total and
          under no network.
        </p>
      )}
    </div>
  );
}

/** A state with nothing to list: one large plain sentence on a dashed
 * outline, as on the rest of the page. Never a row of zeros. */
function BigNotice({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border px-6 py-10">
      <p className="font-display text-2xl font-semibold leading-tight tracking-tight">{title}</p>
      {body && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}
