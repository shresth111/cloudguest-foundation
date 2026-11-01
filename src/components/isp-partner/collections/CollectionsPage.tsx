/**
 * `/partner/collections` (COLLECTIONS-1): who owes, how risky, what they
 * promised, cash collected in the field and the end-of-day handover.
 * Every call is zone-narrowed by the ZONE-1 interceptor and confined to the
 * caller's customers by the backend. All of it 404s while
 * `ISP_COLLECTIONS_ENABLED` is off, and the page then says so.
 */
import { AlarmClock, HandCoins, IndianRupee, TrendingUp, Wallet } from "lucide-react";
import { MEmptyState, MSectionHeader, MSeg, MStat } from "@/components/master/MasterKit";
import { ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CashTab } from "@/components/isp-partner/collections/CashTab";
import { OverdueTab } from "@/components/isp-partner/collections/OverdueTab";
import { PromisesTab } from "@/components/isp-partner/collections/PromisesTab";
import { ForecastCard } from "@/components/isp-partner/collections/ForecastCard";
import { useForecast, useOverdue } from "@/hooks/isp-partner/useCollections";
import { COLLECTIONS_TABS, type CollectionsTab } from "@/lib/isp-partner/collections";
import { isNotFound } from "@/lib/isp-partner/errors";
import { formatRupees } from "@/lib/isp-partner/money";

const LABEL: Record<CollectionsTab, string> = {
  overdue: "Overdue",
  promises: "Promises to pay",
  cash: "Cash & handovers",
};

export function CollectionsPage({
  tab,
  onTab,
}: {
  tab: CollectionsTab;
  onTab: (t: CollectionsTab) => void;
}) {
  const { can } = usePartner();
  // the summary strip reads the same list endpoint (first page only)
  const head = useOverdue({ page: 1, page_size: 1 });
  const forecast = useForecast(!head.error);
  if (head.isLoading) return <LoadingBlock />;
  if (head.error) {
    return isNotFound(head.error) ? (
      <MEmptyState
        icon={HandCoins}
        title="Collections is not switched on"
        description="The collections workbench is not switched on for your network. Ask Wyfy Guest support to turn it on."
      />
    ) : (
      <ErrorBlock error={head.error} onRetry={() => head.refetch()} what="collections" />
    );
  }
  const s = head.data?.summary;
  const tabs = COLLECTIONS_TABS.filter(
    (t) => t !== "cash" || can("isp_collections.collect") || can("isp_collections.approve"),
  );
  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Money"
        title="Collections"
        description="Overdue bills ranked by risk and amount, promises to pay, and cash collected in the field."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MStat
          label="Overdue"
          value={formatRupees(s?.overdue_paise ?? 0)}
          delta={`${s?.parties ?? 0} subscribers and customers`}
          icon={IndianRupee}
          tone="danger"
        />
        <MStat
          label="High risk"
          value={s?.by_band.high.parties ?? 0}
          delta={formatRupees(s?.by_band.high.overdue_paise ?? 0)}
          icon={AlarmClock}
          tone="warning"
        />
        <MStat label="Open promises" value={s?.open_promises ?? 0} icon={Wallet} tone="info" />
        <MStat
          label="Predicted this week"
          value={forecast.data ? formatRupees(forecast.data.predicted_total_paise) : "–"}
          delta={
            forecast.data
              ? `${formatRupees(forecast.data.collected_so_far_paise)} already in`
              : undefined
          }
          icon={TrendingUp}
          tone="success"
          loading={forecast.isLoading}
        />
      </div>
      <MSeg<CollectionsTab>
        value={tabs.includes(tab) ? tab : "overdue"}
        onChange={onTab}
        options={tabs.map((t) => ({ value: t, label: LABEL[t] }))}
      />
      {tab === "overdue" && (
        <>
          <OverdueTab />
          {forecast.data && <ForecastCard forecast={forecast.data} />}
        </>
      )}
      {tab === "promises" && <PromisesTab />}
      {tab === "cash" && tabs.includes("cash") && <CashTab />}
    </div>
  );
}
