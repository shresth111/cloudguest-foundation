import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSearch, Info, Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { useCustomerLocations, useIsDemo } from "@/hooks/useCustomerDashboard";
import { useIpdrConnections } from "@/hooks/useIpdr";
import {
  DEFAULT_IPDR_AUDIENCE,
  EMPTY_IPDR_SEARCH,
  IPDR_AUDIENCE_LABEL,
  IPDR_EXPORT_MAX_ROWS,
  IPDR_TABLE_COLUMNS,
  coverageNote,
  ipdrErrorMessage,
  ipdrExportParams,
  ipdrParams,
  translatedSourceLabel,
  valueSourceLabel,
  whoLabel,
  type IpdrAudience,
  type IpdrSearch,
} from "@/lib/ipdr";
import {
  NETLOGS_PRESETS,
  NETLOGS_PRESET_LABEL,
  effectiveLocationId,
  netLogsWindow,
  type NetLogsFilters,
} from "@/lib/netlogs";
import { DEMO_NETLOGS_LOCATIONS, demoNetLogsRoutersFor } from "@/lib/netlogs-demo";
import { ipdrService } from "@/services/ipdr.service";
import { requestErrorOf } from "@/services/api";
import { routerService } from "@/services/router.service";
import { cn } from "@/lib/utils";
import type { IpdrItem } from "@/types/ipdr";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * NetLogs -> "Connections (IPDR)": who held which address, talking to what,
 * in the CERT-In IPDR column order (minus Address). Owner request
 * 2026-10-18, cloud-guest#423.
 *
 * - Shares the page's range / location / router filters (the URL), adds a
 *   phone / user id / MAC / IP search kept in state only (never the URL).
 * - The table is masked by the backend (phone `98xxxxxx20`, e-mail
 *   `a***@example.com`); full values exist only in the CSV.
 * - `ipdr.read` shows the tab (checked by the parent), `ipdr.export` the
 *   download. Every page and every download is audited server-side.
 * - "Guests only" (default) / "All devices": the table hides rows with no
 *   guest session (venue equipment = `device`, nothing known = `unknown`).
 *   The CSV keeps every row unless "Guests only" is ticked for the download.
 *   A "Who" flag column follows the 18 IPDR columns (table only).
 */
export function IpdrConnections({
  filters,
  apply,
  activeLocationId,
  orgWide,
  org,
  canExport,
}: {
  filters: NetLogsFilters;
  apply: (patch: Partial<NetLogsFilters>) => void;
  activeLocationId: string;
  orgWide: boolean;
  org: string | null;
  canExport: boolean;
}) {
  const [at, setAt] = useState(() => Date.now());
  const [draft, setDraft] = useState<IpdrSearch>(EMPTY_IPDR_SEARCH);
  const [search, setSearch] = useState<IpdrSearch>(EMPTY_IPDR_SEARCH);
  const [audience, setAudience] = useState<IpdrAudience>(DEFAULT_IPDR_AUDIENCE);
  const [exportGuestsOnly, setExportGuestsOnly] = useState(false);
  const effLocation = effectiveLocationId(filters, activeLocationId, orgWide);
  const win = useMemo(() => netLogsWindow(filters, at), [filters, at]);
  const params = useMemo(
    () => ipdrParams(win, effLocation, filters.router, search, audience === "guests"),
    [win, effLocation, filters.router, search, audience],
  );
  const rows = useIpdrConnections(org, params, true);

  const demo = useIsDemo();
  const locations = useCustomerLocations();
  const locationOptions = useMemo(
    () =>
      demo
        ? [...DEMO_NETLOGS_LOCATIONS]
        : (locations.data ?? [])
            .filter((l) => !org || !l.organizationId || l.organizationId === org)
            .map((l) => ({ id: l.id, name: l.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
    [demo, locations.data, org],
  );
  const routers = useQuery({
    queryKey: ["netlogs", "routers", org, effLocation, demo],
    queryFn: async () =>
      demo
        ? demoNetLogsRoutersFor(effLocation)
        : routerService.listForLocation(effLocation as string, org as string),
    enabled: !!effLocation && (demo || !!org),
    staleTime: 60_000,
    retry: false,
  });

  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    try {
      const file = await ipdrService.exportCsv(ipdrExportParams(params, exportGuestsOnly));
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("IPDR export ready", {
        description: `Saved ${file.filename}. This download was recorded in your account's audit log.`,
      });
    } catch (e) {
      const f = ipdrErrorMessage(requestErrorOf(e));
      toast.error(f.title, { description: f.detail });
    } finally {
      setExporting(false);
    }
  };

  const items = rows.data?.pages.flatMap((p) => p.items) ?? [];
  const coverage = rows.data?.pages.flatMap((p) => p.coverage) ?? [];
  const note = coverageNote(coverage);
  const friendly = rows.error ? ipdrErrorMessage(requestErrorOf(rows.error)) : null;
  const locationValue = filters.location === "all" && orgWide ? "all" : (effLocation ?? "all");
  const searching = Object.values(search).some((v) => v.trim());

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        One row per connection, in the CERT-In IPDR column order. Phone numbers and e-mail addresses
        are masked here and appear in full only in the export. Translated IP and port are derived
        unless your router reports them; hover a row to see which.
      </p>

      <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Time range"
            className="inline-flex flex-wrap rounded-md border bg-background p-0.5"
          >
            {NETLOGS_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={filters.range === p}
                onClick={() => apply({ range: p, from: "", to: "" })}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.range === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {NETLOGS_PRESET_LABEL[p]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              aria-label="From"
              className="h-9 w-auto"
              value={filters.from}
              onChange={(e) =>
                e.target.value &&
                apply({ range: "custom", from: e.target.value, to: filters.to || e.target.value })
              }
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              aria-label="To"
              className="h-9 w-auto"
              value={filters.to}
              onChange={(e) =>
                e.target.value &&
                apply({ range: "custom", from: filters.from || e.target.value, to: e.target.value })
              }
            />
          </label>

          <select
            aria-label="Location"
            className={SELECT_CLASS}
            value={locationValue}
            onChange={(e) => {
              const v = e.target.value;
              apply({ location: v === activeLocationId ? "" : v, router: "" });
            }}
          >
            {orgWide && <option value="all">All locations</option>}
            {locationOptions.length === 0 && effLocation && (
              <option value={effLocation}>This location</option>
            )}
            {locationOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Router"
            className={SELECT_CLASS}
            value={filters.router}
            disabled={!effLocation}
            onChange={(e) => apply({ router: e.target.value })}
          >
            <option value="">All routers</option>
            {(routers.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label="Show"
            className="inline-flex rounded-md border bg-background p-0.5"
          >
            {(["guests", "all"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={audience === a}
                onClick={() => setAudience(a)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  audience === a
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {IPDR_AUDIENCE_LABEL[a]}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {canExport && (
              <label
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                title="By default the export has every row, guests and devices. Tick to download guest rows only."
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={exportGuestsOnly}
                  onChange={(e) => setExportGuestsOnly(e.target.checked)}
                />
                Export guests only
              </label>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAt(Date.now())}
              disabled={rows.isFetching}
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", rows.isFetching && "animate-spin")} />
            </Button>
            {canExport && (
              <Button
                size="sm"
                onClick={() => void runExport()}
                disabled={exporting || !!friendly}
                title={`The connections matching these filters, unmasked, newest first (up to ${IPDR_EXPORT_MAX_ROWS.toLocaleString()} rows). Recorded in the audit log.`}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                IPDR Export (CERT-In format)
              </Button>
            )}
          </div>
        </div>

        <form
          className="flex flex-wrap items-center gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            setAt(Date.now());
            setSearch({ ...draft });
          }}
        >
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          {(
            [
              ["phone", "Phone", 32],
              ["userId", "User ID", 255],
              ["mac", "MAC", 32],
              ["ip", "IP (source or translated)", 64],
            ] as const
          ).map(([key, label, max]) => (
            <Input
              key={key}
              aria-label={label}
              placeholder={label}
              maxLength={max}
              className="h-9 w-44"
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            />
          ))}
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
          {searching && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(EMPTY_IPDR_SEARCH);
                setSearch(EMPTY_IPDR_SEARCH);
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {note && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {note}
        </p>
      )}

      {friendly ? (
        <EmptyState icon={ShieldAlert} title={friendly.title} description={friendly.detail} />
      ) : rows.isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No connection records here"
          description={
            searching
              ? "Nothing matched that search in this range. Try a longer range or clear the search."
              : audience === "guests"
                ? 'No guest connections in this range. Choose "All devices" to include the venue\'s own equipment and unmatched addresses.'
                : "Nothing was recorded for this range. Connection records need Traffic Lens flow records switched on for the venue's router."
          }
        />
      ) : (
        <IpdrTable
          items={items}
          hasMore={!!rows.hasNextPage}
          loadingMore={rows.isFetchingNextPage}
          onLoadMore={() => void rows.fetchNextPage()}
        />
      )}
    </div>
  );
}

function IpdrTable({
  items,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  items: IpdrItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {IPDR_TABLE_COLUMNS.map((c) => (
                <TableHead key={c.key} className="whitespace-nowrap text-xs">
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap text-xs">Who</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) => (
              <TableRow
                key={`${item.ts}-${item.source_ip}-${item.source_port}-${item.destination_ip}-${item.destination_port}-${i}`}
                title={`Translated IP/port: ${translatedSourceLabel(item.translated_source)}`}
              >
                {IPDR_TABLE_COLUMNS.map((c) => {
                  const value = String(item[c.key] ?? "");
                  const derived =
                    (c.key === "translated_ip" || c.key === "translated_port") &&
                    item.translated_source !== "nat_event";
                  const source =
                    c.key === "mac"
                      ? valueSourceLabel(item.mac_source)
                      : c.key === "allocation_start_ist" ||
                          c.key === "allocation_end_ist" ||
                          c.key === "total_online_time"
                        ? valueSourceLabel(item.allocation_source)
                        : null;
                  return (
                    <TableCell
                      key={c.key}
                      title={value && source ? source : undefined}
                      className={cn(
                        "whitespace-nowrap font-mono text-xs",
                        derived && value && "italic text-muted-foreground",
                        item.translated_source === "ambiguous" &&
                          derived &&
                          "text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {value || "—"}
                    </TableCell>
                  );
                })}
                <WhoCell item={item} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Translated IP/port in italics are derived (router's public IP and the same port); amber
        means another device may have used the same port at that time. A blank source port means the
        router's records for that row were summarised. Hover a MAC or allocation time to see where
        it came from.
      </p>
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function WhoCell({ item }: { item: IpdrItem }) {
  const who = whoLabel(item);
  const cls = item.user_class ?? (item.user_known ? "guest" : "unknown");
  return (
    <TableCell className="whitespace-nowrap text-xs">
      <span
        title={
          item.nat_event_only
            ? `${who.detail}. Seen only in the router's NAT log, not in its traffic records.`
            : who.detail
        }
        className={cn(
          "rounded px-1.5 py-0.5 font-medium",
          cls === "guest" && "bg-primary/10 text-primary",
          cls === "device" && "bg-muted text-muted-foreground",
          cls === "unknown" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        )}
      >
        {who.label}
      </span>
    </TableCell>
  );
}
