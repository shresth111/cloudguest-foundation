import { useState, useMemo, useRef, useCallback } from "react";
import {
  AlertTriangle, HelpCircle, X, Search, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Trash2, RotateCcw, Undo2,
} from "lucide-react";

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const PAGE_SIZE_OPTS = [10, 25, 50] as const;

interface BlockedUser {
  id: string;
  name: string | null;
  mobile: string;
  businessUnit: string;
  blockedOn: string;
  status: "Blocked" | "Unblocked";
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
        <div ref={ref} role="tooltip" tabIndex={-1} onKeyDown={(e) => { if (e.key === "Escape") close(); }} className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-800">
          <p>{text}</p>
          <button onClick={close} aria-label="Close" className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white"><X className="h-3 w-3" /></button>
        </div>
      )}
    </span>
  );
}

type SortKey = "name" | "mobile" | "businessUnit" | "blockedOn";

export default function BlockUsers() {
  // Fixed dates, not Date.now()-relative -- see WhiteList.tsx's SEED
  // comment for why a relative computation here hydration-mismatches.
  const [blocked, setBlocked] = useState<BlockedUser[]>([
    { id: "b1", name: "Ravi Sharma", mobile: "+919876543210", businessUnit: "Marina Bay Hotel", blockedOn: "2026-07-20T10:00:00.000Z", status: "Blocked" },
    { id: "b2", name: null, mobile: "+919812345678", businessUnit: "Downtown CoWork", blockedOn: "2026-07-18T10:00:00.000Z", status: "Blocked" },
    { id: "b3", name: "Priya Kapoor", mobile: "+919900001111", businessUnit: "Marina Bay Hotel", blockedOn: "2026-07-22T10:00:00.000Z", status: "Blocked" },
    { id: "b4", name: "Amit Patel", mobile: "+919722233344", businessUnit: "Eastside Cafe", blockedOn: "2026-07-13T10:00:00.000Z", status: "Unblocked" },
    { id: "b5", name: "Sana Khan", mobile: "+919833344455", businessUnit: "Airport Lounge T3", blockedOn: "2026-07-21T10:00:00.000Z", status: "Blocked" },
    { id: "b6", name: "John Doe", mobile: "+919655566677", businessUnit: "Downtown CoWork", blockedOn: "2026-07-16T10:00:00.000Z", status: "Blocked" },
  ]);

  const [textarea, setTextarea] = useState("");
  const [bu, setBu] = useState("Marina Bay Hotel");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [toast, setToast] = useState<string | null>(null);
  const [undoPayload, setUndoPayload] = useState<BlockedUser[] | null>(null);
  const undoRef = useRef<ReturnType<typeof setTimeout>>();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>();
  const [showModal, setShowModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("blockedOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ── parsing ───────────────────────────────────────────────────
  const parsed = useMemo(() => {
    const raw = textarea.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const cleaned = raw.map((s) => s.replace(/[\s\-\+\(\)]/g, ""));
    const seen = new Set<string>();
    const valid: string[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];
    const alreadyBlocked: string[] = [];
    const blockedMobiles = new Set(blocked.filter((b) => b.status === "Blocked").map((b) => b.mobile.replace(/[\s\-\+]/g, "")));

    for (const c of cleaned) {
      if (seen.has(c)) { duplicates.push(c); continue; }
      seen.add(c);
      if (blockedMobiles.has(c)) { alreadyBlocked.push(c); continue; }
      if (c.length >= 10 && c.length <= 15 && /^\d+$/.test(c)) { valid.push("+" + c); }
      else { invalid.push(c); }
    }
    return { valid, invalid, duplicates, alreadyBlocked, total: raw.length };
  }, [textarea, blocked]);

  const chipNumbers = useMemo(() => {
    const raw = textarea.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const cleaned = raw.map((s) => s.replace(/[\s\-\+\(\)]/g, ""));
    const result: { num: string; status: "valid" | "invalid" | "blocked"; raw: string }[] = [];
    const seen = new Set<string>();
    const blockedMobiles = new Set(blocked.filter((b) => b.status === "Blocked").map((b) => b.mobile.replace(/[\s\-\+]/g, "")));

    for (let i = 0; i < cleaned.length; i++) {
      if (seen.has(cleaned[i])) continue;
      seen.add(cleaned[i]);
      if (blockedMobiles.has(cleaned[i])) { result.push({ num: "+" + cleaned[i], status: "blocked", raw: raw[i] }); continue; }
      if (cleaned[i].length >= 10 && cleaned[i].length <= 15 && /^\d+$/.test(cleaned[i])) { result.push({ num: "+" + cleaned[i], status: "valid", raw: raw[i] }); }
      else { result.push({ num: raw[i], status: "invalid", raw: raw[i] }); }
    }
    return result;
  }, [textarea, blocked]);

  const removeChip = (raw: string) => {
    const parts = textarea.split(/[,;\n]/);
    const idx = parts.findIndex((p) => p.trim() === raw.trim());
    if (idx >= 0) {
      parts.splice(idx, 1);
      setTextarea(parts.join(", "));
    }
  };

  // ── sorting ───────────────────────────────────────────────────
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
    setPage(0);
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronUp;
    return (
      <th className="cursor-pointer pb-2 pr-3 select-none" onClick={() => toggleSort(k)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {label} <Icon className={`h-3 w-3 ${active ? "text-orange-500" : "text-slate-300"}`} />
        </span>
      </th>
    );
  };

  // ── filtered & sorted ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let items = blocked.filter((b) => b.businessUnit === bu && (!q || b.name?.toLowerCase().includes(q) || b.mobile.includes(q) || b.businessUnit.toLowerCase().includes(q) || b.status.toLowerCase().includes(q)));
    items.sort((a, b) => {
      const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [blocked, bu, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // ── block ─────────────────────────────────────────────────────
  const handleBlock = () => {
    const now = new Date().toISOString();
    const newBlocked = parsed.valid.map((m) => ({ id: `b${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: null, mobile: m, businessUnit: bu, blockedOn: now, status: "Blocked" as const }));
    // TODO: replace with API call
    setUndoPayload(newBlocked);
    setBlocked((prev) => [...newBlocked, ...prev]);
    setTextarea("");
    setPage(0);
    setShowModal(false);
    setToast(`${newBlocked.length} numbers blocked.`);
    if (undoRef.current) clearTimeout(undoRef.current);
    undoRef.current = setTimeout(() => setUndoPayload(null), 6000);
    setTimeout(() => setToast(null), 6500);
  };

  const handleUndo = () => {
    if (undoPayload) {
      const ids = new Set(undoPayload.map((u) => u.id));
      setBlocked((prev) => prev.filter((b) => !ids.has(b.id)));
      setUndoPayload(null);
      setToast("Undone.");
      if (undoRef.current) clearTimeout(undoRef.current);
      setTimeout(() => setToast(null), 2500);
    }
  };

  // ── unblock / delete ──────────────────────────────────────────
  const toggleStatus = (id: string) => {
    // TODO: replace with API call
    setBlocked((prev) => prev.map((b) => b.id === id ? { ...b, status: b.status === "Blocked" ? "Unblocked" : "Blocked" } : b));
  };

  const handleDelete = (id: string) => {
    if (confirmingId === id) {
      // TODO: replace with API call
      setBlocked((prev) => prev.filter((b) => b.id !== id));
      setConfirmingId(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    } else {
      setConfirmingId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000);
    }
  };

  const fmtDT = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          <span>{toast}</span>
          {undoPayload && <button onClick={handleUndo} className="font-medium text-orange-400 underline hover:text-orange-300 dark:text-orange-600">Undo</button>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setShowModal(false); triggerRef.current?.focus(); }}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="block-modal-title">
            <h3 id="block-modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100" tabIndex={-1}>Block {parsed.valid.length} numbers?</h3>
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
              {parsed.valid.map((n) => <p key={n} className="font-mono text-sm text-slate-600 dark:text-slate-300">{n}</p>)}
            </div>
            <p className="mt-3 text-sm text-slate-500">Their current sessions will end right away.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setShowModal(false); triggerRef.current?.focus(); }} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
              <button onClick={handleBlock} className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">Block numbers</button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Block Users</h1>

      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Block User</h2>
          <div>
            <label htmlFor="bu-select" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Applies to</label>
            <select id="bu-select" value={bu} onChange={(e) => { setBu(e.target.value); setPage(0); }} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800 dark:text-amber-200">Blocking takes effect immediately and ends any session these users currently have.</p>
        </div>

        <div className="mt-5">
          <label htmlFor="block-ta" className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            Mobile numbers <span className="text-orange-500">*</span>
            <Tooltip text="Paste one or more numbers separated by commas. Include the country code, e.g. +919876543210." />
          </label>
          <textarea id="block-ta" rows={6} placeholder="+919876543210, +919812345678" value={textarea} onChange={(e) => setTextarea(e.target.value)} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
        </div>

        <div aria-live="polite" className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">{parsed.valid.length} numbers ready</span>
          {parsed.duplicates.length > 0 && <span className="text-slate-400">· {parsed.duplicates.length} duplicate removed</span>}
          {parsed.invalid.length > 0 && <span className="text-orange-500">· {parsed.invalid.length} invalid</span>}
          {parsed.alreadyBlocked.length > 0 && <span className="text-slate-400">· {parsed.alreadyBlocked.length} already blocked</span>}
        </div>

        {chipNumbers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chipNumbers.map((c, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                c.status === "valid" ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" :
                c.status === "blocked" ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500" :
                "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
              }`} title={c.status === "invalid" ? "Invalid number" : c.status === "blocked" ? "Already blocked" : ""}>
                {c.num}
                {c.status !== "blocked" && (
                  <button onClick={() => removeChip(c.raw)} aria-label={`Remove ${c.num}`} className="inline-flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"><X className="h-3 w-3" /></button>
                )}
              </span>
            ))}
          </div>
        )}

        <hr className="my-5 border-slate-100 dark:border-slate-600" />
        <div className="flex justify-center">
          <button ref={triggerRef} disabled={parsed.valid.length === 0} onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-60">
            Block {parsed.valid.length > 0 ? `${parsed.valid.length} number${parsed.valid.length > 1 ? "s" : ""}` : "numbers"}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-slate-800 dark:ring-slate-600 md:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Blocked Users</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Everyone currently blocked at this location.</p>
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
          <table className="min-w-[860px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-600">
                <SortHeader k="name" label="Name" />
                <SortHeader k="mobile" label="Mobile Number" />
                <SortHeader k="businessUnit" label="Business Unit" />
                <SortHeader k="blockedOn" label="Blocked On" />
                <th className="pb-2 pr-3 text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Nobody is blocked at this location. Paste a number above to block one.</td></tr>
              ) : (
                paged.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-700 dark:text-slate-300">
                    <td className="py-2.5 pr-3 font-medium">{b.name ?? <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{b.mobile}</td>
                    <td className="py-2.5 pr-3 text-xs">{b.businessUnit}</td>
                    <td className="py-2.5 pr-3 text-xs whitespace-nowrap">{fmtDT(b.blockedOn)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${b.status === "Blocked" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}>{b.status}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button aria-label={b.status === "Blocked" ? `Unblock ${b.mobile}` : `Block ${b.mobile}`} onClick={() => toggleStatus(b.id)} className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:hover:bg-slate-700">{b.status === "Blocked" ? "Unblock" : "Block again"}</button>
                      <button aria-label={confirmingId === b.id ? "Confirm delete" : `Delete ${b.mobile}`} onClick={() => handleDelete(b.id)} className={`ml-1 inline-flex items-center justify-center rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${confirmingId === b.id ? "bg-orange-500 text-white" : "text-slate-400 hover:text-red-500 dark:hover:text-red-400"}`}>
                        {confirmingId === b.id ? <span className="text-[11px] font-medium px-1">Confirm</span> : <Trash2 className="h-4 w-4" />}
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
