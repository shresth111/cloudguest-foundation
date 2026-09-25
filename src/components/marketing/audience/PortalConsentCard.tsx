import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSetPortalConsent } from "@/hooks/useMarketing";
import { MARKETING_CHANNELS, type MarketingStatus } from "@/types/marketing";
import {
  CHANNEL_ICON,
  marketingErrorMessage,
  useChannelLabel,
  useMarketingCan,
  consentTextForToggle,
} from "../marketing-helpers";

const DEFAULT_TEXT_HINT =
  "Send me offers and updates from {venue_name} by SMS, WhatsApp and email. I can unsubscribe any time.";

/**
 * The WiFi-page opt-in, and how many guests have opted in so far on each
 * channel (spec §8.1 PortalConsentCard, §5.1).
 *
 * This leads the Audience tab because at launch the answer is 0 for every
 * venue (spec D6/Q4): no guest has ever been asked. The only way to build
 * an audience is to switch this on and let guests tick it, so the card says
 * that plainly instead of dressing up an empty number.
 *
 * The switch reflects the server only. It is disabled while the PUT is in
 * flight and flips when the response arrives -- never optimistically.
 */
export function PortalConsentCard({
  status,
  locationId,
  venueSelect,
}: {
  status: MarketingStatus;
  /** The venue whose portal this card writes to. `null` = the organisation's
   * default portal config, which the contract only lets us READ (§5.1 PUT
   * takes one location), so the card is read-only then. */
  locationId: string | null;
  /** Org-scoped callers: the venue selector, rendered in the card header. */
  venueSelect?: ReactNode;
}) {
  const can = useMarketingCan();
  const label = useChannelLabel();
  const mutation = useSetPortalConsent();
  const consent = status.portal_consent;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(consentTextForToggle(consent.text) ?? "");

  useEffect(() => {
    if (!editing) setText(consentTextForToggle(consent.text) ?? "");
  }, [consent.text, editing]);

  const totalOptedIn = MARKETING_CHANNELS.reduce((n, c) => n + (status.consent_counts[c] ?? 0), 0);

  // `text` is ALWAYS sent: an omitted `text` let the backend reset a custom
  // wording (and bump its version). See `consentTextForToggle`.
  const write = async (enabled: boolean, nextText: string | null) => {
    if (!locationId) return;
    try {
      const res = await mutation.mutateAsync({ location_id: locationId, enabled, text: nextText });
      toast.success(
        res.enabled
          ? "Opt-in is on for this venue's WiFi page"
          : "Opt-in is off for this venue's WiFi page",
      );
      setEditing(false);
    } catch (err) {
      toast.error(marketingErrorMessage(err, "Couldn't change the opt-in."));
    }
  };

  return (
    <Card className="premium-card">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
              <ShieldCheck className="h-4 w-4 text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Opt-in on your WiFi page</p>
              <p className="text-xs text-muted-foreground">
                An unticked checkbox on the screen guests see after they connect. It never blocks
                access. Only guests who tick it can be messaged.
              </p>
            </div>
          </div>
          {can("manage") ? (
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={consent.enabled}
                disabled={mutation.isPending || !locationId}
                onCheckedChange={(v) => void write(v, consentTextForToggle(consent.text))}
                aria-label="Show the opt-in checkbox on this venue's WiFi page"
              />
              {consent.enabled ? "On" : "Off"}
            </label>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {consent.enabled ? "On" : "Off"}
            </span>
          )}
        </div>

        {venueSelect}
        {!locationId && (
          <p className="text-xs text-muted-foreground">
            This is your organisation's default WiFi page, used by venues without their own. Pick a
            venue above to turn its opt-in on or off.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {MARKETING_CHANNELS.map((c) => {
            const Icon = CHANNEL_ICON[c];
            return (
              <div key={c} className="rounded-lg border border-border p-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label(c)}
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums">
                  {(status.consent_counts[c] ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">opted in</p>
              </div>
            );
          })}
        </div>

        {totalOptedIn === 0 && (
          <p className="rounded-md bg-muted/50 p-3 text-sm">
            0 guests have opted in to messages yet.{" "}
            {consent.enabled
              ? "The checkbox is live; the count grows as guests tick it."
              : "Turn on the opt-in on your WiFi page to start building your audience."}
          </p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="consent-text" className="text-xs">
              Wording guests see
            </Label>
            {can("manage") && !editing && locationId && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit wording
              </Button>
            )}
          </div>
          {editing ? (
            <>
              <Textarea
                id="consent-text"
                rows={3}
                maxLength={300}
                value={text}
                placeholder={DEFAULT_TEXT_HINT}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty to use the default wording. Changing it starts a new consent version, so
                every opt-in records exactly what the guest agreed to.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={mutation.isPending || !locationId}
                  onClick={() => void write(consent.enabled, text.trim() || null)}
                >
                  {mutation.isPending ? "Saving…" : "Save wording"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <p className="rounded-md border border-border bg-muted/30 p-2.5 text-sm">
              {consent.text || DEFAULT_TEXT_HINT}
              {consent.text_version && (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  ({consent.text_version})
                </span>
              )}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
