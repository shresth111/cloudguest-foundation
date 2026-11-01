/**
 * DISCOUNT-WIRE pure helpers. The BE quotes a JAZE-5 code against the line's
 * TAXABLE gross (GST taken out first when the price includes GST) and charges
 * GST on gross - discount. The live preview sends the same taxable gross to
 * the existing `POST /isp/apps/discounts/preview`, so the numbers agree.
 */

/** Half-up integer division, as `gst.round_half_up` does it on the BE. */
function roundHalfUp(num: number, den: number): number {
  return Math.floor((2 * num + den) / (2 * den));
}

/** Taxable value of `pricePaise x cycles` before any discount. */
export function taxableGross(args: {
  pricePaise: number;
  cycles?: number;
  includesGst: boolean;
  gstEnabled: boolean;
  rateBp: number;
}): number {
  const gross = args.pricePaise * (args.cycles ?? 1);
  if (!args.includesGst || !args.gstEnabled || args.rateBp === 0) return gross;
  return roundHalfUp(gross * 10000, 10000 + args.rateBp);
}

/** Taxable after the discount, plus the GST and total on it (intra-state:
 * CGST + SGST, each rounded on its half; inter-state IGST can differ by a
 * paisa, so the dialog says "about"). */
export function afterDiscount(args: {
  taxableGrossPaise: number;
  discountPaise: number;
  gstEnabled: boolean;
  rateBp: number;
}): { taxable: number; gst: number; total: number } {
  const taxable = Math.max(0, args.taxableGrossPaise - Math.max(0, args.discountPaise));
  if (!args.gstEnabled || args.rateBp === 0) return { taxable, gst: 0, total: taxable };
  const half = roundHalfUp(taxable * args.rateBp, 20000);
  return { taxable, gst: 2 * half, total: taxable + 2 * half };
}

/** What goes into a request body: the trimmed code, or nothing. */
export function discountField(code: string | null | undefined): { discount_code?: string } {
  const c = (code ?? "").trim();
  return c ? { discount_code: c } : {};
}
