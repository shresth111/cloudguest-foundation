import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Copy,
  Download,
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PortalStatusBadge, LoginMethodBadge } from "./PortalBadges";
import { PortalWizard } from "./PortalWizard";
import {
  useDeletePortal,
  useDuplicatePortal,
  usePortalList,
  useSetPortalStatus,
} from "@/hooks/usePortals";
import type { Portal, PortalListQuery, PortalLoginMethod, PortalStatus } from "@/types/portal";
import { portalService } from "@/services/portal.service";

const PAGE_SIZE = 10;

function toCsv(rows: Portal[]) {
  const header = ["id", "name", "organization", "location", "method", "theme", "status", "updated"];
  const body = rows.map((p) =>
    [
      p.id,
      p.name,
      p.organizationName,
      p.locationName,
      p.primaryLoginMethod,
      p.themeName,
      p.status,
      p.updatedAt,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export function PortalTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PortalStatus | "all">("all");
  const [orgId, setOrgId] = useState<string>("all");
  const [method, setMethod] = useState<PortalLoginMethod | "all">("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Portal>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [previewPortal, setPreviewPortal] = useState<Portal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const orgs = useMemo(() => portalService.organizations(), []);

  const query: PortalListQuery = {
    search: search || undefined,
    status: status === "all" ? undefined : status,
    organizationId: orgId === "all" ? undefined : orgId,
    loginMethod: method === "all" ? undefined : method,
    page,
    pageSize: PAGE_SIZE,
    sort: { key: sortKey, dir: sortDir },
  };

  const { data, isLoading, isError, refetch } = usePortalList(query);
  const setStatusMut = useSetPortalStatus();
  const dupMut = useDuplicatePortal();
  const delMut = useDeletePortal();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  const toggleSort = (k: keyof Portal) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) items.forEach((i) => next.delete(i.id));
      else items.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const exportCsv = () => {
    const csv = toCsv(items);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Captive portals</CardTitle>
          <p className="text-sm text-muted-foreground">
            {total} portal{total === 1 ? "" : "s"} across {orgs.length} organizations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New portal
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, ID, org, location…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as PortalStatus | "all")}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Organization" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={(v) => setMethod(v as PortalLoginMethod | "all")}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="mobile_otp">Mobile OTP</SelectItem>
              <SelectItem value="email_otp">Email OTP</SelectItem>
              <SelectItem value="voucher">Voucher</SelectItem>
              <SelectItem value="pms">PMS</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="click_through">Click-through</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span>{selected.size} selected</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  Array.from(selected).forEach((id) => setStatusMut.mutate({ id, status: "published" }));
                  setSelected(new Set());
                }}
              >
                <Upload className="mr-2 h-4 w-4" /> Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  Array.from(selected).forEach((id) => setStatusMut.mutate({ id, status: "draft" }));
                  setSelected(new Set());
                }}
              >
                Unpublish
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  Array.from(selected).forEach((id) => delMut.mutate(id));
                  setSelected(new Set());
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No portals match your filters"
            description="Adjust filters or create a new captive portal."
            action={{ label: "New portal", onClick: () => setWizardOpen(true) }}
          />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                      Portal <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("updatedAt")}>
                      Updated <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Published by</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleRow(p.id)} />
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/portals/$portalId"
                        params={{ portalId: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.id}</div>
                    </TableCell>
                    <TableCell className="text-sm">{p.organizationName}</TableCell>
                    <TableCell className="text-sm">{p.locationName}</TableCell>
                    <TableCell><LoginMethodBadge method={p.primaryLoginMethod} /></TableCell>
                    <TableCell className="text-sm">{p.themeName}</TableCell>
                    <TableCell><PortalStatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.publishedBy ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPreviewPortal(p)}>
                            <Eye className="mr-2 h-4 w-4" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => dupMut.mutate(p.id)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          {p.status === "published" ? (
                            <DropdownMenuItem
                              onClick={() => setStatusMut.mutate({ id: p.id, status: "draft" })}
                            >
                              Unpublish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setStatusMut.mutate({ id: p.id, status: "published" })}
                            >
                              <Upload className="mr-2 h-4 w-4" /> Publish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConfirmDelete(p.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
              Next
            </Button>
          </div>
        </div>
      </CardContent>

      <PortalWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      <Dialog open={!!previewPortal} onOpenChange={(o) => !o && setPreviewPortal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewPortal?.name}</DialogTitle>
          </DialogHeader>
          {previewPortal && (
            <div
              className="aspect-video overflow-hidden rounded-lg border"
              style={{
                background: `linear-gradient(135deg, ${previewPortal.branding.gradientFrom}, ${previewPortal.branding.gradientTo})`,
              }}
            >
              <div className="flex h-full items-center justify-center">
                <div className="rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
                  <div className="text-white/80 text-sm">Welcome to</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{previewPortal.organizationName}</div>
                  <button
                    className="mt-6 rounded-lg px-5 py-2 text-sm font-medium text-white"
                    style={{ background: previewPortal.branding.primaryColor }}
                  >
                    Connect to WiFi
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete portal?"
        description="This will permanently remove the portal and its versions. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDelete) delMut.mutate(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </Card>
  );
}
