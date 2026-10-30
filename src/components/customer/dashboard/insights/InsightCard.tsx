import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChartEmptyState } from "../ChartEmptyState";
import { PANEL } from "../overview/console-ui";

/**
 * Card chrome for the insight widgets, in the dashboard's console look: the
 * same panel surface and header rhythm as every other Overview panel
 * (`overview/console-ui.tsx`), colours from the `--wy-*` tokens.
 */

export const CARD = PANEL;

/** Series slot 1 -- the hue the dashboard's charts lead with. A CSS colour
 * value (a `var()`), so mix it with `color-mix`, never a hex suffix. */
export const INSIGHT_PRIMARY = "var(--wy-series-1)";
/** Series slot 2, same order as the activity chart. */
export const INSIGHT_SECONDARY = "var(--wy-series-2)";

/** `INSIGHT_PRIMARY` at `alpha` (0-1) over transparent. */
export function primaryAt(alpha: number): string {
  return `color-mix(in srgb, ${INSIGHT_PRIMARY} ${Math.round(alpha * 100)}%, transparent)`;
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
  // Same header rhythm as the shared console `Panel` (min-h-11, title over
  // a one-line description, actions right). These cards build their header
  // inside the body, so they mirror it rather than wrap in Panel.
  return (
    <div className="-mx-4 -mt-4 mb-4 flex min-h-11 items-center gap-3 border-b border-[var(--wy-border)] px-4 py-2">
      <div className="min-w-0 flex-1">
        <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <span
            className="shrink-0 text-[var(--wy-text-faint)] [&_svg]:h-3.5 [&_svg]:w-3.5"
            aria-hidden
          >
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </h3>
        {subtitle && <p className="truncate text-xs text-[var(--wy-text-muted)]">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
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
    <section className={cn(CARD, "min-w-0 p-4", className)} data-testid={testId}>
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
          className="h-6 animate-pulse rounded-md bg-[var(--wy-surface-2)]"
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
