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
import { ArrowDownUp, ChevronDown, Info, Radio, Users } from "lucide-react";
import type { ReactNode } from "react";
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
 * A generic ceiling-mount access point: a puck with a status LED under two
 * signal arcs. Original line art in the brand tint (no vendor artwork); the
 * LED is green only when the verdict is Active. Decorative -- the status is
 * spelled out in the pill beside it.
 */
function AccessPointGlyph({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C4EFF]/15 to-[#8B5CF6]/5 text-[#6C4EFF] ring-1 ring-inset ring-[#6C4EFF]/15 dark:from-[#6C4EFF]/30 dark:to-[#8B5CF6]/10 dark:text-indigo-300 dark:ring-indigo-400/20"
    >
      <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none">
        <path
          d="M11.5 12.5a12 12 0 0 1 17 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={active ? 0.45 : 0.25}
        />
        <path
          d="M15 16a7 7 0 0 1 10 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={active ? 0.8 : 0.4}
        />
        <rect
          x="8.5"
          y="20.5"
          width="23"
          height="10"
          rx="5"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M13 25.5h8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle
          cx="26.5"
          cy="25.5"
          r="1.9"
          className={active ? "fill-emerald-500 dark:fill-emerald-400" : "fill-slate-400"}
        />
      </svg>
    </div>
  );
}

/** "Active" (green) / "Idle" (grey). The word carries the meaning; the colour
 * only repeats it. */
function ApStatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25"
          : "bg-muted text-muted-foreground ring-border",
      )}
    >
      <span aria-hidden className="relative flex h-1.5 w-1.5">
        {active && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            active ? "bg-emerald-500" : "bg-slate-400",
          )}
        />
      </span>
      {label}
    </span>
  );
}

function StatTile({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-[#6C4EFF] shadow-sm ring-1 ring-border/60 dark:text-indigo-300"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tabular-nums leading-tight text-foreground">
          {value}
        </p>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * The ONE "managed in the Instant On app" note on the dashboard, collapsed:
 * the summary line is the whole message, the two lists are there for whoever
 * asks "so what can I change here?". It replaces the venue card and the
 * liveness explainer, which said the same sentence twice above it.
 */
function InstantOnManagedNote() {
  return (
    <details
      className="group rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs"
      data-testid="aruba-managed-note"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Info aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span>{ARUBA_AP_MANAGE_NOTE}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[#6C4EFF] dark:text-indigo-300">
          What's managed where
          <ChevronDown
            aria-hidden
            className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
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
    // Same shell and header as the Recent Users / Recent Alerts cards beside
    // it (CustomerDashboardPage's CARD + CardHead), so the row reads as one.
    <div
      className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
      data-testid="aruba-access-points-card"
    >
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6C4EFF]/10 text-[#6C4EFF] dark:bg-[#6C4EFF]/20 dark:text-indigo-300">
          <Radio aria-hidden className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Access points</h3>
          {state.status === "ok" && state.items.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="aruba-ap-count">
              {state.items.length} {state.items.length === 1 ? "access point" : "access points"}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {state.status === "loading" ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
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
              const meta = [ap.model, ap.name ? ap.mac : null].filter(Boolean) as string[];
              return (
                <li key={ap.id} className="py-3 first:pt-0 last:pb-0" data-testid="aruba-ap-row">
                  <div className="flex min-w-0 items-start gap-3">
                    <AccessPointGlyph active={v.active} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {apDisplayName(ap)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {meta.length === 0 ? (
                          <span className="font-mono tracking-tight">{ap.mac}</span>
                        ) : (
                          meta.map((x, i) => (
                            <span key={i}>
                              {i > 0 && " · "}
                              <span className={cn(x === ap.mac && "font-mono tracking-tight")}>
                                {x}
                              </span>
                            </span>
                          ))
                        )}
                      </p>
                      {/* textContent is exactly `v.sentence`: the pill holds
                          the label and a screen-reader-only separator joins
                          it to the evidence. */}
                      <p
                        className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"
                        data-testid="aruba-ap-verdict"
                      >
                        <ApStatusPill active={v.active} label={v.label} />
                        {v.detail && (
                          <>
                            <span className="sr-only"> · </span>
                            <span className="min-w-0">{v.detail}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <StatTile
                      icon={<Users className="h-3.5 w-3.5" />}
                      value={apCount(ap.clientsNow)}
                      label={v.countLabel}
                    />
                    <StatTile
                      icon={<ArrowDownUp className="h-3.5 w-3.5" />}
                      value={apDataToday(ap)}
                      label="data today"
                    />
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
        <div className="mt-auto">
          <InstantOnManagedNote />
        </div>
      </div>
    </div>
  );
}
