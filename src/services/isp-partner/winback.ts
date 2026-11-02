/** SMALL-3: win-back action log + save rate (CHURN-RISK flag; 404 off). Kept
 * out of revenue.ts, which stays read-only. */
import api from "@/services/api";
import type { WinbackAction, WinbackSaveRate } from "@/services/isp-partner/winback-types";

export const winbackService = {
  /** Log a win-back action (best effort; the action itself already ran). */
  async record(body: {
    subscriber_id: string;
    action: WinbackAction;
    reasons?: string[];
    ref_id?: string | null;
    idempotency_key?: string;
  }): Promise<void> {
    await api.post("/isp/revenue/churn-risk/actions", body);
  },
  /** Save rate over the last `days` (counts only, isp_billing.read). */
  async saveRate(days = 90): Promise<WinbackSaveRate> {
    const { data } = await api.get<WinbackSaveRate>("/isp/revenue/churn-risk/save-rate", {
      params: { days },
    });
    return data;
  },
};
