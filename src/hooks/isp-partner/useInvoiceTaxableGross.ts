/**
 * SMALL-2: the taxable gross of a hand-made invoice (sum over its lines, GST
 * taken out of GST-inclusive lines), for the DISCOUNT-WIRE code preview. The
 * BE quotes the code once on this same sum and splits it across the lines.
 * A GST-exempt customer is quoted on the full amount by the BE; this preview
 * uses the ISP's GST setting, so it is an estimate there.
 */
import { useDiscountApply } from "@/hooks/isp-partner/useDiscountApply";
import { taxableGross } from "@/lib/isp-partner/discount-apply";
import { parseRupeesToPaise } from "@/lib/isp-partner/money";

export function useInvoiceTaxableGross(
  lines: { amount: string; price_includes_gst: boolean }[],
): number {
  const { status } = useDiscountApply();
  if (!status) return 0;
  return lines.reduce((sum, l) => {
    const p = parseRupeesToPaise(l.amount);
    if (p === null || p <= 0) return sum;
    return (
      sum +
      taxableGross({
        pricePaise: p,
        includesGst: l.price_includes_gst,
        gstEnabled: status.gst_enabled,
        rateBp: status.gst_rate_bp,
      })
    );
  }, 0);
}
