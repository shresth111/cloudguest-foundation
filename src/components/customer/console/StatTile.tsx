import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  /** What the number is, e.g. "Guests online". */
  label: ReactNode;
  /** The value, already formatted. Pass `null` while unknown -- renders an em dash, never a zero. */
  value: ReactNode | null;
  /** Unit or qualifier shown small after the value, e.g. "Mbps". */
  unit?: ReactNode;
  /** Change vs. the comparison period; sign decides the arrow. Omit when there is no real comparison. */
  delta?: {
    value: number;
    label: string;
    /** Is "up" good for this metric? Decides the colour. Default true. */ upIsGood?: boolean;
  };
  /** Slot under the value -- put a Recharts sparkline here, sized to its container. */
  sparkline?: ReactNode;
  /** One quiet line under the value: what it counts, or that it is partial ("of the first 100"). */
  hint?: ReactNode;
  /** Optional status dot / icon before the label. */
  leading?: ReactNode;
  /** Shows a skeleton instead of the value. */
  loading?: boolean;
  className?: string;
}

/** A dense KPI tile: label, big tabular value, optional delta and sparkline slot. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  sparkline,
  hint,
  leading,
  loading,
  className,
}: StatTileProps) {
  const dir = delta ? Math.sign(delta.value) : 0;
  const good = delta ? (dir === 0 ? null : dir > 0 === (delta.upIsGood ?? true)) : null;
  const DeltaIcon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-4 py-3 shadow-[var(--wy-shadow)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--wy-text-muted)]">
        {leading}
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-20 animate-pulse rounded bg-[var(--wy-surface-2)]" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--wy-text)]">
            {value ?? "—"}
          </span>
          {unit != null && value != null && (
            <span className="text-xs text-[var(--wy-text-faint)]">{unit}</span>
          )}
        </div>
      )}
      {hint != null && !loading && <p className="text-xs text-[var(--wy-text-faint)]">{hint}</p>}
      {delta && !loading && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs tabular-nums",
            good === null
              ? "text-[var(--wy-text-faint)]"
              : good
                ? "text-[var(--wy-ok)]"
                : "text-[var(--wy-crit)]",
          )}
        >
          <DeltaIcon aria-hidden className="h-3.5 w-3.5" />
          <span>{delta.label}</span>
        </div>
      )}
      {sparkline != null && <div className="mt-1 h-8 w-full">{sparkline}</div>}
    </div>
  );
}
