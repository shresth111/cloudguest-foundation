/** RAKESH-P1 P1-3: may franchisees generate coupons in this zone? Inherit
 * (from the parent zone; allowed at the top), Allowed, or Not allowed.
 * Renders nothing while ISP_ZONE_COUPON_RIGHTS_ENABLED is off. Read-only
 * text for callers without isp_zones.manage. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { M_FILTER } from "@/components/isp-partner/ui/classes";
import { p1Keys, useZoneCouponRights } from "@/hooks/isp-partner/useP1";
import { p1Service } from "@/services/isp-partner/p1";
import { ispToastError } from "@/lib/isp-partner/error-toast";

type Choice = "inherit" | "allow" | "deny";

export function ZoneCouponRightControl({
  zoneId,
  zoneName,
  manage,
}: {
  zoneId: string;
  zoneName: string;
  manage: boolean;
}) {
  const qc = useQueryClient();
  const rights = useZoneCouponRights();
  const [busy, setBusy] = useState(false);
  if (!rights.available) return null;
  const r = rights.map.get(zoneId);
  const allowed = r?.allow_generate ?? true;
  const choice: Choice = r?.explicit == null ? "inherit" : r.explicit ? "allow" : "deny";
  if (!manage)
    return (
      <span className="text-[11px] text-muted-foreground">
        Franchisee coupons: {allowed ? "allowed" : "not allowed"}
      </span>
    );
  const change = async (c: Choice) => {
    setBusy(true);
    try {
      await p1Service.putZoneCouponRight(zoneId, c === "inherit" ? null : c === "allow");
      await qc.invalidateQueries({ queryKey: p1Keys.couponRights });
      toast.success(`Coupon rule saved for ${zoneName}.`);
    } catch (err) {
      ispToastError(err, "Could not save the coupon rule.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <select
      className={`${M_FILTER} h-7 py-0 text-xs`}
      aria-label={`Franchisee coupons in ${zoneName}`}
      value={choice}
      disabled={busy}
      onChange={(e) => change(e.target.value as Choice)}
    >
      <option value="inherit">Coupons: as parent ({allowed ? "allowed" : "not allowed"})</option>
      <option value="allow">Coupons: allowed</option>
      <option value="deny">Coupons: not allowed</option>
    </select>
  );
}
