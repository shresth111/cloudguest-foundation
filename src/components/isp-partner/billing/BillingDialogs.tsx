/**
 * Phase 1b billing dialogs (ADDENDUM_01 §B.3): record a cash / UPI / bank
 * payment, create an invoice, void with a reason, and the explicit
 * "resume service?" prompt after dues are cleared (never auto-resume).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import {
  useCreateInvoice,
  useCustomerLedger,
  useRecordPayment,
  useResumeService,
  useVoidInvoice,
  useVoidPayment,
} from "@/hooks/isp-partner/useBilling";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { billingService, newIdempotencyKey } from "@/services/isp-partner/billing";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { isoDay } from "@/lib/isp-partner/format";
import { saveBlob } from "@/lib/isp-partner/download";
import {
  PAYMENT_MODE_LABEL,
  formatRupees,
  modeNeedsReference,
  paiseToInput,
  parseRupeesToPaise,
} from "@/lib/isp-partner/money";
import type { IspPayment, PaymentMode } from "@/services/isp-partner/billing-types";

/** Modes staff record by hand. `online` is written only by the 1c gateway. */
const MANUAL_MODES: PaymentMode[] = ["cash", "upi", "bank_transfer"];

async function download(fn: () => Promise<{ blob: Blob; filename: string }>) {
  try {
    const { blob, filename } = await fn();
    saveBlob(blob, filename);
  } catch (err) {
    toast.error(ispErrorMessage(err, "The download failed."));
  }
}

export function ReceiptButton({ payment }: { payment: Pick<IspPayment, "id" | "receipt_number"> }) {
  const [busy, setBusy] = useState(false);
  return (
    <MButton
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await download(() => billingService.receiptPdf(payment));
        setBusy(false);
      }}
    >
      {busy ? <Spinner /> : <Download />} Receipt
    </MButton>
  );
}

export function InvoicePdfButton({ invoice }: { invoice: { id: string; number: string } }) {
  const [busy, setBusy] = useState(false);
  return (
    <MButton
      variant="ghost"
      disabled={busy}
      title="Download invoice PDF"
      aria-label={`Download invoice ${invoice.number}`}
      onClick={async () => {
        setBusy(true);
        await download(() => billingService.invoicePdf(invoice));
        setBusy(false);
      }}
    >
      {busy ? <Spinner /> : <Download />}
    </MButton>
  );
}

function ResumePrompt({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const resume = useResumeService(customerId);
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  return (
    <MDialog
      open
      onClose={onClose}
      title="Dues cleared. Resume service now?"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Not now
          </MButton>
          <MButton
            disabled={resume.isPending}
            onClick={async () => {
              setError(null);
              try {
                await resume.mutateAsync({ note: "Dues cleared", key });
                toast("Resuming service. Guests can sign in again once the steps finish.");
                onClose();
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {resume.isPending && <Spinner />} Resume service
          </MButton>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        This customer was suspended for non-payment and has nothing overdue now. Service is not
        resumed automatically; resume it here, or later from the customer&apos;s Service card.
      </p>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function RecordPaymentDialog({
  open,
  onClose,
  customerId: fixedCustomerId,
  invoiceId: presetInvoiceId,
}: {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  invoiceId?: string;
}) {
  const customers = useIspCustomerOptions(open && !fixedCustomerId);
  const [customerId, setCustomerId] = useState(fixedCustomerId ?? "");
  const ledger = useCustomerLedger(customerId, open);
  const [invoiceId, setInvoiceId] = useState(presetInvoiceId ?? "");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [key, setKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [recorded, setRecorded] = useState<IspPayment | null>(null);
  const [askResume, setAskResume] = useState(false);
  const record = useRecordPayment();

  const openInvoices = useMemo(
    () =>
      (ledger.data?.invoices ?? []).filter(
        (i) => i.status === "issued" || i.status === "partially_paid",
      ),
    [ledger.data],
  );

  useEffect(() => {
    if (open) {
      setCustomerId(fixedCustomerId ?? "");
      setInvoiceId(presetInvoiceId ?? "");
      setAmount("");
      setMode("cash");
      setReference("");
      setDate(isoDay(new Date()));
      setKey(newIdempotencyKey());
      setError(null);
      setFieldErrors({});
      setRecorded(null);
    }
  }, [open, fixedCustomerId, presetInvoiceId]);

  // Default the amount to the chosen invoice's balance.
  useEffect(() => {
    const inv = openInvoices.find((i) => i.id === invoiceId);
    if (inv && !amount) setAmount(paiseToInput(inv.total_paise - inv.paid_paise));
  }, [invoiceId, openInvoices]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const errs: Record<string, string> = {};
    const paise = parseRupeesToPaise(amount);
    if (!customerId) errs.customer = "Pick a customer.";
    if (paise === null || paise <= 0)
      errs.amount_paise = "Enter an amount in rupees, like 1499 or 1499.50.";
    if (modeNeedsReference(mode) && !reference.trim())
      errs.reference = "Enter the UTR / transaction reference.";
    setFieldErrors(errs);
    if (Object.keys(errs).length || paise === null) return;
    setError(null);
    try {
      const p = await record.mutateAsync({
        body: {
          isp_customer_id: customerId,
          invoice_id: invoiceId || null,
          amount_paise: paise,
          mode,
          reference: reference.trim() || null,
          received_at: new Date(`${date}T12:00:00`).toISOString(),
        },
        key,
      });
      toast.success(
        `Payment of ${formatRupees(p.amount_paise)} recorded. Receipt ${p.receipt_number}.`,
      );
      setRecorded(p);
      const fresh = await ledger.refetch();
      if (fresh.data?.can_resume) setAskResume(true);
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not record the payment."));
    }
  };

  return (
    <>
      <MDialog
        open={open}
        onClose={onClose}
        title={recorded ? "Payment recorded" : "Record a payment"}
        footer={
          recorded ? (
            <>
              <ReceiptButton payment={recorded} />
              <MButton onClick={onClose}>Done</MButton>
            </>
          ) : (
            <>
              <MButton variant="outline" onClick={onClose}>
                Cancel
              </MButton>
              <MButton onClick={submit} disabled={record.isPending}>
                {record.isPending && <Spinner />} Record payment
              </MButton>
            </>
          )
        }
      >
        {recorded ? (
          <div className="space-y-1 text-sm">
            <p>
              {formatRupees(recorded.amount_paise)} by{" "}
              {PAYMENT_MODE_LABEL[recorded.mode] ?? recorded.mode}
              {recorded.reference && ` (ref ${recorded.reference})`}.
            </p>
            <p className="text-muted-foreground">Receipt number {recorded.receipt_number}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {!fixedCustomerId && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Customer</span>
                <CustomerSelect
                  value={customerId}
                  onChange={(id) => {
                    setCustomerId(id);
                    setInvoiceId("");
                  }}
                  customers={customers.data}
                  allLabel={null}
                />
                {fieldErrors.customer && (
                  <span className="block text-[11px] text-destructive">{fieldErrors.customer}</span>
                )}
              </label>
            )}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Against invoice</span>
              <select
                className={M_INPUT}
                value={invoiceId}
                disabled={!customerId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  setAmount("");
                }}
              >
                <option value="">No invoice (advance / credit)</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · due {formatRupees(i.total_paise - i.paid_paise)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Amount (₹)"
                required
                value={amount}
                onChange={setAmount}
                error={fieldErrors.amount_paise}
              />
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Received on</span>
                <input
                  type="date"
                  className={M_INPUT}
                  value={date}
                  max={isoDay(new Date())}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Mode</span>
              <div className="flex gap-2">
                {MANUAL_MODES.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${mode === m ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    {PAYMENT_MODE_LABEL[m]}
                  </label>
                ))}
              </div>
            </label>
            <TextField
              label={modeNeedsReference(mode) ? "UTR / reference" : "Reference (optional)"}
              required={modeNeedsReference(mode)}
              value={reference}
              onChange={setReference}
              error={fieldErrors.reference}
            />
            <FormError message={error} />
          </div>
        )}
      </MDialog>
      {askResume && customerId && (
        <ResumePrompt customerId={customerId} onClose={() => setAskResume(false)} />
      )}
    </>
  );
}

export function CreateInvoiceDialog({
  open,
  onClose,
  customerId: fixedCustomerId,
}: {
  open: boolean;
  onClose: () => void;
  customerId?: string;
}) {
  const customers = useIspCustomerOptions(open && !fixedCustomerId);
  const [customerId, setCustomerId] = useState(fixedCustomerId ?? "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const create = useCreateInvoice();

  useEffect(() => {
    if (open) {
      setCustomerId(fixedCustomerId ?? "");
      setDescription("");
      setAmount("");
      setPeriodStart("");
      setPeriodEnd("");
      setDueDate("");
      setError(null);
      setFieldErrors({});
    }
  }, [open, fixedCustomerId]);

  const submit = async () => {
    const errs: Record<string, string> = {};
    const paise = parseRupeesToPaise(amount);
    if (!customerId) errs.customer = "Pick a customer.";
    if (!description.trim()) errs.description = "Required, e.g. 'WiFi service, November'.";
    if (paise === null || paise <= 0) errs.amount_paise = "Enter an amount in rupees.";
    if ((periodStart && !periodEnd) || (!periodStart && periodEnd))
      errs.period_end = "Give both period dates, or neither for a one-off.";
    if (periodStart && periodEnd && periodStart > periodEnd)
      errs.period_end = "The period ends before it starts.";
    setFieldErrors(errs);
    if (Object.keys(errs).length || paise === null) return;
    setError(null);
    try {
      const inv = await create.mutateAsync({
        isp_customer_id: customerId,
        description: description.trim(),
        amount_paise: paise,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        ...(dueDate ? { due_date: dueDate } : {}),
      });
      toast.success(`Invoice ${inv.number} issued for ${formatRupees(inv.total_paise)}.`);
      onClose();
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not create the invoice."));
    }
  };

  return (
    <MDialog
      open={open}
      onClose={onClose}
      title="Create invoice"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton onClick={submit} disabled={create.isPending}>
            {create.isPending && <Spinner />} Issue invoice
          </MButton>
        </>
      }
    >
      <div className="space-y-3">
        {!fixedCustomerId && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Customer</span>
            <CustomerSelect
              value={customerId}
              onChange={setCustomerId}
              customers={customers.data}
              allLabel={null}
            />
            {fieldErrors.customer && (
              <span className="block text-[11px] text-destructive">{fieldErrors.customer}</span>
            )}
          </label>
        )}
        <TextField
          label="Description"
          required
          value={description}
          onChange={setDescription}
          error={fieldErrors.description}
        />
        <TextField
          label="Amount before GST (₹)"
          required
          value={amount}
          onChange={setAmount}
          error={fieldErrors.amount_paise}
          hint="GST, if switched on in billing settings, is added by the system."
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Period from</span>
            <input
              type="date"
              className={M_INPUT}
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Period to</span>
            <input
              type="date"
              className={M_INPUT}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
            {fieldErrors.period_end && (
              <span className="block text-[11px] text-destructive">{fieldErrors.period_end}</span>
            )}
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Due date (optional)</span>
          <input
            type="date"
            className={M_INPUT}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <span className="block text-[11px] text-muted-foreground">
            Empty uses the default due days from billing settings.
          </span>
        </label>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function VoidDialog({
  target,
  onClose,
}: {
  target: { kind: "invoice" | "payment"; id: string; label: string } | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const voidInvoice = useVoidInvoice();
  const voidPayment = useVoidPayment();
  useEffect(() => {
    setReason("");
    setError(null);
  }, [target]);
  if (!target) return null;
  const busy = voidInvoice.isPending || voidPayment.isPending;
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Void ${target.kind} ${target.label}?`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            className="bg-destructive text-destructive-foreground"
            disabled={busy}
            onClick={async () => {
              if (!reason.trim()) {
                setError("A reason is required; it is kept on the record.");
                return;
              }
              setError(null);
              try {
                if (target.kind === "invoice")
                  await voidInvoice.mutateAsync({ id: target.id, reason: reason.trim() });
                else await voidPayment.mutateAsync({ id: target.id, reason: reason.trim() });
                toast.success(
                  `${target.kind === "invoice" ? "Invoice" : "Payment"} ${target.label} voided.`,
                );
                onClose();
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {busy && <Spinner />} Void
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Voiding keeps the record (and its number) and removes it from the balance. It cannot be
          undone.
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Reason</span>
          <input
            className={M_INPUT}
            value={reason}
            maxLength={255}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}
