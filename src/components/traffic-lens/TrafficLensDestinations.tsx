import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Columns3, Download, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  useLensDestinationExport,
  useLensDestinationSearch,
  useLensServiceDestinations,
} from "@/hooks/useLensDestinations";
import { requestErrorMessage } from "@/services/api";
import {
  AUDIT_NOTE,
  DEFAULT_DESTINATION_SORT,
  DESTINATION_CSV_MAX_ROWS,
  DESTINATION_DIRECTION_OPTIONS,
  DESTINATION_PROTOCOL_OPTIONS,
  EMPTY_DESTINATION_FILTERS,
  ariaSort,
  destinationSearchParams,
  exportMessage,
  nextSort,
  rangeLabel,
  rangeState,
  rangeStateMessage,
  searchNotes,
  serviceDestinationParams,
  serviceDestinationsView,
  serviceFromKey,
  totalsLine,
} from "@/lib/traffic-flow-destinations";
import {
  LENS_RECORD_COLUMNS,
  LENS_RECORD_DEFAULT_COLUMNS,
  LENS_RECORD_ELSEWHERE,
  LENS_RECORD_NOT_RECORDED,
  filterLoadedRecords,
  recordCells,
  recordFilterChips,
  recordTimeBasis,
  retrievedLine,
  toggleRecordColumn,
  type LensRecordColumnId,
  type RecordFilterChip,
} from "@/lib/traffic-lens-insights";
import type {
  DestinationFilterForm,
  DestinationRecord,
  DestinationSort,
  DestinationSortKey,
} from "@/types/traffic-flow-destinations";

/** The table's columns, in order. Defined beside the functions that fill
 * them (`recordCells`), so a column cannot exist without a field behind it. */
const COLUMNS = LENS_RECORD_COLUMNS;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Traffic Lens -> Records (customer dashboard): the venue's destination
 * records in ONE table, laid out like a full connection log, column for
 * column: Start, End, Src addr, S.port, Dst addr, D.port, Protocol, S.NAT,
 * D.NAT, Bytes, Packets, Service, Export.
 *
 * Five of those columns have no data for any venue (source address and
 * port, both address translations, packets). They keep their place as
 * placeholders: a greyed header, an em dash in every cell, and the reason on
 * hover or tap. Nothing is requested, joined or made up to fill them. A
 * record is for the venue as a whole: it never says which device or guest,
 * and there is no device filter or link here. Country and network are not on
 * a record either; the Columns menu says where they are.
 *
 * Above the table, in one form: the result line, Search, the four filters,
 * the filters in force as removable chips, Download, Columns and a quick
 * "Filter…" box. The box narrows the rows already loaded and asks the server
 * for nothing. Everything else that fetches does so only when asked (Search,
 * a sort click, removing a chip, a download): every search and download is
 * recorded in the audit log. Windows in which fewer than five devices were
 * connected are withheld by the server and counted on screen.
 */
export function TrafficLensDestinations({
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
  const [form, setForm] = useState<DestinationFilterForm>(EMPTY_DESTINATION_FILTERS);
  const [sort, setSort] = useState<DestinationSort>(DEFAULT_DESTINATION_SORT);
  const [params, setParams] = useState<Record<string, string> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [visible, setVisible] = useState<LensRecordColumnId[]>(LENS_RECORD_DEFAULT_COLUMNS);
  /** The quick box: narrows the loaded rows in the browser. Never a request. */
  const [quick, setQuick] = useState("");
  /** The placeholder column whose reason is spelled out above the table. */
  const [explained, setExplained] = useState<LensRecordColumnId | null>(null);
  const q = useLensDestinationSearch(locationId, params);
  const download = useLensDestinationExport(locationId);
  const now = Date.now();
  const shown = COLUMNS.filter((c) => visible.includes(c.id));
  const choosable = COLUMNS.filter((c) => c.notRecorded === null);

  const field = (patch: Partial<DestinationFilterForm>) => {
    setFormError(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  const build = (filters: DestinationFilterForm = form) =>
    destinationSearchParams({ locationId, routerId: "" }, rangeAt(Date.now()), filters, sort);

  const search = (filters: DestinationFilterForm) => {
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
  const dropFilter = (name: RecordFilterChip["field"]) => {
    const next = { ...form, [name]: name === "direction" ? "any" : "" } as DestinationFilterForm;
    setForm(next);
    search(next);
  };

  const sortBy = (key: DestinationSortKey) => {
    const next = nextSort(sort, key);
    setSort(next);
    // Re-ask for the SAME search in the new order: same period, same filters.
    if (params) setParams({ ...params, sort: next.key, order: next.order });
  };

  const fetchFile = (request: Record<string, string>) =>
    download.mutate(request, {
      onSuccess: (file) => {
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.filename;
        a.click();
        URL.revokeObjectURL(url);
        const msg = exportMessage(file);
        if (msg.tone === "success") toast.success(msg.text);
        else toast.warning(msg.text);
      },
      onError: (err) => toast.error(requestErrorMessage(err, "The download did not complete.")),
    });

  const save = () => {
    // The search on screen if there is one, otherwise what the form says.
    if (params) return fetchFile(params);
    const built = build();
    if (!built.ok) return setFormError(built.message);
    fetchFile(built.params);
  };

  /** The Export column: this one record as a file, asked for by its own
   * period, address, protocol and port. */
  const saveRecord = (row: DestinationRecord) => {
    const built = destinationSearchParams(
      { locationId, routerId: "" },
      { since: row.window_start, until: row.window_end },
      {
        address: row.address,
        protocol: String(row.protocol),
        port: String(row.port),
        direction: "any",
      },
      sort,
    );
    if (built.ok) fetchFile(built.params);
    else setFormError(built.message);
  };

  const r = q.data;
  const stateMessage = r ? rangeStateMessage(rangeState(r, now)) : null;
  const searched = r ? rangeLabel({ since: r.since, until: r.until }) : "";
  const chips = recordFilterChips(params);
  const loaded = (r?.rows ?? []).map((row) => ({ row, cells: recordCells(row, timeZone) }));
  const kept = new Set(
    filterLoadedRecords(
      loaded.map((x) => x.cells),
      shown.map((c) => c.id),
      quick,
    ).map((cells) => cells.key),
  );
  const rows = loaded.filter((x) => kept.has(x.cells.key));
  const why = COLUMNS.find((c) => c.id === explained && c.notRecorded !== null);

  return (
    <section aria-label="Records" className="premium-card overflow-hidden rounded-2xl">
      <form
        onSubmit={submit}
        aria-label="Search destination records"
        className="space-y-4 border-b border-border p-5 sm:p-6"
      >
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">Records</h3>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Every outside address and service this venue exchanged traffic with, five minutes at a
            time, in one table. It is for the venue as a whole: no record says which device or
            guest, and none is kept that could. {AUDIT_NOTE}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <p className="font-display text-lg font-semibold tabular-nums" aria-live="polite">
            {r && !stateMessage ? retrievedLine(r) : "Not searched yet"}
            {searched && (
              <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                {searched}
              </span>
            )}
          </p>
          <Button type="submit" disabled={q.isFetching}>
            <Search className="h-4 w-4" /> {q.isFetching ? "Searching…" : "Search"}
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Labelled label="Dst addr or prefix" className="w-full sm:w-64">
            <Input
              className="font-mono"
              placeholder="Any address"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              value={form.address}
              onChange={(e) => field({ address: e.target.value })}
            />
          </Labelled>
          <Labelled label="Protocol" className="w-36">
            <select
              className={SELECT_CLASS}
              value={form.protocol}
              onChange={(e) => field({ protocol: e.target.value })}
            >
              {DESTINATION_PROTOCOL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="D.port" className="w-24">
            <Input
              className="tabular-nums"
              placeholder="Any"
              inputMode="numeric"
              maxLength={5}
              value={form.port}
              onChange={(e) => field({ port: e.target.value.replace(/[^0-9]/g, "") })}
            />
          </Labelled>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Direction
            </span>
            <Tabs
              value={form.direction}
              onValueChange={(v) => {
                const option = DESTINATION_DIRECTION_OPTIONS.find((o) => o.value === v);
                if (option) field({ direction: option.value });
              }}
            >
              <TabsList aria-label="Direction">
                {DESTINATION_DIRECTION_OPTIONS.map((o) => (
                  <TabsTrigger key={o.value} value={o.value}>
                    {o.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
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
            <DropdownMenuContent align="start" className="w-80">
              <DropdownMenuLabel>Show in the table</DropdownMenuLabel>
              {choosable.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={visible.includes(c.id)}
                  disabled={c.fixed}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setVisible((v) => toggleRecordColumn(v, c.id))}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Not on a record</DropdownMenuLabel>
              {LENS_RECORD_ELSEWHERE.map((c) => (
                <DropdownMenuItem key={c.label} disabled className="flex-col items-start gap-0">
                  <span>{c.label}</span>
                  <span className="text-[11px]">{c.why}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Not recorded for any venue</DropdownMenuLabel>
              {LENS_RECORD_NOT_RECORDED.map((c) => (
                <DropdownMenuItem key={c.label} disabled className="flex-col items-start gap-0">
                  <span>{c.label}</span>
                  <span className="text-[11px]">{c.why}</span>
                </DropdownMenuItem>
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

      <div className="p-5 sm:p-6">
        {params === null ? (
          <Plain title="Not searched yet.">
            Choose a period above and any filters, then press Search. Leave the filters empty to see
            every record in the period. Download CSV saves the same records as a file, up to{" "}
            {DESTINATION_CSV_MAX_ROWS.toLocaleString()} records.
          </Plain>
        ) : q.isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : q.isError || !r ? (
          <Plain title="The search did not complete." tone="error">
            {requestErrorMessage(q.error, "The server did not answer.")} No record is shown, because
            an error is not an empty result.
          </Plain>
        ) : stateMessage ? (
          <Plain title={stateMessage.title}>
            {stateMessage.body} Searched: {searched}.
          </Plain>
        ) : (
          <div className={`space-y-3 ${q.isFetching ? "opacity-60" : ""}`}>
            {r.total === 0 ? (
              <Plain title="No records match these filters.">
                Traffic was measured in this period; none of its destination records matched.
              </Plain>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <p>{totalsLine(r)}</p>
                  {quick.trim() && (
                    <p aria-live="polite">
                      Filter box: {rows.length.toLocaleString()} of {loaded.length.toLocaleString()}{" "}
                      loaded records shown. The others are still loaded.
                    </p>
                  )}
                </div>
                {why && (
                  <p
                    role="status"
                    className="rounded-lg border border-dashed border-border px-3 py-2 text-xs"
                  >
                    <span className="font-semibold">{why.label}</span>: {why.notRecorded}
                  </p>
                )}
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {shown.map((c) => (
                          <TableHead
                            key={c.id}
                            aria-sort={c.sort ? ariaSort(sort, c.sort) : undefined}
                            className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider ${c.numeric ? "text-right" : ""}`}
                          >
                            {c.notRecorded !== null ? (
                              <button
                                type="button"
                                title={c.notRecorded}
                                aria-label={`${c.label}. ${c.notRecorded}`}
                                onClick={() => setExplained(explained === c.id ? null : c.id)}
                                className="cursor-help uppercase tracking-wider text-muted-foreground/60 underline decoration-dotted underline-offset-4"
                              >
                                {c.label}
                              </button>
                            ) : c.sort ? (
                              <SortButton
                                label={c.label}
                                state={ariaSort(sort, c.sort)}
                                onClick={() => sortBy(c.sort as DestinationSortKey)}
                              />
                            ) : (
                              c.label
                            )}
                          </TableHead>
                        ))}
                        <TableHead className="whitespace-nowrap text-right text-[11px] font-semibold uppercase tracking-wider">
                          Export
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(({ row, cells }) => (
                        <TableRow key={cells.key}>
                          {shown.map((c) => (
                            <TableCell
                              key={c.id}
                              title={c.notRecorded ?? undefined}
                              className={`whitespace-nowrap ${
                                c.numeric ? "text-right tabular-nums" : ""
                              } ${c.id === "address" ? "font-mono text-xs" : ""} ${
                                c.id === "start" || c.id === "end" ? "tabular-nums" : ""
                              } ${c.notRecorded !== null ? "text-muted-foreground/50" : ""}`}
                            >
                              {cells[c.id]}
                            </TableCell>
                          ))}
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={download.isPending}
                              aria-label={`Download this record as CSV: ${cells.address}, ${cells.start}`}
                              title="Download this record as CSV"
                              onClick={() => saveRecord(row)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rows.length === 0 && (
                  <Plain title="No loaded record matches the filter box.">
                    The box only narrows what is already loaded. Clear it to see them again, or use
                    Search to ask for different records.
                  </Plain>
                )}
              </>
            )}
            <Notes
              notes={[
                ...searchNotes(r),
                `Start and End are the five-minute period a record covers, in ${recordTimeBasis(timeZone)}. Greyed columns are not recorded for any venue and always show a dash; hover or tap a greyed heading for why. Service is the port's standard name with its protocol and port; it does not say which app or site was used. Sorting asks again for the same search.`,
                `More columns (download, upload, direction, flows) can be switched on in Columns. A download always holds every recorded column, up to ${DESTINATION_CSV_MAX_ROWS.toLocaleString()} records.`,
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Traffic Lens -> Overview: the destinations of ONE service, opened from a
 * row of the Services table. For the venue as a whole: it answers "where did
 * this venue's TCP/443 traffic go", never "which device or guest sent it".
 * Every figure is a lower bound and says so. Opening it is recorded in the
 * audit log, so it fetches once per opening and never on its own.
 */
export function TrafficLensServiceDestinations({
  locationId,
  range,
  serviceKey,
  label,
  onClose,
}: {
  locationId: string;
  /** The period the Overview is showing, as explicit instants. */
  range: { since: string; until: string };
  /** "<protocol>/<port>", as the Services table keys its rows. */
  serviceKey: string;
  label: string;
  onClose: () => void;
}) {
  const { since, until } = range;
  const params = useMemo(() => {
    const service = serviceFromKey(serviceKey);
    return service
      ? serviceDestinationParams({ locationId, routerId: "" }, { since, until }, service)
      : null;
  }, [locationId, since, until, serviceKey]);
  const q = useLensServiceDestinations(locationId, params);
  const view = q.data ? serviceDestinationsView(q.data, Date.now(), "Records") : null;

  return (
    <section
      aria-label={`Destinations of ${label}`}
      className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Where {label} traffic went</h4>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
            Outside addresses for the venue as a whole. It does not say which device or guest
            reached them, and nothing stored does. {AUDIT_NOTE}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close destinations">
          <X className="h-4 w-4" /> Close
        </Button>
      </div>

      {!params ? (
        <p className="text-xs text-muted-foreground">This row is not a single service.</p>
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : q.isError || !view ? (
        <Plain title="Couldn't load this service's destinations." tone="error">
          {requestErrorMessage(q.error, "The server did not answer.")} Nothing is shown, because an
          error is not an empty list.
        </Plain>
      ) : view.kind === "state" ? (
        <Plain title={view.message.title}>{view.message.body}</Plain>
      ) : view.kind === "empty" ? (
        <>
          <p className="text-sm">{view.title}</p>
          <Notes notes={view.notes} />
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{view.title}</span>: {view.total}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outside address</TableHead>
                <TableHead>Share of this service</TableHead>
                <TableHead>Download</TableHead>
                <TableHead>Upload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((row) => (
                <TableRow key={row.address}>
                  <TableCell className="font-mono text-xs">{row.address}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${row.barWidth}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-xs tabular-nums">{row.share}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.down}</TableCell>
                  <TableCell className="tabular-nums">{row.up}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Notes notes={view.notes} />
        </>
      )}
    </section>
  );
}

function SortButton({
  label,
  state,
  onClick,
}: {
  label: string;
  state: "ascending" | "descending" | "none";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={state === "none" ? `Sort by ${label}` : `Sorted ${state}; click to reverse`}
      className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${state === "none" ? "" : "text-foreground"}`}
    >
      {label}
      {state === "ascending" && <ArrowUp aria-hidden className="h-3 w-3" />}
      {state === "descending" && <ArrowDown aria-hidden className="h-3 w-3" />}
    </button>
  );
}

function Labelled({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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

function Notes({ notes }: { notes: (string | null)[] }) {
  const shown = notes.filter((n): n is string => !!n);
  if (shown.length === 0) return null;
  return (
    <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
      {shown.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </div>
  );
}
