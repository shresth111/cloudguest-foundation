import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MTable, MTd, MTh, MTr } from "@/components/master/MasterKit";
import {
  GEO_BLOCK_NOTE,
  GEO_BLOCK_TITLE,
  GEO_ESTIMATE_NOTE,
  GEO_NETWORK_HEADING,
  geoAttribution,
  geoCountryRows,
  geoCoverageNote,
  geoDataDateNote,
  geoMeasuredEmpty,
  geoStaleNote,
  geoState,
  geoTailRows,
  type GeoCountryRow,
} from "@/lib/traffic-flow-geo";
import type { FlowGeoSummary } from "@/types/traffic-flow-geo";

/**
 * Master -> Traffic Lens -> venue view: "Where traffic goes", from GET /geo.
 *
 * A list of countries with shares and bars; a country opens to the networks
 * inside it. No map: this repo has no map component, and a list with numbers
 * says more than a shaded outline would.
 *
 * Presentational on purpose: the venue view owns the request (same scope,
 * same pinned range as every other block) and hands the result in.
 *
 * Four answers are kept apart (see `geoState`): not measured, country data
 * not available, not recorded for this period, and a real result. Only the
 * last shows numbers. The attribution link is rendered in every one of them
 * that shows data, because the data's licence requires it.
 */
export function TrafficFlowGeoBlock({
  geo,
  loading,
  error,
}: {
  geo: FlowGeoSummary | null | undefined;
  loading: boolean;
  /** A request that failed. Shown as a failure, never as an empty list. */
  error: string | null;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const state = geoState(geo);
  const rows = geoCountryRows(geo);
  const tail = geoTailRows(geo);
  const coverage = geoCoverageNote(geo);
  const stale = geoStaleNote(geo);
  const attribution = geoAttribution(geo);
  const dataDate = geoDataDateNote(geo);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{GEO_BLOCK_TITLE}</h3>
        <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">{GEO_BLOCK_NOTE}</p>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : error !== null ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Couldn't load the country breakdown.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error} Nothing is shown, because an error is not an empty list.
          </p>
        </div>
      ) : state.kind !== "ok" ? (
        <GeoNotice title={state.title}>{state.body}</GeoNotice>
      ) : (
        <>
          {stale && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
              {stale}
            </p>
          )}
          {geoMeasuredEmpty(geo) ? (
            <GeoNotice title="No traffic to outside addresses in this period." />
          ) : (
            <MTable
              head={
                <>
                  <MTh>Country</MTh>
                  <MTh>Share</MTh>
                  <MTh>Total</MTh>
                  <MTh>Download</MTh>
                  <MTh>Upload</MTh>
                </>
              }
            >
              {rows.map((row) => (
                <Fragment key={row.key}>
                  <MTr>
                    <MTd className="text-xs">
                      {row.expandable ? (
                        <button
                          type="button"
                          aria-expanded={open.has(row.key)}
                          aria-controls={`geo-networks-${row.key}`}
                          onClick={() => toggle(row.key)}
                          className="flex items-center gap-1.5 rounded text-left font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {open.has(row.key) ? (
                            <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{row.name}</span>
                          <span className="font-mono text-[11px] font-normal text-muted-foreground">
                            {row.code}
                          </span>
                        </button>
                      ) : (
                        <span className="pl-5 font-medium">{row.name}</span>
                      )}
                    </MTd>
                    <MTd>
                      <GeoShareBar width={row.barWidth} label={row.share} />
                    </MTd>
                    <MTd className="text-xs tabular-nums">{row.bytes}</MTd>
                    <MTd className="text-xs tabular-nums">{row.down}</MTd>
                    <MTd className="text-xs tabular-nums">{row.up}</MTd>
                  </MTr>
                  {row.expandable && open.has(row.key) && <NetworkRows row={row} />}
                </Fragment>
              ))}
              {tail.map((row) => (
                <MTr key={row.key}>
                  <MTd className="text-xs">
                    <span className="block pl-5 font-medium text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="block pl-5 text-[11px] text-muted-foreground">{row.hint}</span>
                  </MTd>
                  <MTd>
                    <GeoShareBar width={row.barWidth} label={row.share} muted />
                  </MTd>
                  <MTd className="text-xs tabular-nums">{row.bytes}</MTd>
                  <MTd className="text-xs text-muted-foreground">—</MTd>
                  <MTd className="text-xs text-muted-foreground">—</MTd>
                </MTr>
              ))}
            </MTable>
          )}
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {coverage && <p className="text-amber-700 dark:text-amber-400">{coverage}</p>}
            <p>{GEO_ESTIMATE_NOTE}</p>
          </div>
        </>
      )}

      {/* The licence's condition for showing any of this. Rendered for every
          state that came from the server, including the empty ones. */}
      {!loading && error === null && (
        <p className="text-[11px] text-muted-foreground" data-testid="geo-attribution">
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
    </section>
  );
}

/** The networks inside one country, as indented rows of the same table so
 * the columns line up. The share here is of the country, and says so. */
function NetworkRows({ row }: { row: GeoCountryRow }) {
  return (
    <>
      <MTr className="bg-muted/30">
        <MTd className="pb-1 pl-11 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span id={`geo-networks-${row.key}`}>{GEO_NETWORK_HEADING}</span>
        </MTd>
        <MTd className="pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Share of {row.name}
        </MTd>
        <MTd className="pb-1 pt-2" />
        <MTd className="pb-1 pt-2" />
        <MTd className="pb-1 pt-2" />
      </MTr>
      {row.networks.map((n) => (
        <MTr key={n.key} className="bg-muted/30">
          <MTd className="py-2 pl-11 text-xs">
            <span>{n.name}</span>
            {n.asn !== n.name && (
              <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{n.asn}</span>
            )}
          </MTd>
          <MTd className="py-2">
            <GeoShareBar width={n.barWidth} label={n.share} muted />
          </MTd>
          <MTd className="py-2 text-xs tabular-nums">{n.bytes}</MTd>
          <MTd className="py-2 text-xs tabular-nums">{n.down}</MTd>
          <MTd className="py-2 text-xs tabular-nums">{n.up}</MTd>
        </MTr>
      ))}
      {(row.networksOther || row.networksUnknown) && (
        <MTr className="bg-muted/30">
          <MTd className="py-2 pl-11 text-[11px] text-muted-foreground">
            {[
              row.networksOther ? `Other networks: ${row.networksOther}` : null,
              row.networksUnknown ? `Network not known: ${row.networksUnknown}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </MTd>
          <MTd className="py-2" />
          <MTd className="py-2" />
          <MTd className="py-2" />
          <MTd className="py-2" />
        </MTr>
      )}
    </>
  );
}

function GeoNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-sm">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

/** A share as a thin bar with its value beside it in ink, so the number
 * never depends on reading the bar. */
function GeoShareBar({ width, label, muted }: { width: number; label: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${muted ? "bg-muted-foreground/50" : "bg-primary"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-xs tabular-nums">{label}</span>
    </div>
  );
}
