/**
 * LEFTOVERS #8: finance-extras endpoints that had a service method but no
 * screen. All three sit behind the same backend flag as the rest of
 * /finance (RequireFinanceExtras): a 404 hides them, nothing is guessed.
 *
 * - `BillingContactCard`: `GET/PUT /finance/contacts/{kind}/{id}`. The
 *   alternate email here is the one "Email invoice → alternate / both" and
 *   the reminder run read (it is NOT the subscriber profile's alt email),
 *   and "exclude from reminders" is what the automation run skips on.
 * - `DepositHistoryDialog`: `GET /finance/deposits` for one summary row.
 * - `LeasePricePreview`: `GET /finance/price-preview` for the lease rent.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MButton, MDialog, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { isNotFound, ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { formatRupees, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { financeService, type DepositEntry } from "@/services/isp-partner/finance";

const fk = (...k: unknown[]) => ["isp", "finance", ...k] as const;

// ---------------------------------------------------------------------------
// billing contact
// ---------------------------------------------------------------------------

export function BillingContactCard({ kind, id }: { kind: "customer" | "subscriber"; id: string }) {
  const { can } = usePartner();
  const readable = can("isp_billing.read");
  const q = useQuery({
    queryKey: fk("contact", kind, id),
    queryFn: () => financeService.contact(kind, id),
    retry: false,
    enabled: readable,
  });
  const [editing, setEditing] = useState(false);
  if (!readable || q.isLoading) return null;
  // 404: finance extras switched off (or the subject is out of scope).
  if (q.error && isNotFound(q.error)) return null;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} what="billing contact" onRetry={() => void q.refetch()} />;
  const c = q.data;
  return (
    <Card
      title="Billing contact"
      actions={
        can("isp_billing.manage") ? (
          <MButton variant="outline" onClick={() => setEditing(true)}>
            Edit
          </MButton>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Invoices go to</dt>
        <dd>{c.primary_email ?? "No email on file"}</dd>
        <dt className="text-muted-foreground">Alternate</dt>
        <dd>
          {c.alternate_email
            ? `${c.alternate_name ? `${c.alternate_name} · ` : ""}${c.alternate_email}`
            : "None"}
        </dd>
        <dt className="text-muted-foreground">Reminders</dt>
        <dd>
          {c.exclude_from_reminders ? (
            <MTag label="Excluded from automatic reminders" />
          ) : (
            "Sent by the reminder run"
          )}
        </dd>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        &quot;Email invoice&quot; can send to the alternate address, or to both.
      </p>
      {editing && (
        <BillingContactDialog kind={kind} id={id} c={c} onClose={() => setEditing(false)} />
      )}
    </Card>
  );
}

function BillingContactDialog({
  kind,
  id,
  c,
  onClose,
}: {
  kind: "customer" | "subscriber";
  id: string;
  c: {
    alternate_email: string | null;
    alternate_name: string | null;
    exclude_from_reminders: boolean;
  };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(c.alternate_email ?? "");
  const [name, setName] = useState(c.alternate_name ?? "");
  const [exclude, setExclude] = useState(c.exclude_from_reminders);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      financeService.saveContact(kind, id, {
        alternate_email: email.trim(),
        alternate_name: name.trim() || null,
        exclude_from_reminders: exclude,
      }),
    onSuccess: (saved) => {
      qc.setQueryData(fk("contact", kind, id), saved);
      toast.success("Billing contact saved.");
      onClose();
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  return (
    <MDialog
      open
      onClose={onClose}
      title="Billing contact"
      footer={
        <MButton onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Spinner />} Save
        </MButton>
      }
    >
      <div className="space-y-3">
        <TextField
          label="Alternate email"
          type="email"
          value={email}
          onChange={setEmail}
          hint="Empty clears it."
        />
        <TextField label="Alternate contact name" value={name} onChange={setName} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
          Do not send automatic payment reminders
        </label>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

// ---------------------------------------------------------------------------
// deposit history (one summary row)
// ---------------------------------------------------------------------------

const ENTRY_LABEL: Record<DepositEntry["entry_kind"], string> = {
  collect: "Collected",
  refund: "Refunded",
  forfeit: "Forfeited",
};
const ITEM_LABEL: Record<DepositEntry["item"], string> = {
  ont: "ONT",
  router: "Router",
  stb: "Set-top box",
  other: "Other",
};

export function DepositHistoryDialog({
  target,
  onClose,
}: {
  target: { isp_customer_id: string; subscriber_id: string | null; label: string } | null;
  onClose: () => void;
}) {
  // Same keys as the summary row: a subscriber row is that subscriber's
  // entries; a customer row is the customer's own (subscriber_id null) ones.
  const q = useQuery({
    queryKey: fk("deposits", "history", target?.isp_customer_id, target?.subscriber_id),
    queryFn: () =>
      financeService.deposits(
        target!.subscriber_id
          ? { subscriber_id: target!.subscriber_id }
          : { isp_customer_id: target!.isp_customer_id },
      ),
    enabled: target !== null,
    retry: false,
  });
  if (!target) return null;
  return (
    <MDialog open wide onClose={onClose} title={`Deposit history · ${target.label}`}>
      {q.isLoading ? (
        <Spinner />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} what="deposit history" onRetry={() => void q.refetch()} />
      ) : (
        <div className="space-y-3">
          {q.data.held_paise !== null && (
            <p className="text-sm">
              Held now: <span className="font-semibold">{formatRupees(q.data.held_paise)}</span>
            </p>
          )}
          {q.data.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No entries.</p>
          ) : (
            <MTable
              head={
                <>
                  <MTh>When</MTh>
                  <MTh>Entry</MTh>
                  <MTh>For</MTh>
                  <MTh className="text-right">Amount</MTh>
                  <MTh>Mode</MTh>
                  <MTh>Reference / note</MTh>
                </>
              }
            >
              {q.data.items.map((e) => (
                <MTr key={e.id}>
                  <MTd className="text-xs">{formatDateTime(e.occurred_at)}</MTd>
                  <MTd>{ENTRY_LABEL[e.entry_kind] ?? e.entry_kind}</MTd>
                  <MTd>
                    {ITEM_LABEL[e.item] ?? e.item}
                    {e.item_serial && (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {e.item_serial}
                      </span>
                    )}
                  </MTd>
                  <MTd className="text-right tabular-nums">{formatRupees(e.amount_paise)}</MTd>
                  <MTd>{e.mode}</MTd>
                  <MTd className="text-xs">
                    {[e.reference, e.note].filter(Boolean).join(" · ") || "–"}
                  </MTd>
                </MTr>
              ))}
            </MTable>
          )}
        </div>
      )}
    </MDialog>
  );
}

// ---------------------------------------------------------------------------
// lease rent price preview
// ---------------------------------------------------------------------------

export function LeasePricePreview({ amount, incl }: { amount: string; incl: boolean }) {
  const paise = parseRupeesToPaise(amount);
  const [debounced, setDebounced] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(paise && paise > 0 ? paise : null), 300);
    return () => clearTimeout(t);
  }, [paise]);
  const q = useQuery({
    queryKey: fk("price-preview", debounced, incl),
    queryFn: () =>
      financeService.pricePreview({ amount_paise: debounced!, price_includes_gst: incl }),
    enabled: debounced !== null,
    retry: false,
    staleTime: 60_000,
  });
  if (debounced === null || !q.data) return null;
  const p = q.data;
  if (!p.billing_configured)
    return (
      <p className="text-xs text-muted-foreground">
        Billing settings are not filled in yet, so the invoice tax cannot be previewed.
      </p>
    );
  return (
    <p className="text-xs text-muted-foreground">
      Each monthly invoice: base {formatRupees(p.taxable_paise)}
      {p.gst_applied ? (
        <>
          {" "}
          + GST {formatRupees(p.cgst_paise + p.sgst_paise + p.igst_paise)} ({p.gst_rate_bp / 100}%)
        </>
      ) : null}{" "}
      = <span className="font-semibold text-foreground">{formatRupees(p.total_paise)}</span>
      {p.gst_applied ? "." : " (GST is off in billing settings)."}
    </p>
  );
}
