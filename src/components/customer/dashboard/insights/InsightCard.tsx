import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChartEmptyState } from "../ChartEmptyState";

/**
 * Card chrome for the insight widgets. CARD / IconChip / CardHead are copies
 * of the private ones in CustomerDashboardPage.tsx so these widgets sit in the
 * same grid without that file exporting anything. Keep them in step.
 */

export const CARD =
  "rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-[box-shadow,border-color,transform] duration-200 hover:border-[#6C4EFF]/25 hover:shadow-[0_12px_28px_-18px_rgb(49_46_129/0.35)]";

/** Brand indigo -- the one hue the dashboard's charts lead with. */
export const INSIGHT_PRIMARY = "#6C4EFF";
/** Second categorical slot, same order as the dashboard's OS_COLORS. */
export const INSIGHT_SECONDARY = "#06B6D4";

function IconChip({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#6C4EFF]/10 bg-[#6C4EFF]/10 text-[#6C4EFF] shadow-sm dark:bg-[#6C4EFF]/20 dark:text-indigo-300">
      {children}
    </div>
  );
}

export function CardHead({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <IconChip>{icon}</IconChip>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function InsightCard({
  className,
  children,
  testId,
}: {
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className={cn(CARD, "p-5", className)} data-testid={testId}>
      {children}
    </section>
  );
}

export function InsightSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true" data-state="loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-6 animate-pulse rounded-md bg-muted"
          style={{ width: `${92 - i * 11}%` }}
        />
      ))}
    </div>
  );
}

export function InsightError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("insights", { i18n });
  return (
    <div
      className="flex min-h-32 flex-col items-center justify-center gap-2 text-center"
      role="alert"
      data-state="error"
    >
      <p className="text-xs text-muted-foreground">
        {t("loadError", "Couldn't load this right now.")}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("retry", "Retry")}
      </Button>
    </div>
  );
}

export function InsightEmpty({ label }: { label?: string }) {
  const { t } = useTranslation("insights", { i18n });
  return (
    <div className="min-h-32" data-state="empty">
      <ChartEmptyState label={label ?? t("notEnoughData", "Not enough data yet.")} />
    </div>
  );
}

export function InsightDemoNote() {
  const { t } = useTranslation("insights", { i18n });
  return (
    <div className="min-h-32" data-state="demo">
      <ChartEmptyState
        label={t(
          "demoNote",
          "Built from your venue's real guest logins, so there is nothing to show in the demo.",
        )}
      />
    </div>
  );
}
