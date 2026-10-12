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
  resultLine,
  searchNotes,
  serviceDestinationParams,
  serviceDestinationsView,
  serviceFromKey,
  totalsLine,
} from "@/lib/traffic-flow-destinations";
import {
  LENS_RECORD_COLUMNS,
  LENS_RECORD_DEFAULT_COLUMNS,
  LENS_RECORD_NOT_RECORDED,
  recordCells,
  toggleRecordColumn,
  type LensRecordColumnId,
} from "@/lib/traffic-lens-insights";
import type {
  DestinationFilterForm,
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
 * records in ONE table, with everything that acts on the table in one
 * toolbar above it: the four filters, Search, the column chooser and the
 * CSV download.
 *
 * A record is for the venue as a whole: this venue, this outside address and
 * service, this five-minute window. It never says which device or guest, and
 * there is no device filter, column or link here. Windows in which fewer
 * than five devices were connected are withheld by the server and counted
 * on screen, because with so few online the venue's destinations would in
 * effect be one person's.
 *
 * What a full connection log would carry and this table does not (source
 * address and port, address translation, packets) is listed in the Columns
 * menu as not recorded, so the absence is stated where it would be looked
 * for.
 *
 * Nothing is requested until Search is pressed: every search and download
 * is recorded in the audit log. Sorting asks again for the same search. The
 * column chooser only hides and shows what was already fetched; the download
 * always holds every column.
 */
export function TrafficLensDestinations({
  locationId,
  rangeAt,
}: {
  locationId: string;
  /** The period the page's one range control means at a given moment. */
  rangeAt: (now: number) => { since: string; until: string };
}) {
  const [form, setForm] = useState<DestinationFilterForm>(EMPTY_DESTINATION_FILTERS);
  const [sort, setSort] = useState<DestinationSort>(DEFAULT_DESTINATION_SORT);
  const [params, setParams] = useState<Record<string, string> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [visible, setVisible] = useState<LensRecordColumnId[]>(LENS_RECORD_DEFAULT_COLUMNS);
  const q = useLensDestinationSearch(locationId, params);
  const download = useLensDestinationExport(locationId);
  const now = Date.now();
  const shown = COLUMNS.filter((c) => visible.includes(c.id));

  const field = (patch: Partial<DestinationFilterForm>) => {
    setFormError(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  const build = () =>
    destinationSearchParams({ locationId, routerId: "" }, rangeAt(Date.now()), form, sort);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const built = build();
    if (!built.ok) {
      setFormError(built.message);
      return;
    }
    setFormError(null);
    setParams(built.params);
  };

  const sortBy = (key: DestinationSortKey) => {
    const next = nextSort(sort, key);
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
        const msg = exportMessage(file);
        if (msg.tone === "success") toast.success(msg.text);
        else toast.warning(msg.text);
      },
      onError: (err) => toast.error(requestErrorMessage(err, "The download did not complete.")),
    });
  };

  const r = q.data;
  const stateMessage = r ? rangeStateMessage(rangeState(r, now)) : null;
  const searched = r ? rangeLabel({ since: r.since, until: r.until }) : "";

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
        <div className="flex flex-wrap items-end gap-3">
          <Labelled label="Outside address or prefix" className="w-full sm:w-64">
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
          <Labelled label="Port" className="w-24">
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
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button type="submit" disabled={q.isFetching}>
              <Search className="h-4 w-4" /> {q.isFetching ? "Searching…" : "Search"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline">
                  <Columns3 className="h-4 w-4" /> Columns
                  <span className="tabular-nums text-muted-foreground">
                    {shown.length}/{COLUMNS.length}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Show in the table</DropdownMenuLabel>
                {COLUMNS.map((c) => (
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
                <DropdownMenuLabel>Not recorded for any venue</DropdownMenuLabel>
                {LENS_RECORD_NOT_RECORDED.map((c) => (
                  <DropdownMenuItem key={c.label} disabled className="flex-col items-start gap-0">
                    <span>{c.label}</span>
                    <span className="text-[11px]">{c.why}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="outline" disabled={download.isPending} onClick={save}>
              <Download className="h-4 w-4" /> {download.isPending ? "Preparing…" : "Download CSV"}
            </Button>
          </div>
        </div>
        {formError && (
          <p role="alert" className="text-xs text-destructive">
            {formError}
          </p>
        )}
      </form>

      <div className="p-5 sm:p-6">
        {params === null ? (
          <Plain title="Not searched yet.">
            Choose a period above and any filters, then press Search. Leave the filters empty to see
            every record in the period. Download CSV saves the same records as a file, with every
            column, up to {DESTINATION_CSV_MAX_ROWS.toLocaleString()} records.
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
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-lg font-semibold tabular-nums" aria-live="polite">
                {resultLine(r)}
              </p>
              <p className="text-xs text-muted-foreground">{searched}</p>
            </div>
            {r.total === 0 ? (
              <Plain title="No records match these filters.">
                Traffic was measured in this period; none of its destination records matched.
              </Plain>
            ) : (
              <>
                {totalsLine(r) && <p className="text-xs text-muted-foreground">{totalsLine(r)}</p>}
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {shown.map((c) => (
                          <TableHead
                            key={c.id}
                            aria-sort={c.sort ? ariaSort(sort, c.sort) : undefined}
                            className={`whitespace-nowrap ${c.numeric ? "text-right" : ""}`}
                          >
                            {c.sort ? (
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.rows.map((row) => {
                        const v = recordCells(row, now);
                        return (
                          <TableRow key={v.key}>
                            {shown.map((c) => (
                              <TableCell
                                key={c.id}
                                className={`whitespace-nowrap ${
                                  c.numeric ? "text-right tabular-nums" : ""
                                } ${c.id === "address" ? "font-mono text-xs" : ""} ${
                                  c.id === "from" || c.id === "to" ? "tabular-nums" : ""
                                }`}
                              >
                                {v[c.id]}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            <Notes
              notes={[
                ...searchNotes(r),
                "From and To are the five-minute period a record covers, in your local time. Service is the port's standard name; it does not say which app or site was used. Direction is read from the record's download and upload. Sorting asks again for the same search.",
                shown.length < COLUMNS.length
                  ? `${COLUMNS.length - shown.length} of ${COLUMNS.length} columns are hidden. The download holds all of them.`
                  : null,
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
      className={`inline-flex items-center gap-1 hover:text-foreground ${state === "none" ? "" : "text-foreground"}`}
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
