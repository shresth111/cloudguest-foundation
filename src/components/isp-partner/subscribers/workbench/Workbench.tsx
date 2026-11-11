/**
 * SUB360-2: the Subscriber 360 support workbench pieces. Each one renders
 * nothing (or its `fallback`, i.e. today's 360 markup) while
 * `ISP_SUB360_WORKBENCH_ENABLED` is off and `/workbench` answers 404, so the
 * page is unchanged until the flag is switched on.
 *
 * Reuses the lanes' code as is: JAZE-1 actions/ledger, JAZE-2 FUP panel,
 * JAZE-5 helpdesk (tickets), JAZE-6 PPPoE, ZONE-1 zone path.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Gauge,
  LifeBuoy,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Unplug,
  Wallet,
} from "lucide-react";
import {
  MButton,
  MDialog,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { Card, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { FupBlock } from "@/components/isp-partner/network/SubscriberNetworkPanel";
import { useIspUsers } from "@/hooks/isp-partner/useIsp";
import { useSub360Mutation, useSubscriberLedger } from "@/hooks/isp-partner/useSubscriber360";
import { useTicketTypes, useWorkbench } from "@/hooks/isp-partner/useWorkbench";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { formatBytes, formatDate, formatDateTime, formatDuration } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import {
  EMPTY_TICKET,
  RFO_OPTIONS,
  SOURCE_OPTIONS,
  buildTicketBody,
  liteBlocks,
  rfoRequired,
  validityLeft,
  type TicketForm,
} from "@/lib/isp-partner/workbench";
import { copyToClipboard, cn } from "@/lib/utils";
import { helpdeskService, workbenchService } from "@/services/isp-partner/workbench";
import type { Subscriber360 } from "@/services/isp-partner/subscribers360-types";
import type { WorkbenchLive } from "@/services/isp-partner/workbench-types";

type S = { s: Subscriber360 };

/** Markdown-lite text as React nodes (never innerHTML). */
export function LiteText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const blocks = liteBlocks(text);
  const parts = (ps: ReturnType<typeof liteBlocks>[number]["parts"]) =>
    ps.map((p, i) =>
      p.t === "bold" ? (
        <strong key={i}>{p.v}</strong>
      ) : p.t === "code" ? (
        <code key={i} className="rounded bg-muted px-1 font-mono text-[0.9em]">
          {p.v}
        </code>
      ) : (
        <span key={i}>{p.v}</span>
      ),
    );
  return (
    <div className="space-y-1">
      {blocks.map((b, i) =>
        b.t === "li" ? (
          <p key={i} className="flex gap-1.5">
            <span aria-hidden>•</span>
            <span>{parts(b.parts)}</span>
          </p>
        ) : (
          <p key={i}>{parts(b.parts)}</p>
        ),
      )}
    </div>
  );
}

// --------------------------------------------------------------- breadcrumb

export function WorkbenchBreadcrumb({ s }: S) {
  const wb = useWorkbench(s.id);
  if (!wb.data) return null;
  const b = wb.data.breadcrumb;
  return (
    <nav aria-label="Zone and package" className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-muted-foreground">Zone:</span>
      {b.zone_path.length === 0 ? (
        <span className="text-muted-foreground">none</span>
      ) : (
        b.zone_path.map((z, i) => (
          <span key={z.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
            <span>{z.name}</span>
          </span>
        ))
      )}
      <ChevronRight className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">Package:</span>
      <span>{b.package?.name ?? "none"}</span>
    </nav>
  );
}

// ------------------------------------------------------------ header actions

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

function Menu({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useOutside(open, close);
  return (
    <div className="relative" ref={ref}>
      <MButton
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {icon} {label} <ChevronDown className="size-3" />
      </MButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-border bg-popover p-1 text-sm shadow-lg"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

const ITEM = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent";

export function WorkbenchHeaderActions({ s, onEdit }: S & { onEdit?: () => void }) {
  const { can } = usePartner();
  const wb = useWorkbench(s.id);
  const [ticket, setTicket] = useState(false);
  const [fup, setFup] = useState(false);
  if (!wb.data) return null;
  const w = wb.data;
  const canTicket = w.open_tickets !== null && can("isp_apps.create");
  const copy = async (v: string, what: string) =>
    (await copyToClipboard(v)) ? toast.success(`${what} copied.`) : toast.error("Copy failed.");

  return (
    <>
      <span
        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs"
        title="Validity left"
      >
        {validityLeft(w.validity.seconds_left)}
      </span>
      {w.open_tickets !== null && (
        <a
          href="#wb-tickets"
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs",
            w.open_tickets > 0
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          <LifeBuoy className="size-3" /> {w.open_tickets} open ticket
          {w.open_tickets === 1 ? "" : "s"}
        </a>
      )}
      {canTicket && (
        <MButton variant="outline" onClick={() => setTicket(true)}>
          <LifeBuoy /> Raise ticket
        </MButton>
      )}
      {onEdit && can("isp_subscribers.update") && (
        <MButton variant="outline" onClick={onEdit}>
          <Pencil /> Edit
        </MButton>
      )}
      <Menu label="Billing" icon={<Wallet />}>
        {(close) => (
          <>
            <a href="#wb-billing" className={ITEM} onClick={close}>
              Orders and renewals
            </a>
            <Link
              to="/partner/invoices"
              search={{ bill: "subscriber", q: s.identifier }}
              className={ITEM}
              onClick={close}
            >
              Invoices
            </Link>
            <Link
              to="/partner/billing"
              search={{ tab: "payments" }}
              className={ITEM}
              onClick={close}
            >
              Payments
            </Link>
          </>
        )}
      </Menu>
      <MButton variant="outline" onClick={() => setFup(true)}>
        <Gauge /> FUP
      </MButton>
      <Menu label="More" icon={<MoreHorizontal />}>
        {(close) => (
          <>
            <button
              type="button"
              className={ITEM}
              onClick={() => {
                close();
                copy(String(s.circuit_id), "Circuit id");
              }}
            >
              <Copy className="size-4" /> Copy circuit id
            </button>
            <button
              type="button"
              className={ITEM}
              onClick={() => {
                close();
                copy(s.identifier, "Username");
              }}
            >
              <Copy className="size-4" /> Copy username
            </button>
            <Link
              to="/partner/customers/$ispCustomerId"
              params={{ ispCustomerId: s.isp_customer_id }}
              className={ITEM}
              onClick={close}
            >
              Open customer
            </Link>
            {w.services
              .filter((x) => x.kind === "tr069")
              .map((x) =>
                x.kind === "tr069" ? (
                  <Link
                    key={x.cpe_id}
                    to="/partner/tr069/$cpeId"
                    params={{ cpeId: x.cpe_id }}
                    className={ITEM}
                    onClick={close}
                  >
                    Open TR-069 device
                  </Link>
                ) : null,
              )}
          </>
        )}
      </Menu>
      {ticket && <RaiseTicketDialog s={s} onClose={() => setTicket(false)} />}
      <MDialog open={fup} onClose={() => setFup(false)} title="Fair usage (FUP)">
        <FupBlock subscriberId={s.id} canEdit={can("isp_subscribers.update")} />
      </MDialog>
    </>
  );
}

// ------------------------------------------------------------- live session

export function LiveBarSlot({ s, fallback }: S & { fallback: ReactNode }) {
  const { can } = usePartner();
  const wb = useWorkbench(s.id);
  const [busy, setBusy] = useState<string | null>(null);
  const kick = useSub360Mutation((v: { session_id?: string }) =>
    workbenchService.disconnect(s.id, v),
  );
  if (!wb.data) return <>{fallback}</>;
  const live = wb.data.live;
  const online = live.length > 0;
  const canAct = can("isp_subscribers.disconnect"); // RBAC-FIX R1: session control
  const end = async (x?: WorkbenchLive) => {
    setBusy(x?.session_id ?? "all");
    try {
      const r = await kick.mutateAsync(x ? { session_id: x.session_id } : {});
      toast.success(
        r.unconfirmed.length
          ? `${r.ended.length} ended; ${r.unconfirmed.length} not confirmed by the router.`
          : `${r.ended.length} session(s) ended.`,
      );
      wb.refetch();
    } catch (err) {
      ispToastError(err);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm",
          online
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10"
            : "border-border bg-muted/40",
        )}
      >
        <span
          className={cn("size-2 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground")}
        />
        <span className={online ? undefined : "text-muted-foreground"}>
          {online
            ? `Online · ${live.length} session${live.length > 1 ? "s" : ""}`
            : "Offline · no live hotspot or PPPoE session"}
          {!wb.data.pppoe_enabled && " (PPPoE not switched on)"}
        </span>
        <div className="ml-auto flex gap-2">
          <MButton variant="outline" onClick={() => wb.refetch()} disabled={wb.isFetching}>
            <RefreshCw className={wb.isFetching ? "animate-spin" : undefined} /> Refresh
          </MButton>
          {canAct && online && (
            <MButton variant="outline" disabled={!!busy} onClick={() => end()}>
              {busy === "all" ? <Spinner /> : <Unplug />} Disconnect all
            </MButton>
          )}
        </div>
      </div>
      {online && (
        <MTable
          head={
            <>
              <MTh>Type</MTh>
              <MTh>NAS / router</MTh>
              <MTh>Interface</MTh>
              <MTh>IP</MTh>
              <MTh>MAC</MTh>
              <MTh>Online for</MTh>
              <MTh className="text-right">Down / up</MTh>
              {canAct && <MTh className="text-right">Action</MTh>}
            </>
          }
        >
          {live.map((x) => (
            <MTr key={`${x.kind}-${x.session_id}`}>
              <MTd>
                <MTag label={x.kind === "pppoe" ? "PPPoE" : "Hotspot"} />
              </MTd>
              <MTd className="text-xs">
                {x.nas ?? x.router_name ?? "–"}
                {x.nas && x.router_name && x.nas !== x.router_name && (
                  <span className="block text-muted-foreground">{x.router_name}</span>
                )}
              </MTd>
              <MTd className="font-mono text-xs">{x.interface ?? "–"}</MTd>
              <MTd className="font-mono text-xs">{x.ip ?? "–"}</MTd>
              <MTd className="font-mono text-xs">{x.mac ?? "–"}</MTd>
              <MTd className="text-xs">
                <span title={formatDateTime(x.started_at)}>{formatDuration(x.uptime_seconds)}</span>
              </MTd>
              <MTd className="text-right text-xs tabular-nums">
                {formatBytes(x.bytes_down)} / {formatBytes(x.bytes_up)}
              </MTd>
              {canAct && (
                <MTd className="text-right">
                  <MButton variant="ghost" disabled={!!busy} onClick={() => end(x)}>
                    {busy === x.session_id ? <Spinner /> : <Unplug />} Disconnect
                  </MButton>
                </MTd>
              )}
            </MTr>
          ))}
        </MTable>
      )}
    </div>
  );
}

// ------------------------------------------------- auth matrix + services

function Chip({ on, label, title }: { on: boolean | null; label: string; title?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        on
          ? "border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
          : "border-border text-muted-foreground",
      )}
      title={title}
    >
      {on ? "✓" : on === null ? "–" : "✕"} {label}
    </span>
  );
}

export function AuthSlot({ s, fallback }: S & { fallback: ReactNode }) {
  const wb = useWorkbench(s.id);
  if (!wb.data) return <>{fallback}</>;
  const a = wb.data.auth;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Sign-in:</span>
      <Chip on={!!a.static_ip} label={a.static_ip ? `IP ${a.static_ip}` : "IP"} />
      <Chip on={a.mac_bound} label="MAC" />
      <Chip on={a.pppoe} label="PPPoE" />
      <Chip on={a.hotspot} label="Hotspot" />
      <span className="ml-3 text-xs text-muted-foreground">Services:</span>
      {wb.data.services.map((x) =>
        x.kind === "isp" ? (
          <Chip key="isp" on label={`Internet${x.speed ? ` · ${x.speed}` : ""}`} />
        ) : (
          <Link
            key={x.cpe_id}
            to="/partner/tr069/$cpeId"
            params={{ cpeId: x.cpe_id }}
            title={`Last check-in ${formatDateTime(x.last_inform_at)}`}
          >
            <Chip on={x.online} label={`TR-069 · ${x.model ?? x.serial ?? "CPE"}`} />
          </Link>
        ),
      )}
      {!wb.data.services.some((x) => x.kind === "tr069") && (
        <Chip on={null} label="TR-069" title="No CPE matches this subscriber's ONT serial" />
      )}
    </div>
  );
}

// ------------------------------------------------------------ inline contact

function InlineField({
  label,
  value,
  onSave,
  type = "text",
  disabled,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (v: string | null) => Promise<void>;
  type?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">
        {editing ? (
          <form
            className="flex gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await onSave(v.trim() || null);
                setEditing(false);
              } catch (err) {
                const f = ispFieldErrors(err);
                setError(Object.values(f)[0] ?? ispErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              autoFocus
              type={type}
              className={`${M_INPUT} py-1`}
              value={v}
              aria-label={label}
              onChange={(e) => setV(e.target.value)}
            />
            <MButton type="submit" disabled={busy}>
              {busy && <Spinner />} Save
            </MButton>
            <MButton variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </MButton>
          </form>
        ) : (
          <span className="inline-flex items-center gap-1">
            {value ?? "–"}
            {!disabled && (
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-accent"
                aria-label={`Edit ${label}`}
                onClick={() => {
                  setV(value ?? "");
                  setEditing(true);
                }}
              >
                <Pencil className="size-3" />
              </button>
            )}
          </span>
        )}
        {error && <span className="block text-[11px] text-destructive">{error}</span>}
      </dd>
    </>
  );
}

export function ContactCard({ s }: S) {
  const { can } = usePartner();
  const wb = useWorkbench(s.id);
  const patch = useSub360Mutation((b: Parameters<typeof workbenchService.patchContact>[1]) =>
    workbenchService.patchContact(s.id, b),
  );
  // DEFAULT-LOGS / partner ask: first and last name shown and edited apart.
  // The combined name is written to `display_name` too, so readers of the
  // single name keep showing it.
  const full = (first?: string | null, last?: string | null) =>
    [first, last].filter(Boolean).join(" ") || null;
  const alt = useSub360Mutation((v: string | null) => workbenchService.putAltEmail(s.id, v));
  if (!wb.data) return null;
  const ro = !can("isp_subscribers.update");
  return (
    <Card title="Contact and service">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <InlineField
          label="First name"
          value={s.first_name}
          disabled={ro}
          onSave={async (v) => {
            await patch.mutateAsync({ first_name: v, display_name: full(v, s.last_name) });
          }}
        />
        <InlineField
          label="Last name"
          value={s.last_name}
          disabled={ro}
          onSave={async (v) => {
            await patch.mutateAsync({ last_name: v, display_name: full(s.first_name, v) });
          }}
        />
        <InlineField
          label="Mobile"
          value={s.phone}
          type="tel"
          disabled={ro}
          onSave={async (v) => {
            await patch.mutateAsync({ phone: v });
          }}
        />
        <InlineField
          label="Email"
          value={s.email}
          type="email"
          disabled={ro}
          onSave={async (v) => {
            await patch.mutateAsync({ email: v });
          }}
        />
        <InlineField
          label="Alternate email"
          value={s.profile.alt_email}
          type="email"
          disabled={ro}
          onSave={async (v) => {
            await alt.mutateAsync(v);
          }}
        />
        <dt className="text-muted-foreground">Circuit id</dt>
        <dd className="font-mono">{s.circuit_id}</dd>
        <dt className="text-muted-foreground">Plan</dt>
        <dd>{s.package?.name ?? "–"}</dd>
        <dt className="text-muted-foreground">Connection</dt>
        <dd>
          {[s.profile.connection_type, wb.data.auth.pppoe ? "PPPoE" : "Hotspot"]
            .filter(Boolean)
            .join(" · ")}
        </dd>
        <dt className="text-muted-foreground">Installed on</dt>
        <dd>{s.profile.installed_at ? formatDate(s.profile.installed_at) : "–"}</dd>
      </dl>
    </Card>
  );
}

// ------------------------------------------------------------ raise ticket

export function RaiseTicketDialog({
  s,
  onClose,
  onCreated,
}: S & {
  onClose: () => void;
  /** SMALL-3: told the new ticket's id */ onCreated?: (id: string) => void;
}) {
  const { can } = usePartner();
  const types = useTicketTypes(true);
  const staff = useIspUsers({ page_size: 100, status: "active" });
  const canPickStaff = can("isp_partner.assign") && !staff.error;
  const [f, setF] = useState<TicketForm>(EMPTY_TICKET);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof TicketForm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const create = useSub360Mutation(async () => {
    const res = buildTicketBody(f, types.data ?? [], {
      isp_customer_id: s.isp_customer_id,
      subscriber_id: s.id,
    });
    if (!res.ok) throw Object.assign(new Error("invalid"), { formErrors: res.errors });
    const t = await helpdeskService.create(res.body);
    const c = comment.trim();
    if (c) {
      const { sanitizeTicketText } = await import("@/lib/isp-partner/workbench");
      const clean = sanitizeTicketText(c);
      if (clean) await helpdeskService.comment(t.id, clean);
    }
    return t;
  });
  const set = <K extends keyof TicketForm>(k: K, v: TicketForm[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const needRfo = rfoRequired(f, types.data ?? []);
  const activeTypes = (types.data ?? []).filter((t) => t.active);

  return (
    <MDialog
      open
      wide
      onClose={onClose}
      title="Raise a ticket"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={create.isPending}
            onClick={async () => {
              setError(null);
              setErrors({});
              try {
                const t = await create.mutateAsync(undefined);
                toast.success(`Ticket ${t.number} raised.`);
                onCreated?.(t.id);
                onClose();
              } catch (err) {
                const fe = (err as { formErrors?: typeof errors }).formErrors;
                if (fe) return setErrors(fe);
                setErrors(ispFieldErrors(err) as typeof errors);
                setError(ispErrorMessage(err, "Could not raise the ticket."));
              }
            }}
          >
            {create.isPending && <Spinner />} Raise ticket
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <select
              className={M_INPUT}
              value={f.type_id}
              onChange={(e) => set("type_id", e.target.value)}
            >
              <option value="">No type</option>
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.sla_minutes ? ` (SLA ${formatDuration(t.sla_minutes * 60)})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Came in by</span>
            <select
              className={M_INPUT}
              value={f.source}
              onChange={(e) => set("source", e.target.value as TicketForm["source"])}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Assign to</span>
            <select
              className={M_INPUT}
              value={f.assignee_user_id}
              disabled={!canPickStaff}
              onChange={(e) => set("assignee_user_id", e.target.value)}
            >
              <option value="">Auto (helpdesk queue)</option>
              {canPickStaff &&
                (staff.data?.items ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                  </option>
                ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Priority</span>
            <select
              className={M_INPUT}
              value={f.priority}
              onChange={(e) => set("priority", e.target.value as TicketForm["priority"])}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <TextField
          label="Subject"
          value={f.subject}
          onChange={(v) => set("subject", v)}
          error={errors.subject}
          required
        />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">What happened</span>
          <textarea
            className={`${M_INPUT} min-h-[80px]`}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What the subscriber reported and what you checked"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            First comment (optional)
          </span>
          <textarea
            className={`${M_INPUT} min-h-[60px]`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <span className="block text-[11px] text-muted-foreground">
            Plain text. **bold**, `code` and lines starting with “- ” are shown formatted; anything
            else, including HTML, is kept as plain text.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.close_after_raising}
            onChange={(e) => set("close_after_raising", e.target.checked)}
          />
          Solved on this call: close it straight away
        </label>
        {f.close_after_raising && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Reason for outage{needRfo && <span className="text-destructive"> *</span>}
              </span>
              <select
                className={M_INPUT}
                value={f.rfo_reason}
                aria-invalid={!!errors.rfo_reason}
                onChange={(e) => set("rfo_reason", e.target.value as TicketForm["rfo_reason"])}
              >
                <option value="">{needRfo ? "Pick…" : "None"}</option>
                {RFO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.rfo_reason && (
                <span className="block text-[11px] text-destructive">{errors.rfo_reason}</span>
              )}
            </label>
            <TextField
              label="Resolution"
              value={f.resolution_note}
              onChange={(v) => set("resolution_note", v)}
            />
          </div>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

// ------------------------------------------------------------- accordions

function Section({
  id,
  title,
  summary,
  children,
  defaultOpen,
}: {
  id?: string;
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details id={id} open={defaultOpen} className="group rounded-xl premium-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        {title}
        {summary && (
          <span className="ml-auto text-xs font-normal text-muted-foreground">{summary}</span>
        )}
      </summary>
      <div className="border-t border-border px-4 py-3 text-sm">{children}</div>
    </details>
  );
}

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? "–"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WorkbenchAccordions({ s }: S) {
  const wb = useWorkbench(s.id);
  const ledger = useSubscriberLedger(wb.data ? s.id : null);
  if (!wb.data) return null;
  const last = ledger.data?.payments?.[0];
  const tickets = wb.data.tickets;
  const p = s.profile;
  return (
    <div className="space-y-2">
      <Section
        title="Last payment"
        summary={
          last ? `${formatRupees(last.amount_paise)} · ${formatDate(last.received_at)}` : "None"
        }
      >
        {ledger.isLoading ? (
          <Spinner />
        ) : !last ? (
          <p className="text-xs text-muted-foreground">No payment recorded yet.</p>
        ) : (
          <KV
            rows={[
              ["Amount", formatRupees(last.amount_paise)],
              ["Received", formatDateTime(last.received_at)],
              ["Mode", last.mode],
              ["Receipt", last.receipt_number],
              ["Status", last.status ?? "recorded"],
            ]}
          />
        )}
      </Section>
      <Section
        id="wb-tickets"
        title="Tickets"
        summary={
          tickets === null
            ? "Helpdesk not switched on"
            : `${wb.data.open_tickets ?? 0} open · ${tickets.length} shown`
        }
      >
        {tickets === null ? (
          <p className="text-xs text-muted-foreground">
            Tickets appear here once the helpdesk is switched on for your account.
          </p>
        ) : tickets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tickets for this subscriber.</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-lg border border-border p-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono">{t.number}</span>
                  <MTag label={t.status.replace(/_/g, " ")} />
                  {t.type_name && <span className="text-muted-foreground">{t.type_name}</span>}
                  {t.sla_state === "breached" && <MTag label="SLA breached" tone="overdue" />}
                  <span className="ml-auto text-muted-foreground">
                    {formatDateTime(t.opened_at)}
                  </span>
                </div>
                <p className="mt-1 font-medium">{t.subject}</p>
                {t.description && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <LiteText text={t.description} />
                  </div>
                )}
                {t.assignee_name && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Assigned to {t.assignee_name}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Additional info">
        <KV
          rows={[
            ["User type", p.user_type],
            ["ONT / CPE serial", p.ont_serial],
            ["Set-top box", p.stb_serial],
            ["GSTIN", s.gstin],
            ["Comments", p.comments ? <LiteText text={p.comments} /> : null],
          ]}
        />
      </Section>
      <Section
        id="wb-billing"
        title="Billing info"
        summary={
          s.billing.due_paise > 0 ? `UNPAID · due ${formatRupees(s.billing.due_paise)}` : "PAID"
        }
      >
        <KV
          rows={[
            ["Status", s.billing.due_paise > 0 ? "UNPAID" : "PAID"],
            ["Due", formatRupees(s.billing.due_paise)],
            ["Overdue", formatRupees(s.billing.overdue_paise)],
            [
              "Price",
              p.override_price_paise
                ? `${formatRupees(p.override_price_paise)} (override)`
                : "Package price",
            ],
            [
              "After due date",
              {
                suspend: "Suspend",
                keep_active: "Keep active",
                disconnect_once: "Disconnect once",
              }[p.after_due_action ?? "suspend"],
            ],
            ["Reminders", p.exclude_reminders ? "Off" : "On"],
            ["Billing day", p.billing_anchor_day ? String(p.billing_anchor_day) : null],
            [
              "Billed / paid",
              ledger.data
                ? `${formatRupees(ledger.data.billed_paise)} / ${formatRupees(ledger.data.paid_paise)}`
                : null,
            ],
          ]}
        />
      </Section>
    </div>
  );
}
