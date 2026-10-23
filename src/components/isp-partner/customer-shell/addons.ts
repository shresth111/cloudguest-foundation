/**
 * Add-on gate for the customer workspace (ADDENDUM_04 §2).
 *
 * An add-on row opens only when Master has allowed that add-on for this ISP
 * and the ISP has switched it on for the customer. Founder question F1 is
 * open, and until it is answered the Master allowance defaults to NONE, so
 * this returns "not allowed" for every add-on. Batch B6 replaces the body with
 * a read of the allowance and the per-customer toggle; nothing else in the
 * shell changes. The backend's own 402 `feature_not_entitled` on every
 * add-on twin is the real boundary.
 */
import type { PartnerAddonKey } from "@/components/isp-partner/customer-shell/nav";

export function useAddonOpen(_customerId: string, _key: PartnerAddonKey | undefined): boolean {
  return _key === undefined;
}
