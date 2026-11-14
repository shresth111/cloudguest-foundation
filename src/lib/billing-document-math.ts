/**
 * Live-preview mirror of the backend's GST math
 * (app/domains/billing_document/calculations.py). The form shows these
 * numbers while the operator types; on save the backend recomputes and
 * stores its own figures, which are what the PDF prints. Keep the two in
 * step -- scripts/test-billing-documents.mjs pins this file to the same
 * worked examples the backend tests use.
 *
 * Money is computed in integer paise so 0.1 + 0.2 never shows up on an
 * invoice, and every rounding is half-up (0.125 -> 0.13), not banker's.
 * No imports on purpose: the test bundles this file alone.
 */

export type MathTaxMode = "cgst_sgst" | "igst" | "none";

export interface MathLine {
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
}

export interface LineAmounts {
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface DocumentTotals {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
}

/** Half-up rounding of a non-negative paise amount to whole paise. The
 * epsilon absorbs binary noise (e.g. 1.005 rupees is 100.49999... paise). */
function roundPaise(paise: number): number {
  const sign = paise < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(paise) + 0.5 + 1e-6);
}

const fromPaise = (paise: number): number => paise / 100;

export function computeLine(line: MathLine, mode: MathTaxMode): LineAmounts {
  const gross = roundPaise(line.quantity * line.rate * 100);
  const discount = roundPaise((gross * line.discountPercent) / 100);
  const taxable = gross - discount;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (mode === "cgst_sgst" && line.taxRate > 0) {
    cgst = sgst = roundPaise((taxable * line.taxRate) / 200);
  } else if (mode === "igst" && line.taxRate > 0) {
    igst = roundPaise((taxable * line.taxRate) / 100);
  }
  return {
    gross: fromPaise(gross),
    discount: fromPaise(discount),
    taxable: fromPaise(taxable),
    cgst: fromPaise(cgst),
    sgst: fromPaise(sgst),
    igst: fromPaise(igst),
    total: fromPaise(taxable + cgst + sgst + igst),
  };
}

export function computeTotals(lines: LineAmounts[], roundTotal: boolean): DocumentTotals {
  const sum = (pick: (l: LineAmounts) => number) =>
    lines.reduce((acc, l) => acc + Math.round(pick(l) * 100), 0);
  const subtotal = sum((l) => l.gross);
  const discountTotal = sum((l) => l.discount);
  const taxableTotal = sum((l) => l.taxable);
  const cgstTotal = sum((l) => l.cgst);
  const sgstTotal = sum((l) => l.sgst);
  const igstTotal = sum((l) => l.igst);
  const taxTotal = cgstTotal + sgstTotal + igstTotal;
  const exact = taxableTotal + taxTotal;
  const grand = roundTotal ? Math.floor(exact / 100 + 0.5) * 100 : exact;
  return {
    subtotal: fromPaise(subtotal),
    discountTotal: fromPaise(discountTotal),
    taxableTotal: fromPaise(taxableTotal),
    cgstTotal: fromPaise(cgstTotal),
    sgstTotal: fromPaise(sgstTotal),
    igstTotal: fromPaise(igstTotal),
    taxTotal: fromPaise(taxTotal),
    roundOff: fromPaise(grand - exact),
    grandTotal: fromPaise(grand),
  };
}

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

/** Same rule as the backend's resolve_tax_mode. Returns null when `auto`
 * cannot decide (no place of supply, or no seller state) -- the form then
 * asks for it instead of guessing. */
export function resolveTaxMode(
  requested: MathTaxMode | "auto",
  sellerState: string | null | undefined,
  placeOfSupply: string | null | undefined,
  outsideIndia = "Outside India",
): MathTaxMode | null {
  if (requested !== "auto") return requested;
  if (!norm(placeOfSupply)) return null;
  if (norm(placeOfSupply) === norm(outsideIndia)) return "igst";
  if (!norm(sellerState)) return null;
  return norm(placeOfSupply) === norm(sellerState) ? "cgst_sgst" : "igst";
}

/** Indian grouping (12,34,567.00) regardless of the browser's locale. */
export function formatAmount(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
