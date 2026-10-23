/**
 * Recharge a subscriber (ADDENDUM_03 §7, Part B): pick a package, optionally
 * take the money now, issue the invoice. Validity extends from
 * max(now, valid until) by the package's days.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, MessageCircle } from "lucide-react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ReceiptButton } from "@/components/isp-partner/billing/BillingDialogs";
import { useInvoiceMutation } from "@/hooks/isp-partner/useInvoices";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { newIdempotencyKey } from "@/services/isp-partner/billing";
import { invoicesService } from "@/services/isp-partner/invoices";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { formatDate } from "@/lib/isp-partner/format";
import { whatsappShareUrl } from "@/lib/isp-partner/invoices";
import { rechargePreview } from "@/lib/isp-partner/plans";
import {
  PAYMENT_MODE_LABEL,
  formatRupees,
  modeNeedsReference,
  paiseToInput,
  parseRupeesToPaise,
} from "@/lib/isp-partner/money";
import type { PaymentMode } from "@/services/isp-partner/billing-types";
import type { RechargeResult } from "@/services/isp-partner/invoices-types";
import type { Subscriber } from "@/services/isp-partner/plans-types";

const MODES: PaymentMode[] = ["cash", "upi", "bank_transfer"];

export function RechargeDialog({
  subscriber,
  onClose,
}: {
  subscriber: Subscriber | null;
  onClose: () => void;
}) {
  const { can, me } = usePartner();
  const packages = usePackages({ status: "active", page_size: 100 }, !!subscriber);
  const [packageId, setPackageId] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [po, setPo] = useState("");
  const [key, setKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RechargeResult | null>(null);
  const run = useInvoiceMutation(
    (v: { id: string; body: Parameters<typeof invoicesService.recharge>[1] }) =>
      invoicesService.recharge(v.id, v.body),
  );
  const canTakePayment = can("isp_billing.execute");

  useEffect(() => {
    if (subscriber) {
      setPackageId(subscriber.package?.id ?? "");
      setPaidNow(canTakePayment);
      setMode("cash");
      setReference("");
      setAmount("");
      setPo("");
      setKey(newIdempotencyKey());
      setError(null);
      setDone(null);
    }
  }, [subscriber, canTakePayment]);

  const pkg = useMemo(
    () => (packages.data?.items ?? []).find((p) => p.id === packageId),
    [packages.data, packageId],
  );
  useEffect(() => {
    if (pkg) setAmount(paiseToInput(pkg.price_paise));
  }, [pkg]);
  if (!subscriber) return null;

  const submit = async () => {
    if (!pkg) return setError("Pick a package.");
    let payment = null;
    if (paidNow) {
      const p = parseRupeesToPaise(amount);
      if (p === null || p <= 0) return setError("Enter the amount received.");
      if (modeNeedsReference(mode) && !reference.trim())
        return setError("UPI and bank transfers need the UTR / reference.");
      payment = { mode, reference: reference.trim() || null, amount_paise: p, received_at: null };
    }
    setError(null);
    try {
      const res = await run.mutateAsync({
        id: subscriber.id,
        body: {
          package_id: pkg.id,
          paid_now: paidNow,
          payment,
          po_number: po.trim() || null,
          idempotency_key: key,
        },
      });
      setDone(res);
      toast.success(
        `Recharged. Invoice ${res.invoice.number}. Valid until ${formatDate(res.subscriber.valid_until)}.`,
      );
    } catch (err) {
      setError(ispErrorMessage(err, "The recharge failed."));
    }
  };

  const name =
    subscriber.display_name ??
    ([subscriber.first_name, subscriber.last_name].filter(Boolean).join(" ") || null);

  return (
    <MDialog
      open
      onClose={onClose}
      title={done ? "Recharge done" : `Recharge ${subscriber.identifier}`}
      footer={
        done ? (
          <>
            {done.payment && <ReceiptButton payment={done.payment} />}
            <MButton
              variant="outline"
              onClick={async () => {
                try {
                  const { blob, filename } = await invoicesService.pdf(done.invoice);
                  saveBlob(blob, filename);
                } catch (err) {
                  toast.error(ispErrorMessage(err, "The download failed."));
                }
              }}
            >
              <Download /> Invoice PDF
            </MButton>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary"
              href={whatsappShareUrl({
                phone: subscriber.phone ?? subscriber.identifier,
                name,
                invoiceNumber: done.invoice.number,
                totalPaise: done.invoice.total_paise,
                balancePaise: done.invoice.balance_paise,
                ispName: me.isp.name,
                supportPhone: me.isp.support_phone,
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <MButton onClick={onClose}>Done</MButton>
          </>
        ) : (
          <>
            <MButton variant="outline" onClick={onClose}>
              Cancel
            </MButton>
            <MButton onClick={submit} disabled={run.isPending}>
              {run.isPending && <Spinner />} Recharge and issue invoice
            </MButton>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-1 text-sm">
          <p>
            Invoice <span className="font-mono">{done.invoice.number}</span> ·{" "}
            {formatRupees(done.invoice.total_paise)} ·{" "}
            {done.invoice.balance_paise > 0
              ? `${formatRupees(done.invoice.balance_paise)} due`
              : "paid"}
          </p>
          <p className="text-muted-foreground">
            {done.subscriber.package?.name ?? pkg?.name}, valid until{" "}
            {formatDate(done.subscriber.valid_until)}. The speed applies at their next sign-in.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Circuit {subscriber.circuit_id ?? "–"} · now on{" "}
            {subscriber.package?.name ?? "no package"}, valid until{" "}
            {formatDate(subscriber.valid_until)}
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Package</span>
            <select
              className={M_INPUT}
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="">Pick…</option>
              {(packages.data?.items ?? [])
                .filter((p) => !p.needs_price)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatRupees(p.price_paise)}
                    {p.price_includes_gst ? "" : " + GST"}
                  </option>
                ))}
            </select>
          </label>
          {pkg && (
            <p className="rounded-lg bg-muted/50 p-2 text-xs">
              {pkg.validity_days} days · new valid-until about{" "}
              <strong>
                {formatDate(
                  rechargePreview(subscriber.valid_until, pkg.validity_days).toISOString(),
                )}
              </strong>
              {!pkg.price_includes_gst && " · GST is added on top of the price"}
            </p>
          )}
          {canTakePayment ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paidNow}
                onChange={(e) => setPaidNow(e.target.checked)}
              />
              Paid now
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Your role cannot take payments; the invoice will be left unpaid.
            </p>
          )}
          {paidNow && canTakePayment && (
            <>
              <div className="flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${mode === m ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
                    {PAYMENT_MODE_LABEL[m]}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Amount received (₹)" value={amount} onChange={setAmount} />
                <TextField
                  label={modeNeedsReference(mode) ? "UTR / reference" : "Reference (optional)"}
                  required={modeNeedsReference(mode)}
                  value={reference}
                  onChange={setReference}
                />
              </div>
            </>
          )}
          <TextField label="PO no. (optional)" value={po} onChange={setPo} />
          <FormError message={error} />
        </div>
      )}
    </MDialog>
  );
}
