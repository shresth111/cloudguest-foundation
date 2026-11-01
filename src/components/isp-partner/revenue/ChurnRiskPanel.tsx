/**
 * Revenue hub → Churn risk (CHURN-RISK). Rule-based, no prediction: every row
 * shows the rules it matched with the measured values, so staff can see why
 * a subscriber is on the list. Counts per rule are aggregates (viewer sees
 * them); the list names subscribers and needs `isp_billing.export`.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useRiskList, useRiskSummary } from "@/hooks/isp-partner/useRevenue";
import { formatDate, formatNumber } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { REASON_LABEL, REASON_ORDER, scoreTone } from "@/lib/isp-partner/revenue";
import type { RevFilters, RiskReason } from "@/services/isp-partner/revenue-types";
import { WinBackActions } from "@/components/isp-partner/revenue/WinBackActions";

export function ChurnRiskPanel({
  filters,
  reason,
  onReason,
}: {
  filters: RevFilters;
  reason: RiskReason | null;
  onReason: (r: RiskReason | null) => void;
}) {
  const { can } = usePartner();
  const canList = can("isp_billing.export");
  const [page, setPage] = useState(1);
  const sum = useRiskSummary(filters);
  const list = useRiskList(filters, reason, page, canList);
  const s = sum.data;
  const d = list.data;

  return (
    <div className="space-y-4">
      <Card title="Subscribers at risk">
        {sum.error ? (
          <ErrorBlock error={sum.error} onRetry={() => sum.refetch()} what="the risk counts" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  reason === null ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
                aria-pressed={reason === null}
                onClick={() => {
                  setPage(1);
                  onReason(null);
                }}
              >
                All at risk{" "}
                <span className="tabular-nums">{s ? formatNumber(s.at_risk) : "…"}</span>
              </button>
              {REASON_ORDER.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    reason === r ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                  aria-pressed={reason === r}
                  title={d?.rules[r]?.definition}
                  onClick={() => {
                    setPage(1);
                    onReason(r);
                  }}
                >
                  {REASON_LABEL[r]}{" "}
                  <span className="tabular-nums">
                    {s ? formatNumber(s.by_reason[r] ?? 0) : "…"}
                  </span>
                </button>
              ))}
            </div>
            {s && (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatRupees(s.mrr_at_risk_paise)} of MRR sits with these subscribers. A subscriber
                can match several rules; the score adds the rules' weights.
                {!s.tickets_measured &&
                  " The complaints rule needs the Apps helpdesk switched on, so it is not measured."}
              </p>
            )}
          </>
        )}
      </Card>

      {!canList ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Your role sees the counts only. The list names subscribers, so it needs billing export
            access.
          </p>
        </Card>
      ) : list.error ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="the risk list" />
      ) : !list.isLoading && d && d.items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            {reason
              ? `Nobody matches “${REASON_LABEL[reason]}” for these filters.`
              : "Nobody is at risk for these filters."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>Subscriber</MTh>
                <MTh>Why</MTh>
                <MTh className="text-right">Score</MTh>
                <MTh className="text-right">MRR</MTh>
                <MTh className="text-right">Win back</MTh>
              </>
            }
          >
            {d?.items.map((i) => (
              <MTr key={i.id}>
                <MTd className="align-top">
                  <Link
                    to="/partner/subscribers/$subscriberId"
                    params={{ subscriberId: i.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {i.display_name || i.identifier || "–"}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {[i.package_name ?? "No package", i.customer_name, i.zone_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Valid until {formatDate(i.valid_until)}
                  </span>
                </MTd>
                <MTd className="align-top">
                  <ul className="space-y-1.5">
                    {i.reasons.map((r) => (
                      <li key={r.code} className="text-xs">
                        <span className="font-medium">{r.label}</span>{" "}
                        <span className="text-muted-foreground tabular-nums">(+{r.weight})</span>
                        <span className="block text-muted-foreground">{r.detail}</span>
                      </li>
                    ))}
                  </ul>
                </MTd>
                <MTd className="text-right align-top">
                  <MTag label={String(i.score)} tone={scoreTone(i.score)} />
                </MTd>
                <MTd className="text-right align-top text-xs tabular-nums">
                  {i.mrr_paise === null ? "–" : formatRupees(i.mrr_paise)}
                </MTd>
                <MTd className="align-top">
                  <WinBackActions item={i} />
                </MTd>
              </MTr>
            ))}
          </MTable>
          {d && <Pager page={d.page} pages={d.pages} total={d.total} onPage={setPage} />}
        </div>
      )}
    </div>
  );
}
