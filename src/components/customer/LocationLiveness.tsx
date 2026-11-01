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
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { lastContactLabel, livenessTone } from "@/lib/location-liveness";
import type { LocationLiveness, RouterLiveness, LivenessTone } from "@/lib/location-liveness";

/**
 * Badge colours per tone, from the console status tokens. `neutral` -- "no
 * router yet" and "can't tell" -- is the grey `--wy-offline` rather than
 * red: neither is a fault, and painting them as one is the collapse this
 * whole change undoes.
 */
const BADGE_STYLE: Record<LivenessTone, string> = {
  live: "bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]",
  warn: "bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]",
  down: "bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]",
  neutral: "bg-[var(--wy-offline-soft)] text-[var(--wy-offline)]",
};

/**
 * The `dark` surface (the venue picker's indigo backdrop) sits outside any
 * `.wy-console` wrapper, so the badge scopes the tokens itself, in their
 * dark values (`.dark.wy-console` in styles.css): soft fills that read on
 * indigo and foregrounds that pass AA on them.
 */
const SURFACE_SCOPE: Record<"dark" | "light", string> = {
  dark: "wy-console dark",
  light: "",
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
      // Lets the console top bar re-colour the badge from its status
      // tokens (styles.css, `.wy-topbar [data-liveness-tone]`).
      data-liveness-tone={tone}
      className={cn(
        SURFACE_SCOPE[surface],
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[11px] font-semibold",
        BADGE_STYLE[tone],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {liveness.label}
    </span>
  );
}

function statusIcon(status: RouterLiveness["status"]) {
  if (status === "pass")
    return <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wy-ok)]" />;
  if (status === "fail")
    return <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wy-crit)]" />;
  return <HelpCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wy-warn)]" />;
}

/** One router: what it is doing, when we last heard from it, what to do. */
function RouterLivenessRow({ router, now }: { router: RouterLiveness; now: Date }) {
  return (
    <li className="flex gap-2 text-[13px]">
      {statusIcon(router.status)}
      <div className="min-w-0 space-y-0.5">
        <div className="font-medium text-[var(--wy-text)]">
          {router.label}
          {router.status === "unknown" && (
            <span className="ml-2 text-xs font-normal text-[var(--wy-warn)]">not verifiable</span>
          )}
        </div>
        <p className="text-[var(--wy-text-muted)]">{router.detail}</p>
        <p className="text-xs text-[var(--wy-text-faint)]">{lastContactLabel(router, now)}</p>
        {router.nextStep && router.status !== "pass" && (
          <p className="text-[var(--wy-text)]">Next step: {router.nextStep}</p>
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
  const { t } = useTranslation("dashboard", { i18n });
  const tone = livenessTone(liveness.state);
  const nothingToSay = liveness.state === "live" && liveness.nextStep === null;
  if (nothingToSay) return null;
  // A router that is not checking in is something the venue owner hands to
  // us, not something they fix from a terminal -- so the action is a ticket.
  const offerTicket = liveness.state === "partly-live" || liveness.state === "not-live";

  const HeadIcon = tone === "down" ? AlertTriangle : tone === "neutral" ? CircleDashed : HelpCircle;

  return (
    <div
      className={cn(
        "rounded-[var(--wy-radius)] border p-4 text-[var(--wy-text)]",
        tone === "down"
          ? "border-[color-mix(in_srgb,var(--wy-crit)_28%,transparent)] bg-[var(--wy-crit-soft)]"
          : tone === "warn" || tone === "live"
            ? "border-[color-mix(in_srgb,var(--wy-warn)_32%,transparent)] bg-[var(--wy-warn-soft)]"
            : "border-[var(--wy-border)] bg-[var(--wy-surface-2)]",
        className,
      )}
    >
      <div className="flex gap-2">
        <HeadIcon
          aria-hidden
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            tone === "down"
              ? "text-[var(--wy-crit)]"
              : tone === "neutral"
                ? "text-[var(--wy-offline)]"
                : "text-[var(--wy-warn)]",
          )}
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{liveness.label}</p>
          <p className="text-[13px] text-[var(--wy-text-muted)]">{liveness.summary}</p>
          {liveness.nextStep && <p className="text-[13px]">Next step: {liveness.nextStep}</p>}
          {offerTicket && (
            <Link
              to="/tickets"
              className="inline-block rounded-sm text-[13px] font-medium text-[var(--wy-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
            >
              {t("liveness.raiseTicket", "Raise a support ticket")}
            </Link>
          )}
        </div>
      </div>

      {/* Per-router breakdown only where it adds something the summary
       * above did not already say: a single-router venue's summary IS its
       * router's detail, so repeating it verbatim is noise. */}
      {liveness.routers.length > 1 && (
        <ul className="mt-3 space-y-2.5 border-t border-[var(--wy-border)] pt-3">
          {liveness.routers.map((r) => (
            <RouterLivenessRow key={r.key} router={r} now={now} />
          ))}
        </ul>
      )}
      {liveness.routers.length === 1 && (
        <p className="mt-2 pl-6 text-xs text-[var(--wy-text-faint)]">
          {lastContactLabel(liveness.routers[0], now)}
        </p>
      )}
    </div>
  );
}
