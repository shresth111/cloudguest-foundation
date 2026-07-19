import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Eye, Mail, MoreHorizontal, RotateCcw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentStatusBadge } from "./BillingBadges";
import { useRefundPayment } from "@/hooks/useBilling";
import type { Payment, PaymentGateway, PaymentStatus } from "@/types/billing";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface Props {
  data?: Payment[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function PaymentTable({ data, isLoading, isError, onRetry }: Props) {
  const [q, setQ] = useState("");
  const [gateway, setGateway] = useState<PaymentGateway | "all">("all");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const refund = useRefundPayment();

  const rows = useMemo(() => {
    let r = data ?? [];
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((p) => p.organizationName.toLowerCase().includes(s) || p.invoiceNumber.toLowerCase().includes(s) || p.transactionId.toLowerCase().includes(s));
    }
    if (gateway !== "all") r = r.filter((p) => p.gateway === gateway);
    if (status !== "all") r = r.filter((p) => p.status === status);
    return r.slice(0, 20);
  }, [data, q, gateway, status]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, org or txn id…" className="pl-8" />
            </div>
            <Select value={gateway} onValueChange={(v) => setGateway(v as PaymentGateway | "all")}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Gateway" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All gateways</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus | "all")}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : isError ? (
            <ErrorState onRetry={onRetry} />
          ) : rows.length === 0 ? (
            <EmptyState title="No payments" description="No transactions match your current filters." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{p.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">{p.organizationName}</TableCell>
                      <TableCell className="text-right">{money.format(p.amount)}</TableCell>
                      <TableCell className="text-right">{money.format(p.tax)}</TableCell>
                      <TableCell className="text-right">{money.format(p.discount)}</TableCell>
                      <TableCell className="capitalize">{p.gateway}</TableCell>
                      <TableCell className="font-mono text-xs">{p.transactionId}</TableCell>
                      <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                      <TableCell>{dateFmt.format(new Date(p.paidAt))}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => toast.info(`Viewing invoice ${p.invoiceNumber}`)}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => toast.success(`Downloading ${p.invoiceNumber}`)}><Download className="mr-2 h-4 w-4" /> Download invoice</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => toast.success(`Invoice emailed to ${p.organizationName}`)}><Mail className="mr-2 h-4 w-4" /> Resend invoice</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              disabled={p.status === "refunded"}
                              onSelect={() => setRefunding(p)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Refund
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
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!refunding}
        onOpenChange={(o) => !o && setRefunding(null)}
        title="Refund this payment?"
        description={`Refund ${refunding ? money.format(refunding.amount) : ""} to ${refunding?.organizationName}. This is a mock action.`}
        confirmLabel="Issue refund"
        destructive
        onConfirm={() => {
          if (!refunding) return;
          refund.mutate(refunding.id, { onSuccess: () => toast.success("Refund issued") });
          setRefunding(null);
        }}
      />
    </>
  );
}
