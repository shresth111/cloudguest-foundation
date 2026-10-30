import { Repeat } from "lucide-react";
import { formatCount, rangeLabel, sharePercent } from "./insights.format";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  CardHead,
  INSIGHT_PRIMARY,
  INSIGHT_SECONDARY,
  InsightCard,
  InsightDemoNote,
  InsightEmpty,
  InsightError,
  InsightSkeleton,
} from "./InsightCard";
import { useGuestMix } from "./useInsights";
import {
  DEFAULT_INSIGHT_RANGE_DAYS,
  type GuestMixData,
  type InsightRangeDays,
} from "./insights.types";

export function GuestMixCard({
  locationId,
  days = DEFAULT_INSIGHT_RANGE_DAYS,
  className,
}: {
  locationId: string;
  days?: InsightRangeDays;
  className?: string;
}) {
  const { t } = useTranslation("insights", { i18n });
  const q = useGuestMix(locationId, days);

  return (
    <InsightCard className={className} testId="insight-guest-mix">
      <CardHead
        icon={<Repeat className="h-4 w-4" />}
        title={t("mix.title", "New vs returning guests")}
        subtitle={rangeLabel(days)}
      />
      {q.isDemo ? (
        <InsightDemoNote />
      ) : q.isLoading ? (
        <InsightSkeleton rows={3} />
      ) : q.isError || !q.data ? (
        <InsightError onRetry={q.refetch} />
      ) : q.data.unique_guests === 0 ? (
        <InsightEmpty label={t("mix.empty", "No guests have connected here in this period yet.")} />
      ) : (
        <Mix data={q.data} />
      )}
    </InsightCard>
  );
}

function Mix({ data }: { data: GuestMixData }) {
  const { t } = useTranslation("insights", { i18n });
  const newPct = sharePercent(data.new_guests, data.unique_guests) ?? 0;
  const returningPct = sharePercent(data.returning_guests, data.unique_guests) ?? 0;
  const segments = [
    {
      key: "new",
      label: t("mix.new", "New"),
      value: data.new_guests,
      pct: newPct,
      color: INSIGHT_PRIMARY,
    },
    {
      key: "returning",
      label: t("mix.returning", "Returning"),
      value: data.returning_guests,
      pct: returningPct,
      color: INSIGHT_SECONDARY,
    },
  ];
  const historyDate = data.history_starts_at
    ? new Date(data.history_starts_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <p className="text-sm">
        <span className="font-display text-2xl font-bold tabular-nums tracking-[-0.03em]">
          {formatCount(data.unique_guests)}
        </span>{" "}
        <span className="text-muted-foreground">{t("mix.guests", "guests")}</span>
      </p>

      {/* Stacked bar: 2px surface gap between fills, rounded ends. */}
      <div
        className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={t("mix.aria", "{{new}} new and {{returning}} returning guests", {
          new: formatCount(data.new_guests),
          returning: formatCount(data.returning_guests),
        })}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${s.pct}%`, backgroundColor: s.color, minWidth: 4 }}
            />
          ))}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3">
        {segments.map((s) => (
          <li
            key={s.key}
            className="rounded-xl border border-border/60 p-3"
            data-testid={`mix-${s.key}`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              {s.label}
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatCount(s.value)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{s.pct}%</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-border/60 pt-3 text-sm">
        <span className="text-muted-foreground">
          {t("mix.repeatRate", "Came back on another day")}
        </span>
        <span className="font-semibold tabular-nums" data-testid="mix-repeat-rate">
          {data.repeat_visit_rate_percent == null ? "—" : `${data.repeat_visit_rate_percent}%`}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {t(
          "mix.repeatHelp",
          "{{count}} guests visited on two or more different days in this period.",
          { count: data.multi_visit_guests },
        )}
      </p>

      {!data.has_prior_history && (
        <p
          className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground"
          data-testid="mix-no-history"
        >
          {historyDate
            ? t(
                "mix.noHistory",
                "Our records for this venue start on {{date}}, so everyone in this period counts as new. Returning guests will show up as history builds.",
                { date: historyDate },
              )
            : t(
                "mix.noHistoryNoDate",
                "There are no earlier visits on record, so everyone counts as new for now.",
              )}
        </p>
      )}
    </div>
  );
}
