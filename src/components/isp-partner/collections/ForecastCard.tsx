/** "Predicted collections this week": every component with its base, its
 * rate and whether the rate is measured from this ISP's history or the
 * stated default. Nothing is computed here. */
import { MTable, MTd, MTh, MTr, MTag } from "@/components/master/MasterKit";
import { Card } from "@/components/isp-partner/kit";
import { percent } from "@/lib/isp-partner/collections";
import { formatDate } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import type { Forecast } from "@/services/isp-partner/collections-types";

export function ForecastCard({ forecast }: { forecast: Forecast }) {
  return (
    <Card title={`How "predicted this week" is worked out`}>
      <p className="mb-3 text-xs text-muted-foreground">
        Week {formatDate(forecast.week_start)} to {formatDate(forecast.week_end)}. {forecast.method}
      </p>
      <MTable
        head={
          <>
            <MTh>Part</MTh>
            <MTh className="text-right">Count</MTh>
            <MTh className="text-right">Amount (₹)</MTh>
            <MTh className="text-right">Rate</MTh>
            <MTh className="text-right">Expected (₹)</MTh>
          </>
        }
      >
        <MTr>
          <MTd>Already received this week</MTd>
          <MTd className="text-right tabular-nums">–</MTd>
          <MTd className="text-right tabular-nums">
            {formatRupees(forecast.collected_so_far_paise)}
          </MTd>
          <MTd className="text-right tabular-nums">100%</MTd>
          <MTd className="text-right tabular-nums">
            {formatRupees(forecast.collected_so_far_paise)}
          </MTd>
        </MTr>
        {forecast.components.map((c) => (
          <MTr key={c.key}>
            <MTd>
              <div>{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.basis}</div>
            </MTd>
            <MTd className="text-right tabular-nums">{c.count}</MTd>
            <MTd className="text-right tabular-nums">{formatRupees(c.base_paise)}</MTd>
            <MTd className="text-right tabular-nums">
              {percent(c.rate)} {!c.rate_measured && <MTag label="default" tone="offline" />}
            </MTd>
            <MTd className="text-right tabular-nums">{formatRupees(c.expected_paise)}</MTd>
          </MTr>
        ))}
        <MTr>
          <MTd className="font-semibold">Predicted for the week</MTd>
          <MTd />
          <MTd />
          <MTd />
          <MTd className="text-right font-semibold tabular-nums">
            {formatRupees(forecast.predicted_total_paise)}
          </MTd>
        </MTr>
      </MTable>
    </Card>
  );
}
