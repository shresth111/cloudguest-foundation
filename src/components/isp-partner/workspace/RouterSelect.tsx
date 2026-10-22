/**
 * Pick which MikroTik a venue screen is configuring.
 *
 * Why this is not a convenience: VLANs and IP addresses live ON a router, and
 * an ISP manages each location's MikroTiks separately. Two routers at one
 * location have their own VLANs and their own DHCP pools, so every network
 * screen has to name the one it means. The API agrees -- the venue twins
 * resolve `isp_router_id` through IspScope and 404 a router that is not under
 * the pinned location -- so an empty picker is a screen with nothing to ask.
 *
 * The list is the location's own routers (`GET /isp/routers`, already live),
 * so it can never offer a router the twin would then refuse.
 */
import { M_INPUT } from "@/components/master/MasterKit";
import { useIspRouters } from "@/hooks/isp-partner/useIsp";

export function RouterSelect({
  locationId,
  value,
  onChange,
  disabled,
  label = "Router",
}: {
  locationId: string;
  value: string | null;
  onChange: (routerId: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const q = useIspRouters({ isp_location_id: locationId, page_size: 100 });
  const routers = q.data?.items ?? [];

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        className={M_INPUT}
        value={value ?? ""}
        disabled={disabled || q.isLoading || routers.length === 0}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {routers.length === 0 && <option value="">No routers at this location</option>}
        {routers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.model ? ` · ${r.model}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
