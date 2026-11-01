/** REFERRAL-1 pure helpers. */
import type { ReferralStatus } from "@/services/isp-partner/referrals";

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "pending",
  "earned",
  "applied",
  "rejected",
  "cancelled",
];

export const REFERRAL_LABEL: Record<ReferralStatus, string> = {
  pending: "Waiting for first payment",
  earned: "Earned, waiting for next bill",
  applied: "Credited",
  rejected: "Not eligible",
  cancelled: "Cancelled",
};

export function referralTone(s: ReferralStatus): string {
  if (s === "applied") return "paid";
  if (s === "earned") return "active";
  if (s === "pending") return "pending";
  if (s === "rejected") return "overdue";
  return "offline";
}

/** Settings form checks, mirroring the API's limits. */
export function settingsError(v: {
  enabled: boolean;
  reward_paise: number | null;
  max_rewards_per_year: number;
  window_days: number;
}): string | null {
  if (v.reward_paise === null || v.reward_paise < 0) return "Enter the reward in rupees.";
  if (v.reward_paise > 1_000_000) return "At most ₹10,000 per referral.";
  if (v.enabled && v.reward_paise === 0) return "Set a reward before switching referrals on.";
  if (
    !Number.isInteger(v.max_rewards_per_year) ||
    v.max_rewards_per_year < 0 ||
    v.max_rewards_per_year > 365
  )
    return "Rewards a year: 0 to 365.";
  if (!Number.isInteger(v.window_days) || v.window_days < 1 || v.window_days > 365)
    return "Window: 1 to 365 days.";
  return null;
}

export function sameSubscriber(a: string | null, b: string | null): boolean {
  return !!a && a === b;
}
