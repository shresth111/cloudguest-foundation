/**
 * Clean Enterprise primitives for the Master (Super Admin) dashboard:
 * rounded corners, subtle 1px borders, soft shadows, Inter. Kept separate
 * from the Aurora Teal console primitives so the two surfaces never bleed.
 */
import type { ComponentType, ReactNode } from "react";
import { X, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/ui-ext/PageShell";
import { AnimatedCounter } from "@/components/ui-ext/AnimatedCounter";

/* Right-side drawer. Rendered INLINE (no portal) so it stays inside the
 * .master-theme subtree and inherits the Modernist tokens/font. Mount
 * transition (backdrop fade + panel slide-in, `.m-backdrop-in`/
 * `.m-drawer-panel-in` in styles.css) is a shared v3 accent applied here
 * once so every drawer platform-wide picks it up automatically -- see
 * design-v3-unified-system-spec.md Part 5. */
export function MDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="m-backdrop-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="m-drawer-panel-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}

/* Centered modal dialog. Also inline (no portal). Mount transition
 * (`.m-backdrop-in`/`.m-dialog-panel-in`) same shared v3 accent as
 * `MDrawer` above. */
export function MDialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="m-backdrop-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "m-dialog-panel-in relative my-auto w-full rounded-xl border border-border bg-card shadow-2xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* Modernist labelled field. */
export function MField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* Rounded input/select base class. */
export const M_INPUT =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

/**
 * Master-scoped wrapper around the customer console's shared `PageShell`
 * (src/components/ui-ext/PageShell.tsx) -- max-width, vertical rhythm and
 * an optional sticky header/mesh backdrop, one primitive instead of every
 * master route hand-rolling its own top-level wrapper div. Every one of
 * the 14 `/master/*` routes renders this as the single child it hands to
 * `MasterShell`. Purely a container -- no page content or logic lives
 * here.
 */
export function MPageShell({
  children,
  header,
  mesh,
  className,
  contentClassName,
  empty,
}: {
  children: ReactNode;
  header?: ReactNode;
  mesh?: boolean;
  className?: string;
  contentClassName?: string;
  /**
   * Renders `MEmptyState` in place of `children` for a first-run "zero
   * X yet" moment (a channel-partner list with no partners onboarded,
   * a fresh tenant with no routers) -- see design-v3-unified-system-spec.md
   * Part 5. Pass this instead of a route hand-rolling its own empty-state
   * markup, so the one Aceternity-catalog-inspired accent this surface's
   * budget allows lives in one place, not scattered per route. `header`
   * (title/actions/filters) still renders as normal above it.
   */
  empty?: MEmptyStateProps;
}) {
  return (
    <PageShell
      header={header}
      mesh={mesh}
      className={cn("mx-auto w-full max-w-[1400px]", className)}
      contentClassName={contentClassName}
    >
      {empty ? <MEmptyState {...empty} /> : children}
    </PageShell>
  );
}

export interface MEmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * First-run empty-state card -- shadcn-plain frame, a restrained CSS
 * dot-field ("Sparkles" effect category) behind the icon/copy as the one
 * Aceternity-catalog-inspired moment this console's budget allows (Part 5),
 * hand-authored as `.m-empty-sparkle` (styles.css) instead of installing
 * the real framer-motion-backed Aceternity component: `MasterKit.tsx` is
 * imported by all 16 `/master/*` routes, so a new animation dependency
 * added here is a cost every route pays, not just the empty-state one --
 * same shared-bundle reasoning Part 3 uses to keep framer-motion off the
 * captive portal, just lower-stakes here. Reached via `MPageShell`'s
 * `empty` prop, never rendered directly by a route.
 */
export function MEmptyState({ icon: Icon, title, description, action }: MEmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-10 text-center">
      <span aria-hidden className="m-empty-sparkle pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center gap-3">
        {Icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

/* Section header: flush-left eyebrow + title, optional right actions,
 * underlined by a 2px rule. */
export function MSectionHeader({
  eyebrow,
  title,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
            {eyebrow}
          </div>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export type MStatTone = "default" | "success" | "warning" | "danger" | "info";
export type MStatTrend = "up" | "down" | "flat";

const M_STAT_ACCENT: Record<MStatTone, string> = {
  default: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
};

const M_STAT_ICON_BG: Record<MStatTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const M_STAT_TREND_TONE: Record<MStatTrend, string> = {
  up: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  down: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  flat: "bg-muted text-muted-foreground",
};

/**
 * KPI tile -- upgraded to the same pattern as the customer console's
 * `StatCard` (src/components/ui-ext/StatCard.tsx): a left accent rail
 * keyed to a semantic tone, the icon riding in its own tinted chip, an
 * animated count-up for numeric values, and an optional trend badge.
 * `label`/`value`/`delta`/`icon`/`accent` keep their exact old meaning
 * (`accent` still just means "ring-highlighted", same as before every
 * existing call site across the 14 master routes) -- `tone`/`trend` are
 * new, opt-in props, so no call site needs to change to pick this up.
 *
 * `beam` (v3) is the one Magic UI accent this KPI tile gets -- a slim
 * rotating "Border Beam"-style highlight ring (`.m-stat-beam` in
 * styles.css, hand-authored CSS `conic-gradient`, no new dependency), for
 * a hero/priority tile only. Opt-in and default-off so the other call
 * sites across the pre-v3 master routes render exactly as before -- see
 * design-v3-unified-system-spec.md Part 5 ("MStat is the one file to
 * touch for counter/KPI polish, not individual routes").
 */
export function MStat({
  label,
  value,
  delta,
  trend,
  tone = "default",
  icon: Icon,
  accent,
  beam,
}: {
  label: string;
  value: string | number;
  delta?: string;
  /** Shows `delta` as a coloured trend badge instead of plain muted text. */
  trend?: MStatTrend;
  tone?: MStatTone;
  icon?: ComponentType<{ className?: string }>;
  accent?: boolean;
  /** Opt-in rotating "Border Beam" highlight ring -- reserve for a single
   * hero/priority KPI tile, not every tile on a page. */
  beam?: boolean;
}) {
  const isNumeric = typeof value === "number";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        accent && "ring-1 ring-primary/30",
        beam && "m-stat-beam",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[3px] opacity-80",
          M_STAT_ACCENT[tone],
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                M_STAT_ICON_BG[tone],
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
        </div>
        {delta && trend && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              M_STAT_TREND_TONE[trend],
            )}
          >
            {trend === "up" ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : trend === "down" ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {isNumeric ? <AnimatedCounter value={value} /> : value}
      </div>
      {delta && !trend && (
        <div className="mt-1 text-xs font-medium text-muted-foreground">{delta}</div>
      )}
    </div>
  );
}

const TAG_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  online: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  trial: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  due: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  degraded: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  // `warning` is the literal severity value on Reminder/alert payloads
  // (see types/billing.ts's `Reminder.severity: "info" | "warning" |
  // "critical"`) -- same amber tone as `degraded`/`pending`/`high` above,
  // added explicitly rather than relying on a label match so any screen
  // passing `tone="warning"` gets it, not just ones whose `label` text
  // happens to be the word "warning".
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  normal: "bg-muted text-muted-foreground",
  info: "bg-muted text-muted-foreground",
  brand: "bg-primary/10 text-primary",
  suspended: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  offline: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  overdue: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  open: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  // Same gap as `warning` above: `Reminder.severity`'s "critical" value
  // (the single most urgent tone the type allows) had no entry here, so it
  // silently fell through to the plain-gray `normal` default -- on
  // Platform Overview's own "Billing Reminders" widget
  // (master.index.tsx's `<MTag label={r.severity} />`), a critical
  // (about-to-suspend) reminder rendered visually identical to a routine
  // one. `RemindersPanel` (components/billing/RemindersPanel.tsx), which
  // reads the exact same `Reminder.severity` field, already colors
  // "critical" rose -- this brings MTag's own fallback in line with that.
  critical: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

/* Pill-shaped status/priority tag, soft tinted background. */
export function MTag({ label, tone }: { label: string; tone?: string }) {
  const key = (tone ?? label).toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        TAG_STYLES[key] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/* Segmented control -- rounded pill group, primary active fill. */
export function MSeg<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-muted/60 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Primary/secondary button, rounded, soft shadow on primary. */
export function MButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors [&_svg]:h-4 [&_svg]:w-4",
        variant === "primary" && "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
        variant === "outline" &&
          "border border-border bg-card text-foreground hover:border-primary hover:bg-accent",
        variant === "ghost" && "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Data table wrapper with rounded card frame. `loading` (v3) swaps
 * `children` for `skeletonRows` shimmering placeholder rows -- the Magic
 * UI shimmer-skeleton accent Part 5 calls for, reusing the existing
 * `shimmer` utility (already built for the customer console) rather than
 * a new mechanism, added once here so every route's loading state picks
 * it up automatically instead of hand-rolling a spinner block per route
 * (see master.channel-partners.tsx's own pre-v3 loading branch for what
 * this replaces going forward). Opt-in via `loading` -- omitting it
 * renders `children` exactly as before.
 */
export function MTable({
  head,
  children,
  loading,
  skeletonRows = 5,
}: {
  head: ReactNode;
  children: ReactNode;
  loading?: boolean;
  skeletonRows?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {head}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-border/70 last:border-0">
                  <td colSpan={999} className="px-4 py-3">
                    <div className="shimmer m-table-skel-bar" />
                  </td>
                </tr>
              ))
            : children}
        </tbody>
      </table>
    </div>
  );
}

export function MTh({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2.5 font-bold", className)}>{children}</th>;
}
export function MTd({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}
export function MTr({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border/70 last:border-0",
        onClick && "cursor-pointer transition-colors hover:bg-accent/60",
        className,
      )}
    >
      {children}
    </tr>
  );
}
