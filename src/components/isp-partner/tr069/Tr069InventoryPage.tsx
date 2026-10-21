/** `/partner/tr069`: CPE inventory with customer / assigned / online filters. */
import { useState } from "react";
import { MSectionHeader, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect } from "@/components/isp-partner/kit";
import { Tr069DevicesTable } from "@/components/isp-partner/tr069/Tr069DevicesTable";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type Tri = "any" | "yes" | "no";
const triValue = (t: Tri) => (t === "any" ? undefined : t === "yes");

export function Tr069InventoryPage() {
  const customers = useIspCustomerOptions();
  const [customerId, setCustomerId] = useState("");
  const [assigned, setAssigned] = useState<Tri>("any");
  const [online, setOnline] = useState<Tri>("any");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = {
    isp_customer_id: customerId || undefined,
    assigned: triValue(assigned),
    online: triValue(online),
    search: debounced || undefined,
  };
  return (
    <>
      <MSectionHeader
        eyebrow="TR-069"
        title="TR-069 devices"
        description="Devices managed through the Wyfy Guest device manager (ACS). Actions are queued and run at each device's next check-in."
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <CustomerSelect value={customerId} onChange={setCustomerId} customers={customers.data} />
        </div>
        <input
          className={`${M_INPUT} w-full max-w-xs`}
          placeholder="Search serial, model, label"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <MSeg<Tri>
          value={assigned}
          onChange={setAssigned}
          options={[
            { value: "any", label: "Any" },
            { value: "yes", label: "Assigned" },
            { value: "no", label: "Unassigned" },
          ]}
        />
        <MSeg<Tri>
          value={online}
          onChange={setOnline}
          options={[
            { value: "any", label: "Any" },
            { value: "yes", label: "Online" },
            { value: "no", label: "Offline" },
          ]}
        />
      </div>
      <Tr069DevicesTable key={JSON.stringify(query)} query={query} />
    </>
  );
}
