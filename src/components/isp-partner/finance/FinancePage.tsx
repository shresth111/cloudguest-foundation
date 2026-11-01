/**
 * `/partner/finance` (JAZE-4, ADDENDUM_05): the finance tools around billing.
 *
 * Tabs: invoice template (bank details on the PDF), products (SAC codes),
 * package billing plans, static-IP leases, security deposits, zones (a
 * labels-only ledger: no logins, no sub-accounts), automation (WhatsApp via
 * the ISP's own sender, Telegram alerts) and the message log. Each group is
 * behind its own backend flag; a 404 shows a "not switched on yet" state.
 */
import { ZoneBrandingCard } from "@/components/isp-partner/finance/ZoneBrandingCard";
import { StaticIpLedger } from "@/components/isp-partner/finance/StaticIpLedger";
import { staticIpKeys, useStaticIpLedgerAvailable } from "@/hooks/isp-partner/useStaticIp";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Landmark, Plus, RefreshCw, Send } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
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
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { isNotFound, ispErrorMessage } from "@/lib/isp-partner/errors";
import { isoDay } from "@/lib/isp-partner/format";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import {
  financeService,
  type AutomationSettings,
  type BillingProduct,
  type InvoiceTemplate,
  type ProductKind,
  type Trigger,
  type ZoneLedger,
} from "@/services/isp-partner/finance";
import { plansService } from "@/services/isp-partner/plans";
import { CommsHub } from "@/components/isp-partner/finance/CommsHub";
import { FranchisePanel } from "@/components/isp-partner/finance/FranchisePanel";

export type FinanceTab =
  | "template"
  | "products"
  | "packages"
  | "leases"
  | "deposits"
  | "zones"
  | "automation"
  | "messages";

const fk = (...k: unknown[]) => ["isp", "finance", ...k] as const;

function NotOn({ what }: { what: string }) {
  return (
    <MEmptyState
      icon={Landmark}
      title={`${what} is not switched on yet`}
      description="Ask Wyfy to turn it on for your account."
    />
  );
}

function QueryState({
  q,
  what,
}: {
  q: { isLoading: boolean; error: unknown; refetch: () => unknown };
  what: string;
}) {
  if (q.isLoading) return <Spinner />;
  if (q.error && isNotFound(q.error)) return <NotOn what={what} />;
  if (q.error) return <ErrorBlock error={q.error} what={what} onRetry={() => void q.refetch()} />;
  return null;
}

// ---------------------------------------------------------------------------
// invoice template
// ---------------------------------------------------------------------------

const TEMPLATE_FIELDS: { key: keyof InvoiceTemplate; label: string; hint?: string }[] = [
  { key: "bank_account_name", label: "Account name" },
  { key: "bank_name", label: "Bank name" },
  { key: "bank_account_number", label: "Account number" },
  { key: "bank_ifsc", label: "IFSC", hint: "11 characters, e.g. ABCD0123456" },
  { key: "bank_branch", label: "Branch" },
  { key: "care_phone", label: "Customer care phone" },
  { key: "care_email", label: "Customer care email" },
  { key: "website", label: "Website" },
  { key: "pan", label: "PAN" },
  {
    key: "licence_number",
    label: "Licence number",
    hint: "Printed on invoices, e.g. your ISP licence number",
  },
];

function TemplateTab() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: fk("template"), queryFn: financeService.template, retry: false });
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) {
      const f: Record<string, string | boolean> = {};
      for (const { key } of TEMPLATE_FIELDS) f[key] = (q.data[key] as string | null) ?? "";
      f.terms = q.data.terms ?? "";
      f.show_bank_details = q.data.show_bank_details;
      f.show_zone_operator = q.data.show_zone_operator;
      setForm(f);
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form))
        body[k] = typeof v === "string" ? v.trim() || null : v;
      return financeService.saveTemplate(body as Partial<InvoiceTemplate>);
    },
    onSuccess: (d) => {
      qc.setQueryData(fk("template"), d);
      toast.success("Invoice details saved. New and re-downloaded PDFs carry them.");
      setError(null);
    },
    onError: (e) => setError(ispErrorMessage(e, "Could not save.")),
  });
  const blocked = QueryState({ q, what: "Invoice details" });
  if (blocked) return blocked;
  const editable = can("isp_billing.manage");
  return (
    <div className="space-y-4">
      <Card title="Printed on every invoice">
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATE_FIELDS.map(({ key, label, hint }) => (
            <TextField
              key={key}
              label={label}
              hint={hint}
              value={String(form[key] ?? "")}
              disabled={!editable}
              onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
            />
          ))}
        </div>
        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Terms / note (printed at the bottom)
          </span>
          <textarea
            className={`${M_INPUT} min-h-20`}
            value={String(form.terms ?? "")}
            disabled={!editable}
            onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.show_bank_details)}
              disabled={!editable}
              onChange={(e) => setForm((f) => ({ ...f, show_bank_details: e.target.checked }))}
            />
            Show bank details on invoices
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.show_zone_operator)}
              disabled={!editable}
              onChange={(e) => setForm((f) => ({ ...f, show_zone_operator: e.target.checked }))}
            />
            Show the zone operator&apos;s name and phone
          </label>
        </div>
      </Card>
      <FormError message={error} />
      {editable && (
        <div className="flex justify-end">
          <MButton onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Spinner />} Save
          </MButton>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<ProductKind, string> = {
  bandwidth: "Bandwidth",
  static_ip: "Static IP",
  installation: "Installation",
  other: "Other",
};

function ProductsTab() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: fk("products"), queryFn: financeService.products, retry: false });
  const [editing, setEditing] = useState<Partial<BillingProduct> | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: fk("products") });
  const standard = useMutation({ mutationFn: financeService.standardProducts, onSuccess: done });
  const save = useMutation({
    mutationFn: async () => {
      const paise = parseRupeesToPaise(amount || "0");
      if (paise === null) throw new Error("Enter the amount in rupees, e.g. 500 or 499.50");
      const body = {
        name: editing?.name ?? "",
        kind: (editing?.kind ?? "other") as ProductKind,
        sac_code: editing?.sac_code || "998422",
        default_amount_paise: paise,
        price_includes_gst: Boolean(editing?.price_includes_gst),
        active: editing?.active ?? true,
      };
      return editing?.id
        ? financeService.updateProduct(editing.id, body)
        : financeService.createProduct(body);
    },
    onSuccess: () => {
      setEditing(null);
      done();
    },
    onError: (e) =>
      setError(e instanceof Error && !("response" in e) ? e.message : ispErrorMessage(e)),
  });
  const blocked = QueryState({ q, what: "The product list" });
  if (blocked) return blocked;
  const editable = can("isp_billing.manage");
  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex flex-wrap gap-2">
          <MButton
            onClick={() => {
              setEditing({ kind: "bandwidth", sac_code: "998422", active: true });
              setAmount("");
              setError(null);
            }}
          >
            <Plus /> New product
          </MButton>
          {(q.data ?? []).length === 0 && (
            <MButton
              variant="outline"
              onClick={() => standard.mutate()}
              disabled={standard.isPending}
            >
              Add the four standard products
            </MButton>
          )}
        </div>
      )}
      <MTable
        head={
          <>
            <MTh>Name</MTh>
            <MTh>Type</MTh>
            <MTh>SAC</MTh>
            <MTh>Default amount</MTh>
            <MTh>Status</MTh>
          </>
        }
      >
        {(q.data ?? []).map((p) => (
          <MTr
            key={p.id}
            onClick={
              editable
                ? () => {
                    setEditing(p);
                    setAmount(paiseToInput(p.default_amount_paise));
                    setError(null);
                  }
                : undefined
            }
          >
            <MTd>{p.name}</MTd>
            <MTd>{KIND_LABEL[p.kind]}</MTd>
            <MTd>{p.sac_code}</MTd>
            <MTd>
              {formatRupees(p.default_amount_paise)}{" "}
              {p.price_includes_gst ? "(incl. GST)" : "+ GST"}
            </MTd>
            <MTd>
              <MTag label={p.active ? "Active" : "Off"} tone={p.active ? "success" : undefined} />
            </MTd>
          </MTr>
        ))}
      </MTable>
      <p className="text-[11px] text-muted-foreground">
        SAC 998422 (internet access) is the default. Pick these when you create an invoice line.
      </p>
      <MDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit product" : "New product"}
        footer={
          <MButton onClick={() => save.mutate()} disabled={save.isPending || !editing?.name}>
            {save.isPending && <Spinner />} Save
          </MButton>
        }
      >
        <div className="space-y-3">
          <TextField
            label="Name"
            required
            value={editing?.name ?? ""}
            onChange={(v) => setEditing((e) => ({ ...e, name: v }))}
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <select
              className={M_INPUT}
              value={editing?.kind ?? "other"}
              onChange={(e) => setEditing((x) => ({ ...x, kind: e.target.value as ProductKind }))}
            >
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="SAC code"
              value={editing?.sac_code ?? "998422"}
              onChange={(v) => setEditing((e) => ({ ...e, sac_code: v }))}
            />
            <TextField label="Default amount (₹)" value={amount} onChange={setAmount} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(editing?.price_includes_gst)}
              onChange={(e) => setEditing((x) => ({ ...x, price_includes_gst: e.target.checked }))}
            />
            The amount already includes GST
          </label>
          {editing?.id && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active ?? true}
                onChange={(e) => setEditing((x) => ({ ...x, active: e.target.checked }))}
              />
              Active
            </label>
          )}
          <FormError message={error} />
        </div>
      </MDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// package billing plans
// ---------------------------------------------------------------------------

function TaxBreakdown({
  p,
}: {
  p: {
    taxable_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    total_paise: number;
    gst_applied: boolean;
  };
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Base {formatRupees(p.taxable_paise)}
      {p.gst_applied && p.igst_paise > 0 && <> + IGST {formatRupees(p.igst_paise)}</>}
      {p.gst_applied && p.cgst_paise > 0 && (
        <>
          {" "}
          + CGST {formatRupees(p.cgst_paise)} + SGST {formatRupees(p.sgst_paise)}
        </>
      )}{" "}
      = <span className="font-semibold text-foreground">{formatRupees(p.total_paise)}</span>
      {!p.gst_applied && " (GST is off in billing settings)"}
    </p>
  );
}

function PackageBillingDialog({ packageId, onClose }: { packageId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: fk("package", packageId),
    queryFn: () => financeService.packageBilling(packageId),
  });
  const products = useQuery({
    queryKey: fk("products"),
    queryFn: financeService.products,
    retry: false,
  });
  const [form, setForm] = useState({
    plan_kind: "prepaid" as "prepaid" | "postpaid",
    chargeable_unit: "days" as "days" | "months",
    chargeable_count: "30",
    invoice_description: "",
    product_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.data)
      setForm({
        plan_kind: q.data.plan_kind,
        chargeable_unit: q.data.chargeable_unit,
        chargeable_count: String(q.data.chargeable_count),
        invoice_description: q.data.invoice_description,
        product_id: q.data.product_id ?? "",
      });
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      financeService.savePackageBilling(packageId, {
        plan_kind: form.plan_kind,
        chargeable_unit: form.chargeable_unit,
        chargeable_count: Number(form.chargeable_count),
        invoice_description: form.invoice_description,
        product_id: form.product_id || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fk("package", packageId) });
      toast.success("Billing plan saved.");
      onClose();
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  return (
    <MDialog
      open
      onClose={onClose}
      title={q.data ? `Billing plan: ${q.data.package_name}` : "Billing plan"}
      footer={
        <MButton onClick={() => save.mutate()} disabled={save.isPending || !q.data}>
          {save.isPending && <Spinner />} Save
        </MButton>
      }
    >
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <FormError message={ispErrorMessage(q.error)} />
      ) : (
        <div className="space-y-3">
          <MSeg
            value={form.plan_kind}
            onChange={(v) => setForm((f) => ({ ...f, plan_kind: v }))}
            options={[
              { value: "prepaid", label: "Prepaid" },
              { value: "postpaid", label: "Postpaid" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Charge for every"
              value={form.chargeable_count}
              onChange={(v) => setForm((f) => ({ ...f, chargeable_count: v.replace(/\D/g, "") }))}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Unit</span>
              <select
                className={M_INPUT}
                value={form.chargeable_unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chargeable_unit: e.target.value as "days" | "months" }))
                }
              >
                <option value="days">Days</option>
                <option value="months">Months</option>
              </select>
            </label>
          </div>
          <TextField
            label="Invoice description"
            value={form.invoice_description}
            onChange={(v) => setForm((f) => ({ ...f, invoice_description: v }))}
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Product (sets the SAC code)
            </span>
            <select
              className={M_INPUT}
              value={form.product_id}
              onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
            >
              <option value="">Default (billing settings)</option>
              {(products.data ?? [])
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · SAC {p.sac_code}
                  </option>
                ))}
            </select>
          </label>
          {q.data && (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-xs font-medium">
                Price {q.data.price_includes_gst ? "(GST included)" : "(GST extra)"}
              </p>
              <TaxBreakdown p={q.data.preview} />
              {q.data.preview.billing_configured === false && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Set up billing settings to see your GST rate.
                </p>
              )}
            </div>
          )}
          <FormError message={error} />
        </div>
      )}
    </MDialog>
  );
}

function PackagesTab() {
  const { can } = usePartner();
  const q = useQuery({
    queryKey: ["isp", "plans", "packages", "finance"],
    queryFn: () => plansService.listPackages({ page_size: 100 } as never),
  });
  const probe = useQuery({
    queryKey: fk("products"),
    queryFn: financeService.products,
    retry: false,
  });
  const [open, setOpen] = useState<string | null>(null);
  const blocked = QueryState({ q: probe, what: "Package billing" });
  if (blocked) return blocked;
  if (q.isLoading) return <Spinner />;
  const items = q.data?.items ?? [];
  if (items.length === 0)
    return (
      <MEmptyState
        icon={Banknote}
        title="No packages yet"
        description="Create packages under Plans & coupons first."
      />
    );
  return (
    <>
      <MTable
        head={
          <>
            <MTh>Package</MTh>
            <MTh>Type</MTh>
            <MTh>Validity</MTh>
            <MTh>Price</MTh>
            <MTh />
          </>
        }
      >
        {items.map((p) => (
          <MTr key={p.id}>
            <MTd>{p.name}</MTd>
            <MTd>{p.type}</MTd>
            <MTd>{p.validity_days} days</MTd>
            <MTd>{formatRupees(p.price_paise)}</MTd>
            <MTd>
              {can("isp_plans.read") && (
                <MButton variant="outline" onClick={() => setOpen(p.id)}>
                  Billing plan
                </MButton>
              )}
            </MTd>
          </MTr>
        ))}
      </MTable>
      {open && <PackageBillingDialog packageId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// static IP leases
// ---------------------------------------------------------------------------

function LeasesTab() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const customers = useIspCustomerOptions();
  const [status, setStatus] = useState<"active" | "ended">("active");
  const q = useQuery({
    queryKey: fk("leases", status),
    queryFn: () => financeService.leases({ status }),
    retry: false,
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    customer: "",
    ip: "",
    amount: "",
    incl: false,
    since: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  // STATICIP-2: the full ledger replaces the plain table when its API is on.
  const ledgerOn = useStaticIpLedgerAvailable();
  const done = () => {
    qc.invalidateQueries({ queryKey: fk("leases") });
    qc.invalidateQueries({ queryKey: staticIpKeys.all });
  };
  const create = useMutation({
    mutationFn: () => {
      const paise = parseRupeesToPaise(form.amount);
      if (paise === null) throw new Error("Enter the monthly rent in rupees");
      return financeService.createLease({
        isp_customer_id: form.customer,
        ip_address: form.ip.trim(),
        monthly_amount_paise: paise,
        price_includes_gst: form.incl,
        active_since: form.since || undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      setAdding(false);
      done();
    },
    onError: (e) =>
      setError(e instanceof Error && !("response" in e) ? e.message : ispErrorMessage(e)),
  });
  const bill = useMutation({
    mutationFn: financeService.billLeases,
    onSuccess: (r) => {
      toast.success(
        r.invoices_issued
          ? `${r.invoices_issued} invoice(s) issued.`
          : "Nothing due: every lease is billed up to date.",
      );
      done();
    },
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const end = useMutation({
    mutationFn: (id: string) => financeService.endLease(id),
    onSuccess: done,
  });
  const blocked = QueryState({ q, what: "Static IP billing" });
  if (blocked) return blocked;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!ledgerOn && (
          <MSeg
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "ended", label: "Ended" },
            ]}
          />
        )}
        {can("isp_billing.manage") && (
          <MButton
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
          >
            <Plus /> New lease
          </MButton>
        )}
        {can("isp_billing.execute") && (
          <MButton variant="outline" onClick={() => bill.mutate()} disabled={bill.isPending}>
            {bill.isPending ? <Spinner /> : <RefreshCw />} Bill due months now
          </MButton>
        )}
      </div>
      {ledgerOn ? (
        <StaticIpLedger />
      ) : (
        <MTable
          head={
            <>
              <MTh>IP</MTh>
              <MTh>Customer</MTh>
              <MTh>Subscriber</MTh>
              <MTh>Monthly</MTh>
              <MTh>Since</MTh>
              <MTh>Billed through</MTh>
              <MTh />
            </>
          }
        >
          {(q.data ?? []).map((l) => (
            <MTr key={l.id}>
              <MTd className="font-mono">{l.ip_address}</MTd>
              <MTd>{l.customer_name ?? "–"}</MTd>
              <MTd>{l.subscriber_name ?? "–"}</MTd>
              <MTd>{formatRupees(l.monthly_amount_paise)}</MTd>
              <MTd>{l.active_since}</MTd>
              <MTd>{l.billed_through ?? "not yet"}</MTd>
              <MTd>
                {l.status === "active" && can("isp_billing.manage") && (
                  <MButton variant="ghost" onClick={() => end.mutate(l.id)}>
                    End today
                  </MButton>
                )}
                {l.status === "ended" && <span className="text-xs">until {l.active_until}</span>}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      <p className="text-[11px] text-muted-foreground">
        One invoice per lease per month, issued by the daily billing run (or the button above). A
        month is never billed twice.
      </p>
      <MDialog
        open={adding}
        onClose={() => setAdding(false)}
        title="New static IP lease"
        footer={
          <MButton
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.customer || !form.ip}
          >
            {create.isPending && <Spinner />} Save
          </MButton>
        }
      >
        <div className="space-y-3">
          <CustomerSelect
            value={form.customer}
            onChange={(v) => setForm((f) => ({ ...f, customer: v }))}
            customers={customers.data}
            allLabel={null}
          />
          <TextField
            label="IP address"
            required
            value={form.ip}
            onChange={(v) => setForm((f) => ({ ...f, ip: v }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Monthly rent (₹)"
              required
              value={form.amount}
              onChange={(v) => setForm((f) => ({ ...f, amount: v }))}
            />
            <TextField
              label="Active since"
              type="date"
              value={form.since}
              onChange={(v) => setForm((f) => ({ ...f, since: v }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.incl}
              onChange={(e) => setForm((f) => ({ ...f, incl: e.target.checked }))}
            />
            The rent already includes GST
          </label>
          <TextField
            label="Notes"
            value={form.notes}
            onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
          />
          <FormError message={error} />
        </div>
      </MDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// security deposits
// ---------------------------------------------------------------------------

function DepositsTab() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const customers = useIspCustomerOptions();
  const q = useQuery({
    queryKey: fk("deposits"),
    queryFn: financeService.depositsHeld,
    retry: false,
  });
  const [entry, setEntry] = useState<null | {
    kind: "collect" | "refund" | "forfeit";
    customer: string;
    subscriber?: string;
  }>(null);
  const [form, setForm] = useState({
    item: "ont",
    serial: "",
    amount: "",
    mode: "cash",
    reference: "",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const paise = parseRupeesToPaise(form.amount);
      if (!paise) throw new Error("Enter the amount in rupees");
      return financeService.addDeposit({
        isp_customer_id: entry!.subscriber ? undefined : entry!.customer,
        subscriber_id: entry!.subscriber,
        entry_kind: entry!.kind,
        item: form.item as "ont",
        item_serial: form.serial || undefined,
        amount_paise: paise,
        mode: form.mode,
        reference: form.reference || undefined,
        note: form.note || undefined,
      });
    },
    onSuccess: () => {
      setEntry(null);
      qc.invalidateQueries({ queryKey: fk("deposits") });
    },
    onError: (e) =>
      setError(e instanceof Error && !("response" in e) ? e.message : ispErrorMessage(e)),
  });
  const blocked = QueryState({ q, what: "Security deposits" });
  if (blocked) return blocked;
  const open = (kind: "collect" | "refund" | "forfeit", customer: string, subscriber?: string) => {
    setEntry({ kind, customer, subscriber });
    setForm({
      item: "ont",
      serial: "",
      amount: "",
      mode: kind === "forfeit" ? "adjustment" : "cash",
      reference: "",
      note: "",
    });
    setError(null);
  };
  return (
    <div className="space-y-4">
      {can("isp_billing.execute") && (
        <MButton onClick={() => open("collect", "")}>
          <Plus /> Collect a deposit
        </MButton>
      )}
      <MTable
        head={
          <>
            <MTh>Customer</MTh>
            <MTh>Subscriber</MTh>
            <MTh>Collected</MTh>
            <MTh>Refunded</MTh>
            <MTh>Forfeited</MTh>
            <MTh>Held</MTh>
            <MTh />
          </>
        }
      >
        {(q.data ?? []).map((d) => (
          <MTr key={`${d.isp_customer_id}-${d.subscriber_id ?? ""}`}>
            <MTd>{d.customer_name ?? "–"}</MTd>
            <MTd>{d.subscriber_name ?? "–"}</MTd>
            <MTd>{formatRupees(d.collected_paise)}</MTd>
            <MTd>{formatRupees(d.refunded_paise)}</MTd>
            <MTd>{formatRupees(d.forfeited_paise)}</MTd>
            <MTd className="font-semibold">{formatRupees(d.held_paise)}</MTd>
            <MTd>
              {can("isp_billing.execute") && d.held_paise > 0 && (
                <div className="flex gap-1">
                  <MButton
                    variant="ghost"
                    onClick={() => open("refund", d.isp_customer_id, d.subscriber_id ?? undefined)}
                  >
                    Refund
                  </MButton>
                  <MButton
                    variant="ghost"
                    onClick={() => open("forfeit", d.isp_customer_id, d.subscriber_id ?? undefined)}
                  >
                    Forfeit
                  </MButton>
                </div>
              )}
            </MTd>
          </MTr>
        ))}
      </MTable>
      <MDialog
        open={entry !== null}
        onClose={() => setEntry(null)}
        title={
          entry
            ? { collect: "Collect deposit", refund: "Refund deposit", forfeit: "Forfeit deposit" }[
                entry.kind
              ]
            : ""
        }
        footer={
          <MButton
            onClick={() => save.mutate()}
            disabled={save.isPending || !(entry?.customer || entry?.subscriber)}
          >
            {save.isPending && <Spinner />} Save
          </MButton>
        }
      >
        <div className="space-y-3">
          {entry && !entry.subscriber && (
            <CustomerSelect
              value={entry.customer}
              onChange={(v) => setEntry((e) => e && { ...e, customer: v })}
              customers={customers.data}
              allLabel={null}
              disabled={entry.kind !== "collect"}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">For</span>
              <select
                className={M_INPUT}
                value={form.item}
                onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
              >
                <option value="ont">ONT</option>
                <option value="router">Router</option>
                <option value="stb">Set-top box</option>
                <option value="other">Other</option>
              </select>
            </label>
            <TextField
              label="Device serial"
              value={form.serial}
              onChange={(v) => setForm((f) => ({ ...f, serial: v }))}
            />
            <TextField
              label="Amount (₹)"
              required
              value={form.amount}
              onChange={(v) => setForm((f) => ({ ...f, amount: v }))}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Mode</span>
              <select
                className={M_INPUT}
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </label>
          </div>
          <TextField
            label="Reference (UTR / receipt no.)"
            value={form.reference}
            onChange={(v) => setForm((f) => ({ ...f, reference: v }))}
          />
          <TextField
            label="Note"
            value={form.note}
            onChange={(v) => setForm((f) => ({ ...f, note: v }))}
          />
          <FormError message={error} />
        </div>
      </MDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// zones (labels only)
// ---------------------------------------------------------------------------

// Local calendar day: toISOString() is the UTC day, a day behind in IST
// before 05:30. /finance/zones/revenue takes plain `date` params.
const today = () => isoDay(new Date());
const monthStart = () => `${today().slice(0, 8)}01`;

function ZoneDialog({ zone, onClose }: { zone: ZoneLedger; onClose: () => void }) {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: fk("zone", zone.zone_id),
    queryFn: () => financeService.zone(zone.zone_id),
  });
  const [kind, setKind] = useState<"add" | "reduce" | "credit_limit">("add");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setProfile({
      contact_name: zone.contact_name ?? "",
      phone: zone.phone ?? "",
      email: zone.email ?? "",
      address: zone.address ?? "",
      pincode: zone.pincode ?? "",
      gstin: zone.gstin ?? "",
      pan: zone.pan ?? "",
      operator_name: zone.operator_name ?? "",
      operator_phone: zone.operator_phone ?? "",
      revenue_share_pct: String(zone.revenue_share_bp / 100),
      tds_rate_pct: String(zone.tds_rate_bp / 100),
    });
  }, [zone]);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: fk("zones") });
    qc.invalidateQueries({ queryKey: fk("zone", zone.zone_id) });
  };
  const entry = useMutation({
    mutationFn: () => {
      const paise = parseRupeesToPaise(amount);
      if (paise === null || (kind !== "credit_limit" && paise === 0))
        throw new Error("Enter an amount in rupees");
      return financeService.zoneEntry(zone.zone_id, {
        entry_kind: kind,
        ...(kind === "credit_limit"
          ? { credit_limit_paise: paise }
          : { amount_paise: paise, mode }),
        reference: reference || undefined,
      });
    },
    onSuccess: () => {
      setAmount("");
      setReference("");
      setError(null);
      refresh();
    },
    onError: (e) =>
      setError(e instanceof Error && !("response" in e) ? e.message : ispErrorMessage(e)),
  });
  const saveProfile = useMutation({
    mutationFn: () => {
      const { revenue_share_pct, tds_rate_pct, ...rest } = profile;
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) body[k] = v.trim() || null;
      body.revenue_share_bp = Math.round(Number(revenue_share_pct || 0) * 100);
      body.tds_rate_bp = Math.round(Number(tds_rate_pct || 0) * 100);
      return financeService.saveZoneProfile(zone.zone_id, body as Partial<ZoneLedger>);
    },
    onSuccess: () => {
      toast.success("Zone saved.");
      setError(null);
      refresh();
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  const z = q.data?.zone ?? zone;
  const editable = can("isp_zones.manage");
  return (
    <MDialog open onClose={onClose} title={`Zone: ${z.name}`} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={z.balance_paise < 0 ? "font-semibold text-destructive" : "font-semibold"}>
              {formatRupees(z.balance_paise)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Credit limit</p>
            <p className="font-semibold">{formatRupees(z.credit_limit_paise)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Can still use</p>
            <p className="font-semibold">{formatRupees(z.available_paise)}</p>
          </div>
        </div>
        {editable && (
          <Card title="New entry">
            <MSeg
              value={kind}
              onChange={setKind}
              options={[
                { value: "add", label: "Money received" },
                { value: "reduce", label: "Debit" },
                { value: "credit_limit", label: "Set credit limit" },
              ]}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <TextField
                label={kind === "credit_limit" ? "New credit limit (₹)" : "Amount (₹)"}
                value={amount}
                onChange={setAmount}
              />
              {kind !== "credit_limit" && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Mode</span>
                  <select
                    className={M_INPUT}
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                </label>
              )}
              <TextField label="Reference" value={reference} onChange={setReference} />
            </div>
            <div className="mt-3 flex justify-end">
              <MButton onClick={() => entry.mutate()} disabled={entry.isPending || !amount}>
                {entry.isPending && <Spinner />} Record
              </MButton>
            </div>
          </Card>
        )}
        <ZoneBrandingCard zoneId={zone.zone_id} editable={editable} />
        <Card title="Ledger (newest first)">
          {q.isLoading ? (
            <Spinner />
          ) : (
            <MTable
              head={
                <>
                  <MTh>When</MTh>
                  <MTh>Entry</MTh>
                  <MTh>Amount</MTh>
                  <MTh>Balance after</MTh>
                  <MTh>By</MTh>
                </>
              }
            >
              {(q.data?.entries ?? []).map((e) => (
                <MTr key={e.id}>
                  <MTd>{new Date(e.occurred_at).toLocaleString("en-IN")}</MTd>
                  <MTd>
                    {e.entry_kind === "credit_limit"
                      ? `Credit limit ${formatRupees(e.detail.old_credit_limit_paise)} → ${formatRupees(e.detail.new_credit_limit_paise)}`
                      : e.entry_kind === "add"
                        ? `Received${e.mode ? ` (${e.mode})` : ""}`
                        : "Debit"}
                    {e.reference && <span className="text-muted-foreground"> · {e.reference}</span>}
                  </MTd>
                  <MTd>{e.entry_kind === "credit_limit" ? "–" : formatRupees(e.amount_paise)}</MTd>
                  <MTd>{formatRupees(e.balance_after_paise)}</MTd>
                  <MTd>{e.recorded_by ?? "–"}</MTd>
                </MTr>
              ))}
            </MTable>
          )}
        </Card>
        <Card title="Zone details">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["contact_name", "Contact person"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["address", "Address"],
                ["pincode", "Pincode"],
                ["gstin", "GSTIN"],
                ["pan", "PAN"],
                ["operator_name", "Operator name (on invoices)"],
                ["operator_phone", "Operator phone (on invoices)"],
                ["revenue_share_pct", "Zone's share of collections (%)"],
                ["tds_rate_pct", "TDS u/s 194H (%)"],
              ] as const
            ).map(([k, label]) => (
              <TextField
                key={k}
                label={label}
                value={profile[k] ?? ""}
                disabled={!editable}
                onChange={(v) => setProfile((p) => ({ ...p, [k]: v }))}
              />
            ))}
          </div>
          {editable && (
            <div className="mt-3 flex justify-end">
              <MButton
                variant="outline"
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending}
              >
                {saveProfile.isPending && <Spinner />} Save details
              </MButton>
            </div>
          )}
        </Card>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function ZonesTab() {
  const q = useQuery({ queryKey: fk("zones"), queryFn: financeService.zones, retry: false });
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const revenue = useQuery({
    queryKey: fk("zones", "revenue", from, to),
    queryFn: () => financeService.zoneRevenue(from, to),
    enabled: q.isSuccess,
    retry: false,
  });
  const tds = useQuery({
    queryKey: fk("zones", "tds"),
    queryFn: () => financeService.tds(),
    enabled: q.isSuccess,
    retry: false,
  });
  const [open, setOpen] = useState<ZoneLedger | null>(null);
  const rev = useMemo(
    () => new Map((revenue.data ?? []).map((r) => [r.zone_id, r])),
    [revenue.data],
  );
  const blocked = QueryState({ q, what: "The zone ledger" });
  if (blocked) return blocked;
  if ((q.data ?? []).length === 0)
    return (
      <MEmptyState
        icon={Landmark}
        title="No zones yet"
        description="Create zones under Invoices → Settings, then come back to keep their ledger."
      />
    );
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Zones are labels for your areas or local partners. A zone has no login and no dashboard of
        its own: you keep its money ledger here.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Revenue from" type="date" value={from} onChange={setFrom} />
        <TextField label="to" type="date" value={to} onChange={setTo} />
      </div>
      <MTable
        head={
          <>
            <MTh>Zone</MTh>
            <MTh>Share</MTh>
            <MTh>Collected</MTh>
            <MTh>Zone share</MTh>
            <MTh>Balance</MTh>
            <MTh>Credit limit</MTh>
            <MTh>Status</MTh>
          </>
        }
      >
        {(q.data ?? []).map((z) => {
          const r = rev.get(z.zone_id);
          return (
            <MTr key={z.zone_id} onClick={() => setOpen(z)}>
              <MTd>{z.name}</MTd>
              <MTd>
                {z.revenue_share_bp / 100}% / {100 - z.revenue_share_bp / 100}%
              </MTd>
              <MTd>{r ? formatRupees(r.collected_paise) : "–"}</MTd>
              <MTd>{r ? formatRupees(r.zone_share_paise) : "–"}</MTd>
              <MTd className={z.balance_paise < 0 ? "text-destructive" : ""}>
                {formatRupees(z.balance_paise)}
              </MTd>
              <MTd>{formatRupees(z.credit_limit_paise)}</MTd>
              <MTd>
                <MTag
                  label={z.standing === "paid" ? "Paid" : "Unpaid"}
                  tone={z.standing === "paid" ? "success" : "danger"}
                />
              </MTd>
            </MTr>
          );
        })}
      </MTable>
      {tds.data && (
        <Card title={`TDS u/s 194H, FY ${tds.data.fy} (statement data)`}>
          <MTable
            head={
              <>
                <MTh>Zone</MTh>
                <MTh>PAN</MTh>
                <MTh>Commission</MTh>
                <MTh>TDS</MTh>
              </>
            }
          >
            {tds.data.zones.map((t) => (
              <MTr key={t.zone_id}>
                <MTd>{t.name}</MTd>
                <MTd>{t.pan ?? <span className="text-destructive">missing</span>}</MTd>
                <MTd>{formatRupees(t.commission_paise)}</MTd>
                <MTd>
                  {t.threshold_crossed
                    ? formatRupees(t.tds_paise)
                    : `below ${formatRupees(tds.data.threshold_paise)}`}
                </MTd>
              </MTr>
            ))}
          </MTable>
          <p className="mt-2 text-[11px] text-muted-foreground">{tds.data.note}</p>
        </Card>
      )}
      {open && <ZoneDialog zone={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// automation
// ---------------------------------------------------------------------------

const TRIGGER_LABEL: Record<Trigger, { title: string; params: string }> = {
  pre_expiry: {
    title: "Before validity ends",
    params: "{{1}} name · {{2}} expiry date · {{3}} plan",
  },
  unpaid: {
    title: "Unpaid invoice (with pay link)",
    params: "{{1}} name · {{2}} invoice no. · {{3}} balance · {{4}} pay link",
  },
  receipt: {
    title: "Payment received",
    params: "{{1}} name · {{2}} receipt no. · {{3}} amount · {{4}} date",
  },
  renewal: { title: "Renewed", params: "{{1}} name · {{2}} invoice no. · {{3}} valid until" },
};

function AutomationTab() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: fk("automation"),
    queryFn: financeService.automation,
    retry: false,
  });
  const [form, setForm] = useState<Partial<AutomationSettings> & { token?: string }>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setForm({ ...q.data, token: "" });
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        whatsapp_enabled: form.whatsapp_enabled,
        whatsapp_templates: form.whatsapp_templates,
        pre_expiry_days: Number(form.pre_expiry_days),
        unpaid_reminder_after_days: Number(form.unpaid_reminder_after_days),
        telegram_enabled: form.telegram_enabled,
        telegram_chat_id: form.telegram_chat_id || undefined,
        telegram_debounce_minutes: Number(form.telegram_debounce_minutes),
        telegram_include_aps: form.telegram_include_aps,
      };
      if (form.token) body.telegram_bot_token = form.token.trim();
      return financeService.saveAutomation(body);
    },
    onSuccess: (d) => {
      qc.setQueryData(fk("automation"), d);
      toast.success("Saved.");
      setError(null);
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  const test = useMutation({
    mutationFn: financeService.telegramTest,
    onSuccess: (r) =>
      r.ok
        ? toast.success("Test message sent to Telegram.")
        : toast.error(r.error ?? "Telegram refused the message."),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const blocked = QueryState({ q, what: "Automation" });
  if (blocked) return blocked;
  const d = q.data!;
  const editable = can("isp_billing.manage");
  const tpl = form.whatsapp_templates ?? {};
  return (
    <div className="space-y-4">
      <Card title="WhatsApp (your own WhatsApp Business sender)">
        {!d.flags.whatsapp ? (
          <p className="text-sm text-muted-foreground">Not switched on for your account yet.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Messages go out from the WhatsApp sender you set under Messaging, using your own
              Meta-approved templates. Only subscribers and customers who agreed to WhatsApp are
              messaged; each message is sent once.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.whatsapp_enabled)}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_enabled: e.target.checked }))}
              />
              Send automatic WhatsApp messages
            </label>
            {(Object.keys(TRIGGER_LABEL) as Trigger[]).map((t) => (
              <div key={t} className="grid gap-2 sm:grid-cols-3 sm:items-end">
                <div className="sm:col-span-1">
                  <p className="text-sm font-medium">{TRIGGER_LABEL[t].title}</p>
                  <p className="text-[11px] text-muted-foreground">{TRIGGER_LABEL[t].params}</p>
                </div>
                <TextField
                  label="Template name"
                  value={tpl[t]?.template_name ?? ""}
                  disabled={!editable}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      whatsapp_templates: {
                        ...(f.whatsapp_templates ?? {}),
                        [t]: { template_name: v, language: tpl[t]?.language ?? "en" },
                      },
                    }))
                  }
                />
                <TextField
                  label="Language"
                  value={tpl[t]?.language ?? "en"}
                  disabled={!editable}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      whatsapp_templates: {
                        ...(f.whatsapp_templates ?? {}),
                        [t]: { template_name: tpl[t]?.template_name ?? "", language: v },
                      },
                    }))
                  }
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Remind this many days before validity ends"
                value={String(form.pre_expiry_days ?? 2)}
                disabled={!editable}
                onChange={(v) =>
                  setForm((f) => ({ ...f, pre_expiry_days: Number(v.replace(/\D/g, "")) }))
                }
              />
              <TextField
                label="Unpaid reminder after due date (days)"
                value={String(form.unpaid_reminder_after_days ?? 1)}
                disabled={!editable}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    unpaid_reminder_after_days: Number(v.replace(/\D/g, "")),
                  }))
                }
              />
            </div>
          </div>
        )}
      </Card>
      <Card
        title="Telegram alerts (router / access point down and up)"
        actions={
          d.flags.telegram && d.telegram_bot_token.set && can("isp_monitor.update") ? (
            <MButton variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? <Spinner /> : <Send />} Send a test
            </MButton>
          ) : null
        }
      >
        {!d.flags.telegram ? (
          <p className="text-sm text-muted-foreground">Not switched on for your account yet.</p>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.telegram_enabled)}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, telegram_enabled: e.target.checked }))}
              />
              Send alerts to Telegram
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Bot token"
                type="password"
                placeholder={
                  d.telegram_bot_token.set ? `saved (${d.telegram_bot_token.hint})` : "123456:ABC…"
                }
                value={form.token ?? ""}
                disabled={!editable}
                onChange={(v) => setForm((f) => ({ ...f, token: v }))}
                hint="From @BotFather. Stored encrypted; never shown again."
              />
              <TextField
                label="Chat id"
                value={form.telegram_chat_id ?? ""}
                disabled={!editable}
                onChange={(v) => setForm((f) => ({ ...f, telegram_chat_id: v }))}
                hint="Your group or channel id, e.g. -1001234567890"
              />
              <TextField
                label="Wait before alerting (minutes)"
                value={String(form.telegram_debounce_minutes ?? 3)}
                disabled={!editable}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    telegram_debounce_minutes: Number(v.replace(/\D/g, "")),
                  }))
                }
                hint="A device must stay down (or up) this long before we message, so a blip is not an alert."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.telegram_include_aps)}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, telegram_include_aps: e.target.checked }))}
              />
              Include access points
            </label>
          </div>
        )}
      </Card>
      <FormError message={error} />
      {editable && (d.flags.whatsapp || d.flags.telegram) && (
        <div className="flex justify-end">
          <MButton onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Spinner />} Save
          </MButton>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// message log
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, string> = {
  sent: "success",
  failed: "danger",
  queued: "warning",
  skipped: "",
};

function MessagesTab() {
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: fk("messages", channel, status, page),
    queryFn: () =>
      financeService.messages({ channel: channel || undefined, status: status || undefined, page }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const blocked = QueryState({ q, what: "The message log" });
  if (blocked) return blocked;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          className={M_INPUT}
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setPage(1);
          }}
          aria-label="Channel"
        >
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
        </select>
        <select
          className={M_INPUT}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Status"
        >
          <option value="">Any status</option>
          <option value="sent">Sent</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>
      <MTable
        head={
          <>
            <MTh>When</MTh>
            <MTh>Channel</MTh>
            <MTh>To</MTh>
            <MTh>Message</MTh>
            <MTh>Status</MTh>
          </>
        }
      >
        {(q.data?.items ?? []).map((m) => (
          <MTr key={m.id}>
            <MTd>{new Date(m.created_at).toLocaleString("en-IN")}</MTd>
            <MTd>{m.channel}</MTd>
            <MTd className="font-mono">{m.recipient}</MTd>
            <MTd>
              {m.summary}
              {m.error && <span className="block text-[11px] text-destructive">{m.error}</span>}
            </MTd>
            <MTd>
              <MTag label={m.status} tone={STATUS_TONE[m.status]} />
            </MTd>
          </MTr>
        ))}
      </MTable>
      {q.data && q.data.pages > 1 && (
        <Pager page={page} pages={q.data.pages} total={q.data.total} onPage={setPage} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function FinancePage({ tab, onTab }: { tab: FinanceTab; onTab: (t: FinanceTab) => void }) {
  const { can } = usePartner();
  const tabs: { value: FinanceTab; label: string; anyOf: string[] }[] = [
    { value: "template", label: "Invoice details", anyOf: ["isp_billing.read"] },
    { value: "products", label: "Products", anyOf: ["isp_billing.read"] },
    { value: "packages", label: "Package billing", anyOf: ["isp_plans.read"] },
    { value: "leases", label: "Static IPs", anyOf: ["isp_billing.read"] },
    { value: "deposits", label: "Deposits", anyOf: ["isp_billing.read"] },
    { value: "zones", label: "Zones", anyOf: ["isp_zones.read"] },
    { value: "automation", label: "Automation", anyOf: ["isp_billing.read"] },
    // RBAC-FIX: message logs carry recipient phone/email + content (no viewer).
    { value: "messages", label: "Message log", anyOf: ["isp_billing.export"] },
  ];
  const visible = tabs.filter((t) => t.anyOf.some((k) => can(k)));
  if (visible.length === 0)
    return <MEmptyState icon={Landmark} title="Your role does not include finance" />;
  const active = visible.some((t) => t.value === tab) ? tab : visible[0].value;
  return (
    <>
      <MSectionHeader
        eyebrow="Finance"
        title="Finance tools"
        description="Bank details on invoices, products, static IP rent, deposits, zone ledgers and automatic messages."
      />
      <MSeg<FinanceTab>
        value={active}
        onChange={onTab}
        options={visible.map(({ value, label }) => ({ value, label }))}
      />
      <div className="mt-4">
        {active === "template" && <TemplateTab />}
        {active === "products" && <ProductsTab />}
        {active === "packages" && <PackagesTab />}
        {active === "leases" && <LeasesTab />}
        {active === "deposits" && <DepositsTab />}
        {/* FRANCHISE-2: revenue share + wallets under the JAZE-4 ledger (flag-gated). */}
        {active === "zones" && (
          <div className="space-y-4">
            <ZonesTab />
            <FranchisePanel />
          </div>
        )}
        {active === "automation" && <AutomationTab />}
        {/* COMMS-2: unified log + templates + receipts; the JAZE-4 log while off. */}
        {active === "messages" && <CommsHub fallback={<MessagesTab />} />}
      </div>
    </>
  );
}
