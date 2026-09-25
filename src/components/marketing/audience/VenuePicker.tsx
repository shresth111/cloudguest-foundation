import { MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMarketingScope, useOrgVenues } from "@/hooks/useMarketing";
import { useCustomerStore } from "@/stores/customerStore";

/**
 * Which venues' guests a campaign (or an audience count) covers.
 *
 * ORG-SCOPED callers get a picker: "All venues" (the default, `null` =
 * `location_ids` omitted, every venue of the organization) or any subset.
 *
 * LOCATION-SCOPED callers get NO picker -- their venue as fixed text. The
 * server confines them to it regardless (§5.0 LocScope), so offering a
 * choice would only offer refusals.
 */
export function VenuePicker({
  value,
  onChange,
}: {
  /** `null` = all venues. */
  value: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const scope = useMarketingScope();
  const venueName = useCustomerStore((s) => s.activeLocation?.name ?? null);
  const { venues, isLoading, isError } = useOrgVenues();

  if (scope.kind === "location") {
    return (
      <div className="space-y-1" data-testid="venue-fixed">
        <Label>Venue</Label>
        <p className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
          {venueName ?? "Your venue"}
        </p>
        <p className="text-[11px] text-muted-foreground">Your role covers this venue only.</p>
      </div>
    );
  }

  const all = value === null;
  const toggle = (id: string, on: boolean) => {
    const current = value ?? [];
    const next = on ? Array.from(new Set([...current, id])) : current.filter((x) => x !== id);
    onChange(next.length === 0 ? null : next);
  };

  return (
    <fieldset className="space-y-1.5" data-testid="venue-picker">
      <legend className="text-sm font-medium">Venues</legend>
      <label
        className={cn(
          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
          all ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <Checkbox checked={all} onCheckedChange={(v) => v && onChange(null)} />
        All venues
      </label>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading venues…</p>
      ) : isError ? (
        <p className="text-xs text-red-600">Couldn't load your venues. “All venues” still works.</p>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2">
          {venues.map((v) => (
            <label
              key={v.id}
              className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1 text-sm hover:bg-muted/50"
            >
              <Checkbox
                checked={!all && value.includes(v.id)}
                onCheckedChange={(c) => toggle(v.id, !!c)}
              />
              <span className="truncate">{v.name}</span>
            </label>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {all
          ? "Every venue in your organisation. Leave all unticked to keep it that way."
          : `${value.length} venue${value.length === 1 ? "" : "s"} selected.`}
      </p>
    </fieldset>
  );
}

/**
 * The venue filter on the lists (campaigns, delivery logs, contacts), for
 * ORG-SCOPED callers only -- a location-scoped caller is confined to their
 * venue by the server and gets no filter (renders nothing). `"all"` =
 * unfiltered; anything else is sent as the contract's `location_id` query.
 */
export function VenueFilterSelect({
  value,
  onChange,
  className = "w-44",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const scope = useMarketingScope();
  const { venues } = useOrgVenues();
  if (scope.kind !== "organization") return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} aria-label="Venue" data-testid="venue-filter">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All venues</SelectItem>
        {venues.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
