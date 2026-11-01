/** P3-SWEEP: the read-only Subscriber 360 cards for collections and
 * referrals. Pure helpers so the numbers can be tested without a DOM. */
import type { Timeline, TimelineEvent } from "@/services/isp-partner/collections-types";
import type { Referral } from "@/services/isp-partner/referrals";

export interface CollectionsSummary {
  /** null = the backend did not say (older build): shown as "not available". */
  openPaise: number | null;
  overduePaise: number;
  promise: Timeline["open_promise"];
  lastNote: TimelineEvent | null;
}

export function collectionsSummary(t: Timeline): CollectionsSummary {
  return {
    openPaise: typeof t.open_paise === "number" ? t.open_paise : null,
    overduePaise: t.overdue_paise,
    promise: t.open_promise,
    // items are newest first; a note is a collections event of kind "note"
    lastNote: t.items.find((e) => e.source === "collections" && e.kind === "note") ?? null,
  };
}

export interface ReferralSides {
  /** who referred this subscriber (the newest live one, else the newest) */
  referredBy: Referral | null;
  /** whom this subscriber referred, newest first */
  referred: Referral[];
  creditedPaise: number;
}

const LIVE = new Set(["pending", "earned", "applied"]);

export function referralSides(items: Referral[], subscriberId: string): ReferralSides {
  const inbound = items.filter((r) => r.referred.subscriber_id === subscriberId);
  const referred = items.filter((r) => r.referrer.subscriber_id === subscriberId);
  return {
    referredBy: inbound.find((r) => LIVE.has(r.status)) ?? inbound[0] ?? null,
    referred,
    creditedPaise: referred.reduce((n, r) => n + (r.applied_paise ?? 0), 0),
  };
}
