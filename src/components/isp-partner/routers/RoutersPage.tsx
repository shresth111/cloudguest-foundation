/** `/partner/routers`: every router across the ISP's customers. */
import { useState } from "react";
import { MSectionHeader } from "@/components/master/MasterKit";
import { CustomerSelect } from "@/components/isp-partner/kit";
import { RoutersTable } from "@/components/isp-partner/routers/RoutersTable";
import { NetmonTabs } from "@/components/isp-partner/routers/NetmonTabs";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { ROUTER_STATUS_LABEL } from "@/lib/isp-partner/format";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

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
      {/* NETMON-2: Traffic / Live sessions / Session history tabs (flag-gated). */}
      <NetmonTabs
        list={
          <>
            <div className="flex flex-wrap gap-2">
              <div className="w-full max-w-xs">
                <CustomerSelect
                  value={customerId}
                  onChange={setCustomerId}
                  customers={customers.data}
                />
              </div>
              <select
                className={`${M_FILTER}`}
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
            <RoutersTable
              key={`${customerId}-${status}`}
              customerId={customerId || undefined}
              status={status}
            />
          </>
        }
      />
    </>
  );
}
