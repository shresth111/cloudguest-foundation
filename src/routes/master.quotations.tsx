import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Plus,
  Trash2,
  Download,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MStat,
  MSeg,
  MTag,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  MDialog,
  MButton,
  MField,
  M_INPUT,
} from "@/components/master/MasterKit";
import { quotationService } from "@/services/quotation.service";
import {
  QUOTATION_STATUS_LABEL,
  type Quotation,
  type QuotationLineItemInput,
  type QuotationStatus,
} from "@/types/quotation";

export const Route = createFileRoute("/master/quotations")({
  component: QuotationsScreen,
});

type Filter = "all" | QuotationStatus;

const STATUS_TONE: Record<QuotationStatus, string> = {
  draft: "pending",
  sent: "active",
  failed: "urgent",
};

function emptyLineItem(): QuotationLineItemInput {
  return { description: "", quantity: 1, unitPrice: 0 };
}

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function downloadBlob(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function QuotationsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompanyName, setClientCompanyName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxPercentage, setTaxPercentage] = useState("0");
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<QuotationLineItemInput[]>([emptyLineItem()]);

  async function refetch() {
    setLoading(true);
    try {
      const rows = await quotationService.list();
      setQuotations(rows);
    } catch {
      toast.error("Could not load quotations from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotations.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      return (
        row.clientName.toLowerCase().includes(q) ||
        row.clientEmail.toLowerCase().includes(q) ||
        row.clientCompanyName.toLowerCase().includes(q) ||
        row.quotationNumber.toLowerCase().includes(q)
      );
    });
  }, [quotations, filter, search]);

  const sentCount = quotations.filter((r) => r.status === "sent").length;
  const failedCount = quotations.filter((r) => r.status === "failed").length;
  const totalQuoted = quotations.reduce((sum, r) => sum + r.totalAmount, 0);

  function resetForm() {
    setClientName("");
    setClientEmail("");
    setClientCompanyName("");
    setCurrency("USD");
    setTaxPercentage("0");
    setValidUntil(defaultValidUntil());
    setNotes("");
    setLineItems([emptyLineItem()]);
  }

  function updateLineItem(index: number, patch: Partial<QuotationLineItemInput>) {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const draftSubtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const draftTaxAmount = (draftSubtotal * (Number(taxPercentage) || 0)) / 100;
  const draftTotal = draftSubtotal + draftTaxAmount;

  async function handleGenerateAndSend() {
    if (!clientName.trim() || !clientEmail.trim() || !clientCompanyName.trim()) {
      toast.error("Please fill in the client's name, email and company/property name.");
      return;
    }
    const validLineItems = lineItems.filter(
      (item) => item.description.trim() && item.unitPrice >= 0,
    );
    if (validLineItems.length === 0) {
      toast.error("Add at least one line item with a description.");
      return;
    }
    setSaving(true);
    try {
      const quotation = await quotationService.createAndSend({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientCompanyName: clientCompanyName.trim(),
        lineItems: validLineItems,
        taxPercentage: Number(taxPercentage) || 0,
        currency,
        validUntil: new Date(validUntil).toISOString(),
        notes: notes.trim() || undefined,
      });
      setQuotations((prev) => [quotation, ...prev]);
      setCreateOpen(false);
      resetForm();
      if (quotation.status === "sent") {
        toast.success(
          `Quotation ${quotation.quotationNumber} generated and emailed to ${quotation.clientEmail}`,
        );
      } else {
        toast.warning(
          `Quotation ${quotation.quotationNumber} generated, but the email could not be sent`,
          {
            description: quotation.emailError ?? undefined,
          },
        );
      }
    } catch {
      toast.error("Could not generate this quotation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(q: Quotation) {
    setDownloadingId(q.id);
    try {
      const { url, fileName } = await quotationService.downloadPdf(q.id, q.quotationNumber);
      downloadBlob(url, fileName);
    } catch {
      toast.error("Could not download this quotation's PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <MasterShell title="Quotations">
      <MPageShell>
        <MSectionHeader
          eyebrow="Sales"
          title="Quotations"
          actions={
            <MButton variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus /> Generate & Send
            </MButton>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MStat label="Total Quotations" value={String(quotations.length)} icon={FileText} />
          <MStat
            label="Sent"
            value={String(sentCount)}
            icon={CheckCircle2}
            accent={sentCount > 0}
          />
          <MStat label="Failed" value={String(failedCount)} icon={XCircle} />
          <MStat
            label="Total Quoted"
            value={quotations.length ? money(totalQuoted, quotations[0].currency) : "—"}
            icon={Send}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <MSeg
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "sent", label: "Sent" },
              { value: "failed", label: "Failed" },
            ]}
          />
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${M_INPUT} pl-8`}
              placeholder="Search client, company, number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <MTable
          loading={loading}
          head={
            <>
              <MTh>Quotation #</MTh>
              <MTh>Client</MTh>
              <MTh className="hidden sm:table-cell">Company</MTh>
              <MTh>Status</MTh>
              <MTh>Amount</MTh>
              <MTh className="hidden md:table-cell">Created</MTh>
            </>
          }
        >
          {!loading &&
            rows.map((q) => (
              <MTr key={q.id} onClick={() => setSelected(q)}>
                <MTd className="font-mono text-sm font-bold text-primary">{q.quotationNumber}</MTd>
                <MTd>
                  <p className="font-semibold">{q.clientName}</p>
                  <p className="text-xs text-muted-foreground">{q.clientEmail}</p>
                </MTd>
                <MTd className="hidden text-sm sm:table-cell">{q.clientCompanyName}</MTd>
                <MTd>
                  <MTag label={QUOTATION_STATUS_LABEL[q.status]} tone={STATUS_TONE[q.status]} />
                </MTd>
                <MTd className="text-sm font-semibold tabular-nums">
                  {money(q.totalAmount, q.currency)}
                </MTd>
                <MTd className="hidden text-xs text-muted-foreground md:table-cell">
                  {new Date(q.createdAt).toLocaleString()}
                </MTd>
              </MTr>
            ))}
          {!loading && rows.length === 0 && (
            <MTr>
              <MTd className="py-10 text-center text-muted-foreground">
                <span className="block">No quotations match this filter.</span>
              </MTd>
            </MTr>
          )}
        </MTable>
        <p className="text-xs text-muted-foreground">
          Every quotation generated from "Generate & Send" appears here, whether or not the email
          delivered.
        </p>

        {/* Detail drawer */}
        <MDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.quotationNumber ?? ""}
          subtitle={
            selected
              ? `${selected.clientCompanyName} · created ${new Date(selected.createdAt).toLocaleDateString()}`
              : ""
          }
          footer={
            selected && (
              <MButton
                variant="primary"
                disabled={downloadingId === selected.id}
                onClick={() => handleDownload(selected)}
              >
                {downloadingId === selected.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download />
                )}{" "}
                Download PDF
              </MButton>
            )
          }
        >
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Client</p>
                  <p className="mt-1 text-sm font-semibold">{selected.clientName}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="mt-1 text-sm font-semibold">{selected.clientEmail}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Company</p>
                  <p className="mt-1 text-sm font-semibold">{selected.clientCompanyName}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="mt-1.5">
                    <MTag
                      label={QUOTATION_STATUS_LABEL[selected.status]}
                      tone={STATUS_TONE[selected.status]}
                    />
                  </div>
                </div>
              </div>

              {selected.status === "failed" && selected.emailError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  Delivery failed: {selected.emailError}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Line Items</p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lineItems.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {money(item.unitPrice, selected.currency)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {money(item.amount, selected.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    {money(selected.subtotal, selected.currency)}
                  </span>
                </div>
                {selected.taxPercentage > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({selected.taxPercentage}%)</span>
                    <span className="tabular-nums">
                      {money(selected.taxAmount, selected.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {money(selected.totalAmount, selected.currency)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Valid Until</p>
                  <p className="mt-1">{new Date(selected.validUntil).toLocaleDateString()}</p>
                </div>
                {selected.sentAt && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Sent</p>
                    <p className="mt-1">{new Date(selected.sentAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selected.notes && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap text-sm">{selected.notes}</p>
                </div>
              )}
            </div>
          )}
        </MDrawer>

        {/* Create dialog */}
        <MDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Generate & Send Quotation"
          wide
          footer={
            <>
              <MButton variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </MButton>
              <MButton variant="primary" onClick={handleGenerateAndSend} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Send /> Generate & Send
                  </>
                )}
              </MButton>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <MField label="Client name">
                <input
                  className={M_INPUT}
                  placeholder="Jane Doe"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </MField>
              <MField label="Client email">
                <input
                  type="email"
                  className={M_INPUT}
                  placeholder="jane@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </MField>
              <MField label="Company / property name">
                <input
                  className={M_INPUT}
                  placeholder="Example Hotel"
                  value={clientCompanyName}
                  onChange={(e) => setClientCompanyName(e.target.value)}
                />
              </MField>
              <MField label="Valid until">
                <input
                  type="date"
                  className={M_INPUT}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </MField>
              <MField label="Currency">
                <select
                  className={M_INPUT}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {["USD", "INR", "EUR", "GBP"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </MField>
              <MField label="Tax %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={M_INPUT}
                  value={taxPercentage}
                  onChange={(e) => setTaxPercentage(e.target.value)}
                />
              </MField>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Line Items</p>
                <MButton variant="outline" onClick={addLineItem}>
                  <Plus className="h-3.5 w-3.5" /> Add line
                </MButton>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 items-center gap-2">
                    <input
                      className={`${M_INPUT} col-span-6`}
                      placeholder="Description (e.g. WyfyGuest Standard Plan)"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, { description: e.target.value })}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={`${M_INPUT} col-span-2`}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(index, { quantity: Number(e.target.value) || 0 })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${M_INPUT} col-span-3`}
                      placeholder="Unit price"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateLineItem(index, { unitPrice: Number(e.target.value) || 0 })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove line item"
                      disabled={lineItems.length === 1}
                      onClick={() => removeLineItem(index)}
                      className="col-span-1 inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <MField label="Notes (optional)">
              <textarea
                className={`${M_INPUT} min-h-20`}
                placeholder="Payment terms, discounts, or anything else the client should know…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </MField>

            <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(draftSubtotal, currency)}</span>
              </div>
              {Number(taxPercentage) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({taxPercentage}%)</span>
                  <span className="tabular-nums">{money(draftTaxAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{money(draftTotal, currency)}</span>
              </div>
            </div>
          </div>
        </MDialog>
      </MPageShell>
    </MasterShell>
  );
}
