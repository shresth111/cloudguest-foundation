import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useBlockGuest, useGuestList, useUnblockGuest } from "@/hooks/useGuests";
import type { AppError } from "@/services/api";
import type { GuestListQuery } from "@/types/guest";

export function GuestListTable() {
  const [search, setSearch] = useState("");
  const [isBlocked, setIsBlocked] = useState<boolean | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [reasonOpen, setReasonOpen] = useState<string | null>(null);

  const query: GuestListQuery = useMemo(
    () => ({ search, isBlocked, page, pageSize }),
    [search, isBlocked, page],
  );
  const { data, isLoading, isError, refetch } = useGuestList(query);
  const block = useBlockGuest();
  const unblock = useUnblockGuest();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleUnblock(guestId: string) {
    try {
      await unblock.mutateAsync(guestId);
      toast.success("Guest unblocked");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to unblock guest");
    }
  }

  async function handleBlock(guestId: string) {
    try {
      await block.mutateAsync({ guestId, reason: "Blocked from guest list" });
      toast.success("Guest blocked");
      setReasonOpen(null);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to block guest");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search identifier or name…"
              className="pl-9"
            />
          </div>
          <Select
            value={String(isBlocked)}
            onValueChange={(v) => {
              setIsBlocked(v === "all" ? "all" : v === "true");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All guests</SelectItem>
              <SelectItem value="false">Not blocked</SelectItem>
              <SelectItem value="true">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} />
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load guests" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No guests found"
            description="Guests appear here once they authenticate."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Guest</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((g) => (
                  <TableRow key={g.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Link
                        to="/guests/$guestId"
                        params={{ guestId: g.id }}
                        className="group flex flex-col"
                      >
                        <span className="font-medium group-hover:text-primary">
                          {g.displayName ?? g.identifier}
                        </span>
                        <span className="text-xs text-muted-foreground">{g.identifier}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.organizationName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.locationName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{g.totalVisitCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(g.firstSeenAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(g.lastSeenAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.isBlocked ? "destructive" : "outline"}>
                        {g.isBlocked ? "Blocked" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {g.isBlocked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleUnblock(g.id)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span className="ml-1">Unblock</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive"
                          onClick={() => setReasonOpen(g.id)}
                        >
                          Block
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!reasonOpen}
        onOpenChange={(o) => !o && setReasonOpen(null)}
        title="Block guest?"
        description="The guest will be denied access until unblocked."
        destructive
        onConfirm={() => reasonOpen && handleBlock(reasonOpen)}
      />
    </div>
  );
}
