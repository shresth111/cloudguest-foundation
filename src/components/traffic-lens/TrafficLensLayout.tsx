import type { ReactNode } from "react";

/**
 * Layout pieces shared by the Traffic Lens customer views (Overview,
 * Countries). Markup only: no hook, no request, no wording of their own.
 */

/** A titled block of the page. The title is the question it answers. */
export function Panel({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="premium-card rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
          {note && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{note}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-sm">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

/** A full-width share bar. The figure is always printed beside it by the
 * caller, so the number never depends on reading the bar. */
export function RankBar({ width, color }: { width: number; color?: string | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${width}%`, background: color ?? "var(--primary)" }}
      />
    </div>
  );
}

export function Footnotes({ notes }: { notes: (string | null | undefined)[] }) {
  const shown = notes.filter((n): n is string => !!n);
  if (shown.length === 0) return null;
  return (
    <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
      {shown.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}
