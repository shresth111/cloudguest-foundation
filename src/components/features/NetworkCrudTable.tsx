import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Pencil, Trash2, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
export const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

export type FieldType = "text" | "select" | "switch";
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  validate?: (v: string) => string | null;
  helper?: string;
}
export interface ColumnDef {
  key: string;
  label: string;
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const PORT_RE = /^\d{1,5}$/;
export const validators = {
  requiredIp: (v: string) => (v && IP_RE.test(v) ? null : "Please enter a valid IP"),
  requiredPort: (v: string) => (v && PORT_RE.test(v) && +v > 0 && +v <= 65535 ? null : "Please enter a valid port"),
  required: (label: string) => (v: string) => (v ? null : `Please enter a valid ${label.toLowerCase()}`),
};

interface Props {
  title: string;
  description: string;
  caution?: string;
  tableTitle: string;
  tableSubtitle?: string;
  columns: ColumnDef[];
  seed: Record<string, string | boolean>[];
  fields: FieldDef[];
  addLabel: string;
  emptyMessage?: string;
}

export default function NetworkCrudTable({ title, description, caution, tableTitle, tableSubtitle, columns, seed, fields, addLabel, emptyMessage }: Props) {
  const [rows, setRows] = useState(seed.map((r, i) => ({ ...r, __id: String(i + 1) })));
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const openAdd = () => { setForm({}); setErrs({}); setOpen(true); };
  const setField = (k: string, v: string | boolean) => { setForm((p) => ({ ...p, [k]: v })); setErrs((p) => { const n = { ...p }; delete n[k]; return n; }); };

  const submit = () => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      if (f.validate) {
        const msg = f.validate(String(form[f.key] ?? ""));
        if (msg) e[f.key] = msg;
      }
    }
    setErrs(e); if (Object.keys(e).length) return;
    setRows((p) => [{ ...form, __id: String(Date.now()) }, ...p]);
    setOpen(false);
    toast.success(`${addLabel} added`);
  };

  const remove = (id: string) => { setRows((p) => p.filter((r) => r.__id !== id)); toast.success("Removed"); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {caution && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800 dark:text-amber-200"><span className="font-semibold">Caution: </span>{caution}</p>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{tableTitle}</h3>
            {tableSubtitle && <p className="text-xs text-muted-foreground">{tableSubtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              {[10, 25, 50].map((n) => (
                <button key={n} onClick={() => { setPageSize(n); setPage(0); }} className={cn("rounded-md px-2 py-1 text-xs font-medium transition-colors", pageSize === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{n}</button>
              ))}
            </div>
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className={cn(inputCls, "w-44 py-1.5 pl-8")} /></div>
            <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"><Plus className="h-4 w-4" />{addLabel}</button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {columns.map((c) => <th key={c.key} className="px-3 py-2.5">{c.label}</th>)}
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="py-10 text-center text-sm text-muted-foreground">{emptyMessage ?? "No data available in table"}</td></tr>
              ) : paged.map((r) => (
                <tr key={r.__id} className="border-b last:border-0 hover:bg-accent/50">
                  {columns.map((c) => <td key={c.key} className="px-3 py-2.5 text-xs text-foreground">{typeof r[c.key] === "boolean" ? (r[c.key] ? "Yes" : "No") : (r[c.key] as string) || "—"}</td>)}
                  <td className="px-3 py-2.5 text-right">
                    <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.__id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1">
              <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="rounded-lg p-1.5 hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{addLabel}</h3><button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}{f.validate && <span className="text-destructive"> *</span>}</label>
                  {f.type === "select" ? (
                    <select value={String(form[f.key] ?? "")} onChange={(e) => setField(f.key, e.target.value)} className={inputCls}>
                      <option value="">{f.placeholder ?? `Choose ${f.label.toLowerCase()}`}</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "switch" ? (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={!!form[f.key]} onChange={(e) => setField(f.key, e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
                      {f.helper}
                    </label>
                  ) : (
                    <input value={String(form[f.key] ?? "")} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />
                  )}
                  {errs[f.key] && <p className="mt-1 text-xs text-destructive">{errs[f.key]}</p>}
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button><button onClick={submit} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{addLabel}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
