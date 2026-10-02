import { useEffect } from "react";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudiencePreview } from "@/hooks/useMarketing";
import type { AudienceFilter, AudiencePreview, MarketingStatus } from "@/types/marketing";
import {
  EXCLUSION_LABEL,
  formatDateTime,
  marketingErrorMessage,
  useChannelLabel,
} from "../marketing-helpers";
import { audienceFilterInvalid, cleanAudienceFilter } from "../marketing-helpers";

/**
 * The live count (spec §5.3): how many guests a campaign with this filter
 * would actually reach, and -- just as prominently -- how many it would NOT
 * and why. The "never opted in" and "opted out" lines are the point: an
 * owner looking at "412 reachable" should see the 1,301 it left out for
 * lack of consent, so the number is never mistaken for their guest list.
 *
 * Every number is the server's exact COUNT (debounced 400 ms). Nothing is
 * estimated here.
 */
export function AudiencePreviewCard({
  filter,
  status,
  onResult,
}: {
  filter: AudienceFilter;
  status: MarketingStatus;
  onResult?: (p: AudiencePreview | undefined) => void;
}) {
  const label = useChannelLabel();
  const invalid = audienceFilterInvalid(filter);
  const preview = useAudiencePreview(invalid ? null : cleanAudienceFilter(filter));
  const data = preview.data;
  const result = invalid ? undefined : data;
  useEffect(() => {
    onResult?.(result);
    // `onResult` is a setter from the parent; only the answer should re-fire it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  const cap = status.limits.max_recipients_per_campaign;

  return (
    <Card className="premium-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" aria-hidden /> Who this reaches
          </p>
          {preview.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {invalid ? (
          <p className="text-sm text-muted-foreground">Fix the filter to see the count.</p>
        ) : preview.isError ? (
          <p className="text-sm text-red-600">
            {marketingErrorMessage(preview.error, "Couldn't count this audience.")}
          </p>
        ) : !data ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {data.reachable.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                guests reachable on {label(data.channel)}, out of{" "}
                {data.matched_guests.toLocaleString()} matching the filters
              </p>
            </div>
            {data.capped && (
              <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                More than the {cap.toLocaleString()}-per-campaign limit. Only the{" "}
                {cap.toLocaleString()} most recently seen would be sent to. Narrow the filter or
                split it into two campaigns.
              </p>
            )}
            {data.reachable === 0 && (
              <p className="rounded-md bg-muted/60 p-2 text-xs">
                Nobody here can be messaged yet. Only guests who ticked the opt-in on your WiFi page
                are reachable.
              </p>
            )}
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Left out
              </p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
                {Object.entries(data.excluded).map(([k, n]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{EXCLUSION_LABEL[k] ?? k}</dt>
                    <dd className="text-right tabular-nums">{n.toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {data.sample.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Most recently seen
                </p>
                <ul className="divide-y divide-border text-xs">
                  {data.sample.map((g) => (
                    <li key={g.guest_id} className="flex items-center justify-between gap-2 py-1">
                      <span className="min-w-0 truncate">
                        {g.display_name ?? <span className="text-muted-foreground">No name</span>}{" "}
                        <span className="font-mono text-muted-foreground">
                          {g.masked_address ?? ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {g.total_visit_count} visit{g.total_visit_count === 1 ? "" : "s"} ·{" "}
                        {formatDateTime(g.last_seen_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              Consent is checked again for every guest at the moment of sending, so anyone who opts
              out before then is skipped.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
