/** Pure helpers for the CAF-2 workbench. No React, no API:
 * `scripts/test-isp-partner-caf.mjs` runs them. */
import type {
  ApplicantCategory,
  CafExportBody,
  CafExtras,
  CafMissing,
} from "@/services/isp-partner/caf";

export const CATEGORY_LABEL: Record<ApplicantCategory, string> = {
  individual: "Individual",
  proprietor: "Proprietorship",
  partnership: "Partnership",
  pvt_ltd: "Private limited company",
  public_ltd: "Public limited company",
  other: "Other",
};

export const MISSING_LABEL: Record<CafMissing, string> = {
  kyc: "KYC is not filled in (Compliance -> KYC & CAF)",
  photo: "No photograph uploaded",
  signature: "No signature uploaded",
  licence_number: "Your licence number is not set (Compliance -> Settings)",
};

/** A missing photo/signature only leaves an empty box; missing KYC blocks
 * the PDF (the API answers 422). */
export function pdfBlocked(missing: CafMissing[]): boolean {
  return missing.includes("kyc");
}

export interface ExtrasDraft {
  applicant_category: ApplicantCategory;
  applicant_category_other: string;
  father_or_spouse_name: string;
  plot_no: string;
  locality: string;
  district: string;
}

export function extrasDraft(e?: Partial<CafExtras> | null): ExtrasDraft {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    applicant_category: (e?.applicant_category as ApplicantCategory) ?? "individual",
    applicant_category_other: s(e?.applicant_category_other),
    father_or_spouse_name: s(e?.father_or_spouse_name),
    plot_no: s(e?.plot_no),
    locality: s(e?.locality),
    district: s(e?.district),
  };
}

const LIMITS: Record<Exclude<keyof ExtrasDraft, "applicant_category">, number> = {
  applicant_category_other: 60,
  father_or_spouse_name: 200,
  plot_no: 60,
  locality: 120,
  district: 100,
};

/** Draft -> PUT body (BE `ExtrasBody`, extra=forbid). */
export function extrasBody(d: ExtrasDraft): { body: CafExtras } | { error: string } {
  for (const [k, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    if (d[k].trim().length > max)
      return { error: `${k.replace(/_/g, " ")}: at most ${max} characters.` };
  }
  if (d.applicant_category === "other" && !d.applicant_category_other.trim())
    return { error: "Say what kind of applicant this is." };
  const nz = (v: string) => v.trim() || null;
  return {
    body: {
      applicant_category: d.applicant_category,
      applicant_category_other:
        d.applicant_category === "other" ? nz(d.applicant_category_other) : null,
      father_or_spouse_name: nz(d.father_or_spouse_name),
      plot_no: nz(d.plot_no),
      locality: nz(d.locality),
      district: nz(d.district),
    },
  };
}

export function customNumberError(v: string): string | null {
  const t = v.trim();
  if (!t) return "Type the CAF number.";
  if (t.length > 40) return "CAF number: at most 40 characters.";
  return null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Export body: either picked subscribers or a date range (plain dates,
 * inclusive, at most 366 days). */
export function exportBody(
  mode: "picked" | "range",
  picked: string[],
  since: string,
  until: string,
  max: number,
): { body: CafExportBody } | { error: string } {
  if (mode === "picked") {
    if (picked.length === 0) return { error: "Add at least one subscriber to the list." };
    if (picked.length > max) return { error: `At most ${max} CAFs per file.` };
    return { body: { subscriber_ids: picked } };
  }
  if (!DATE.test(since) || !DATE.test(until)) return { error: "Pick both dates." };
  if (until < since) return { error: "The end date is before the start date." };
  const days = (Date.parse(until) - Date.parse(since)) / 86_400_000;
  if (days > 366) return { error: "Pick a range of 366 days or less." };
  return { body: { since, until } };
}

/** Defence in depth for display: the API only ever sends a masked ID, but
 * nothing on screen may show a 12-digit run either. */
export function maskTwelveDigits(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/(?<!\d)(?:\d[ -]?){11}\d(?!\d)/g, (m) => {
    const d = m.replace(/\D/g, "");
    return `XXXX XXXX ${d.slice(-4)}`;
  });
}

export function addressLine(parts: (string | null | undefined)[]): string {
  return parts.filter((x) => x && String(x).trim()).join(", ");
}
