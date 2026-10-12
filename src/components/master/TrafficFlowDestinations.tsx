import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
import { toast } from "sonner";
import {
  MButton,
  MField,
  MSeg,
  MTable,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { TrafficFlowRangeControl } from "@/components/master/TrafficFlowRangeControl";
import { useDestinationExport, useDestinationSearch } from "@/hooks/useFlowDestinations";
import { requestErrorOf } from "@/services/api";
import {
  AUDIT_NOTE,
  DEFAULT_DESTINATION_SORT,
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
  recordView,
  resultLine,
  searchNotes,
  totalsLine,
} from "@/lib/traffic-flow-destinations";
import type { FlowScope, RouterFlowStatus } from "@/types/traffic-flow";
import type {
  DestinationFilterForm,
  DestinationSort,
  DestinationSortKey,
} from "@/types/traffic-flow-destinations";

const COLUMNS: { key: DestinationSortKey; label: string; numeric?: boolean }[] = [
  { key: "time", label: "Window" },
  { key: "address", label: "Outside address" },
  { key: "port", label: "Service (port)" },
  { key: "bytes_down", label: "Download", numeric: true },
  { key: "bytes_up", label: "Upload", numeric: true },
  { key: "bytes", label: "Total", numeric: true },
  { key: "flows", label: "Flows", numeric: true },
];

/**
 * Master -> Traffic Lens -> Destinations: search a venue's destination
 * records (GET /destinations) and download them (GET /destinations/export).
 *
 * A record is venue-level: this venue, this outside address and service,
 * this five-minute window. It never says which device, and there is no
 * device filter, column or link here.
 *
 * Nothing is requested until Search is pressed, because every search and
 * download is written to the audit log. Sorting asks the server again (the
 * page is capped, so sorting the page alone would mislead) and is recorded
 * too.
 *
 * Kept apart, each in words: not searched yet, not measured for the period,
 * measured without protocol and port, nothing matched, and a failed request.
 */
export function TrafficFlowDestinations({
  routers,
  scope,
  onScope,
  rangeAt,
}: {
  routers: RouterFlowStatus[];
  scope: FlowScope;
  onScope: (next: FlowScope) => void;
  /** The range the page's control means at a given moment. */
  rangeAt: (now: number) => { since: string; until: string };
}) {
  const [organizationId, setOrganizationId] = useState("");
  const [form, setForm] = useState<DestinationFilterForm>(EMPTY_DESTINATION_FILTERS);
  const [sort, setSort] = useState<DestinationSort>(DEFAULT_DESTINATION_SORT);
  const [params, setParams] = useState<Record<string, string> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const q = useDestinationSearch(params);
  const download = useDestinationExport();
  const now = Date.now();

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

  /** A result belongs to the venue it was asked for: picking another venue
   * or router clears it rather than leave it under the new name. */
  const pickVenue = (patch: Partial<FlowScope>) => {
    setParams(null);
    setFormError(null);
    onScope({ ...scope, ...patch });
  };

  const field = (patch: Partial<DestinationFilterForm>) => {
    setFormError(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  /** The request the form means right now, or the reason there is none. */
  const build = (withSort: DestinationSort) =>
    destinationSearchParams(scope, rangeAt(Date.now()), form, withSort);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const built = build(sort);
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
    // Re-ask for the SAME search in the new order: same range, same filters.
    if (params) setParams({ ...params, sort: next.key, order: next.order });
  };

  const save = () => {
    // The search on screen if there is one, otherwise what the form says.
    let request = params;
    if (!request) {
      const built = build(sort);
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
      onError: (err) =>
        toast.error(requestErrorOf(err)?.message ?? "The download did not complete."),
    });
  };

  const r = q.data;
  const state = r ? rangeState(r, now) : null;
  const stateMessage = state ? rangeStateMessage(state) : null;
  const searched = r ? rangeLabel({ since: r.since, until: r.until }) : "";

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <select
          aria-label="Customer"
          className={`${M_INPUT} w-auto`}
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            pickVenue({ locationId: "", routerId: "" });
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
          onChange={(e) => pickVenue({ locationId: e.target.value, routerId: "" })}
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
          onChange={(e) => pickVenue({ routerId: e.target.value })}
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
        aria-label="Search destination records"
      >
        <div>
          <h3 className="text-sm font-semibold">Destination records</h3>
          <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">
            One record is one outside address and service the venue exchanged traffic with in a
            five-minute window. It is for the venue as a whole: no record says which device, and
            none is kept that could. {AUDIT_NOTE}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <MField label="Outside address or prefix">
              <input
                className={`${M_INPUT} font-mono`}
                placeholder="Any address"
                maxLength={64}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={form.address}
                onChange={(e) => field({ address: e.target.value })}
              />
            </MField>
          </div>
          <div className="w-40">
            <MField label="Protocol">
              <select
                className={M_INPUT}
                value={form.protocol}
                onChange={(e) => field({ protocol: e.target.value })}
              >
                {DESTINATION_PROTOCOL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </MField>
          </div>
          <div className="w-28">
            <MField label="Port">
              <input
                className={`${M_INPUT} tabular-nums`}
                placeholder="Any"
                inputMode="numeric"
                maxLength={5}
                value={form.port}
                onChange={(e) => field({ port: e.target.value.replace(/[^0-9]/g, "") })}
              />
            </MField>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Direction
            </span>
            <MSeg
              options={DESTINATION_DIRECTION_OPTIONS}
              value={form.direction}
              onChange={(direction) => field({ direction })}
            />
          </div>
          <div className="ml-auto flex gap-2">
            <MButton type="submit" disabled={!scope.locationId || q.isFetching}>
              <Search /> {q.isFetching ? "Searching…" : "Search"}
            </MButton>
            <MButton
              type="button"
              variant="outline"
              disabled={!scope.locationId || download.isPending}
              onClick={save}
            >
              <Download /> {download.isPending ? "Preparing…" : "Download CSV"}
            </MButton>
          </div>
        </div>
        {formError && (
          <p role="alert" className="text-xs text-destructive">
            {formError}
          </p>
        )}
      </form>

      {!scope.locationId ? (
        <Notice title="Pick a venue.">
          Destination records are kept per venue. Nothing is requested until a venue is picked and
          Search is pressed.
        </Notice>
      ) : params === null ? (
        <Notice title="Not searched yet.">
          Set a range and any filters, then press Search. Leave the filters empty to see every
          record in the range.
        </Notice>
      ) : q.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : q.isError || !r ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">The search did not complete.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {requestErrorOf(q.error)?.message ?? "The server did not answer."} No record is shown,
            because an error is not an empty result.
          </p>
        </div>
      ) : stateMessage ? (
        <Notice title={stateMessage.title}>
          {stateMessage.body} Searched: {searched}.
        </Notice>
      ) : (
        <div className={`space-y-2 ${q.isFetching ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium tabular-nums" aria-live="polite">
              {resultLine(r)}
            </p>
            <p className="text-xs text-muted-foreground">{searched}</p>
          </div>
          {r.total === 0 ? (
            <Notice title="No records match these filters.">
              Traffic was measured in this period; none of its destination records matched.
            </Notice>
          ) : (
            <>
              {totalsLine(r) && <p className="text-xs text-muted-foreground">{totalsLine(r)}</p>}
              <MTable
                head={
                  <>
                    {COLUMNS.map((c) => (
                      <MTh key={c.key}>
                        <SortButton
                          label={c.label}
                          state={ariaSort(sort, c.key)}
                          onClick={() => sortBy(c.key)}
                        />
                      </MTh>
                    ))}
                  </>
                }
              >
                {r.rows.map((row) => {
                  const v = recordView(row, now);
                  return (
                    <MTr key={v.key}>
                      <MTd className="whitespace-nowrap text-xs tabular-nums">{v.window}</MTd>
                      <MTd className="font-mono text-xs">{v.address}</MTd>
                      <MTd className="text-xs">{v.service}</MTd>
                      <MTd className="text-xs tabular-nums">{v.down}</MTd>
                      <MTd className="text-xs tabular-nums">{v.up}</MTd>
                      <MTd className="text-xs tabular-nums">{v.total}</MTd>
                      <MTd className="text-xs tabular-nums">{v.flows}</MTd>
                    </MTr>
                  );
                })}
              </MTable>
            </>
          )}
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {searchNotes(r).map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p>
              Service is a protocol and a port, with the port's standard name where it has one. It
              is not an application: nothing here inspects traffic contents. Sorting asks the server
              again for the same search.
            </p>
          </div>
        </div>
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
      className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground [&_svg]:h-3 [&_svg]:w-3 ${state === "none" ? "" : "text-foreground"}`}
    >
      {label}
      {state === "ascending" && <ArrowUp aria-hidden />}
      {state === "descending" && <ArrowDown aria-hidden />}
      <span className="sr-only">{state === "none" ? ", not sorted" : `, sorted ${state}`}</span>
    </button>
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
