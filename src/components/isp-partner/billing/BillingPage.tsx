/**
 * `/partner/billing` (ADDENDUM_01 FE-B1/B3/B4): dues, invoices, payments
 * and billing settings. Cash / UPI / bank only: online payment links are
 * Phase 1c and not offered here.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, FilePlus2, RefreshCw, Wallet } from "lucide-react";
import { MButton, MEmptyState, MSectionHeader, MSeg, M_INPUT } from "@/components/master/MasterKit";
import {
  Card,
  CustomerSelect,
  ErrorBlock,
  FormError,
  Pager,
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
  useBillingSettings,
  useGenerateDueInvoices,
  useInvoices,
  usePayments,
  useSaveBillingSettings,
} from "@/hooks/isp-partner/useBilling";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { billingService } from "@/services/isp-partner/billing";
import { ispErrorCode, ispErrorMessage } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { INVOICE_STATUS_LABEL } from "@/lib/isp-partner/money";
import type { BillingSettings } from "@/services/isp-partner/billing-types";

export type BillingTab = "dues" | "invoices" | "payments" | "settings";

const DAY = 86_400_000;

function ExportButton({ kind }: { kind: "invoices" | "payments" | "dues" }) {
  const [busy, setBusy] = useState(false);
  return (
    <MButton
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const until = new Date();
          const since = new Date(until.getTime() - 365 * DAY);
          const { blob, filename } = await billingService.exportCsv(
            kind,
            since.toISOString(),
            until.toISOString(),
          );
          saveBlob(blob, filename);
        } catch (err) {
          toast.error(ispErrorMessage(err, "The export failed."));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <Download />} Export CSV (last 12 months)
    </MButton>
  );
}

function InvoicesPanel({ overdueOnly }: { overdueOnly: boolean }) {
  const { can } = usePartner();
  const customers = useIspCustomerOptions();
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<{ customerId: string; invoiceId: string } | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [voiding, setVoiding] = useState<{ kind: "invoice"; id: string; label: string } | null>(
    null,
  );
  const generate = useGenerateDueInvoices();
  const q = useInvoices({
    isp_customer_id: customerId || undefined,
    status: overdueOnly ? undefined : status || undefined,
    overdue: overdueOnly ? true : undefined,
    page,
    page_size: 25,
  });
  const data = q.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[240px]">
          <CustomerSelect
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              setPage(1);
            }}
            customers={customers.data}
          />
        </div>
        {!overdueOnly && (
          <select
            className={`${M_INPUT} w-auto`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Status"
          >
            <option value="">Any status</option>
            {Object.entries(INVOICE_STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!overdueOnly && can("isp_billing.create") && (
            <>
              <MButton
                variant="outline"
                disabled={generate.isPending}
                onClick={async () => {
                  try {
                    const res = await generate.mutateAsync();
                    toast.success(
                      res.created.length === 0
                        ? "No customer plan is due today; nothing was created."
                        : `${res.created.length} invoice(s) created.`,
                    );
                  } catch (err) {
                    toast.error(ispErrorMessage(err));
                  }
                }}
              >
                {generate.isPending ? <Spinner /> : <RefreshCw />} Generate due invoices
              </MButton>
              <MButton onClick={() => setInvoicing(true)}>
                <FilePlus2 /> Create invoice
              </MButton>
            </>
          )}
          {can("isp_billing.export") && <ExportButton kind={overdueOnly ? "dues" : "invoices"} />}
        </div>
      </div>
      {overdueOnly && (
        <p className="text-xs text-muted-foreground">
          Customer invoices past their due date plus the grace days, with money still owed. Open a
          customer to record a payment or suspend for dues. Every invoice, including subscriber
          invoices and credit notes, is under{" "}
          <Link to="/partner/invoices" className="text-primary hover:underline">
            Invoices
          </Link>
          .
        </p>
      )}
      {q.error && !data ? (
        ispErrorCode(q.error) === "ISP_BILLING_NOT_CONFIGURED" ? (
          <MEmptyState
            icon={Wallet}
            title="Billing is not set up yet"
            description="Fill in the Settings tab first."
          />
        ) : (
          <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="invoices" />
        )
      ) : data && data.items.length === 0 ? (
        <MEmptyState icon={Wallet} title={overdueOnly ? "Nothing overdue" : "No invoices"} />
      ) : (
        <>
          <InvoicesTable
            items={data?.items ?? []}
            loading={q.isLoading}
            showCustomer
            canPay={can("isp_billing.execute")}
            canVoid={can("isp_billing.manage")}
            onPay={(inv) => setPaying({ customerId: inv.isp_customer_id, invoiceId: inv.id })}
            onVoid={(inv) => setVoiding({ kind: "invoice", id: inv.id, label: inv.number })}
          />
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
      <RecordPaymentDialog
        open={paying !== null}
        onClose={() => setPaying(null)}
        customerId={paying?.customerId}
        invoiceId={paying?.invoiceId}
      />
      <CreateInvoiceDialog open={invoicing} onClose={() => setInvoicing(false)} />
      <VoidDialog target={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

function PaymentsPanel() {
  const { can } = usePartner();
  const customers = useIspCustomerOptions();
  const [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [voiding, setVoiding] = useState<{ kind: "payment"; id: string; label: string } | null>(
    null,
  );
  const q = usePayments({ isp_customer_id: customerId || undefined, page, page_size: 25 });
  const data = q.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[240px]">
          <CustomerSelect
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              setPage(1);
            }}
            customers={customers.data}
          />
        </div>
        <div className="ml-auto flex gap-2">
          {can("isp_billing.execute") && (
            <MButton onClick={() => setRecording(true)}>
              <Wallet /> Record payment
            </MButton>
          )}
          {can("isp_billing.export") && <ExportButton kind="payments" />}
        </div>
      </div>
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="payments" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState icon={Wallet} title="No payments recorded" />
      ) : (
        <>
          <PaymentsTable
            items={data?.items ?? []}
            loading={q.isLoading}
            showCustomer
            canVoid={can("isp_billing.manage")}
            onVoid={(p) => setVoiding({ kind: "payment", id: p.id, label: p.receipt_number })}
          />
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
      <RecordPaymentDialog open={recording} onClose={() => setRecording(false)} />
      <VoidDialog target={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

type SettingsForm = Record<
  | "legal_name"
  | "gstin"
  | "state_code"
  | "address"
  | "invoice_prefix"
  | "receipt_prefix"
  | "gst_rate_pct"
  | "sac_code"
  | "upi_vpa"
  | "payee_name"
  | "default_due_days"
  | "grace_days",
  string
> & { gst_enabled: boolean };

function toForm(s: BillingSettings | undefined): SettingsForm {
  return {
    legal_name: s?.legal_name ?? "",
    gstin: s?.gstin ?? "",
    state_code: s?.state_code ?? "",
    address: s?.address ?? "",
    invoice_prefix: s?.invoice_prefix ?? "INV",
    receipt_prefix: s?.receipt_prefix ?? "RCT",
    gst_rate_pct: String((s?.gst_rate_bp ?? 1800) / 100),
    sac_code: s?.sac_code ?? "998422",
    upi_vpa: s?.upi_vpa ?? "",
    payee_name: s?.payee_name ?? "",
    default_due_days: String(s?.default_due_days ?? 7),
    grace_days: String(s?.grace_days ?? 7),
    gst_enabled: s?.gst_enabled ?? false,
  };
}

function SettingsPanel() {
  const { can } = usePartner();
  const editable = can("isp_billing.manage");
  const q = useBillingSettings();
  const save = useSaveBillingSettings();
  const notConfigured = ispErrorCode(q.error) === "ISP_BILLING_NOT_CONFIGURED";
  const [form, setForm] = useState<SettingsForm>(() => toForm(undefined));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(toForm(q.data)), [q.data]);
  const set = (k: keyof SettingsForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (q.isLoading) return <Spinner />;
  if (q.error && !notConfigured)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="billing settings" />;

  const submit = async () => {
    const rate = Number(form.gst_rate_pct);
    const due = Number(form.default_due_days);
    const grace = Number(form.grace_days);
    if (!form.legal_name.trim())
      return setError("Your legal name is printed on every invoice; it is required.");
    if (form.gstin && !/^[0-9A-Z]{15}$/.test(form.gstin.trim().toUpperCase()))
      return setError("A GSTIN is 15 letters and digits.");
    if (form.state_code && !/^\d{2}$/.test(form.state_code))
      return setError("State code is 2 digits, e.g. 07 for Delhi.");
    if (!Number.isFinite(rate) || rate < 0 || rate > 28)
      return setError("GST rate must be between 0 and 28 %.");
    if (!Number.isInteger(due) || due < 0 || !Number.isInteger(grace) || grace < 0)
      return setError("Due and grace days are whole numbers.");
    setError(null);
    try {
      await save.mutateAsync({
        legal_name: form.legal_name.trim(),
        gstin: form.gstin.trim().toUpperCase() || null,
        state_code: form.state_code || null,
        address: form.address.trim() || null,
        invoice_prefix: form.invoice_prefix.trim() || "INV",
        receipt_prefix: form.receipt_prefix.trim() || "RCT",
        gst_enabled: form.gst_enabled,
        gst_rate_bp: Math.round(rate * 100),
        sac_code: form.sac_code.trim() || "998422",
        upi_vpa: form.upi_vpa.trim() || null,
        payee_name: form.payee_name.trim() || null,
        default_due_days: due,
        grace_days: grace,
      });
      toast.success("Billing settings saved.");
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {notConfigured && (
        <p className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2.5 text-xs">
          Billing is not set up yet. Save these settings once to start raising invoices.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="On your invoices">
          <div className="space-y-3">
            <TextField
              label="Legal name"
              required
              value={form.legal_name}
              onChange={set("legal_name")}
              disabled={!editable}
            />
            <TextField
              label="GSTIN"
              value={form.gstin}
              onChange={set("gstin")}
              disabled={!editable}
            />
            <TextField
              label="State code (GST)"
              value={form.state_code}
              onChange={set("state_code")}
              disabled={!editable}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Address</span>
              <textarea
                className={M_INPUT}
                rows={3}
                value={form.address}
                disabled={!editable}
                onChange={(e) => set("address")(e.target.value)}
              />
            </label>
          </div>
        </Card>
        <Card title="Numbers and tax">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Invoice prefix"
                value={form.invoice_prefix}
                onChange={set("invoice_prefix")}
                disabled={!editable}
              />
              <TextField
                label="Receipt prefix"
                value={form.receipt_prefix}
                onChange={set("receipt_prefix")}
                disabled={!editable}
              />
            </div>
            {q.data?.next_invoice_seq !== undefined && (
              <p className="text-[11px] text-muted-foreground">
                Next invoice no. {form.invoice_prefix}-{q.data.next_invoice_seq} · next receipt no.{" "}
                {form.receipt_prefix}-{q.data.next_receipt_seq}. Numbers never skip.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.gst_enabled}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, gst_enabled: e.target.checked }))}
              />
              Charge GST
            </label>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="GST rate (%)"
                value={form.gst_rate_pct}
                onChange={set("gst_rate_pct")}
                disabled={!editable}
              />
              <TextField
                label="SAC code"
                value={form.sac_code}
                onChange={set("sac_code")}
                disabled={!editable}
              />
            </div>
          </div>
        </Card>
        <Card title="Getting paid">
          <div className="space-y-3">
            <TextField
              label="UPI ID (VPA)"
              value={form.upi_vpa}
              onChange={set("upi_vpa")}
              disabled={!editable}
              hint="If set, invoices carry a UPI QR. Record those payments with mode UPI and the UTR."
            />
            <TextField
              label="Payee name"
              value={form.payee_name}
              onChange={set("payee_name")}
              disabled={!editable}
            />
          </div>
        </Card>
        <Card title="Due dates">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Due after (days)"
                value={form.default_due_days}
                onChange={set("default_due_days")}
                disabled={!editable}
              />
              <TextField
                label="Grace before overdue (days)"
                value={form.grace_days}
                onChange={set("grace_days")}
                disabled={!editable}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={q.data?.auto_suspend_enabled ?? false}
                disabled
                readOnly
              />
              Auto-suspend overdue customers
            </label>
            <p className="text-[11px] text-muted-foreground">
              Needs the platform scheduler, which is not switched on yet. Until then, suspend for
              dues by hand from the Dues tab or the customer&apos;s Billing tab.
            </p>
          </div>
        </Card>
      </div>
      <FormError message={error} />
      {editable && (
        <div className="flex justify-end">
          <MButton onClick={submit} disabled={save.isPending}>
            {save.isPending && <Spinner />} Save settings
          </MButton>
        </div>
      )}
    </div>
  );
}

export function BillingPage({ tab, onTab }: { tab: BillingTab; onTab: (t: BillingTab) => void }) {
  const { can } = usePartner();
  const tabs: { value: BillingTab; label: string }[] = [
    { value: "dues", label: "Dues" },
    { value: "payments", label: "Payments" },
    { value: "settings", label: "Settings" },
  ];
  const visible = can("isp_billing.read") ? tabs : [];
  const active = visible.some((t) => t.value === tab) ? tab : "dues";
  if (visible.length === 0)
    return <MEmptyState icon={Wallet} title="Your role does not include billing" />;
  return (
    <>
      <MSectionHeader
        eyebrow="Billing"
        title="Billing"
        description="Invoices, dues and cash / UPI / bank payments for your customers."
      />
      <MSeg<BillingTab> value={active} onChange={onTab} options={visible} />
      {active === "dues" && <InvoicesPanel key="dues" overdueOnly />}
      {active === "payments" && <PaymentsPanel />}
      {active === "settings" && <SettingsPanel />}
    </>
  );
}
