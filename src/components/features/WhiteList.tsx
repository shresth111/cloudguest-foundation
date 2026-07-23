import { useEffect, useState, useMemo } from "react";
import { Smartphone, Laptop, Calendar, Search, Pencil, Trash2, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import { organizationService } from "@/services/organization.service";
import type { AnyAccessRule } from "@/types/guest";

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

// Fixed (not Date.now()-relative) so the server-rendered HTML and the
// client's hydration pass always agree -- a relative computation baked
// into a module-level constant evaluates at two different wall-clock
// moments (server module load vs. client bundle load) and hydration-
// mismatches the instant those two moments land in different minutes.
const SEED: Entry[] = [
  { id: "s1", tab: "number", identifier: "9876543210", name: "Ravi Sharma", email: "ravi@example.com", businessUnit: "Marina Bay Hotel", startDate: "2026-07-22T10:00", endDate: "2026-07-26T10:00" },
  { id: "s2", tab: "number", identifier: "8765432109", name: "Priya Kapoor", email: "priya@example.com", businessUnit: "Downtown CoWork", startDate: "2026-07-21T09:00", endDate: "2026-07-30T09:00" },
  { id: "s3", tab: "device", identifier: "AA:BB:CC:DD:EE:FF", name: "Office Printer", email: "it@example.com", businessUnit: "Airport Lounge T3", startDate: "2026-06-23T08:00", endDate: "2026-07-21T08:00" },
];

const PAGE_SIZE = 5;
const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

function toEntry(r: AnyAccessRule): Entry {
  return {
    id: r.id,
    tab: r.kind === "device" ? "device" : "number",
    identifier: r.kind === "device" ? r.macAddress : r.identifier,
    name: r.reason ?? "—",
    email: "",
    businessUnit: "",
    startDate: r.createdAt.slice(0, 16),
    endDate: r.expiresAt ? r.expiresAt.slice(0, 16) : "",
  };
}

export default function WhiteList({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  const [tab, setTab] = useState<Tab>("number");
  const [entries, setEntries] = useState<Entry[]>(demo ? SEED : []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [f, setF] = useState<FormData>({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: UNITS[0], startDate: "", endDate: "" });
  const [errs, setErrs] = useState<Errors>({});
  const [toast, setToast] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        const orgs = await organizationService.list({ page: 1, pageSize: 1 });
        const org = orgs.rows[0];
        if (!org) return;
        setOrgId(org.id);
        const rules = await guestService.listAccessRules();
        setEntries(rules.filter((r) => r.ruleType === "whitelist").map(toEntry));
      } catch {
        // Leave entries empty -- the "no whitelist entries" state is accurate.
      }
    })();
  }, [demo, locationId]);

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
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = validate();
    setErrs(v);
    if (Object.keys(v).length) return;

    const identifier = tab === "number" ? f.mobile : f.mac.toUpperCase();
    if (demo) {
      const entry: Entry = { id: `e${Date.now()}`, tab, identifier, name: f.name, email: f.email, businessUnit: f.businessUnit, startDate: f.startDate, endDate: f.endDate };
      setEntries(p => [entry, ...p]);
      setF({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: UNITS[0], startDate: "", endDate: "" });
      setPage(0);
      setToast(tab === "number" ? "Number allowed." : "Device allowed.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!orgId) { setToast("No organization found for this session."); setTimeout(() => setToast(null), 2500); return; }
    try {
      const rule = await guestService.createAccessRule({
        kind: tab === "number" ? "identifier" : "device",
        organizationId: orgId, locationId,
        identifier: tab === "number" ? identifier : undefined,
        macAddress: tab === "device" ? identifier : undefined,
        ruleType: "whitelist", reason: f.name, expiresAt: f.endDate || undefined,
      });
      setEntries(p => [toEntry(rule), ...p]);
      setF({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: UNITS[0], startDate: "", endDate: "" });
      setPage(0);
      setToast(tab === "number" ? "Number allowed." : "Device allowed.");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Could not save — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = entries;
    const removed = entries.find((e) => e.id === id);
    setEntries(p => p.filter(e => e.id !== id));
    if (!demo && removed) {
      try { await guestService.deleteAccessRule(removed.tab === "device" ? "device" : "identifier", id); }
      catch { setEntries(prev); }
    }
  };

  // ── helpers ───────────────────────────────────────────────────
  const isActive = (end: string) => new Date(end) > new Date();
  const Err = ({ k }: { k: keyof FormData }) => errs[k] ? <p className="mt-1 text-xs text-destructive">{errs[k]}</p> : null;

  return (
    <div className="space-y-6">
      {/* heading */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><ShieldCheck className="h-6 w-6 text-primary" /> Whitelist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Allow specific numbers or devices to bypass the captive portal.</p>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* tab switcher */}
      <div className="inline-flex rounded-xl border bg-muted/50 p-1 max-sm:flex">
        <button onClick={() => { setTab("number"); setErrs({}); setPage(0); } } className={cn("inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-sm:flex-1 max-sm:justify-center", tab === "number" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Smartphone className="h-4 w-4" /> Whitelist Number
        </button>
        <button onClick={() => { setTab("device"); setErrs({}); setPage(0); } } className={cn("inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-sm:flex-1 max-sm:justify-center", tab === "device" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Laptop className="h-4 w-4" /> Whitelist Device
        </button>
      </div>

      {/* form card */}
      <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <h2 className="mb-5 text-lg font-semibold text-foreground">{tab === "number" ? "Whitelist a number" : "Whitelist a device"}</h2>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Mobile / MAC */}
          {tab === "number" ? (
            <div>
              <label className={labelCls}>Mobile Number <span className="text-destructive">*</span></label>
              <div className="flex gap-2">
                <select value={f.mobileCC} onChange={e => setField("mobileCC", e.target.value)} className={cn(inputCls, "w-28 shrink-0")}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <input type="text" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={f.mobile} onChange={e => setField("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} className={inputCls} />
              </div>
              <Err k="mobile" />
            </div>
          ) : (
            <div>
              <label className={labelCls}>MAC Address <span className="text-destructive">*</span></label>
              <input type="text" placeholder="AA:BB:CC:DD:EE:FF" value={f.mac} onChange={e => setField("mac", e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").replace(/(.{2})(?!$)/g, "$1:").slice(0, 17))} className={cn(inputCls, "font-mono")} />
              <Err k="mac" />
            </div>
          )}

          <div>
            <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
            <select value={f.businessUnit} onChange={e => setField("businessUnit", e.target.value)} className={inputCls}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>{tab === "number" ? "Name" : "Device label"} <span className="text-destructive">*</span></label>
            <input type="text" placeholder={tab === "number" ? "Guest name" : "e.g. Office Printer"} value={f.name} onChange={e => setField("name", e.target.value)} className={inputCls} />
            <Err k="name" />
          </div>

          <div>
            <label className={labelCls}>Email <span className="text-destructive">*</span></label>
            <input type="email" placeholder="name@company.com" value={f.email} onChange={e => setField("email", e.target.value)} className={inputCls} />
            <Err k="email" />
          </div>

          <div>
            <label className={labelCls}>Start Date <span className="text-destructive">*</span></label>
            <div className="relative">
              <input type="datetime-local" value={f.startDate} onChange={e => setField("startDate", e.target.value)} className={cn(inputCls, "pr-9")} />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Err k="startDate" />
          </div>

          <div>
            <label className={labelCls}>End Date <span className="text-destructive">*</span></label>
            <div className="relative">
              <input type="datetime-local" value={f.endDate} onChange={e => setField("endDate", e.target.value)} className={cn(inputCls, "pr-9")} />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Err k="endDate" />
          </div>
        </div>

        <hr className="my-6 border-border" />
        <div className="flex justify-center">
          <button type="submit" className="rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
            {tab === "number" ? "Allow Number" : "Allow Device"}
          </button>
        </div>
      </form>

      {/* table card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Whitelisted {tab === "number" ? "Users" : "Devices"}
            </h3>
            <p className="text-xs text-muted-foreground">Everything currently allow-listed for this location.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className={cn(inputCls, "w-48 py-1.5 pl-8")} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[820px] w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">{tab === "number" ? "Mobile Number" : "MAC Address"}</th>
                <th className="px-3 py-2.5">Business Unit</th>
                <th className="px-3 py-2.5">Start Date</th>
                <th className="px-3 py-2.5">End Date</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nothing whitelisted yet. Fill the form above to add the first one.
                  </td>
                </tr>
              ) : (
                paged.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-accent/50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {tab === "number" ? <Smartphone className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />}
                        </span>
                        <span className="font-medium text-foreground">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{e.identifier}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.businessUnit}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtDT(e.startDate)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtDT(e.endDate)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium", isActive(e.endDate) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                        {isActive(e.endDate) ? "Active" : "Expired"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button aria-label={`Edit ${e.name}`} className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button aria-label={`Delete ${e.name}`} onClick={() => handleDelete(e.id)} className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
