/**
 * P3-SWEEP: two read-only Subscriber 360 cards, mounted like the other lanes'
 * self-hiding panels (QueuedRenewalCard): each renders nothing while its flag
 * is off (the route 404s), on any other error, or without its read key.
 *
 * - Collections (COLLECTIONS-1 `GET /isp/collections/subscribers/{id}/timeline`,
 *   isp_collections.read): open dues, overdue, the open promise to pay, the
 *   last collection note.
 * - Referrals (REFERRAL-1 `GET /isp/referrals?subscriber_id=`,
 *   isp_referrals.read): who referred this subscriber, and whom they referred.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MTag } from "@/components/master/MasterKit";
import { Card } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { OUTCOME_LABEL, PROMISE_LABEL, promiseTone } from "@/lib/isp-partner/collections";
import { formatDate, formatDateTime } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { REFERRAL_LABEL, referralTone } from "@/lib/isp-partner/referrals";
import { collectionsSummary, referralSides } from "@/lib/isp-partner/sub360-cards";
import { collectionsService } from "@/services/isp-partner/collections";
import { referralsService, type Referral } from "@/services/isp-partner/referrals";

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function SubscriberCollectionsCard({ subscriberId }: { subscriberId: string }) {
  const { can } = usePartner();
  const allowed = can("isp_collections.read");
  const q = useQuery({
    queryKey: ["isp", "collections", "timeline", "subscriber", subscriberId],
    queryFn: () => collectionsService.timeline({ subscriber_id: subscriberId }),
    enabled: allowed,
    retry: false,
  });
  if (!allowed || q.error || !q.data) return null; // no key, flag off (404) or not loaded
  const c = collectionsSummary(q.data);
  return (
    <Card
      title="Collections"
      actions={
        <Link to="/partner/collections" className="text-xs text-primary hover:underline">
          Open collections
        </Link>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <Fact k="Open dues">
          {c.openPaise === null ? "Not available" : formatRupees(c.openPaise)}
        </Fact>
        <Fact k="Overdue">
          <span className={c.overduePaise > 0 ? "font-medium text-destructive" : undefined}>
            {formatRupees(c.overduePaise)}
          </span>
        </Fact>
        <Fact k="Promise to pay">
          {c.promise ? (
            <>
              <MTag label={PROMISE_LABEL[c.promise.status]} tone={promiseTone(c.promise.status)} />{" "}
              {formatRupees(c.promise.target_paise)} by {formatDate(c.promise.promised_on)}
              {c.promise.note && (
                <span className="block text-xs text-muted-foreground">{c.promise.note}</span>
              )}
            </>
          ) : (
            "None open"
          )}
        </Fact>
        <Fact k="Last note">
          {c.lastNote ? (
            <>
              {c.lastNote.outcome && (
                <span className="font-medium">{OUTCOME_LABEL[c.lastNote.outcome]} · </span>
              )}
              {c.lastNote.body}
              <span className="block text-xs text-muted-foreground">
                {formatDateTime(c.lastNote.at)}
                {c.lastNote.actor?.name ? ` · ${c.lastNote.actor.name}` : ""}
              </span>
            </>
          ) : (
            "No notes yet"
          )}
        </Fact>
      </dl>
    </Card>
  );
}

function Party({ r, side }: { r: Referral; side: "referrer" | "referred" }) {
  const p = r[side];
  return (
    <span>
      <Link
        to="/partner/subscribers/$subscriberId"
        params={{ subscriberId: p.subscriber_id }}
        className="hover:underline"
      >
        {p.label || p.identifier || "Subscriber"}
      </Link>{" "}
      <MTag label={REFERRAL_LABEL[r.status] ?? r.status} tone={referralTone(r.status)} />
      {r.credit_note_number && (
        <span className="text-xs text-muted-foreground">
          {" "}
          · credit note {r.credit_note_number}
          {r.applied_paise ? ` (${formatRupees(r.applied_paise)})` : ""}
        </span>
      )}
    </span>
  );
}

export function SubscriberReferralsCard({ subscriberId }: { subscriberId: string }) {
  const { can } = usePartner();
  const allowed = can("isp_referrals.read");
  const q = useQuery({
    queryKey: ["isp", "referrals", "subscriber", subscriberId],
    queryFn: () => referralsService.list({ subscriber_id: subscriberId }),
    enabled: allowed,
    retry: false,
  });
  if (!allowed || q.error || !q.data) return null; // no key, flag off (404) or not loaded
  const r = referralSides(q.data.items, subscriberId);
  return (
    <Card
      title="Referrals"
      actions={
        <Link to="/partner/referrals" className="text-xs text-primary hover:underline">
          Open referrals
        </Link>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <Fact k="Referred by">
          {r.referredBy ? <Party r={r.referredBy} side="referrer" /> : "Nobody recorded"}
        </Fact>
        <Fact k="Referred">
          {r.referred.length === 0 ? (
            "Nobody yet"
          ) : (
            <ul className="space-y-1">
              {r.referred.slice(0, 5).map((x) => (
                <li key={x.id}>
                  <Party r={x} side="referred" />
                </li>
              ))}
              {r.referred.length > 5 && (
                <li className="text-xs text-muted-foreground">
                  and {r.referred.length - 5} more on the Referrals page
                </li>
              )}
            </ul>
          )}
        </Fact>
        {r.creditedPaise > 0 && <Fact k="Credited">{formatRupees(r.creditedPaise)}</Fact>}
      </dl>
    </Card>
  );
}
