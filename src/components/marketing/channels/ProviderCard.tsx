import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useDeleteProvider, useMarketingApi, useSaveProvider } from "@/hooks/useMarketing";
import {
  isSecretHint,
  providerLabel,
  providerTypeDef,
  providerTypesFor,
  type Channel,
} from "@/lib/marketing-providers";
import type { ChannelStatus, MarketingChannel, ProviderView } from "@/types/marketing";
import {
  CHANNEL_ICON,
  COMPLIANCE_ACK,
  formatDateTime,
  marketingErrorMessage,
  useChannelLabel,
} from "../marketing-helpers";
import { ProviderForm } from "./ProviderForm";
import { VerifyProviderDialog } from "./VerifyProviderDialog";

function StatusTag({ status }: { status: ProviderView["status"] }) {
  const map = {
    verified: {
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
      icon: CheckCircle2,
      text: "Verified",
    },
    unverified: { cls: "bg-muted text-muted-foreground", icon: CircleDashed, text: "Not verified" },
    failed: {
      cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
      icon: AlertTriangle,
      text: "Failed",
    },
  }[status] ?? { cls: "bg-muted text-muted-foreground", icon: CircleDashed, text: status };
  const Icon = map.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        map.cls,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden /> {map.text}
    </span>
  );
}

/** "Ping4SMS (CAFEXY)" -- provider name plus the sender, never a secret. */
function ownProviderName(own: Pick<ProviderView, "provider_type" | "display">): string {
  const d = own.display ?? {};
  const sender = [d.sender_id, d.from_address].find((v) => typeof v === "string" && v) as
    | string
    | undefined;
  return sender
    ? `${providerLabel(own.provider_type)} (${sender})`
    : providerLabel(own.provider_type);
}

/**
 * One channel's provider (spec §12.6): which account sends it, the own
 * provider's status, and -- for someone who may manage it -- edit, verify,
 * enable/disable and "Remove and use Wyfy".
 *
 * `own === undefined` means "not readable by this caller" (no
 * marketing_providers.read, a venue-level role, or the BYO add-on locked):
 * the card then shows only what /marketing/status says.
 */
export function ProviderCard({
  channel,
  statusChannel,
  own,
  canManage,
}: {
  channel: MarketingChannel;
  statusChannel: ChannelStatus | undefined;
  own: ProviderView | null | undefined;
  canManage: boolean;
}) {
  const label = useChannelLabel();
  const api = useMarketingApi();
  const save = useSaveProvider();
  const remove = useDeleteProvider();
  const [formOpen, setFormOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ count: number | null } | null>(null);
  const Icon = CHANNEL_ICON[channel];

  const usingOwn = own ? own.effective : statusChannel?.provider_source === "own";
  const heading = usingOwn
    ? own
      ? `Using your own · ${ownProviderName(own)}`
      : (statusChannel?.provider_display_name ?? "Using your own provider")
    : "Using Wyfy (default)";
  const anyAvailable = providerTypesFor(channel as Channel).some((t) => t.available);

  const setEnabled = async (enabled: boolean) => {
    if (!own) return;
    try {
      await save.mutateAsync({
        channel,
        body: { provider_type: own.provider_type as never, config: {}, enabled },
      });
      toast.success(
        enabled
          ? `${label(channel)} now sends through your own ${providerLabel(own.provider_type)}.`
          : `${label(channel)} is back on Wyfy's default account.`,
      );
    } catch (err) {
      toast.error(marketingErrorMessage(err, "Couldn't change the provider."));
    }
  };

  // Pre-flight (§12.4): how many campaigns are queued on this channel, so
  // the confirmation can say what removing the provider will do to them.
  const askRemove = async () => {
    setConfirmRemove({ count: null });
    try {
      const page = await api.listCampaigns({
        status: ["scheduled", "sending"],
        channel,
        page: 1,
        page_size: 1,
      });
      setConfirmRemove({ count: page.total_items });
    } catch {
      setConfirmRemove({ count: null });
    }
  };

  const doRemove = async () => {
    try {
      const r = await remove.mutateAsync(channel);
      toast.success(
        r.affected_campaign_count > 0
          ? `Removed. ${r.affected_campaign_count} scheduled campaign${r.affected_campaign_count === 1 ? "" : "s"} set to use it will fail when they start.`
          : `Removed. ${label(channel)} now sends through Wyfy's default account.`,
      );
    } catch (err) {
      toast.error(marketingErrorMessage(err, "Couldn't remove the provider."));
    } finally {
      setConfirmRemove(null);
    }
  };

  const shownFields = own
    ? (providerTypeDef(own.provider_type)?.fields ?? []).filter(
        (f) => own.display[f.key] !== undefined && own.display[f.key] !== null,
      )
    : [];

  return (
    <Card className="premium-card" data-testid={`provider-card-${channel}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">{label(channel)}</p>
              <p className="text-sm text-muted-foreground">{heading}</p>
            </div>
          </div>
          {own && <StatusTag status={own.status} />}
          {own === undefined && statusChannel?.own_provider_status && (
            <StatusTag status={statusChannel.own_provider_status} />
          )}
        </div>

        {own?.last_error && own.status !== "verified" && (
          <p className="rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300">
            {own.last_error}
          </p>
        )}
        {own && !own.effective && (
          <p className="text-xs text-muted-foreground">
            {own.status !== "verified"
              ? `Not sending yet: verify it first. Until then ${label(channel)} goes through Wyfy.`
              : !own.enabled
                ? `Turned off: ${label(channel)} goes through Wyfy.`
                : `Not in use: ${label(channel)} goes through Wyfy.`}
          </p>
        )}

        {own && shownFields.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {shownFields.map((f) => {
              const v = own.display[f.key];
              return (
                <div key={f.key} className="contents">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="break-all">
                    {isSecretHint(v) ? (v.set ? `Saved (${v.hint ?? "…"})` : "Not set") : String(v)}
                  </dd>
                </div>
              );
            })}
            {own.last_verified_at && (
              <div className="contents">
                <dt className="text-muted-foreground">Last verified</dt>
                <dd>{formatDateTime(own.last_verified_at)}</dd>
              </div>
            )}
          </dl>
        )}

        {canManage && own !== undefined && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {own ? (
              <>
                <label
                  className="flex items-center gap-2 text-sm"
                  title={
                    own.status !== "verified"
                      ? "Verify the provider before turning it on."
                      : undefined
                  }
                >
                  <Switch
                    checked={own.enabled}
                    disabled={save.isPending || (own.status !== "verified" && !own.enabled)}
                    onCheckedChange={(v) => (v ? setConfirmEnable(true) : void setEnabled(false))}
                    aria-label={`Send ${label(channel)} through your own provider`}
                  />
                  {own.enabled ? "On" : "Off"}
                </label>
                <Button size="sm" variant="outline" onClick={() => setVerifyOpen(true)}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Verify
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => void askRemove()}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove and use Wyfy
                </Button>
              </>
            ) : anyAvailable ? (
              <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                Use my own {label(channel)} account
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Using your own {label(channel)} account is coming soon.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {canManage && (
        <>
          <ProviderForm
            channel={channel}
            own={own ?? null}
            open={formOpen}
            onOpenChange={setFormOpen}
          />
          <VerifyProviderDialog channel={channel} open={verifyOpen} onOpenChange={setVerifyOpen} />
          <ConfirmDialog
            open={confirmEnable}
            onOpenChange={setConfirmEnable}
            title={`Send ${label(channel)} through your own account?`}
            description={`${COMPLIANCE_ACK} Wyfy still applies consent, opt-outs, quiet hours and unsubscribe links. New campaigns use it from now on; campaigns already scheduled keep the provider they were scheduled with.`}
            confirmLabel="I understand, turn it on"
            onConfirm={() => void setEnabled(true)}
          />
          <ConfirmDialog
            open={!!confirmRemove}
            onOpenChange={(o) => !o && setConfirmRemove(null)}
            title={`Remove your own ${label(channel)} provider?`}
            description={
              confirmRemove?.count === null
                ? `New campaigns will send through Wyfy's default account. Scheduled campaigns that were set to use your own provider will fail when they start.`
                : `New campaigns will send through Wyfy's default account. ${confirmRemove?.count ?? 0} ${label(channel)} campaign${confirmRemove?.count === 1 ? " is" : "s are"} scheduled or sending; any set to use your own provider will fail when they start. Saved credentials are deleted.`
            }
            confirmLabel="Remove and use Wyfy"
            destructive
            onConfirm={() => void doRemove()}
          />
        </>
      )}
    </Card>
  );
}
