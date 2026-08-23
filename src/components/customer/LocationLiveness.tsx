/**
 * The venue-owner-facing rendering of "is this location live, and if not,
 * why not".
 *
 * Extracted as one component because the badge logic was copy-pasted
 * between `switch-location.tsx` (the venue grid) and
 * `CustomerDashboardPage.tsx` (the header), and both re-derived the
 * three-way online/degraded/offline collapse independently. A single
 * component means a state added to `@/lib/location-liveness` cannot be
 * rendered correctly on one surface and wrongly on the other.
 *
 * The explainer deliberately mirrors the fleet wizard's `PreconditionRow`
 * (`src/components/routers/fleet-wizard/RouterFleetSetupWizard.tsx`):
 * icon, label, a `detail` sentence, and a "Next step:" line. That is the
 * pattern this codebase already shipped for "tell the operator which
 * precondition is unmet instead of timing out", and a venue owner needs
 * the same thing for the same reason.
 */
import { CheckCircle2, XCircle, HelpCircle, CircleDashed, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { lastContactLabel, livenessTone } from "@/lib/location-liveness";
import type { LocationLiveness, RouterLiveness, LivenessTone } from "@/lib/location-liveness";

/**
 * Badge palettes per surface. `neutral` -- "no router yet" and "can't
 * tell" -- is deliberately grey rather than red: neither is a fault, and
 * painting them as one is the collapse this whole change undoes.
 */
const BADGE_STYLE: Record<"dark" | "light", Record<LivenessTone, string>> = {
  dark: {
    live: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    down: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    neutral: "border-white/15 bg-white/10 text-white/70",
  },
  light: {
    live: "border-emerald-600/25 bg-emerald-500/10 text-emerald-700",
    warn: "border-amber-600/25 bg-amber-500/10 text-amber-700",
    down: "border-rose-600/25 bg-rose-500/10 text-rose-700",
    neutral: "border-border bg-muted text-muted-foreground",
  },
};

const DOT_STYLE: Record<LivenessTone, string> = {
  live: "bg-emerald-500",
  warn: "bg-amber-500",
  down: "bg-rose-500",
  neutral: "bg-muted-foreground/60",
};

/**
 * The pill. `label` already carries the specific state -- "Never checked
 * in", "Gone quiet", "No router yet", "Can't tell" -- rather than
 * everything-that-is-not-online sharing one word.
 *
 * The full sentence rides along as the accessible name and the title, so
 * the reason is reachable even where there is only room for the badge.
 */
export function LocationLivenessBadge({
  liveness,
  surface = "light",
  className,
}: {
  liveness: LocationLiveness;
  surface?: "dark" | "light";
  className?: string;
}) {
  const tone = livenessTone(liveness.state);
  return (
    <span
      title={liveness.summary}
      aria-label={`${liveness.label}. ${liveness.summary}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        BADGE_STYLE[surface][tone],
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_STYLE[tone])} />
      {liveness.label}
    </span>
  );
}

function statusIcon(status: RouterLiveness["status"]) {
  if (status === "pass")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "fail") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  return <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
}

/** One router: what it is doing, when we last heard from it, what to do. */
function RouterLivenessRow({ router, now }: { router: RouterLiveness; now: Date }) {
  return (
    <li className="flex gap-2 text-sm">
      {statusIcon(router.status)}
      <div className="min-w-0 space-y-0.5">
        <div className="font-medium text-foreground">
          {router.label}
          {router.status === "unknown" && (
            <span className="ml-2 text-xs font-normal text-amber-600">not verifiable</span>
          )}
        </div>
        <p className="text-muted-foreground">{router.detail}</p>
        <p className="text-xs text-muted-foreground">{lastContactLabel(router, now)}</p>
        {router.nextStep && router.status !== "pass" && (
          <p className="text-foreground">Next step: {router.nextStep}</p>
        )}
      </div>
    </li>
  );
}

/**
 * The "why" panel. Renders nothing at all when the location is live and
 * has nothing to caveat -- an all-clear does not need a paragraph, and
 * printing a reassuring one would be its own small fabrication.
 */
export function LocationLivenessExplainer({
  liveness,
  now = new Date(),
  className,
}: {
  liveness: LocationLiveness;
  now?: Date;
  className?: string;
}) {
  const tone = livenessTone(liveness.state);
  const nothingToSay = liveness.state === "live" && liveness.nextStep === null;
  if (nothingToSay) return null;

  const HeadIcon = tone === "down" ? AlertTriangle : tone === "neutral" ? CircleDashed : HelpCircle;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "down"
          ? "border-rose-600/25 bg-rose-500/[0.06]"
          : tone === "warn" || tone === "live"
            ? "border-amber-600/25 bg-amber-500/[0.06]"
            : "border-border bg-muted/40",
        className,
      )}
    >
      <div className="flex gap-2">
        <HeadIcon
          aria-hidden
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            tone === "down" ? "text-destructive" : "text-muted-foreground",
          )}
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{liveness.label}</p>
          <p className="text-sm text-muted-foreground">{liveness.summary}</p>
          {liveness.nextStep && (
            <p className="text-sm text-foreground">Next step: {liveness.nextStep}</p>
          )}
        </div>
      </div>

      {/* Per-router breakdown only where it adds something the summary
       * above did not already say: a single-router venue's summary IS its
       * router's detail, so repeating it verbatim is noise. */}
      {liveness.routers.length > 1 && (
        <ul className="mt-3 space-y-2.5 border-t pt-3">
          {liveness.routers.map((r) => (
            <RouterLivenessRow key={r.key} router={r} now={now} />
          ))}
        </ul>
      )}
      {liveness.routers.length === 1 && (
        <p className="mt-2 pl-6 text-xs text-muted-foreground">
          {lastContactLabel(liveness.routers[0], now)}
        </p>
      )}
    </div>
  );
}
