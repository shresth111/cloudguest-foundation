import { useState, type FormEvent, type ReactNode } from "react";
import { Columns3, Download, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RecordsTable } from "@/components/traffic-lens/RecordsTable";
import { TrafficLensDestinations } from "@/components/traffic-lens/TrafficLensDestinations";
import { useLensFlowRecordExport, useLensFlowRecordSearch } from "@/hooks/useLensFlowRecords";
import { requestErrorMessage } from "@/services/api";
import { lensRefusal } from "@/services/traffic-lens.service";
import {
  DEFAULT_FLOW_RECORD_SORT,
  EMPTY_FLOW_RECORD_FILTERS,
  FLOW_RECORD_FILTERS,
  flowExportMessage,
  flowFilterParams,
  flowRecordChips,
  flowTotalsLine,
  incompleteNotice,
  nextFlowRecordSort,
  retentionNote,
} from "@/lib/flow-records";
import { filterLoadedRecords, retrievedLine } from "@/lib/records-table";
import {
  AUDIT_NOTE,
  DESTINATION_PROTOCOL_OPTIONS,
  rangeLabel,
} from "@/lib/traffic-flow-destinations";
import { LENS_NOTICES } from "@/lib/traffic-lens-customer";
import {
  LENS_CONNECTIONS_INTRO,
  LENS_FLOW_DEFAULT_COLUMNS,
  lensFlowColumns,
  lensFlowNotes,
  lensFlowRow,
  lensFlowState,
  lensRecordsMode,
  toggleLensFlowColumn,
  type LensFlowColumnId,
} from "@/lib/traffic-lens-flow-records";
import { recordTimeBasis } from "@/lib/traffic-lens-insights";
import type { FlowRecordFilterForm, FlowRecordSort, FlowRecordSortKey } from "@/types/flow-records";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Traffic Lens -> Records, for a customer who holds the second add-on: the
 * venue's connection records in the reference table's shape, every column a
 * real one. Start, End, Src addr, S.port, Dst addr, D.port, Protocol, S.NAT,
 * D.NAT, Bytes, Packets, Service.
 *
 * This is the one place on the customer dashboard where a device's address
 * sits beside the address it reached. It is shown only when the backend says
 * the organisation holds the add-on: the shell picks this component from
 * `/me/entitlements`, and if the records route itself answers "not
 * entitled" this component steps aside for the venue-level table with its
 * locked line. The browser never decides the entitlement.
 *
 * It is the same RecordsTable the venue-level view draws, with this column
 * set. Honest cells: a value the API sent as null reads "not recorded" (or
 * "not applicable" where it cannot exist) with its reason on hover, never a
 * blank and never a guess; a field null in every row greys its column. When
 * the daily limit left the period incomplete, that is said above the table.
 *
 * Nothing is requested until Search is pressed: every search and download
 * is recorded in the audit log. Sorting and removing a filter chip ask
 * again. The quick filter box narrows the loaded rows and asks for nothing.
 */
export function TrafficLensFlowRecords({
  locationId,
  rangeAt,
  timeZone,
}: {
  locationId: string;
  /** The period the page's one range control means at a given moment. */
  rangeAt: (now: number) => { since: string; until: string };
  /** The venue's time zone, for Start and End. The browser's when absent. */
  timeZone?: string | null;
}) {
  const [form, setForm] = useState<FlowRecordFilterForm>(EMPTY_FLOW_RECORD_FILTERS);
  const [sort, setSort] = useState<FlowRecordSort>(DEFAULT_FLOW_RECORD_SORT);
  const [params, setParams] = useState<Record<string, string> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [visible, setVisible] = useState<LensFlowColumnId[]>(LENS_FLOW_DEFAULT_COLUMNS);
  /** The quick box: narrows the loaded rows in the browser. Never a request. */
  const [quick, setQuick] = useState("");
  const q = useLensFlowRecordSearch(locationId, params);
  const download = useLensFlowRecordExport(locationId);
  const refusal = lensRefusal(q.error);

  // The backend's refusal is the truth: not entitled after all means the
  // venue-level table, with its locked line.
  if (lensRecordsMode(true, refusal === "locked") === "venue_locked")
    return (
      <TrafficLensDestinations
        locationId={locationId}
        rangeAt={rangeAt}
        timeZone={timeZone}
        locked
      />
    );

  const field = (patch: Partial<FlowRecordFilterForm>) => {
    setFormError(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  const build = (filters: FlowRecordFilterForm = form) =>
    flowFilterParams(rangeAt(Date.now()), filters, sort);

  const search = (filters: FlowRecordFilterForm) => {
    const built = build(filters);
    if (!built.ok) {
      setFormError(built.message);
      return;
    }
    setFormError(null);
    setParams(built.params);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    search(form);
  };

  /** Removing a chip is asking for the search again without that filter. */
  const dropFilter = (name: keyof FlowRecordFilterForm) => {
    const next = { ...form, [name]: "" };
    setForm(next);
    search(next);
  };

  const sortBy = (key: FlowRecordSortKey) => {
    const next = nextFlowRecordSort(sort, key);
    setSort(next);
    // Re-ask for the SAME search in the new order: same period, same filters.
    if (params) setParams({ ...params, sort: next.key, order: next.order });
  };

  const save = () => {
    // The search on screen if there is one, otherwise what the form says.
    let request = params;
    if (!request) {
      const built = build();
      if (!built.ok) {
        setFormError(built.message);
        return;
      }
      request = built.params;
    }
    download.mutate(request, {
      onSuccess: (file) => {
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.filename;
        a.click();
        URL.revokeObjectURL(url);
        const msg = flowExportMessage(file);
        if (msg.tone === "success") toast.success(msg.text);
        else toast.warning(msg.text);
      },
      onError: (err) => toast.error(requestErrorMessage(err, "The download did not complete.")),
    });
  };

  const r = q.data;
  const state = r ? lensFlowState(r, timeZone) : null;
  const searched = r ? rangeLabel({ since: r.since, until: r.until }) : "";
  const columns = lensFlowColumns(r);
  const shown = columns.filter((c) => visible.includes(c.id));
  const chips = flowRecordChips(params);
  const loaded = (r?.rows ?? []).map((row, i) => lensFlowRow(row, i, timeZone));
  const kept = new Set(
    filterLoadedRecords(
      loaded.map((x) => ({ ...x.cells, key: x.key })),
      shown.map((c) => c.id),
      quick,
    ).map((cells) => cells.key),
  );
  const rows = loaded.filter((x) => kept.has(x.key));
  const incomplete = r ? incompleteNotice(r, "the Overview", timeZone) : null;
  const kept_for = retentionNote(r?.retention_days);

  return (
    <section aria-label="Records" className="premium-card overflow-hidden rounded-2xl">
      <form
        onSubmit={submit}
        aria-label="Search connection records"
        className="space-y-4 border-b border-border p-5 sm:p-6"
      >
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">Records</h3>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            {LENS_CONNECTIONS_INTRO} {AUDIT_NOTE}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <p className="font-display text-lg font-semibold tabular-nums" aria-live="polite">
            {r && state?.kind === "rows" ? retrievedLine(r) : "Not searched yet"}
            {searched && (
              <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                {searched}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {kept_for && (
              <span className="text-xs text-muted-foreground">Connection records: {kept_for}</span>
            )}
            <Button type="submit" disabled={q.isFetching}>
              <Search className="h-4 w-4" /> {q.isFetching ? "Searching…" : "Search"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {FLOW_RECORD_FILTERS.map((f) => (
            <label
              key={f.field}
              className={`block space-y-1.5 ${f.kind === "address" ? "w-full sm:w-52" : "w-32"}`}
            >
              <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
              {f.kind === "protocol" ? (
                <select
                  className={SELECT_CLASS}
                  value={form[f.field]}
                  onChange={(e) => field({ [f.field]: e.target.value })}
                >
                  {DESTINATION_PROTOCOL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className={f.kind === "address" ? "font-mono" : "tabular-nums"}
                  placeholder="Any"
                  maxLength={f.kind === "address" ? 64 : 5}
                  inputMode={f.kind === "address" ? "text" : "numeric"}
                  autoComplete="off"
                  spellCheck={false}
                  value={form[f.field]}
                  onChange={(e) =>
                    field({
                      [f.field]:
                        f.kind === "port" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}
        </div>

        {chips.length > 0 && (
          <ul aria-label="Filters in force" className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.field}>
                <button
                  type="button"
                  onClick={() => dropFilter(chip.field)}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pl-3 pr-2 text-xs font-medium text-foreground hover:bg-primary/20"
                >
                  {chip.label}
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {formError && (
          <p role="alert" className="text-xs text-destructive">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={download.isPending} onClick={save}>
            <Download className="h-4 w-4" /> {download.isPending ? "Preparing…" : "Download CSV"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Columns3 className="h-4 w-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Show in the table</DropdownMenuLabel>
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={visible.includes(c.id)}
                  disabled={c.fixed}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setVisible((v) => toggleLensFlowColumn(v, c.id))}
                >
                  {c.label}
                  {c.notRecorded !== null && (
                    <span className="ml-2 text-[11px] text-muted-foreground">not recorded</span>
                  )}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <label className="ml-auto block w-full sm:w-64">
            <span className="sr-only">Filter the loaded records</span>
            <Input
              type="search"
              placeholder="Filter…"
              value={quick}
              disabled={loaded.length === 0}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                // Narrowing what is loaded is not a search: Enter asks for nothing.
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </label>
        </div>
      </form>

      <div className="space-y-4 p-5 sm:p-6">
        {/* Whenever the API says the period is incomplete, above everything. */}
        {incomplete && (
          <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold">{incomplete.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{incomplete.body}</p>
          </div>
        )}

        {params === null ? (
          <Plain title="Not searched yet.">
            Choose a period above and any filters, then press Search. Leave the filters empty to see
            every record in the period.
          </Plain>
        ) : q.isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : refusal === "forbidden" || refusal === "licence" ? (
          <Plain title={LENS_NOTICES[refusal].title}>{LENS_NOTICES[refusal].body}</Plain>
        ) : q.isError || !r || !state ? (
          <Plain title="The search did not complete." tone="error">
            {requestErrorMessage(q.error, "The server did not answer.")} No record is shown, because
            an error is not an empty result.
          </Plain>
        ) : state.kind !== "rows" ? (
          <Plain title={state.title}>
            {state.body} Searched: {searched}.
          </Plain>
        ) : (
          <div className={`space-y-3 ${q.isFetching ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <p>{flowTotalsLine(r)}</p>
              {quick.trim() && (
                <p aria-live="polite">
                  Filter box: {rows.length.toLocaleString()} of {loaded.length.toLocaleString()}{" "}
                  loaded records shown. The others are still loaded.
                </p>
              )}
            </div>
            <RecordsTable
              columns={shown}
              rows={rows}
              sort={sort}
              onSort={sortBy}
              mono={["src_address", "dst_address", "nat_src", "nat_dst"]}
            />
            {rows.length === 0 && (
              <Plain title="No loaded record matches the filter box.">
                The box only narrows what is already loaded. Clear it to see them again, or use
                Search to ask for different records.
              </Plain>
            )}
            <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              {lensFlowNotes(r, recordTimeBasis(timeZone)).map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Plain({ title, tone, children }: { title: string; tone?: "error"; children?: ReactNode }) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
          : "rounded-lg border border-dashed border-border p-4 text-sm"
      }
    >
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}
