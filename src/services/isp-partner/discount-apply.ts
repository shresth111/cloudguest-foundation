/** DISCOUNT-WIRE probe (`GET /isp/billing/discount-apply`, 404 while
 * ISP_DISCOUNT_APPLY_ENABLED is off). The preview itself is JAZE-5's
 * existing `appsService.previewDiscount`. */
import api from "@/services/api";

export interface DiscountApplyStatus {
  enabled: boolean;
  gst_enabled: boolean;
  gst_rate_bp: number;
}

export const discountApplyService = {
  async status(): Promise<DiscountApplyStatus> {
    const { data } = await api.get<DiscountApplyStatus>("/isp/billing/discount-apply");
    return data;
  },
};
