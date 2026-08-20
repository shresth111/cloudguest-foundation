import { toast } from "sonner";
import { Download, FileText, Loader2, Mail, Plus, Printer, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge, InvoiceTypeLabel } from "./BillingBadges";
import type { Invoice } from "@/types/billing";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateManualInvoice,
  useDownloadInvoice,
  useOrganizationsList,
} from "@/hooks/useBilling";
import type { Subscription } from "@/types/billing";
import type { AppError } from "@/services/api";

const money2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

interface LineItemDraft {
  description: string;
  quantity: string;
  unitPrice: string;
}
const blankLineItem = (): LineItemDraft => ({ description: "", quantity: "1", unitPrice: "" });

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
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
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([blankLineItem()]);
  const createManualInvoice = useCreateManualInvoice();
  const orgsWithoutSubscription = useOrganizationsList();
  // A manual invoice only needs a BillingProfile on file, not an active
  // subscription (it's for a one-off/custom charge, see
  // InvoiceService.create_manual_invoice) -- so the picker should offer
  // every known organization, not just the ones with a subscription
  // (useGenerateAndSendInvoice's old picker) or only the ones without one
  // (CreateSubscriptionDialog's useOrganizationsList). Merge both known
  // lists and de-duplicate by id.
  const orgsFromSubscriptions = (subscriptions ?? []).map((s) => ({
    id: s.organizationId,
    name: s.organizationName,
  }));
  const allOrgs = Array.from(
    new Map(
      [...orgsFromSubscriptions, ...(orgsWithoutSubscription.data ?? [])].map((o) => [
        o.id,
        o.name,
      ]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));

  function resetGenerateForm() {
    setGenerateOrgId("");
    setLineItems([blankLineItem()]);
  }

  const parsedLineItems = lineItems
    .map((li) => ({
      description: li.description.trim(),
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
    }))
    .filter((li) => li.description && li.quantity > 0 && li.unitPrice >= 0);
  const draftSubtotal = parsedLineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const canSubmit =
    !!generateOrgId && parsedLineItems.length > 0 && parsedLineItems.length === lineItems.length;

  function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }

  function handleGenerateAndSend() {
    createManualInvoice.mutate(
      { organizationId: generateOrgId, lineItems: parsedLineItems },
      {
        onSuccess: (res) => {
          if (res.emailSent) {
            toast.success(
              `Invoice ${res.invoiceNumber} generated and emailed to ${res.emailRecipient}`,
            );
          } else {
            toast.warning(
              `Invoice ${res.invoiceNumber} generated, but the email couldn't be sent (${res.emailError ?? "unknown error"}). Download it manually from the table below.`,
            );
          }
          setGenerateOpen(false);
          resetGenerateForm();
        },
        onError: (err) =>
          toast.error(
            (err as unknown as AppError).message ||
              "Could not generate the invoice -- check the organization has a billing profile on file.",
          ),
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
            <p className="text-xs text-muted-foreground">
              GST tax invoices, credit and debit notes. Generated automatically each billing cycle.
            </p>
          </div>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New invoice
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={onRetry} />
          ) : !data || data.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Invoices will appear here as payments are captured."
            />
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
                      <TableCell>
                        <InvoiceTypeLabel type={i.type} />
                      </TableCell>
                      <TableCell className="text-right">{money.format(i.amount)}</TableCell>
                      <TableCell className="text-right">{money.format(i.tax)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {money.format(i.total)}
                      </TableCell>
                      <TableCell>{dateFmt.format(new Date(i.issuedAt))}</TableCell>
                      <TableCell>{dateFmt.format(new Date(i.dueAt))}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={i.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setPreviewing(i)}
                            title="Preview"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={downloadingId === i.id}
                            onClick={() => handleDownload(i)}
                            title="Download GST invoice PDF"
                          >
                            {downloadingId === i.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
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
                  <div className="mt-1 text-lg font-semibold">
                    Invoice {previewing.invoiceNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Issued {dateFmt.format(new Date(previewing.issuedAt))}
                  </div>
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
                  <div className="mt-1 font-medium">
                    {dateFmt.format(new Date(previewing.dueAt))}
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money.format(previewing.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST</span>
                  <span>{money.format(previewing.tax)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{money.format(previewing.total)}</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                The downloaded PDF shows the full CGST/SGST/IGST split per the buyer's billing
                state.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
            <Button
              disabled={!!downloadingId}
              onClick={() => previewing && handleDownload(previewing)}
            >
              {downloadingId === previewing?.id ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}{" "}
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={generateOpen}
        onOpenChange={(o) => {
          setGenerateOpen(o);
          if (!o) resetGenerateForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New invoice</DialogTitle>
            <DialogDescription>
              Bills exactly the line items below (not the organization's subscription price) -- real
              GST is computed on the subtotal, and the PDF is emailed to their billing contact.
              Requires a billing profile on file for the organization.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label>Organization</Label>
            <Select value={generateOrgId} onValueChange={setGenerateOrgId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {allOrgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Line items</Label>
            {lineItems.map((li, i) => (
              <div key={i} className="flex items-start gap-2">
                <Input
                  placeholder="Description"
                  className="flex-1"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, { description: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Qty"
                  className="w-20"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(i, { quantity: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit price (₹)"
                  className="w-32"
                  value={li.unitPrice}
                  onChange={(e) => updateLineItem(i, { unitPrice: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={lineItems.length === 1}
                  onClick={() => setLineItems((prev) => prev.filter((_, idx) => idx !== i))}
                  title="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLineItems((prev) => [...prev, blankLineItem()])}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Subtotal (before GST)</span>
            <span className="font-semibold">{money2.format(draftSubtotal)}</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmit || createManualInvoice.isPending}
              onClick={handleGenerateAndSend}
            >
              {createManualInvoice.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-1.5 h-4 w-4" />
              )}
              Generate &amp; send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
