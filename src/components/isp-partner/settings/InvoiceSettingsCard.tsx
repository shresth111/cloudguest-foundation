/** Settings → Invoice numbering and automation (ADDENDUM_03 §3, §7, §9). */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useInvoiceMutation, useInvoiceSettings } from "@/hooks/isp-partner/useInvoices";
import { invoicesService } from "@/services/isp-partner/invoices";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { indianFy } from "@/lib/isp-partner/invoices";

/** §3: a GST invoice number is at most 16 characters, so the prefix is 1-4 of [A-Z0-9]. */
const GST_PREFIX = /^[A-Z0-9]{1,4}$/;

export function InvoiceSettingsCard() {
  const { can } = usePartner();
  const editable = can("isp_invoices.manage");
  const q = useInvoiceSettings();
  const save = useInvoiceMutation(invoicesService.putSettings);
  const [inv, setInv] = useState("INV");
  const [cn, setCn] = useState("CN");
  const [rct, setRct] = useState("RCT");
  const [coupon, setCoupon] = useState(true);
  const [days, setDays] = useState("3");
  const [footer, setFooter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = q.data;
    if (!s) return;
    setInv(s.invoice_prefix);
    setCn(s.credit_note_prefix);
    setRct(s.receipt_prefix);
    setCoupon(s.coupon_invoice_on_activation);
    setDays(String(s.reminder_days_before_expiry));
    setFooter(s.invoice_footer ?? "");
  }, [q.data]);

  if (q.isLoading) return <Spinner />;
  if (q.error)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="invoice settings" />;
  const fy = indianFy(new Date()).label;

  return (
    <Card title="Invoices: numbering and automation">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Invoice prefix"
            value={inv}
            onChange={(v) => setInv(v.toUpperCase())}
            disabled={!editable}
          />
          <TextField
            label="Credit-note prefix"
            value={cn}
            onChange={(v) => setCn(v.toUpperCase())}
            disabled={!editable}
          />
          <TextField
            label="Receipt prefix"
            value={rct}
            onChange={(v) => setRct(v.toUpperCase())}
            disabled={!editable}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Numbers look like {inv || "INV"}/{fy}/1 and restart at 1 every 1 April. They never skip
          and are never reused. Invoice and credit-note prefixes are 1-4 letters or digits (the GST
          limit is 16 characters).
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={coupon}
            disabled={!editable}
            onChange={(e) => setCoupon(e.target.checked)}
          />
          <span>
            Issue a paid invoice when a coupon is first used
            <span className="block text-[11px] text-muted-foreground">
              One invoice per activation, billed to the subscriber who used it, recorded as paid by
              prepaid coupon. On by default. Free (₹0) packages never create one.
            </span>
          </span>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Email reminder, days before validity ends"
            value={days}
            onChange={setDays}
            disabled={!editable}
          />
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Invoice footer (optional)
          </span>
          <textarea
            className={M_INPUT}
            rows={2}
            value={footer}
            disabled={!editable}
            onChange={(e) => setFooter(e.target.value)}
          />
        </label>
        <FormError message={error} />
        {editable && (
          <MButton
            disabled={save.isPending}
            onClick={async () => {
              if (!GST_PREFIX.test(inv) || !GST_PREFIX.test(cn))
                return setError(
                  "Invoice and credit-note prefixes must be 1-4 capital letters or digits.",
                );
              if (!/^[A-Z0-9-]{1,12}$/.test(rct))
                return setError("Receipt prefix: up to 12 letters, digits or '-'.");
              const d = Number(days);
              if (!Number.isInteger(d) || d < 0 || d > 30)
                return setError("Reminder days: 0 to 30.");
              setError(null);
              try {
                await save.mutateAsync({
                  invoice_prefix: inv,
                  credit_note_prefix: cn,
                  receipt_prefix: rct,
                  coupon_invoice_on_activation: coupon,
                  reminder_days_before_expiry: d,
                  invoice_footer: footer.trim() || null,
                });
                toast.success("Invoice settings saved.");
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {save.isPending && <Spinner />} Save invoice settings
          </MButton>
        )}
      </div>
    </Card>
  );
}
