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
import { ChevronDown, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/friendly";
import { useArubaAccessPoints } from "@/hooks/useArubaAccessPoints";
import {
  ARUBA_AP_EMPTY,
  ARUBA_AP_MANAGE_NOTE,
  ARUBA_AP_UNAVAILABLE,
  apCount,
  apDataToday,
  apDisplayName,
  apUnattributedNote,
} from "@/lib/aruba-access-points";
import { apVerdict } from "@/lib/aruba-dashboard";
import { ARUBA_VENUE_IN_INSTANT_ON, ARUBA_VENUE_IN_WYFY } from "@/lib/aruba-venue";

/**
 * The ONE "managed in the Instant On app" note on the dashboard, collapsed:
 * the summary line is the whole message, the two lists are there for whoever
 * asks "so what can I change here?". It replaces the venue card and the
 * liveness explainer, which said the same sentence twice above it.
 */
function InstantOnManagedNote() {
  return (
    <details
      className="group border-t border-border/60 pt-3 text-xs"
      data-testid="aruba-managed-note"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>{ARUBA_AP_MANAGE_NOTE}</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground/80">
          What's managed where
          <ChevronDown
            aria-hidden
            className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 font-medium text-foreground">Here, in Wyfy</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {ARUBA_VENUE_IN_WYFY.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">In the Instant On app</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {ARUBA_VENUE_IN_INSTANT_ON.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

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
              // ONE verdict per AP: the label, its evidence and the meaning
              // of the guest counter all come from `apVerdict`, so "Idle"
              // can no longer sit beside "1 online now".
              const v = apVerdict(ap, relativeTime);
              return (
                <li
                  key={ap.id}
                  className="flex items-start justify-between gap-3 py-3"
                  data-testid="aruba-ap-row"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        v.active ? "bg-emerald-500" : "bg-muted-foreground/50",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {apDisplayName(ap)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[ap.model, ap.name ? ap.mac : null].filter(Boolean).join(" · ") || ap.mac}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px]",
                          v.active
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground",
                        )}
                        data-testid="aruba-ap-verdict"
                      >
                        {v.sentence}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-4 text-xs">
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{apCount(ap.clientsNow)}</p>
                      <p className="text-[10px] text-muted-foreground">{v.countLabel}</p>
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
        <InstantOnManagedNote />
      </CardContent>
    </Card>
  );
}
