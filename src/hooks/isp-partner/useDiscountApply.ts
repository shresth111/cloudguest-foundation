/** DISCOUNT-WIRE: is the hook on (probe 200)? Off / no access = no code field. */
import { useQuery } from "@tanstack/react-query";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { discountApplyService } from "@/services/isp-partner/discount-apply";

export function useDiscountApply() {
  const { can } = usePartner();
  const allowed = can("isp_invoices.read");
  const q = useQuery({
    queryKey: ["isp", "discount-apply"],
    queryFn: () => discountApplyService.status(),
    enabled: allowed,
    retry: false,
    staleTime: 10 * 60_000,
  });
  return { enabled: allowed && q.isSuccess, status: q.data ?? null };
}
