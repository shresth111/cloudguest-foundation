/** Subscriber 360: "Queue next plan" (QUEUED-RENEWAL). Pay or bill now; the
 * chosen plan starts when today's ends. Hidden while the feature is off (the
 * list 404s). Uses the JAZE-1 renew/revert keys. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { MButton, MDialog, MField, MTag, M_INPUT } from "@/components/master/MasterKit";
import { Card, FormError } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import {
  QUEUE_STATUS_LABEL,
  cancelNeedsVoid,
  queueKey,
  queueTone,
} from "@/lib/isp-partner/queued-renewal";
import { plansService } from "@/services/isp-partner/plans";
import { queuedRenewalService, type QueuedRenewal } from "@/services/isp-partner/queued-renewal";

export function QueuedRenewalCard({ subscriberId }: { subscriberId: string }) {
  const { can } = usePartner();
  const q = useQuery({
    queryKey: ["isp", "queued", subscriberId],
    queryFn: () => queuedRenewalService.forSubscriber(subscriberId),
    retry: false,
  });
  const [open, setOpen] = useState(false);
  const [cancel, setCancel] = useState<QueuedRenewal | null>(null);
  if (q.error || !q.data) return null; // feature off (404) or not loaded
  const items = q.data.items;
  return (
    <Card
      title="Next plan"
      actions={
        can("isp_invoices.create") && q.data.can_queue ? (
          <MButton variant="outline" onClick={() => setOpen(true)}>
            <CalendarPlus /> Queue next plan
          </MButton>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing queued. A queued plan is billed now and starts when today&apos;s plan ends
          {q.data.valid_until ? ` (${formatDateTime(q.data.valid_until)})` : ""}.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.slice(0, 5).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <MTag label={QUEUE_STATUS_LABEL[r.status] ?? r.status} tone={queueTone(r.status)} />{" "}
                <span className="font-medium">{r.package.name}</span>
                {r.cycles > 1 ? ` x ${r.cycles}` : ""} · from {formatDateTime(r.starts_at)} to{" "}
                {formatDateTime(r.ends_at)}
                {r.invoice && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {r.invoice.number} {formatRupees(r.invoice.total_paise)} (
                    {r.invoice.paid_paise > 0 ? "paid" : "unpaid"})
                  </span>
                )}
                {r.outcome.credit_note_number && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · credit note {r.outcome.credit_note_number}
                  </span>
                )}
              </div>
              {r.status === "pending" && can("isp_invoices.manage") && (
                <MButton variant="ghost" onClick={() => setCancel(r)}>
                  Cancel
                </MButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && <QueueDialog subscriberId={subscriberId} onClose={() => setOpen(false)} />}
      {cancel && (
        <CancelDialog subscriberId={subscriberId} row={cancel} onClose={() => setCancel(null)} />
      )}
    </Card>
  );
}

function useRefresh(subscriberId: string) {
  const qc = useQueryClient();
  return () => {
    // P3-SWEEP: the prefix also refreshes the ISP-wide queued renewals page.
    qc.invalidateQueries({ queryKey: ["isp", "queued"] });
    qc.invalidateQueries({ queryKey: ["isp", "sub360"] });
  };
}

function QueueDialog({ subscriberId, onClose }: { subscriberId: string; onClose: () => void }) {
  const { can } = usePartner();
  const refresh = useRefresh(subscriberId);
  const pk = useQuery({
    queryKey: ["isp", "queued", "packages"],
    queryFn: () => plansService.listPackages({ page_size: 100 }),
    retry: false,
  });
  const [packageId, setPackageId] = useState("");
  const [cycles, setCycles] = useState(1);
  const [paid, setPaid] = useState(false);
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");
  const [key] = useState(queueKey);
  const m = useMutation({
    mutationFn: () =>
      queuedRenewalService.queue(subscriberId, {
        package_id: packageId,
        cycles,
        paid_now: paid,
        payment: paid ? { mode, reference: reference.trim() || undefined } : undefined,
        idempotency_key: key,
      }),
    onSuccess: (r) => {
      toast.success(`${r.queued.package.name} queued from ${formatDateTime(r.queued.starts_at)}`);
      refresh();
      onClose();
    },
  });
  const active = (pk.data?.items ?? []).filter((p) => p.status === "active");
  return (
    <MDialog
      open
      onClose={onClose}
      title="Queue the next plan"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Close
          </MButton>
          <MButton disabled={!packageId || m.isPending} onClick={() => m.mutate()}>
            Queue and bill
          </MButton>
        </>
      }
    >
      <div className="space-y-3">
        <MField label="Plan">
          <select
            className={M_INPUT}
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
          >
            <option value="">Pick a plan</option>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.validity_days} days · {formatRupees(p.price_paise)}
              </option>
            ))}
          </select>
        </MField>
        <MField label="Cycles">
          <select
            className={M_INPUT}
            value={cycles}
            onChange={(e) => setCycles(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </MField>
        {can("isp_billing.execute") && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Paid now
          </label>
        )}
        {paid && (
          <div className="grid grid-cols-2 gap-2">
            <MField label="Mode">
              <select className={M_INPUT} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </MField>
            <MField label="Reference">
              <input
                className={M_INPUT}
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </MField>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          The invoice is issued now for the period after today&apos;s plan ends. Today&apos;s plan
          and speed keep running until then.
        </p>
        <FormError message={m.error ? ispErrorMessage(m.error) : null} />
      </div>
    </MDialog>
  );
}

export function CancelDialog({
  subscriberId,
  row,
  onClose,
}: {
  subscriberId: string;
  row: QueuedRenewal;
  onClose: () => void;
}) {
  const refresh = useRefresh(subscriberId);
  const [reason, setReason] = useState("");
  const voids = cancelNeedsVoid(row.invoice);
  const m = useMutation({
    mutationFn: () => queuedRenewalService.cancel(subscriberId, row.id, reason.trim()),
    onSuccess: (r) => {
      toast.success(
        `Cancelled${r.credit_note_number ? ` · credit note ${r.credit_note_number}` : ""}${
          r.voided_receipts.length ? ` · receipt ${r.voided_receipts.join(", ")} voided` : ""
        }`,
      );
      refresh();
      onClose();
    },
  });
  return (
    <MDialog
      open
      onClose={onClose}
      title="Cancel the queued plan"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Keep it
          </MButton>
          <MButton disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
            Cancel and credit
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          A credit note is issued for {row.invoice?.number ?? "its invoice"} and the validity goes
          back to {formatDateTime(row.starts_at)}.
        </p>
        {voids && (
          <p className="rounded-md bg-muted p-2 text-xs">
            This invoice is paid. Cancelling voids its receipt first; refund the subscriber.
          </p>
        )}
        <MField label="Why">
          <input
            className={M_INPUT}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </MField>
        <FormError message={m.error ? ispErrorMessage(m.error) : null} />
      </div>
    </MDialog>
  );
}
