import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  EmptyState,
  FormField,
  FormSection,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
  type ConsoleStatus,
  type PageScope,
} from "@/components/customer/console";
import { cn } from "@/lib/utils";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { ticketService, resolveOrgId } from "@/services/ticket.service";
import { useSupportTicketsSocket } from "@/hooks/useSupportTicketRealtime";
import type { SupportTicket, TicketPriority, TicketReply } from "@/types/support-ticket";

const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.
const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];
const CATEGORIES = ["network", "billing", "feature_request", "device_support", "other"];
const CATEGORY_LABEL: Record<string, string> = {
  network: "Network Issue",
  billing: "Billing",
  feature_request: "Feature Request",
  device_support: "Device Support",
  other: "Other",
};
const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Normal",
  high: "High",
  urgent: "Urgent",
};

interface DemoTicket {
  id: string;
  subject: string;
  businessUnit: string;
  category: string;
  priority: string;
  status: "open" | "in-progress" | "resolved";
  createdAt: string;
  description: string;
}

const SEED: DemoTicket[] = [
  {
    id: "T-1042",
    subject: "Guest WiFi dropping every 20 minutes",
    businessUnit: "Mumbai HQ",
    category: "Network Issue",
    priority: "High",
    status: "in-progress",
    createdAt: "2026-07-20",
    description: "Multiple guests reporting disconnects.",
  },
  {
    id: "T-1038",
    subject: "Need extra vouchers for weekend event",
    businessUnit: "Delhi Office",
    category: "Feature Request",
    priority: "Normal",
    status: "resolved",
    createdAt: "2026-07-15",
    description: "Requesting 200 additional 1-day vouchers.",
  },
  {
    id: "T-1031",
    subject: "Invoice mismatch for June",
    businessUnit: "Bangalore DC",
    category: "Billing",
    priority: "Low",
    status: "resolved",
    createdAt: "2026-07-05",
    description: "June invoice shows wrong plan tier.",
  },
];

/** A native <select> dressed as the console's Input (same height, border,
 * focus ring), so the dialog's fields read as one form. */
const SELECT_CLS =
  "flex h-9 w-full rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] px-3 text-sm text-[var(--wy-text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] max-sm:h-10";

/** Ticket state -> console status. Open is waiting on support (warn), in
 * progress is being worked (info), resolved/closed are done (ok). Was
 * rose / amber / emerald palette pills. */
const STATUS_TONE: Record<string, ConsoleStatus> = {
  open: "warn",
  "in-progress": "info",
  in_progress: "info",
  resolved: "ok",
  closed: "ok",
};

/** A ticket's id, status and (when high/urgent) priority, on one line. */
function TicketBadges({ id, status, priority }: { id: string; status: string; priority?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-[var(--wy-text-faint)]">{id}</span>
      <StatusBadge status={STATUS_TONE[status] ?? "offline"} className="capitalize">
        {status.replace(/[-_]/, " ")}
      </StatusBadge>
      {priority && (
        <StatusBadge status="crit" dot={false}>
          {priority}
        </StatusBadge>
      )}
    </div>
  );
}

const ROW_BUTTON = "h-8 gap-1.5 text-xs max-sm:h-10";

export default function TicketsPage({
  locationId,
  scope,
}: { locationId?: string; scope?: PageScope } = {}) {
  const demo = useIsDemo();
  const { data: locations } = useCustomerLocations();

  // Demo-mode state (unchanged behavior)
  const [tickets, setTickets] = useState<DemoTicket[]>(SEED);

  // Real-mode state
  const [realTickets, setRealTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [filterUnit, setFilterUnit] = useState("");
  const [form, setForm] = useState({
    businessUnit: "",
    subject: "",
    category: "",
    priority: "medium" as TicketPriority,
    description: "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Reply thread (real mode only) -- keyed by ticket id.
  const [orgId, setOrgId] = useState<string | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [repliesByTicket, setRepliesByTicket] = useState<Record<string, TicketReply[]>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});

  const realUnits = useMemo(() => (locations ?? []).map((l) => l.name), [locations]);
  const units = demo ? UNITS : realUnits;

  async function refetch() {
    if (demo) return;
    setLoading(true);
    try {
      const rows = await ticketService.list();
      setRealTickets(rows);
    } catch {
      toast.error("Could not load tickets from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    if (demo) {
      setOrgId(null);
      return;
    }
    let cancelled = false;
    resolveOrgId()
      .then((id) => {
        if (!cancelled) setOrgId(id);
      })
      .catch(() => {
        /* no organization context yet -- realtime simply stays off */
      });
    return () => {
      cancelled = true;
    };
  }, [demo]);

  function loadReplies(ticketId: string) {
    setRepliesLoading((prev) => ({ ...prev, [ticketId]: true }));
    ticketService
      .listReplies(ticketId, { asCustomer: true })
      .then((rows) => {
        setRepliesByTicket((prev) => ({ ...prev, [ticketId]: rows }));
      })
      .catch(() => toast.error("Could not load the reply thread."))
      .finally(() => setRepliesLoading((prev) => ({ ...prev, [ticketId]: false })));
  }

  function toggleThread(ticketId: string) {
    setExpandedTicketId((prev) => {
      const next = prev === ticketId ? null : ticketId;
      if (next && !repliesByTicket[next]) loadReplies(next);
      return next;
    });
  }

  function upsertReply(ticketId: string, reply: TicketReply) {
    setRepliesByTicket((prev) => {
      const existing = prev[ticketId] ?? [];
      if (existing.some((r) => r.id === reply.id)) return prev;
      return { ...prev, [ticketId]: [...existing, reply] };
    });
  }

  async function sendReply(ticketId: string) {
    const message = (replyDrafts[ticketId] ?? "").trim();
    if (!message) return;
    setSendingReply((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const reply = await ticketService.addReply(ticketId, message, { asCustomer: true });
      upsertReply(ticketId, reply);
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
    } catch {
      toast.error("Could not send the reply.");
    } finally {
      setSendingReply((prev) => ({ ...prev, [ticketId]: false }));
    }
  }

  // The customer dashboard's own tenant-scoped connection -- only this
  // organization's ticket/reply events, mirrors ticketService.list()'s own
  // X-Organization-Id-scoped REST call.
  useSupportTicketsSocket(
    orgId,
    (msg) => {
      if (msg.type === "reply_created") {
        const payload = msg.payload;
        upsertReply(payload.ticket_id, {
          id: payload.id,
          ticketId: payload.ticket_id,
          authorUserId: payload.author_user_id,
          authorName: payload.author_name,
          authorEmail: payload.author_email,
          isStaffReply: payload.is_staff_reply,
          message: payload.message,
          createdAt: payload.created_at,
        });
        if (payload.is_staff_reply) {
          toast.message("Support replied", { description: payload.message.slice(0, 80) });
        }
      } else if (msg.type === "ticket_updated") {
        const payload = msg.payload;
        setRealTickets((prev) =>
          prev.map((t) =>
            t.id === payload.ticket_id
              ? {
                  ...t,
                  status: payload.status,
                  priority: payload.priority,
                  assignedToUserId: payload.assigned_to_user_id,
                  resolutionNotes: payload.resolution_notes,
                  resolvedAt: payload.resolved_at,
                  updatedAt: payload.updated_at,
                }
              : t,
          ),
        );
      }
    },
    { enabled: !demo && !!orgId },
  );

  useEffect(() => {
    if (!demo && !form.businessUnit && locationId && locations) {
      const match = locations.find((l) => l.id === locationId);
      if (match) setForm((f) => ({ ...f, businessUnit: match.name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locations, locationId]);

  const filteredDemo = useMemo(
    () => tickets.filter((t) => !filterUnit || t.businessUnit === filterUnit),
    [tickets, filterUnit],
  );
  const countForUnitDemo = (unit: string) => tickets.filter((t) => t.businessUnit === unit).length;

  const filteredReal = useMemo(
    () =>
      realTickets.filter((t) => {
        if (!filterUnit) return true;
        const loc = locations?.find((l) => l.name === filterUnit);
        return loc ? t.locationId === loc.id : true;
      }),
    [realTickets, filterUnit, locations],
  );
  const countForUnitReal = (unit: string) => {
    const loc = locations?.find((l) => l.name === unit);
    return loc ? realTickets.filter((t) => t.locationId === loc.id).length : 0;
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.businessUnit) e.businessUnit = "Select a location.";
    if (!form.subject) e.subject = "Enter a subject.";
    if (!form.category) e.category = "Select a category.";
    // The backend requires a >= 5 character description (see
    // support_ticket schemas' CreateTicketRequest) -- validate the same
    // constraint client-side rather than letting the request 422 with a
    // generic "Could not raise the ticket" toast and no indication why.
    if (!demo && form.description.trim().length < 5)
      e.description = "Add at least 5 characters describing the issue.";
    setErrs(e);
    if (Object.keys(e).length) return;

    if (demo) {
      setTickets((t) => [
        {
          id: `T-${1000 + t.length + 50}`,
          subject: form.subject,
          businessUnit: form.businessUnit,
          category: CATEGORY_LABEL[form.category] ?? form.category,
          priority: PRIORITY_LABEL[form.priority],
          status: "open",
          createdAt: new Date().toISOString().slice(0, 10),
          description: form.description,
        },
        ...t,
      ]);
      setForm({ businessUnit: "", subject: "", category: "", priority: "medium", description: "" });
      setOpen(false);
      toast.success("Ticket raised — support will get back to you shortly.");
      return;
    }

    setSaving(true);
    try {
      const loc = locations?.find((l) => l.name === form.businessUnit);
      await ticketService.create({
        locationId: loc?.id,
        subject: form.subject,
        description: form.description,
        category: form.category,
        priority: form.priority,
      });
      setForm({ businessUnit: "", subject: "", category: "", priority: "medium", description: "" });
      setOpen(false);
      toast.success("Ticket raised — support will get back to you shortly.");
      refetch();
    } catch {
      toast.error("Could not raise the ticket.");
    } finally {
      setSaving(false);
    }
  };

  async function markResolved(id: string) {
    if (demo) {
      setTickets((ts) => ts.map((x) => (x.id === id ? { ...x, status: "resolved" } : x)));
      toast.success("Marked resolved");
      return;
    }
    try {
      await ticketService.update(id, { status: "resolved" }, { asCustomer: true });
      toast.success("Marked resolved");
      refetch();
    } catch {
      toast.error("Could not update the ticket.");
    }
  }

  return (
    <div className="wy-console space-y-5">
      {/* The page's only header: the shell hands over the tab name + venue
          (the agent view mounts it bare). The gradient intro band, its
          illustration and the rotating quote are gone (design review §1). */}
      <PageHeader
        title={scope?.title ?? "Support Tickets"}
        venue={scope?.venue}
        description="Raise an issue for any of your locations and track its progress."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Raise Ticket
          </Button>
        }
      />

      {/* Per-location summary: a StatTile per venue, each a toggle filter
          for the list below (aria-pressed, visible focus). */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {units.map((u) => {
          const pressed = filterUnit === u;
          return (
            <button
              key={u}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilterUnit(pressed ? "" : u)}
              className="min-w-0 rounded-[var(--wy-radius)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wy-bg)]"
            >
              <StatTile
                label={u}
                value={demo ? countForUnitDemo(u) : countForUnitReal(u)}
                hint="tickets raised"
                className={cn(
                  "h-full transition-colors hover:bg-[var(--wy-surface-2)]",
                  pressed &&
                    "border-[var(--wy-accent)] bg-[var(--wy-accent-soft)] hover:bg-[var(--wy-accent-soft)]",
                )}
              />
            </button>
          );
        })}
      </div>

      <Panel
        flush
        title={filterUnit ? `Tickets · ${filterUnit}` : "All Tickets"}
        actions={
          filterUnit ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[var(--wy-accent)] max-sm:h-10"
              onClick={() => setFilterUnit("")}
            >
              Clear filter
            </Button>
          ) : undefined
        }
      >
        {!demo && loading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : demo ? (
          filteredDemo.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No tickets"
              description="No tickets for this location yet."
            />
          ) : (
            <ul className="divide-y divide-[var(--wy-border)]">
              {filteredDemo.map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <TicketBadges
                        id={t.id}
                        status={t.status}
                        priority={
                          t.priority === "Urgent" || t.priority === "High" ? t.priority : undefined
                        }
                      />
                      <p className="mt-1 truncate text-[13px] font-semibold text-[var(--wy-text)]">
                        {t.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--wy-text-muted)]">
                        {t.businessUnit} · {t.category} · {t.createdAt}
                      </p>
                      {t.description && (
                        <p className="mt-1.5 text-xs text-[var(--wy-text-muted)]">
                          {t.description}
                        </p>
                      )}
                    </div>
                    {t.status !== "resolved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={ROW_BUTTON}
                        onClick={() => markResolved(t.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark resolved
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : filteredReal.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No tickets"
            description="No tickets for this location yet."
          />
        ) : (
          <ul className="divide-y divide-[var(--wy-border)]">
            {filteredReal.map((t) => {
              const locName =
                locations?.find((l) => l.id === t.locationId)?.name ?? "All locations";
              const threadId = `ticket-thread-${t.id}`;
              return (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <TicketBadges
                        id={t.id.slice(0, 8)}
                        status={t.status}
                        priority={
                          t.priority === "urgent" || t.priority === "high"
                            ? PRIORITY_LABEL[t.priority]
                            : undefined
                        }
                      />
                      <p className="mt-1 truncate text-[13px] font-semibold text-[var(--wy-text)]">
                        {t.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--wy-text-muted)]">
                        {locName} · {t.category ? (CATEGORY_LABEL[t.category] ?? t.category) : "—"}{" "}
                        · {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                      {t.description && (
                        <p className="mt-1.5 text-xs text-[var(--wy-text-muted)]">
                          {t.description}
                        </p>
                      )}
                      {t.resolutionNotes && (
                        <p className="mt-1.5 text-xs text-[var(--wy-ok)]">
                          Resolution: {t.resolutionNotes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {t.status !== "resolved" && t.status !== "closed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={ROW_BUTTON}
                          onClick={() => markResolved(t.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark resolved
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className={ROW_BUTTON}
                        aria-expanded={expandedTicketId === t.id}
                        aria-controls={threadId}
                        onClick={() => toggleThread(t.id)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {(repliesByTicket[t.id]?.length ?? 0) > 0
                          ? `Replies (${repliesByTicket[t.id]!.length})`
                          : "Replies"}
                        {expandedTicketId === t.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedTicketId === t.id && (
                    <div id={threadId} className="mt-3 border-t border-[var(--wy-border)] pt-3">
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-3">
                        {repliesLoading[t.id] ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--wy-text-muted)]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading replies…
                          </div>
                        ) : (repliesByTicket[t.id]?.length ?? 0) === 0 ? (
                          <p className="py-4 text-center text-xs text-[var(--wy-text-muted)]">
                            No replies yet.
                          </p>
                        ) : (
                          repliesByTicket[t.id]!.map((r) => (
                            <div
                              key={r.id}
                              className={cn(
                                "rounded-[var(--wy-radius)] border p-2.5 text-[13px]",
                                r.isStaffReply
                                  ? "border-[color-mix(in_srgb,var(--wy-accent)_30%,transparent)] bg-[var(--wy-accent-soft)]"
                                  : "border-[var(--wy-border)] bg-[var(--wy-surface)]",
                              )}
                            >
                              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[var(--wy-text-muted)]">
                                {r.isStaffReply ? (
                                  <ShieldCheck
                                    aria-hidden
                                    className="h-3 w-3 text-[var(--wy-accent)]"
                                  />
                                ) : (
                                  <User aria-hidden className="h-3 w-3" />
                                )}
                                <span>
                                  {r.isStaffReply
                                    ? `${r.authorName} · CloudGuest Support`
                                    : r.authorName}
                                </span>
                                <span className="text-[var(--wy-text-faint)]">
                                  · {new Date(r.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-[var(--wy-text)]">
                                {r.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Textarea
                          aria-label="Reply"
                          className="min-h-14 flex-1"
                          value={replyDrafts[t.id] ?? ""}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          placeholder="Write a reply…"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              sendReply(t.id);
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          aria-label="Send reply"
                          className="h-10 w-10 shrink-0"
                          onClick={() => sendReply(t.id)}
                          disabled={sendingReply[t.id] || !(replyDrafts[t.id] ?? "").trim()}
                        >
                          {sendingReply[t.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="wy-console sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise a ticket</DialogTitle>
          </DialogHeader>
          <FormSection variant="plain" className="py-1">
            <FormField
              label={
                <>
                  Location <span className="text-[var(--wy-crit)]">*</span>
                </>
              }
              htmlFor="ticket-location"
              error={errs.businessUnit}
              wide
            >
              <select
                id="ticket-location"
                value={form.businessUnit}
                onChange={(e) => setForm({ ...form, businessUnit: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Choose location</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={
                <>
                  Subject <span className="text-[var(--wy-crit)]">*</span>
                </>
              }
              htmlFor="ticket-subject"
              error={errs.subject}
              wide
            >
              <Input
                id="ticket-subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary of the issue"
              />
            </FormField>
            <FormField
              label={
                <>
                  Category <span className="text-[var(--wy-crit)]">*</span>
                </>
              }
              htmlFor="ticket-category"
              error={errs.category}
            >
              <select
                id="ticket-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Choose category</option>
                {demo
                  ? Object.values(CATEGORY_LABEL).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  : CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
              </select>
            </FormField>
            <FormField label="Priority" htmlFor="ticket-priority">
              <select
                id="ticket-priority"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
                className={SELECT_CLS}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={<>Description {!demo && <span className="text-[var(--wy-crit)]">*</span>}</>}
              htmlFor="ticket-description"
              error={errs.description}
              wide
            >
              <Textarea
                id="ticket-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Add any extra detail that will help support triage this."
              />
            </FormField>
          </FormSection>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Raise Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
