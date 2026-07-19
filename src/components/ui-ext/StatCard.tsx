import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "./AnimatedCounter";

export type StatTone = "default" | "primary" | "success" | "warning" | "danger" | "info";
export type StatTrend = "up" | "down" | "flat";

export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  delta?: string;
  trend?: StatTrend;
  tone?: StatTone;
  icon?: ComponentType<{ className?: string }>;
  footer?: ReactNode;
  className?: string;
}

const TONE_ACCENT: Record<StatTone, string> = {
  default: "bg-gradient-to-br from-primary/70 to-primary",
  primary: "bg-gradient-to-br from-primary to-[oklch(0.62_0.2_250)]",
  success: "bg-[image:var(--gradient-success)]",
  warning: "bg-[image:var(--gradient-warning)]",
  danger: "bg-[image:var(--gradient-danger)]",
  info: "bg-[image:var(--gradient-accent)]",
};

const TONE_ICON_BG: Record<StatTone, string> = {
  default: "bg-primary/10 text-primary",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const TREND_TONE: Record<StatTrend, string> = {
  up: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  down: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
  flat: "text-muted-foreground bg-muted",
};

/**
 * Enterprise KPI card with left accent rail, subtle hover lift and an
 * animated counter. Use everywhere instead of hand-rolled stat markup
 * so metrics stay visually consistent across dashboards.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  trend,
  tone = "default",
  icon: Icon,
  footer,
  className,
}: StatCardProps) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const isNumeric = typeof value === "number";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border-border/70 shadow-sm",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        "animate-fade-in",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[3px] opacity-80",
          TONE_ACCENT[tone],
        )}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  TONE_ICON_BG[tone],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
          </div>
          {delta && trend && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                TREND_TONE[trend],
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {delta}
            </span>
          )}
        </div>

        <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          {isNumeric ? <AnimatedCounter value={value as number} /> : <span>{value}</span>}
        </div>

        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {footer && <div className="mt-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}
