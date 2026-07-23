import { useState, useMemo, useRef, useCallback } from "react";
import {
  HelpCircle, X, Plus, ChevronDown, Search, Pencil, Copy, Trash2,
  ChevronLeft, ChevronRight, Loader2, User, Network,
} from "lucide-react";

const STEPS = [
  { num: 1, label: "Create group", icon: Plus, caption: "" },
  { num: 2, label: "Map group", icon: Network, caption: "Not started" },
  { num: 3, label: "Map users", icon: User, caption: "Not started" },
];
const BANDWIDTH = ["Unlimited", "512 Kbps", "1 Mbps", "2 Mbps", "5 Mbps", "10 Mbps"];
const SESSION_TIMEOUT = ["30 min", "1 hr", "2 hr", "4 hr", "8 hr", "24 hr"];
const IDLE_TIMEOUT = ["No Limit", "5 min", "10 min", "15 min", "30 min", "1 hr"];
const DEVICES = ["Unlimited", "1", "2", "3", "4", "5"];
const DAILY_LIMIT = ["No Limit", "1 hr", "2 hr", "4 hr", "8 hr"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATA_UNITS = ["MB", "GB"];
const RESETS = ["Per session", "Daily", "Weekly", "Monthly"];
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

interface Group {
  id: string;
  name: string;
  bandwidth: string;
  sessionTimeout: string;
  idleTimeout: string;
  devicesPerUser: string;
  dailyLimit: string;
  loginHours: { days: string[]; from: string; to: string } | null;
  dataLimit: { quota: number; unit: string; resets: string } | null;
  members: number;
}

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label="Help" onClick={() => setOpen((p) => !p)} onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget)) close(); }} className="inline-flex items-center justify-center rounded text-slate-300 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500">
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div ref={ref} role="tooltip" tabIndex={-1} onKeyDown={(e) => { if (e.key === "Escape") close(); }} className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-800">
          <p>{text}</p>
          <button onClick={close} aria-label="Close" className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white"><X className="h-3 w-3" /></button>
        </div>
      )}
    </span>
  );
}

function Select({ id, label, value, onChange, options, placeholder, required, tooltip, err }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; required?: boolean; tooltip?: string; err?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}{required && <span className="text-orange-500">*</span>}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {err && <p className="mt-0.5 text-xs text-orange-500">{err}</p>}
    </div>
  );
}

export default function CreateGroup() {
  const [groups, setGroups] = useState<Group[]>([
    { id: "g1", name: "VIP Guests", bandwidth: "10 Mbps", sessionTimeout: "24 hr", idleTimeout: "30 min", devicesPerUser: "5", dailyLimit: "No Limit", loginHours: null, dataLimit: { quota: 10, unit: "GB", resets: "Monthly" }, members: 12 },
    { id: "g2", name: "Staff Network", bandwidth: "5 Mbps", sessionTimeout: "8 hr", idleTimeout: "15 min", devicesPerUser: "3", dailyLimit: "No Limit", loginHours: { days: ["Mon","Tue","Wed","Thu","Fri"], from: "09:00", to: "18:00" }, dataLimit: null, members: 8 },
    { id: "g3", name: "Contractors", bandwidth: "2 Mbps", sessionTimeout: "4 hr", idleTimeout: "10 min", devicesPerUser: "2", dailyLimit: "2 hr", loginHours: null, dataLimit: null, members: 5 },
  ]);

  const [name, setName] = useState(""); const [bw, setBw] = useState(""); const [st, setSt] = useState("");
  const [it, setIt] = useState(""); const [dp, setDp] = useState(""); const [dl, setDl] = useState("No Limit");
  const [loginOn, setLoginOn] = useState(false);
  const [loginDays, setLoginDays] = useState<string[]>(["Mon","Tue","Wed","Thu","Fri","Mon","Tue","Wed","Thu","Fri"].slice(0,5));
  const [loginFrom, setLoginFrom] = useState("09:00"); const [loginTo, setLoginTo] = useState("18:00");
  const [dlOpen, setDlOpen] = useState(false); const [dlQuota, setDlQuota] = useState(""); const [dlUnit, setDlUnit] = useState("GB"); const [dlResets, setDlResets] = useState("Daily");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState(""); const [page, setPage] = useState(0); const [pageSize, setPageSize] = useState<number>(10);
  const [toast, setToast] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null); const confirmTimer = useRef<ReturnType<typeof setTimeout>>();
  const [step1Done, setStep1Done] = useState(false);

  const toggleDay = (d: string) => setLoginDays((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)));
  const setField = (k: string, v: string) => { if (k === "name") setName(v); else if (k === "bw") setBw(v); else if (k === "st") setSt(v); else if (k === "it") setIt(v); else if (k === "dp") setDp(v); else if (k === "dl") setDl(v); setErrs((p) => { const n = { ...p }; delete n[k]; return n; }); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name) e.name = "Required.";
    else if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) e.name = "A group with this name already exists.";
    if (!bw) e.bw = "Required."; if (!st) e.st = "Required."; if (!it) e.it = "Required."; if (!dp) e.dp = "Required.";
    if (st && it) {
      const toMin = (v: string) => { const n = parseInt(v); return v.includes("hr") ? n * 60 : v.includes("min") ? n : Infinity; };
      if (toMin(it) > toMin(st)) e.it = "Idle timeout can't be longer than the session timeout.";
    }
    if (loginOn) { if (loginDays.length === 0) e.loginDays = "Select at least one day."; if (loginFrom >= loginTo) e.loginTo = "End must be after start."; }
    if (dlOpen && (!dlQuota || parseFloat(dlQuota) <= 0)) e.dlQuota = "Must be greater than 0.";
    setErrs(e); return !Object.keys(e).length;
  };

  const handleCreate = () => {
    if (!validate()) return; setSaving(true);
    setTimeout(() => {
      const dataLimit = dlOpen ? { quota: parseFloat(dlQuota) || 0, unit: dlUnit, resets: dlResets } : null;
      const loginHours = loginOn ? { days: [...loginDays].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)), from: loginFrom, to: loginTo } : null;
      setGroups((prev) => [{ id: `g${Date.now()}`, name, bandwidth: bw, sessionTimeout: st, idleTimeout: it, devicesPerUser: dp, dailyLimit: dl, loginHours, dataLimit, members: 0 }, ...prev]);
      setSaving(false); setStep1Done(true); setPage(0);
      setName(""); setBw(""); setSt(""); setIt(""); setDp(""); setDl("No Limit"); setLoginOn(false); setLoginDays(["Mon","Tue","Wed","Thu","Fri"]); setLoginFrom("09:00"); setLoginTo("18:00"); setDlOpen(false); setDlQuota("");
      setToast("Group created.");
      setTimeout(() => setToast(null), 3500);
      // TODO: replace with API call
    }, 500);
  };

  const handleDelete = (id: string) => {
    if (confirmingId === id) {
      setGroups((prev) => prev.filter((g) => g.id !== id)); setConfirmingId(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    } else { setConfirmingId(id); if (confirmTimer.current) clearTimeout(confirmTimer.current); confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000); }
  };

  const handleClone = (g: Group) => {
    setName(`${g.name} (copy)`); setBw(g.bandwidth); setSt(g.sessionTimeout); setIt(g.idleTimeout); setDp(g.devicesPerUser); setDl(g.dailyLimit);
    if (g.loginHours) { setLoginOn(true); setLoginDays(g.loginHours.days); setLoginFrom(g.loginHours.from); setLoginTo(g.loginHours.to); } else { setLoginOn(false); }
    if (g.dataLimit) { setDlOpen(true); setDlQuota(String(g.dataLimit.quota)); setDlUnit(g.dataLimit.unit); setDlResets(g.dataLimit.resets); } else { setDlOpen(false); }
    document.getElementById("create-group-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase(); return groups.filter((g) => !q || g.name.toLowerCase().includes(q) || g.bandwidth.includes(q));
  }, [groups, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          <span>{toast}</span>
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Create Group</h1>

      <ol className="flex items-center gap-0" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.num} className="flex items-center flex-1" aria-current={s.num === 1 && !step1Done ? "step" : undefined}>
            <div className="flex flex-col items-center min-w-0">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${s.num === 1 ? (step1Done ? "bg-orange-500" : "bg-slate-900") : "bg-slate-100 dark:bg-slate-700"}`}>
                <s.icon className={`h-4 w-4 ${s.num === 1 ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
              </div>
              <p className={`mt-1 text-xs font-medium ${s.num === 1 ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>{s.label}</p>
              {s.caption && <p className="text-[10px] text-slate-400 dark:text-slate-500">{s.caption}</p>}
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${i === 0 && step1Done ? "bg-orange-500" : "bg-slate-200 dark:bg-slate-600"}`} />}
          </li>
        ))}
      </ol>

      <div id="create-group-form" className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Create Group</h2>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Groups set internet policies for specific users or teams. A group's settings override the location policy for its members.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="g-name" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Group Name <span className="text-orange-500">*</span></label>
            <input id="g-name" type="text" placeholder="e.g. Staff, Long-stay guests" value={name} onChange={(e) => setField("name", e.target.value)} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
            {errs.name && <p className="mt-0.5 text-xs text-orange-500">{errs.name}</p>}
          </div>
          <Select id="g-bw" label="Bandwidth" required tooltip="Maximum speed per device in this group." value={bw} onChange={(v) => setField("bw", v)} options={BANDWIDTH} placeholder="Choose bandwidth limit" err={errs.bw} />
          <Select id="g-st" label="Session Timeout" required tooltip="Forces re-authentication after this time." value={st} onChange={(v) => setField("st", v)} options={SESSION_TIMEOUT} placeholder="Choose session timeout" err={errs.st} />
          <Select id="g-it" label="Idle Timeout" required tooltip="Disconnect after no traffic this long." value={it} onChange={(v) => setField("it", v)} options={IDLE_TIMEOUT} placeholder="Choose idle timeout" err={errs.it} />
          <Select id="g-dp" label="Devices Per User" required tooltip="How many devices one person can connect at the same time." value={dp} onChange={(v) => setField("dp", v)} options={DEVICES} placeholder="Choose device limit" err={errs.dp} />
          <Select id="g-dl" label="Maximum Daily Session Limit" value={dl} onChange={(v) => setField("dl", v)} options={DAILY_LIMIT} placeholder="Choose limit" tooltip="Total session time per day." />
        </div>

        <div className="mt-5 flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-600">
          <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">Restrict login hours <Tooltip text="Limit when members can connect. Off means any time." /></span>
          <button role="switch" aria-checked={loginOn} onClick={() => setLoginOn((p) => !p)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${loginOn ? "bg-slate-900 dark:bg-white" : "bg-slate-200 dark:bg-slate-600"}`}>
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${loginOn ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">{loginOn ? "ON" : "OFF"}</p>

        {loginOn && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button key={d} onClick={() => toggleDay(d)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${loginDays.includes(d) ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"}`}>{d}</button>
              ))}
            </div>
            {errs.loginDays && <p className="text-xs text-orange-500">{errs.loginDays}</p>}
            <div className="flex gap-3">
              <div><label htmlFor="g-lf" className="mb-0.5 block text-xs text-slate-500">From</label><input id="g-lf" type="time" value={loginFrom} onChange={(e) => setLoginFrom(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /></div>
              <div><label htmlFor="g-lt" className="mb-0.5 block text-xs text-slate-500">To</label><input id="g-lt" type="time" value={loginTo} onChange={(e) => setLoginTo(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /></div>
            </div>
            {errs.loginTo && <p className="text-xs text-orange-500">{errs.loginTo}</p>}
            <p className="text-xs text-slate-400">Members can only get online during these hours.</p>
          </div>
        )}

        <button type="button" onClick={() => setDlOpen((p) => !p)} aria-expanded={dlOpen} aria-controls="dl-panel" className="mt-5 flex w-full items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:hover:bg-slate-700">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"><Plus className="h-4 w-4 text-orange-500" /> Add a data limit <span className="text-xs font-normal text-slate-400">(Optional)</span></span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dlOpen ? "rotate-180" : ""}`} />
        </button>

        {dlOpen && (
          <div id="dl-panel" className="mt-4 grid gap-4 md:grid-cols-3">
            <div><label htmlFor="g-dq" className="mb-1 block text-sm font-medium text-slate-600">Quota</label><input id="g-dq" type="number" min={0} step="any" placeholder="0" value={dlQuota} onChange={(e) => setDlQuota(e.target.value)} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />{errs.dlQuota && <p className="mt-0.5 text-xs text-orange-500">{errs.dlQuota}</p>}</div>
            <div><label htmlFor="g-du" className="mb-1 block text-sm font-medium text-slate-600">Unit</label><select id="g-du" value={dlUnit} onChange={(e) => setDlUnit(e.target.value)} className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{DATA_UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div><label htmlFor="g-dr" className="mb-1 block text-sm font-medium text-slate-600">Resets</label><select id="g-dr" value={dlResets} onChange={(e) => setDlResets(e.target.value)} className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{RESETS.map((r) => <option key={r}>{r}</option>)}</select></div>
          </div>
        )}

        <hr className="my-6 border-slate-100 dark:border-slate-600" />
        <div className="flex justify-center">
          <button onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Existing Groups</h3><p className="text-xs text-slate-400 dark:text-slate-500">Groups already set up for this account.</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-44 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /></div>
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-600">{PAGE_SIZE_OPTS.map((n) => (<button key={n} onClick={() => { setPageSize(n); setPage(0); }} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${pageSize === n ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}>{n}</button>))}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
              <th className="pb-2 pr-3">Group Name</th><th className="pb-2 pr-3">Bandwidth</th><th className="pb-2 pr-3">Timeout</th><th className="pb-2 pr-3">Idle</th><th className="pb-2 pr-3">Devices</th><th className="pb-2 pr-3">Login Hours</th><th className="pb-2 pr-3">Data Limit</th><th className="pb-2 pr-3">Members</th><th className="pb-2 text-right">Action</th>
            </tr></thead>
            <tbody>{paged.length === 0 ? (<tr><td colSpan={9} className="py-10 text-center text-sm text-slate-400">No groups yet. Create one above to give a set of users their own policy.</td></tr>) : paged.map((g) => (
              <tr key={g.id} className="border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300">
                <td className="py-2.5 pr-3 font-medium">{g.name}</td>
                <td className="py-2.5 pr-3">{g.bandwidth}</td>
                <td className="py-2.5 pr-3">{g.sessionTimeout}</td>
                <td className="py-2.5 pr-3">{g.idleTimeout}</td>
                <td className="py-2.5 pr-3">{g.devicesPerUser}</td>
                <td className="py-2.5 pr-3 text-xs">{g.loginHours ? `${g.loginHours.days.slice(0,3).join(", ")}${g.loginHours.days.length > 3 ? "…" : ""}, ${g.loginHours.from}–${g.loginHours.to}` : <span className="text-slate-300">Any time</span>}</td>
                <td className="py-2.5 pr-3 text-xs">{g.dataLimit ? `${g.dataLimit.quota} ${g.dataLimit.unit} / ${g.dataLimit.resets}` : <span className="text-slate-300">—</span>}</td>
                <td className="py-2.5 pr-3">{g.members}</td>
                <td className="py-2.5 text-right">
                  <button aria-label={`Edit ${g.name}`} className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"><Pencil className="h-4 w-4" /></button>
                  <button aria-label={`Clone ${g.name}`} onClick={() => handleClone(g)} className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"><Copy className="h-4 w-4" /></button>
                  <button aria-label={confirmingId === g.id ? "Confirm delete" : `Delete ${g.name}`} onClick={() => handleDelete(g.id)} className={`inline-flex items-center justify-center rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${confirmingId === g.id ? "bg-orange-500 text-white" : "text-slate-400 hover:text-red-500"}`}>
                    {confirmingId === g.id ? <span className="text-[11px] font-medium px-1">Confirm</span> : <Trash2 className="h-4 w-4" />}
                  </button>
                </td>
              </tr>
            ))}</tbody></table>
        </div>
        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronLeft className="h-4 w-4" /></button><button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronRight className="h-4 w-4" /></button></div>
          </div>
        )}
      </div>
    </div>
  );
}
