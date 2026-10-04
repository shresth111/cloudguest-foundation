/**
 * "Access points" -- every access point of an Aruba Instant On venue, in one
 * list, read-only (DASHBOARD_PLAN P0-A3). Rendered ONLY at a NAS-only venue
 * (the caller checks `locationIsNasOnly`); MikroTik and Omada venues never
 * mount it and so never make its request.
 *
 * Data: `GET /locations/{id}/access-points` (P0-A2) -- per AP, guests on it
 * now and guest data today from this platform's own sign-in records, plus the
 * Instant On read where the venue has it. No fixture rows, no zeros standing
 * in for a failed read (see `lib/aruba-access-points.ts`). Customer copy names
 * the Instant On app only -- never RADIUS, NAS or a tunnel.
 */
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/friendly";
import { useArubaAccessPoints } from "@/hooks/useArubaAccessPoints";
import { InstantOnVenueData } from "@/components/customer/InstantOnPanels";
import {
  ARUBA_AP_EMPTY,
  ARUBA_AP_MANAGE_NOTE,
  ARUBA_AP_UNAVAILABLE,
  apCount,
  apDataToday,
  apDisplayName,
  apStatusDetail,
  apStatusLabel,
  apUnattributedNote,
} from "@/lib/aruba-access-points";

export function ArubaAccessPointsCard({ locationId }: { locationId: string }) {
  const state = useArubaAccessPoints(locationId);
  return (
    <Card className="premium-card h-full" data-testid="aruba-access-points-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Radio className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Access points</CardTitle>
        </div>
        {state.status === "ok" && state.items.length > 0 && (
          <span className="text-xs text-muted-foreground" data-testid="aruba-ap-count">
            {state.items.length} {state.items.length === 1 ? "access point" : "access points"}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === "loading" ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : state.status === "unavailable" ? (
          <p
            className="py-4 text-center text-xs text-muted-foreground"
            data-testid="aruba-ap-unavailable"
          >
            {ARUBA_AP_UNAVAILABLE}
          </p>
        ) : state.items.length === 0 ? (
          <p
            className="py-4 text-center text-xs text-muted-foreground"
            data-testid="aruba-ap-empty"
          >
            {ARUBA_AP_EMPTY}
          </p>
        ) : (
          <ul className="divide-y divide-border/60" data-testid="aruba-ap-list">
            {state.items.map((ap) => {
              const active = ap.status === "online";
              return (
                <li
                  key={ap.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="aruba-ap-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {apDisplayName(ap)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[ap.model, ap.name ? ap.mac : null].filter(Boolean).join(" · ") || ap.mac}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {apStatusDetail(ap, state.asOf, relativeTime)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        active
                          ? "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          active ? "bg-emerald-500" : "bg-muted-foreground/60",
                        )}
                      />
                      {apStatusLabel(ap.status)}
                    </span>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{apCount(ap.clientsNow)}</p>
                      <p className="text-[10px] text-muted-foreground">online now</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{apDataToday(ap)}</p>
                      <p className="text-[10px] text-muted-foreground">data today</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {state.status === "ok" && apUnattributedNote(state.unattributedClientsNow) && (
          <p className="text-xs text-muted-foreground" data-testid="aruba-ap-unattributed">
            {apUnattributedNote(state.unattributedClientsNow)}
          </p>
        )}
        {/* P1-K: what the Instant On app itself reports, when the venue's
            poll is on; "Data unavailable · source Instant On" otherwise. */}
        <InstantOnVenueData locationId={locationId} />
        <p className="text-xs text-muted-foreground">{ARUBA_AP_MANAGE_NOTE}</p>
      </CardContent>
    </Card>
  );
}
