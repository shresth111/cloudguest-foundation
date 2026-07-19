import { toast } from "sonner";
import { Download, FileText, Mail, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentStatusBadge, InvoiceTypeLabel } from "./BillingBadges";
import type { Invoice } from "@/types/billing";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface Props {
  data?: Invoice[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function InvoiceManagement({ data, isLoading, isError, onRetry }: Props) {
  const [previewing, setPreviewing] = useState<Invoice | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Invoices</CardTitle>
            <p className="text-xs text-muted-foreground">Tax invoices, credit and debit notes.</p>
          </div>
          <Button size="sm" onClick={() => toast.success("Generated new invoice")}>
            <FileText className="mr-1.5 h-4 w-4" /> Generate invoice
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : isError ? (
            <ErrorState onRetry={onRetry} />
          ) : !data || data.length === 0 ? (
            <EmptyState title="No invoices yet" description="Invoices will appear here as payments are captured." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 15).map((i) => (
                    <TableRow key={i.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{i.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">{i.organizationName}</TableCell>
                      <TableCell><InvoiceTypeLabel type={i.type} /></TableCell>
                      <TableCell className="text-right">{money.format(i.amount)}</TableCell>
                      <TableCell className="text-right">{money.format(i.tax)}</TableCell>
                      <TableCell className="text-right font-semibold">{money.format(i.total)}</TableCell>
                      <TableCell>{dateFmt.format(new Date(i.issuedAt))}</TableCell>
                      <TableCell>{dateFmt.format(new Date(i.dueAt))}</TableCell>
                      <TableCell><PaymentStatusBadge status={i.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewing(i)}><FileText className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.success("Download started")}><Download className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.success("Print sent")}><Printer className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.success("Invoice emailed")}><Mail className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice preview</DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">CloudGuest</div>
                  <div className="mt-1 text-lg font-semibold">Invoice {previewing.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">Issued {dateFmt.format(new Date(previewing.issuedAt))}</div>
                </div>
                <PaymentStatusBadge status={previewing.status} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Billed to</div>
                  <div className="mt-1 font-medium">{previewing.organizationName}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Due date</div>
                  <div className="mt-1 font-medium">{dateFmt.format(new Date(previewing.dueAt))}</div>
                </div>
              </div>
              <div className="mt-6 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{money.format(previewing.amount)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{money.format(previewing.tax)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{money.format(previewing.total)}</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => toast.success("Print sent")}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
            <Button onClick={() => toast.success("Downloaded PDF")}><Download className="mr-1.5 h-4 w-4" /> Download PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
