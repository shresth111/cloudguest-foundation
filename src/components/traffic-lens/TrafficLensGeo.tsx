import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTrafficLensGeo } from "@/hooks/useTrafficLens";
import { requestErrorMessage } from "@/services/api";
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
  geoNetworksWithheldSentence,
  geoStaleNote,
  geoState,
  geoTailRows,
  geoWithheldNote,
  type GeoCountryRow,
} from "@/lib/traffic-flow-geo";
import type { LensRange } from "@/lib/traffic-lens-customer";
import type { FlowGeoSummary } from "@/types/traffic-flow-geo";

/**
 * Traffic Lens -> Countries (customer dashboard): where this venue's traffic
 * goes, by country, and inside a country by network.
 *
 * For the venue as a whole. Nothing here names an address or says which
 * guest; a network is whoever announces the address on the internet and is
 * never called anything else. Country totals are always shown. A network is
 * named only for periods in which at least five devices were connected: the
 * server withholds the rest, and the screen says how much that was instead
 * of showing a shorter list.
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
  const rows = geoCountryRows(geo);
  const tail = geoTailRows(geo);
  const coverage = geoCoverageNote(geo);
  const stale = geoStaleNote(geo, "customer");
  const withheld = geoWithheldNote(geo);
  const attribution = geoAttribution(geo);
  const dataDate = geoDataDateNote(geo);
  const withheldSentence = geoNetworksWithheldSentence(geo?.networks_min_devices);

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="text-sm font-semibold">{GEO_BLOCK_TITLE}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{GEO_BLOCK_NOTE}</p>
        </div>

        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        ) : error !== null ? (
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">Couldn't load countries for this period.</p>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Share</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Download</TableHead>
                      <TableHead>Upload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <Fragment key={row.key}>
                        <TableRow>
                          <TableCell className="text-sm">
                            {row.expandable ? (
                              <button
                                type="button"
                                aria-expanded={open.has(row.key)}
                                aria-controls={`lens-geo-networks-${row.key}`}
                                onClick={() => toggle(row.key)}
                                className="flex items-center gap-1.5 rounded text-left font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {open.has(row.key) ? (
                                  <ChevronDown aria-hidden className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
                                )}
                                <span>{row.name}</span>
                                <span className="font-mono text-xs font-normal text-muted-foreground">
                                  {row.code}
                                </span>
                              </button>
                            ) : (
                              <span className="pl-5 font-medium">{row.name}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <GeoShareBar width={row.barWidth} label={row.share} />
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">{row.bytes}</TableCell>
                          <TableCell className="text-sm tabular-nums">{row.down}</TableCell>
                          <TableCell className="text-sm tabular-nums">{row.up}</TableCell>
                        </TableRow>
                        {row.expandable && open.has(row.key) && (
                          <NetworkRows row={row} withheldSentence={withheldSentence} />
                        )}
                      </Fragment>
                    ))}
                    {tail.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="text-sm">
                          <span className="block pl-5 font-medium text-muted-foreground">
                            {row.label}
                          </span>
                          <span className="block pl-5 text-xs text-muted-foreground">
                            {row.hint}
                          </span>
                        </TableCell>
                        <TableCell>
                          <GeoShareBar width={row.barWidth} label={row.share} muted />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{row.bytes}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">—</TableCell>
                        <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="space-y-1 text-xs text-muted-foreground">
              {withheld && <p className="text-amber-700 dark:text-amber-400">{withheld}</p>}
              {coverage && <p className="text-amber-700 dark:text-amber-400">{coverage}</p>}
              <p>{GEO_ESTIMATE_NOTE}</p>
            </div>
          </>
        )}

        {/* The condition the country data is published under: a link back,
            wherever results are shown. Rendered for every answer. */}
        {!loading && error === null && (
          <p className="text-xs text-muted-foreground" data-testid="lens-geo-attribution">
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
      </CardContent>
    </Card>
  );
}

/** The networks inside one country, as indented rows of the same table. The
 * share here is of the country, and says so. */
function NetworkRows({ row, withheldSentence }: { row: GeoCountryRow; withheldSentence: string }) {
  const rest = [
    row.networksOther ? `Other networks: ${row.networksOther}` : null,
    row.networksUnknown ? `Network not known: ${row.networksUnknown}` : null,
  ].filter(Boolean);
  return (
    <>
      {row.networks.length > 0 && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell className="pb-1 pl-11 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span id={`lens-geo-networks-${row.key}`}>{GEO_NETWORK_HEADING}</span>
          </TableCell>
          <TableCell
            colSpan={4}
            className="pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Share of {row.name}
          </TableCell>
        </TableRow>
      )}
      {row.networks.map((n) => (
        <TableRow key={n.key} className="bg-muted/30 hover:bg-muted/30">
          <TableCell className="py-2 pl-11 text-sm">
            <span>{n.name}</span>
            {n.asn !== n.name && (
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">{n.asn}</span>
            )}
          </TableCell>
          <TableCell className="py-2">
            <GeoShareBar width={n.barWidth} label={n.share} muted />
          </TableCell>
          <TableCell className="py-2 text-sm tabular-nums">{n.bytes}</TableCell>
          <TableCell className="py-2 text-sm tabular-nums">{n.down}</TableCell>
          <TableCell className="py-2 text-sm tabular-nums">{n.up}</TableCell>
        </TableRow>
      ))}
      {rest.length > 0 && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="py-2 pl-11 text-xs text-muted-foreground">
            {rest.join(" · ")}
          </TableCell>
        </TableRow>
      )}
      {row.networksWithheld && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="py-2 pl-11 text-xs text-muted-foreground">
            {withheldSentence}: {row.networksWithheld} of {row.name}'s traffic is in its total and
            under no network.
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function GeoNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5">
      <p className="text-sm font-semibold">{title}</p>
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
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
