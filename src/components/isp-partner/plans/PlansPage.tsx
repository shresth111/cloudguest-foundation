/** `/partner/plans` (ADDENDUM_02 §9): Speed groups · Packages · Coupons · Subscribers. */
import { useState } from "react";
import { Gauge } from "lucide-react";
import { MEmptyState, MSectionHeader, MSeg } from "@/components/master/MasterKit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { SpeedGroupsTab } from "@/components/isp-partner/plans/SpeedGroupsTab";
import { PackagesTab } from "@/components/isp-partner/plans/PackagesTab";
import { CouponsTab } from "@/components/isp-partner/plans/CouponsTab";
import { SubscribersTab } from "@/components/isp-partner/plans/SubscribersTab";

export type PlansTab = "groups" | "packages" | "coupons" | "subscribers";

export function PlansPage({ tab, onTab }: { tab: PlansTab; onTab: (t: PlansTab) => void }) {
  const { can } = usePartner();
  const [groupFilter, setGroupFilter] = useState<string | undefined>();
  const [generateFor, setGenerateFor] = useState<string | undefined>();
  const tabs: { value: PlansTab; label: string }[] = [];
  if (can("isp_plans.read"))
    tabs.push({ value: "groups", label: "Speed groups" }, { value: "packages", label: "Packages" });
  if (can("isp_coupons.read")) tabs.push({ value: "coupons", label: "Coupons" });
  if (can("isp_subscribers.read")) tabs.push({ value: "subscribers", label: "Subscribers" });
  if (tabs.length === 0)
    return <MEmptyState icon={Gauge} title="Your role does not include plans or coupons" />;
  const active = tabs.some((t) => t.value === tab) ? tab : tabs[0].value;

  return (
    <>
      <MSectionHeader
        eyebrow="Plans"
        title="Plans and coupons"
        description="Speed groups set the rate, packages put a validity and price on it, and coupons sell a package at a customer's venue."
      />
      <MSeg<PlansTab> value={active} onChange={onTab} options={tabs} />
      {active === "groups" && (
        <SpeedGroupsTab
          onShowSubscribers={(id) => {
            setGroupFilter(id);
            onTab("subscribers");
          }}
          onGenerateCoupons={(id) => {
            setGenerateFor(id);
            onTab("coupons");
          }}
        />
      )}
      {active === "packages" && <PackagesTab />}
      {active === "coupons" && (
        <CouponsTab
          generateForGroup={generateFor}
          onGeneratorClosed={() => setGenerateFor(undefined)}
        />
      )}
      {active === "subscribers" && (
        <SubscribersTab key={groupFilter ?? "all"} groupFilter={groupFilter} />
      )}
    </>
  );
}
