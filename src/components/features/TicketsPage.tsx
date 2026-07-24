import { useEffect, useMemo, useState } from "react";
import { LifeBuoy, Plus, MessageSquare, CheckCircle2, X, Loader2, Send, ShieldCheck, User, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { ticketService, resolveOrgId } from "@/services/ticket.service";
import { useSupportTicketsSocket } from "@/hooks/useSupportTicketRealtime";
import type { SupportTicket, TicketPriority, TicketReply } from "@/types/support-ticket";

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];
const CATEGORIES = ["network", "billing", "feature_request", "device_support", "other"];
const CATEGORY_LABEL: Record<string, string> = {
  network: "Network Issue", billing: "Billing", feature_request: "Feature Request",
  device_support: "Device Support", other: "Other",
};
const PRIORITY_LABEL: Record<TicketPriority, string> = { low: "Low", medium: "Normal", high: "High", urgent: "Urgent" };

interface DemoTicket {
  id: string; subject: string; businessUnit: string; category: string; priority: string;
  status: "open" | "in-progress" | "resolved"; createdAt: string; description: string;
}

const SEED: DemoTicket[] = [
  { id: "T-1042", subject: "Guest WiFi dropping every 20 minutes", businessUnit: "Marina Bay Hotel", category: "Network Issue", priority: "High", status: "in-progress", createdAt: "2026-07-20", description: "Multiple guests reporting disconnects." },
  { id: "T-1038", subject: "Need extra vouchers for weekend event", businessUnit: "Downtown CoWork", category: "Feature Request", priority: "Normal", status: "resolved", createdAt: "2026-07-15", description: "Requesting 200 additional 1-day vouchers." },
  { id: "T-1031", subject: "Invoice mismatch for June", businessUnit: "Eastside Cafe", category: "Billing", priority: "Low", status: "resolved", createdAt: "2026-07-05", description: "June invoice shows wrong plan tier." },
];

const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  "in-progress": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  closed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export default function TicketsPage({ locationId }: { locationId?: string } = {}) {
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
  const [form, setForm] = useState({ businessUnit: "", subject: "", category: "", priority: "medium" as TicketPriority, description: "" });
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
  useSupportTicketsSocket(orgId, (msg) => {
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
  }, { enabled: !demo && !!orgId });

  useEffect(() => {
    if (!demo && !form.businessUnit && locationId && locations) {
      const match = locations.find((l) => l.id === locationId);
      if (match) setForm((f) => ({ ...f, businessUnit: match.name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locations, locationId]);

  const filteredDemo = useMemo(() => tickets.filter((t) => !filterUnit || t.businessUnit === filterUnit), [tickets, filterUnit]);
  const countForUnitDemo = (unit: string) => tickets.filter((t) => t.businessUnit === unit).length;

  const filteredReal = useMemo(
    () => realTickets.filter((t) => {
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
    setErrs(e);
    if (Object.keys(e).length) return;

    if (demo) {
      setTickets((t) => [{ id: `T-${1000 + t.length + 50}`, subject: form.subject, businessUnit: form.businessUnit, category: CATEGORY_LABEL[form.category] ?? form.category, priority: PRIORITY_LABEL[form.priority], status: "open", createdAt: new Date().toISOString().slice(0, 10), description: form.description }, ...t]);
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
      await ticketService.update(id, { status: "resolved" });
      toast.success("Marked resolved");
      refetch();
    } catch {
      toast.error("Could not update the ticket.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><LifeBuoy className="h-6 w-6 text-primary" /> Support Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Raise an issue for any of your locations and track its progress.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"><Plus className="h-4 w-4" />Raise Ticket</button>
      </div>

      {/* Per-location summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {units.map((u) => (
          <button key={u} onClick={() => setFilterUnit(filterUnit === u ? "" : u)} className={cn("rounded-2xl border p-4 text-left shadow-sm transition-colors", filterUnit === u ? "border-primary bg-primary/5" : "bg-card hover:bg-accent/50")}>
            <p className="truncate text-sm font-medium text-foreground">{u}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{demo ? countForUnitDemo(u) : countForUnitReal(u)}</p>
            <p className="text-xs text-muted-foreground">tickets raised</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{filterUnit ? `Tickets · ${filterUnit}` : "All Tickets"}</h3>
          {filterUnit && <button onClick={() => setFilterUnit("")} className="text-xs font-medium text-primary hover:underline">Clear filter</button>}
        </div>

        {!demo && loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…</div>
        ) : demo ? (
          filteredDemo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground"><MessageSquare className="mb-3 h-8 w-8 opacity-40" /><p className="text-sm">No tickets for this location yet.</p></div>
          ) : (
            <div className="space-y-3">
              {filteredDemo.map((t) => (
                <div key={t.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[t.status])}>{t.status.replace("-", " ")}</span>
                        {t.priority === "Urgent" || t.priority === "High" ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{t.priority}</span> : null}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{t.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.businessUnit} · {t.category} · {t.createdAt}</p>
                      {t.description && <p className="mt-1.5 text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                    {t.status !== "resolved" && (
                      <button onClick={() => markResolved(t.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Mark resolved</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredReal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground"><MessageSquare className="mb-3 h-8 w-8 opacity-40" /><p className="text-sm">No tickets for this location yet.</p></div>
        ) : (
          <div className="space-y-3">
            {filteredReal.map((t) => {
              const locName = locations?.find((l) => l.id === t.locationId)?.name ?? "All locations";
              return (
                <div key={t.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[t.status])}>{t.status.replace("_", " ")}</span>
                        {(t.priority === "urgent" || t.priority === "high") && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{PRIORITY_LABEL[t.priority]}</span>}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{t.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{locName} · {t.category ? (CATEGORY_LABEL[t.category] ?? t.category) : "—"} · {new Date(t.createdAt).toLocaleDateString()}</p>
                      {t.description && <p className="mt-1.5 text-xs text-muted-foreground">{t.description}</p>}
                      {t.resolutionNotes && <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">Resolution: {t.resolutionNotes}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {t.status !== "resolved" && t.status !== "closed" && (
                        <button onClick={() => markResolved(t.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Mark resolved</button>
                      )}
                      <button onClick={() => toggleThread(t.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {(repliesByTicket[t.id]?.length ?? 0) > 0 ? `Replies (${repliesByTicket[t.id]!.length})` : "Replies"}
                        {expandedTicketId === t.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {expandedTicketId === t.id && (
                    <div className="mt-3 border-t pt-3">
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
                        {repliesLoading[t.id] ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading replies…</div>
                        ) : (repliesByTicket[t.id]?.length ?? 0) === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">No replies yet.</p>
                        ) : (
                          repliesByTicket[t.id]!.map((r) => (
                            <div key={r.id} className={cn("rounded-lg border p-2.5 text-sm", r.isStaffReply ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
                              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                {r.isStaffReply ? <ShieldCheck className="h-3 w-3 text-primary" /> : <User className="h-3 w-3" />}
                                <span>{r.isStaffReply ? `${r.authorName} · CloudGuest Support` : r.authorName}</span>
                                <span className="opacity-60">· {new Date(r.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-foreground">{r.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <textarea
                          className={cn(inputCls, "min-h-14 flex-1")}
                          value={replyDrafts[t.id] ?? ""}
                          onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Write a reply…"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              sendReply(t.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => sendReply(t.id)}
                          disabled={sendingReply[t.id] || !(replyDrafts[t.id] ?? "").trim()}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                        >
                          {sendingReply[t.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Raise a ticket</h3><button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Location <span className="text-destructive">*</span></label>
                <select value={form.businessUnit} onChange={(e) => setForm({ ...form, businessUnit: e.target.value })} className={inputCls}>
                  <option value="">Choose location</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                {errs.businessUnit && <p className="mt-1 text-xs text-destructive">{errs.businessUnit}</p>}
              </div>
              <div>
                <label className={labelCls}>Subject <span className="text-destructive">*</span></label>
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief summary of the issue" className={inputCls} />
                {errs.subject && <p className="mt-1 text-xs text-destructive">{errs.subject}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category <span className="text-destructive">*</span></label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                    <option value="">Choose category</option>
                    {demo
                      ? Object.values(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{c}</option>)
                      : CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                  {errs.category && <p className="mt-1 text-xs text-destructive">{errs.category}</p>}
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })} className={inputCls}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Add any extra detail that will help support triage this." className={inputCls} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Raise Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
