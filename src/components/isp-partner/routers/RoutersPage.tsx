/** `/partner/routers`: every router across the ISP's customers. */
import { useState } from "react";
import { MSectionHeader } from "@/components/master/MasterKit";
import { CustomerSelect } from "@/components/isp-partner/kit";
import { RoutersTable } from "@/components/isp-partner/routers/RoutersTable";
import { NetmonTabs } from "@/components/isp-partner/routers/NetmonTabs";
import { AddRouterButton } from "@/components/isp-partner/workflow/AddRouterButton";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useWorkflowFeatures } from "@/hooks/isp-partner/useWorkflow";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ROUTER_STATUS_LABEL } from "@/lib/isp-partner/format";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

/** [POSTFIX-1] P3 copy: the header matches the Add router button next to
 * it. Workflow flag off: the original sentence, unchanged. */
function routersPageDescription(opts: {
  workflowOn: boolean;
  franchisee: boolean;
  canCreate: boolean;
}): string {
  if (opts.workflowOn && opts.franchisee) {
    return "Every MikroTik at the sites in your zones. To add one, press Add router and pick the site.";
  }
  if (opts.workflowOn && opts.canCreate) {
    return "Every MikroTik across your customers. To add one, press Add router or open a customer's location.";
  }
  return "Every MikroTik across your customers. To add one, open a customer's location.";
}

export function RoutersPage() {
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const customers = useIspCustomerOptions();
  const wf = useWorkflowFeatures();
  const { can } = usePartner();
  const description = routersPageDescription({
    workflowOn: wf.on,
    franchisee: !!wf.features?.is_franchisee,
    canCreate: can("isp_partner.create"),
  });
  return (
    <>
      <MSectionHeader
        eyebrow="Routers"
        title="Routers"
        description={description}
        actions={<AddRouterButton />}
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
