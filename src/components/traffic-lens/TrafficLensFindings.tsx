import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Flag, Info, Minus, ShieldAlert } from "lucide-react";
import {
  browserChecksView,
  findingsView,
  type FindingCard,
  type FindingsView,
} from "@/lib/traffic-lens-findings";
import type { LensCheck } from "@/lib/traffic-lens-insights";
import type { FindingsResponse } from "@/types/traffic-lens-findings";

/**
 * "Worth a look", from the server's findings. One block for the customer
 * page and the Master venue view: flagged first and each opens to its
 * evidence, checks that could not run are said one by one, and everything
 * that was checked and not flagged is a single line.
 *
 * Presentation only. Every word and row comes from `findingsView`
 * (src/lib/traffic-lens-findings.ts); nothing here decides what a number
 * means. Amber is "look"; the alarm colour is used for "act" alone.
 */

const SURFACE = {
  customer: "premium-card rounded-2xl p-5 sm:p-6",
  master: "rounded-xl border border-border bg-card p-4",
} as const;

const TONE = {
  act: {
    box: "border-destructive/60 bg-destructive/10",
    icon: <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />,
    label: "Needs action",
  },
  look: {
    box: "border-amber-500/60 bg-amber-500/10",
    icon: <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />,
    label: "Worth a look",
  },
  info: {
    box: "border-border bg-muted/40",
    icon: <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />,
    label: "Worth knowing",
  },
} as const;

export function TrafficLensFindings({
  data,
  isLoading,
  isError,
  now,
  surface,
  fallbackChecks,
}: {
  data: FindingsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  now: number;
  surface: keyof typeof SURFACE;
  /** The page's own checks, shown through this same block when the server's
   * findings could not be loaded. Without them the block says so; it never
   * shows a failed request as "nothing flagged". */
  fallbackChecks?: LensCheck[];
}) {
  if (isLoading)
    return <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-label="Loading checks" />;
  if (isError || !data) {
    if (fallbackChecks)
      return <FindingsBody view={browserChecksView(fallbackChecks)} surface={surface} />;
    return (
      <Shell surface={surface} sub="The checks could not be loaded">
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing is shown, because a request that failed is not a clear result. Refresh to try
          again.
        </p>
      </Shell>
    );
  }
  return <FindingsBody view={findingsView(data, now)} surface={surface} />;
}

function Shell({
  surface,
  sub,
  children,
}: {
  surface: keyof typeof SURFACE;
  sub: string;
  children: ReactNode;
}) {
  return (
    <section aria-label="Worth a look" className={SURFACE[surface]}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className={
            surface === "customer"
              ? "font-display text-xl font-semibold tracking-tight"
              : "text-sm font-semibold"
          }
        >
          Worth a look
        </h3>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      {children}
    </section>
  );
}

function FindingsBody({ view, surface }: { view: FindingsView; surface: keyof typeof SURFACE }) {
  return (
    <Shell surface={surface} sub={view.heading}>
      {view.flagged.length > 0 && (
        <ul className="mt-4 space-y-3">
          {view.flagged.map((c) => (
            <FlaggedCard key={c.id} card={c} />
          ))}
        </ul>
      )}

      {view.unchecked.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Could not be checked
          </p>
          <ul className="mt-2 space-y-2">
            {view.unchecked.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <span className="font-medium">{c.name}.</span>{" "}
                  <span className="text-muted-foreground">{c.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.clearLine && (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{view.clearLine}</span>
        </p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        {view.basis}
        {view.withheldNote ? ` ${view.withheldNote}` : ""}
        {view.credit && (
          <>
            {" "}
            <a
              href={view.credit.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {view.credit.text}
            </a>
            {view.credit.date ? `, list dated ${view.credit.date}.` : "."}
          </>
        )}
      </p>
    </Shell>
  );
}

function FlaggedCard({ card }: { card: FindingCard }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[card.tone ?? "look"];
  const panel = `finding-${card.id}`;
  const canOpen = card.rows.length > 0;
  return (
    <li className={`rounded-xl border p-4 ${tone.box}`}>
      <div className="flex items-start gap-2">
        {tone.icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {card.name}
            <span className="sr-only"> ({tone.label})</span>
          </p>
          <p className="mt-1 text-sm leading-relaxed">{card.text}</p>
          {card.next && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{card.next}</p>
          )}
          {canOpen && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panel}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
              {open ? "Hide the figures" : "Show the figures"}
            </button>
          )}
          {canOpen && open && (
            <dl id={panel} className="mt-3 divide-y divide-border/60 text-xs">
              {card.rows.map((r, i) => (
                <div key={`${r.label}-${i}`} className="grid gap-1 py-1.5 sm:grid-cols-5">
                  <dt className="break-all font-medium sm:col-span-2">{r.label}</dt>
                  <dd className="text-muted-foreground sm:col-span-3">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </li>
  );
}
