import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Loader2,
  Plus,
  Receipt,
  Save,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MButton,
  MDialog,
  MField,
  MPageShell,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";
import { billingDocumentService } from "@/services/billing-document.service";
import { organizationService } from "@/services/organization.service";
import {
  computeLine,
  computeTotals,
  formatAmount,
  resolveTaxMode,
} from "@/lib/billing-document-math";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  TAX_MODE_LABEL,
  type BillingDocument,
  type BillingDocumentInput,
  type BillingDocumentOptions,
  type BillingDocumentStatus,
  type BillingDocumentSummary,
  type BillingDocumentType,
  type SellerProfile,
  type SellerProfileState,
  type TaxMode,
} from "@/types/billing-document";
import type { Organization } from "@/types/organization";

/**
 * Master console -> Invoices & Quotations: a blank-form generator for a
 * Quotation or a GST Tax Invoice, for any recipient (a platform customer or
 * someone who is not on the platform at all). Staff fill the form, preview,
 * and download the PDF to send themselves -- nothing here emails anyone.
 *
 * Distinct from `/master/quotations` (generate + email in one step) and
 * from `/master/billing` (subscription invoices the platform raises).
 */
export const Route = createFileRoute("/master/billing-documents")({
  component: BillingDocumentsScreen,
});

const STATUS_TONE: Record<BillingDocumentStatus, string> = {
  draft: "pending",
  issued: "active",
  cancelled: "suspended",
};

const FALLBACK_OPTIONS: BillingDocumentOptions = {
  states: [],
  outsideIndia: "Outside India",
  numberPrefixes: { quotation: "QT", tax_invoice: "INV-M" },
};

const GST_RATES = [0, 5, 12, 18, 28];

const DEFAULT_TERMS: Record<BillingDocumentType, string> = {
  quotation: [
    "1. Prices are valid until the date stated above.",
    "2. 50% advance with the purchase order; balance on installation.",
    "3. Any additional hardware, cabling or civil work is charged separately.",
    "4. Delivery and installation timelines are confirmed at the time of order.",
  ].join("\n"),
  tax_invoice: [
    "1. Payment is due by the due date stated above.",
    "2. Please quote the invoice number with your payment.",
  ].join("\n"),
};

/** Form state keeps numbers as strings so "2." or "" can be typed. */
interface FormLine {
  key: string;
  description: string;
  hsnSac: string;
  unit: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxRate: string;
}

interface FormState extends Omit<BillingDocumentInput, "lines"> {
  lines: FormLine[];
}

type EditorTarget =
  | { mode: "new"; documentType: BillingDocumentType }
  | { mode: "edit"; document: BillingDocument };

function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function displayDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

let lineKey = 0;
function newLine(taxRate = "18"): FormLine {
  lineKey += 1;
  return {
    key: `l${lineKey}`,
    description: "",
    hsnSac: "",
    unit: "",
    quantity: "1",
    rate: "",
    discountPercent: "0",
    taxRate,
  };
}

function num(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyForm(documentType: BillingDocumentType, sellerState: string): FormState {
  const today = localToday();
  return {
    documentType,
    documentNumber: "",
    issueDate: today,
    validUntil: documentType === "quotation" ? addDays(today, 15) : "",
    dueDate: documentType === "tax_invoice" ? addDays(today, 15) : "",
    organizationId: null,
    billTo: { name: "", address: "", gstin: "", email: "", phone: "" },
    placeOfSupply: sellerState,
    taxMode: "auto",
    roundTotal: true,
    currency: "INR",
    lines: [newLine()],
    notes: "",
    terms: DEFAULT_TERMS[documentType],
  };
}

function formFromDocument(doc: BillingDocument): FormState {
  return {
    documentType: doc.documentType,
    documentNumber: doc.documentNumber,
    issueDate: doc.issueDate,
    validUntil: doc.validUntil ?? "",
    dueDate: doc.dueDate ?? "",
    organizationId: doc.organizationId,
    billTo: { ...doc.billTo },
    placeOfSupply: doc.placeOfSupply ?? "",
    // The stored mode is already resolved; keep it rather than re-deriving.
    taxMode: doc.taxMode,
    roundTotal: doc.roundTotal,
    currency: doc.currency,
    lines: doc.lines.map((line) => {
      lineKey += 1;
      return {
        key: `l${lineKey}`,
        description: line.description,
        hsnSac: line.hsnSac,
        unit: line.unit,
        quantity: String(line.quantity),
        rate: String(line.rate),
        discountPercent: String(line.discountPercent),
        taxRate: String(line.taxRate),
      };
    }),
    notes: doc.notes ?? "",
    terms: doc.terms ?? "",
  };
}

function toInput(form: FormState): BillingDocumentInput {
  return {
    ...form,
    lines: form.lines
      .filter((line) => line.description.trim())
      .map((line) => ({
        description: line.description,
        hsnSac: line.hsnSac,
        unit: line.unit,
        quantity: num(line.quantity),
        rate: num(line.rate),
        discountPercent: num(line.discountPercent),
        taxRate: num(line.taxRate),
      })),
  };
}

function openBlob(url: string, fileName?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (fileName) a.download = fileName;
  else a.target = "_blank";
  a.rel = "noopener";
  a.click();
  // Give the new tab time to read the blob before it is released.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as AppError)?.message || fallback;
}

interface ConfirmState {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  run: () => Promise<void>;
}

function BillingDocumentsScreen() {
  const { can } = useAuth();
  const perms = {
    create: can("billing_documents.create"),
    update: can("billing_documents.update"),
    remove: can("billing_documents.delete"),
    manage: can("billing_documents.manage"),
  };

  const [typeFilter, setTypeFilter] = useState<"all" | BillingDocumentType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BillingDocumentStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BillingDocumentSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [options, setOptions] = useState<BillingDocumentOptions>(FALLBACK_OPTIONS);
  const [seller, setSeller] = useState<SellerProfileState | null>(null);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function refetch() {
    setLoading(true);
    try {
      const result = await billingDocumentService.list({
        documentType: typeFilter === "all" ? undefined : typeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setRows(result.items);
      setTotalItems(result.totalItems);
    } catch (err) {
      toast.error(errorMessage(err, "Could not load documents."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(refetch, search ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    billingDocumentService
      .getOptions()
      .then(setOptions)
      .catch(() => undefined);
    billingDocumentService
      .getSellerProfile()
      .then(setSeller)
      .catch(() => undefined);
  }, []);

  async function openDocument(id: string) {
    setOpeningId(id);
    try {
      const document = await billingDocumentService.get(id);
      setEditor({ mode: "edit", document });
    } catch (err) {
      toast.error(errorMessage(err, "Could not open this document."));
    } finally {
      setOpeningId(null);
    }
  }

  if (editor) {
    return (
      <MasterShell title="Invoices & Quotations">
        <MPageShell>
          <DocumentEditor
            key={editor.mode === "edit" ? editor.document.id : `new-${editor.documentType}`}
            target={editor}
            options={options}
            seller={seller}
            perms={perms}
            onOpenSeller={() => setSellerOpen(true)}
            onClose={() => {
              setEditor(null);
              void refetch();
            }}
            onReplace={(document) => setEditor({ mode: "edit", document })}
          />
          <SellerDialog
            open={sellerOpen}
            seller={seller}
            states={options.states}
            canEdit={perms.manage}
            onClose={() => setSellerOpen(false)}
            onSaved={setSeller}
          />
        </MPageShell>
      </MasterShell>
    );
  }

  return (
    <MasterShell title="Invoices & Quotations">
      <MPageShell>
        <MSectionHeader
          eyebrow="Billing"
          title="Invoices & Quotations"
          description="Type up a quotation or a GST tax invoice for anyone, customer or not. Nothing is sent from here: download the PDF and send it yourself."
          actions={
            <div className="flex flex-wrap gap-2">
              <MButton variant="outline" onClick={() => setSellerOpen(true)}>
                <Settings2 /> Seller details
              </MButton>
              {perms.create && (
                <>
                  <MButton
                    variant="outline"
                    onClick={() => setEditor({ mode: "new", documentType: "quotation" })}
                  >
                    <FilePlus2 /> New quotation
                  </MButton>
                  <MButton
                    variant="primary"
                    onClick={() => setEditor({ mode: "new", documentType: "tax_invoice" })}
                  >
                    <Plus /> New invoice
                  </MButton>
                </>
              )}
            </div>
          }
        />

        {seller && seller.missingFields.length > 0 && (
          <SellerWarning seller={seller} onOpen={() => setSellerOpen(true)} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <MSeg
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All" },
                { value: "quotation", label: "Quotations" },
                { value: "tax_invoice", label: "Invoices" },
              ]}
            />
            <MSeg
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Any status" },
                { value: "draft", label: "Draft" },
                { value: "issued", label: "Issued" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${M_INPUT} pl-8`}
              placeholder="Search number, name, GSTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <MTable
          loading={loading}
          head={
            <>
              <MTh>Number</MTh>
              <MTh>Type</MTh>
              <MTh>Bill to</MTh>
              <MTh className="hidden md:table-cell">Date</MTh>
              <MTh>Status</MTh>
              <MTh className="text-right">Amount</MTh>
            </>
          }
        >
          {!loading &&
            rows.map((row) => (
              <MTr key={row.id} onClick={() => openDocument(row.id)}>
                <MTd className="font-mono text-sm font-bold text-primary">
                  <span className="inline-flex items-center gap-1.5">
                    {openingId === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {row.documentNumber}
                  </span>
                </MTd>
                <MTd>
                  <MTag
                    label={DOCUMENT_TYPE_LABEL[row.documentType]}
                    tone={row.documentType === "quotation" ? "brand" : "info"}
                  />
                </MTd>
                <MTd className="text-sm font-semibold">
                  {row.billToName}
                  {row.convertedInvoiceId && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Converted to invoice
                    </span>
                  )}
                </MTd>
                <MTd className="hidden text-sm text-muted-foreground md:table-cell">
                  {displayDate(row.issueDate)}
                </MTd>
                <MTd>
                  <MTag label={DOCUMENT_STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
                </MTd>
                <MTd className="text-right text-sm font-semibold tabular-nums">
                  {row.currency} {formatAmount(row.grandTotal)}
                </MTd>
              </MTr>
            ))}
          {!loading && rows.length === 0 && (
            <MTr>
              <MTd className="py-10 text-center text-muted-foreground">
                <span className="block">
                  {search || typeFilter !== "all" || statusFilter !== "all"
                    ? "No documents match these filters."
                    : "No documents yet. Start with a new quotation or invoice."}
                </span>
              </MTd>
            </MTr>
          )}
        </MTable>
        {!loading && totalItems > rows.length && (
          <p className="text-xs text-muted-foreground">
            Showing the latest {rows.length} of {totalItems}. Search to find older ones.
          </p>
        )}

        <SellerDialog
          open={sellerOpen}
          seller={seller}
          states={options.states}
          canEdit={perms.manage}
          onClose={() => setSellerOpen(false)}
          onSaved={setSeller}
        />
      </MPageShell>
    </MasterShell>
  );
}

const SELLER_FIELD_LABEL: Record<string, string> = {
  legal_name: "legal name",
  address: "address",
  state: "GST state",
  gstin: "GSTIN",
};

function SellerWarning({ seller, onOpen }: { seller: SellerProfileState; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Seller {seller.missingFields.map((f) => SELLER_FIELD_LABEL[f] ?? f).join(", ")}{" "}
        {seller.missingFields.length === 1 ? "is" : "are"} not set. A GST tax invoice should carry
        them.
      </span>
      <MButton variant="outline" onClick={onOpen}>
        Fill in seller details
      </MButton>
    </div>
  );
}

// ============================================================================
// Editor
// ============================================================================

function DocumentEditor({
  target,
  options,
  seller,
  perms,
  onOpenSeller,
  onClose,
  onReplace,
}: {
  target: EditorTarget;
  options: BillingDocumentOptions;
  seller: SellerProfileState | null;
  perms: { create: boolean; update: boolean; remove: boolean; manage: boolean };
  onOpenSeller: () => void;
  onClose: () => void;
  onReplace: (document: BillingDocument) => void;
}) {
  const saved = target.mode === "edit" ? target.document : null;
  const [form, setForm] = useState<FormState>(() =>
    target.mode === "edit"
      ? formFromDocument(target.document)
      : emptyForm(target.documentType, seller?.state ?? ""),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [orgs, setOrgs] = useState<Organization[] | null>(null);

  const isQuotation = form.documentType === "quotation";
  const locked = !!saved && saved.status !== "draft";
  const editable = !locked && (saved ? perms.update : perms.create);
  const typeLabel = DOCUMENT_TYPE_LABEL[form.documentType];

  useEffect(() => {
    if (!editable) return;
    organizationService
      .listAll()
      .then((list) => setOrgs([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setOrgs([]));
  }, [editable]);

  function patch(update: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...update }));
    setDirty(true);
  }

  function patchBillTo(update: Partial<FormState["billTo"]>) {
    setForm((prev) => ({ ...prev, billTo: { ...prev.billTo, ...update } }));
    setDirty(true);
  }

  function patchLine(key: string, update: Partial<FormLine>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.key === key ? { ...line, ...update } : line)),
    }));
    setDirty(true);
  }

  const resolvedMode = resolveTaxMode(
    form.taxMode,
    seller?.state ?? saved?.seller.state,
    form.placeOfSupply,
    options.outsideIndia,
  );

  const preview = useMemo(() => {
    const mode = resolvedMode ?? "none";
    const amounts = form.lines.map((line) =>
      computeLine(
        {
          quantity: num(line.quantity),
          rate: num(line.rate),
          discountPercent: num(line.discountPercent),
          taxRate: num(line.taxRate),
        },
        mode,
      ),
    );
    return { amounts, totals: computeTotals(amounts, form.roundTotal) };
  }, [form.lines, form.roundTotal, resolvedMode]);

  function validate(): string | null {
    if (!form.billTo.name.trim()) return "Enter who this is billed to.";
    if (!form.lines.some((line) => line.description.trim()))
      return "Add at least one line item with a description.";
    if (form.lines.some((line) => line.description.trim() && num(line.quantity) <= 0))
      return "Every line needs a quantity above zero.";
    if (form.taxMode === "auto" && !resolvedMode)
      return form.placeOfSupply
        ? "The seller's GST state is not set. Fill in seller details, or pick the tax mode by hand."
        : "Choose the place of supply so CGST+SGST or IGST can be decided.";
    return null;
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  async function save(): Promise<BillingDocument | null> {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return null;
    }
    try {
      const result = saved
        ? await billingDocumentService.update(saved.id, toInput(form))
        : await billingDocumentService.create(toInput(form));
      setDirty(false);
      toast.success(`${typeLabel} ${result.documentNumber} saved as draft`);
      onReplace(result);
      return result;
    } catch (err) {
      toast.error(errorMessage(err, `Could not save this ${typeLabel.toLowerCase()}.`));
      return null;
    }
  }

  async function previewPdf() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      const { url } = await billingDocumentService.previewPdf(toInput(form));
      openBlob(url);
    } catch (err) {
      toast.error(errorMessage(err, "Could not render the preview."));
    }
  }

  async function downloadPdf(doc: BillingDocument) {
    try {
      const { url, fileName } = await billingDocumentService.downloadPdf(
        doc.id,
        doc.documentNumber,
      );
      openBlob(url, fileName);
    } catch (err) {
      toast.error(errorMessage(err, "Could not download the PDF."));
    }
  }

  async function transition(
    label: string,
    action: (id: string) => Promise<BillingDocument>,
    success: (doc: BillingDocument) => string,
  ) {
    if (!saved) return;
    await run(label, async () => {
      try {
        const result = await action(saved.id);
        toast.success(success(result));
        onReplace(result);
      } catch (err) {
        toast.error(errorMessage(err, "That did not work."));
      }
    });
  }

  async function pickOrganization(organizationId: string) {
    if (!organizationId) {
      patch({ organizationId: null });
      return;
    }
    try {
      const prefill = await billingDocumentService.billToPrefill(organizationId);
      setForm((prev) => ({
        ...prev,
        organizationId,
        billTo: {
          name: prefill.name,
          address: prefill.address ?? "",
          gstin: prefill.gstin ?? "",
          email: prefill.email ?? "",
          phone: prefill.phone ?? "",
        },
        placeOfSupply:
          prefill.state && options.states.includes(prefill.state)
            ? prefill.state
            : prev.placeOfSupply,
      }));
      setDirty(true);
      if (!prefill.address) {
        toast.message("This customer has no billing profile yet; fill in the address by hand.");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not load that customer's billing details."));
    }
  }

  const stateOptions = options.states.length ? options.states : [];
  const tax = preview.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MButton
            variant="ghost"
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved changes?")) return;
              onClose();
            }}
          >
            <ArrowLeft /> All documents
          </MButton>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {saved ? `${typeLabel} ${saved.documentNumber}` : `New ${typeLabel.toLowerCase()}`}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {saved ? (
                <MTag
                  label={DOCUMENT_STATUS_LABEL[saved.status]}
                  tone={STATUS_TONE[saved.status]}
                />
              ) : (
                <span>Not saved yet</span>
              )}
              {saved?.sourceQuotationId && <span>Converted from a quotation</span>}
              {saved?.convertedInvoiceId && <span>Converted to an invoice</span>}
              {dirty && <span className="text-amber-600">Unsaved changes</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <MButton variant="outline" disabled={!!busy} onClick={() => run("preview", previewPdf)}>
              {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye />} Preview
              PDF
            </MButton>
          )}
          {saved && !dirty && (
            <MButton
              variant="outline"
              disabled={!!busy}
              onClick={() => run("download", () => downloadPdf(saved))}
            >
              {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download />}{" "}
              Download PDF
            </MButton>
          )}
          {editable && (
            <MButton
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                run("save", async () => {
                  await save();
                })
              }
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save />} Save draft
            </MButton>
          )}
        </div>
      </div>

      {locked && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          This {typeLabel.toLowerCase()} is {saved?.status} and can no longer be edited. Duplicate
          it to make a changed copy.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Document */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">{typeLabel} details</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <MField label={`${typeLabel} number`}>
                <input
                  className={M_INPUT}
                  disabled={!editable}
                  placeholder={`Auto: ${options.numberPrefixes[form.documentType]}-${form.issueDate.slice(0, 4)}-0001…`}
                  value={form.documentNumber}
                  onChange={(e) => patch({ documentNumber: e.target.value })}
                />
              </MField>
              <MField label="Date">
                <input
                  type="date"
                  className={M_INPUT}
                  disabled={!editable}
                  value={form.issueDate}
                  onChange={(e) => patch({ issueDate: e.target.value })}
                />
              </MField>
              {isQuotation ? (
                <MField label="Valid until">
                  <input
                    type="date"
                    className={M_INPUT}
                    disabled={!editable}
                    min={form.issueDate}
                    value={form.validUntil}
                    onChange={(e) => patch({ validUntil: e.target.value })}
                  />
                </MField>
              ) : (
                <MField label="Due date">
                  <input
                    type="date"
                    className={M_INPUT}
                    disabled={!editable}
                    min={form.issueDate}
                    value={form.dueDate}
                    onChange={(e) => patch({ dueDate: e.target.value })}
                  />
                </MField>
              )}
            </div>
            {!saved && (
              <p className="text-xs text-muted-foreground">
                Leave the number empty to take the next one in the {typeLabel.toLowerCase()} series.
                Numbers are never reused, even from deleted drafts.
              </p>
            )}
          </section>

          {/* Bill to */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{isQuotation ? "Prepared for" : "Bill to"}</h3>
              {editable && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <select
                    className={`${M_INPUT} w-56 py-1.5 text-xs`}
                    value={form.organizationId ?? ""}
                    onChange={(e) => void pickOrganization(e.target.value)}
                    disabled={orgs === null}
                  >
                    <option value="">
                      {orgs === null ? "Loading customers…" : "Fill from a customer (optional)"}
                    </option>
                    {(orgs ?? []).map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MField label="Name / company *">
                <input
                  className={M_INPUT}
                  disabled={!editable}
                  placeholder="Magpie Hospitality LLP"
                  value={form.billTo.name}
                  onChange={(e) => patchBillTo({ name: e.target.value })}
                />
              </MField>
              <MField label="GSTIN (optional)">
                <input
                  className={`${M_INPUT} font-mono uppercase`}
                  disabled={!editable}
                  maxLength={15}
                  placeholder="29ABCDE1234F1Z5"
                  value={form.billTo.gstin}
                  onChange={(e) => patchBillTo({ gstin: e.target.value.toUpperCase() })}
                />
              </MField>
              <div className="sm:col-span-2">
                <MField label="Address">
                  <textarea
                    className={`${M_INPUT} min-h-[64px]`}
                    disabled={!editable}
                    placeholder={"Street, area\nCity, State PIN"}
                    value={form.billTo.address}
                    onChange={(e) => patchBillTo({ address: e.target.value })}
                  />
                </MField>
              </div>
              <MField label="Email (optional)">
                <input
                  type="email"
                  className={M_INPUT}
                  disabled={!editable}
                  value={form.billTo.email}
                  onChange={(e) => patchBillTo({ email: e.target.value })}
                />
              </MField>
              <MField label="Phone (optional)">
                <input
                  className={M_INPUT}
                  disabled={!editable}
                  value={form.billTo.phone}
                  onChange={(e) => patchBillTo({ phone: e.target.value })}
                />
              </MField>
            </div>
          </section>

          {/* Tax */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">GST</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <MField label="Place of supply">
                <select
                  className={M_INPUT}
                  disabled={!editable}
                  value={form.placeOfSupply}
                  onChange={(e) => patch({ placeOfSupply: e.target.value })}
                >
                  <option value="">Choose a state…</option>
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                  <option value={options.outsideIndia}>{options.outsideIndia}</option>
                </select>
              </MField>
              <MField label="Tax">
                <select
                  className={M_INPUT}
                  disabled={!editable}
                  value={form.taxMode}
                  onChange={(e) => patch({ taxMode: e.target.value as TaxMode })}
                >
                  {(Object.keys(TAX_MODE_LABEL) as TaxMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {TAX_MODE_LABEL[mode]}
                    </option>
                  ))}
                </select>
              </MField>
            </div>
            <p className="text-xs text-muted-foreground">
              {resolvedMode
                ? `Will be charged as ${TAX_MODE_LABEL[resolvedMode]}${
                    form.taxMode === "auto"
                      ? ` (seller state: ${seller?.state || saved?.seller.state || "not set"})`
                      : ""
                  }.`
                : "Choose the place of supply to decide CGST+SGST or IGST."}
            </p>
          </section>

          {/* Lines */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Line items</h3>
            <div className="space-y-3">
              {form.lines.map((line, index) => (
                <div key={line.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-5 shrink-0 text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="grid flex-1 gap-2 sm:grid-cols-6">
                      <div className="sm:col-span-4">
                        <MField label="Description">
                          <textarea
                            className={`${M_INPUT} min-h-[40px]`}
                            rows={1}
                            disabled={!editable}
                            placeholder="Wyfy Guest annual licence, 1 location"
                            value={line.description}
                            onChange={(e) => patchLine(line.key, { description: e.target.value })}
                          />
                        </MField>
                      </div>
                      <MField label="HSN / SAC">
                        <input
                          className={`${M_INPUT} font-mono`}
                          disabled={!editable}
                          value={line.hsnSac}
                          onChange={(e) => patchLine(line.key, { hsnSac: e.target.value })}
                        />
                      </MField>
                      <MField label="Unit">
                        <input
                          className={M_INPUT}
                          disabled={!editable}
                          placeholder="nos"
                          value={line.unit}
                          onChange={(e) => patchLine(line.key, { unit: e.target.value })}
                        />
                      </MField>
                      <MField label="Qty">
                        <input
                          inputMode="decimal"
                          className={`${M_INPUT} text-right tabular-nums`}
                          disabled={!editable}
                          value={line.quantity}
                          onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
                        />
                      </MField>
                      <MField label="Rate (₹)">
                        <input
                          inputMode="decimal"
                          className={`${M_INPUT} text-right tabular-nums`}
                          disabled={!editable}
                          placeholder="0.00"
                          value={line.rate}
                          onChange={(e) => patchLine(line.key, { rate: e.target.value })}
                        />
                      </MField>
                      <MField label="Discount %">
                        <input
                          inputMode="decimal"
                          className={`${M_INPUT} text-right tabular-nums`}
                          disabled={!editable}
                          value={line.discountPercent}
                          onChange={(e) => patchLine(line.key, { discountPercent: e.target.value })}
                        />
                      </MField>
                      <MField label="GST %">
                        <select
                          className={M_INPUT}
                          disabled={!editable || resolvedMode === "none"}
                          value={line.taxRate}
                          onChange={(e) => patchLine(line.key, { taxRate: e.target.value })}
                        >
                          {(GST_RATES.includes(num(line.taxRate))
                            ? GST_RATES
                            : [...GST_RATES, num(line.taxRate)]
                          ).map((rate) => (
                            <option key={rate} value={String(rate)}>
                              {rate}%
                            </option>
                          ))}
                        </select>
                      </MField>
                      <div className="flex flex-col justify-end sm:col-span-2">
                        <span className="text-xs text-muted-foreground">Line total</span>
                        <span className="py-2 text-right text-sm font-semibold tabular-nums">
                          ₹ {formatAmount(preview.amounts[index]?.total ?? 0)}
                        </span>
                      </div>
                    </div>
                    {editable && form.lines.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove line ${index + 1}`}
                        className="mt-6 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        onClick={() =>
                          patch({ lines: form.lines.filter((other) => other.key !== line.key) })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {editable && (
              <MButton
                variant="outline"
                onClick={() =>
                  patch({
                    lines: [
                      ...form.lines,
                      newLine(form.lines[form.lines.length - 1]?.taxRate ?? "18"),
                    ],
                  })
                }
              >
                <Plus /> Add line
              </MButton>
            )}
          </section>

          {/* Notes */}
          <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <MField label="Notes (printed)">
              <textarea
                className={`${M_INPUT} min-h-[110px]`}
                disabled={!editable}
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </MField>
            <MField label="Terms & conditions (printed)">
              <textarea
                className={`${M_INPUT} min-h-[110px]`}
                disabled={!editable}
                value={form.terms}
                onChange={(e) => patch({ terms: e.target.value })}
              />
            </MField>
          </section>
        </div>

        {/* Summary + actions */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
            <h3 className="text-sm font-semibold">Totals</h3>
            <Row label="Subtotal" value={tax.subtotal} />
            {tax.discountTotal > 0 && <Row label="Discount" value={-tax.discountTotal} />}
            {resolvedMode !== "none" && <Row label="Taxable value" value={tax.taxableTotal} />}
            {resolvedMode === "cgst_sgst" && (
              <>
                <Row label="CGST" value={tax.cgstTotal} />
                <Row label="SGST" value={tax.sgstTotal} />
              </>
            )}
            {resolvedMode === "igst" && <Row label="IGST" value={tax.igstTotal} />}
            {tax.roundOff !== 0 && <Row label="Round off" value={tax.roundOff} />}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">₹ {formatAmount(tax.grandTotal)}</span>
            </div>
            <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                disabled={!editable}
                checked={form.roundTotal}
                onChange={(e) => patch({ roundTotal: e.target.checked })}
              />
              Round the total to the nearest rupee
            </label>
            {saved && !dirty && (
              <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                {saved.amountInWords}
              </p>
            )}
            {dirty && (
              <p className="text-[11px] text-muted-foreground">
                Live estimate. The saved figures are recomputed by the server.
              </p>
            )}
          </section>

          <section className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Seller</h3>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={onOpenSeller}
              >
                {perms.manage ? "Edit" : "View"}
              </button>
            </div>
            {(() => {
              const s = locked && saved ? saved.seller : seller;
              return (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">{s?.legalName || "—"}</p>
                  {s?.gstin && <p>GSTIN {s.gstin}</p>}
                  {s?.state && <p>{s.state}</p>}
                  {locked && <p className="pt-1">As printed on this document.</p>}
                </div>
              );
            })()}
            {!locked && seller && seller.missingFields.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Missing: {seller.missingFields.map((f) => SELLER_FIELD_LABEL[f] ?? f).join(", ")}
              </p>
            )}
          </section>

          {saved && (
            <section className="space-y-2 rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Actions</h3>
              {saved.status === "draft" && perms.update && (
                <MButton
                  variant="outline"
                  className="w-full"
                  disabled={!!busy || dirty}
                  onClick={() =>
                    setConfirm({
                      title: `Issue ${saved.documentNumber}?`,
                      description:
                        "Issuing locks the document: its number, lines and amounts can no longer be edited. Do this once you have sent (or are about to send) the PDF.",
                      actionLabel: "Issue",
                      run: () =>
                        transition(
                          "issue",
                          billingDocumentService.issue,
                          (d) => `${d.documentNumber} issued`,
                        ),
                    })
                  }
                >
                  <CheckCircle2 /> Mark as issued
                </MButton>
              )}
              {saved.documentType === "quotation" &&
                saved.status !== "cancelled" &&
                !saved.convertedInvoiceId &&
                perms.create && (
                  <MButton
                    variant="outline"
                    className="w-full"
                    disabled={!!busy || dirty}
                    onClick={() =>
                      transition(
                        "convert",
                        billingDocumentService.convertToInvoice,
                        (d) => `Invoice draft ${d.documentNumber} created from this quotation`,
                      )
                    }
                  >
                    {busy === "convert" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt />
                    )}{" "}
                    Convert to invoice
                  </MButton>
                )}
              {perms.create && (
                <MButton
                  variant="outline"
                  className="w-full"
                  disabled={!!busy || dirty}
                  onClick={() =>
                    transition(
                      "duplicate",
                      billingDocumentService.duplicate,
                      (d) => `Copied to new draft ${d.documentNumber}`,
                    )
                  }
                >
                  {busy === "duplicate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy />}{" "}
                  Duplicate
                </MButton>
              )}
              {saved.status === "issued" && perms.update && (
                <MButton
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={!!busy}
                  onClick={() =>
                    setConfirm({
                      title: `Cancel ${saved.documentNumber}?`,
                      description:
                        "The document stays on record as cancelled and its number is not reused. This does not recall a PDF you have already sent.",
                      actionLabel: "Cancel document",
                      destructive: true,
                      run: () =>
                        transition(
                          "cancel",
                          billingDocumentService.cancel,
                          (d) => `${d.documentNumber} cancelled`,
                        ),
                    })
                  }
                >
                  <Ban /> Cancel document
                </MButton>
              )}
              {saved.status === "draft" && perms.remove && (
                <MButton
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={!!busy}
                  onClick={() =>
                    setConfirm({
                      title: `Delete draft ${saved.documentNumber}?`,
                      description:
                        "The draft disappears from this list. Its number stays reserved and is not handed out again.",
                      actionLabel: "Delete draft",
                      destructive: true,
                      run: async () => {
                        await run("delete", async () => {
                          try {
                            await billingDocumentService.remove(saved.id);
                            toast.success(`Draft ${saved.documentNumber} deleted`);
                            onClose();
                          } catch (err) {
                            toast.error(errorMessage(err, "Could not delete this draft."));
                          }
                        });
                      },
                    })
                  }
                >
                  <Trash2 /> Delete draft
                </MButton>
              )}
              {dirty && (
                <p className="text-[11px] text-muted-foreground">
                  Save your changes first to issue, convert or duplicate.
                </p>
              )}
            </section>
          )}
        </aside>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={async () => {
                const current = confirm;
                setConfirm(null);
                if (current) await current.run();
              }}
            >
              {confirm?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatAmount(value)}</span>
    </div>
  );
}

// ============================================================================
// Seller details
// ============================================================================

const SELLER_FIELDS: {
  key: keyof SellerProfile;
  label: string;
  wide?: boolean;
  multi?: boolean;
}[] = [
  { key: "legalName", label: "Legal name *", wide: true },
  { key: "tradeName", label: "Trade / brand name" },
  { key: "gstin", label: "GSTIN" },
  { key: "address", label: "Registered address", wide: true, multi: true },
  { key: "pan", label: "PAN" },
  { key: "cin", label: "CIN" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website", wide: true },
  {
    key: "bankDetails",
    label: "Bank details (printed on every PDF)",
    wide: true,
    multi: true,
  },
];

function SellerDialog({
  open,
  seller,
  states,
  canEdit,
  onClose,
  onSaved,
}: {
  open: boolean;
  seller: SellerProfileState | null;
  states: string[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (seller: SellerProfileState) => void;
}) {
  const [draft, setDraft] = useState<SellerProfile | null>(seller);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(seller);
  }, [open, seller]);

  async function save() {
    if (!draft?.legalName.trim()) {
      toast.error("The legal name is required.");
      return;
    }
    setSaving(true);
    try {
      const result = await billingDocumentService.updateSellerProfile(draft);
      onSaved(result);
      toast.success("Seller details saved. New and edited drafts will print them.");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save seller details."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MDialog
      open={open}
      onClose={onClose}
      title="Seller details"
      wide
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </MButton>
          {canEdit && (
            <MButton variant="primary" disabled={saving || !draft} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save />} Save
            </MButton>
          )}
        </>
      }
    >
      {!draft ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Printed at the top of every quotation and invoice. Issued documents keep the details
            they were issued with.
            {seller && !seller.isConfigured && " These are platform defaults until you save."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SELLER_FIELDS.map((field) => (
              <div key={field.key} className={field.wide ? "sm:col-span-2" : undefined}>
                <MField label={field.label}>
                  {field.multi ? (
                    <textarea
                      className={`${M_INPUT} min-h-[64px]`}
                      disabled={!canEdit}
                      value={draft[field.key]}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      className={`${M_INPUT} ${field.key === "gstin" || field.key === "pan" ? "font-mono uppercase" : ""}`}
                      disabled={!canEdit}
                      value={draft[field.key]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [field.key]:
                            field.key === "gstin" || field.key === "pan"
                              ? e.target.value.toUpperCase()
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </MField>
              </div>
            ))}
            <MField label="GST state (decides CGST+SGST vs IGST)">
              <select
                className={M_INPUT}
                disabled={!canEdit}
                value={draft.state}
                onChange={(e) => setDraft({ ...draft, state: e.target.value })}
              >
                <option value="">Not set</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </MField>
          </div>
        </div>
      )}
    </MDialog>
  );
}
