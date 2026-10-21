/** Invoice and payment tables shared by the Billing page and the customer
 * Billing tab. Rows come straight from the API; nothing is computed here
 * except the outstanding amount (total − paid). */
import { Link } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { MButton, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { InvoicePdfButton, ReceiptButton } from "@/components/isp-partner/billing/BillingDialogs";
import { formatDate, formatDateTime } from "@/lib/isp-partner/format";
import {
  INVOICE_STATUS_LABEL,
  PAYMENT_MODE_LABEL,
  formatRupees,
  invoiceTone,
} from "@/lib/isp-partner/money";
import type { IspInvoice, IspPayment } from "@/services/isp-partner/billing-types";

export function InvoicesTable({
  items,
  loading,
  showCustomer,
  canVoid,
  canPay,
  onVoid,
  onPay,
}: {
  items: IspInvoice[];
  loading?: boolean;
  showCustomer?: boolean;
  canVoid?: boolean;
  canPay?: boolean;
  onVoid?: (inv: IspInvoice) => void;
  onPay?: (inv: IspInvoice) => void;
}) {
  return (
    <MTable
      loading={loading}
      head={
        <>
          <MTh>Invoice</MTh>
          {showCustomer && <MTh>Customer</MTh>}
          <MTh>Issued</MTh>
          <MTh>Due</MTh>
          <MTh className="text-right">Total</MTh>
          <MTh className="text-right">Outstanding</MTh>
          <MTh>Status</MTh>
          <MTh className="text-right">Actions</MTh>
        </>
      }
    >
      {items.map((i) => {
        const outstanding = i.status === "void" ? 0 : Math.max(0, i.total_paise - i.paid_paise);
        return (
          <MTr key={i.id}>
            <MTd>
              <p className="font-mono text-xs font-medium">{i.number}</p>
              <p className="text-[11px] text-muted-foreground">{i.description}</p>
            </MTd>
            {showCustomer && (
              <MTd className="text-xs">
                <Link
                  to="/partner/customers/$ispCustomerId"
                  params={{ ispCustomerId: i.isp_customer_id }}
                  search={{ tab: "billing" }}
                  className="text-primary hover:underline"
                >
                  {i.customer_name ?? "Customer"}
                </Link>
              </MTd>
            )}
            <MTd className="text-xs">{formatDate(i.issue_date)}</MTd>
            <MTd className="text-xs">{formatDate(i.due_date)}</MTd>
            <MTd className="text-right tabular-nums">{formatRupees(i.total_paise)}</MTd>
            <MTd className="text-right tabular-nums">{formatRupees(outstanding)}</MTd>
            <MTd>
              <MTag
                label={
                  i.overdue && i.status !== "paid" && i.status !== "void"
                    ? "Overdue"
                    : (INVOICE_STATUS_LABEL[i.status] ?? i.status)
                }
                tone={invoiceTone(i.status, i.overdue)}
              />
              {i.voided_reason && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{i.voided_reason}</p>
              )}
            </MTd>
            <MTd className="text-right">
              <div className="flex justify-end gap-0.5">
                {canPay && outstanding > 0 && (
                  <MButton variant="outline" onClick={() => onPay?.(i)}>
                    Record payment
                  </MButton>
                )}
                <InvoicePdfButton invoice={i} />
                {canVoid && i.status !== "void" && i.paid_paise === 0 && (
                  <MButton
                    variant="ghost"
                    title="Void"
                    aria-label={`Void ${i.number}`}
                    onClick={() => onVoid?.(i)}
                  >
                    <Ban />
                  </MButton>
                )}
              </div>
            </MTd>
          </MTr>
        );
      })}
    </MTable>
  );
}

function recordedBy(p: IspPayment): string {
  if (!p.recorded_by) return "–";
  return typeof p.recorded_by === "string" ? p.recorded_by : p.recorded_by.name;
}

export function PaymentsTable({
  items,
  loading,
  showCustomer,
  canVoid,
  onVoid,
}: {
  items: IspPayment[];
  loading?: boolean;
  showCustomer?: boolean;
  canVoid?: boolean;
  onVoid?: (p: IspPayment) => void;
}) {
  return (
    <MTable
      loading={loading}
      head={
        <>
          <MTh>Receipt</MTh>
          {showCustomer && <MTh>Customer</MTh>}
          <MTh>Received</MTh>
          <MTh>Mode</MTh>
          <MTh>Invoice</MTh>
          <MTh className="text-right">Amount</MTh>
          <MTh>Recorded by</MTh>
          <MTh className="text-right">Actions</MTh>
        </>
      }
    >
      {items.map((p) => (
        <MTr key={p.id} className={p.status === "voided" ? "opacity-60" : undefined}>
          <MTd>
            <p className="font-mono text-xs font-medium">{p.receipt_number}</p>
            {p.status === "voided" && (
              <p className="text-[11px] text-rose-600">
                Voided{p.voided_reason ? `: ${p.voided_reason}` : ""}
              </p>
            )}
          </MTd>
          {showCustomer && <MTd className="text-xs">{p.customer_name ?? "–"}</MTd>}
          <MTd className="text-xs">{formatDateTime(p.received_at)}</MTd>
          <MTd className="text-xs">
            {PAYMENT_MODE_LABEL[p.mode] ?? p.mode}
            {p.reference && (
              <p className="font-mono text-[11px] text-muted-foreground">{p.reference}</p>
            )}
          </MTd>
          <MTd className="font-mono text-xs">
            {p.invoice_number ?? (p.invoice_id ? "–" : "Advance")}
          </MTd>
          <MTd className="text-right tabular-nums">{formatRupees(p.amount_paise)}</MTd>
          <MTd className="text-xs">{recordedBy(p)}</MTd>
          <MTd className="text-right">
            <div className="flex justify-end gap-0.5">
              <ReceiptButton payment={p} />
              {canVoid && p.status !== "voided" && (
                <MButton
                  variant="ghost"
                  title="Void"
                  aria-label={`Void ${p.receipt_number}`}
                  onClick={() => onVoid?.(p)}
                >
                  <Ban />
                </MButton>
              )}
            </div>
          </MTd>
        </MTr>
      ))}
    </MTable>
  );
}
