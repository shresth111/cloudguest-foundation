/**
 * Modernist primitives for the Master (Super Admin) dashboard: flat,
 * zero-radius, 2px rules, flush-left labels, Archivo. Kept separate from
 * the Aurora Teal console primitives so the two surfaces never bleed.
 */
import type { ComponentType, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Right-side drawer. Rendered INLINE (no portal) so it stays inside the
 * .master-theme subtree and inherits the Modernist tokens/font. */
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-2 border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b-2 border-border p-5">
          <div>
            <h3 className="text-lg font-extrabold uppercase tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t-2 border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}

/* Centered modal dialog. Also inline (no portal). */
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn("relative my-auto w-full border-2 border-border bg-card shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b-2 border-border p-5">
          <h3 className="text-lg font-extrabold uppercase tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t-2 border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}

/* Modernist labelled field. */
export function MField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* Zero-radius input/select base class. */
export const M_INPUT =
  "w-full border-2 border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

/* Placeholder panel for screens slated for the next build pass. */
export function MStubPanel({
  icon: Icon,
  title,
  blurb,
  points,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  points: string[];
}) {
  return (
    <div className="border-2 border-border bg-card p-8">
      <div className="flex items-center gap-3 border-b-2 border-border pb-4">
        <span className="flex h-11 w-11 items-center justify-center bg-primary text-primary-foreground"><Icon className="h-5 w-5" /></span>
        <div>
          <p className="text-base font-extrabold uppercase tracking-tight">{title}</p>
          <p className="text-sm text-muted-foreground">{blurb}</p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 border-2 border-border p-3 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-primary" /> {p}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next build pass · wired to its API</p>
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
    <div className={cn("flex flex-wrap items-end justify-between gap-3 border-b-2 border-border pb-3", className)}>
      <div>
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>
        )}
        <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* KPI tile -- flush-left, 2px border, no radius. */
export function MStat({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={cn("border-2 border-border bg-card p-4", accent && "border-primary")}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground tabular-nums">{value}</div>
      {delta && <div className="mt-1 text-xs font-medium text-muted-foreground">{delta}</div>}
    </div>
  );
}

const TAG_STYLES: Record<string, string> = {
  active: "border-emerald-600 text-emerald-700 dark:text-emerald-400",
  online: "border-emerald-600 text-emerald-700 dark:text-emerald-400",
  paid: "border-emerald-600 text-emerald-700 dark:text-emerald-400",
  resolved: "border-emerald-600 text-emerald-700 dark:text-emerald-400",
  trial: "border-amber-600 text-amber-700 dark:text-amber-400",
  pending: "border-amber-600 text-amber-700 dark:text-amber-400",
  due: "border-amber-600 text-amber-700 dark:text-amber-400",
  degraded: "border-amber-600 text-amber-700 dark:text-amber-400",
  high: "border-amber-600 text-amber-700 dark:text-amber-400",
  normal: "border-border text-muted-foreground",
  suspended: "border-primary text-primary",
  offline: "border-primary text-primary",
  overdue: "border-primary text-primary",
  open: "border-primary text-primary",
  urgent: "border-primary text-primary",
};

/* Uppercase, zero-radius status/priority tag with a 1.5px border. */
export function MTag({ label, tone }: { label: string; tone?: string }) {
  const key = (tone ?? label).toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-[1.5px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        TAG_STYLES[key] ?? "border-border text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/* Segmented control -- flat, flush, 2px outer border, primary active fill. */
export function MSeg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex border-2 border-border">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
            i > 0 && "border-l-2 border-border",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Primary/secondary Modernist button (flush-left label). */
export function MButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors [&_svg]:h-4 [&_svg]:w-4",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "outline" && "border-2 border-border bg-card text-foreground hover:border-primary",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* Data table wrapper with Modernist 2px header rule. */
export function MTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border-2 border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-border text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
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
export function MTr({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
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
