import { api } from "@/services/api";

/**
 * `GET /me/entitlements` -- the caller's own organization's plan features, as
 * the backend's entitlement snapshot reports them (the same snapshot
 * `RequireFeature` enforces). Ungated on the backend by design: every
 * signed-in user may read their own organization's entitlements.
 *
 * No FE code read this endpoint before the Marketing add-on
 * (wyfy-specs/guest-marketing-campaigns.md §3.5). Its own module, importing
 * only `api`, because `useCustomerDashboard.ts` imports it and that hook
 * module sits on the path of every customer route's `beforeLoad`.
 */
export interface MyEntitlements {
  customer_id: string;
  features: { feature_key: string; enabled: boolean; limits: Record<string, unknown> }[];
}

export async function getMyEntitlements(): Promise<MyEntitlements> {
  const { data } = await api.get<MyEntitlements>("/me/entitlements");
  return data;
}
