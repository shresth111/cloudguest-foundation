/** `/partner/routers`: every router across the ISP's customers. */
import { useState } from "react";
import { MSectionHeader, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect } from "@/components/isp-partner/kit";
import { RoutersTable } from "@/components/isp-partner/routers/RoutersTable";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { ROUTER_STATUS_LABEL } from "@/lib/isp-partner/format";

export function RoutersPage() {
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const customers = useIspCustomerOptions();
  return (
    <>
      <MSectionHeader
        eyebrow="Routers"
        title="Routers"
        description="Every MikroTik across your customers. To add one, open a customer's location."
      />
      <div className="flex flex-wrap gap-2">
        <div className="w-full max-w-xs">
          <CustomerSelect value={customerId} onChange={setCustomerId} customers={customers.data} />
        </div>
        <select
          className={`${M_INPUT} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="">Any status</option>
          {Object.entries(ROUTER_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <RoutersTable key={`${customerId}-${status}`} customerId={customerId || undefined} status={status} />
    </>
  );
}
