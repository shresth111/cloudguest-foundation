import { useEffect, useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Smartphone, Laptop, Calendar, Search, Pencil, Trash2, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import { resolveOrgId } from "@/services/customer.service";
import { maskMac } from "@/components/features/HeaderControls";
import type { AnyAccessRule } from "@/types/guest";

// ── helpers ─────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDT = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
// <input type="datetime-local">'s value ("2026-08-01T06:49") carries no UTC
// offset -- per the HTML/ECMA-262 spec it's the *browser's local* wall-clock
// time (i.e. the real zone the person filling the form is actually in, not
// UTC). `new Date(...)` parses a zone-less date-time string exactly that
// way, so `.toISOString()` gives the real UTC instant for whatever zone the
// customer is really in -- e.g. an Asia/Kolkata user's "06:49" becomes
// "01:19:00Z", not (wrongly) "06:49:00Z". Sending the raw local string
// instead (as this used to do) both misrepresents the intended moment by
// the zone offset AND -- because the backend then received the datetime
// with no tzinfo at all -- crashed guest-access/[device-]rules' expiry
// check with an unhandled naive-vs-aware TypeError (fixed independently on
// the backend, but this is the real, zone-correct fix at the source).
const toUtcIso = (dtLocal: string) => (dtLocal ? new Date(dtLocal).toISOString() : undefined);
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

/**
 * Compact intro-band illustration: a trusted device (checkmark-shield on
 * its screen) passing clear through a gate/turnstile -- the visual for
 * "bypass the captive portal", same filled-flat-shape character language
 * (cream/violet fills, cyan/fuchsia/violet accents) as this session's other
 * illustrations. Sized for a slim header band, not a full hero, since this
 * page's real content is a form + a real data table, not glance-numbers.
 *
 * Purely decorative -- aria-hidden. The gate's pulse and the shield's
 * draw-on both respect useReducedMotion.
 */
function TrustedAccessIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 220 120" className="h-auto w-full max-w-[200px]" fill="none">
      <defs>
        <filter id="wl-illo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <circle cx="150" cy="60" r="34" fill="#7c3aed" opacity="0.18" filter="url(#wl-illo-glow)" />
      <line x1="8" y1="104" x2="212" y2="104" stroke="white" strokeOpacity="0.12" strokeWidth="1" />

      {/* turnstile / gate */}
      <rect x="128" y="34" width="8" height="70" rx="3" fill="#241f4d" stroke="white" strokeOpacity="0.15" />
      <rect x="176" y="34" width="8" height="70" rx="3" fill="#241f4d" stroke="white" strokeOpacity="0.15" />
      <motion.rect
        x="136" y="66" width="40" height="6" rx="3" fill="#22d3ee"
        animate={shouldReduceMotion ? { opacity: 0.5 } : { opacity: [0.3, 0.7, 0.3] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* trusted phone, drifting through the gate */}
      <motion.g
        initial={shouldReduceMotion ? false : { x: -18, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <rect x="26" y="38" width="46" height="66" rx="9" fill="#241f4d" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
        <rect x="32" y="46" width="34" height="46" rx="3" fill="#f5f0ff" />
        <circle cx="49" cy="69" r="12" fill="#7c3aed" fillOpacity="0.12" />
        <motion.path
          d="M43 69l4 4 8-8"
          stroke="#7c3aed"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        />
      </motion.g>

      {/* "clear" arc trailing through the gate */}
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M${86 + i * 12} 71a4 4 0 0 1 0-4`}
          stroke="#f0abfc"
          strokeOpacity="0.7"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
        />
      ))}

      {/* destination pin, other side of the gate */}
      <g transform="translate(198, 60)" stroke="white" strokeOpacity="0.6" strokeWidth="2" strokeLinejoin="round">
        <path d="M0 -14c-5.6 0-10 4.4-10 9.9C-10 3.5 0 16 0 16s10-12.5 10-20.1C10-9.6 5.6-14 0-14z" fill="rgba(255,255,255,0.06)" />
        <circle cx="0" cy="-4" r="3" fill="#a78bfa" stroke="none" />
      </g>
    </svg>
  );
}

const PAGE_SIZE = 5;
const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

function toEntry(r: AnyAccessRule): Entry {
  return {
    id: r.id,
    tab: r.kind === "device" ? "device" : "number",
    identifier: r.kind === "device" ? r.macAddress : r.identifier,
    name: r.reason ?? "—",
    email: r.email ?? "",
    // Real rows carry a real location_id, not a name -- resolved against
    // the caller's own `locations` list at the two call sites below
    // (the initial fetch and the create/edit paths), the same way
    // TicketsPage.tsx resolves its own businessUnit <-> locationId pair.
    businessUnit: "",
    startDate: r.createdAt.slice(0, 16),
    endDate: r.expiresAt ? r.expiresAt.slice(0, 16) : "",
  };
}

export default function WhiteList({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  // UNITS is demo-only seed data (fake hotel names) -- a real customer only
  // has their own locations, so the "Business Unit" picker below must offer
  // those instead. Same real-vs-demo split as TicketsPage.tsx's
  // units/realUnits.
  const { data: locations } = useCustomerLocations();
  const realUnits = useMemo(() => (locations ?? []).map((l) => l.name), [locations]);
  const units = demo ? UNITS : realUnits;
  const [tab, setTab] = useState<Tab>("number");
  const [entries, setEntries] = useState<Entry[]>(demo ? SEED : []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [f, setF] = useState<FormData>({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: demo ? UNITS[0] : "", startDate: "", endDate: "" });
  const [errs, setErrs] = useState<Errors>({});
  const [toast, setToast] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  // Set while editing an existing row -- there's no PATCH endpoint for
  // guest/device access rules (backend/app/domains/guest_access has
  // create/list/deactivate/delete only), so "editing" a real rule means
  // creating its replacement then deleting the original, both real,
  // already-existing endpoints. See handleSubmit/handleDelete below.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Real rows only carry a location_id, not a display name -- resolve it
  // against the caller's own real locations, same pairing TicketsPage.tsx
  // does for its own businessUnit <-> locationId round-trip.
  const withBusinessUnit = (e: Entry, ruleLocationId: string | null | undefined): Entry => ({
    ...e,
    businessUnit: locations?.find((l) => l.id === ruleLocationId)?.name ?? "",
  });

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        // /me/organizations (membership-scoped) instead of the
        // platform-wide GET /organizations, which 403s for an ordinary
        // customer/org-owner session -- see customer.service.ts's
        // resolveOrgId doc comment.
        const org = await resolveOrgId();
        setOrgId(org);
        const rules = await guestService.listAccessRules(org);
        setEntries(
          rules
            .filter((r) => r.ruleType === "whitelist")
            .map((r) => withBusinessUnit(toEntry(r), r.locationId)),
        );
      } catch {
        // Leave entries empty -- the "no whitelist entries" state is accurate.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locationId, locations]);

  // Default the picker to the location this page is already scoped to,
  // once its real name is known (mirrors TicketsPage.tsx's equivalent effect).
  useEffect(() => {
    if (!demo && !f.businessUnit && locationId && locations) {
      const match = locations.find((l) => l.id === locationId);
      if (match) setF((p) => ({ ...p, businessUnit: match.name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locations, locationId]);

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
    const resetForm = () => setF({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: demo ? UNITS[0] : (units[0] ?? ""), startDate: "", endDate: "" });
    if (demo) {
      if (editingId) {
        setEntries(p => p.map(x => x.id === editingId ? { ...x, tab, identifier, name: f.name, email: f.email, businessUnit: f.businessUnit, startDate: f.startDate, endDate: f.endDate } : x));
        setEditingId(null);
      } else {
        const entry: Entry = { id: `e${Date.now()}`, tab, identifier, name: f.name, email: f.email, businessUnit: f.businessUnit, startDate: f.startDate, endDate: f.endDate };
        setEntries(p => [entry, ...p]);
      }
      resetForm();
      setPage(0);
      setToast(tab === "number" ? "Number allowed." : "Device allowed.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!orgId) { setToast("No organization found for this session."); setTimeout(() => setToast(null), 2500); return; }
    // The picker lets a customer with several locations allow-list against
    // a *different* one than whichever this page happens to be scoped to
    // -- resolve the name they picked back to its real id (same
    // name<->id round-trip TicketsPage.tsx does for its own businessUnit
    // field) instead of always writing the page's own `locationId` prop,
    // which silently ignored the picker entirely.
    const matchedLoc = locations?.find((l) => l.name === f.businessUnit);
    const ruleLocationId = matchedLoc?.id ?? locationId;
    try {
      const rule = await guestService.createAccessRule({
        kind: tab === "number" ? "identifier" : "device",
        organizationId: orgId, locationId: ruleLocationId,
        identifier: tab === "number" ? identifier : undefined,
        macAddress: tab === "device" ? identifier : undefined,
        ruleType: "whitelist", reason: f.name, email: f.email, expiresAt: toUtcIso(f.endDate),
      });
      const newEntry = withBusinessUnit(toEntry(rule), ruleLocationId);
      if (editingId) {
        // No PATCH endpoint exists for access rules -- "editing" is a real
        // create of the replacement followed by a real delete of the
        // original. If the delete fails, the original is left in place
        // (both now exist) rather than silently losing either row.
        const editingEntry = entries.find((e) => e.id === editingId);
        if (editingEntry) {
          try { await guestService.deleteAccessRule(editingEntry.tab === "device" ? "device" : "identifier", editingEntry.id, orgId); }
          catch { /* original left in place; not fatal to the edit itself */ }
        }
        setEntries(p => [newEntry, ...p.filter(e => e.id !== editingId)]);
        setEditingId(null);
      } else {
        setEntries(p => [newEntry, ...p]);
      }
      resetForm();
      setPage(0);
      setToast(tab === "number" ? "Number allowed." : "Device allowed.");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Could not save — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const startEdit = (entry: Entry) => {
    setTab(entry.tab);
    setErrs({});
    setEditingId(entry.id);
    setF({
      mobileCC: "+91",
      mobile: entry.tab === "number" ? entry.identifier : "",
      mac: entry.tab === "device" ? entry.identifier : "",
      name: entry.name === "—" ? "" : entry.name,
      email: entry.email,
      businessUnit: entry.businessUnit || (demo ? UNITS[0] : (units[0] ?? "")),
      startDate: entry.startDate,
      endDate: entry.endDate,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setErrs({});
    setF({ mobileCC: "+91", mobile: "", mac: "", name: "", email: "", businessUnit: demo ? UNITS[0] : (units[0] ?? ""), startDate: "", endDate: "" });
  };

  const handleDelete = async (id: string) => {
    const prev = entries;
    const removed = entries.find((e) => e.id === id);
    setEntries(p => p.filter(e => e.id !== id));
    if (editingId === id) cancelEdit();
    if (!demo && removed) {
      try { await guestService.deleteAccessRule(removed.tab === "device" ? "device" : "identifier", id, orgId ?? undefined); }
      catch { setEntries(prev); }
    }
  };

  // ── helpers ───────────────────────────────────────────────────
  const isActive = (end: string) => new Date(end) > new Date();
  const Err = ({ k }: { k: keyof FormData }) => errs[k] ? <p className="mt-1 text-xs text-destructive">{errs[k]}</p> : null;

  return (
    <div className="space-y-6">
      {/* intro band */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e1b4b] via-[#2b2461] to-[#4c1d95] px-5 py-4 text-white shadow-sm sm:px-6 sm:py-5">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-14 -left-6 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]"><ShieldCheck className="h-4 w-4 text-white" /></span>
              Always Allowed
            </h1>
            <p className="mt-1 text-sm text-white/70">Allow specific numbers or devices to bypass the captive portal.</p>
          </div>
          <div className="hidden shrink-0 opacity-90 sm:block">
            <TrustedAccessIllustration />
          </div>
        </div>
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
          <Smartphone className="h-4 w-4" /> Allow a Number
        </button>
        <button onClick={() => { setTab("device"); setErrs({}); setPage(0); } } className={cn("inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-sm:flex-1 max-sm:justify-center", tab === "device" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Laptop className="h-4 w-4" /> Allow a Device
        </button>
      </div>

      {/* form card */}
      <form onSubmit={handleSubmit} className="rounded-xl border-0 bg-card text-card-foreground shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            {tab === "number" ? <Smartphone className="h-3.5 w-3.5 text-white" /> : <Laptop className="h-3.5 w-3.5 text-white" />}
          </span>
          <CardTitle className="text-sm">{tab === "number" ? "Allow a number" : "Allow a device"}</CardTitle>
        </CardHeader>
        <CardContent>
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
              {units.map(u => <option key={u} value={u}>{u}</option>)}
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
        <div className="flex justify-center gap-2">
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded-lg border px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
              Cancel
            </button>
          )}
          <button type="submit" className="rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
            {editingId ? "Save Changes" : tab === "number" ? "Allow Number" : "Allow Device"}
          </button>
        </div>
        </CardContent>
      </form>

      {/* table card */}
      <div className="rounded-xl border-0 bg-card text-card-foreground shadow-sm">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]"><ShieldCheck className="h-3.5 w-3.5 text-white" /></span>
            <div>
              <CardTitle className="text-sm">
                Always Allowed {tab === "number" ? "Guests" : "Devices"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Everything currently allow-listed for this location.</p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className={cn(inputCls, "w-48 py-1.5 pl-8")} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
        {paged.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nothing allowed yet" description="Fill the form above to add the first one." />
        ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium">Name</TableHead>
                <TableHead className="text-xs font-medium">{tab === "number" ? "Mobile Number" : "MAC Address"}</TableHead>
                <TableHead className="text-xs font-medium">Business Unit</TableHead>
                <TableHead className="text-xs font-medium">Start Date</TableHead>
                <TableHead className="text-xs font-medium">End Date</TableHead>
                <TableHead className="text-xs font-medium">Status</TableHead>
                <TableHead className="text-right text-xs font-medium">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(e => (
                  <TableRow key={e.id} className="border-b">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {tab === "number" ? <Smartphone className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />}
                        </span>
                        <span className="font-medium text-foreground">{e.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.tab === "device" ? maskMac(e.identifier) : e.identifier}</TableCell>
                    <TableCell className="text-muted-foreground">{e.businessUnit}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDT(e.startDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDT(e.endDate)}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium", isActive(e.endDate) ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", isActive(e.endDate) ? "bg-emerald-500" : "bg-slate-400")} />
                        {isActive(e.endDate) ? "Active" : "Expired"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <button type="button" aria-label={`Edit ${e.name}`} onClick={() => startEdit(e)} className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button aria-label={`Delete ${e.name}`} onClick={() => handleDelete(e.id)} className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
            <span>Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
        </CardContent>
      </div>
    </div>
  );
}
