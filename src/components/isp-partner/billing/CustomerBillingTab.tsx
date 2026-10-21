/** Customer detail → Billing (ADDENDUM_01 FE-B2): plan, ledger, invoices,
 * payments, record payment, receipt, and Suspend-for-dues. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PauseCircle, Plus, Wallet } from "lucide-react";
import { MButton, MDialog, MEmptyState, MStat, M_INPUT } from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  CreateInvoiceDialog,
  RecordPaymentDialog,
  VoidDialog,
} from "@/components/isp-partner/billing/BillingDialogs";
import { InvoicesTable, PaymentsTable } from "@/components/isp-partner/billing/BillingTables";
import {
  useCustomerLedger,
  useCustomerPlan,
  useSaveCustomerPlan,
  useServiceState,
  useSuspendForDues,
} from "@/hooks/isp-partner/useBilling";
import { newIdempotencyKey } from "@/services/isp-partner/billing";
import { ispErrorCode, ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate } from "@/lib/isp-partner/format";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import type { BillingCycle, CustomerBillingPlan } from "@/services/isp-partner/billing-types";

const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
};

function PlanCard({ customerId }: { customerId: string }) {
  const { can } = usePartner();
  const editable = can("isp_billing.update");
  const q = useCustomerPlan(customerId);
  const save = useSaveCustomerPlan(customerId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    plan_name: "",
    amount: "",
    billing_cycle: "monthly" as BillingCycle,
    anchor_day: "1",
    next_invoice_date: "",
    gst_applicable: true,
    place_of_supply_state_code: "",
    active: true,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = q.data;
    if (p)
      setForm({
        plan_name: p.plan_name,
        amount: paiseToInput(p.amount_paise),
        billing_cycle: p.billing_cycle,
        anchor_day: String(p.anchor_day),
        next_invoice_date: p.next_invoice_date ?? "",
        gst_applicable: p.gst_applicable,
        place_of_supply_state_code: p.place_of_supply_state_code ?? "",
        active: p.active,
        notes: p.notes ?? "",
      });
  }, [q.data]);

  const submit = async () => {
    const paise = parseRupeesToPaise(form.amount);
    const day = Number(form.anchor_day);
    if (!form.plan_name.trim()) return setError("Give the plan a name.");
    if (paise === null || paise <= 0) return setError("Enter the amount in rupees.");
    if (!Number.isInteger(day) || day < 1 || day > 28)
      return setError("Billing day must be 1 to 28.");
    if (form.place_of_supply_state_code && !/^\d{2}$/.test(form.place_of_supply_state_code))
      return setError("Place of supply is the 2-digit GST state code, e.g. 09 for UP.");
    setError(null);
    const body: CustomerBillingPlan = {
      plan_name: form.plan_name.trim(),
      amount_paise: paise,
      billing_cycle: form.billing_cycle,
      anchor_day: day,
      next_invoice_date: form.next_invoice_date || null,
      gst_applicable: form.gst_applicable,
      place_of_supply_state_code: form.place_of_supply_state_code || null,
      active: form.active,
      notes: form.notes.trim() || null,
    };
    try {
      await save.mutateAsync(body);
      toast.success("Billing plan saved.");
      setEditing(false);
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };

  const p = q.data;
  return (
    <Card
      title="Billing plan"
      actions={
        editable && (
          <MButton variant="outline" onClick={() => setEditing(true)}>
            {p ? "Edit plan" : "Set up plan"}
          </MButton>
        )
      }
    >
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the billing plan" />
      ) : !p ? (
        <p className="text-sm text-muted-foreground">
          No recurring plan. Invoices can still be raised by hand.
        </p>
      ) : (
        <p className="text-sm">
          <span className="font-medium">{p.plan_name}</span> · {formatRupees(p.amount_paise)}{" "}
          {CYCLE_LABEL[p.billing_cycle]?.toLowerCase()} on day {p.anchor_day}
          {p.gst_applicable ? " + GST" : ""} · next invoice {formatDate(p.next_invoice_date)}
          {!p.active && " · paused"}
        </p>
      )}
      <MDialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Billing plan"
        footer={
          <>
            <MButton variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </MButton>
            <MButton onClick={submit} disabled={save.isPending}>
              {save.isPending && <Spinner />} Save plan
            </MButton>
          </>
        }
      >
        <div className="space-y-3">
          <TextField
            label="Plan name"
            required
            value={form.plan_name}
            onChange={(v) => setForm((f) => ({ ...f, plan_name: v }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Amount before GST (₹)"
              required
              value={form.amount}
              onChange={(v) => setForm((f) => ({ ...f, amount: v }))}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Cycle</span>
              <select
                className={M_INPUT}
                value={form.billing_cycle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, billing_cycle: e.target.value as BillingCycle }))
                }
              >
                {(Object.keys(CYCLE_LABEL) as BillingCycle[]).map((c) => (
                  <option key={c} value={c}>
                    {CYCLE_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Billing day (1-28)"
              value={form.anchor_day}
              onChange={(v) => setForm((f) => ({ ...f, anchor_day: v }))}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Next invoice on</span>
              <input
                type="date"
                className={M_INPUT}
                value={form.next_invoice_date}
                onChange={(e) => setForm((f) => ({ ...f, next_invoice_date: e.target.value }))}
              />
            </label>
          </div>
          <TextField
            label="Place of supply (GST state code)"
            value={form.place_of_supply_state_code}
            onChange={(v) => setForm((f) => ({ ...f, place_of_supply_state_code: v }))}
            hint="Same state as yours: CGST + SGST. Different state: IGST."
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.gst_applicable}
              onChange={(e) => setForm((f) => ({ ...f, gst_applicable: e.target.checked }))}
            />
            Charge GST on this plan (when GST is on in billing settings)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Plan active (included in “Generate due invoices”)
          </label>
          <FormError message={error} />
        </div>
      </MDialog>
    </Card>
  );
}

export function CustomerBillingTab({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const { can } = usePartner();
  const ledger = useCustomerLedger(customerId);
  const service = useServiceState(customerId);
  const suspendForDues = useSuspendForDues(customerId);
  const [paying, setPaying] = useState<{ invoiceId?: string } | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [voiding, setVoiding] = useState<{
    kind: "invoice" | "payment";
    id: string;
    label: string;
  } | null>(null);
  const [confirmDues, setConfirmDues] = useState(false);
  const [duesKey, setDuesKey] = useState(newIdempotencyKey);
  const [duesError, setDuesError] = useState<string | null>(null);

  if (ledger.isLoading) return <LoadingBlock />;
  if (ledger.error || !ledger.data) {
    if (ispErrorCode(ledger.error) === "ISP_BILLING_NOT_CONFIGURED")
      return (
        <MEmptyState
          icon={Wallet}
          title="Billing is not set up yet"
          description="An Owner or Admin fills in Billing → Settings (your legal name, GSTIN, invoice prefix) first."
        />
      );
    return <ErrorBlock error={ledger.error} onRetry={() => ledger.refetch()} what="billing" />;
  }
  const l = ledger.data;
  const state = service.data?.state;
  const alreadyCut = state === "suspended" || state === "suspend_pending";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MStat
          label="Balance due"
          value={formatRupees(l.balance_paise)}
          tone={l.balance_paise > 0 ? "warning" : "success"}
        />
        <MStat
          label="Overdue"
          value={formatRupees(l.overdue_paise)}
          tone={l.overdue_paise > 0 ? "danger" : "success"}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {can("isp_billing.execute") && (
          <MButton onClick={() => setPaying({})}>
            <Wallet /> Record payment
          </MButton>
        )}
        {can("isp_billing.create") && (
          <MButton variant="outline" onClick={() => setInvoicing(true)}>
            <Plus /> Create invoice
          </MButton>
        )}
        {can("isp_billing.execute") && l.overdue_paise > 0 && !alreadyCut && (
          <MButton
            className="bg-destructive text-destructive-foreground"
            onClick={() => {
              setDuesKey(newIdempotencyKey());
              setDuesError(null);
              setConfirmDues(true);
            }}
          >
            <PauseCircle /> Suspend for dues
          </MButton>
        )}
      </div>

      <PlanCard customerId={customerId} />

      <Card title="Invoices">
        {l.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <InvoicesTable
            items={l.invoices}
            canVoid={can("isp_billing.manage")}
            canPay={can("isp_billing.execute")}
            onPay={(inv) => setPaying({ invoiceId: inv.id })}
            onVoid={(inv) => setVoiding({ kind: "invoice", id: inv.id, label: inv.number })}
          />
        )}
      </Card>
      <Card title="Payments">
        {l.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <PaymentsTable
            items={l.payments}
            canVoid={can("isp_billing.manage")}
            onVoid={(p) => setVoiding({ kind: "payment", id: p.id, label: p.receipt_number })}
          />
        )}
      </Card>

      <RecordPaymentDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        customerId={customerId}
        invoiceId={paying?.invoiceId}
      />
      <CreateInvoiceDialog
        open={invoicing}
        onClose={() => setInvoicing(false)}
        customerId={customerId}
      />
      <VoidDialog target={voiding} onClose={() => setVoiding(null)} />
      <MDialog
        open={confirmDues}
        onClose={() => setConfirmDues(false)}
        title={`Suspend ${customerName} for dues?`}
        footer={
          <>
            <MButton variant="outline" onClick={() => setConfirmDues(false)}>
              Cancel
            </MButton>
            <MButton
              className="bg-destructive text-destructive-foreground"
              disabled={suspendForDues.isPending}
              onClick={async () => {
                setDuesError(null);
                try {
                  await suspendForDues.mutateAsync(duesKey);
                  toast(`${customerName} suspended for non-payment. Guest internet is being cut.`);
                  setConfirmDues(false);
                } catch (err) {
                  setDuesError(ispErrorMessage(err));
                }
              }}
            >
              {suspendForDues.isPending && <Spinner />} Suspend and cut internet
            </MButton>
          </>
        }
      >
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-sm font-medium">
          {formatRupees(l.overdue_paise)} is overdue. Guests at all of this customer&apos;s
          locations lose internet now. Recording payment later does not resume automatically; you
          will be asked.
        </p>
        <div className="mt-3">
          <FormError message={duesError} />
        </div>
      </MDialog>
    </div>
  );
}
