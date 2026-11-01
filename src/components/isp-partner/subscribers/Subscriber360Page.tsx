/**
 * Subscriber 360 (ADDENDUM_05 J1): one screen for a support call.
 * - Header: state, dues, and the actions (renew / revert / grace / block /
 *   freeze / move / note).
 * - Live status bar with Disconnect: "online" means a live session in our
 *   records, so if they are online the problem is inside their premises.
 * - Auth matrix, profile, billing ledger, timeline.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, MapPin, RefreshCw, Unplug } from "lucide-react";
import { MButton, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  SubscriberActionDialog,
  type ActionKind,
} from "@/components/isp-partner/subscribers/SubscriberActions";
import {
  useSub360Mutation,
  useSubscriber360,
  useSubscriberLedger,
} from "@/hooks/isp-partner/useSubscriber360";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatBytes, formatDate, formatDateTime, formatDuration } from "@/lib/isp-partner/format";
import { formatRupees, INVOICE_STATUS_LABEL } from "@/lib/isp-partner/money";
import { relativeValidity } from "@/lib/isp-partner/plans";
import {
  allowedActions,
  eventLabel,
  stateLabel,
  stateTone,
} from "@/lib/isp-partner/subscribers360";
import { subscribers360Service } from "@/services/isp-partner/subscribers360";
import type { Subscriber360 } from "@/services/isp-partner/subscribers360-types";
import { SubscriberNetworkPanel } from "@/components/isp-partner/network/SubscriberNetworkPanel";
import { InvoiceRowActions } from "@/components/isp-partner/subscribers/InvoiceRowActions";
import { SubscriberKycPanel } from "@/components/isp-partner/compliance/SubscriberKycPanel";
import { SubscriberPppoePanel } from "@/components/isp-partner/pppoe/SubscriberPppoePanel";
import { SubscriberFiberCard } from "@/components/isp-partner/fiber/SubscriberFiberCard";
// SUB360-2 workbench: each piece renders nothing / its fallback while the flag is off.
import {
  AuthSlot,
  ContactCard,
  LiveBarSlot,
  WorkbenchAccordions,
  WorkbenchBreadcrumb,
  WorkbenchHeaderActions,
} from "@/components/isp-partner/subscribers/workbench/Workbench";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{v ?? "–"}</dd>
    </>
  );
}

function Check({ on, label }: { on: boolean | null; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
        on ? "border-emerald-300 text-emerald-700" : "border-border text-muted-foreground"
      }`}
      title={on === null ? "Not tracked yet" : undefined}
    >
      {on ? "✓" : on === null ? "–" : "✕"} {label}
    </span>
  );
}

function LiveBar({ s, canAct }: { s: Subscriber360; canAct: boolean }) {
  const q = useSubscriber360(s.id);
  const dc = useSub360Mutation(() => subscribers360Service.disconnect(s.id));
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
        s.online
          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10"
          : "border-border bg-muted/40"
      }`}
    >
      <span
        className={`size-2 rounded-full ${s.online ? "bg-emerald-500" : "bg-muted-foreground"}`}
      />
      {s.online ? (
        <span>
          Online · {s.live_sessions.length} session{s.live_sessions.length > 1 ? "s" : ""}. Their
          connection reaches us; check Wi-Fi or the device at their end.
        </span>
      ) : (
        <span className="text-muted-foreground">
          Not online. Check power to the ONT/router and the line to the premises.
        </span>
      )}
      <div className="ml-auto flex gap-2">
        <MButton variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={q.isFetching ? "animate-spin" : undefined} /> Refresh
        </MButton>
        {canAct && s.online && (
          <MButton
            variant="outline"
            disabled={dc.isPending}
            onClick={async () => {
              try {
                const r = await dc.mutateAsync(undefined);
                toast.success(
                  r.unconfirmed
                    ? `${r.sessions_ended} ended; ${r.unconfirmed} not confirmed by the router.`
                    : `${r.sessions_ended} session(s) ended.`,
                );
              } catch (err) {
                toast.error(ispErrorMessage(err));
              }
            }}
          >
            {dc.isPending ? <Spinner /> : <Unplug />} Disconnect
          </MButton>
        )}
      </div>
    </div>
  );
}

function Ledger({ id, phone, name }: { id: string; phone?: string | null; name?: string | null }) {
  const q = useSubscriberLedger(id);
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the ledger" />;
  const l = q.data;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-4 text-xs">
        <span>Billed {formatRupees(l.billed_paise)}</span>
        <span>Paid {formatRupees(l.paid_paise)}</span>
        <span className={l.due_paise ? "font-semibold text-rose-600" : ""}>
          Due {formatRupees(l.due_paise)}
        </span>
        {l.overdue_paise > 0 && (
          <span className="text-rose-600">Overdue {formatRupees(l.overdue_paise)}</span>
        )}
      </div>
      {l.invoices.length === 0 ? (
        <p className="text-xs text-muted-foreground">No invoices yet.</p>
      ) : (
        <MTable
          head={
            <>
              <MTh>Number</MTh>
              <MTh>Date</MTh>
              <MTh className="text-right">Total</MTh>
              <MTh className="text-right">Balance</MTh>
              <MTh>Status</MTh>
              <MTh className="text-right">Actions</MTh>
            </>
          }
        >
          {l.invoices.map((i) => (
            <MTr key={i.id}>
              <MTd className="font-mono text-xs">
                <Link
                  to="/partner/invoices/$invoiceId"
                  params={{ invoiceId: i.id }}
                  className="hover:underline"
                >
                  {i.number}
                </Link>
              </MTd>
              <MTd className="text-xs">{formatDate(i.invoice_date)}</MTd>
              <MTd className="text-right text-xs tabular-nums">{formatRupees(i.total_paise)}</MTd>
              <MTd className="text-right text-xs tabular-nums">{formatRupees(i.balance_paise)}</MTd>
              <MTd>
                <MTag label={INVOICE_STATUS_LABEL[i.status] ?? i.status} />
              </MTd>
              <MTd>
                <InvoiceRowActions invoice={i} phone={phone} name={name} />
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
    </div>
  );
}

export function Subscriber360Page({ subscriberId }: { subscriberId: string }) {
  const { can } = usePartner();
  const q = useSubscriber360(subscriberId);
  const [action, setAction] = useState<ActionKind | null>(null);
  const unblock = useSub360Mutation(() => subscribers360Service.unblock(subscriberId));
  const unfreeze = useSub360Mutation(() => subscribers360Service.unfreeze(subscriberId));
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this subscriber" />;
  const s = q.data;
  const p = s.profile;
  const update = can("isp_subscribers.update");
  const manage = can("isp_subscribers.manage");
  const allow = allowedActions(s.display_state, s.can_revert);
  const name =
    [s.first_name, s.last_name].filter(Boolean).join(" ") || s.display_name || s.identifier;
  const quick = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(ispErrorMessage(err));
    }
  };
  const btn = (k: ActionKind, label: string, show: boolean) =>
    show && (
      <MButton key={k} variant="outline" onClick={() => setAction(k)}>
        {label}
      </MButton>
    );

  return (
    <div className="space-y-4">
      <Link
        to="/partner/subscribers"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3" /> Subscribers
      </Link>
      <WorkbenchBreadcrumb s={s} />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{name}</h2>
            <MTag label={stateLabel(s.display_state)} tone={stateTone(s.display_state)} />
            {s.billing.due_paise > 0 ? (
              <MTag label={`Due ${formatRupees(s.billing.due_paise)}`} tone="overdue" />
            ) : (
              <MTag label="Paid up" tone="paid" />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Circuit #{s.circuit_id} · <span className="font-mono">{s.identifier}</span> ·{" "}
            {s.customer_name} · {s.package?.name ?? "No package"} · valid until{" "}
            {formatDateTime(s.valid_until)} ({relativeValidity(s.valid_until)})
          </p>
          {s.hold.block_kind && (
            <p className="mt-1 text-xs text-rose-600">
              {s.hold.block_kind === "permanent" ? "Permanently blocked" : "Blocked"}
              {s.hold.blocked_reason ? `: ${s.hold.blocked_reason}` : ""} (
              {formatDateTime(s.hold.blocked_at)})
            </p>
          )}
          {s.hold.frozen_at && (
            <p className="mt-1 text-xs text-amber-700">
              Frozen since {formatDateTime(s.hold.frozen_at)} with{" "}
              {formatDuration(s.hold.frozen_remaining_seconds)} of validity kept.
            </p>
          )}
          {s.display_state === "grace" && (
            <p className="mt-1 text-xs text-amber-700">
              Grace until {formatDateTime(s.hold.grace_until)} (no payment recorded).
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {can("isp_invoices.create") && allow.renew && (
            <MButton onClick={() => setAction("renew")}>Renew</MButton>
          )}
          {can("isp_invoices.manage") && btn("revert", "Revert", allow.revert)}
          {update && btn("grace", "Grace", allow.grace)}
          {update && btn("freeze", "Freeze", allow.freeze)}
          {update && allow.unfreeze && (
            <MButton
              variant="outline"
              disabled={unfreeze.isPending}
              onClick={() => quick(() => unfreeze.mutateAsync(undefined), "Unfrozen.")}
            >
              Unfreeze
            </MButton>
          )}
          {update && btn("block", "Block", allow.block && !allow.unblock)}
          {update && allow.unblock && (s.hold.block_kind !== "permanent" || manage) && (
            <MButton
              variant="outline"
              disabled={unblock.isPending}
              onClick={() => quick(() => unblock.mutateAsync(undefined), "Unblocked.")}
            >
              Unblock
            </MButton>
          )}
          {manage && btn("move", "Move", allow.move)}
          {update && btn("note", "Log complaint", true)}
          <WorkbenchHeaderActions s={s} onEdit={() => setAction("profile")} />
        </div>
      </div>

      <LiveBarSlot
        s={s}
        fallback={
          <>
            <LiveBar s={s} canAct={can("isp_subscribers.disconnect")} />

            {s.live_sessions.length > 0 && (
              <MTable
                head={
                  <>
                    <MTh>Since</MTh>
                    <MTh>Uptime</MTh>
                    <MTh>IP</MTh>
                    <MTh>MAC</MTh>
                    <MTh>Router / venue</MTh>
                    <MTh className="text-right">Down / up</MTh>
                  </>
                }
              >
                {s.live_sessions.map((x) => (
                  <MTr key={x.id}>
                    <MTd className="text-xs">{formatDateTime(x.started_at)}</MTd>
                    <MTd className="text-xs">{formatDuration(x.uptime_seconds)}</MTd>
                    <MTd className="font-mono text-xs">{x.ip_address ?? "–"}</MTd>
                    <MTd className="font-mono text-xs">{x.mac_address ?? "–"}</MTd>
                    <MTd className="text-xs">
                      {x.router_name ?? "–"}
                      <p className="text-muted-foreground">{x.location_name}</p>
                    </MTd>
                    <MTd className="text-right text-xs tabular-nums">
                      {formatBytes(x.bytes_downloaded)} / {formatBytes(x.bytes_uploaded)}
                    </MTd>
                  </MTr>
                ))}
              </MTable>
            )}
          </>
        }
      />

      <AuthSlot
        s={s}
        fallback={
          <div className="flex flex-wrap gap-1.5">
            <Check on={s.auth.hotspot} label="Hotspot" />
            <Check on={s.auth.pppoe} label="PPPoE" />
            <Check on={s.auth.mac_bound} label="MAC bound" />
            <Check on={s.auth.static_ip ? true : null} label={s.auth.static_ip ?? "Static IP"} />
          </div>
        }
      />
      <ContactCard s={s} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Profile"
          actions={
            update ? (
              <MButton variant="outline" onClick={() => setAction("profile")}>
                Edit
              </MButton>
            ) : undefined
          }
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <Row k="Mobile" v={s.phone} />
            <Row k="Email" v={s.email} />
            <Row k="Alternate email" v={p.alt_email} />
            <Row
              k="Billing address"
              v={[s.address, p.billing_city, p.billing_pincode].filter(Boolean).join(", ") || null}
            />
            <Row
              k="Installed at"
              v={
                p.install_same_as_billing
                  ? "Billing address"
                  : [
                      p.install_building,
                      p.install_address,
                      p.install_area,
                      p.install_city,
                      p.install_pincode,
                    ]
                      .filter(Boolean)
                      .join(", ") || null
              }
            />
            <Row
              k="Location"
              v={
                p.maps_url ? (
                  <a
                    href={p.maps_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <MapPin className="size-3" /> {p.latitude}, {p.longitude}
                  </a>
                ) : null
              }
            />
            <Row k="Type" v={p.user_type} />
            <Row k="Connection" v={p.connection_type} />
            <Row k="ONT / CPE" v={p.ont_serial} />
            <Row k="Set-top box" v={p.stb_serial} />
            <Row k="Installed on" v={p.installed_at ? formatDate(p.installed_at) : null} />
            <Row
              k="Price"
              v={
                p.override_price_paise
                  ? `${formatRupees(p.override_price_paise)} (override)`
                  : "Package price"
              }
            />
            <Row
              k="After due date"
              v={
                {
                  suspend: "Suspend",
                  keep_active: "Keep active",
                  disconnect_once: "Disconnect once",
                }[p.after_due_action ?? "suspend"]
              }
            />
            <Row k="Reminders" v={p.exclude_reminders ? "Off" : "On"} />
            <Row k="Zone" v={s.zone?.name} />
            <Row k="GSTIN" v={s.gstin} />
            <Row k="Comments" v={p.comments} />
          </dl>
        </Card>
        <Card title="Billing">
          <Ledger
            id={s.id}
            phone={s.phone}
            name={[s.first_name, s.last_name].filter(Boolean).join(" ") || null}
          />
        </Card>
      </div>

      <WorkbenchAccordions s={s} />

      {/* Other lanes' panels (JAZE-2 network, JAZE-3 KYC, JAZE-6 PPPoE/fiber). */}
      <SubscriberNetworkPanel subscriber={s} />
      {can("isp_subscribers.kyc") && <SubscriberKycPanel subscriberId={s.id} />}
      <SubscriberPppoePanel subscriberId={s.id} />
      <SubscriberFiberCard subscriberId={s.id} />

      <Card title="Timeline">
        {s.timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing yet.</p>
        ) : (
          <ol className="space-y-2 text-xs">
            {s.timeline.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-36 shrink-0 text-muted-foreground">{formatDateTime(e.at)}</span>
                <span>
                  <span className="font-medium">{eventLabel(e.kind)}</span>
                  {e.summary && ` · ${e.summary}`}
                  {e.actor_name && <span className="text-muted-foreground"> · {e.actor_name}</span>}
                  {typeof e.detail?.body === "string" && (
                    <span className="block text-muted-foreground">{e.detail.body}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <SubscriberActionDialog
        kind={action}
        s={s}
        onClose={() => setAction(null)}
        canPay={can("isp_billing.execute")}
        canManage={manage}
      />
    </div>
  );
}
