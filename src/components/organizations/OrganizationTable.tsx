import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  CheckCircle2,
  PauseCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "./StatusBadge";
import { OrganizationWizard } from "./OrganizationWizard";
import {
  useDeleteOrganizations,
  useOrganizations,
  useUpdateOrgStatus,
} from "@/hooks/useOrganizations";
import type { OrgListQuery, OrgStatus, Organization } from "@/types/organization";
import type { AppError } from "@/services/api";

const PAGE_SIZES = [10, 20, 50];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function toCsv(rows: Organization[]) {
  const headers = ["ID", "Name", "Slug", "Type", "Email", "Phone", "Subscription tier", "Status", "Created"];
  const lines = rows.map((r) =>
    [r.id, r.name, r.slug, r.orgType, r.contactEmail, r.contactPhone ?? "", r.subscriptionTier ?? "", r.status, r.createdAt]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export function OrganizationTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrgStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; onConfirm: () => void; destructive?: boolean }>(null);

  const query: OrgListQuery = useMemo(
    () => ({ search, status, page, pageSize }),
    [search, status, page, pageSize],
  );

  const { data, isLoading, isError, refetch, isFetching } = useOrganizations(query);
  const updateStatus = useUpdateOrgStatus();
  const remove = useDeleteOrganizations();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `organizations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  function bulk(action: "activate" | "suspend" | "delete") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === "delete") {
      setConfirm({
        title: `Archive ${ids.length} organization${ids.length > 1 ? "s" : ""}?`,
        description: "This archives the selected organizations.",
        destructive: true,
        onConfirm: async () => {
          await remove.mutateAsync(ids);
          toast.success("Organizations archived");
          setSelected(new Set());
        },
      });
      return;
    }
    const targetStatus: OrgStatus = action === "activate" ? "active" : "suspended";
    setConfirm({
      title: `${action === "activate" ? "Activate" : "Suspend"} ${ids.length} organization${ids.length > 1 ? "s" : ""}?`,
      description: `Selected organizations will be marked as ${targetStatus}.`,
      onConfirm: async () => {
        await updateStatus.mutateAsync({ ids, status: targetStatus });
        toast.success(`Marked as ${targetStatus}`);
        setSelected(new Set());
      },
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search organizations, contact emails…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as OrgStatus | "all"); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4" /><span className="ml-2 hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" /><span className="ml-2">New organization</span>
            </Button>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium">{selectedCount} selected</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => bulk("activate")}>
                <CheckCircle2 className="h-4 w-4" /><span className="ml-2">Activate</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk("suspend")}>
                <PauseCircle className="h-4 w-4" /><span className="ml-2">Suspend</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => bulk("delete")}>
                <Trash2 className="h-4 w-4" /><span className="ml-2">Archive</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={8} /></div>
        ) : isError ? (
          <ErrorState title="Failed to load organizations" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organizations found"
            description="Try clearing filters or create your first organization."
            action={{ label: "New organization", onClick: () => setWizardOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.name}`} /></TableCell>
                    <TableCell>
                      <Link to="/organizations/$orgId" params={{ orgId: r.id }} className="group flex flex-col">
                        <span className="font-medium text-foreground group-hover:text-primary">{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.slug}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{r.orgType}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{r.contactEmail}</span>
                        {r.contactPhone && <span className="text-xs text-muted-foreground">{r.contactPhone}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.subscriptionTier ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <RowActions org={r} onAction={(a) => {
                        if (a === "activate" || a === "suspend") {
                          updateStatus.mutate({ ids: [r.id], status: a === "activate" ? "active" : "suspended" }, {
                            onSuccess: () => toast.success(`${r.name} ${a}d`),
                            onError: (err) => toast.error((err as unknown as AppError).message || `Failed to ${a}`),
                          });
                        } else if (a === "delete") {
                          setConfirm({
                            title: `Archive ${r.name}?`, description: "This archives the organization.", destructive: true,
                            onConfirm: async () => { await remove.mutateAsync([r.id]); toast.success("Archived"); },
                          });
                        }
                      }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span>–
              <span className="text-foreground">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="text-foreground">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">Page {page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <OrganizationWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel="Confirm"
        destructive={confirm?.destructive}
        onConfirm={() => { confirm?.onConfirm(); setConfirm(null); }}
      />
    </div>
  );
}

function RowActions({ org, onAction }: {
  org: Organization;
  onAction: (a: "activate" | "suspend" | "delete") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/organizations/$orgId" params={{ orgId: org.id }}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {org.status === "suspended" ? (
          <DropdownMenuItem onClick={() => onAction("activate")}>Activate</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction("suspend")}>Suspend</DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction("delete")}>
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
