/** SMALL-3: CHURN-RISK win-back save rate (BE winback_service). */
export type WinbackAction = "offer_renew" | "ticket" | "whatsapp_share";

export interface WinbackActionStats {
  actions: number;
  saved: number;
  lost: number;
  pending: number;
  save_rate: number | null;
}

export interface WinbackSaveRate {
  days: number;
  window_days: number;
  actions: number;
  subscribers: number;
  saved: number;
  lost: number;
  pending: number;
  /** saved / (saved + lost); null until something is decided. */
  save_rate: number | null;
  saved_via_actions: { renewal: number; payment: number };
  by_action: Record<WinbackAction, WinbackActionStats>;
  definition: string;
}
