/**
 * SMALL-3: win-back save rate on the Churn risk tab. Counts only
 * (`isp_billing.read`); the BE decides "saved" (renewal or payment within
 * the window after the action) in its 120 s pass.
 */
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/isp-partner/kit";
import { formatNumber } from "@/lib/isp-partner/format";
import { formatRate, SAVE_RATE_KEY, WINBACK_LABEL } from "@/lib/isp-partner/winback";
import { winbackService } from "@/services/isp-partner/winback";
import type { WinbackAction } from "@/services/isp-partner/winback-types";

export function SaveRateCard({ days = 90 }: { days?: number }) {
  const q = useQuery({
    queryKey: [...SAVE_RATE_KEY, days],
    queryFn: () => winbackService.saveRate(days),
    retry: false,
  });
  if (q.isError || !q.data) return null;
  const d = q.data;
  return (
    <Card title={`Win-back save rate (last ${d.days} days)`}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
        <p>
          <span className="text-2xl font-semibold tabular-nums" data-testid="save-rate">
            {formatRate(d.save_rate)}
          </span>{" "}
          <span className="text-xs text-muted-foreground">
            {formatNumber(d.saved)} saved · {formatNumber(d.lost)} lost · {formatNumber(d.pending)}{" "}
            still within {d.window_days} days
          </span>
        </p>
        {(Object.keys(WINBACK_LABEL) as WinbackAction[]).map((a) => {
          const b = d.by_action[a];
          if (!b || b.actions === 0) return null;
          return (
            <p key={a} className="text-xs text-muted-foreground">
              {WINBACK_LABEL[a]}: {formatRate(b.save_rate)} ({formatNumber(b.actions)})
            </p>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{d.definition}</p>
    </Card>
  );
}
