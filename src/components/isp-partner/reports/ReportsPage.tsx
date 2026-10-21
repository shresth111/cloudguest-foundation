/** `/partner/reports`. */
import { MSectionHeader } from "@/components/master/MasterKit";
import { ReportsView } from "@/components/isp-partner/reports/ReportsView";

export function ReportsPage() {
  return (
    <>
      <MSectionHeader
        eyebrow="Reports"
        title="Reports"
        description="Portfolio, guest activity, data usage and TR-069 devices for a range of up to 92 days."
      />
      <ReportsView />
    </>
  );
}
