import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  HelpCircle, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Search, Calendar, AlertTriangle, Loader2, Download, Upload, Eye,
} from "lucide-react";

/* ── PageHeader ──────────────────────────────────────────── */
export function PageHeader({ title, breadcrumb }: { title: string; breadcrumb?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
      {breadcrumb && <p className="text-xs text-slate-400">YOU ARE HERE : <span className="text-orange-500">BhaiFi</span> / {breadcrumb}</p>}
    </div>
  );
}

/* ── TabBar ──────────────────────────────────────────────── */
export function TabBar({ tabs, active, onNavigate }: { tabs: string[]; active: string; onNavigate?: (t: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
      <div className="flex min-w-[500px] divide-x divide-slate-200 dark:divide-slate-600">
        {tabs.map((label) => {
          const isActive = label === active;
          return (
            <button key={label} onClick={() => onNavigate?.(label)} aria-current={isActive ? "page" : undefined}
              className={`flex-1 px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                  : "bg-slate-50 text-slate-600 hover:bg-white dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}>{label}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Card ────────────────────────────────────────────────── */
export function Card({ heading, subtitle, rightSlot, children }: { heading: string; subtitle?: string; rightSlot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600 md:p-8">
      {(heading || rightSlot) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{heading}</h3>{subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}</div>
          {rightSlot && <div className="flex items-center gap-3">{rightSlot}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Tooltip ─────────────────────────────────────────────── */
export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label="Help" onClick={() => setOpen(p => !p)} onBlur={e => { if (!ref.current?.contains(e.relatedTarget)) close(); }} className="inline-flex items-center justify-center rounded text-slate-300 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500">
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div ref={ref} role="tooltip" tabIndex={-1} onKeyDown={e => { if (e.key === "Escape") close(); }} className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-800">
          <p>{text}</p>
          <button onClick={close} aria-label="Close" className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white"><X className="h-3 w-3" /></button>
        </div>
      )}
    </span>
  );
}

/* ── Field ───────────────────────────────────────────────── */
export function Field({ id, label, required, tooltip, error, children }: { id: string; label: string; required?: boolean; tooltip?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}{required && <span className="text-orange-500">*</span>}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      {children}
      {error && <p className="mt-0.5 text-xs text-orange-500">{error}</p>}
    </div>
  );
}

/* ── StatusPill ──────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400",
  up: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  delivered: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  live: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-100 text-amber-700 ring-amber-200",
  failed: "bg-orange-100 text-orange-700 ring-orange-200",
  blocked: "bg-orange-100 text-orange-700 ring-orange-200",
  down: "bg-orange-100 text-orange-700 ring-orange-200",
  expired: "bg-slate-100 text-slate-500 ring-slate-200",
  inactive: "bg-slate-100 text-slate-500 ring-slate-200",
  ended: "bg-slate-100 text-slate-500 ring-slate-200",
};
export function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls = STATUS_COLORS[s] || "bg-slate-100 text-slate-500 ring-slate-200";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>{status}</span>;
}

/* ── CautionBanner ───────────────────────────────────────── */
export function CautionBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <div className="text-sm text-amber-800 dark:text-amber-200">{children}</div>
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, action }: { icon?: typeof Search; title: string; action?: string }) {
  const I = Icon || Search;
  return (
    <tr><td colSpan={99} className="py-12 text-center">
      <I className="mx-auto mb-3 h-8 w-8 text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {action && <p className="text-xs text-slate-400 mt-1">{action}</p>}
    </td></tr>
  );
}

/* ── Sortable DataTable ──────────────────────────────────── */
export function DataTable({ cols, rows, renderRow, search, onSearch, page, setPage, pageSize, setPageSize, total, sortKey, setSortKey, sortDir, setSortDir }:
  { cols: { key: string; label: string; sortType?: string }[]; rows: any[]; renderRow: (r: any, i: number) => React.ReactNode;
    search?: string; onSearch?: (v: string) => void; page: number; setPage: (v: number) => void;
    pageSize: number; setPageSize: (v: number) => void; total: number;
    sortKey?: string; setSortKey?: (v: string) => void; sortDir?: string; setSortDir?: (v: string) => void; }) {

  const toggleSort = (k: string) => {
    if (!setSortKey || !setSortDir) return;
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
    setPage(0);
  };

  const tp = Math.max(1, Math.ceil(total / pageSize));
  const sp = Math.min(page, tp - 1);

  return (
    <div>
      {(onSearch || setPageSize) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {onSearch && (
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search…" value={search || ""} onChange={e => { onSearch(e.target.value); setPage(0); }} className="w-44 rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500" /></div>
          )}
          {setPageSize && (
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5">
              {[10, 25, 50].map(n => <button key={n} onClick={() => { setPageSize(n); setPage(0); }} className={`rounded px-2 py-1 text-xs font-medium ${pageSize === n ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{n}</button>)}
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left">{cols.map(c => (
            <th key={c.key} className={`pb-2 pr-3 ${setSortKey ? "cursor-pointer select-none" : ""}`} onClick={() => toggleSort(c.key)} aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {c.label}
                {setSortKey && sortKey === c.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-orange-500" /> : <ChevronDown className="h-3 w-3 text-orange-500" />)}
              </span>
            </th>
          ))}<th className="pb-2 text-right"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</span></th></tr></thead>
          <tbody>{rows}{total === 0 && <EmptyState title="No data to show." />}</tbody>
        </table>
      </div>
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {sp * pageSize + 1}–{Math.min((sp + 1) * pageSize, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <button disabled={sp === 0} onClick={() => setPage(sp - 1)} className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronLeft className="h-4 w-4" /></button>
            <button disabled={sp >= tp - 1} onClick={() => setPage(sp + 1)} className="inline-flex items-center justify-center rounded p-1 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orange-500"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, primary, onPrimary }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; primary?: string; onPrimary?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div ref={ref} className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
        <h3 id="modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <div className="mt-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          {primary && <button onClick={onPrimary} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">{primary}</button>}
        </div>
      </div>
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────── */
export function Toast({ message, onUndo }: { message: string | null; onUndo?: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-slate-900 px-5 py-2.5 text-sm text-white shadow-lg">
      <span>{message}</span>
      {onUndo && <button onClick={onUndo} className="font-medium text-orange-400 underline hover:text-orange-300">Undo</button>}
    </div>
  );
}

/* ── DateInput ────────────────────────────────────────────── */
export function DateInput({ id, value, onChange, label, required, error, max }: { id: string; value: string; onChange: (v: string) => void; label?: string; required?: boolean; error?: string; max?: string }) {
  return (
    <div>
      {label && <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-600">{label}{required && <span className="text-orange-500">*</span>}</label>}
      <div className="relative">
        <input id={id} type="date" value={value} onChange={e => onChange(e.target.value)} max={max} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-slate-700 dark:text-slate-100" />
        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {error && <p className="mt-0.5 text-xs text-orange-500">{error}</p>}
    </div>
  );
}

/* ── InlineConfirm ───────────────────────────────────────── */
export function InlineConfirm({ onConfirm }: { onConfirm: () => void }) {
  const [arming, setArming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const handleClick = () => {
    if (arming) { onConfirm(); setArming(false); if (timer.current) clearTimeout(timer.current); }
    else { setArming(true); timer.current = setTimeout(() => setArming(false), 3000); }
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button onClick={handleClick} className={`inline-flex items-center justify-center rounded p-1 transition-colors ${arming ? "bg-orange-500 text-white" : "text-slate-400 hover:text-red-500"}`}>
      <span className="text-[11px] font-medium px-1">{arming ? "Confirm" : <Trash2 className="h-4 w-4" />}</span>
    </button>
  );
}
