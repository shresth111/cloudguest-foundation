import { useMemo, useState } from "react";
import { LifeBuoy, Plus, MessageSquare, Clock, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const CATEGORIES = ["Network Issue", "Billing", "Feature Request", "Device Support", "Other"];

interface Ticket {
  id: string; subject: string; businessUnit: string; category: string; priority: string;
  status: "open" | "in-progress" | "resolved"; createdAt: string; description: string;
}

const SEED: Ticket[] = [
  { id: "T-1042", subject: "Guest WiFi dropping every 20 minutes", businessUnit: "Marina Bay Hotel", category: "Network Issue", priority: "High", status: "in-progress", createdAt: "2026-07-20", description: "Multiple guests reporting disconnects." },
  { id: "T-1038", subject: "Need extra vouchers for weekend event", businessUnit: "Downtown CoWork", category: "Feature Request", priority: "Normal", status: "resolved", createdAt: "2026-07-15", description: "Requesting 200 additional 1-day vouchers." },
  { id: "T-1031", subject: "Invoice mismatch for June", businessUnit: "Eastside Cafe", category: "Billing", priority: "Low", status: "resolved", createdAt: "2026-07-05", description: "June invoice shows wrong plan tier." },
];

const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

const STATUS_STYLE: Record<Ticket["status"], string> = {
  open: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  "in-progress": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>(SEED);
  const [open, setOpen] = useState(false);
  const [filterUnit, setFilterUnit] = useState("");
  const [form, setForm] = useState({ businessUnit: "", subject: "", category: "", priority: "Normal", description: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});

  const filtered = useMemo(() => tickets.filter((t) => !filterUnit || t.businessUnit === filterUnit), [tickets, filterUnit]);
  const countForUnit = (unit: string) => tickets.filter((t) => t.businessUnit === unit).length;

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.businessUnit) e.businessUnit = "Select a location.";
    if (!form.subject) e.subject = "Enter a subject.";
    if (!form.category) e.category = "Select a category.";
    setErrs(e); if (Object.keys(e).length) return;

    setTickets((t) => [{ id: `T-${1000 + t.length + 50}`, subject: form.subject, businessUnit: form.businessUnit, category: form.category, priority: form.priority, status: "open", createdAt: new Date().toISOString().slice(0, 10), description: form.description }, ...t]);
    setForm({ businessUnit: "", subject: "", category: "", priority: "Normal", description: "" });
    setOpen(false);
    toast.success("Ticket raised — support will get back to you shortly.");
  };

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
        {UNITS.map((u) => (
          <button key={u} onClick={() => setFilterUnit(filterUnit === u ? "" : u)} className={cn("rounded-2xl border p-4 text-left shadow-sm transition-colors", filterUnit === u ? "border-primary bg-primary/5" : "bg-card hover:bg-accent/50")}>
            <p className="truncate text-sm font-medium text-foreground">{u}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{countForUnit(u)}</p>
            <p className="text-xs text-muted-foreground">tickets raised</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{filterUnit ? `Tickets · ${filterUnit}` : "All Tickets"}</h3>
          {filterUnit && <button onClick={() => setFilterUnit("")} className="text-xs font-medium text-primary hover:underline">Clear filter</button>}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground"><MessageSquare className="mb-3 h-8 w-8 opacity-40" /><p className="text-sm">No tickets for this location yet.</p></div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
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
                    <button onClick={() => { setTickets((ts) => ts.map((x) => x.id === t.id ? { ...x, status: "resolved" } : x)); toast.success("Marked resolved"); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Mark resolved</button>
                  )}
                </div>
              </div>
            ))}
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
                  <option value="">Choose location</option>{UNITS.map((u) => <option key={u} value={u}>{u} ({countForUnit(u)} raised before)</option>)}
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
                    <option value="">Choose category</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errs.category && <p className="mt-1 text-xs text-destructive">{errs.category}</p>}
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Add any extra detail that will help support triage this." className={inputCls} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button><button onClick={submit} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Raise Ticket</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
