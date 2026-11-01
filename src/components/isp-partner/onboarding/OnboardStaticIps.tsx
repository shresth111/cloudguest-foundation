/** Static IP rows for the one-page "Add subscriber" (ONBOARD-1): venue ->
 * DHCP pool (JAZE-2 pool list, with its next free address) -> address
 * (blank = next free at save time) -> optional MAC. */
import { Plus, Trash2 } from "lucide-react";
import { MButton, M_INPUT } from "@/components/master/MasterKit";
import { useIspLocations } from "@/hooks/isp-partner/useIsp";
import { useIpPools } from "@/hooks/isp-partner/useNetwork";
import type { StaticIpRow } from "@/lib/isp-partner/onboarding";

const EMPTY_ROW: StaticIpRow = {
  isp_location_id: "",
  pool_id: "",
  ip: "",
  mac: "",
  static_queue: false,
};

export function OnboardStaticIps({
  customerId,
  rows,
  onChange,
  queuePush,
}: {
  customerId: string;
  rows: StaticIpRow[];
  onChange: (rows: StaticIpRow[]) => void;
  queuePush: boolean;
}) {
  const locations = useIspLocations(
    { isp_customer_id: customerId, page: 1, page_size: 100 },
    !!customerId,
  );
  const set = (i: number, patch: Partial<StaticIpRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  if (!customerId) return <p className="text-xs text-muted-foreground">Pick the customer first.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_1fr_9rem_10rem_auto]"
        >
          <select
            className={M_INPUT}
            value={r.isp_location_id}
            aria-label={`Static IP ${i + 1} venue`}
            onChange={(e) => set(i, { isp_location_id: e.target.value, pool_id: "", ip: "" })}
          >
            <option value="">Venue…</option>
            {(locations.data?.items ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <PoolSelect
            locationId={r.isp_location_id}
            value={r.pool_id}
            index={i}
            onChange={(pool_id) => set(i, { pool_id, ip: "" })}
          />
          <input
            className={M_INPUT}
            placeholder="Next free"
            value={r.ip}
            onChange={(e) => set(i, { ip: e.target.value })}
            aria-label={`Static IP ${i + 1} address`}
          />
          <input
            className={M_INPUT}
            placeholder="MAC (optional)"
            value={r.mac}
            onChange={(e) => set(i, { mac: e.target.value })}
            aria-label={`Static IP ${i + 1} MAC`}
          />
          <MButton
            variant="ghost"
            title="Remove"
            aria-label={`Remove static IP ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </MButton>
          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-5">
            <input
              type="checkbox"
              checked={r.static_queue}
              onChange={(e) => set(i, { static_queue: e.target.checked })}
            />
            Static speed queue for this IP
            {!queuePush && " (recorded only; not pushed to the router while the push is off)"}
          </label>
        </div>
      ))}
      {rows.length < 4 && (
        <MButton variant="outline" onClick={() => onChange([...rows, { ...EMPTY_ROW }])}>
          <Plus /> Add a static IP
        </MButton>
      )}
    </div>
  );
}

function PoolSelect({
  locationId,
  value,
  index,
  onChange,
}: {
  locationId: string;
  value: string;
  index: number;
  onChange: (v: string) => void;
}) {
  const pools = useIpPools(locationId);
  return (
    <select
      className={M_INPUT}
      value={value}
      disabled={!locationId}
      aria-label={`Static IP ${index + 1} pool`}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{pools.isLoading ? "Loading pools…" : "Pool…"}</option>
      {(pools.data ?? []).map((p) => (
        <option key={p.id} value={p.id} disabled={!p.next_free}>
          {p.name} ({p.range_start}-{p.range_end})
          {p.next_free ? ` · next ${p.next_free}` : " · full"}
        </option>
      ))}
    </select>
  );
}
