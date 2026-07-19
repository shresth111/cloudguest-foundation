import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Download,
  MoreHorizontal,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { PaymentStatusBadge, SubscriptionStatusBadge } from "./BillingBadges";
import { useCancelSubscription, useDowngradeSubscription, useUpgradeSubscription } from "@/hooks/useBilling";
import type { Subscription, SubscriptionStatus } from "@/types/billing";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface Props {
  data?: Subscription[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
  onCreate?: () => void;
}

const PAGE_SIZE = 8;

export function SubscriptionTable({ data, isLoading, isError, onRetry, onRefresh, onCreate }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus | "all">("all");
  const [sortKey, setSortKey] = useState<keyof Subscription>("renewalDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ action: "cancel"; id: string } | null>(null);

  const cancel = useCancelSubscription();
  const upgrade = useUpgradeSubscription();
  const downgrade = useDowngradeSubscription();

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter((r) => r.organizationName.toLowerCase().includes(s) || r.planName.toLowerCase().includes(s));
    }
    if (status !== "all") rows = rows.filter((r) => r.status === status);
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] as unknown as string | number;
      const bv = b[sortKey] as unknown as string | number;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, q, status, sortKey, sortDir]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const toggleSort = (k: keyof Subscription) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Organization", "Plan", "Cycle", "Start", "Renewal", "Expiry", "Status", "Amount", "Auto renewal", "Payment"].join(","),
      ...filtered.map((s) =>
        [
          s.organizationName,
          s.planName,
          s.billingCycle,
          s.startDate,
          s.renewalDate,
          s.expiryDate,
          s.status,
          s.amount,
          s.autoRenewal ? "yes" : "no",
          s.paymentStatus,
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscriptions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Subscriptions</CardTitle>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {data?.length ?? 0} subscriptions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCcw className="mr-1.5 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
            {onCreate && (
              <Button size="sm" onClick={onCreate}>
                New subscription
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search organization or plan…" className="pl-8" />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v as SubscriptionStatus | "all"); setPage(1); }}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : isError ? (
            <ErrorState onRetry={onRetry} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No subscriptions" description="Try adjusting your filters or create a new subscription." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("organizationName")}>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("startDate")}>Start</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("renewalDate")}>Renewal</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("amount")}>Amount</TableHead>
                    <TableHead className="text-center">Auto</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{s.organizationName}</TableCell>
                      <TableCell>{s.planName}</TableCell>
                      <TableCell className="capitalize">{s.billingCycle}</TableCell>
                      <TableCell>{dateFmt.format(new Date(s.startDate))}</TableCell>
                      <TableCell>{dateFmt.format(new Date(s.renewalDate))}</TableCell>
                      <TableCell>{dateFmt.format(new Date(s.expiryDate))}</TableCell>
                      <TableCell><SubscriptionStatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-right">{money.format(s.amount)}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={s.autoRenewal} onCheckedChange={() => toast.info("Auto renewal updated")} />
                      </TableCell>
                      <TableCell><PaymentStatusBadge status={s.paymentStatus} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => upgrade.mutate(s.id, { onSuccess: () => toast.success("Plan upgraded") })}>
                              <ArrowUpCircle className="mr-2 h-4 w-4" /> Upgrade plan
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => downgrade.mutate(s.id, { onSuccess: () => toast.success("Plan downgraded") })}>
                              <ArrowDownCircle className="mr-2 h-4 w-4" /> Downgrade plan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onSelect={() => setPending({ action: "cancel", id: s.id })}>
                              <XCircle className="mr-2 h-4 w-4" /> Cancel subscription
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
        title="Cancel subscription?"
        description="The organization will lose access at the end of the current cycle. This action can be reversed."
        confirmLabel="Cancel subscription"
        destructive
        onConfirm={() => {
          if (!pending) return;
          cancel.mutate(pending.id, { onSuccess: () => toast.success("Subscription canceled") });
          setPending(null);
        }}
      />
    </>
  );
}
