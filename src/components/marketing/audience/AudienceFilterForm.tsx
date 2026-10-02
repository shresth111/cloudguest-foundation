import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { VenuePicker } from "./VenuePicker";
import {
  MARKETING_CHANNELS,
  type AudienceFilter,
  type MarketingChannel,
  type MarketingStatus,
} from "@/types/marketing";
import { CHANNEL_ICON, channelStatusFor, useChannelLabel } from "../marketing-helpers";

function intOrNull(v: string, min: number, max: number): number | null {
  if (v.trim() === "") return null;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/**
 * Who a campaign is for (spec §5.3 AudienceFilter). Everything a venue can
 * narrow by; nothing it can widen past. Consent, the do-not-contact list,
 * blocked guests and a usable address are applied by the server on every
 * preview and again at send time, and are NOT settable here -- there is no
 * control on this form that could reach a guest who has not opted in.
 *
 * Venues: an org-scoped caller picks "All venues" (`location_ids` omitted)
 * or a subset; a location-scoped caller sees their venue as fixed text and
 * the server confines them to it (§5.0 LocScope rule 1). See VenuePicker.
 */
export function AudienceFilterForm({
  value,
  onChange,
  status,
  lockChannel = false,
}: {
  value: AudienceFilter;
  onChange: (f: AudienceFilter) => void;
  status: MarketingStatus;
  /** In the composer the channel is chosen in step 1 and fixed after. */
  lockChannel?: boolean;
}) {
  const label = useChannelLabel();
  const set = (patch: Partial<AudienceFilter>) => onChange({ ...value, ...patch });
  const dateError =
    value.visited_from && value.visited_to && value.visited_from > value.visited_to
      ? "“From” is after “to”."
      : null;
  const visitsError =
    value.min_visits != null && value.max_visits != null && value.min_visits > value.max_visits
      ? "Minimum is above maximum."
      : null;

  return (
    <div className="space-y-4">
      {!lockChannel && (
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <div className="grid grid-cols-3 gap-2">
            {MARKETING_CHANNELS.map((c: MarketingChannel) => {
              const Icon = CHANNEL_ICON[c];
              const cs = channelStatusFor(status.channels, c);
              const active = value.channel === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ channel: c })}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg border p-2.5 text-left text-xs transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="h-4 w-4" aria-hidden />
                    {label(c)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {(status.consent_counts[c] ?? 0).toLocaleString()} opted in
                    {cs && !cs.configured ? " · not live" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <VenuePicker
        value={value.location_ids ?? null}
        onChange={(ids) => set({ location_ids: ids })}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="af-from">Visited from</Label>
          <Input
            id="af-from"
            type="date"
            value={value.visited_from ?? ""}
            onChange={(e) => set({ visited_from: e.target.value || null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="af-to">Visited to</Label>
          <Input
            id="af-to"
            type="date"
            value={value.visited_to ?? ""}
            onChange={(e) => set({ visited_to: e.target.value || null })}
          />
        </div>
        {dateError && <p className="text-[11px] text-red-600 sm:col-span-2">{dateError}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="af-min">At least … visits</Label>
          <Input
            id="af-min"
            type="number"
            inputMode="numeric"
            min={1}
            value={value.min_visits ?? ""}
            onChange={(e) => set({ min_visits: intOrNull(e.target.value, 1, 100000) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="af-max">At most … visits</Label>
          <Input
            id="af-max"
            type="number"
            inputMode="numeric"
            min={1}
            value={value.max_visits ?? ""}
            onChange={(e) => set({ max_visits: intOrNull(e.target.value, 1, 100000) })}
          />
        </div>
        {visitsError && <p className="text-[11px] text-red-600 sm:col-span-2">{visitsError}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="af-away">Not seen for at least … days</Label>
          <Input
            id="af-away"
            type="number"
            inputMode="numeric"
            min={1}
            max={730}
            value={value.not_seen_for_days ?? ""}
            onChange={(e) => set({ not_seen_for_days: intOrNull(e.target.value, 1, 730) })}
          />
          <p className="text-[11px] text-muted-foreground">For win-back campaigns. 1–730.</p>
        </div>
        <label className="flex items-center gap-2 self-center text-sm">
          <Switch
            checked={!!value.require_name}
            onCheckedChange={(v) => set({ require_name: v })}
          />
          Only guests who gave their name
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Visit counts are across all your venues. Dates are in your organisation's timezone and
        include both days.
      </p>
    </div>
  );
}
