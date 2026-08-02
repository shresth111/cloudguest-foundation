/**
 * Maps an ISP link's free-text `providerName` to one of a small set of
 * recognizable Indian-ISP brand badges, purely for iconography -- the
 * backend has no ISP enum to key off of (`IspLink.provider_name`/
 * `providerName` is a plain string field, see
 * `backend/app/domains/isp/models.py`), so this matches on the same
 * provider names this codebase's own demo fixtures already use
 * (`customer.service.ts`'s `DEMO_LOCATIONS`, `OperationsFeatures.tsx`'s
 * `DEMO_LINKS`, `customer.$locationId.dashboard.tsx`'s `DEMO_WAN_LINK`):
 * Airtel, Jio, ACT Fibernet, Tata Communications, BSNL -- plus Vi
 * (Vodafone Idea), the other major pan-India carrier, for completeness.
 * Anything else (a smaller/local/international ISP, or a typo) falls back
 * to a neutral "generic" badge rather than guessing wrong.
 */
export type IspBrandId = "airtel" | "jio" | "vi" | "bsnl" | "act" | "tata" | "generic";

export function resolveIspBrand(providerName: string | null | undefined): IspBrandId {
  const n = (providerName ?? "").toLowerCase();
  if (!n) return "generic";
  if (n.includes("airtel")) return "airtel";
  if (/\bjio\b/.test(n)) return "jio";
  if (n.includes("vodafone") || n.includes("idea") || /\bvi\b/.test(n)) return "vi";
  if (n.includes("bsnl")) return "bsnl";
  if (n.includes("act ") || n.includes("fibernet") || n === "act") return "act";
  if (n.includes("tata")) return "tata";
  return "generic";
}

export const ISP_BRAND_LABEL: Record<IspBrandId, string> = {
  airtel: "Airtel",
  jio: "Jio",
  vi: "Vi (Vodafone Idea)",
  bsnl: "BSNL",
  act: "ACT Fibernet",
  tata: "Tata",
  generic: "ISP",
};
