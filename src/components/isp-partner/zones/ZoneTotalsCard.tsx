/**
 * Reports → Collections and dues → Zone totals (ZONE-1 §3). Per zone and
 * rolled up over its sub-zones: invoiced, collected (JAZE-4 zone revenue) and
 * the J10 ledger balance when the ledger is switched on. Plain dates on the
 * wire. Renders nothing while zones are off (404).
 */
import { useMemo, useState } from "react";
import { MTable, MTd, MTh, MTr, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock } from "@/components/isp-partner/kit";
import { useZoneTotals } from "@/hooks/isp-partner/useZoneTree";
import { ispErrorStatus } from "@/lib/isp-partner/errors";
import { isoDay } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { orderTotalsDepthFirst } from "@/lib/isp-partner/zones";

export function ZoneTotalsCard() {
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(isoDay(today));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const q = useZoneTotals(from, to, valid);
  const rows = useMemo(() => orderTotalsDepthFirst(q.data?.items ?? []), [q.data]);
  if (ispErrorStatus(q.error) === 404) return null;
  const ledger = !!q.data?.ledger_enabled;

  return (
    <Card
      title="Zone totals"
      actions={
        <div className="flex items-center gap-2">
          <input
            type="date"
            className={`${M_INPUT} w-auto py-1`}
            value={from}
            aria-label="From"
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            className={`${M_INPUT} w-auto py-1`}
            value={to}
            aria-label="To"
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      }
    >
      {!valid ? (
        <p className="text-xs text-destructive">Pick a start date on or before the end date.</p>
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="zone totals" />
      ) : !q.isLoading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No zones yet.</p>
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Zone</MTh>
              <MTh className="text-right">Subscribers</MTh>
              <MTh className="text-right">Invoiced</MTh>
              <MTh className="text-right">Collected</MTh>
              {ledger && <MTh className="text-right">Ledger balance</MTh>}
            </>
          }
        >
          {rows.map((r) => (
            <MTr key={r.zone_id}>
              <MTd>
                <span style={{ paddingLeft: `${r.depth * 1}rem` }} className="font-medium">
                  {r.name}
                </span>
              </MTd>
              <MTd className="text-right tabular-nums">
                {r.subtree_subscribers}
                {r.subtree_subscribers !== r.subscribers && (
                  <span className="block text-[10px] text-muted-foreground">
                    {r.subscribers} directly
                  </span>
                )}
              </MTd>
              <MTd className="text-right tabular-nums">
                {formatRupees(r.subtree_invoiced_paise)}
                {r.subtree_invoiced_paise !== r.invoiced_paise && (
                  <span className="block text-[10px] text-muted-foreground">
                    {formatRupees(r.invoiced_paise)} directly
                  </span>
                )}
              </MTd>
              <MTd className="text-right tabular-nums">
                {formatRupees(r.subtree_collected_paise)}
                {r.subtree_collected_paise !== r.collected_paise && (
                  <span className="block text-[10px] text-muted-foreground">
                    {formatRupees(r.collected_paise)} directly
                  </span>
                )}
              </MTd>
              {ledger && (
                <MTd className="text-right tabular-nums">
                  {r.subtree_balance_paise === null ? "–" : formatRupees(r.subtree_balance_paise)}
                </MTd>
              )}
            </MTr>
          ))}
        </MTable>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Each row includes the zones under it; &ldquo;directly&rdquo; is the zone on its own.
        Collected is payments received in the range against the zone&apos;s invoices.
      </p>
    </Card>
  );
}
