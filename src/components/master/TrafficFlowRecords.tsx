import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Columns3, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { MButton, MField, M_INPUT } from "@/components/master/MasterKit";
import { TrafficFlowRangeControl } from "@/components/master/TrafficFlowRangeControl";
import { AboutRecords, FilterChips, FiltersButton } from "@/components/traffic-lens/RecordsChrome";
import { RecordsTable } from "@/components/traffic-lens/RecordsTable";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFlowRecordExport, useFlowRecordSearch } from "@/hooks/useFlowRecords";
import { requestErrorOf } from "@/services/api";
import { filterLoadedRecords, retrievedLine } from "@/lib/records-table";
import { DESTINATION_PROTOCOL_OPTIONS, rangeLabel } from "@/lib/traffic-flow-destinations";
import {
  DEFAULT_FLOW_RECORD_SORT,
  EMPTY_FLOW_RECORD_FILTERS,
  FLOW_RECORDS_AUDIT_NOTE,
  FLOW_RECORD_DEFAULT_COLUMNS,
  FLOW_RECORD_FILTERS,
  flowExportMessage,
  flowRecordChips,
  flowRecordColumns,
  flowRecordNotes,
  flowRecordParams,
  flowRecordRow,
  flowRecordsState,
  flowTotalsLine,
  incompleteNotice,
  nextFlowRecordSort,
  recordsSwitchedOffNote,
  storageLine,
  toggleFlowRecordColumn,
  type FlowRecordColumnId,
} from "@/lib/traffic-flow-records";
import type { FlowScope, RouterFlowStatus } from "@/types/traffic-flow";
import type {
  FlowRecordFilterForm,
  FlowRecordSort,
  FlowRecordSortKey,
} from "@/types/traffic-flow-records";

/**
 * Master -> Traffic Lens -> Flows: search a venue's or a router's flow
 * records (GET /flows) and download them (GET /flows/export).
 *
 * One row is one flow record as the router exported it, in one direction.
 * This is the one table where a device's address sits beside the address it
 * reached, so it exists on the Master console only, behind its own switch,
 * and every search and download is written to the audit log.
 *
 * The records come by themselves: the request is derived from the venue or
 * router, the page's pinned range, the applied filters and the sort, so
 * picking a venue is a search and so is each change of one of the four.
 * Nothing else is: no timer, no refetch on focus or remount. The
 * always-visible Filter box narrows the loaded rows and asks for nothing;
 * the per-field filters sit behind "Filters", closed by default.
 *
 * The table is the same component the customer dashboard's Records view
 * draws (RecordsTable), with this console's columns: the reference flow
 * table's thirteen, in its order, plus four more that start hidden.
 *
 * Honest cells: a value the API sent as null reads "not recorded", greyed,
 * and a field that is null in every returned row greys its whole column.
 * When the daily cap left the range incomplete, that is said above the
 * table. Switched off, nothing held, nothing matched and a failed request
 * are four different sentences.
 */
export function TrafficFlowRecords({
  routers,
  scope,
  onScope,
  bounds,
}: {
  routers: RouterFlowStatus[];
  scope: FlowScope;
  onScope: (next: FlowScope) => void;
  /** The range on screen, pinned by the page: it changes only when the range
   * is changed or Refresh is pressed, and each change is one load. */
  bounds: { since: string; until: string };
}) {
  const [organizationId, setOrganizationId] = useState("");
  /** What is typed in the Filters panel, and what was last applied. */
  const [form, setForm] = useState<FlowRecordFilterForm>(EMPTY_FLOW_RECORD_FILTERS);
  const [applied, setApplied] = useState<FlowRecordFilterForm>(EMPTY_FLOW_RECORD_FILTERS);
  const [sort, setSort] = useState<FlowRecordSort>(DEFAULT_FLOW_RECORD_SORT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [visible, setVisible] = useState<FlowRecordColumnId[]>(FLOW_RECORD_DEFAULT_COLUMNS);
  /** The quick box: narrows the loaded rows in the browser. Never a request. */
  const [quick, setQuick] = useState("");
  // The request is DERIVED from the venue or router, the range, the applied
  // filters and the sort. Picking a venue is therefore a search, and so is
  // each change of one of the four; nothing else is (no timer, no focus, no
  // remount). No venue and no router: no request.
  const built = flowRecordParams(scope, bounds, applied, sort);
  const params = built.ok ? built.params : null;
  const q = useFlowRecordSearch(params);
  const download = useFlowRecordExport();

  const customers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (r.organization_id) m.set(r.organization_id, r.organization_name ?? r.organization_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers]);
  const venues = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routers)
      if (r.location_id && (!organizationId || r.organization_id === organizationId))
        m.set(r.location_id, r.location_name ?? r.location_id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routers, organizationId]);
  const routerOptions = routers.filter(
    (r) => !!scope.locationId && r.location_id === scope.locationId,
  );
  const routerNames = useMemo(
    () => new Map(routers.map((r) => [r.router_id, r.router_name ?? r.router_id])),
    [routers],
  );
  const scoped = !!scope.locationId || !!scope.routerId;

  const pickScope = (patch: Partial<FlowScope>) => {
    setFormError(null);
    onScope({ ...scope, ...patch });
  };

  const field = (patch: Partial<FlowRecordFilterForm>) => {
    setFormError(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  /** Search, or Enter in a field: apply what is typed. Refused before any
   * request when it could not succeed. */
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const check = flowRecordParams(scope, bounds, form, sort);
    if (!check.ok) {
      setFormError(check.message);
      setFiltersOpen(true);
      return;
    }
    setFormError(null);
    setApplied(form);
  };

  /** Removing a chip is asking for the records again without that filter. */
  const dropFilter = (name: keyof FlowRecordFilterForm) => {
    const next = { ...applied, [name]: "" };
    setForm(next);
    setApplied(next);
  };

  const sortBy = (key: FlowRecordSortKey) => setSort(nextFlowRecordSort(sort, key));

  const save = () => {
    // The records on screen: the same range, filters and order.
    if (!params) return;
    const request = params;
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
      onError: (err) =>
        toast.error(requestErrorOf(err)?.message ?? "The download did not complete."),
    });
  };

  const r = q.data;
  const state = r ? flowRecordsState(r) : null;
  const searched = r ? rangeLabel({ since: r.since, until: r.until }) : "";
  const columns = flowRecordColumns(r);
  const shown = columns.filter((c) => visible.includes(c.id));
  const chips = flowRecordChips(params);
  const loaded = (r?.rows ?? []).map((row, i) => flowRecordRow(row, i, routerNames));
  const kept = new Set(
    filterLoadedRecords(
      loaded.map((x) => ({ ...x.cells, key: x.key })),
      shown.map((c) => c.id),
      quick,
    ).map((cells) => cells.key),
  );
  const rows = loaded.filter((x) => kept.has(x.key));
  const incomplete = r ? incompleteNotice(r) : null;
  const switchedOff = r ? recordsSwitchedOffNote(r) : null;

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <select
          aria-label="Customer"
          className={`${M_INPUT} w-auto`}
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            pickScope({ locationId: "", routerId: "" });
          }}
        >
          <option value="">All customers</option>
          {customers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Venue"
          className={`${M_INPUT} w-auto`}
          value={scope.locationId}
          onChange={(e) => pickScope({ locationId: e.target.value, routerId: "" })}
        >
          <option value="">Pick a venue</option>
          {venues.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Router"
          className={`${M_INPUT} w-auto`}
          value={scope.routerId}
          disabled={!scope.locationId}
          onChange={(e) => pickScope({ routerId: e.target.value })}
        >
          <option value="">All routers at this venue</option>
          {routerOptions.map((x) => (
            <option key={x.router_id} value={x.router_id}>
              {x.router_name ?? x.router_id}
            </option>
          ))}
        </select>
        <TrafficFlowRangeControl
          scope={scope}
          onChange={(patch) => onScope({ ...scope, ...patch })}
        />
      </div>

      <form
        onSubmit={submit}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
        aria-label="Flow records"
      >
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">Flow records</h3>
          <p className="max-w-3xl text-xs text-muted-foreground">
            One row is one flow record: a device's address beside the address it reached.
          </p>
          <AboutRecords>
            <p>
              One row is one flow record as the router exported it, in one direction. A long
              connection appears again each minute, and its two directions are separate rows.
            </p>
            <p>
              A row shows a device's address beside the address it reached, which is why this table
              is on this console only.
            </p>
            <p>
              {FLOW_RECORDS_AUDIT_NOTE} Records load when a venue is picked and when the range
              changes; each of those loads is recorded like a search made by hand.
            </p>
          </AboutRecords>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-sm font-semibold tabular-nums" aria-live="polite">
            {!scoped
              ? "Pick a venue"
              : q.isLoading
                ? "Loading records…"
                : r && state?.kind === "rows"
                  ? retrievedLine(r)
                  : "Flow records"}
            {searched && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{searched}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="block w-72">
            <span className="sr-only">Filter the loaded records</span>
            <input
              type="search"
              className={M_INPUT}
              placeholder="Filter…"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                // Narrowing what is loaded is not a search: Enter asks for nothing.
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </label>
          <FiltersButton
            open={filtersOpen}
            active={chips.length}
            onToggle={() => setFiltersOpen((o) => !o)}
            controls="master-flow-filters"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MButton type="button" variant="outline">
                <Columns3 /> Columns
              </MButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Show in the table</DropdownMenuLabel>
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={visible.includes(c.id)}
                  disabled={c.fixed}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setVisible((v) => toggleFlowRecordColumn(v, c.id))}
                >
                  {c.label}
                  {c.notRecorded !== null && (
                    <span className="ml-2 text-[11px] text-muted-foreground">not recorded</span>
                  )}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <MButton
            type="button"
            variant="outline"
            className="ml-auto"
            disabled={!params || download.isPending}
            onClick={save}
          >
            <Download /> {download.isPending ? "Preparing…" : "Download CSV"}
          </MButton>
        </div>

        <FilterChips chips={chips} onRemove={dropFilter} />

        {filtersOpen && (
          <div
            id="master-flow-filters"
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
          >
            {FLOW_RECORD_FILTERS.map((f) => (
              <div key={f.field} className={f.kind === "address" ? "w-52" : "w-32"}>
                <MField label={f.label}>
                  {f.kind === "protocol" ? (
                    <select
                      className={M_INPUT}
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
                    <input
                      className={`${M_INPUT} ${f.kind === "address" ? "font-mono" : "tabular-nums"}`}
                      placeholder="Any"
                      maxLength={f.kind === "address" ? 64 : 5}
                      inputMode={f.kind === "address" ? "text" : "numeric"}
                      autoComplete="off"
                      spellCheck={false}
                      value={form[f.field]}
                      onChange={(e) =>
                        field({
                          [f.field]:
                            f.kind === "port"
                              ? e.target.value.replace(/[^0-9]/g, "")
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </MField>
              </div>
            ))}
            <MButton type="submit" disabled={!scoped || q.isFetching}>
              <Search /> {q.isFetching ? "Searching…" : "Search"}
            </MButton>
          </div>
        )}

        {formError && (
          <p role="alert" className="text-xs text-destructive">
            {formError}
          </p>
        )}
      </form>

      {/* Whenever the API says the range is incomplete, above everything. */}
      {incomplete && (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold">{incomplete.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{incomplete.body}</p>
        </div>
      )}

      {!scoped ? (
        <Notice title="Pick a venue.">
          Flow records are kept per venue or router. They load as soon as one is picked.
        </Notice>
      ) : q.isLoading ? (
        <div
          role="status"
          aria-label="Loading records"
          className="h-40 animate-pulse rounded-xl bg-muted"
        />
      ) : q.isError || !r || !state ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">The search did not complete.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {requestErrorOf(q.error)?.message ?? "The server did not answer."} No record is shown,
            because an error is not an empty result.
          </p>
        </div>
      ) : state.kind !== "rows" ? (
        <Notice title={state.title}>
          {state.body} Searched: {searched}.
        </Notice>
      ) : (
        <div className={`space-y-2 ${q.isFetching ? "opacity-60" : ""}`}>
          {switchedOff && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              {switchedOff}
            </p>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <p>
              {flowTotalsLine(r)}
              {storageLine(r) && <span className="block">{storageLine(r)}</span>}
            </p>
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
            mono={["src_address", "dst_address", "nat_src", "nat_dst", "exporter"]}
          />
          {rows.length === 0 && (
            <Notice title="No loaded record matches the filter box.">
              The box only narrows what is already loaded. Clear it, or use Search to ask for
              different records.
            </Notice>
          )}
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {flowRecordNotes(r).map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p>
              Start and End are the router's clock, shown in your browser's local time. A greyed
              "not recorded" cell is a value the record did not carry; it is not zero and not empty.
              "Several" on a port means the row sums records from different ports on the venue side
              (hover for how many); "same" means the value only repeats the one before it. A greyed
              heading means no returned row carried that column: hover or click it for why. Service
              is the protocol and the outside end's port with the port's standard name; nothing here
              inspects traffic contents. Sorting asks the server again for the same search.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-sm">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}
