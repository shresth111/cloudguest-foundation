import { useState } from "react";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Mail, Smartphone, Eye, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

interface AlertContact {
  id: string;
  businessUnit: string;
  email: string;
  mobile: string;
  emailOnDown: boolean;
  smsOnDown: boolean;
  lastAlert: string | null;
  status: string;
}

const SEED: AlertContact[] = [
  { id: "a1", businessUnit: "Marina Bay Hotel", email: "admin@marinabay.com", mobile: "+919876543210", emailOnDown: true, smsOnDown: true, lastAlert: "2026-07-22T14:30:00", status: "active" },
  { id: "a2", businessUnit: "Downtown CoWork", email: "it@downtowncowork.com", mobile: "+919812345678", emailOnDown: true, smsOnDown: false, lastAlert: "2026-07-21T09:15:00", status: "active" },
  { id: "a3", businessUnit: "Eastside Cafe", email: "support@eastsidecafe.com", mobile: "+919900001111", emailOnDown: false, smsOnDown: true, lastAlert: null, status: "inactive" },
  { id: "a4", businessUnit: "Airport Lounge T3", email: "ops@airportlounge.com", mobile: "+919722233344", emailOnDown: true, smsOnDown: true, lastAlert: "2026-07-20T18:45:00", status: "active" },
];

export default function ManageAlerts() {
  const [contacts, setContacts] = useState<AlertContact[]>(SEED);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [showLocationAlerts, setShowLocationAlerts] = useState(false);
  const [form, setForm] = useState({ businessUnit: "", email: "", mobile: "", emailOnDown: true, smsOnDown: false });

  const filtered = contacts.filter(c => !search || c.businessUnit.toLowerCase().includes(search.toLowerCase()) || c.email.includes(search) || c.mobile.includes(search));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handleAdd = () => {
    if (!form.businessUnit || !form.email) { toast.error("Business Unit and Email are required"); return; }
    setSaving(true);
    setTimeout(() => {
      setContacts([{ id: `a${Date.now()}`, ...form, lastAlert: null, status: "active" }, ...contacts]);
      setForm({ businessUnit: "", email: "", mobile: "", emailOnDown: true, smsOnDown: false });
      setShowForm(false);
      setSaving(false);
      toast.success("Alert contact added");
    }, 400);
  };

  const toggleContact = (id: string, field: "emailOnDown" | "smsOnDown") => {
    // TODO: replace with API call
    setContacts(contacts.map(c => c.id === id ? { ...c, [field]: !c[field] } : c));
    toast.success("Alert preference updated");
  };

  const removeContact = (id: string) => {
    // TODO: replace with API call
    setContacts(contacts.filter(c => c.id !== id));
    toast.success("Contact removed");
  };

  const fmtDT = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ── Location-wide alerts view ─────────────────────────────────
  const allAlerts = [
    { loc: "Marina Bay Hotel", type: "Router GW-01 Down", at: "2026-07-22T14:30:00", status: "Resolved", severity: "high" },
    { loc: "Marina Bay Hotel", type: "ISP Tata Link Degraded", at: "2026-07-22T12:15:00", status: "Active", severity: "medium" },
    { loc: "Downtown CoWork", type: "Bandwidth Threshold 85%", at: "2026-07-21T09:15:00", status: "Resolved", severity: "warning" },
    { loc: "Eastside Cafe", type: "AP-Lobby Offline", at: "2026-07-20T18:45:00", status: "Active", severity: "critical" },
    { loc: "Airport Lounge T3", type: "DHCP Pool 90% Exhausted", at: "2026-07-20T10:00:00", status: "Active", severity: "warning" },
    { loc: "Downtown CoWork", type: "Router GW-03 Rebooted", at: "2026-07-19T22:30:00", status: "Resolved", severity: "info" },
  ];

  const SevBadge = ({ s }: { s: string }) => {
    const m: Record<string, string> = { critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", medium: "bg-amber-100 text-amber-700", warning: "bg-yellow-100 text-yellow-700", info: "bg-blue-100 text-blue-700" };
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${m[s] || "bg-slate-100 text-slate-500"}`}>{s}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Manage Alerts</h1><p className="text-sm text-slate-400">Configure who gets notified when devices go down.</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowLocationAlerts(!showLocationAlerts)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
            <Eye className="h-4 w-4" />{showLocationAlerts ? "Hide Alerts" : "View All Alerts"}
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"><Plus className="h-4 w-4" />Add Contact</button>
        </div>
      </div>

      {/* ── Add Contact Form Modal ─────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">New Alert Contact</h3>
            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block text-sm font-medium text-slate-600">Business Unit <span className="text-orange-500">*</span></label>
                <select value={form.businessUnit} onChange={e => setForm({ ...form, businessUnit: e.target.value })} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-slate-700 dark:text-slate-100">
                  <option value="">Select</option>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select></div>
              <div><label className="mb-1 block text-sm font-medium text-slate-600">Email ID <span className="text-orange-500">*</span></label>
                <input type="email" placeholder="email@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-slate-700 dark:text-slate-100" /></div>
              <div><label className="mb-1 block text-sm font-medium text-slate-600">Mobile No.</label>
                <input type="text" placeholder="+919876543210" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-slate-700 dark:text-slate-100" /></div>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.emailOnDown} onChange={e => setForm({ ...form, emailOnDown: e.target.checked })} className="rounded border-slate-300" /> Send email on down</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.smsOnDown} onChange={e => setForm({ ...form, smsOnDown: e.target.checked })} className="rounded border-slate-300" /> Send SMS on down</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? "Adding…" : "Add Contact"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── All Location Alerts Panel ──────────────────────────── */}
      {showLocationAlerts && (
        <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">All Location Alerts</h3>
          <p className="text-xs text-slate-400 mb-4">Recent alerts across all business units.</p>
          <div className="space-y-2">
            {allAlerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${a.severity === "critical" ? "bg-red-500" : a.severity === "high" ? "bg-orange-500" : a.severity === "medium" ? "bg-amber-500" : "bg-sky-500"}`} />
                  <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.type}</p><p className="text-xs text-slate-400">{a.loc} · {fmtDT(a.at)}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <SevBadge s={a.severity} />
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${a.status === "Active" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contact Table ──────────────────────────────────────── */}
      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Alert Contacts</h3><p className="text-xs text-slate-400">{contacts.length} contacts configured</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-44 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" /></div>
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5">{PAGE_SIZE_OPTS.map(n => (<button key={n} onClick={() => { setPageSize(n); setPage(0); }} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${pageSize === n ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{n}</button>))}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="pb-2 pr-3">Business Unit</th><th className="pb-2 pr-3">Email</th><th className="pb-2 pr-3">Mobile</th>
              <th className="pb-2 pr-3">Email on Down</th><th className="pb-2 pr-3">SMS on Down</th><th className="pb-2 pr-3">Last Alert</th><th className="pb-2 pr-3">Status</th><th className="pb-2 text-right">Action</th>
            </tr></thead>
            <tbody>{paged.length === 0 ? (<tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">No contacts. Add one above.</td></tr>) : paged.map(c => (
              <tr key={c.id} className="border-b border-slate-100 text-slate-700 last:border-0">
                <td className="py-2.5 pr-3 font-medium">{c.businessUnit}</td>
                <td className="py-2.5 pr-3 text-xs">{c.email}</td>
                <td className="py-2.5 pr-3 font-mono text-xs">{c.mobile}</td>
                <td className="py-2.5 pr-3">
                  <button onClick={() => toggleContact(c.id, "emailOnDown")} className="inline-flex items-center gap-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
                    {c.emailOnDown ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5 text-slate-300" />}
                    <span className={c.emailOnDown ? "text-emerald-600 font-medium" : "text-slate-400"}>Email</span>
                  </button>
                </td>
                <td className="py-2.5 pr-3">
                  <button onClick={() => toggleContact(c.id, "smsOnDown")} className="inline-flex items-center gap-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
                    {c.smsOnDown ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5 text-slate-300" />}
                    <span className={c.smsOnDown ? "text-emerald-600 font-medium" : "text-slate-400"}>SMS</span>
                  </button>
                </td>
                <td className="py-2.5 pr-3 text-xs text-slate-400">{fmtDT(c.lastAlert)}</td>
                <td className="py-2.5 pr-3"><span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.status}</span></td>
                <td className="py-2.5 text-right"><button aria-label="Remove contact" onClick={() => removeContact(c.id)} className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-orange-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {filtered.length > 0 && <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span><div className="flex gap-1"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronLeft className="h-4 w-4" /></button><button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronRight className="h-4 w-4" /></button></div></div>}
      </div>
    </div>
  );
}
