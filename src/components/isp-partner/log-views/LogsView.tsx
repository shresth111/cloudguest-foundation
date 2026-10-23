/**
 * Logs across customers (PRD §4.8, TASKS FE-8): NetLogs, IPDR (CERT-In) and
 * guest sign-ins, one filter bar, keyset "Load older" for NetLogs/IPDR, and
 * CSV export by blob download (names from `Content-Disposition`).
 *
 * IPDR is per legal subscriber, so its list needs a customer; exporting
 * every customer at once is a separate, explicit button.
 */
import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ScrollText } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { CustomerSelect, ErrorBlock, Pager, Spinner } from "@/components/isp-partner/kit";
import { saveBlob } from "@/lib/isp-partner/download";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useIspAuthLogs,
  useIspCustomerLocations,
  useIspCustomerOptions,
  useIspNetLogsSummary,
  useIspRouters,
} from "@/hooks/isp-partner/useIsp";
import { ispKeys } from "@/hooks/isp-partner/keys";
import { ispService } from "@/services/isp-partner/isp";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime, formatNumber } from "@/lib/isp-partner/format";
import { formatDateTimeSeconds } from "@/lib/isp-partner/time-seconds";
import { ExactRange, type ExactWindow } from "@/components/isp-partner/log-views/ExactRange";
import { NetLogsPerSecond } from "@/components/isp-partner/log-views/NetLogsPerSecond";
import {
  NETLOGS_CATEGORIES,
  NETLOGS_SEVERITIES,
  categoryLabel,
  messageParts,
  severityLabel,
  severityTone,
  titleCase,
} from "@/lib/netlogs";
import { IPDR_TABLE_COLUMNS } from "@/lib/ipdr";
import {
  LOG_RANGES,
  LOG_RANGE_LABEL,
  type LogFilters,
  type LogTab,
  netLogParams,
  rangeWindow,
  scopeParams,
} from "@/components/isp-partner/log-views/logFilters";

const PAGE = 100;

function useExport() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<{ blob: Blob; filename: string }>) => {
    setBusy(key);
    try {
      const { blob, filename } = await fn();
      saveBlob(blob, filename);
    } catch (err) {
      toast.error(ispErrorMessage(err, "The export failed."));
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function MultiToggle({
  label,
  values,
  options,
  onChange,
  format,
}: {
  label: string;
  values: string[];
  options: readonly string[];
  onChange: (v: string[]) => void;
  format: (v: string) => string;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-input bg-background px-3 py-2 text-xs">
        {label}
        {values.length > 0 && ` (${values.length})`}
      </summary>
      <div className="absolute z-20 mt-1 w-48 space-y-1 rounded-lg border border-border bg-popover p-2 shadow-lg">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={values.includes(o)}
              onChange={(e) =>
                onChange(e.target.checked ? [...values, o] : values.filter((v) => v !== o))
              }
            />
            {format(o)}
          </label>
        ))}
      </div>
    </details>
  );
}

// --------------------------------------------------------------- NetLogs

function NetLogsPanel({
  filters,
  now,
  canExport,
}: {
  filters: LogFilters;
  now: number;
  canExport: boolean;
}) {
  // Per second (founder 2026-10-23): an exact from/to, down to the second,
  // overrides the preset range for NetLogs.
  const [exact, setExact] = useState<ExactWindow | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const win = useMemo(() => exact ?? rangeWindow(filters.range, now), [exact, filters.range, now]);
  const params = useMemo(() => netLogParams(filters, win), [filters, win]);
  const summary = useIspNetLogsSummary(params);
  const list = useInfiniteQuery({
    queryKey: ispKeys.netLogs(params),
    queryFn: ({ pageParam }) =>
      ispService.netLogs({
        ...params,
        limit: String(PAGE),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    retry: false,
  });
  const exp = useExport();
  const loaded = list.data?.pages.flatMap((p) => p.items) ?? [];
  // The API pages newest first; "oldest first" re-orders what is loaded, by
  // the full-precision timestamp, never by the formatted text.
  const items = newestFirst
    ? loaded
    : [...loaded].sort(
        (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
      );
  const featureOff = list.data?.pages[0]?.feature_enabled === false;

  return (
    <div className="space-y-3">
      <NetLogsPerSecond scope={params} />
      <ExactRange value={exact} onChange={setExact} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {summary.data
            ? `${formatNumber(summary.data.totals.events)} events · ${formatNumber(summary.data.totals.errors)} errors · ${formatNumber(summary.data.totals.warnings)} warnings`
            : summary.isLoading
              ? "Counting…"
              : ""}
        </p>
        {canExport && (
          <MButton
            variant="outline"
            disabled={exp.busy !== null}
            onClick={() => exp.run("netlogs", () => ispService.exportNetLogs(params))}
          >
            {exp.busy === "netlogs" ? <Spinner /> : <Download />} Export CSV
          </MButton>
        )}
      </div>
      {summary.data && summary.data.by_customer.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {summary.data.by_customer.map((c) => (
            <span key={c.isp_customer_id} className="rounded-full bg-muted px-2.5 py-1 text-[11px]">
              {c.customer_name}: {formatNumber(c.total)}
              {c.errors > 0 && <span className="text-rose-600"> · {c.errors} err</span>}
            </span>
          ))}
        </div>
      )}
      {list.error && items.length === 0 ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="network logs" />
      ) : featureOff ? (
        <MEmptyState icon={ScrollText} title="Network logging is switched off on the platform" />
      ) : !list.isLoading && items.length === 0 ? (
        <MEmptyState
          icon={ScrollText}
          title="No log lines"
          description="Nothing matches in this window. Routers send logs once their setup script has run."
        />
      ) : (
        <>
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:underline"
                    onClick={() => setNewestFirst((v) => !v)}
                    aria-label={newestFirst ? "Time, newest first" : "Time, oldest first"}
                  >
                    Time {newestFirst ? "↓" : "↑"}
                  </button>
                </MTh>
                <MTh>Customer</MTh>
                <MTh>Router</MTh>
                <MTh>Severity</MTh>
                <MTh>Category</MTh>
                <MTh>Message</MTh>
              </>
            }
          >
            {items.map((e) => {
              const tone = severityTone(e.severity);
              return (
                <MTr key={e.id}>
                  <MTd className="whitespace-nowrap text-xs tabular-nums">
                    {formatDateTimeSeconds(e.received_at)}
                  </MTd>
                  <MTd className="text-xs">{e.customer_name}</MTd>
                  <MTd className="text-xs">
                    {e.router_name ?? e.hostname ?? "–"}
                    {e.location_name && <p className="text-muted-foreground">{e.location_name}</p>}
                  </MTd>
                  <MTd>
                    <MTag
                      label={severityLabel(e)}
                      tone={
                        tone === "error" ? "critical" : tone === "warning" ? "warning" : "normal"
                      }
                    />
                  </MTd>
                  <MTd className="text-xs">{categoryLabel(e.category)}</MTd>
                  <MTd className="max-w-[420px] text-xs">
                    <span className="break-words">{messageParts(e).headline}</span>
                  </MTd>
                </MTr>
              );
            })}
          </MTable>
          {list.hasNextPage && (
            <MButton
              variant="outline"
              disabled={list.isFetchingNextPage}
              onClick={() => list.fetchNextPage()}
            >
              {list.isFetchingNextPage && <Spinner />} Load older
            </MButton>
          )}
        </>
      )}
      <p className="text-[11px] text-muted-foreground">Network logs are kept for up to 730 days.</p>
    </div>
  );
}

// ------------------------------------------------------------------ IPDR

function IpdrPanel({
  filters,
  now,
  canExport,
}: {
  filters: LogFilters;
  now: number;
  canExport: boolean;
}) {
  const win = useMemo(() => rangeWindow(filters.range, now), [filters.range, now]);
  const params = useMemo(() => scopeParams(filters, win), [filters, win]);
  const list = useInfiniteQuery({
    queryKey: ispKeys.ipdr(params),
    queryFn: ({ pageParam }) =>
      ispService.ipdrConnections({
        ...params,
        limit: String(PAGE),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!filters.customer,
    retry: false,
  });
  const exp = useExport();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canExport && filters.customer && (
          <MButton
            variant="outline"
            disabled={exp.busy !== null}
            onClick={() => exp.run("ipdr", () => ispService.exportIpdr(params))}
          >
            {exp.busy === "ipdr" ? <Spinner /> : <Download />} Export this customer (CSV)
          </MButton>
        )}
        {canExport && (
          <MButton
            variant="outline"
            disabled={exp.busy !== null}
            onClick={() =>
              exp.run("ipdr-all", () =>
                ispService.exportIpdr({
                  since: params.since,
                  until: params.until,
                }),
              )
            }
          >
            {exp.busy === "ipdr-all" ? <Spinner /> : <Download />} Export all customers (CSV)
          </MButton>
        )}
      </div>
      {!filters.customer ? (
        <MEmptyState
          icon={ScrollText}
          title="Pick a customer to see IPDR records"
          description="IPDR is kept per subscriber. To get every customer in one file, use “Export all customers”."
        />
      ) : list.error && items.length === 0 ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="IPDR records" />
      ) : !list.isLoading && items.length === 0 ? (
        <MEmptyState icon={ScrollText} title="No IPDR records in this window" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl premium-card">
            <table className="w-full min-w-[1400px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {IPDR_TABLE_COLUMNS.map((c) => (
                    <th key={c.key} className="px-2.5 py-2">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.isLoading ? (
                  <tr>
                    <td colSpan={IPDR_TABLE_COLUMNS.length} className="p-4 text-muted-foreground">
                      <Spinner /> Loading…
                    </td>
                  </tr>
                ) : (
                  items.map((it, i) => (
                    <tr key={`${it.ts}-${i}`} className="border-b border-border/70 last:border-0">
                      {IPDR_TABLE_COLUMNS.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-2.5 py-1.5">
                          {String(it[c.key as string] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {list.hasNextPage && (
            <MButton
              variant="outline"
              disabled={list.isFetchingNextPage}
              onClick={() => list.fetchNextPage()}
            >
              {list.isFetchingNextPage && <Spinner />} Load older
            </MButton>
          )}
        </>
      )}
      <p className="text-[11px] text-muted-foreground">
        Phone numbers and emails are masked on screen; the CSV export has the full CERT-In columns
        and every export is recorded. IPDR is archived for 2 years.
      </p>
    </div>
  );
}

// ------------------------------------------------------------ guest logins

function AuthPanel({ filters, now }: { filters: LogFilters; now: number }) {
  const [page, setPage] = useState(1);
  const win = useMemo(() => rangeWindow(filters.range, now), [filters.range, now]);
  const q = useIspAuthLogs({
    isp_customer_id: filters.customer || undefined,
    isp_location_id: filters.location || undefined,
    since: win.since,
    until: win.until,
    page,
    page_size: 50,
  });
  const data = q.data;
  if (q.error && !data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="guest sign-ins" />;
  if (data && data.items.length === 0)
    return <MEmptyState icon={ScrollText} title="No guest sign-in attempts" />;
  return (
    <div className="space-y-2">
      <MTable
        loading={q.isLoading}
        head={
          <>
            <MTh>Time</MTh>
            <MTh>Customer</MTh>
            <MTh>Guest</MTh>
            <MTh>Method</MTh>
            <MTh>Result</MTh>
            <MTh>IP</MTh>
          </>
        }
      >
        {data?.items.map((a) => (
          <MTr key={a.id}>
            <MTd className="whitespace-nowrap text-xs">{formatDateTime(a.attempted_at)}</MTd>
            <MTd className="text-xs">{a.customer_name}</MTd>
            <MTd className="font-mono text-xs">{a.identifier ?? "–"}</MTd>
            <MTd className="text-xs">{titleCase(a.auth_method.replace(/_/g, " "))}</MTd>
            <MTd>
              <MTag
                label={a.success ? "Success" : "Failed"}
                tone={a.success ? "active" : "offline"}
              />
              {a.failure_reason && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{a.failure_reason}</p>
              )}
            </MTd>
            <MTd className="font-mono text-xs">{a.ip_address ?? "–"}</MTd>
          </MTr>
        ))}
      </MTable>
      {data && (
        <Pager
          page={data.page}
          pages={data.total_pages}
          total={data.total_items}
          onPage={setPage}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ shell

export function LogsView({
  filters,
  onChange,
  fixedCustomerId,
}: {
  filters: LogFilters;
  onChange: (next: LogFilters) => void;
  /** Customer detail tab: the customer is fixed and its picker hidden. */
  fixedCustomerId?: string;
}) {
  const { can } = usePartner();
  const f: LogFilters = fixedCustomerId ? { ...filters, customer: fixedCustomerId } : filters;
  const customers = useIspCustomerOptions(!fixedCustomerId);
  const locations = useIspCustomerLocations(f.customer, !!f.customer);
  const routers = useIspRouters(
    { isp_customer_id: f.customer, isp_location_id: f.location || undefined, page_size: 100 },
    !!f.customer,
  );
  // One "now" per filter set, so "Load older" pages share one window.
  const now = useMemo(() => Date.now(), [JSON.stringify(f)]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<LogFilters>) => onChange({ ...filters, ...patch });

  const tabs: { value: LogTab; label: string }[] = [];
  if (can("isp_logs.read")) tabs.push({ value: "netlogs", label: "Network logs" });
  if (can("isp_ipdr.read")) tabs.push({ value: "ipdr", label: "IPDR" });
  if (can("isp_logs.read")) tabs.push({ value: "auth", label: "Guest sign-ins" });
  const tab = tabs.some((t) => t.value === f.tab) ? f.tab : tabs[0]?.value;

  if (!tab) {
    return <MEmptyState icon={ScrollText} title="Your role does not include logs" />;
  }

  return (
    <div className="space-y-3">
      <MSeg<LogTab> value={tab} onChange={(v) => set({ tab: v })} options={tabs} />
      <div className="flex flex-wrap items-center gap-2">
        {!fixedCustomerId && (
          <div className="w-full max-w-[220px]">
            <CustomerSelect
              value={f.customer}
              onChange={(id) => set({ customer: id, location: "", router: "" })}
              customers={customers.data}
              allLabel={tab === "ipdr" ? null : "All customers"}
            />
          </div>
        )}
        <select
          className={`${M_INPUT} w-auto`}
          value={f.location}
          disabled={!f.customer}
          onChange={(e) => set({ location: e.target.value, router: "" })}
          aria-label="Location"
        >
          <option value="">All locations</option>
          {(locations.data?.items ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {tab !== "auth" && (
          <select
            className={`${M_INPUT} w-auto`}
            value={f.router}
            disabled={!f.customer}
            onChange={(e) => set({ router: e.target.value })}
            aria-label="Router"
          >
            <option value="">All routers</option>
            {(routers.data?.items ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <select
          className={`${M_INPUT} w-auto`}
          value={f.range}
          onChange={(e) => set({ range: e.target.value as LogFilters["range"] })}
          aria-label="Time range"
        >
          {LOG_RANGES.map((r) => (
            <option key={r} value={r}>
              {LOG_RANGE_LABEL[r]}
            </option>
          ))}
        </select>
        {tab === "netlogs" && (
          <>
            <MultiToggle
              label="Severity"
              values={f.severity}
              options={NETLOGS_SEVERITIES}
              onChange={(v) => set({ severity: v })}
              format={titleCase}
            />
            <MultiToggle
              label="Category"
              values={f.category}
              options={NETLOGS_CATEGORIES}
              onChange={(v) => set({ category: v })}
              format={categoryLabel}
            />
            <input
              className={`${M_INPUT} w-full max-w-[220px]`}
              placeholder="Search text"
              defaultValue={f.q}
              onKeyDown={(e) => {
                if (e.key === "Enter") set({ q: (e.target as HTMLInputElement).value });
              }}
              onBlur={(e) => e.target.value !== f.q && set({ q: e.target.value })}
            />
          </>
        )}
      </div>
      {tab === "netlogs" && (
        <NetLogsPanel filters={f} now={now} canExport={can("isp_logs.export")} />
      )}
      {tab === "ipdr" && <IpdrPanel filters={f} now={now} canExport={can("isp_ipdr.export")} />}
      {tab === "auth" && <AuthPanel key={JSON.stringify(f)} filters={f} now={now} />}
    </div>
  );
}
