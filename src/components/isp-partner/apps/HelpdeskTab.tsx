/** Apps -> Helpdesk: the ticket queue (status / type / assignee / customer /
 * SLA filters, zone via the switcher), a TAT & breach view, ticket types and
 * stats. Ticket create uses SUB360-2's helpdeskService. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, TimerOff } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSeg,
  MTable,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  Card,
  CustomerSelect,
  ErrorBlock,
  FormError,
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  AssigneeSelect,
  CsvButton,
  Select,
  StatusTag,
  appsKeys,
  useAppsMutation,
} from "@/components/isp-partner/apps/appsKit";
import { TicketDetailDrawer } from "@/components/isp-partner/apps/TicketDetailDrawer";
import { TicketTypesCard } from "@/components/isp-partner/apps/TicketTypesCard";
import { EscalationCard } from "@/components/isp-partner/apps/EscalationCard";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime, isoDay } from "@/lib/isp-partner/format";
import {
  RFO_LABEL,
  TICKET_STATUS_LABEL,
  appsCan,
  humanize,
  minutesText,
  needsRfo,
  slaText,
} from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import {
  RFO_REASONS,
  TICKET_PRIORITIES,
  TICKET_SOURCES,
  TICKET_STATUSES,
  type TicketQuery,
  type TicketTypeFull,
} from "@/services/isp-partner/apps-types";

type View = "queue" | "breached" | "stats" | "escalation" | "types";

export function HelpdeskTab() {
  const { can } = usePartner();
  const c = appsCan(can);
  const [view, setView] = useState<View>("queue");
  const types = useQuery({
    queryKey: appsKeys.list("ticket-types"),
    queryFn: () => appsService.ticketTypes(),
    retry: false,
  });
  return (
    <div className="space-y-3">
      <MSeg<View>
        value={view}
        onChange={setView}
        options={[
          { value: "queue", label: "Queue" },
          { value: "breached", label: "SLA breached" },
          { value: "stats", label: "TAT & stats" },
          { value: "escalation", label: "Escalation" },
          { value: "types", label: "Ticket types" },
        ]}
      />
      {view === "queue" && <Queue types={types.data ?? []} breachedOnly={false} />}
      {view === "breached" && <Queue types={types.data ?? []} breachedOnly />}
      {view === "stats" && <Stats />}
      {view === "escalation" && <EscalationCard types={types.data ?? []} canManage={c.manage} />}
      {view === "types" && <TicketTypesCard canManage={c.manage} />}
    </div>
  );
}

function Queue({ types, breachedOnly }: { types: TicketTypeFull[]; breachedOnly: boolean }) {
  const { can } = usePartner();
  const c = appsCan(can);
  const customers = useIspCustomerOptions();
  const [status, setStatus] = useState("");
  const [typeId, setTypeId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [customer, setCustomer] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q: TicketQuery = {
    status: (status || undefined) as TicketQuery["status"],
    type_id: typeId || undefined,
    assignee_user_id: assignee || undefined,
    isp_customer_id: customer || undefined,
    sla_state: breachedOnly ? "breached" : undefined,
    search: debounced || undefined,
    page,
    page_size: 25,
  };
  const list = useQuery({
    queryKey: appsKeys.list("tickets", q),
    queryFn: () => appsService.tickets(q),
    retry: false,
    refetchInterval: 60_000,
  });
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-auto"
          ariaLabel="Status"
          value={status}
          onChange={reset(setStatus)}
          options={[
            ["", "Any status"],
            ...TICKET_STATUSES.map((s) => [s, TICKET_STATUS_LABEL[s]] as [string, string]),
          ]}
        />
        <Select
          className="w-auto"
          ariaLabel="Type"
          value={typeId}
          onChange={reset(setTypeId)}
          options={[["", "Any type"], ...types.map((t) => [t.id, t.name] as [string, string])]}
        />
        <div className="w-48">
          <AssigneeSelect value={assignee} onChange={reset(setAssignee)} />
        </div>
        <div className="w-52">
          <CustomerSelect
            value={customer}
            onChange={reset(setCustomer)}
            customers={customers.data}
          />
        </div>
        <input
          className={`${M_INPUT} w-56`}
          placeholder="Number, subject or subscriber"
          value={search}
          onChange={(e) => reset(setSearch)(e.target.value)}
          aria-label="Search tickets"
        />
        <div className="ml-auto flex gap-2">
          {c.export && <CsvButton run={() => appsService.ticketsCsv(q)} />}
          {c.create && (
            <MButton onClick={() => setCreating(true)}>
              <Plus /> New ticket
            </MButton>
          )}
        </div>
      </div>
      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="tickets" />
      ) : list.data && list.data.items.length === 0 ? (
        <MEmptyState
          icon={TimerOff}
          title={breachedOnly ? "Nothing is past its SLA" : "No tickets here"}
          description="Change the filters, or raise a ticket."
        />
      ) : (
        <>
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>Ticket</MTh>
                <MTh>Customer / subscriber</MTh>
                <MTh>Type</MTh>
                <MTh>Priority</MTh>
                <MTh>Status</MTh>
                <MTh>SLA</MTh>
                <MTh>Assignee</MTh>
              </>
            }
          >
            {(list.data?.items ?? []).map((t) => (
              <MTr key={t.id}>
                <MTd>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setOpen(t.id)}
                  >
                    <span className="font-mono text-xs">{t.number}</span>
                    <span className="block text-sm">{t.subject}</span>
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(t.opened_at)}
                  </span>
                </MTd>
                <MTd className="text-xs">
                  {t.customer_name ?? "–"}
                  {t.subscriber_label && (
                    <p className="text-muted-foreground">{t.subscriber_label}</p>
                  )}
                </MTd>
                <MTd className="text-xs">{t.type_name ?? "–"}</MTd>
                <MTd className="text-xs">{humanize(t.priority)}</MTd>
                <MTd>
                  <StatusTag map={TICKET_STATUS_LABEL} value={t.status} />
                </MTd>
                <MTd className={`text-xs ${t.sla_state === "breached" ? "text-rose-600" : ""}`}>
                  {slaText(t)}
                </MTd>
                <MTd className="text-xs">{t.assignee_name ?? "–"}</MTd>
              </MTr>
            ))}
          </MTable>
          {list.data && list.data.pages > 1 && (
            <Pager
              page={list.data.page}
              pages={list.data.pages}
              total={list.data.total}
              onPage={setPage}
            />
          )}
        </>
      )}
      {open && <TicketDetailDrawer ticketId={open} types={types} onClose={() => setOpen(null)} />}
      {creating && (
        <NewTicketDialog types={types} onClose={() => setCreating(false)} onCreated={setOpen} />
      )}
    </div>
  );
}

function NewTicketDialog({
  types,
  onClose,
  onCreated,
}: {
  types: TicketTypeFull[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const customers = useIspCustomerOptions();
  const [f, setF] = useState({
    isp_customer_id: "",
    type_id: "",
    subject: "",
    description: "",
    source: "phone",
    priority: "normal",
    assignee: "",
    close: false,
    rfo: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const type = types.find((t) => t.id === f.type_id);
  const create = useAppsMutation(() =>
    appsService.createTicket({
      isp_customer_id: f.isp_customer_id,
      type_id: f.type_id || null,
      subject: f.subject.trim(),
      description: f.description.trim() || null,
      source: f.source as never,
      priority: f.priority as never,
      assignee_user_id: f.assignee || null,
      close_after_raising: f.close,
      rfo_reason: f.close && f.rfo ? (f.rfo as never) : null,
    }),
  );
  return (
    <MDialog
      open
      wide
      onClose={onClose}
      title="New ticket"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={create.isPending}
            onClick={async () => {
              setErr(null);
              if (!f.isp_customer_id) return setErr("Pick the customer.");
              if (!f.subject.trim()) return setErr("Give it a subject.");
              if (f.close && needsRfo(type) && !f.rfo)
                return setErr("Pick a reason for outage to close it now.");
              try {
                const t = await create.mutateAsync(undefined);
                toast.success(`Ticket ${t.number} raised.`);
                onClose();
                onCreated(t.id);
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {create.isPending && <Spinner />} Raise ticket
          </MButton>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Customer</span>
          <CustomerSelect
            value={f.isp_customer_id}
            onChange={set("isp_customer_id")}
            customers={customers.data}
            allLabel={null}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <Select
            ariaLabel="Type"
            value={f.type_id}
            onChange={set("type_id")}
            options={[
              ["", "No type"],
              ...types.filter((t) => t.active).map((t) => [t.id, t.name] as [string, string]),
            ]}
          />
        </label>
        <div className="sm:col-span-2">
          <TextField label="Subject" required value={f.subject} onChange={set("subject")} />
        </div>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Description</span>
          <textarea
            className={`${M_INPUT} min-h-[72px]`}
            value={f.description}
            onChange={(e) => set("description")(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Came in by</span>
          <Select
            ariaLabel="Source"
            value={f.source}
            onChange={set("source")}
            options={TICKET_SOURCES.map((s) => [s, humanize(s)] as [string, string])}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Priority</span>
          <Select
            ariaLabel="Priority"
            value={f.priority}
            onChange={set("priority")}
            options={TICKET_PRIORITIES.map((s) => [s, humanize(s)] as [string, string])}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Assign to</span>
          <AssigneeSelect value={f.assignee} onChange={set("assignee")} />
        </label>
        <label className="flex items-center gap-2 pt-6 text-xs">
          <input
            type="checkbox"
            checked={f.close}
            onChange={(e) => set("close")(e.target.checked)}
          />
          Solved on this call (close it now)
        </label>
        {f.close && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Reason for outage</span>
            <Select
              ariaLabel="Reason for outage"
              value={f.rfo}
              onChange={set("rfo")}
              options={[
                ["", needsRfo(type) ? "Pick…" : "Not needed"],
                ...RFO_REASONS.map((r) => [r, RFO_LABEL[r]] as [string, string]),
              ]}
            />
          </label>
        )}
      </div>
      <FormError message={err} />
    </MDialog>
  );
}

function Stats() {
  const [since, setSince] = useState(isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [until, setUntil] = useState(isoDay(new Date()));
  const q = useQuery({
    queryKey: appsKeys.list("ticket-stats", { since, until }),
    queryFn: () => appsService.ticketStats({ since, until }),
    retry: false,
  });
  const o = q.data?.overall;
  return (
    <Card title="Turnaround and SLA">
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="date"
          aria-label="From"
          className={`${M_INPUT} w-auto`}
          value={since}
          onChange={(e) => setSince(e.target.value)}
        />
        <input
          type="date"
          aria-label="To"
          className={`${M_INPUT} w-auto`}
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </div>
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the stats" />
      ) : !q.data ? (
        <Spinner />
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            <b>{o?.count ?? 0}</b> tickets · <b>{o?.resolved ?? 0}</b> resolved · average turnaround{" "}
            <b>{minutesText(o?.avg_tat_minutes)}</b> ·{" "}
            <b className={o?.breached ? "text-rose-600" : ""}>{o?.breached ?? 0}</b> past SLA
          </p>
          <MTable
            head={
              <>
                <MTh>Type</MTh>
                <MTh className="text-right">Tickets</MTh>
                <MTh className="text-right">Resolved</MTh>
                <MTh className="text-right">Avg turnaround</MTh>
                <MTh className="text-right">Past SLA</MTh>
              </>
            }
          >
            {q.data.by_type.map((t) => (
              <MTr key={t.type_id ?? "none"}>
                <MTd>{t.type_name ?? "No type"}</MTd>
                <MTd className="text-right tabular-nums">{t.count}</MTd>
                <MTd className="text-right tabular-nums">{t.resolved}</MTd>
                <MTd className="text-right tabular-nums">{minutesText(t.avg_tat_minutes)}</MTd>
                <MTd className="text-right tabular-nums">{t.breached}</MTd>
              </MTr>
            ))}
          </MTable>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(q.data.by_rfo).map(([k, n]) => (
              <span key={k} className="rounded-full border border-border px-2 py-0.5">
                {RFO_LABEL[k] ?? humanize(k)}: <b className="tabular-nums">{n}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
