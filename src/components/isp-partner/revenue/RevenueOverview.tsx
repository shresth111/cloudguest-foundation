/**
 * Revenue hub → Overview (REVENUE-HUB). Read-only, from data the ISP already
 * has: KPI tiles, dues ageing, the month-by-month trend, the zone leaderboard
 * and the package mix. Every tile with a list opens exactly the rows it
 * counted (same backend rows). Lists name subscribers, so they need
 * `isp_billing.export`; a viewer sees the numbers only.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MDrawer, MStat, MTable, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useRevenueList } from "@/hooks/isp-partner/useRevenue";
import { formatDate, formatNumber } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import {
  AGEING_LABEL,
  AGEING_ORDER,
  METRIC_LABEL,
  formatRate,
  kpiTiles,
  monthLabel,
} from "@/lib/isp-partner/revenue";
import type { RevFilters, RevMetric, RevenueSummary } from "@/services/isp-partner/revenue-types";

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span className="block h-1.5 w-full rounded-full bg-muted" aria-hidden title={label}>
      {value > 0 && (
        <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      )}
    </span>
  );
}

function TileButton({
  canOpen,
  onOpen,
  label,
  title,
  children,
}: {
  canOpen: boolean;
  onOpen: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  if (!canOpen)
    return (
      <div title={title} className="rounded-xl">
        {children}
      </div>
    );
  return (
    <button
      type="button"
      className="rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title={title}
      aria-label={label}
      onClick={onOpen}
    >
      {children}
    </button>
  );
}

function DrillDrawer({
  metric,
  filters,
  onClose,
}: {
  metric: RevMetric | null;
  filters: RevFilters;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const q = useRevenueList(filters, metric, page);
  if (!metric) return null;
  const d = q.data;
  return (
    <MDrawer
      open
      onClose={onClose}
      title={`${METRIC_LABEL[metric]}${d ? ` (${formatNumber(d.total)})` : ""}`}
      subtitle="Exactly the rows counted in the tile, with the same month, zone and package."
    >
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this list" />
      ) : !q.isLoading && d && d.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in this tile for these filters.</p>
      ) : d?.kind === "invoices" ? (
        <div className="space-y-3">
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Invoice</MTh>
                <MTh>Subscriber</MTh>
                <MTh>Due</MTh>
                <MTh className="text-right">Balance</MTh>
              </>
            }
          >
            {d.items.map((i) => (
              <MTr key={i.invoice_id}>
                <MTd>
                  <Link
                    to="/partner/invoices/$invoiceId"
                    params={{ invoiceId: i.invoice_id }}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {i.number}
                  </Link>
                </MTd>
                <MTd className="text-xs">
                  {i.subscriber_id ? (
                    <Link
                      to="/partner/subscribers/$subscriberId"
                      params={{ subscriberId: i.subscriber_id }}
                      className="text-primary hover:underline"
                    >
                      {i.display_name || i.identifier || "–"}
                    </Link>
                  ) : (
                    i.display_name || "–"
                  )}
                  <span className="block text-muted-foreground">
                    {[i.customer_name, i.zone_name].filter(Boolean).join(" · ")}
                  </span>
                </MTd>
                <MTd className="text-xs">
                  {formatDate(i.due_date)}
                  <span className="block text-muted-foreground">
                    {i.days_past_due > 0
                      ? `${i.days_past_due} days late`
                      : i.days_past_due === 0
                        ? "due today"
                        : `in ${-i.days_past_due} days`}
                  </span>
                </MTd>
                <MTd className="text-right text-xs tabular-nums">
                  {formatRupees(i.balance_paise)}
                </MTd>
              </MTr>
            ))}
          </MTable>
          <Pager page={d.page} pages={d.pages} total={d.total} onPage={setPage} />
        </div>
      ) : (
        <div className="space-y-3">
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Subscriber</MTh>
                <MTh>Package</MTh>
                <MTh>Valid until</MTh>
                <MTh className="text-right">MRR</MTh>
              </>
            }
          >
            {d?.kind === "subscribers" &&
              d.items.map((i) => (
                <MTr key={i.id}>
                  <MTd>
                    <Link
                      to="/partner/subscribers/$subscriberId"
                      params={{ subscriberId: i.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {i.display_name || i.identifier || "–"}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {[
                        i.circuit_id != null ? `Circuit ${i.circuit_id}` : null,
                        i.customer_name,
                        i.zone_name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </MTd>
                  <MTd className="text-xs">{i.package_name ?? "No package"}</MTd>
                  <MTd className="text-xs">
                    {formatDate(i.valid_until)}
                    {i.churned_at && (
                      <span className="block text-muted-foreground">
                        churned {formatDate(i.churned_at)}
                      </span>
                    )}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {i.mrr_paise === null ? "–" : formatRupees(i.mrr_paise)}
                  </MTd>
                </MTr>
              ))}
          </MTable>
          {d && <Pager page={d.page} pages={d.pages} total={d.total} onPage={setPage} />}
        </div>
      )}
    </MDrawer>
  );
}

export function RevenueOverview({
  d,
  filters,
  onZone,
  onPackage,
}: {
  d: RevenueSummary;
  filters: RevFilters;
  onZone: (zone: string | null) => void;
  onPackage: (pkg: string) => void;
}) {
  const { can } = usePartner();
  const canList = can("isp_billing.export");
  const [open, setOpen] = useState<RevMetric | null>(null);
  const openIf = (m: RevMetric | null) => () => m && setOpen(m);
  const tiles = kpiTiles(d);
  const maxAge = Math.max(0, ...AGEING_ORDER.map((a) => d.ageing[a].amount_paise));
  const maxBilled = Math.max(0, ...d.trend.map((t) => t.net_billed_paise));
  const listHint = canList
    ? "Click a tile for the list behind it."
    : "Your role sees the totals only; the lists name subscribers.";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {tiles.map((t) => (
          <TileButton
            key={t.key}
            canOpen={canList && t.metric !== null}
            onOpen={openIf(t.metric)}
            title={d.definitions[t.def] ?? ""}
            label={`${t.label}: ${t.value}. Show the list`}
          >
            <MStat label={t.label} value={t.value} delta={t.sub} tone={t.tone ?? "default"} />
          </TileButton>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {monthLabel(d.month)} · MRR, ARPU and billed amounts exclude GST; dues and collections
        include it. Churned = expired for more than {d.churn_after_days} days. Hover a tile for its
        exact definition. {listHint}
      </p>

      <Card title="Dues ageing (days past the due date)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {AGEING_ORDER.map((a) => {
            const v = d.ageing[a];
            return (
              <TileButton
                key={a}
                canOpen={canList && v.invoices > 0}
                onOpen={() => setOpen(`dues_${a}`)}
                title={d.definitions.dues ?? ""}
                label={`${AGEING_LABEL[a]}: ${formatRupees(v.amount_paise)}. Show the invoices`}
              >
                <div className="space-y-1.5 rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">{AGEING_LABEL[a]}</p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatRupees(v.amount_paise)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(v.invoices)} invoices
                  </p>
                  <Bar value={v.amount_paise} max={maxAge} label={AGEING_LABEL[a]} />
                </div>
              </TileButton>
            );
          })}
        </div>
      </Card>

      <Card title="New vs lost, billed vs collected, by month">
        <MTable
          head={
            <>
              <MTh>Month</MTh>
              <MTh className="text-right">New</MTh>
              <MTh className="text-right">Lost</MTh>
              <MTh className="text-right">Net</MTh>
              <MTh className="text-right">Churn rate</MTh>
              <MTh className="text-right">Net billed</MTh>
              <MTh className="text-right">Collected</MTh>
              <MTh className="text-right">Collection</MTh>
              <MTh className="w-32">
                <span className="sr-only">Billed bar</span>
              </MTh>
            </>
          }
        >
          {[...d.trend].reverse().map((t) => (
            <MTr key={t.month}>
              <MTd className="text-xs">
                {monthLabel(t.month)}
                {t.partial && <span className="block text-muted-foreground">so far</span>}
              </MTd>
              <MTd className="text-right text-xs tabular-nums">{formatNumber(t.new)}</MTd>
              <MTd className="text-right text-xs tabular-nums">{formatNumber(t.lost)}</MTd>
              <MTd className="text-right text-xs tabular-nums">
                {t.net > 0 ? `+${t.net}` : t.net}
              </MTd>
              <MTd className="text-right text-xs tabular-nums">
                <span title={`${t.lost} lost of ${t.base_at_start} at the start of the month`}>
                  {formatRate(t.churn_rate)}
                </span>
              </MTd>
              <MTd className="text-right text-xs tabular-nums">
                {formatRupees(t.net_billed_paise)}
              </MTd>
              <MTd className="text-right text-xs tabular-nums">
                {formatRupees(t.collected_paise)}
              </MTd>
              <MTd className="text-right text-xs tabular-nums">{formatRate(t.collection_rate)}</MTd>
              <MTd>
                <Bar
                  value={t.net_billed_paise}
                  max={maxBilled}
                  label={`Net billed ${formatRupees(t.net_billed_paise)}`}
                />
              </MTd>
            </MTr>
          ))}
        </MTable>
        <p className="mt-2 text-xs text-muted-foreground">
          {d.definitions.churn_rate} {d.definitions.collected}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Zone leaderboard">
          {d.zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribers or invoices in view.</p>
          ) : (
            <MTable
              head={
                <>
                  <MTh>Zone</MTh>
                  <MTh className="text-right">Active</MTh>
                  <MTh className="text-right">MRR</MTh>
                  <MTh className="text-right">ARPU</MTh>
                  <MTh className="text-right">Collection</MTh>
                  <MTh className="text-right">Dues</MTh>
                  {d.zones.some((z) => z.wallet_balance_paise !== null) && (
                    <MTh className="text-right">Wallet</MTh>
                  )}
                </>
              }
            >
              {d.zones.map((z) => (
                <MTr key={z.zone_id ?? "none"} onClick={() => onZone(z.zone_id ?? "none")}>
                  <MTd className="text-xs font-medium">
                    {z.name ?? "No zone"}
                    {z.churned > 0 && (
                      <span className="block font-normal text-muted-foreground">
                        {z.churned} churned
                      </span>
                    )}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">{formatNumber(z.active)}</MTd>
                  <MTd className="text-right text-xs tabular-nums">{formatRupees(z.mrr_paise)}</MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {z.arpu_paise === null ? "–" : formatRupees(z.arpu_paise)}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    <span
                      title={`${formatRupees(z.collected_paise)} of ${formatRupees(z.net_billed_paise)} this month`}
                    >
                      {formatRate(z.collection_rate)}
                    </span>
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {formatRupees(z.dues_paise)}
                  </MTd>
                  {d.zones.some((x) => x.wallet_balance_paise !== null) && (
                    <MTd className="text-right text-xs tabular-nums">
                      {z.wallet_balance_paise === null ? "–" : formatRupees(z.wallet_balance_paise)}
                    </MTd>
                  )}
                </MTr>
              ))}
            </MTable>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Click a zone to see the hub for that zone only. {d.definitions.zones}
          </p>
        </Card>

        <Card title="Package mix (active subscribers)">
          {d.packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active subscribers in view.</p>
          ) : (
            <MTable
              head={
                <>
                  <MTh>Package</MTh>
                  <MTh className="text-right">Active</MTh>
                  <MTh className="text-right">MRR</MTh>
                  <MTh className="text-right">Share</MTh>
                  <MTh className="w-28">
                    <span className="sr-only">Share bar</span>
                  </MTh>
                </>
              }
            >
              {d.packages.map((p) => (
                <MTr
                  key={p.package_id ?? "none"}
                  onClick={p.package_id ? () => onPackage(p.package_id as string) : undefined}
                >
                  <MTd className="text-xs font-medium">
                    {p.name ?? "No package"}
                    {p.unpriced > 0 && (
                      <span className="block font-normal text-muted-foreground">
                        {p.unpriced} without a price
                      </span>
                    )}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">{formatNumber(p.active)}</MTd>
                  <MTd className="text-right text-xs tabular-nums">{formatRupees(p.mrr_paise)}</MTd>
                  <MTd className="text-right text-xs tabular-nums">{formatRate(p.mrr_share)}</MTd>
                  <MTd>
                    <Bar
                      value={p.mrr_share ?? 0}
                      max={1}
                      label={`${formatRate(p.mrr_share)} of MRR`}
                    />
                  </MTd>
                </MTr>
              ))}
            </MTable>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Click a package to filter the hub by it. {d.definitions.packages}
          </p>
        </Card>
      </div>

      <DrillDrawer
        key={`${open}-${JSON.stringify(filters)}`}
        metric={open}
        filters={filters}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
