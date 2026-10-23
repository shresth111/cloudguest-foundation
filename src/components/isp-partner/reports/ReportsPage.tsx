/** `/partner/reports`: network reports, plus collections and dues for roles
 * that can read invoices (ADDENDUM_03). */
import { useState } from "react";
import { MSectionHeader, MSeg } from "@/components/master/MasterKit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ReportsView } from "@/components/isp-partner/reports/ReportsView";
import { BillingReports } from "@/components/isp-partner/reports/BillingReports";

export function ReportsPage() {
  const { can } = usePartner();
  const [tab, setTab] = useState<"network" | "money">("network");
  const showMoney = can("isp_invoices.read");
  return (
    <>
      <MSectionHeader
        eyebrow="Reports"
        title="Reports"
        description="Portfolio, guest activity, data usage and TR-069 devices for a range of up to 92 days."
      />
      {showMoney && (
        <MSeg<"network" | "money">
          value={tab}
          onChange={setTab}
          options={[
            { value: "network", label: "Network" },
            { value: "money", label: "Collections and dues" },
          ]}
        />
      )}
      {tab === "money" && showMoney ? <BillingReports /> : <ReportsView />}
    </>
  );
}
