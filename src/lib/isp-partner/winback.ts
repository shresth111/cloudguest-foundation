/** SMALL-3: save-rate labels and formatting (pure). */
import type { WinbackAction } from "@/services/isp-partner/winback-types";

export const SAVE_RATE_KEY = ["isp", "revenue", "winback-save-rate"] as const;

export const WINBACK_LABEL: Record<WinbackAction, string> = {
  offer_renew: "Renew offers",
  ticket: "Tickets",
  whatsapp_share: "WhatsApp",
};

export function formatRate(r: number | null): string {
  return r === null ? "–" : `${Math.round(r * 1000) / 10}%`;
}
