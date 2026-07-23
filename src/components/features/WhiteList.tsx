import { useState, useMemo } from "react";
import { Smartphone, Laptop, Calendar, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

// ── helpers ─────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDT = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRIES = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+971", label: "🇦🇪 +971" },
];
const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];

type Tab = "number" | "device";
interface Entry {
  id: string;
  tab: Tab;
  identifier: string;        // mobile number (number tab) or MAC (device tab)
  name: string;
  email: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
}
type FormData = {
  mobileCC: string;
  mobile: string;
  mac: string;
  name: string;
  email: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
};
type Errors = Partial<Record<keyof FormData, string>>;

const SEED: Entry[] = [
  { id: "s1", tab: "number", identifier: "9876543210", name: "Ravi Sharma", email: "ravi@example.com", businessUnit: "Marina Bay Hotel", startDate: new Date(Date.now() - 86400000).toISOString().slice(0, 16), endDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16) },
  { id: "s2", tab: "number", identifier: "8765432109", name: "Priya Kapoor", email: "priya@example.com", businessUnit: "Downtown CoWork", startDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 16), endDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16) },
  { id: "s3", tab: "device", identifier: "AA:BB:CC:DD:EE:FF", name: "Office Printer", email: "it@example.com", businessUnit: "Airport Lounge T3", startDate: new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 16), endDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 16) },
];

const PAGE_SIZE = 5;

export default function WhiteList() {
  const [tab, setTab] = useState<Tab>("number");
  const [entries, setEntries] = useState<Entry[]>(SEED);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [f, setF] = useState<FormData>({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: UNITS[0], startDate: "", endDate: "" });
  const [errs, setErrs] = useState<Errors>({});
  const [toast, setToast] = useState<string | null>(null);

  // ── filtered + paginated ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => e.tab === tab && (!q || e.name.toLowerCase().includes(q) || e.identifier.toLowerCase().includes(q) || e.businessUnit.toLowerCase().includes(q)) );
  }, [entries, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // ── validators ────────────────────────────────────────────────
  const validate = (): Errors => {
    const e: Errors = {};
    if (tab === "number") {
      if (!f.mobile || f.mobile.length !== 10 || !/^\d{10}$/.test(f.mobile)) e.mobile = "Mobile must be exactly 10 digits.";
    } else {
      if (!f.mac || !MAC_RE.test(f.mac)) e.mac = "MAC must match AA:BB:CC:DD:EE:FF";
    }
    if (!f.name) e.name = "Name is required.";
    if (!f.email || !EMAIL_RE.test(f.email)) e.email = "Enter a valid email address.";
    if (!f.startDate) e.startDate = "Start date is required.";
    if (!f.endDate) e.endDate = "End date is required.";
    if (f.startDate && f.endDate && new Date(f.endDate) <= new Date(f.startDate)) e.endDate = "End date must be after the start date.";
    return e;
  };

  const setField = (k: keyof FormData, v: string) => { setF(p => ({ ...p, [k]: v })); setErrs(p => { const n = { ...p }; delete n[k]; return n; }); };

  // ── submit ────────────────────────────────────────────────────
  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = validate();
    setErrs(v);
    if (Object.keys(v).length) return;

    // TODO: replace with API call
    const entry: Entry = {
      id: `e${Date.now()}`,
      tab,
      identifier: tab === "number" ? f.mobile : f.mac.toUpperCase(),
      name: f.name,
      email: f.email,
      businessUnit: f.businessUnit,
      startDate: f.startDate,
      endDate: f.endDate,
    };
    setEntries(p => [entry, ...p]);
    setF({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: UNITS[0], startDate: "", endDate: "" });
    setPage(0);
    setToast(tab === "number" ? "Number allowed." : "Device allowed.");
    setTimeout(() => setToast(null), 2500);
  };

  const handleDelete = (id: string) => {
    // TODO: replace with API call
    setEntries(p => p.filter(e => e.id !== id));
  };

  // ── helpers ───────────────────────────────────────────────────
  const isActive = (end: string) => new Date(end) > new Date();
  const Err = ({ k }: { k: keyof FormData }) => errs[k] ? <p className="mt-0.5 text-xs text-orange-500">{errs[k]}</p> : null;

  return (
    <div className="space-y-6">
      {/* heading row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-1 shrink-0 flex-col gap-0.5">
            <span className="block h-1.5 w-full rounded-sm bg-orange-500" />
            <span className="block h-1.5 w-full rounded-sm bg-orange-500" />
            <span className="block h-1.5 w-full rounded-sm bg-orange-500" />
          </span>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">WhiteList</h1>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          YOU ARE HERE : <span className="text-orange-500">BhaiFi</span> / WhiteList
        </p>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      )}

      {/* tab switcher */}
      <div className="w-fit rounded-lg bg-white p-0.5 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600 max-sm:w-full">
        <button onClick={() => { setTab("number"); setErrs({}); setPage(0); } } className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors max-sm:w-1/2 max-sm:justify-center ${tab === "number" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"}`}>
          <Smartphone className="h-4 w-4" /> WhiteList Number
        </button>
        <button onClick={() => { setTab("device"); setErrs({}); setPage(0); } } className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors max-sm:w-1/2 max-sm:justify-center ${tab === "device" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"}`}>
          <Laptop className="h-4 w-4" /> WhiteList Device
        </button>
      </div>

      {/* form card */}
      <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600">
        <h2 className="mb-5 text-lg font-semibold text-slate-800 dark:text-slate-100">{tab === "number" ? "WhiteList Number" : "WhiteList Device"}</h2>

        <div className="space-y-4">
          {/* Mobile / MAC */}
          {tab === "number" ? (
            <div className="sm:flex sm:items-start">
              <label className="mb-1 block w-48 shrink-0 pt-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300 sm:mb-0 sm:pr-4 max-sm:text-left">
                Mobile Number <span className="text-orange-500">*</span>
              </label>
              <div className="flex-1">
                <div className="flex gap-2">
                  <select value={f.mobileCC} onChange={e => setField("mobileCC", e.target.value)} className="w-28 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <input type="text" inputMode="numeric" maxLength={10} placeholder="Mobile Number" value={f.mobile} onChange={e => setField("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
                </div>
                <Err k="mobile" />
              </div>
            </div>
          ) : (
            <div className="sm:flex sm:items-start">
              <label className="mb-1 block w-48 shrink-0 pt-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300 sm:mb-0 sm:pr-4 max-sm:text-left">
                MAC Address <span className="text-orange-500">*</span>
              </label>
              <div className="flex-1">
                <input type="text" placeholder="AA:BB:CC:DD:EE:FF" value={f.mac} onChange={e => setField("mac", e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").replace(/(.{2})(?!$)/g, "$1:").slice(0, 17))} className="block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
                <Err k="mac" />
              </div>
            </div>
          )}

          {/* Business Unit */}
          <div className="sm:flex sm:items-start">
            <label className="mb-1 block w-48 shrink-0 pt-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300 sm:mb-0 sm:pr-4 max-sm:text-left">
              Business Unit <span className="text-orange-500">*</span>
            </label>
            <div className="flex-1">
              <select value={f.businessUnit} onChange={e => setField("businessUnit", e.target.value)} className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Name */}
          <div className="sm:flex sm:items-start">
            <label className="mb-1 block w-48 shrink-0 pt-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300 sm:mb-0 sm:pr-4 max-sm:text-left">
              Name <span className="text-orange-500">*</span>
            </label>
            <div className="flex-1">
              <input type="text" placeholder={tab === "number" ? "Name" : "Device label"} value={f.name} onChange={e => setField("name", e.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
              <Err k="name" />
            </div>
          </div>

          {/* Email */}
          <div className="sm:flex sm:items-start">
            <label className="mb-1 block w-48 shrink-0 pt-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300 sm:mb-0 sm:pr-4 max-sm:text-left">
              Email-ID <span className="text-orange-500">*</span>
            </label>
            <div className="flex-1">
              <input type="email" placeholder="Email-ID" value={f.email} onChange={e => setField("email", e.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
              <Err k="email" />
            </div>
          </div>

          {/* Start Date */}
          <div className="sm:flex sm:items-start">
            <label className="mb-1 block w-48 shrink-0 pt-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300 sm:mb-0 sm:pr-4 max-sm:text-left">
              Start Date <span className="text-orange-500">*</span>
            </label>
            <div className="flex-1">
              <div className="relative">
                <input type="datetime-local" value={f.startDate} onChange={e => setField("startDate", e.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <Err k="startDate" />
            </div>
          </div>

          {/* End Date */}
          <div className="sm:flex sm:items-start">
            <label className="mb-1 block w-48 shrink-0 pt-2 text-right text-sm font-medium text-slate-600 dark:text-slate-300 sm:mb-0 sm:pr-4 max-sm:text-left">
              End Date <span className="text-orange-500">*</span>
            </label>
            <div className="flex-1">
              <div className="relative">
                <input type="datetime-local" value={f.endDate} onChange={e => setField("endDate", e.target.value)} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <Err k="endDate" />
            </div>
          </div>
        </div>

        <hr className="my-5 border-slate-200 dark:border-slate-600" />
        <div className="flex justify-center">
          <button type="submit" className="rounded-md bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            {tab === "number" ? "Allow Number" : "Allow Device"}
          </button>
        </div>
      </form>

      {/* table card */}
      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600">
        {/* header row */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Current WhiteListed {tab === "number" ? "Users" : "Devices"}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">This lists out all the whitelisted {tab === "number" ? "users." : "devices."}</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-48 rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">{tab === "number" ? "Mobile Number" : "MAC Address"}</th>
                <th className="pb-2 pr-3">Business Unit</th>
                <th className="pb-2 pr-3">Start Date</th>
                <th className="pb-2 pr-3">End Date</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    Nothing whitelisted yet. Fill the form above to add the first one.
                  </td>
                </tr>
              ) : (
                paged.map(e => (
                  <tr key={e.id} className="border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300">
                    <td className="py-2.5 pr-3 font-medium">{e.name}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{e.identifier}</td>
                    <td className="py-2.5 pr-3">{e.businessUnit}</td>
                    <td className="py-2.5 pr-3 text-xs">{fmtDT(e.startDate)}</td>
                    <td className="py-2.5 pr-3 text-xs">{fmtDT(e.endDate)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${isActive(e.endDate) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"}`}>
                        {isActive(e.endDate) ? "Active" : "Expired"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button aria-label={`Edit ${e.name}`} className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:hover:text-slate-200"><Pencil className="h-4 w-4" /></button>
                      <button aria-label={`Delete ${e.name}`} onClick={() => handleDelete(e.id)} className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-orange-500"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
