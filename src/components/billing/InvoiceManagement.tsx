import { toast } from "sonner";
import { Download, FileText, Loader2, Mail, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentStatusBadge, InvoiceTypeLabel } from "./BillingBadges";
import type { Invoice } from "@/types/billing";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDownloadInvoice, useGenerateAndSendInvoice } from "@/hooks/useBilling";
import type { Subscription } from "@/types/billing";
import type { AppError } from "@/services/api";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface Props {
  data?: Invoice[];
  subscriptions?: Subscription[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function InvoiceManagement({ data, subscriptions, isLoading, isError, onRetry }: Props) {
  const [previewing, setPreviewing] = useState<Invoice | null>(null);
  const download = useDownloadInvoice();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateOrgId, setGenerateOrgId] = useState("");
  const generateAndSend = useGenerateAndSendInvoice();
  // An invoice is generated against an organization's existing
  // subscription (InvoiceService.resolve_subscription_for_organization
  // defaults to it when no subscription_id is given) -- so the picker
  // needs orgs that HAVE one, the opposite of CreateSubscriptionDialog's
  // useOrganizationsList() (which deliberately excludes orgs that already
  // have a subscription, since that dialog is for provisioning a new
  // one). De-duplicated since an org could theoretically show up via more
  // than one subscription row (e.g. a cancelled one alongside a current
  // one).
  const invoiceableOrgs = Array.from(
    new Map((subscriptions ?? []).map((s) => [s.organizationId, s.organizationName])).entries(),
  ).map(([id, name]) => ({ id, name }));

  function handleGenerateAndSend() {
    generateAndSend.mutate(
      { organizationId: generateOrgId },
      {
        onSuccess: (res) => {
          if (res.emailSent) {
            toast.success(`Invoice ${res.invoiceNumber} generated and emailed to ${res.emailRecipient}`);
          } else {
            toast.warning(`Invoice ${res.invoiceNumber} generated, but the email couldn't be sent (${res.emailError ?? "unknown error"}). Download it manually from the table below.`);
          }
          setGenerateOpen(false);
          setGenerateOrgId("");
        },
        onError: (err) => toast.error((err as unknown as AppError).message || "Could not generate the invoice."),
      },
    );
  }

  function handleDownload(inv: Invoice) {
    setDownloadingId(inv.id);
    download.mutate(
      { id: inv.id, organizationId: inv.organizationId },
      {
        onSuccess: ({ url, fileName }) => {
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          toast.success(`Downloading ${inv.invoiceNumber} (GST invoice PDF)`);
        },
        onError: () => toast.error("Could not download the invoice PDF."),
        onSettled: () => setDownloadingId(null),
      },
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Invoices</CardTitle>
            <p className="text-xs text-muted-foreground">GST tax invoices, credit and debit notes. Generated automatically each billing cycle.</p>
          </div>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Mail className="mr-1.5 h-4 w-4" /> Generate &amp; send
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
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
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
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewing(i)} title="Preview"><FileText className="h-3.5 w-3.5" /></Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={downloadingId === i.id}
                            onClick={() => handleDownload(i)}
                            title="Download GST invoice PDF"
                          >
                            {downloadingId === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          </Button>
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
                <div className="flex justify-between"><span>GST</span><span>{money.format(previewing.tax)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{money.format(previewing.total)}</span></div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                The downloaded PDF shows the full CGST/SGST/IGST split per the buyer's billing state.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
            <Button disabled={!!downloadingId} onClick={() => previewing && handleDownload(previewing)}>
              {downloadingId === previewing?.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateOpen} onOpenChange={(o) => { setGenerateOpen(o); if (!o) setGenerateOrgId(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate &amp; send invoice</DialogTitle>
            <DialogDescription>
              Creates a real GST invoice for the organization's current subscription and emails it to their billing contact as a PDF.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Organization</Label>
            <Select value={generateOrgId} onValueChange={setGenerateOrgId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {invoiceableOrgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button disabled={!generateOrgId || generateAndSend.isPending} onClick={handleGenerateAndSend}>
              {generateAndSend.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
              Generate &amp; send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
