import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle, HelpCircle, X, Search, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Trash2, RotateCcw, Undo2, Ban,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import { resolveOrgId } from "@/services/customer.service";
import type { AnyAccessRule } from "@/types/guest";
import { maskMac } from "@/components/features/HeaderControls";

// `mobile` holds either a phone number or a MAC (see toBlockedUser below,
// which -- like guest_access's own rule tables -- doesn't keep a separate
// identifier-kind column) -- format-detect the MAC case to mask it, the
// same PII posture applied to every other MAC display in the customer
// dashboard (HeaderControls.tsx's maskMac).
const MOBILE_MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

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
      <button type="button" aria-label="Help" onClick={() => setOpen((p) => !p)} onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget)) close(); }} className="inline-flex items-center justify-center rounded text-slate-300 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
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

function toBlockedUser(r: AnyAccessRule): BlockedUser {
  return {
    id: r.id,
    name: r.reason ?? null,
    mobile: r.kind === "device" ? r.macAddress : r.identifier,
    businessUnit: "",
    blockedOn: r.createdAt,
    status: r.isActive ? "Blocked" : "Unblocked",
  };
}

/**
 * Small header-accent illustration: a phone with a "blocked" glyph and a
 * signal line cut off by a barrier, same filled-flat-shape character
 * language as the other illustrations shipped this session. The "no
 * entry" badge is recolored from decorative fuchsia to the rose that
 * GuestBadges.tsx and OperationsFeatures.tsx already use everywhere else
 * in this product for "blocklist"/"blocked" -- so the illustration reads
 * as *this specific state* (blocked) rather than a generic accent color,
 * and matches the same rose now used on the status pill below and the
 * Blocked Guests tab in PoliciesHub.tsx. Kept compact, inline with the
 * header row -- this page's real content is a dense number-entry form + a
 * real blocked-users table, so personality lives in a small corner
 * accent, not a full hero. Purely decorative -- aria-hidden.
 */
function BlockedAccessIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 84 56" className="hidden h-14 w-auto shrink-0 sm:block" fill="none">
      <rect x="30" y="6" width="24" height="40" rx="5" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.5" />
      <rect x="34" y="12" width="16" height="24" rx="1.5" fill="#1e1b4b" />
      <circle cx="42" cy="40" r="1.6" fill="#a78bfa" />
      <motion.path
        d="M22 26a20 20 0 0 1 8-8"
        stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.g
        animate={shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="64" cy="20" r="12" fill="#1e1b4b" stroke="#fb7185" strokeWidth="2" />
        <path d="M58 14l12 12M70 14l-12 12" stroke="#fb7185" strokeWidth="2.2" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

export default function BlockUsers({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  // UNITS is demo-only seed data (fake hotel names) -- a real customer only
  // has their own locations. Same real-vs-demo split as WhiteList.tsx's
  // units/realUnits.
  const { data: locations } = useCustomerLocations();
  const units = demo ? UNITS : (locations ?? []).map((l) => l.name);
  // Fixed dates, not Date.now()-relative -- see WhiteList.tsx's SEED
  // comment for why a relative computation here hydration-mismatches.
  const [blocked, setBlocked] = useState<BlockedUser[]>(demo ? [
    { id: "b1", name: "Ravi Sharma", mobile: "+919876543210", businessUnit: "Marina Bay Hotel", blockedOn: "2026-07-20T10:00:00.000Z", status: "Blocked" },
    { id: "b2", name: null, mobile: "+919812345678", businessUnit: "Downtown CoWork", blockedOn: "2026-07-18T10:00:00.000Z", status: "Blocked" },
    { id: "b3", name: "Priya Kapoor", mobile: "+919900001111", businessUnit: "Marina Bay Hotel", blockedOn: "2026-07-22T10:00:00.000Z", status: "Blocked" },
    { id: "b4", name: "Amit Patel", mobile: "+919722233344", businessUnit: "Eastside Cafe", blockedOn: "2026-07-13T10:00:00.000Z", status: "Unblocked" },
    { id: "b5", name: "Sana Khan", mobile: "+919833344455", businessUnit: "Airport Lounge T3", blockedOn: "2026-07-21T10:00:00.000Z", status: "Blocked" },
    { id: "b6", name: "John Doe", mobile: "+919655566677", businessUnit: "Downtown CoWork", blockedOn: "2026-07-16T10:00:00.000Z", status: "Blocked" },
  ] : []);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        // /me/organizations instead of the platform-wide GET /organizations
        // -- see customer.service.ts's resolveOrgId doc comment.
        const org = await resolveOrgId();
        setOrgId(org);
        const rules = await guestService.listAccessRules(org);
        setBlocked(rules.filter((r) => r.ruleType === "blocklist").map(toBlockedUser));
      } catch {
        // Leave blocked empty -- the "no blocked numbers" state is accurate.
      }
    })();
  }, [demo, locationId]);

  const [textarea, setTextarea] = useState("");
  const [bu, setBu] = useState(demo ? "Marina Bay Hotel" : "");

  // Default "Applies to" to the location this page is already scoped to,
  // once its real name is known (mirrors WhiteList.tsx's equivalent effect).
  useEffect(() => {
    if (!demo && !bu && locationId && locations) {
      const match = locations.find((l) => l.id === locationId);
      if (match) setBu(match.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locations, locationId]);

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
      <TableHead className="cursor-pointer select-none text-xs font-medium" onClick={() => toggleSort(k)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <span className="inline-flex items-center gap-1">
          {label} <Icon className={`h-3 w-3 ${active ? "text-indigo-500" : "text-slate-300"}`} />
        </span>
      </TableHead>
    );
  };

  // ── filtered & sorted ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    // Real entries don't carry a per-row businessUnit (toBlockedUser always
    // sets ""; this page is already scoped to one location via its own
    // locationId prop) -- only demo's multi-location seed data has a
    // meaningful businessUnit to filter by. Applying the demo-only
    // `b.businessUnit === bu` match in real mode would always evaluate to
    // `"" === "<some location name>"`, i.e. false, hiding every real row.
    let items = blocked.filter((b) => (!demo || b.businessUnit === bu) && (!q || b.name?.toLowerCase().includes(q) || b.mobile.includes(q) || b.businessUnit.toLowerCase().includes(q) || b.status.toLowerCase().includes(q)));
    items.sort((a, b) => {
      const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [blocked, bu, demo, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // ── block ─────────────────────────────────────────────────────
  const handleBlock = async () => {
    const now = new Date().toISOString();
    if (demo) {
      const newBlocked = parsed.valid.map((m) => ({ id: `b${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: null, mobile: m, businessUnit: bu, blockedOn: now, status: "Blocked" as const }));
      setUndoPayload(newBlocked);
      setBlocked((prev) => [...newBlocked, ...prev]);
      setTextarea("");
      setPage(0);
      setShowModal(false);
      setToast(`${newBlocked.length} numbers blocked.`);
      if (undoRef.current) clearTimeout(undoRef.current);
      undoRef.current = setTimeout(() => setUndoPayload(null), 6000);
      setTimeout(() => setToast(null), 6500);
      return;
    }
    if (!orgId) { setToast("No organization found for this session."); setTimeout(() => setToast(null), 2500); return; }
    try {
      const created = await Promise.all(parsed.valid.map((m) =>
        guestService.createAccessRule({ kind: "identifier", organizationId: orgId, locationId, identifier: m, ruleType: "blocklist" }),
      ));
      const newBlocked = created.map(toBlockedUser);
      setBlocked((prev) => [...newBlocked, ...prev]);
      setTextarea("");
      setPage(0);
      setShowModal(false);
      setToast(`${newBlocked.length} numbers blocked.`);
      setTimeout(() => setToast(null), 6500);
    } catch {
      setToast("Could not block — check the connection and try again.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  // The primary "Block N number(s)" button used to be hard-`disabled` any
  // time parsed.valid was empty -- which covers 4 different situations
  // (nothing typed, invalid format, duplicates, already-blocked). A native
  // `disabled` button suppresses the click event entirely, so in 3 of
  // those 4 cases (anything typed at all) the click was a true dead end:
  // no toast, no request, nothing -- indistinguishable from a broken
  // button. Now the button is only really disabled when the box is empty;
  // otherwise a click with zero valid numbers explains why instead of
  // silently doing nothing.
  const handlePrimaryClick = () => {
    if (parsed.valid.length > 0) { setShowModal(true); return; }
    let msg = "Nothing to block.";
    if (parsed.alreadyBlocked.length > 0 && parsed.invalid.length === 0) {
      msg = parsed.alreadyBlocked.length === 1 ? "That number is already blocked." : "Those numbers are already blocked.";
    } else if (parsed.invalid.length > 0) {
      msg = "No valid numbers to block — check the formatting (include the country code, e.g. +919876543210).";
    }
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
  const toggleStatus = async (id: string) => {
    setBlocked((prev) => prev.map((b) => b.id === id ? { ...b, status: b.status === "Blocked" ? "Unblocked" : "Blocked" } : b));
    if (demo) return;
    const row = blocked.find((b) => b.id === id);
    if (!row) return;
    try {
      if (row.status === "Blocked") {
        await guestService.deactivateAccessRule("identifier", id, orgId ?? undefined);
      } else if (orgId) {
        const created = await guestService.createAccessRule({ kind: "identifier", organizationId: orgId, locationId, identifier: row.mobile, ruleType: "blocklist" });
        setBlocked((prev) => prev.map((b) => b.id === id ? toBlockedUser(created) : b));
      }
    } catch {
      setToast("Could not update on the server.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleDelete = (id: string) => {
    if (confirmingId === id) {
      const prev = blocked;
      setBlocked((p) => p.filter((b) => b.id !== id));
      setConfirmingId(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (!demo) {
        guestService.deleteAccessRule("identifier", id, orgId ?? undefined).catch(() => { setBlocked(prev); setToast("Could not delete on the server."); setTimeout(() => setToast(null), 2500); });
      }
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
          {undoPayload && <button onClick={handleUndo} className="font-medium text-indigo-400 underline hover:text-indigo-300 dark:text-indigo-600">Undo</button>}
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
              <button onClick={() => { setShowModal(false); triggerRef.current?.focus(); }} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
              <button onClick={handleBlock} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Block numbers</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Ban className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Blocked Guests</h1>
            <p className="text-sm text-muted-foreground">Cut off a number's access to your network immediately.</p>
          </div>
        </div>
        <BlockedAccessIllustration />
      </div>

      <Card className="border-0 shadow-sm">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <CardTitle className="text-sm">Block User</CardTitle>
          <div>
            <label htmlFor="bu-select" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Applies to</label>
            <select id="bu-select" value={bu} onChange={(e) => { setBu(e.target.value); setPage(0); }} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800 dark:text-amber-200">Blocking takes effect immediately and ends any session these users currently have.</p>
        </div>

        <div className="mt-5">
          <label htmlFor="block-ta" className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            Mobile numbers <span className="text-indigo-500">*</span>
            <Tooltip text="Paste one or more numbers separated by commas. Include the country code, e.g. +919876543210." />
          </label>
          <textarea id="block-ta" rows={6} placeholder="+919876543210, +919812345678" value={textarea} onChange={(e) => setTextarea(e.target.value)} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
        </div>

        <div aria-live="polite" className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">{parsed.valid.length} numbers ready</span>
          {parsed.duplicates.length > 0 && <span className="text-slate-400">· {parsed.duplicates.length} duplicate removed</span>}
          {parsed.invalid.length > 0 && <span className="text-indigo-500">· {parsed.invalid.length} invalid</span>}
          {parsed.alreadyBlocked.length > 0 && <span className="text-slate-400">· {parsed.alreadyBlocked.length} already blocked</span>}
        </div>

        {chipNumbers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chipNumbers.map((c, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                c.status === "valid" ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" :
                c.status === "blocked" ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500" :
                "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400"
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
          <button ref={triggerRef} disabled={textarea.trim() === ""} onClick={handlePrimaryClick} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60">
            Block {parsed.valid.length > 0 ? `${parsed.valid.length} number${parsed.valid.length > 1 ? "s" : ""}` : "numbers"}
          </button>
        </div>
      </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-sm">Blocked Users</CardTitle>
            <p className="text-xs text-muted-foreground">Everyone currently blocked at this location.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-44 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-600">
              {PAGE_SIZE_OPTS.map((n) => (
                <button key={n} onClick={() => { setPageSize(n); setPage(0); }} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${pageSize === n ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}>{n}</button>
              ))}
            </div>
          </div>
      </CardHeader>
      <CardContent className="p-0">
        {paged.length === 0 ? (
          <EmptyState
            icon={Ban}
            title="Nobody is blocked"
            description="Paste a number above to block one -- it takes effect immediately."
            action={{ label: "Block a number", onClick: () => document.getElementById("block-ta")?.focus() }}
          />
        ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <SortHeader k="name" label="Name" />
                <SortHeader k="mobile" label="Mobile Number" />
                <SortHeader k="businessUnit" label="Location" />
                <SortHeader k="blockedOn" label="Blocked On" />
                <TableHead className="text-xs font-medium">Status</TableHead>
                <TableHead className="text-right text-xs font-medium">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((b) => (
                  <TableRow key={b.id} className="border-b">
                    <TableCell className="font-medium">{b.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{MOBILE_MAC_RE.test(b.mobile) ? maskMac(b.mobile) : b.mobile}</TableCell>
                    <TableCell className="text-xs">{b.businessUnit}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDT(b.blockedOn)}</TableCell>
                    <TableCell>
                      {/* Was an indigo pill for "Blocked" -- indigo is this
                       * page's own brand/action color (buttons, focus
                       * rings), so a "Blocked" row read as neutral instead
                       * of restrictive. Switched to the same rose dot+label
                       * WhiteList.tsx uses for its own "Active" state
                       * (mirrored, not copied verbatim) and GuestBadges.tsx
                       * already uses for "blocklist" everywhere else. */}
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", b.status === "Blocked" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", b.status === "Blocked" ? "bg-rose-500" : "bg-slate-400")} />
                        {b.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <button aria-label={b.status === "Blocked" ? `Unblock ${b.mobile}` : `Block ${b.mobile}`} onClick={() => toggleStatus(b.id)} className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-700">{b.status === "Blocked" ? "Unblock" : "Block again"}</button>
                      <button aria-label={confirmingId === b.id ? "Confirm delete" : `Delete ${b.mobile}`} onClick={() => handleDelete(b.id)} className={`ml-1 inline-flex items-center justify-center rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${confirmingId === b.id ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-red-500 dark:hover:text-red-400"}`}>
                        {confirmingId === b.id ? <span className="text-[11px] font-medium px-1">Confirm</span> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
            <span>Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
