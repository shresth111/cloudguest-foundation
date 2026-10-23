/**
 * Add-on gate for the customer workspace (ADDENDUM_04 §2, batch B6).
 *
 * An add-on row opens only when the add-on is ON for this customer
 * (`GET /isp/customers/{id}/addons`, which reads the same
 * OrganizationFeatureOverride + plan merge that `RequireFeature` enforces).
 * The ISP can switch it on only within Master's allowance (default none until
 * founder F1 is answered). The backend's own 402 `feature_not_entitled` on
 * every add-on twin is the real boundary; this only decides which screen shows.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { PartnerAddonKey } from "@/components/isp-partner/customer-shell/nav";

export interface CustomerAddon {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  allowed: boolean;
  source: string;
  blocked_by: string | null;
}

const addonKey = (customerId: string) => ["isp-customer-addons", customerId];

/** Pure: is this row open, given the customer's add-on list? */
export function addonOpenFrom(
  items: readonly Pick<CustomerAddon, "key" | "enabled">[] | undefined,
  key: PartnerAddonKey | undefined,
): boolean {
  if (key === undefined) return true;
  return !!items?.find((a) => a.key === key)?.enabled;
}

export function useCustomerAddons(customerId: string, enabled = true) {
  return useQuery({
    queryKey: addonKey(customerId),
    queryFn: async () => {
      const { data } = await api.get<{ items: CustomerAddon[] }>(
        `/isp/customers/${customerId}/addons`,
      );
      return data.items;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** `null` while loading (the shell shows a spinner, not the lock screen). */
export function useAddonOpen(customerId: string, key: PartnerAddonKey | undefined): boolean | null {
  const q = useCustomerAddons(customerId, key !== undefined);
  if (key === undefined) return true;
  if (q.isLoading) return null;
  return addonOpenFrom(q.data, key);
}

export function useSetCustomerAddon(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      await api.put(`/isp/customers/${customerId}/addons/${key}`, { enabled });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: addonKey(customerId) }),
  });
}
