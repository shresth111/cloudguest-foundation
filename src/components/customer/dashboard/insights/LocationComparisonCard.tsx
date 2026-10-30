import { Building2 } from "lucide-react";
import { formatCount, livenessOf, rangeLabel, type Liveness } from "./insights.format";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CardHead,
  INSIGHT_PRIMARY,
  InsightCard,
  InsightError,
  InsightSkeleton,
} from "./InsightCard";
import { useLocationComparison } from "./useInsights";
import {
  DEFAULT_INSIGHT_RANGE_DAYS,
  type InsightRangeDays,
  type LocationComparisonItem,
} from "./insights.types";

const LIVENESS_DOT: Record<Liveness, string> = {
  online: "bg-emerald-500",
  partial: "bg-amber-500",
  offline: "bg-rose-500",
  none: "bg-muted-foreground/40",
};

/**
 * Every venue in the organization side by side. Renders nothing at all for a
 * single-venue organization (or in the demo, which has no tenant) -- there is
 * nothing to compare, and an empty card would only take space.
 */
export function LocationComparisonCard({
  days = DEFAULT_INSIGHT_RANGE_DAYS,
  className,
}: {
  days?: InsightRangeDays;
  className?: string;
}) {
  const { t } = useTranslation("insights", { i18n });
  const q = useLocationComparison(days);

  if (q.isDemo) return null;
  if (q.data && q.data.locations.length <= 1) return null;

  return (
    <InsightCard className={className} testId="insight-locations">
      <CardHead
        icon={<Building2 className="h-4 w-4" />}
        title={t("locations.title", "Your venues compared")}
        subtitle={rangeLabel(days)}
      />
      {q.isLoading ? (
        <InsightSkeleton rows={3} />
      ) : q.isError || !q.data ? (
        <InsightError onRetry={q.refetch} />
      ) : (
        <Table rows={q.data.locations} />
      )}
    </InsightCard>
  );
}

function Table({ rows }: { rows: LocationComparisonItem[] }) {
  const { t } = useTranslation("insights", { i18n });
  const maxGuests = Math.max(1, ...rows.map((r) => r.guests));
  const livenessText: Record<Liveness, string> = {
    online: t("locations.online", "Online"),
    partial: t("locations.partial", "Partly online"),
    offline: t("locations.offline", "Offline"),
    // Not "No router": the backend counts only agent-managed routers (a
    // controller never heartbeats), so an Omada or Aruba venue lands here
    // with its equipment working.
    none: t("locations.statusNotReported", "Status not reported"),
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-xs">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th scope="col" className="pb-2 font-medium">
                {t("locations.venue", "Venue")}
              </th>
              <th scope="col" className="pb-2 font-medium">
                {t("locations.guests", "Guests")}
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                {t("locations.sessions", "Connections")}
              </th>
              <th scope="col" className="pb-2 pl-4 font-medium">
                {t("locations.routerNow", "Router now")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const live = livenessOf(r);
              return (
                <tr
                  key={r.location_id}
                  className="border-b border-border/40 last:border-0"
                  data-testid={`location-row-${r.location_id}`}
                >
                  <th
                    scope="row"
                    className="max-w-[12rem] truncate py-2.5 pr-3 text-left font-medium"
                  >
                    {r.location_name}
                  </th>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-right font-semibold tabular-nums">
                        {formatCount(r.guests)}
                      </span>
                      <span className="h-1.5 flex-1 rounded-full bg-muted" aria-hidden="true">
                        <span
                          className="block h-1.5 rounded-full"
                          style={{
                            width: `${(r.guests / maxGuests) * 100}%`,
                            minWidth: r.guests > 0 ? 4 : 0,
                            backgroundColor: INSIGHT_PRIMARY,
                          }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{formatCount(r.sessions)}</td>
                  <td className="py-2.5 pl-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn("h-2 w-2 rounded-full", LIVENESS_DOT[live])}
                        aria-hidden="true"
                      />
                      {livenessText[live]}
                      {live !== "none" && (
                        <span className="tabular-nums text-muted-foreground">
                          {r.routers_online}/{r.routers_total}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {t(
          "locations.note",
          "“Router now” is the status at this moment, not uptime over the period.",
        )}
      </p>
    </div>
  );
}
