/** ADDENDUM_03 dialogs: payment against one invoice, bulk mark paid,
 * credit note, manual invoice. */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { MButton, MDialog, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { ReceiptButton } from "@/components/isp-partner/billing/BillingDialogs";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useInvoiceMutation } from "@/hooks/isp-partner/useInvoices";
import { useSubscribers } from "@/hooks/isp-partner/usePlans";
import { billingService, newIdempotencyKey } from "@/services/isp-partner/billing";
import { invoicesService } from "@/services/isp-partner/invoices";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { isoDay } from "@/lib/isp-partner/format";
import { invoiceDateProblem } from "@/lib/isp-partner/invoices";
import {
  PAYMENT_MODE_LABEL,
  formatRupees,
  modeNeedsReference,
  paiseToInput,
  parseRupeesToPaise,
} from "@/lib/isp-partner/money";
import type { IspPayment, PaymentMode } from "@/services/isp-partner/billing-types";
import type { InvoiceRow, ManualInvoiceLine } from "@/services/isp-partner/invoices-types";

const MANUAL_MODES: PaymentMode[] = ["cash", "upi", "bank_transfer"];

function ModePicker({ mode, onChange }: { mode: PaymentMode; onChange: (m: PaymentMode) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MANUAL_MODES.map((m) => (
        <label
          key={m}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${mode === m ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <input type="radio" checked={mode === m} onChange={() => onChange(m)} />
          {PAYMENT_MODE_LABEL[m]}
        </label>
      ))}
    </div>
  );
}

export function InvoicePaymentDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow | null;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [key, setKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<IspPayment | null>(null);
  const record = useInvoiceMutation(
    (v: { body: Parameters<typeof billingService.recordPayment>[0]; key: string }) =>
      billingService.recordPayment(v.body, v.key),
  );
  useEffect(() => {
    if (invoice) {
      setAmount(paiseToInput(invoice.balance_paise));
      setMode("cash");
      setReference("");
      setDate(isoDay(new Date()));
      setKey(newIdempotencyKey());
      setError(null);
      setRecorded(null);
    }
  }, [invoice]);
  if (!invoice) return null;
  const submit = async () => {
    const paise = parseRupeesToPaise(amount);
    if (paise === null || paise <= 0) return setError("Enter an amount in rupees.");
    if (modeNeedsReference(mode) && !reference.trim())
      return setError("UPI and bank transfers need the UTR / reference.");
    setError(null);
    try {
      const p = await record.mutateAsync({
        body: {
          ...(invoice.subscriber
            ? { subscriber_id: invoice.subscriber.id }
            : { isp_customer_id: invoice.customer?.isp_customer_id }),
          invoice_id: invoice.id,
          amount_paise: paise,
          mode,
          reference: reference.trim() || null,
          received_at: new Date(`${date}T12:00:00`).toISOString(),
        },
        key,
      });
      setRecorded(p);
      toast.success(`${formatRupees(p.amount_paise)} recorded. Receipt ${p.receipt_number}.`);
    } catch (err) {
      setError(ispErrorMessage(err, "Could not record the payment."));
    }
  };
  return (
    <MDialog
      open
      onClose={onClose}
      title={recorded ? "Payment recorded" : `Record payment · ${invoice.number}`}
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
        <p className="text-sm">
          {formatRupees(recorded.amount_paise)} by{" "}
          {PAYMENT_MODE_LABEL[recorded.mode] ?? recorded.mode}. Receipt {recorded.receipt_number}.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Balance {formatRupees(invoice.balance_paise)} of {formatRupees(invoice.total_paise)}. A
            smaller amount leaves it partially paid; more becomes credit.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Amount (₹)" required value={amount} onChange={setAmount} />
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
          <ModePicker mode={mode} onChange={setMode} />
          <TextField
            label={modeNeedsReference(mode) ? "UTR / reference" : "Reference (optional)"}
            required={modeNeedsReference(mode)}
            value={reference}
            onChange={setReference}
          />
          <FormError message={error} />
        </div>
      )}
    </MDialog>
  );
}

export function BulkMarkPaidDialog({
  invoices,
  onClose,
}: {
  invoices: InvoiceRow[] | null;
  onClose: (done: boolean) => void;
}) {
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [prefix, setPrefix] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [error, setError] = useState<string | null>(null);
  const run = useInvoiceMutation(
    (v: {
      ids: string[];
      payment: { mode: string; reference_prefix: string | null; received_at: string | null };
    }) => invoicesService.bulkMarkPaid(v.ids, v.payment),
  );
  useEffect(() => {
    if (invoices) {
      setMode("cash");
      setPrefix("");
      setDate(isoDay(new Date()));
      setError(null);
    }
  }, [invoices]);
  const payable = useMemo(
    () =>
      (invoices ?? []).filter(
        (i) => i.balance_paise > 0 && i.status !== "cancelled" && i.status !== "void",
      ),
    [invoices],
  );
  if (!invoices) return null;
  const sum = payable.reduce((a, i) => a + i.balance_paise, 0);
  return (
    <MDialog
      open
      onClose={() => onClose(false)}
      title="Mark selected invoices paid"
      footer={
        <>
          <MButton variant="outline" onClick={() => onClose(false)}>
            Cancel
          </MButton>
          <MButton
            disabled={run.isPending || payable.length === 0}
            onClick={async () => {
              if (modeNeedsReference(mode) && !prefix.trim())
                return setError("UPI and bank payments need a reference prefix.");
              setError(null);
              try {
                const res = await run.mutateAsync({
                  ids: payable.map((i) => i.id),
                  payment: {
                    mode,
                    reference_prefix: prefix.trim() || null,
                    received_at: new Date(`${date}T12:00:00`).toISOString(),
                  },
                });
                toast.success(
                  `${res.paid} invoice(s) marked paid${res.skipped.length ? `, ${res.skipped.length} skipped (${Array.from(new Set(res.skipped.map((s) => s.reason))).join(", ")})` : ""}.`,
                );
                onClose(true);
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {run.isPending && <Spinner />} Mark {payable.length} paid
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          {payable.length} of {invoices.length} selected have a balance: {formatRupees(sum)} in
          total. Each gets its own payment and receipt for its full balance.
        </p>
        <ModePicker mode={mode} onChange={setMode} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Reference prefix"
            value={prefix}
            onChange={setPrefix}
            hint="e.g. COUNTER-21OCT"
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
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function CreditNoteDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow | null;
  onClose: () => void;
}) {
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = useInvoiceMutation(
    (v: { id: string; body: { amount_paise?: number; reason: string } }) =>
      invoicesService.creditNote(v.id, v.body),
  );
  useEffect(() => {
    if (invoice) {
      setFull(true);
      setAmount("");
      setReason("");
      setError(null);
    }
  }, [invoice]);
  if (!invoice) return null;
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Credit note against ${invoice.number}`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            className="bg-destructive text-destructive-foreground"
            disabled={run.isPending}
            onClick={async () => {
              if (!reason.trim())
                return setError("A reason is required; it is printed on the credit note.");
              let paise: number | undefined;
              if (!full) {
                const p = parseRupeesToPaise(amount);
                if (p === null || p <= 0) return setError("Enter the amount to credit.");
                if (p > invoice.total_paise - invoice.credit_noted_paise)
                  return setError("That is more than the invoice still carries.");
                paise = p;
              }
              setError(null);
              try {
                await run.mutateAsync({
                  id: invoice.id,
                  body: { ...(paise ? { amount_paise: paise } : {}), reason: reason.trim() },
                });
                toast.success(
                  full ? "Credit note issued; the invoice is cancelled." : "Credit note issued.",
                );
                onClose();
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {run.isPending && <Spinner />} Issue credit note
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Invoices are never deleted or renumbered. A credit note gets its own number in the
          credit-note series. A full credit note cancels the invoice.
        </p>
        <MSeg<"full" | "part">
          value={full ? "full" : "part"}
          onChange={(v) => setFull(v === "full")}
          options={[
            {
              value: "full",
              label: `Full (${formatRupees(invoice.total_paise - invoice.credit_noted_paise)})`,
            },
            { value: "part", label: "Part" },
          ]}
        />
        {!full && <TextField label="Amount to credit (₹)" value={amount} onChange={setAmount} />}
        <TextField label="Reason" required value={reason} onChange={setReason} />
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

const emptyLine = (): ManualInvoiceLine & { amount: string } => ({
  description: "",
  sac_code: "998422",
  amount_paise: 0,
  price_includes_gst: false,
  amount: "",
});

export function ManualInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<"subscriber" | "customer">("subscriber");
  const customers = useIspCustomerOptions(open);
  const [customerId, setCustomerId] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const subs = useSubscribers({ search: subSearch.trim() || undefined, page_size: 20 });
  const [subscriberId, setSubscriberId] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [due, setDue] = useState("");
  const [po, setPo] = useState("");
  const [gstin, setGstin] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const create = useInvoiceMutation(invoicesService.createManual);
  useEffect(() => {
    if (open) {
      setKind("subscriber");
      setCustomerId("");
      setSubSearch("");
      setSubscriberId("");
      setDate(isoDay(new Date()));
      setDue("");
      setPo("");
      setGstin("");
      setLines([emptyLine()]);
      setError(null);
      setFieldErrors({});
    }
  }, [open]);
  const setLine = (i: number, patch: Partial<ReturnType<typeof emptyLine>>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    const dateProblem = invoiceDateProblem(date);
    if (dateProblem) return setError(dateProblem);
    if (kind === "customer" && !customerId) return setError("Pick a customer.");
    if (kind === "subscriber" && !subscriberId) return setError("Pick a subscriber.");
    if (gstin.trim() && !/^[0-9A-Z]{15}$/.test(gstin.trim().toUpperCase()))
      return setError("A GSTIN is 15 letters and digits.");
    const out: ManualInvoiceLine[] = [];
    for (const [i, l] of lines.entries()) {
      const p = parseRupeesToPaise(l.amount);
      if (!l.description.trim()) return setError(`Line ${i + 1}: add a description.`);
      if (p === null || p <= 0) return setError(`Line ${i + 1}: enter an amount in rupees.`);
      out.push({
        description: l.description.trim(),
        sac_code: l.sac_code.trim() || "998422",
        amount_paise: p,
        price_includes_gst: l.price_includes_gst,
      });
    }
    setError(null);
    try {
      const inv = await create.mutateAsync({
        bill_to:
          kind === "customer"
            ? { kind, isp_customer_id: customerId }
            : { kind, subscriber_id: subscriberId },
        invoice_date: date,
        due_date: due || null,
        lines: out,
        po_number: po.trim() || null,
        buyer_gstin: gstin.trim().toUpperCase() || null,
      });
      toast.success(`Invoice ${inv.number} issued for ${formatRupees(inv.total_paise)}.`);
      onClose();
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not issue the invoice."));
    }
  };

  return (
    <MDialog
      open={open}
      onClose={onClose}
      wide
      title="New invoice"
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
      <div className="space-y-3 text-sm">
        <MSeg<"subscriber" | "customer">
          value={kind}
          onChange={setKind}
          options={[
            { value: "subscriber", label: "Bill a subscriber" },
            { value: "customer", label: "Bill a customer" },
          ]}
        />
        {kind === "customer" ? (
          <CustomerSelect
            value={customerId}
            onChange={setCustomerId}
            customers={customers.data}
            allLabel={null}
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className={M_INPUT}
              placeholder="Search subscriber"
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
            />
            <select
              className={M_INPUT}
              value={subscriberId}
              onChange={(e) => setSubscriberId(e.target.value)}
              aria-label="Subscriber"
            >
              <option value="">Pick a subscriber…</option>
              {(subs.data?.items ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.identifier}
                  {s.circuit_id ? ` · #${s.circuit_id}` : ""}
                  {s.display_name ? ` · ${s.display_name}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Invoice date</span>
            <input
              type="date"
              className={M_INPUT}
              value={date}
              max={isoDay(new Date())}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Due date</span>
            <input
              type="date"
              className={M_INPUT}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <TextField label="PO no." value={po} onChange={setPo} />
          <TextField
            label="Buyer GSTIN"
            value={gstin}
            onChange={setGstin}
            error={fieldErrors.buyer_gstin}
          />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-end gap-2 rounded-lg border border-border p-2"
            >
              <div className="col-span-12 sm:col-span-5">
                <TextField
                  label="Description"
                  value={l.description}
                  onChange={(v) => setLine(i, { description: v })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <TextField
                  label="SAC"
                  value={l.sac_code}
                  onChange={(v) => setLine(i, { sac_code: v })}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <TextField
                  label="Amount (₹)"
                  value={l.amount}
                  onChange={(v) => setLine(i, { amount: v })}
                />
              </div>
              <label className="col-span-2 flex items-center gap-1 pb-2 text-[11px] sm:col-span-1">
                <input
                  type="checkbox"
                  checked={l.price_includes_gst}
                  onChange={(e) => setLine(i, { price_includes_gst: e.target.checked })}
                />
                incl. GST
              </label>
              <div className="col-span-1 pb-1">
                {lines.length > 1 && (
                  <MButton
                    variant="ghost"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </MButton>
                )}
              </div>
            </div>
          ))}
          <MButton variant="outline" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
            <Plus /> Add line
          </MButton>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The number is assigned when issued, in your FY series. GST is split by place of supply
          (CGST + SGST or IGST) on the server.
        </p>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}
