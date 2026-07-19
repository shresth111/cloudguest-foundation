import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Copy, Download, Eye, MoreHorizontal, Pin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuditList, usePinAudit } from "@/hooks/useAudit";
import type { AuditFilters, AuditLog } from "@/types/audit";
import { CategoryBadge, SeverityBadge, StatusBadge, formatTimestamp, humanAction } from "./audit-utils";
import { exportRows, type ExportFormat } from "./export";

type SortKey = "timestamp" | "actor" | "organizationName" | "module" | "action" | "severity" | "status" | "context";

const ALL_COLS = [
  "timestamp","user","organization","location","module","action","resource","ip","device","browser","status","severity",
] as const;
type ColKey = typeof ALL_COLS[number];

interface Props {
  filters: AuditFilters;
  onOpenDetails: (id: string) => void;
}

export function AuditTable({ filters, onOpenDetails }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "timestamp", dir: "desc" });
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(() => Object.fromEntries(ALL_COLS.map((c) => [c, true])) as Record<ColKey, boolean>);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const q = useAuditList(filters, page, pageSize, sort);
  const pin = usePinAudit();

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / pageSize)) : 1;
  const rows = q.data?.rows ?? [];
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allSelected = rows.length > 0 && rows.every((r) => selected[r.id]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const doExport = (fmt: ExportFormat) => {
    const src = selectedIds.length ? rows.filter((r) => selected[r.id]) : rows;
    exportRows(src, fmt);
    toast.success(`Exported ${src.length} logs as ${fmt.toUpperCase()}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {q.data ? (
            <>Showing <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span>–
            <span className="font-medium text-foreground">{Math.min(page * pageSize, q.data.total)}</span> of
            <span className="ml-1 font-medium text-foreground">{q.data.total.toLocaleString()}</span> logs
            {selectedIds.length > 0 && <> · <span className="text-foreground">{selectedIds.length} selected</span></>}</>
          ) : "Loading…"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Columns3 className="mr-1.5 h-4 w-4" /> Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLS.map((c) => (
                <DropdownMenuCheckboxItem key={c} checked={visible[c]} onCheckedChange={(v) => setVisible((prev) => ({ ...prev, [c]: !!v }))} className="capitalize">
                  {c}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm"><Download className="mr-1.5 h-4 w-4" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => doExport("csv")}>Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("json")}>Export JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("excel")}>Export Excel (.xls)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("pdf")}>Export PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => {
                    const next: Record<string, boolean> = { ...selected };
                    rows.forEach((r) => (next[r.id] = !!v));
                    setSelected(next);
                  }} />
                </TableHead>
                {visible.timestamp && <SortableHead label="Timestamp" active={sort.key === "timestamp"} dir={sort.dir} onClick={() => toggleSort("timestamp")} />}
                {visible.user &&      <SortableHead label="User"       active={sort.key === "actor"} dir={sort.dir} onClick={() => toggleSort("actor")} />}
                {visible.organization && <SortableHead label="Organization" active={sort.key === "organizationName"} dir={sort.dir} onClick={() => toggleSort("organizationName")} />}
                {visible.location &&  <TableHead>Location</TableHead>}
                {visible.module &&    <SortableHead label="Module"   active={sort.key === "module"} dir={sort.dir} onClick={() => toggleSort("module")} />}
                {visible.action &&    <SortableHead label="Action"   active={sort.key === "action"} dir={sort.dir} onClick={() => toggleSort("action")} />}
                {visible.resource &&  <TableHead>Resource</TableHead>}
                {visible.ip &&        <SortableHead label="IP address" active={sort.key === "context"} dir={sort.dir} onClick={() => toggleSort("context")} />}
                {visible.device &&    <TableHead>Device</TableHead>}
                {visible.browser &&   <TableHead>Browser</TableHead>}
                {visible.status &&    <SortableHead label="Status"   active={sort.key === "status"} dir={sort.dir} onClick={() => toggleSort("status")} />}
                {visible.severity &&  <SortableHead label="Severity" active={sort.key === "severity"} dir={sort.dir} onClick={() => toggleSort("severity")} />}
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={14} className="p-4"><LoadingSkeleton rows={pageSize} /></TableCell></TableRow>
              ) : q.isError ? (
                <TableRow><TableCell colSpan={14} className="p-6"><ErrorState onRetry={() => q.refetch()} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={14} className="p-6"><EmptyState title="No matching logs" description="Adjust filters or clear search to see more results." /></TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={r.pinned ? "bg-primary/5" : undefined}>
                    <TableCell><Checkbox checked={!!selected[r.id]} onCheckedChange={(v) => setSelected((p) => ({ ...p, [r.id]: !!v }))} /></TableCell>
                    {visible.timestamp && <TableCell className="whitespace-nowrap text-xs">{formatTimestamp(r.timestamp)}</TableCell>}
                    {visible.user && (
                      <TableCell>
                        <div className="text-sm font-medium leading-tight">{r.actor.name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.actor.role}</div>
                      </TableCell>
                    )}
                    {visible.organization && <TableCell className="text-sm">{r.organizationName}</TableCell>}
                    {visible.location &&    <TableCell className="text-sm text-muted-foreground">{r.locationName ?? "—"}</TableCell>}
                    {visible.module &&      <TableCell className="text-sm">{r.module}</TableCell>}
                    {visible.action &&      <TableCell className="text-sm capitalize">{humanAction(r.action)}</TableCell>}
                    {visible.resource &&    <TableCell className="text-xs text-muted-foreground">{r.resource}</TableCell>}
                    {visible.ip &&          <TableCell className="font-mono text-xs">{r.context.ipAddress}</TableCell>}
                    {visible.device &&      <TableCell className="text-xs text-muted-foreground">{r.context.device}</TableCell>}
                    {visible.browser &&     <TableCell className="text-xs text-muted-foreground">{r.context.browser}</TableCell>}
                    {visible.status &&      <TableCell><StatusBadge status={r.status} /></TableCell>}
                    {visible.severity &&    <TableCell><SeverityBadge severity={r.severity} /></TableCell>}
                    <TableCell className="text-right">
                      <RowActions row={r} onView={() => onOpenDetails(r.id)} onPin={() => pin.mutate({ id: r.id, pinned: !r.pinned })} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }} className="h-8 rounded-md border bg-background px-2 text-xs">
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span>Page <span className="text-foreground">{page}</span> / {totalPages}</span>
          <Button size="icon" variant="outline" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

function SortableHead({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        {label} <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

function RowActions({ row, onView, onPin }: { row: AuditLog; onView: () => void; onPin: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}><Eye className="mr-2 h-4 w-4" /> View details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          navigator.clipboard.writeText(row.id);
          toast.success("Log ID copied");
        }}><Copy className="mr-2 h-4 w-4" /> Copy log ID</DropdownMenuItem>
        <DropdownMenuItem onClick={onPin}><Pin className="mr-2 h-4 w-4" /> {row.pinned ? "Unpin event" : "Pin event"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => {
          exportRows([row], "json");
          toast.success("Exported log");
        }}><Download className="mr-2 h-4 w-4" /> Export row</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
