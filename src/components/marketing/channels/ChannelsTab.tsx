import { Clock, KeyRound, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/common/ErrorState";
import { CardGridSkeleton } from "@/components/common/LoadingSkeleton";
import { useMarketingProviders, useMarketingScope, useSupportRequest } from "@/hooks/useMarketing";
import { marketingError } from "@/services/marketing.service";
import { requestErrorMessage } from "@/services/api";
import { MARKETING_CHANNELS, type MarketingStatus } from "@/types/marketing";
import {
  BYO_REQUEST_SUBJECT,
  COMPLIANCE_ACK,
  isByoLocked,
  marketingErrorMessage,
  useHasPermission,
} from "../marketing-helpers";
import { ProviderCard } from "./ProviderCard";

function ByoUpsell() {
  const { existing, request } = useSupportRequest(BYO_REQUEST_SUBJECT);
  const pending = existing.data ?? null;
  return (
    <Card className="premium-card">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <div>
            <p className="font-semibold">Use your own SMS, WhatsApp or email account</p>
            <p className="text-sm text-muted-foreground">
              Send through your own provider and sender, with your own registration, and use no Wyfy
              credits. It's a separate add-on to Marketing.
            </p>
          </div>
        </div>
        {pending ? (
          <p className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
            <Clock className="h-4 w-4 text-amber-600" aria-hidden /> Request pending
          </p>
        ) : request.isSuccess ? (
          <p className="shrink-0 text-sm font-medium">Request sent</p>
        ) : (
          <Button
            className="shrink-0"
            disabled={request.isPending || existing.isLoading}
            onClick={() =>
              request.mutate(
                "Please enable the Marketing bring-your-own providers add-on (our own SMS, WhatsApp or email account) for our organisation.",
                {
                  onSuccess: (t) => toast.success(`Request sent: ticket #${t.id.slice(0, 8)}`),
                  onError: (e) => toast.error(requestErrorMessage(e, "Couldn't send the request.")),
                },
              )
            }
          >
            {request.isPending ? "Sending request…" : "Request the add-on"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Channels tab (spec §12.6): which account sends each channel -- Wyfy's
 * default, or the venue's own.
 *
 * Who sees what:
 *   - marketing_providers.read (org owner/admin): the full cards from
 *     GET /marketing/providers; .manage adds edit/verify/enable/remove.
 *   - Everyone else with marketing.read (and every venue-level role, which
 *     can never hold the org-level providers grant): the three cards
 *     read-only, from /marketing/status. The providers endpoint is not even
 *     asked.
 *   - BYO add-on locked (402, feature_key guest_marketing_byo): Wyfy-default
 *     cards plus the upsell.
 */
export function ChannelsTab({ status }: { status: MarketingStatus }) {
  const scope = useMarketingScope();
  const has = useHasPermission();
  const mayRead = scope.kind === "organization" && has("marketing_providers.read");
  const mayManage = mayRead && has("marketing_providers.manage");
  const providers = useMarketingProviders(mayRead);

  const locked = providers.isError && isByoLocked(providers.error);
  const forbidden = providers.isError && !locked && marketingError(providers.error)?.status === 403;
  const readOnly = !mayRead || locked || forbidden;

  if (mayRead && providers.isLoading) return <CardGridSkeleton count={3} />;
  if (mayRead && providers.isError && !locked && !forbidden) {
    return (
      <ErrorState
        title="Couldn't load your channel providers"
        description={marketingErrorMessage(providers.error)}
        onRetry={() => void providers.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="flex max-w-3xl items-start gap-2 text-sm text-muted-foreground">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Every channel sends through Wyfy's account by default. With the bring-your-own add-on you
        can send through your own SMS, WhatsApp or email account instead.{" "}
        {!readOnly && COMPLIANCE_ACK}
      </p>
      {locked && <ByoUpsell />}
      <div className="grid gap-3 lg:grid-cols-3">
        {MARKETING_CHANNELS.map((c) => {
          const row = providers.data?.channels.find((x) => x.channel === c);
          return (
            <ProviderCard
              key={c}
              channel={c}
              statusChannel={status.channels.find((x) => x.channel === c)}
              own={readOnly ? undefined : (row?.own ?? null)}
              canManage={!readOnly && mayManage}
            />
          );
        })}
      </div>
      {readOnly && !locked && (
        <p className="text-xs text-muted-foreground">
          Only your account owner or an organisation admin can change these.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Whatever the provider, Wyfy still applies consent, opt-outs, quiet hours and unsubscribe
        links to every message.
      </p>
    </div>
  );
}
