import { useState, useMemo, useRef, useCallback } from "react";
import {
  AlertTriangle, HelpCircle, Plus, ChevronDown, Search, Pencil, Trash2,
  ChevronLeft, ChevronRight, Loader2, X,
} from "lucide-react";

// ── constants ───────────────────────────────────────────────────
const TABS = [
  "Location Policies", "Top Up Data", "Business Hours", "Notification",
  "Background Image", "Logo Image", "Manage Alerts", "ISP Details",
];
const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const BANDWIDTH = ["Unlimited", "512 Kbps", "1 Mbps", "2 Mbps", "5 Mbps", "10 Mbps"];
const SESSION_TIMEOUT = ["30 min", "1 hr", "2 hr", "4 hr", "8 hr", "24 hr"];
const DAILY_LIMIT = ["No Limit", "1 hr", "2 hr", "4 hr", "8 hr"];
const IDLE_TIMEOUT = ["No Limit", "5 min", "10 min", "15 min", "30 min", "1 hr"];
const DEVICES = ["Unlimited", "1", "2", "3", "4", "5"];
const DATA_UNITS = ["MB", "GB"];
const RESETS = ["Per session", "Daily", "Weekly", "Monthly"];
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

interface Policy {
  id: string;
  businessUnit: string;
  bandwidth: string;
  sessionTimeout: string;
  dailyLimit: string;
  idleTimeout: string;
  devicesPerUser: string;
  dataLimit: { quota: number; unit: string; resets: string } | null;
}
type PolicyForm = Omit<Policy, "id">;

const SEED: Policy[] = [
  { id: "p1", businessUnit: "Marina Bay Hotel", bandwidth: "5 Mbps", sessionTimeout: "4 hr", dailyLimit: "No Limit", idleTimeout: "15 min", devicesPerUser: "3", dataLimit: { quota: 5, unit: "GB", resets: "Daily" } },
  { id: "p2", businessUnit: "Downtown CoWork", bandwidth: "2 Mbps", sessionTimeout: "24 hr", dailyLimit: "2 hr", idleTimeout: "30 min", devicesPerUser: "Unlimited", dataLimit: null },
  { id: "p3", businessUnit: "Eastside Cafe", bandwidth: "512 Kbps", sessionTimeout: "1 hr", dailyLimit: "1 hr", idleTimeout: "10 min", devicesPerUser: "2", dataLimit: { quota: 1, unit: "GB", resets: "Weekly" } },
];

// ── Tooltip popover ──────────────────────────────────────────────
function Tooltip({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Help for ${id}`}
        onClick={() => setOpen((p) => !p)}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget)) close(); }}
        className="inline-flex items-center justify-center rounded text-slate-300 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          ref={ref}
          role="tooltip"
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === "Escape") close(); }}
          className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-800"
        >
          <p>{text}</p>
          <button onClick={close} aria-label="Close tooltip" className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white dark:bg-slate-300 dark:text-slate-800"><X className="h-3 w-3" /></button>
        </div>
      )}
    </span>
  );
}

// ── Select helper ────────────────────────────────────────────────
function Select({ id, label, value, onChange, options, placeholder, required, tooltip, err }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; required?: boolean; tooltip?: string; err?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}{required && <span className="text-orange-500">*</span>}
        {tooltip && <Tooltip id={id} text={tooltip} />}
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

// ── component ────────────────────────────────────────────────────
interface Props { onNavigate?: (key: string) => void; }

export default function LocationPolicies({ onNavigate }: Props) {
  // ── state ─────────────────────────────────────────────────────
  const [f, setF] = useState<PolicyForm>({
    businessUnit: "", bandwidth: "", sessionTimeout: "", dailyLimit: "No Limit",
    idleTimeout: "", devicesPerUser: "", dataLimit: null,
  });
  const [errs, setErrs] = useState<Partial<Record<keyof PolicyForm, string>>>({});
  const [dataLimitOpen, setDataLimitOpen] = useState(false);
  const [dlQuota, setDlQuota] = useState("");
  const [dlUnit, setDlUnit] = useState("GB");
  const [dlResets, setDlResets] = useState("Daily");
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>(SEED);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── derived ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return policies.filter((p) =>
      !q || Object.values(p).some((v) =>
        typeof v === "string" ? v.toLowerCase().includes(q) : v && typeof v === "object" && "resets" in v
      )
    );
  }, [policies, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const setField = (k: keyof PolicyForm, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  // ── validate ───────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errs = {};
    if (!f.businessUnit) e.businessUnit = "Required.";
    if (!f.bandwidth) e.bandwidth = "Required.";
    if (!f.sessionTimeout) e.sessionTimeout = "Required.";
    if (!f.idleTimeout) e.idleTimeout = "Required.";
    if (!f.devicesPerUser) e.devicesPerUser = "Required.";

    if (f.sessionTimeout && f.idleTimeout) {
      const toMin = (v: string) => { const n = parseInt(v); return v.includes("hr") ? n * 60 : v.includes("min") ? n : Infinity; };
      if (toMin(f.idleTimeout) > toMin(f.sessionTimeout)) e.idleTimeout = "Idle timeout can't be longer than the session timeout.";
    }

    if (dataLimitOpen && (!dlQuota || parseFloat(dlQuota) <= 0)) {
      if (!errs.idleTimeout) e.dataLimit = "Quota must be greater than 0.";
    }
    setErrs(e);
    return !Object.keys(e).length;
  };

  // ── save ──────────────────────────────────────────────────────
  const handleSave = () => {
    if (!validate()) return;
    setSaving(true);
    // TODO: replace with API call
    setTimeout(() => {
      const dataLimit = dataLimitOpen ? { quota: parseFloat(dlQuota) || 0, unit: dlUnit, resets: dlResets } : null;
      const existing = policies.findIndex((p) => p.businessUnit === f.businessUnit);
      if (existing >= 0) {
        setPolicies((prev) => prev.map((p, i) => i === existing ? { ...p, ...f, dataLimit } : p));
      } else {
        setPolicies((prev) => [{ id: `p${Date.now()}`, ...f, dataLimit }, ...prev]);
      }
      setSaving(false);
      setToast("Policies updated.");
      setTimeout(() => setToast(null), 2500);
    }, 600);
  };

  // ── delete ────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    if (confirming === id) {
      // TODO: replace with API call
      setPolicies((prev) => prev.filter((p) => p.id !== id));
      setConfirming(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    } else {
      setConfirming(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(null), 3000);
    }
  };

  // ── helpers ───────────────────────────────────────────────────
  const showToast = toast;
  const Err = ({ k }: { k: keyof PolicyForm }) => errs[k] ? <p className="mt-0.5 text-xs text-orange-500">{errs[k]}</p> : null;

  return (
    <div className="space-y-6">
      {/* toast */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          {showToast}
        </div>
      )}

      {/* title */}
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Location Policies</h1>

      {/* tab bar */}
      <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
        <div className="flex min-w-[700px]">
          {TABS.map((label) => {
            const active = label === "Location Policies";
            return (
              <button
                key={label}
                onClick={() => onNavigate?.(label)}
                aria-current={active ? "page" : undefined}
                className={`flex-1 border-r border-slate-200 px-3 py-2.5 text-center text-sm font-medium transition-colors last:border-r-0 dark:border-slate-600 ${
                  active
                    ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-slate-50 text-slate-600 hover:bg-white dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* warning banner */}
      <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          These settings apply to every guest at this location the moment you save. Check the impact before updating,
          or contact <a href="mailto:support@bhaifi.com" className="font-medium text-orange-600 underline dark:text-orange-400">support@bhaifi.com</a> for help.
        </p>
      </div>

      {/* form card */}
      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <h2 className="mb-5 text-lg font-semibold text-slate-800 dark:text-slate-100">Location Policies</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Select id="bu" label="Business Unit" required value={f.businessUnit} onChange={(v) => setField("businessUnit", v)} options={UNITS} placeholder="Choose Business Unit" err={errs.businessUnit} />
          <Select id="bw" label="Bandwidth" required value={f.bandwidth} onChange={(v) => setField("bandwidth", v)} options={BANDWIDTH} placeholder="Choose Bandwidth" tooltip="Maximum speed per guest device." err={errs.bandwidth} />
          <Select id="st" label="Session Timeout" required value={f.sessionTimeout} onChange={(v) => setField("sessionTimeout", v)} options={SESSION_TIMEOUT} placeholder="Choose Session Timeout" tooltip="Forces a guest to re-authenticate after this time." err={errs.sessionTimeout} />
          <Select id="dl" label="Maximum Daily Session Limit" value={f.dailyLimit} onChange={(v) => setField("dailyLimit", v)} options={DAILY_LIMIT} placeholder="Choose Limit" tooltip="Total session time allowed per guest per day." />
          <Select id="it" label="Idle Timeout" required value={f.idleTimeout} onChange={(v) => setField("idleTimeout", v)} options={IDLE_TIMEOUT} placeholder="Choose Idle Timeout" tooltip="Disconnects a guest after this much time with no traffic." err={errs.idleTimeout} />
          <Select id="dp" label="Devices Per User" required value={f.devicesPerUser} onChange={(v) => setField("devicesPerUser", v)} options={DEVICES} placeholder="Choose Devices" tooltip="How many devices the same guest can connect at once." err={errs.devicesPerUser} />
        </div>

        {/* collapsible data limit */}
        <button
          type="button"
          onClick={() => setDataLimitOpen((p) => !p)}
          aria-expanded={dataLimitOpen}
          aria-controls="data-limit-panel"
          className="mt-5 flex w-full items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Plus className="h-4 w-4 text-orange-500" /> Add a data limit <span className="text-xs font-normal text-slate-400">(Optional)</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dataLimitOpen ? "rotate-180" : ""}`} />
        </button>

        {dataLimitOpen && (
          <div id="data-limit-panel" className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="dl-quota" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Data quota</label>
              <input id="dl-quota" type="number" min={0} step="any" placeholder="0" value={dlQuota} onChange={(e) => setDlQuota(e.target.value)} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
              {errs.dataLimit && <p className="mt-0.5 text-xs text-orange-500">{errs.dataLimit}</p>}
            </div>
            <div>
              <label htmlFor="dl-unit" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Unit</label>
              <select id="dl-unit" value={dlUnit} onChange={(e) => setDlUnit(e.target.value)} className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{DATA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div>
              <label htmlFor="dl-resets" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Resets</label>
              <select id="dl-resets" value={dlResets} onChange={(e) => setDlResets(e.target.value)} className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{RESETS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            </div>
          </div>
        )}

        <hr className="my-6 border-slate-100 dark:border-slate-600" />
        <div className="flex justify-center">
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Updating…" : "Update policies"}
          </button>
        </div>
      </div>

      {/* table card */}
      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Current Location Policies</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">The policies currently active for the selected space.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-44 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-600">
              {PAGE_SIZE_OPTS.map((n) => (
                <button key={n} onClick={() => { setPageSize(n); setPage(0); }} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${pageSize === n ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
                <th className="pb-2 pr-3">Business Unit</th>
                <th className="pb-2 pr-3">Bandwidth</th>
                <th className="pb-2 pr-3">Session Timeout</th>
                <th className="pb-2 pr-3">Idle Timeout</th>
                <th className="pb-2 pr-3">Daily Limit</th>
                <th className="pb-2 pr-3">Devices</th>
                <th className="pb-2 pr-3">Data Limit</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">No policies set for this location yet. Fill the form above to create the first one.</td></tr>
              ) : (
                paged.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300">
                    <td className="py-2.5 pr-3 font-medium">{p.businessUnit}</td>
                    <td className="py-2.5 pr-3">{p.bandwidth}</td>
                    <td className="py-2.5 pr-3">{p.sessionTimeout}</td>
                    <td className="py-2.5 pr-3">{p.idleTimeout}</td>
                    <td className="py-2.5 pr-3">{p.dailyLimit}</td>
                    <td className="py-2.5 pr-3">{p.devicesPerUser}</td>
                    <td className="py-2.5 pr-3 text-xs">{p.dataLimit ? `${p.dataLimit.quota} ${p.dataLimit.unit} / ${p.dataLimit.resets}` : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                    <td className="py-2.5 text-right">
                      <button aria-label={`Edit ${p.businessUnit}`} className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:hover:text-slate-200"><Pencil className="h-4 w-4" /></button>
                      <button
                        aria-label={confirming === p.id ? "Confirm delete" : `Delete ${p.businessUnit}`}
                        onClick={() => handleDelete(p.id)}
                        className={`inline-flex items-center justify-center rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${confirming === p.id ? "bg-orange-500 text-white" : "text-slate-400 hover:text-red-500 dark:hover:text-red-400"}`}
                      >
                        {confirming === p.id ? <span className="text-[11px] font-medium px-1">Confirm</span> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
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
