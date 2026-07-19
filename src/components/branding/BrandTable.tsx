import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, MoreHorizontal, Rocket, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDeleteBrand, useDuplicateBrand, usePublishBrand } from "@/hooks/useBranding";
import type { Brand, BrandStatus, CustomDomain } from "@/types/branding";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const statusVariant: Record<BrandStatus, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
};

interface Props {
  data?: Brand[];
  domains?: CustomDomain[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (id: string) => void;
  selectedId?: string;
}

const PAGE_SIZE = 8;

export function BrandTable({ data, domains, isLoading, isError, onRetry, onSelect, selectedId }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BrandStatus | "all">("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ action: "delete"; id: string; name: string } | null>(null);

  const publish = usePublishBrand();
  const duplicate = useDuplicateBrand();
  const del = useDeleteBrand();

  const domainByBrand = useMemo(() => {
    const m = new Map<string, CustomDomain>();
    (domains ?? []).forEach((d) => m.set(d.brandId, d));
    return m;
  }, [domains]);

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.organizationName.toLowerCase().includes(s));
    }
    if (status !== "all") rows = rows.filter((r) => r.status === status);
    rows = [...rows].sort((a, b) => {
      const cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [data, q, status, sortDir]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const exportCsv = () => {
    const rows = [
      ["Brand", "Organization", "Domain", "Status", "Primary color", "Updated"].join(","),
      ...filtered.map((b) => [b.name, b.organizationName, domainByBrand.get(b.id)?.domain ?? "", b.status, b.colors.primary, b.updatedAt].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brands.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Brands</CardTitle>
            <p className="text-xs text-muted-foreground">{filtered.length} of {data?.length ?? 0} brands</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" /> Export CSV</Button>
            <Button variant="outline" size="sm" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>Sort: {sortDir === "asc" ? "Oldest" : "Newest"}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search brand or organization…" className="pl-8" />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v as BrandStatus | "all"); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>
          ) : isError ? (
            <ErrorState onRetry={onRetry} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No brands" description="Adjust filters or create a new brand." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Logo</TableHead>
                    <TableHead>Theme</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((b) => {
                    const dom = domainByBrand.get(b.id);
                    return (
                      <TableRow
                        key={b.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedId === b.id ? "bg-muted/50" : ""}`}
                        onClick={() => onSelect(b.id)}
                      >
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell>{b.organizationName}</TableCell>
                        <TableCell>
                          <img src={b.logos.company} alt="" className="h-8 w-8 rounded-md border object-cover" />
                        </TableCell>
                        <TableCell className="capitalize">{b.typography.fontFamily}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded border" style={{ background: b.colors.primary }} />
                            <span className="font-mono text-xs">{b.colors.primary}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{dom?.domain ?? "—"}</TableCell>
                        <TableCell><Badge variant={statusVariant[b.status]} className="capitalize">{b.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{dateFmt.format(new Date(b.updatedAt))}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => publish.mutate(b.id, { onSuccess: () => toast.success("Brand published") })}>
                                <Rocket className="mr-2 h-4 w-4" /> Publish
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => duplicate.mutate(b.id, { onSuccess: () => toast.success("Brand duplicated") })}>
                                <Copy className="mr-2 h-4 w-4" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onSelect={() => setPending({ action: "delete", id: b.id, name: b.name })}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>Page {page} of {pageCount}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Delete "${pending?.name}"?`}
        description="This will permanently remove the brand configuration."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!pending) return;
          del.mutate(pending.id, { onSuccess: () => toast.success("Brand deleted") });
          setPending(null);
        }}
      />
    </>
  );
}
