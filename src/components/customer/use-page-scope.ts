/** Non-component exports split out of `CustomerPageScope.tsx` so that file
 * only exports components (react-refresh/only-export-components). */
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { CUSTOMER_NAVS } from "@/lib/customerNav";
import type { PageScope } from "@/components/customer/console";

/** The title + venue a screen's own PageHeader shows: the same nav label
 * (and translation) the scope line below would have shown. */
export function useCustomerPageScope(featureId: string, locationName?: string): PageScope {
  const { t } = useTranslation("nav", { i18n });
  const item = CUSTOMER_NAVS.find((n) => n.id === featureId);
  return {
    title: item ? t(`customerItem.${item.id}`, item.label) : featureId,
    venue: locationName,
  };
}
