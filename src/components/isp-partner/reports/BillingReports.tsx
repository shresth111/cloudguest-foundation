/**
 * Reports → Collections and dues (ADDENDUM_03 §12/§13).
 *
 * Chart per the dataviz rules: one axis (₹), two series with a legend
 * (invoiced in neutral, collected in the primary hue), thin bars with a 2px
 * gap, a per-bar hover readout, and the same numbers in a table.
 */
import { useMemo, useState } from "react";
import { MSeg, MStat, MTable, MTd, MTh, MTr, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, Spinner } from "@/components/isp-partner/kit";
import { useCollections, useOutstanding, useZones } from "@/hooks/isp-partner/useInvoices";
import { isoDay } from "@/lib/isp-partner/format";
import { PAYMENT_MODE_LABEL, formatRupees } from "@/lib/isp-partner/money";
import { indianFy } from "@/lib/isp-partner/invoices";
import type { CollectionsReport } from "@/services/isp-partner/invoices-types";

type GroupBy = "month" | "zone" | "package";

function CollectionsChart({ rows }: { rows: CollectionsReport["rows"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.invoiced_paise, r.collected_paise)));
  const h = hover !== null ? rows[hover] : null;
  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" /> Invoiced
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Collected
        </span>
        {h && (
          <span className="text-foreground">
            {h.key}: invoiced {formatRupees(h.invoiced_paise)} · collected{" "}
            {formatRupees(h.collected_paise)}
          </span>
        )}
      </figcaption>
      <div
        className="flex h-44 items-end gap-3 overflow-x-auto border-b border-border"
        role="img"
        aria-label="Invoiced and collected per group; the table below has the numbers"
        onMouseLeave={() => setHover(null)}
      >
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="flex h-full min-w-[28px] flex-1 flex-col justify-end"
            onMouseEnter={() => setHover(i)}
          >
            <div className="flex h-full items-end gap-[2px]">
              <div
                className={`w-1/2 rounded-t-[4px] ${hover === i ? "bg-muted-foreground/60" : "bg-muted-foreground/40"}`}
                style={{ height: `${(r.invoiced_paise / max) * 100}%` }}
              />
              <div
                className={`w-1/2 rounded-t-[4px] ${hover === i ? "bg-primary" : "bg-primary/80"}`}
                style={{ height: `${(r.collected_paise / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden text-[10px] text-muted-foreground">
        {rows.map((r) => (
          <span key={r.key} className="min-w-[28px] flex-1 truncate text-center" title={r.key}>
            {r.key}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function BillingReports() {
  const fy = indianFy(new Date());
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [from, setFrom] = useState(isoDay(fy.start));
  const [to, setTo] = useState(isoDay(new Date()));
  const [zoneId, setZoneId] = useState("");
  const zones = useZones();
  const q = useMemo(
    () => ({
      group_by: groupBy,
      since: new Date(`${from}T00:00:00`).toISOString(),
      until: new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString(),
    }),
    [groupBy, from, to],
  );
  const col = useCollections(q, from <= to);
  const out = useOutstanding({ zone_id: zoneId || undefined });
  const modes = useMemo(() => {
    const set = new Set<string>();
    (col.data?.rows ?? []).forEach((r) => Object.keys(r.by_mode ?? {}).forEach((m) => set.add(m)));
    return Array.from(set);
  }, [col.data]);

  return (
    <div className="space-y-4">
      <Card title="Collections">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <MSeg<GroupBy>
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "month", label: "By month" },
              { value: "zone", label: "By zone" },
              { value: "package", label: "By package" },
            ]}
          />
          <input
            type="date"
            aria-label="From"
            className={`${M_INPUT} w-auto`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            aria-label="To"
            className={`${M_INPUT} w-auto`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {col.isLoading ? (
          <Spinner />
        ) : col.error || !col.data ? (
          <ErrorBlock error={col.error} onRetry={() => col.refetch()} what="collections" />
        ) : col.data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing invoiced or collected in this range.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MStat label="Invoiced" value={formatRupees(col.data.totals.invoiced_paise)} />
              <MStat
                label="Collected"
                value={formatRupees(col.data.totals.collected_paise)}
                tone="success"
              />
            </div>
            <CollectionsChart rows={col.data.rows} />
            <MTable
              head={
                <>
                  <MTh>
                    {groupBy === "month" ? "Month" : groupBy === "zone" ? "Zone" : "Package"}
                  </MTh>
                  <MTh className="text-right">Invoiced</MTh>
                  <MTh className="text-right">Collected</MTh>
                  {modes.map((m) => (
                    <MTh key={m} className="text-right">
                      {PAYMENT_MODE_LABEL[m] ?? m}
                    </MTh>
                  ))}
                </>
              }
            >
              {col.data.rows.map((r) => (
                <MTr key={r.key}>
                  <MTd>{r.key}</MTd>
                  <MTd className="text-right tabular-nums">{formatRupees(r.invoiced_paise)}</MTd>
                  <MTd className="text-right tabular-nums">{formatRupees(r.collected_paise)}</MTd>
                  {modes.map((m) => (
                    <MTd key={m} className="text-right tabular-nums">
                      {formatRupees(r.by_mode?.[m] ?? 0)}
                    </MTd>
                  ))}
                </MTr>
              ))}
            </MTable>
          </div>
        )}
      </Card>

      <Card
        title="Outstanding dues"
        actions={
          <select
            className={`${M_INPUT} w-auto`}
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            aria-label="Zone"
          >
            <option value="">All zones</option>
            {(zones.data ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        }
      >
        {out.isLoading ? (
          <Spinner />
        ) : out.error || !out.data ? (
          <ErrorBlock error={out.error} onRetry={() => out.refetch()} what="outstanding dues" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MStat label="0-30 days" value={formatRupees(out.data.buckets["0_30"])} />
              <MStat
                label="31-60 days"
                value={formatRupees(out.data.buckets["31_60"])}
                tone="warning"
              />
              <MStat
                label="61-90 days"
                value={formatRupees(out.data.buckets["61_90"])}
                tone="warning"
              />
              <MStat
                label="Over 90 days"
                value={formatRupees(out.data.buckets["90_plus"])}
                tone="danger"
              />
            </div>
            {out.data.by_zone.length > 0 && !zoneId && (
              <div className="flex flex-wrap gap-2">
                {out.data.by_zone.map((z) => (
                  <span
                    key={z.zone_id ?? "none"}
                    className="rounded-full bg-muted px-2.5 py-1 text-[11px]"
                  >
                    {z.name}: {formatRupees(z.balance_paise)}
                  </span>
                ))}
              </div>
            )}
            {out.data.top_debtors.length > 0 && (
              <MTable
                head={
                  <>
                    <MTh>Top debtors</MTh>
                    <MTh className="text-right">Balance</MTh>
                    <MTh>Oldest due</MTh>
                  </>
                }
              >
                {out.data.top_debtors.map((d, i) => (
                  <MTr key={i}>
                    <MTd className="text-xs">
                      {d.subscriber ? (
                        <>
                          <span className="font-mono">{d.subscriber.username}</span>
                          {d.subscriber.name && (
                            <span className="text-muted-foreground"> · {d.subscriber.name}</span>
                          )}
                        </>
                      ) : (
                        (d.customer?.name ?? "–")
                      )}
                    </MTd>
                    <MTd className="text-right tabular-nums">{formatRupees(d.balance_paise)}</MTd>
                    <MTd className="text-xs">{d.oldest_due ?? "–"}</MTd>
                  </MTr>
                ))}
              </MTable>
            )}
            <p className="text-[11px] text-muted-foreground">As of {out.data.as_of}.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
