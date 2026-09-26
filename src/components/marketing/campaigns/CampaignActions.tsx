import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { fallbackReason, needsFallbackAcknowledgement } from "@/lib/marketing-providers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useMarketingCredits,
  useMarketingLocationId,
  useScheduleCampaign,
  useTestSend,
  useMarketingApi,
} from "@/hooks/useMarketing";
import { formatCredits } from "@/lib/marketing-credits";
import { marketingErrorCode, marketingErrorData } from "@/services/marketing.service";
import { isValidGuestEmail } from "@/lib/portal-post-connect";
import type {
  MarketingCampaign,
  MarketingChannel,
  MarketingStatus,
  TestSendResult,
} from "@/types/marketing";
import {
  channelNotLiveCopy,
  channelStatusFor,
  formatDateTime,
  isCampaignMovedOn,
  isDefinitiveRefusal,
  marketingErrorMessage,
  newIdempotencyKey,
  useChannelLabel,
} from "../marketing-helpers";

// ── Test send ──────────────────────────────────────────────────────────

function looksLikePhone(v: string): boolean {
  const digits = v.replace(/[\s-]/g, "");
  return /^\+\d{8,15}$/.test(digits) || /^[6-9]\d{9}$/.test(digits);
}

function normaliseAddress(channel: MarketingChannel, v: string): string {
  const t = v.trim();
  if (channel === "email") return t;
  const d = t.replace(/[\s-]/g, "");
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : d;
}

/**
 * Send this campaign's message to up to three staff addresses (spec §5.5
 * test-send). Consent is not needed -- these are the owner's own phone or
 * inbox -- and they are not added to any audience. The result list shows
 * what the PROVIDER said for each address; "Sent" is never shown before
 * that answer arrives.
 */
export function TestSendDialog({
  campaign,
  open,
  onOpenChange,
  beforeSend,
}: {
  campaign: Pick<MarketingCampaign, "id" | "channel">;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** The composer saves the draft first so the test uses what is on screen.
   * Resolves to the campaign id or THROWS; the error is shown here. */
  beforeSend?: () => Promise<string>;
}) {
  const label = useChannelLabel();
  const test = useTestSend();
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState("");
  const [sampleName, setSampleName] = useState("");
  const [results, setResults] = useState<TestSendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setResults(null);
      setError(null);
    }
  }, [open]);

  const addresses = to
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = addresses.filter((a) =>
    campaign.channel === "email" ? !isValidGuestEmail(a) : !looksLikePhone(a),
  );
  const canSend = !busy && addresses.length >= 1 && addresses.length <= 3 && invalid.length === 0;

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const id = beforeSend ? await beforeSend() : campaign.id;
      const res = await test.mutateAsync({
        id,
        to: addresses.map((a) => normaliseAddress(campaign.channel, a)),
        sampleGuestName: sampleName.trim() || null,
      });
      setResults(res);
      const ok = res.results.filter((r) => r.status === "submitted").length;
      if (ok > 0) toast.success(`Test accepted by the provider for ${ok} of ${res.results.length}`);
      else toast.error("The provider refused every test message");
    } catch (err) {
      setError(
        isCampaignMovedOn(err)
          ? `This campaign is already ${err.campaign.status}. Close this and reopen it to see where it is.`
          : marketingErrorMessage(err, "Couldn't send the test."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Send a test</DialogTitle>
          <DialogDescription>
            Sends this {label(campaign.channel)} message, marked [TEST], to up to 3 of your own{" "}
            {campaign.channel === "email" ? "email addresses" : "phone numbers"}. It ignores quiet
            hours and doesn't count toward the audience.
          </DialogDescription>
        </DialogHeader>
        <TestCostNote channel={campaign.channel} />
        <div className="space-y-1.5">
          <Label htmlFor="ts-to">
            {campaign.channel === "email" ? "Email addresses" : "Phone numbers"}
          </Label>
          <Textarea
            id="ts-to"
            rows={2}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={campaign.channel === "email" ? "you@yourvenue.in" : "+91 98765 43210"}
          />
          <p className="text-[11px] text-muted-foreground">
            One per line or comma-separated.
            {addresses.length > 3 && <span className="text-red-600"> At most 3.</span>}
            {invalid.length > 0 && (
              <span className="text-red-600"> Not valid: {invalid.join(", ")}.</span>
            )}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ts-name">Sample guest name (optional)</Label>
          <Input
            id="ts-name"
            maxLength={20}
            value={sampleName}
            onChange={(e) => setSampleName(e.target.value)}
          />
        </div>
        {results && (
          <ul className="space-y-1 rounded-md border border-border p-2 text-sm">
            {results.results.map((r, i) => (
              <li key={`${r.to_masked}-${i}`} className="flex items-center gap-2">
                {r.status === "submitted" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" aria-hidden />
                )}
                <span className="font-mono text-xs">{r.to_masked}</span>
                <span className="text-xs text-muted-foreground">
                  {r.status === "submitted"
                    ? "Accepted by the provider"
                    : `Refused${r.error_code ? ` (${r.error_code})` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            {error}
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button onClick={send} disabled={!canSend}>
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** §13.10: what one test message costs, from the server's price list. */
function TestCostNote({ channel }: { channel: MarketingChannel }) {
  const q = useMarketingCredits();
  if (!q.data) return null;
  if (q.data.byo_channels.includes(channel))
    return (
      <p className="text-xs text-muted-foreground" data-testid="test-cost">
        Sent through your own provider: no Wyfy credits used.
      </p>
    );
  const p = q.data.prices[channel];
  if (!p) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="test-cost">
      Each test message costs {formatCredits(p.unit_price_minor)} credits
      {p.unit === "segment" ? " per SMS part" : ""}. You have {formatCredits(q.data.available_minor)}{" "}
      available.
    </p>
  );
}

// ── Schedule / send now ────────────────────────────────────────────────

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Schedule a draft for later, or send it now (spec §5.5 schedule).
 *
 * One idempotency key per opening of this dialog: a double click, or a
 * retry after a timeout whose request actually landed, returns the same
 * result instead of scheduling twice. The server re-validates everything
 * (channel live, template sendable, audience non-empty, quiet hours, range)
 * and every refusal is shown as its own sentence.
 */
export function ScheduleDialog({
  campaign,
  status,
  mode,
  reachable,
  open,
  onOpenChange,
  beforeSchedule,
  onScheduled,
}: {
  campaign: Pick<MarketingCampaign, "id" | "channel" | "name">;
  status: MarketingStatus;
  mode: "now" | "later";
  /** From the latest audience preview, when the caller has one. */
  reachable?: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Saves the draft first. Resolves to the campaign id, or THROWS -- the
   * error is shown in this dialog (a `CampaignMovedOnError` means it was
   * already scheduled, and the dialog closes onto the real state). */
  beforeSchedule?: () => Promise<string>;
  onScheduled: (c: MarketingCampaign) => void;
}) {
  const label = useChannelLabel();
  const schedule = useScheduleCampaign();
  const loc = useMarketingLocationId();
  const marketingApi = useMarketingApi();
  // True from the click until the request settles, INCLUDING the draft
  // save that runs first -- `schedule.isPending` alone is false during that
  // save, which is what let a double click fire two PATCHes.
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAck(false);
    setKey(newIdempotencyKey());
    setError(null);
    setSuggested(null);
    const d = new Date(Date.now() + 60 * 60_000);
    d.setMinutes(0, 0, 0);
    setWhen(toLocalInputValue(d));
  }, [open]);

  const cs = channelStatusFor(status.channels, campaign.channel);
  const notLive = !!cs && !cs.configured;
  // §12.1, founder decision Q11 (option A): an own provider row that isn't
  // the one sending means this campaign falls back to Wyfy -- only after an
  // explicit, per-attempt acknowledgement.
  const needsAck = !!cs && needsFallbackAcknowledgement(cs);
  const [ack, setAck] = useState(false);
  const quiet = status.quiet_hours;
  const quietApplies = quiet.applies_to.includes(campaign.channel);

  const whenDate = when ? new Date(when) : null;
  const tooSoon = mode === "later" && whenDate && whenDate.getTime() < Date.now() + 5 * 60_000;
  const tooFar = mode === "later" && whenDate && whenDate.getTime() > Date.now() + 60 * 86_400_000;

  const canGo =
    (!needsAck || ack) &&
    !busy &&
    !schedule.isPending &&
    !notLive &&
    reachable !== 0 &&
    (mode === "now" || (!!whenDate && !Number.isNaN(whenDate.getTime()) && !tooSoon && !tooFar));

  /** The campaign already left draft (e.g. an earlier click scheduled it):
   * show where it really is, not an error. */
  const showRealState = (c: MarketingCampaign) => {
    toast.message(
      c.status === "scheduled"
        ? `Already scheduled for ${formatDateTime(c.scheduled_at)}`
        : `This campaign is already ${c.status}`,
    );
    onScheduled(c);
    onOpenChange(false);
  };

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuggested(null);
    let id = campaign.id;
    try {
      if (beforeSchedule) id = await beforeSchedule();
      const res = await schedule.mutateAsync({
        id,
        scheduledAt: mode === "now" ? null : new Date(when).toISOString(),
        idempotencyKey: key,
        acknowledgeWyfyFallback: needsAck && ack,
      });
      toast.success(
        res.status === "scheduled"
          ? `Scheduled for ${formatDateTime(res.scheduled_at)}`
          : "Sending has started",
      );
      onScheduled(res);
      onOpenChange(false);
    } catch (err) {
      if (isCampaignMovedOn(err)) {
        showRealState(err.campaign);
        return;
      }
      const code = marketingErrorCode(err);
      if (code === "invalid_status_transition") {
        try {
          const fresh = await marketingApi.getCampaign(id, loc);
          if (fresh.status === "scheduled" || fresh.status === "sending") {
            showRealState(fresh);
            return;
          }
        } catch {
          // Fall through to the server's own message.
        }
      }
      const data = marketingErrorData(err);
      if (code === "quiet_hours" && typeof data?.next_allowed_at === "string") {
        setSuggested(data.next_allowed_at);
      }
      // Network error, timeout or 5xx: the schedule may have landed, so a
      // retry must reuse this key and get the same answer. Only a
      // definitive 4xx refusal frees it for a genuinely new attempt.
      if (isDefinitiveRefusal(err)) setKey(newIdempotencyKey());
      setError(marketingErrorMessage(err, "Couldn't schedule the campaign."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "now" ? "Send now?" : "Schedule campaign"}</DialogTitle>
          <DialogDescription>
            “{campaign.name}” by {label(campaign.channel)}
            {typeof reachable === "number" &&
              ` to about ${reachable.toLocaleString()} opted-in guest${reachable === 1 ? "" : "s"}`}
            . Guests are picked, and consent checked again, when sending starts.
          </DialogDescription>
        </DialogHeader>

        {cs && (
          <p className="text-xs text-muted-foreground" data-testid="sends-via">
            Sends via: {cs.provider_display_name ?? "Wyfy default"}
          </p>
        )}
        {needsAck && cs && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <p>{fallbackReason(label(campaign.channel), cs)}</p>
            <label className="flex items-start gap-2 font-medium">
              <Checkbox
                checked={ack}
                onCheckedChange={(v) => setAck(!!v)}
                aria-label="Send through Wyfy's default account"
                className="mt-0.5"
              />
              Send this campaign through Wyfy's default {label(campaign.channel)} account
            </label>
          </div>
        )}
        {notLive && (
          <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {channelNotLiveCopy(label(campaign.channel))}
          </p>
        )}
        {reachable === 0 && (
          <p className="rounded-md bg-muted p-2 text-sm">
            Nobody in this audience has opted in, so there is no one to send to.
          </p>
        )}

        {mode === "later" && (
          <div className="space-y-1.5">
            <Label htmlFor="sch-when">Send at (your device's time)</Label>
            <Input
              id="sch-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            {tooSoon && <p className="text-[11px] text-red-600">At least 5 minutes from now.</p>}
            {tooFar && <p className="text-[11px] text-red-600">Within the next 60 days.</p>}
          </div>
        )}
        {quietApplies && (
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {label(campaign.channel)} isn't sent between {quiet.start} and {quiet.end} (
            {quiet.timezone}). A send that runs into quiet hours pauses and resumes at {quiet.end}.
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="space-y-2 rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            <p>{error}</p>
            {suggested && mode === "later" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setWhen(toLocalInputValue(new Date(suggested)));
                  setError(null);
                  setSuggested(null);
                }}
              >
                Use {formatDateTime(suggested)}
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={go} disabled={!canGo}>
            {busy ? "Working…" : mode === "now" ? "Send now" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
