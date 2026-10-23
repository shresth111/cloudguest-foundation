/** `/partner/invoices/$invoiceId` (ADDENDUM_03 §13): the invoice as the PDF
 * shows it, plus payments, credit notes, reminders and the actions. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Mail, MessageCircle, Wallet } from "lucide-react";
import {
  MButton,
  MSectionHeader,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  CreditNoteDialog,
  InvoicePaymentDialog,
} from "@/components/isp-partner/invoices/InvoiceDialogs";
import { useInvoice, useInvoiceMutation } from "@/hooks/isp-partner/useInvoices";
import { invoicesService } from "@/services/isp-partner/invoices";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { formatDate, formatDateTime } from "@/lib/isp-partner/format";
import {
  INVOICE_KIND_LABEL,
  INVOICE_STATUS_LABEL_X,
  billToName,
  invoiceStatusTone,
  whatsappShareUrl,
} from "@/lib/isp-partner/invoices";
import { PAYMENT_MODE_LABEL, formatRupees } from "@/lib/isp-partner/money";

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const { can, me } = usePartner();
  const q = useInvoice(invoiceId);
  const [paying, setPaying] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const remind = useInvoiceMutation((id: string) => invoicesService.remindEmail(id));

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this invoice" />;
  const inv = q.data;
  const live = inv.status !== "cancelled" && inv.status !== "void";
  const intraState = inv.cgst_paise > 0 || inv.sgst_paise > 0;

  return (
    <>
      <p className="text-xs">
        <Link to="/partner/invoices" className="text-primary hover:underline">
          ← Invoices
        </Link>
      </p>
      <MSectionHeader
        eyebrow={inv.doc_type === "credit_note" ? "Credit note" : "Tax invoice"}
        title={inv.number}
        description={`#${inv.display_id} · ${formatDate(inv.invoice_date)}${inv.due_date ? ` · due ${formatDate(inv.due_date)}` : ""} · ${INVOICE_KIND_LABEL[inv.invoice_kind] ?? inv.invoice_kind}`}
        actions={
          <>
            <MTag
              label={inv.status_label || INVOICE_STATUS_LABEL_X[inv.status] || inv.status}
              tone={invoiceStatusTone(inv.status)}
            />
            <MButton
              variant="outline"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  const { blob, filename } = await invoicesService.pdf(inv);
                  saveBlob(blob, filename);
                } catch (err) {
                  toast.error(ispErrorMessage(err, "The download failed."));
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? <Spinner /> : <Download />} PDF
            </MButton>
            {can("isp_billing.execute") && live && inv.balance_paise > 0 && (
              <MButton onClick={() => setPaying(true)}>
                <Wallet /> Record payment
              </MButton>
            )}
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary"
              href={whatsappShareUrl({
                phone: inv.subscriber?.phone ?? inv.customer?.contact_phone ?? null,
                name: billToName(inv) === "–" ? null : billToName(inv),
                invoiceNumber: inv.number,
                totalPaise: inv.total_paise,
                balancePaise: inv.balance_paise,
                ispName: me.isp.name,
                supportPhone: me.isp.support_phone,
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            {can("isp_invoices.execute") && live && (
              <MButton
                variant="outline"
                disabled={remind.isPending}
                onClick={async () => {
                  try {
                    await remind.mutateAsync(inv.id);
                    toast.success("Email reminder queued.");
                  } catch (err) {
                    toast.error(ispErrorMessage(err, "Could not send the email."));
                  }
                }}
              >
                {remind.isPending ? <Spinner /> : <Mail />} Email
              </MButton>
            )}
            {can("isp_invoices.manage") && live && inv.doc_type === "invoice" && (
              <MButton variant="outline" onClick={() => setCrediting(true)}>
                Credit note
              </MButton>
            )}
          </>
        }
      />
      {inv.credit_note_for && (
        <p className="text-xs">
          Against invoice{" "}
          <Link
            to="/partner/invoices/$invoiceId"
            params={{ invoiceId: inv.credit_note_for.id }}
            className="text-primary hover:underline"
          >
            {inv.credit_note_for.number}
          </Link>
        </p>
      )}
      {inv.cancelled_reason && (
        <p className="text-xs text-muted-foreground">Cancelled: {inv.cancelled_reason}</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Billed to">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{billToName(inv)}</dd>
            {inv.subscriber && (
              <>
                <dt className="text-muted-foreground">Username</dt>
                <dd className="font-mono text-xs">{inv.subscriber.username}</dd>
                <dt className="text-muted-foreground">Circuit id</dt>
                <dd>{inv.subscriber.circuit_id ?? "–"}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Zone</dt>
            <dd>{inv.zone?.name ?? "–"}</dd>
            <dt className="text-muted-foreground">Buyer GSTIN</dt>
            <dd>{inv.buyer_gstin ?? "–"}</dd>
            <dt className="text-muted-foreground">PO no.</dt>
            <dd>{inv.po_number ?? "–"}</dd>
            <dt className="text-muted-foreground">Place of supply</dt>
            <dd>{inv.place_of_supply_state_code ?? "–"}</dd>
          </dl>
        </Card>
        <Card title="Amounts">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm tabular-nums">
            <dt className="text-muted-foreground">Taxable value</dt>
            <dd className="text-right">{formatRupees(inv.taxable_paise)}</dd>
            {intraState ? (
              <>
                <dt className="text-muted-foreground">CGST</dt>
                <dd className="text-right">{formatRupees(inv.cgst_paise)}</dd>
                <dt className="text-muted-foreground">SGST</dt>
                <dd className="text-right">{formatRupees(inv.sgst_paise)}</dd>
              </>
            ) : (
              inv.igst_paise > 0 && (
                <>
                  <dt className="text-muted-foreground">IGST</dt>
                  <dd className="text-right">{formatRupees(inv.igst_paise)}</dd>
                </>
              )
            )}
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{formatRupees(inv.total_paise)}</dd>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="text-right">{formatRupees(inv.paid_paise)}</dd>
            {inv.credit_noted_paise > 0 && (
              <>
                <dt className="text-muted-foreground">Credit notes</dt>
                <dd className="text-right">−{formatRupees(inv.credit_noted_paise)}</dd>
              </>
            )}
            <dt className="font-semibold">Balance</dt>
            <dd
              className={`text-right font-semibold ${inv.balance_paise > 0 ? "text-rose-600" : ""}`}
            >
              {formatRupees(inv.balance_paise)}
            </dd>
          </dl>
        </Card>
      </div>

      <Card title="Lines">
        <MTable
          head={
            <>
              <MTh>Description</MTh>
              <MTh>SAC</MTh>
              <MTh>Period</MTh>
              <MTh className="text-right">Taxable</MTh>
              <MTh className="text-right">Tax</MTh>
              <MTh className="text-right">Total</MTh>
            </>
          }
        >
          {inv.lines.map((l) => (
            <MTr key={l.id}>
              <MTd>
                {l.description}
                {l.quantity > 1 && (
                  <span className="text-xs text-muted-foreground"> × {l.quantity}</span>
                )}
              </MTd>
              <MTd className="text-xs">{l.sac_code ?? "–"}</MTd>
              <MTd className="text-xs">
                {l.period_from ? `${formatDate(l.period_from)} – ${formatDate(l.period_to)}` : "–"}
              </MTd>
              <MTd className="text-right tabular-nums">{formatRupees(l.taxable_paise)}</MTd>
              <MTd className="text-right tabular-nums">
                {formatRupees(l.cgst_paise + l.sgst_paise + l.igst_paise)}
              </MTd>
              <MTd className="text-right tabular-nums">{formatRupees(l.total_paise)}</MTd>
            </MTr>
          ))}
        </MTable>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Payments">
          {inv.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {inv.payments.map((p) => (
                <li key={p.payment_id}>
                  <span className="font-medium tabular-nums">{formatRupees(p.amount_paise)}</span> ·{" "}
                  {PAYMENT_MODE_LABEL[p.mode] ?? p.mode}
                  {p.reference && ` · ${p.reference}`} · {formatDateTime(p.received_at)} · receipt{" "}
                  {p.receipt_number}
                  {p.recorded_by_name && ` · by ${p.recorded_by_name}`}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Credit notes">
          {inv.credit_notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {inv.credit_notes.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/partner/invoices/$invoiceId"
                    params={{ invoiceId: c.id }}
                    className="font-mono text-primary hover:underline"
                  >
                    {c.number}
                  </Link>{" "}
                  · {formatRupees(c.amount_paise)} · {formatDate(c.created_at)}
                  {c.reason && ` · ${c.reason}`}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Reminders">
          {inv.reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">None sent.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {inv.reminders.map((r, i) => (
                <li key={i}>
                  {r.channel === "whatsapp_share" ? "WhatsApp (shared)" : r.channel} ·{" "}
                  {formatDateTime(r.sent_at)} · {r.status}
                  {r.sent_by_name && ` · by ${r.sent_by_name}`}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {paying && <InvoicePaymentDialog invoice={inv} onClose={() => setPaying(false)} />}
      {crediting && <CreditNoteDialog invoice={inv} onClose={() => setCrediting(false)} />}
    </>
  );
}
