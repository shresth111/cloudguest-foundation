import {
  formatCount,
  hourLabel,
  hourRangeLabel,
  rangeLabel,
  stepFor,
  HEATMAP_STEPS,
} from "./insights.format";
import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  CardHead,
  INSIGHT_PRIMARY,
  InsightCard,
  InsightDemoNote,
  InsightEmpty,
  InsightError,
  InsightSkeleton,
} from "./InsightCard";
import { usePeakHours } from "./useInsights";
import {
  DEFAULT_INSIGHT_RANGE_DAYS,
  type InsightRangeDays,
  type PeakHourCell,
  type PeakHoursData,
} from "./insights.types";

/** Below this many sessions in the window a 7x24 grid is mostly noise. */
const MIN_SESSIONS_FOR_HEATMAP = 10;

/** Sequential, one hue, light -> dark: the brand indigo at rising opacity.
 * Five steps so neighbouring buckets stay tellable apart; zero is the muted
 * surface, not the lightest step, so "nobody came" never reads as "a few". */
const STEP_ALPHA: readonly number[] = [0.18, 0.34, 0.52, 0.72, 0.95].slice(0, HEATMAP_STEPS);

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_DEFAULTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function alphaHex(alpha: number): string {
  return Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
}

export function PeakHoursHeatmapCard({
  locationId,
  days = DEFAULT_INSIGHT_RANGE_DAYS,
  className,
}: {
  locationId: string;
  days?: InsightRangeDays;
  className?: string;
}) {
  const { t } = useTranslation("insights", { i18n });
  const q = usePeakHours(locationId, days);

  return (
    <InsightCard className={className} testId="insight-peak-hours">
      <CardHead
        icon={<Clock className="h-4 w-4" />}
        title={t("peak.title", "Busiest times")}
        subtitle={t("peak.subtitle", "Guest connections by day and hour · {{range}}", {
          range: rangeLabel(days),
        })}
      />
      {q.isDemo ? (
        <InsightDemoNote />
      ) : q.isLoading ? (
        <InsightSkeleton rows={7} />
      ) : q.isError || !q.data ? (
        <InsightError onRetry={q.refetch} />
      ) : q.data.total_sessions < MIN_SESSIONS_FOR_HEATMAP ? (
        <InsightEmpty
          label={t(
            "peak.notEnough",
            "Not enough guest connections yet to show a pattern. Check back after a busy week.",
          )}
        />
      ) : (
        <Heatmap data={q.data} />
      )}
    </InsightCard>
  );
}

function Heatmap({ data }: { data: PeakHoursData }) {
  const { t } = useTranslation("insights", { i18n });
  const [hovered, setHovered] = useState<PeakHourCell | null>(null);

  const { grid, max, peak } = useMemo(() => {
    const g = new Map<string, PeakHourCell>();
    let m = 0;
    let p: PeakHourCell | null = null;
    for (const c of data.cells) {
      g.set(`${c.weekday}:${c.hour}`, c);
      if (c.sessions > m) {
        m = c.sessions;
        p = c;
      }
    }
    return { grid: g, max: m, peak: p };
  }, [data.cells]);

  const dayName = (weekday: number) =>
    t(`weekday.${WEEKDAY_KEYS[weekday - 1]}`, WEEKDAY_DEFAULTS[weekday - 1]);

  const describe = (c: PeakHourCell) =>
    t("peak.cell", "{{day}} {{hours}}: {{sessions}} connections, {{guests}} guests", {
      day: dayName(c.weekday),
      hours: hourRangeLabel(c.hour),
      sessions: formatCount(c.sessions),
      guests: formatCount(c.guests),
    });

  return (
    <div>
      {peak && (
        <p className="mb-3 text-sm" data-testid="peak-summary">
          <span className="text-muted-foreground">{t("peak.busiest", "Busiest:")} </span>
          <span className="font-semibold">
            {dayName(peak.weekday)} {hourRangeLabel(peak.hour)}
          </span>
        </p>
      )}

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[520px] gap-[2px]"
          style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }}
          role="img"
          aria-label={
            peak
              ? t("peak.aria", "Guest connections by day and hour. Busiest: {{cell}}", {
                  cell: describe(peak),
                })
              : t("peak.title", "Busiest times")
          }
          onMouseLeave={() => setHovered(null)}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
            <Row
              key={weekday}
              weekday={weekday}
              label={dayName(weekday)}
              grid={grid}
              max={max}
              describe={describe}
              onHover={setHovered}
            />
          ))}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span
              key={h}
              className="pt-1 text-center text-[10px] tabular-nums text-muted-foreground"
              aria-hidden="true"
            >
              {h % 3 === 0 ? hourLabel(h).replace(" ", "") : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="min-h-4 text-foreground" aria-live="polite" data-testid="peak-hover">
          {hovered ? describe(hovered) : ""}
        </p>
        <div className="flex items-center gap-1.5 text-muted-foreground" aria-hidden="true">
          <span>{t("peak.fewer", "Fewer")}</span>
          <span className="h-3 w-3 rounded-[3px] bg-muted" />
          {STEP_ALPHA.map((a) => (
            <span
              key={a}
              className="h-3 w-3 rounded-[3px]"
              style={{ backgroundColor: `${INSIGHT_PRIMARY}${alphaHex(a)}` }}
            />
          ))}
          <span>{t("peak.more", "More")}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t("peak.timezone", "Times shown in {{tz}}.", { tz: data.timezone })}
      </p>
    </div>
  );
}

function Row({
  weekday,
  label,
  grid,
  max,
  describe,
  onHover,
}: {
  weekday: number;
  label: string;
  grid: Map<string, PeakHourCell>;
  max: number;
  describe: (c: PeakHourCell) => string;
  onHover: (c: PeakHourCell | null) => void;
}) {
  return (
    <>
      <span className="flex items-center text-[11px] text-muted-foreground">{label}</span>
      {Array.from({ length: 24 }, (_, hour) => {
        const cell = grid.get(`${weekday}:${hour}`);
        const step = stepFor(cell?.sessions ?? 0, max);
        const empty: PeakHourCell = { weekday, hour, sessions: 0, guests: 0 };
        const shown = cell ?? empty;
        return (
          <span
            key={hour}
            data-step={step}
            title={describe(shown)}
            onMouseEnter={() => onHover(shown)}
            className={step === 0 ? "h-5 rounded-[3px] bg-muted" : "h-5 rounded-[3px] ring-inset"}
            style={
              step === 0
                ? undefined
                : { backgroundColor: `${INSIGHT_PRIMARY}${alphaHex(STEP_ALPHA[step - 1])}` }
            }
          />
        );
      })}
    </>
  );
}
