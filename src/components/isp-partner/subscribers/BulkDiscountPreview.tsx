/**
 * SMALL-1: discount code on DIR-2 bulk renew. The code input renders only
 * while DISCOUNT-WIRE's probe answers (ISP_DISCOUNT_APPLY_ENABLED on); the
 * per-subscriber quote comes from the bulk dry run itself (BE maths), so
 * there is no client-side preview to drift from the invoice.
 */
import { M_INPUT } from "@/components/master/MasterKit";
import { useDiscountApply } from "@/hooks/isp-partner/useDiscountApply";
import { formatRupees } from "@/lib/isp-partner/money";
import type { BulkDiscountSummary } from "@/services/isp-partner/dir2";

/** Rows listed in the dialog; the totals always cover every subscriber. */
export const BULK_DISCOUNT_ROWS = 20;

export function BulkDiscountCodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { enabled } = useDiscountApply();
  if (!enabled) return null;
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Discount code (optional, applied per subscriber)
      </span>
      <input
        className={`${M_INPUT} uppercase`}
        value={value}
        maxLength={40}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function BulkDiscountPreview({ summary }: { summary: BulkDiscountSummary }) {
  const fresh = summary.per_subscriber.filter((q) => !q.replay);
  const replays = summary.per_subscriber.length - fresh.length;
  return (
    <div
      className="space-y-1.5 rounded-lg border border-border p-3 text-xs"
      data-testid="bulk-discount-preview"
    >
      <p className="font-medium text-foreground">
        {summary.code}: {summary.subscribers_discounted.toLocaleString("en-IN")} subscriber
        {summary.subscribers_discounted === 1 ? "" : "s"}, −
        {formatRupees(summary.total_discount_paise)} before GST in total.
        {summary.remaining_uses_before !== null &&
          ` ${summary.remaining_uses_before.toLocaleString("en-IN")} use${summary.remaining_uses_before === 1 ? "" : "s"} left on the code.`}
      </p>
      {replays > 0 && (
        <p className="text-muted-foreground">
          {replays} already renewed with this batch: their first invoice is kept, no new use.
        </p>
      )}
      {fresh.length > 0 && (
        <ul className="max-h-40 space-y-0.5 overflow-auto tabular-nums">
          {fresh.slice(0, BULK_DISCOUNT_ROWS).map((q) => (
            <li key={q.id} className="flex justify-between gap-2">
              <span className="truncate">{q.identifier}</span>
              <span>
                −{formatRupees(q.discount_paise)} (taxable{" "}
                {formatRupees(q.taxable_before_paise ?? 0)} →{" "}
                {formatRupees(q.taxable_after_paise ?? 0)})
              </span>
            </li>
          ))}
          {fresh.length > BULK_DISCOUNT_ROWS && (
            <li className="text-muted-foreground">and {fresh.length - BULK_DISCOUNT_ROWS} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
