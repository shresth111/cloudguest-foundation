/**
 * RAKESH-FS (P0 #1/#2/#3): onboarding auto-placement. When a zone is picked,
 * the routers serving it (nearest zone first, via /isp/workflow/placement)
 * are offered and the first one is pre-selected together with its customer,
 * so the operator does not have to assign the subscriber by hand. Renders
 * nothing while the workflow flag is off.
 */
import { useEffect, useRef } from "react";
import { M_INPUT } from "@/components/master/MasterKit";
import { usePlacement, useWorkflowFeatures } from "@/hooks/isp-partner/useWorkflow";

export function PlacementPicker({
  zoneId,
  customerId,
  routerId,
  onPick,
}: {
  zoneId: string;
  customerId: string;
  routerId: string;
  onPick: (v: { customerId: string; routerId: string }) => void;
}) {
  const wf = useWorkflowFeatures();
  const q = usePlacement(zoneId, wf.on);
  const autoFor = useRef<string>("");
  const items = q.data?.items ?? [];
  const forCustomer = customerId ? items.filter((r) => r.isp_customer_id === customerId) : items;

  useEffect(() => {
    // Pre-select once per zone; never overrides a router the operator chose.
    if (!q.data || autoFor.current === zoneId) return;
    autoFor.current = zoneId;
    const pick =
      (customerId && q.data.items.find((r) => r.isp_customer_id === customerId)) ||
      q.data.suggested;
    if (pick) onPick({ customerId: pick.isp_customer_id, routerId: pick.isp_router_id });
  }, [q.data, zoneId, customerId, onPick]);

  if (!wf.on || !zoneId) return null;
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">Router</span>
      <select
        className={M_INPUT}
        value={routerId}
        onChange={(e) => {
          const r = items.find((x) => x.isp_router_id === e.target.value);
          onPick({ customerId: r?.isp_customer_id ?? customerId, routerId: e.target.value });
        }}
      >
        <option value="">{q.isLoading ? "Finding routers…" : "No router"}</option>
        {forCustomer.map((r) => (
          <option key={r.isp_router_id} value={r.isp_router_id}>
            {r.name} · {r.customer_name} / {r.location_name}
            {r.match === "linked" ? "" : " (site zone)"}
          </option>
        ))}
      </select>
      <span className="block text-xs text-muted-foreground">
        {items.length
          ? "Picked from the routers that serve this zone."
          : q.isSuccess
            ? "No router serves this zone yet. Link one on its router page."
            : ""}
      </span>
    </label>
  );
}
