/**
 * Batch B5 pages (ADDENDUM_04): Alerts, Support Tickets, Staff Activity and
 * How It Works, for the customer workspace.
 *
 * - Alerts: this venue's alerts (acknowledge / resolve), the customer's alert
 *   rules (read-only: the by-id rule routes are not twinned, see the backend),
 *   and the ISP-wide feed across all my customers.
 * - Support Tickets: ISP -> Wyfy. Tickets are filed under the ISP account and
 *   may name this customer; Wyfy answers them from the Master console.
 * - Staff Activity: what my staff did, for this customer or across all.
 * - How It Works: the ISP's own guide (static, our words).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, LifeBuoy, ScrollText } from "lucide-react";
import {
  M_INPUT,
  MButton,
  MEmptyState,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Pager,
  Spinner,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import type { PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate } from "@/lib/isp-partner/format";
import { monitorSupportService as svc } from "@/services/isp-partner/monitor-support";

const k = (...parts: (string | number | null | undefined)[]) => ["isp-b5", ...parts];

// -- Alerts --------------------------------------------------------------------

function VenueAlerts({ locationId }: { locationId: string }) {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: k("venue-alerts", locationId), queryFn: svc.venueAlerts });
  const act = useMutation({
    mutationFn: ({ id, op }: { id: string; op: "ack" | "resolve" }) =>
      op === "ack" ? svc.acknowledge(id) : svc.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: k("venue-alerts", locationId) }),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="alerts" />;
  // The alert twin lists the customer's alerts; this page shows this venue's.
  const items = q.data.items.filter((a) => a.location_id === locationId);
  return (
    <Card title="Alerts at this venue">
      {items.length === 0 ? (
        <MEmptyState icon={Bell} title="No alerts at this venue" />
      ) : (
        <MTable
          head={
            <>
              <MTh>When</MTh>
              <MTh>Alert</MTh>
              <MTh>Severity</MTh>
              <MTh>Status</MTh>
              <MTh />
            </>
          }
        >
          {items.map((a) => (
            <MTr key={a.id}>
              <MTd className="text-xs">{formatDate(a.triggered_at)}</MTd>
              <MTd>
                {a.message}
                {a.router_name && (
                  <p className="text-[11px] text-muted-foreground">{a.router_name}</p>
                )}
              </MTd>
              <MTd>
                <MTag label={a.severity} />
              </MTd>
              <MTd>
                <MTag label={a.status} />
              </MTd>
              <MTd className="text-right">
                {can("isp_monitor.update") && a.status === "triggered" && (
                  <MButton variant="ghost" onClick={() => act.mutate({ id: a.id, op: "ack" })}>
                    Acknowledge
                  </MButton>
                )}
                {can("isp_monitor.update") && a.status !== "resolved" && (
                  <MButton variant="ghost" onClick={() => act.mutate({ id: a.id, op: "resolve" })}>
                    Resolve
                  </MButton>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {q.data.total_items > q.data.items.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing this venue's alerts among the customer's latest {q.data.items.length}.
        </p>
      )}
    </Card>
  );
}

function AlertRules({ locationId }: { locationId: string }) {
  const q = useQuery({ queryKey: k("rules", locationId), queryFn: svc.venueAlertRules });
  return (
    <Card title="Alert rules (this customer)">
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="alert rules" />
      ) : q.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alert rules for this customer.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {q.data.items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <MTag label={r.is_active ? "active" : "off"} />
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-muted-foreground">
                {r.trigger_type} · {r.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IspAlertFeed() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("triggered");
  const q = useQuery({
    queryKey: k("feed", status, page),
    queryFn: () => svc.ispAlerts({ status, page }),
  });
  return (
    <Card
      title="Alerts across my customers"
      actions={
        <select
          className={`${M_INPUT} w-auto`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Status"
        >
          <option value="triggered">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="">All</option>
        </select>
      }
    >
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="alerts" />
      ) : q.data && q.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alerts.</p>
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>When</MTh>
                <MTh>Customer</MTh>
                <MTh>Alert</MTh>
                <MTh>Severity</MTh>
              </>
            }
          >
            {q.data?.items.map((a) => (
              <MTr key={a.id}>
                <MTd className="text-xs">{formatDate(a.triggered_at)}</MTd>
                <MTd className="font-medium">{a.customer_name}</MTd>
                <MTd>{a.message}</MTd>
                <MTd>
                  <MTag label={a.severity} />
                </MTd>
              </MTr>
            ))}
          </MTable>
          {q.data && (
            <Pager
              page={page}
              pages={q.data.total_pages}
              total={q.data.total_items}
              onPage={setPage}
            />
          )}
        </>
      )}
    </Card>
  );
}

export function AlertsPage({ locationId }: PartnerSlotProps) {
  const [view, setView] = useState<"venue" | "all">("venue");
  return (
    <div className="space-y-4">
      <MSeg<"venue" | "all">
        value={view}
        onChange={setView}
        options={[
          { value: "venue", label: "This venue" },
          { value: "all", label: "All my customers" },
        ]}
      />
      {view === "venue" ? (
        <>
          <VenueAlerts locationId={locationId as string} />
          <AlertRules locationId={locationId as string} />
        </>
      ) : (
        <IspAlertFeed />
      )}
    </div>
  );
}

// -- Support Tickets -------------------------------------------------------------

function TicketThread({ ticketId }: { ticketId: string }) {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: k("replies", ticketId), queryFn: () => svc.replies(ticketId) });
  const [msg, setMsg] = useState("");
  const send = useMutation({
    mutationFn: () => svc.reply(ticketId, msg.trim()),
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: k("replies", ticketId) });
    },
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {q.isLoading && <LoadingBlock />}
      {q.data?.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
      {q.data?.map((r) => (
        <div key={r.id} className="text-sm">
          <p className="text-[11px] text-muted-foreground">
            {r.is_staff_reply ? "Wyfy support" : r.author_name} · {formatDate(r.created_at)}
          </p>
          <p className="whitespace-pre-wrap">{r.message}</p>
        </div>
      ))}
      {can("isp_support.create") && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (msg.trim()) send.mutate();
          }}
        >
          <input
            className={M_INPUT}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Reply"
            aria-label="Reply"
          />
          <MButton type="submit" disabled={send.isPending}>
            {send.isPending && <Spinner />} Send
          </MButton>
        </form>
      )}
    </div>
  );
}

export function SupportTicketsPage({ customer }: PartnerSlotProps) {
  const { can } = usePartner();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "medium",
    about: true,
  });
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: k("tickets", page), queryFn: () => svc.tickets(page) });
  const create = useMutation({
    mutationFn: () =>
      svc.createTicket({
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority,
        isp_customer_id: form.about ? customer.id : null,
      }),
    onSuccess: () => {
      toast.success("Ticket sent to Wyfy support.");
      setForm({ subject: "", description: "", priority: "medium", about: true });
      qc.invalidateQueries({ queryKey: k("tickets") });
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  return (
    <div className="space-y-4">
      {can("isp_support.create") && (
        <Card title="Ask Wyfy support">
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              create.mutate();
            }}
          >
            <input
              className={M_INPUT}
              placeholder="Subject"
              required
              minLength={2}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              aria-label="Subject"
            />
            <textarea
              className={`${M_INPUT} min-h-24`}
              placeholder="What happened? Include the venue and router if you can."
              required
              minLength={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              aria-label="Description"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <select
                className={`${M_INPUT} w-auto`}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                aria-label="Priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.about}
                  onChange={(e) => setForm({ ...form, about: e.target.checked })}
                />
                About {customer.name}
              </label>
              <MButton type="submit" disabled={create.isPending}>
                {create.isPending && <Spinner />} Send ticket
              </MButton>
            </div>
            <FormError message={error} />
          </form>
        </Card>
      )}
      <Card title="My tickets to Wyfy">
        {q.error && !q.data ? (
          <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="tickets" />
        ) : q.data && q.data.items.length === 0 ? (
          <MEmptyState icon={LifeBuoy} title="No tickets yet" />
        ) : (
          <div className="space-y-2">
            {q.isLoading && <LoadingBlock />}
            {q.data?.items.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <button
                  className="flex w-full flex-wrap items-center gap-2 text-left"
                  onClick={() => setOpen(open === t.id ? null : t.id)}
                >
                  <MTag label={t.status} />
                  <span className="font-medium">{t.subject}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t.priority} · {formatDate(t.created_at)}
                  </span>
                </button>
                {open === t.id && (
                  <div className="mt-2 space-y-2">
                    <p className="whitespace-pre-wrap text-sm">{t.description}</p>
                    <TicketThread ticketId={t.id} />
                  </div>
                )}
              </div>
            ))}
            {q.data && (
              <Pager
                page={page}
                pages={q.data.total_pages}
                total={q.data.total_items}
                onPage={setPage}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// -- Staff Activity ----------------------------------------------------------------

export function StaffActivityPage({ customer }: PartnerSlotProps) {
  const [scope, setScope] = useState<"customer" | "all">("customer");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: k("staff", scope, customer.id, page),
    queryFn: () =>
      svc.staffActivity({ customerId: scope === "customer" ? customer.id : null, page }),
  });
  return (
    <Card
      title="Staff activity"
      actions={
        <MSeg<"customer" | "all">
          value={scope}
          onChange={(v) => {
            setScope(v);
            setPage(1);
          }}
          options={[
            { value: "customer", label: customer.name },
            { value: "all", label: "Everything" },
          ]}
        />
      }
    >
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="staff activity" />
      ) : q.data && q.data.items.length === 0 ? (
        <MEmptyState icon={ScrollText} title="No activity recorded" />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>When</MTh>
                <MTh>Who</MTh>
                <MTh>What</MTh>
                <MTh>Customer</MTh>
              </>
            }
          >
            {q.data?.items.map((e) => (
              <MTr key={e.id}>
                <MTd className="text-xs">{formatDate(e.created_at)}</MTd>
                <MTd>{e.actor ? e.actor.name : "System"}</MTd>
                <MTd>
                  <span className="font-medium">{e.action}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {e.description ?? e.entity_type}
                  </span>
                </MTd>
                <MTd className="text-xs">{e.customer_name ?? "Your account"}</MTd>
              </MTr>
            ))}
          </MTable>
          {q.data && (
            <Pager
              page={page}
              pages={q.data.total_pages}
              total={q.data.total_items}
              onPage={setPage}
            />
          )}
        </>
      )}
    </Card>
  );
}

// -- How It Works (ISP guide) ---------------------------------------------------------

const GUIDE: { title: string; body: string[] }[] = [
  {
    title: "1. Add a customer",
    body: [
      "Customers → Add customer. A customer is a business you serve (a café, a hotel, an office). It has no login of its own: you run everything for it from this console.",
      "Add each of its venues as a location. Each location gets its own captive portal and its own routers.",
    ],
  },
  {
    title: "2. Connect the router",
    body: [
      "Open the location, add its MikroTik, and generate the setup script. Paste the script into the router's terminal once. The router then checks in and shows as online.",
      "Only owners and admins (and technicians limited to that customer) can generate a setup script, and every generation is recorded.",
    ],
  },
  {
    title: "3. CPEs over TR-069",
    body: [
      "TR-069 devices lists every CPE that informed to your ACS. Assign a CPE to a customer, read its parameters, and reboot it from here.",
    ],
  },
  {
    title: "4. Packages and coupons",
    body: [
      "Plans & coupons: a package is a speed group plus validity and price. Coupons are codes guests type on the portal; each activation can create a paid invoice.",
    ],
  },
  {
    title: "5. Run the customer's WiFi",
    body: [
      "Open a customer and use Open workspace. The menu is the same as the customer dashboard: portal, guests, access rules, network, security, devices and more. Pick the venue at the top for venue-level settings.",
      "Settings that live on a router ask which router first. Changes saved here are applied to the router when you push them.",
    ],
  },
  {
    title: "6. Suspend and billing",
    body: [
      "Suspending a customer stops new guest logins at all its venues and ends live sessions. Devices allowed without login (trusted devices) are not cut.",
      "Billing records cash, UPI or bank payments against dues, and issues invoices and receipts from your own series.",
    ],
  },
  {
    title: "7. Logs and records",
    body: [
      "Logs has router logs (NetLogs), guest sign-ins and IPDR, across all your customers or one. Exports are recorded.",
    ],
  },
  {
    title: "8. Getting help",
    body: [
      "Support Tickets sends a ticket to Wyfy. Name the customer it is about; Wyfy answers in the same thread.",
    ],
  },
];

export function HowItWorksPage() {
  return (
    <div className="space-y-3">
      {GUIDE.map((s) => (
        <Card key={s.title} title={s.title}>
          <div className="space-y-2 text-sm text-muted-foreground">
            {s.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
