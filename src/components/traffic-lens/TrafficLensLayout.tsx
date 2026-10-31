import type { ReactNode } from "react";
import { PANEL_SURFACE } from "@/components/customer/console";

/**
 * Layout pieces shared by the Traffic Lens customer views (Overview,
 * Countries). Markup only: no hook, no request, no wording of their own.
 * They sit on the console surface (docs/design/console-tokens.md): the same
 * hairline panel as every other customer screen. The panel header is drawn
 * here rather than through the console `Panel` because a Traffic Lens note
 * is a full sentence and must wrap, where `Panel`'s description truncates.
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
    <section className={PANEL_SURFACE}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--wy-border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--wy-text)]">{title}</h2>
          {note && (
            <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-[var(--wy-text-muted)]">
              {note}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border-strong)] p-4 text-[13px]">
      <p className="font-medium text-[var(--wy-text)]">{title}</p>
      {children && <p className="mt-1 text-xs text-[var(--wy-text-muted)]">{children}</p>}
    </div>
  );
}

/** A full-width share bar. The figure is always printed beside it by the
 * caller, so the number never depends on reading the bar. */
export function RankBar({ width, color }: { width: number; color?: string | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--wy-surface-2)]">
      <div
        className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${width}%`, background: color ?? "var(--wy-series-1)" }}
      />
    </div>
  );
}

export function Footnotes({ notes }: { notes: (string | null | undefined)[] }) {
  const shown = notes.filter((n): n is string => !!n);
  if (shown.length === 0) return null;
  return (
    <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-[var(--wy-text-faint)]">
      {shown.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}
