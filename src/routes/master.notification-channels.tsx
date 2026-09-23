import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";

import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MStat,
  MTag,
  MButton,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  MField,
  M_INPUT,
} from "@/components/master/MasterKit";
import { relativeTime } from "@/lib/friendly";
import { monitoringService } from "@/services/monitoring.service";
import type { AppError } from "@/services/api";
import {
  NOTIFICATION_CHANNEL_TYPE_LABEL,
  NOTIFICATION_EVENT_CATEGORY_LABEL,
  type NotificationChannel,
  type NotificationChannelType,
  type NotificationEventCategory,
} from "@/types/monitoring";

export const Route = createFileRoute("/master/notification-channels")({
  component: NotificationChannelsScreen,
});

const PAGE_SIZE = 25;

/**
 * Cache keys. Namespaced under "master" like every other master screen, and
 * the page number is part of the key because it is part of the request. No
 * organization id appears here: on `/master/*` the scope travels as the
 * `X-Organization-Scope` header, and a header has no business in a cache key.
 */
const keys = {
  list: (page: number) => ["master", "notification-channels", "list", page] as const,
};

const CHANNEL_TYPES: NotificationChannelType[] = [
  "slack",
  "teams",
  "discord",
  "webhook",
  "email",
  "sms",
  "whatsapp",
];

const CATEGORIES: NotificationEventCategory[] = [
  "platform_ops",
  "customer_onboarding",
  "billing",
  "security",
];

function errorText(err: unknown, fallback: string): string {
  return (err as AppError | undefined)?.message || fallback;
}

/**
 * The per-row delivery badge.
 *
 * A `test` row is rendered as "Test OK", never as a plain success. The
 * distinction is the whole reason `notification_logs.kind` exists: a channel
 * whose only successful delivery was a test has proved that a URL accepts a
 * POST, not that it has ever carried a real alert, and a green tick that
 * blurs the two is how an operator comes to rely on a channel nothing has
 * used.
 */
function DeliveryTag({ channel }: { channel: NotificationChannel }) {
  const last = channel.lastDelivery;
  if (!last) return <MTag label="Never used" tone="normal" />;
  if (last.status === "failed") return <MTag label="Failed" tone="offline" />;
  return <MTag label={last.kind === "test" ? "Test OK" : "Delivered"} tone="active" />;
}

function NotificationChannelsScreen() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotificationChannel | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery({
    queryKey: keys.list(page),
    queryFn: () => monitoringService.listNotificationChannels({ page, pageSize: PAGE_SIZE }),
    staleTime: 15_000,
  });

  const rows = useMemo(() => list.data?.items ?? [], [list.data]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["master", "notification-channels"] });
  }

  const configuredCount = rows.filter((r) => r.configSummary?.configured).length;
  const failingCount = rows.filter((r) => r.lastDelivery?.status === "failed").length;
  const untestedCount = rows.filter((r) => !r.lastDelivery).length;

  return (
    <MasterShell title="Alert Channels">
      <MPageShell>
        <MSectionHeader
          eyebrow="Operations"
          title="Alert Channels"
          description="Where alerts and platform events are delivered. Slack, Teams, Discord and webhooks post over HTTP; email and SMS reuse the configured providers."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <MButton variant="outline" onClick={refresh} disabled={list.isFetching}>
                {list.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
              </MButton>
              <MButton variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus /> Add channel
              </MButton>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MStat
            label="Channels"
            value={list.isLoading ? "—" : rows.length}
            icon={Bell}
            loading={list.isLoading}
          />
          <MStat
            label="Configured"
            value={list.isLoading ? "—" : configuredCount}
            icon={CheckCircle2}
            tone={!list.isLoading && configuredCount < rows.length ? "warning" : "default"}
          />
          <MStat
            label="Last delivery failed"
            value={list.isLoading ? "—" : failingCount}
            icon={AlertTriangle}
            tone={failingCount > 0 ? "danger" : "default"}
          />
          <MStat
            label="Never used"
            value={list.isLoading ? "—" : untestedCount}
            icon={Send}
            tone={untestedCount > 0 ? "warning" : "default"}
          />
        </div>

        <MTable
          loading={list.isLoading}
          head={
            <>
              <MTh>Name</MTh>
              <MTh>Type</MTh>
              <MTh>Scope</MTh>
              <MTh>Destination</MTh>
              <MTh>Routes</MTh>
              <MTh>Last delivery</MTh>
              <MTh>State</MTh>
            </>
          }
        >
          {rows.map((c) => (
            <MTr key={c.id} onClick={() => setSelected(c)}>
              <MTd className="font-medium">{c.name}</MTd>
              <MTd>{NOTIFICATION_CHANNEL_TYPE_LABEL[c.channelType]}</MTd>
              <MTd className="text-xs text-muted-foreground">
                {c.organizationId ? "One customer" : "Platform-wide"}
              </MTd>
              <MTd className="text-xs">
                {c.configSummary?.configured ? (
                  <span className="font-mono text-muted-foreground">{c.configSummary.target}</span>
                ) : (
                  <MTag label="Not configured" tone="warning" />
                )}
              </MTd>
              <MTd className="text-xs text-muted-foreground">
                {c.eventCategories.length === 0
                  ? "Alert rules only"
                  : c.eventCategories.map((k) => NOTIFICATION_EVENT_CATEGORY_LABEL[k]).join(", ")}
              </MTd>
              <MTd className="text-xs">
                <div className="flex items-center gap-2">
                  <DeliveryTag channel={c} />
                  {c.lastDelivery && (
                    <span className="text-muted-foreground">
                      {relativeTime(c.lastDelivery.sentAt)}
                    </span>
                  )}
                </div>
              </MTd>
              <MTd>
                <MTag
                  label={c.isActive ? "Active" : "Paused"}
                  tone={c.isActive ? "active" : "normal"}
                />
              </MTd>
            </MTr>
          ))}
        </MTable>

        {!list.isLoading && rows.length === 0 && (
          <div className="rounded-lg border border-border/60 p-6 text-sm text-muted-foreground">
            No alert channels yet. Until one exists, alert rules evaluate and resolve with nowhere
            to deliver.
          </div>
        )}

        {list.data && list.data.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {list.data.page} of {list.data.totalPages}
            </span>
            <div className="flex gap-2">
              <MButton
                variant="outline"
                disabled={!list.data.hasPrevious}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </MButton>
              <MButton
                variant="outline"
                disabled={!list.data.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </MButton>
            </div>
          </div>
        )}

        <ChannelDrawer channel={selected} onClose={() => setSelected(null)} onChanged={refresh} />
        <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      </MPageShell>
    </MasterShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-right"}>{value}</span>
    </div>
  );
}

function ChannelDrawer({
  channel,
  onClose,
  onChanged,
}: {
  channel: NotificationChannel | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const test = useMutation({
    mutationFn: () =>
      monitoringService.testNotificationChannel(channel!.id, channel!.organizationId ?? undefined),
    // Deliberately NOT toast.success. A 202 means the send was accepted for
    // delivery, not that it arrived -- claiming success here would recreate
    // exactly the "it said it worked" failure this screen exists to end. The
    // real answer lands in the row's Last delivery column.
    onSuccess: (result) => {
      toast.info(result.detail);
      onChanged();
    },
    onError: (err) => toast.error(errorText(err, "The test could not be queued.")),
  });

  const setEnabled = useMutation({
    mutationFn: (next: boolean) =>
      monitoringService.updateNotificationChannel(
        channel!.id,
        { isActive: next },
        channel!.organizationId ?? undefined,
      ),
    onSuccess: (_data, next) => {
      if (next) toast.success("Channel enabled.");
      else toast.warning("Channel paused — alerts will no longer be delivered here.");
      onChanged();
      onClose();
    },
    onError: (err) => toast.error(errorText(err, "Could not change this channel.")),
  });

  const remove = useMutation({
    mutationFn: () =>
      monitoringService.deleteNotificationChannel(
        channel!.id,
        channel!.organizationId ?? undefined,
      ),
    onSuccess: () => {
      toast.warning("Channel deleted. Alert rules referencing it will skip it.");
      onChanged();
      onClose();
    },
    onError: (err) => toast.error(errorText(err, "Could not delete this channel.")),
  });

  const busy = test.isPending || setEnabled.isPending || remove.isPending;
  const summary = channel?.configSummary;

  return (
    <MDrawer
      open={!!channel}
      onClose={onClose}
      title={channel?.name ?? ""}
      subtitle={channel ? NOTIFICATION_CHANNEL_TYPE_LABEL[channel.channelType] : undefined}
      footer={
        channel && (
          <div className="flex flex-wrap items-center gap-2">
            <MButton variant="outline" disabled={busy} onClick={() => test.mutate()}>
              {test.isPending ? <Loader2 className="animate-spin" /> : <Send />} Send test
            </MButton>
            {channel.isActive ? (
              <MButton variant="outline" disabled={busy} onClick={() => setEnabled.mutate(false)}>
                <PowerOff /> Pause
              </MButton>
            ) : (
              <MButton variant="primary" disabled={busy} onClick={() => setEnabled.mutate(true)}>
                <Power /> Enable
              </MButton>
            )}
            <MButton
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete "${channel.name}"?\n\nAlert rules pointing at it will silently skip it from the moment this returns.`,
                  )
                )
                  return;
                remove.mutate();
              }}
            >
              <Trash2 /> Delete
            </MButton>
          </div>
        )
      }
    >
      {channel && (
        <div className="space-y-4">
          <div>
            <Row label="Scope" value={channel.organizationId ? "One customer" : "Platform-wide"} />
            <Row label="Destination" value={summary?.target ?? "unknown"} mono />
            {/*
              A fingerprint, never the credential. It answers the question an
              operator actually has -- "is this the same webhook as the one in
              the runbook?" -- without the API ever echoing a bearer-equivalent
              secret back. It is null for email/SMS, where the destination is
              too low-entropy to hash safely.
            */}
            {summary?.fingerprint && (
              <Row label="Credential fingerprint" value={summary.fingerprint} mono />
            )}
            {summary?.authHeaderName && (
              <Row label="Auth header" value={summary.authHeaderName} mono />
            )}
            <Row
              label="Routes"
              value={
                channel.eventCategories.length === 0
                  ? "Alert rules only"
                  : channel.eventCategories
                      .map((k) => NOTIFICATION_EVENT_CATEGORY_LABEL[k])
                      .join(", ")
              }
            />
          </div>

          {summary && !summary.configured && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              This channel has no credential stored. Nothing is delivered to it.
            </div>
          )}

          {summary && summary.requirements.length > 0 && (
            <div className="space-y-1 rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Before this channel can deliver</div>
              <ul className="list-disc space-y-1 pl-4">
                {summary.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Last delivery</div>
            {channel.lastDelivery ? (
              <div className="space-y-1 rounded-lg border border-border/60 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <DeliveryTag channel={channel} />
                  <span className="text-muted-foreground">
                    {relativeTime(channel.lastDelivery.sentAt)}
                  </span>
                </div>
                <div className="font-mono text-muted-foreground">
                  {channel.lastDelivery.errorMessage ?? channel.lastDelivery.responseSummary ?? "—"}
                </div>
                {channel.lastDelivery.kind === "test" && (
                  <div className="text-muted-foreground">
                    This was a test send. It proves the credential works; it does not mean a real
                    alert has ever been delivered here.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                Nothing has ever been delivered through this channel. Send a test before relying on
                it.
              </div>
            )}
          </div>
        </div>
      )}
    </MDrawer>
  );
}

const EMPTY_FORM = {
  name: "",
  channelType: "slack" as NotificationChannelType,
  platformWide: true,
  organizationId: "",
  webhookUrl: "",
  url: "",
  email: "",
  phoneNumber: "",
  authHeaderName: "",
  authHeaderValue: "",
  categories: [] as NotificationEventCategory[],
};

function CreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const patch = (p: Partial<typeof EMPTY_FORM>) => setForm((s) => ({ ...s, ...p }));

  function reset() {
    setForm(EMPTY_FORM);
  }

  const create = useMutation({
    mutationFn: () => {
      const type = form.channelType;
      const config: Record<string, unknown> =
        type === "email"
          ? { email: form.email }
          : type === "sms" || type === "whatsapp"
            ? { phone_number: form.phoneNumber }
            : type === "webhook"
              ? {
                  url: form.url,
                  ...(form.authHeaderName && form.authHeaderValue
                    ? {
                        auth_header_name: form.authHeaderName,
                        auth_header_value: form.authHeaderValue,
                      }
                    : {}),
                }
              : { webhook_url: form.webhookUrl };
      return monitoringService.createNotificationChannel({
        // `null` is an explicit "platform-wide", which the API distinguishes
        // from omitting the field. Never send `undefined` here.
        organizationId: form.platformWide ? null : form.organizationId,
        channelType: type,
        name: form.name,
        config,
        isActive: true,
        eventCategories: form.categories,
      });
    },
    onSuccess: () => {
      toast.success("Channel created. Send a test before relying on it.");
      reset();
      onClose();
      onCreated();
    },
    onError: (err) => toast.error(errorText(err, "Could not create this channel.")),
  });

  const isWebhookStyle = ["slack", "teams", "discord"].includes(form.channelType);

  return (
    <MDrawer
      open={open}
      onClose={() => {
        // The credential lives in this drawer's state and is cleared on the
        // way out -- it is a draft in flight, never state this page keeps.
        reset();
        onClose();
      }}
      title="Add alert channel"
      footer={
        <MButton
          variant="primary"
          disabled={create.isPending || !form.name.trim()}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Create
        </MButton>
      }
    >
      <div className="space-y-4">
        <MField label="Name">
          <input
            className={M_INPUT}
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </MField>

        <MField label="Type">
          <select
            className={M_INPUT}
            value={form.channelType}
            onChange={(e) => patch({ channelType: e.target.value as NotificationChannelType })}
          >
            {CHANNEL_TYPES.map((t) => (
              <option key={t} value={t}>
                {NOTIFICATION_CHANNEL_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </MField>

        {form.channelType === "whatsapp" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            WhatsApp does not deliver operational alerts today. The WhatsApp Business API rejects
            freeform business-initiated messages, and the only Meta-approved template on this
            account is the guest one-time-code template, which an alert cannot be sent through. This
            channel will log and not deliver until an alert-shaped template is approved.
          </div>
        )}

        <MField label="Ownership">
          <select
            className={M_INPUT}
            value={form.platformWide ? "platform" : "customer"}
            onChange={(e) => patch({ platformWide: e.target.value === "platform" })}
          >
            <option value="platform">Platform-wide (all platform alerts)</option>
            <option value="customer">One customer</option>
          </select>
        </MField>

        {!form.platformWide && (
          <MField label="Customer organization ID">
            <input
              className={M_INPUT}
              value={form.organizationId}
              onChange={(e) => patch({ organizationId: e.target.value })}
            />
          </MField>
        )}

        {isWebhookStyle && (
          <MField label="Incoming webhook URL">
            <input
              className={M_INPUT}
              type="password"
              autoComplete="off"
              placeholder="https://hooks.slack.com/services/…"
              value={form.webhookUrl}
              onChange={(e) => patch({ webhookUrl: e.target.value })}
            />
          </MField>
        )}

        {form.channelType === "webhook" && (
          <>
            <MField label="Webhook URL">
              <input
                className={M_INPUT}
                autoComplete="off"
                value={form.url}
                onChange={(e) => patch({ url: e.target.value })}
              />
            </MField>
            <MField label="Auth header name (optional)">
              <input
                className={M_INPUT}
                placeholder="X-Api-Key"
                value={form.authHeaderName}
                onChange={(e) => patch({ authHeaderName: e.target.value })}
              />
            </MField>
            <MField label="Auth header value (optional)">
              <input
                className={M_INPUT}
                type="password"
                autoComplete="off"
                value={form.authHeaderValue}
                onChange={(e) => patch({ authHeaderValue: e.target.value })}
              />
            </MField>
          </>
        )}

        {form.channelType === "email" && (
          <MField label="Email address">
            <input
              className={M_INPUT}
              type="email"
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
            />
          </MField>
        )}

        {(form.channelType === "sms" || form.channelType === "whatsapp") && (
          <MField label="Phone number">
            <input
              className={M_INPUT}
              placeholder="+919876543210"
              value={form.phoneNumber}
              onChange={(e) => patch({ phoneNumber: e.target.value })}
            />
          </MField>
        )}

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Also route these events here
          </div>
          <p className="text-xs text-muted-foreground">
            Leave all unticked for the normal case: this channel receives only the alert rules that
            name it.
          </p>
          {CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.categories.includes(cat)}
                onChange={(e) =>
                  patch({
                    categories: e.target.checked
                      ? [...form.categories, cat]
                      : form.categories.filter((c) => c !== cat),
                  })
                }
              />
              {NOTIFICATION_EVENT_CATEGORY_LABEL[cat]}
            </label>
          ))}
        </div>
      </div>
    </MDrawer>
  );
}
