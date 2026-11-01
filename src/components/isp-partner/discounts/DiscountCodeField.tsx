/**
 * DISCOUNT-WIRE: "Discount code" input with a live preview through JAZE-5's
 * existing `POST /isp/apps/discounts/preview`. Renders nothing while
 * ISP_DISCOUNT_APPLY_ENABLED is off. The invoice is computed by the BE; the
 * preview only shows what it will do (pre-tax discount, GST on the rest).
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { M_INPUT } from "@/components/master/MasterKit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useDiscountApply } from "@/hooks/isp-partner/useDiscountApply";
import { afterDiscount, taxableGross } from "@/lib/isp-partner/discount-apply";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatRupees } from "@/lib/isp-partner/money";
import { appsService } from "@/services/isp-partner/apps";

export function DiscountCodeField({
  value,
  onChange,
  pricePaise,
  includesGst,
  cycles = 1,
  packageId,
}: {
  value: string;
  onChange: (code: string) => void;
  pricePaise: number | null | undefined;
  includesGst: boolean;
  cycles?: number;
  packageId?: string | null;
}) {
  const { can } = usePartner();
  const { enabled, status } = useDiscountApply();
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 400);
    return () => clearTimeout(t);
  }, [value]);
  const gross =
    status && pricePaise
      ? taxableGross({
          pricePaise,
          cycles,
          includesGst,
          gstEnabled: status.gst_enabled,
          rateBp: status.gst_rate_bp,
        })
      : 0;
  const canPreview = can("isp_apps.read");
  const q = useQuery({
    queryKey: ["isp", "discount-apply", "preview", debounced, gross, packageId ?? null],
    queryFn: () =>
      appsService.previewDiscount({
        code: debounced,
        gross_paise: gross,
        package_id: packageId ?? null,
      }),
    enabled: enabled && canPreview && !!debounced && gross > 0,
    retry: false,
  });
  if (!enabled) return null;
  const after =
    q.data && status
      ? afterDiscount({
          taxableGrossPaise: gross,
          discountPaise: q.data.discount_paise,
          gstEnabled: status.gst_enabled,
          rateBp: status.gst_rate_bp,
        })
      : null;
  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Discount code (optional)</span>
        <input
          className={`${M_INPUT} uppercase`}
          value={value}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!q.error}
        />
      </label>
      {debounced && q.isFetching && <p className="text-xs text-muted-foreground">Checking…</p>}
      {debounced && q.error && (
        <p className="text-xs text-destructive">{ispErrorMessage(q.error)}</p>
      )}
      {after && q.data && (
        <p className="text-xs text-muted-foreground">
          {q.data.label}: −{formatRupees(q.data.discount_paise)} before GST. Taxable{" "}
          {formatRupees(after.taxable)}, about {formatRupees(after.total)} with GST.
        </p>
      )}
      {debounced && !canPreview && (
        <p className="text-xs text-muted-foreground">
          The code is checked when you save; a wrong or used-up code is refused.
        </p>
      )}
    </div>
  );
}
