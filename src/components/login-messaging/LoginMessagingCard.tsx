import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  KeyRound,
  MessageCircle,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  useLoginMessaging,
  useRemoveLoginProvider,
  useSaveLoginProvider,
} from "@/hooks/useLoginMessaging";
import { requestErrorOf } from "@/services/api";
import { fieldValueText } from "@/lib/login-messaging-form";
import { cn } from "@/lib/utils";
import {
  LOGIN_CHANNELS,
  type AdapterSchema,
  type LoginChannelState,
  type LoginMessagingTarget,
  type LoginProviderView,
} from "@/types/login-messaging";
import { LayerDialog } from "./LayerDialog";
import { LoginProviderForm } from "./LoginProviderForm";
import { VerifyLoginProviderDialog } from "./VerifyLoginProviderDialog";
import { CHANNEL_LABEL, loginMessagingError } from "./login-messaging-copy";

const CHANNEL_ICON = { whatsapp: MessageCircle, sms: MessageSquare } as const;

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: typeof CheckCircle2; text: string }> = {
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
  };
  const m = map[status] ?? {
    cls: "bg-muted text-muted-foreground",
    icon: CircleDashed,
    text: status,
  };
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        m.cls,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden /> {m.text}
    </span>
  );
}

/**
 * "Login messaging": which account sends guests' login codes on WhatsApp and
 * SMS. By default Wyfy Guest's own account sends them, and nobody has to do
 * anything. A venue (or the Wyfy team, from Master, for that venue) can plug
 * in its own WhatsApp or SMS API; it is used once verified, and whenever it
 * fails a code goes out from Wyfy Guest instead so no guest is locked out.
 *
 * `target.kind === "platform"` is the Master console acting for one
 * organization (the backend takes the organization from the path and
 * requires a GLOBAL grant).
 */
export function LoginMessagingCard({
  target,
  canManage,
  enabled = true,
  compact = false,
}: {
  target: LoginMessagingTarget;
  canManage: boolean;
  /** false: don't ask the server (e.g. the demo account) and show the default. */
  enabled?: boolean;
  compact?: boolean;
}) {
  const q = useLoginMessaging(target, enabled);
  const forbidden = q.isError && requestErrorOf(q.error)?.status === 403;
  const master = target.kind === "platform";

  if (forbidden && !master) return null; // a role without the grant sees nothing

  const body = !enabled ? (
    <DefaultOnly />
  ) : q.isLoading ? (
    <div className="space-y-2" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  ) : q.isError || !q.data ? (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="font-medium">Couldn't load login messaging.</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {loginMessagingError(q.error, "The server did not answer.")}
      </p>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => void q.refetch()}>
        Try again
      </Button>
    </div>
  ) : (
    <div className="space-y-3">
      {!q.data.byo_allowed && (
        <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          {master
            ? "Own providers are locked for this customer. Unlock “Login messaging: own providers” in Add-ons above; until then Wyfy Guest sends every code."
            : "Every code is sent from Wyfy Guest's account. Want codes to come from your own WhatsApp or SMS account? Ask the Wyfy Guest team to turn it on."}
        </p>
      )}
      <div className={cn("grid gap-3", !compact && "lg:grid-cols-2")}>
        {LOGIN_CHANNELS.map((channel) => {
          const state = q.data.channels.find((c) => c.channel === channel);
          return state ? (
            <ChannelRow
              key={channel}
              target={target}
              state={state}
              adapters={q.data.adapters[channel] ?? []}
              canManage={canManage && (q.data.byo_allowed || master)}
            />
          ) : null;
        })}
      </div>
    </div>
  );

  return (
    <Card className="shadow-sm border-0" data-testid="login-messaging-card">
      <CardHeader className={compact ? "px-0 pb-2 pt-0" : undefined}>
        <CardTitle className="flex items-center gap-2.5 text-sm">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden />
          Login messaging
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          The account that sends guests their WhatsApp and SMS login codes.
        </p>
      </CardHeader>
      <CardContent className={compact ? "px-0" : undefined}>{body}</CardContent>
    </Card>
  );
}

function DefaultOnly() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {LOGIN_CHANNELS.map((c) => {
        const Icon = CHANNEL_ICON[c];
        return (
          <div key={c} className="flex items-center gap-2.5 rounded-lg border border-border p-3">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{CHANNEL_LABEL[c]}</p>
              <p className="text-xs text-muted-foreground">Using Wyfy Guest default</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ownName(own: LoginProviderView): string {
  return own.sender_label ? `${own.display_name} (${own.sender_label})` : own.display_name;
}

function ChannelRow({
  target,
  state,
  adapters,
  canManage,
}: {
  target: LoginMessagingTarget;
  state: LoginChannelState;
  adapters: AdapterSchema[];
  canManage: boolean;
}) {
  const { channel, own } = state;
  const master = target.kind === "platform";
  const save = useSaveLoginProvider(target);
  const remove = useRemoveLoginProvider(target);
  const [formOpen, setFormOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const Icon = CHANNEL_ICON[channel];
  const label = CHANNEL_LABEL[channel];
  const schema = own ? adapters.find((a) => a.key === own.provider_type) : undefined;

  const heading =
    state.effective_source === "own" && own
      ? `Using your own · ${ownName(own)}`
      : "Using Wyfy Guest default";

  const setEnabled = async (enabled: boolean) => {
    if (!own) return;
    try {
      await save.mutateAsync({ channel, body: { provider_type: null, config: {}, enabled } });
      toast.success(
        enabled
          ? `${label} login codes now go through ${ownName(own)}.`
          : `${label} login codes are back on Wyfy Guest's account.`,
      );
    } catch (err) {
      toast.error(loginMessagingError(err, "Couldn't change the provider."));
    }
  };

  const doRemove = async () => {
    try {
      await remove.mutateAsync(channel);
      toast.success(`Disconnected. ${label} login codes come from Wyfy Guest again.`);
    } catch (err) {
      toast.error(loginMessagingError(err, "Couldn't disconnect the provider."));
    } finally {
      setConfirmRemove(false);
    }
  };

  const shown =
    own && schema
      ? schema.fields
          .map((f) => ({ f, text: fieldValueText(f, own.display[f.name]) }))
          .filter((x) => x.text !== null)
      : [];

  return (
    <div
      className="space-y-2.5 rounded-lg border border-border p-3"
      data-testid={`login-channel-${channel}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{heading}</p>
            {master && !own && state.platform_default.provider && (
              <p className="text-[11px] text-muted-foreground">
                Platform sender: {state.platform_default.provider}
                {state.platform_default.configured ? "" : " (not configured)"}
              </p>
            )}
          </div>
        </div>
        {own && <StatusTag status={own.status} />}
      </div>

      {own?.configured_by_platform && (
        <p className="text-[11px] font-medium text-primary">
          Set up by Wyfy Guest team
          {master && own.updated_by?.name ? ` · ${own.updated_by.name}` : ""}
        </p>
      )}

      {own && own.fallback.count > 0 && own.fallback.last_at && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {own.fallback.count} login code{own.fallback.count === 1 ? "" : "s"} couldn't go through{" "}
            {ownName(own)} and {own.fallback.count === 1 ? "was" : "were"} sent by Wyfy Guest
            instead, so guests still got in. Last at {when(own.fallback.last_at)}
            {own.fallback.last_error ? `: ${own.fallback.last_error}` : ""}.
          </span>
        </p>
      )}

      {own?.last_error && own.status !== "verified" && (
        <p className="rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300">
          {own.last_error}
        </p>
      )}
      {own && !own.effective && (
        <p className="text-xs text-muted-foreground">
          {own.status !== "verified"
            ? `Not in use yet: verify it first. Until then Wyfy Guest sends ${label} codes.`
            : !own.enabled
              ? `Turned off: Wyfy Guest sends ${label} codes.`
              : `Not in use: Wyfy Guest sends ${label} codes.`}
        </p>
      )}

      {shown.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {shown.map(({ f, text }) => (
            <div key={f.name} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="break-all">{text}</dd>
            </div>
          ))}
          {own?.last_verified_at && (
            <div className="contents">
              <dt className="text-muted-foreground">Last verified</dt>
              <dd>{when(own.last_verified_at)}</dd>
            </div>
          )}
        </dl>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {own ? (
            <>
              <label
                className="flex items-center gap-2 text-sm"
                title={own.status !== "verified" ? "Verify the provider first." : undefined}
              >
                <Switch
                  checked={own.enabled}
                  disabled={save.isPending || (own.status !== "verified" && !own.enabled)}
                  onCheckedChange={(v) => void setEnabled(v)}
                  aria-label={`Send ${label} login codes through your own provider`}
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
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Disconnect and use Wyfy Guest
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              Connect {master ? "the customer's" : "your own"} {label} API
            </Button>
          )}
        </div>
      )}

      {canManage && (
        <>
          <LoginProviderForm
            target={target}
            channel={channel}
            adapters={adapters}
            own={own}
            open={formOpen}
            onOpenChange={(o) => {
              setFormOpen(o);
            }}
          />
          <VerifyLoginProviderDialog
            target={target}
            channel={channel}
            open={verifyOpen}
            onOpenChange={setVerifyOpen}
          />
          <LayerDialog
            open={confirmRemove}
            onOpenChange={(o) => !remove.isPending && setConfirmRemove(o)}
            title={`Disconnect the ${label} provider?`}
            description={`Guests get their ${label} login codes from Wyfy Guest again, starting now. The saved credentials are deleted.`}
            footer={
              <>
                <Button variant="outline" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => void doRemove()}
                >
                  Disconnect
                </Button>
              </>
            }
          >
            <span />
          </LayerDialog>
        </>
      )}
    </div>
  );
}
