import type { PaymentStatus, SubscriptionStatus, CouponStatus, InvoiceType } from "@/types/billing";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const subMap: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  trial: { label: "Trial", cls: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  past_due: { label: "Past due", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  canceled: { label: "Canceled", cls: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expired", cls: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  paused: { label: "Paused", cls: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
};
const payMap: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  failed: { label: "Failed", cls: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  refunded: { label: "Refunded", cls: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
};
const couponMap: Record<CouponStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  expired: { label: "Expired", cls: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  disabled: { label: "Disabled", cls: "bg-muted text-muted-foreground border-border" },
};
const invoiceTypeMap: Record<InvoiceType, string> = {
  tax_invoice: "Tax invoice",
  credit_note: "Credit note",
  debit_note: "Debit note",
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const s = subMap[status];
  return <Badge variant="outline" className={cn("font-medium", s.cls)}>{s.label}</Badge>;
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = payMap[status];
  return <Badge variant="outline" className={cn("font-medium", s.cls)}>{s.label}</Badge>;
}
export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  const s = couponMap[status];
  return <Badge variant="outline" className={cn("font-medium", s.cls)}>{s.label}</Badge>;
}
export function InvoiceTypeLabel({ type }: { type: InvoiceType }) {
  return <span className="text-xs text-muted-foreground">{invoiceTypeMap[type]}</span>;
}
