import { useMemo } from "react";
import { X } from "lucide-react";
import { MButton, MTable, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { useServiceDestinations } from "@/hooks/useFlowDestinations";
import { requestErrorOf } from "@/services/api";
import {
  AUDIT_NOTE,
  serviceDestinationParams,
  serviceDestinationsView,
  serviceFromKey,
} from "@/lib/traffic-flow-destinations";

/**
 * Master -> Traffic Lens -> venue view: the destinations of ONE service
 * (GET /services/destinations), opened from a row of the Services table.
 *
 * Venue-level. It answers "where did this venue's TCP/443 traffic go", never
 * "which device sent it": there is no device in the request, the response or
 * the table behind it, and nothing here links to one.
 *
 * Every figure is a lower bound and says so. Opening this panel is recorded
 * in the audit log, so it fetches once per opening and never on its own.
 */
export function TrafficFlowServiceDestinations({
  scope,
  range,
  serviceKey,
  label,
  onClose,
}: {
  scope: { locationId: string; routerId: string };
  /** The range the venue view is showing, as explicit instants. */
  range: { since: string; until: string };
  /** "<protocol>/<port>", as the Services table keys its rows. */
  serviceKey: string;
  label: string;
  onClose: () => void;
}) {
  const { locationId, routerId } = scope;
  const { since, until } = range;
  const params = useMemo(() => {
    const service = serviceFromKey(serviceKey);
    return service
      ? serviceDestinationParams({ locationId, routerId }, { since, until }, service)
      : null;
  }, [locationId, routerId, since, until, serviceKey]);
  const q = useServiceDestinations(params);
  const view = q.data ? serviceDestinationsView(q.data, Date.now()) : null;

  return (
    <section
      aria-label={`Destinations of ${label}`}
      className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Where {label} traffic went</h4>
          <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">
            Outside addresses for the venue as a whole. It does not say which device reached them,
            and nothing stored does. {AUDIT_NOTE}
          </p>
        </div>
        <MButton variant="ghost" onClick={onClose} aria-label="Close destinations">
          <X /> Close
        </MButton>
      </div>

      {!locationId ? (
        <p className="text-xs text-muted-foreground">
          Pick a venue to see a service's destinations. A router on its own is not enough: these
          records are kept per venue.
        </p>
      ) : !params ? (
        <p className="text-xs text-muted-foreground">This row is not a single service.</p>
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : q.isError || !view ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">Couldn't load this service's destinations.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {requestErrorOf(q.error)?.message ?? "The server did not answer."} Nothing is shown,
            because an error is not an empty list.
          </p>
        </div>
      ) : view.kind === "state" ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm">
          <p className="font-medium">{view.message.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{view.message.body}</p>
        </div>
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
          <MTable
            head={
              <>
                <MTh>Outside address</MTh>
                <MTh>Share of this service</MTh>
                <MTh>Download</MTh>
                <MTh>Upload</MTh>
              </>
            }
          >
            {view.rows.map((row) => (
              <MTr key={row.address}>
                <MTd className="font-mono text-xs">{row.address}</MTd>
                <MTd>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${row.barWidth}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-xs tabular-nums">{row.share}</span>
                  </div>
                </MTd>
                <MTd className="text-xs tabular-nums">{row.down}</MTd>
                <MTd className="text-xs tabular-nums">{row.up}</MTd>
              </MTr>
            ))}
          </MTable>
          <Notes notes={view.notes} />
        </>
      )}
    </section>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      {notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </div>
  );
}
