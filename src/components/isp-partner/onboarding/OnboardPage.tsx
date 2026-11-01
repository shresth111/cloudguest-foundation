/**
 * `/partner/subscribers/new` (ONBOARD-1): add a subscriber on one page.
 *
 * Sections, top to bottom: plan, contact, installation, billing rules,
 * PPPoE, static IP / MAC, KYC & CAF, first invoice, welcome. A section
 * whose feature is switched off, or that the signed-in role cannot use, is
 * not shown. Everything except files is saved by ONE call
 * (`POST /isp/onboarding`) in one transaction: if any part fails nothing
 * is created, and the form points at the section to fix. Files go up in
 * step 2, after the subscriber exists (see OnboardResult).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, Trash2, UserPlus } from "lucide-react";
import { MButton, MEmptyState, MSectionHeader, MSeg, M_INPUT } from "@/components/master/MasterKit";
import {
  CustomerSelect,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { OnboardResult } from "@/components/isp-partner/onboarding/OnboardResult";
import { OnboardStaticIps } from "@/components/isp-partner/onboarding/OnboardStaticIps";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { rupeesToPaise } from "@/lib/isp-partner/subscribers360";
import { requestErrorOf } from "@/services/api";
import { formatDateTime } from "@/lib/isp-partner/format";
import { formatRupees, PAYMENT_MODE_LABEL } from "@/lib/isp-partner/money";
import {
  buildOnboarding,
  documentProblem,
  emptyOnboardForm,
  expiryPreview,
  formFromLead,
  gstinValid,
  stepLabel,
  type FormSection,
  type OnboardForm,
} from "@/lib/isp-partner/onboarding";
import { onboardingService } from "@/services/isp-partner/onboarding";
import { appsService } from "@/services/isp-partner/apps";
import type { OnboardingResult, PendingDocument } from "@/services/isp-partner/onboarding-types";

const ID_LABEL: Record<string, string> = {
  aadhaar: "Aadhaar",
  voter_id: "Voter ID",
  passport: "Passport",
  pan: "PAN card",
  driving_licence: "Driving licence",
  ration_card: "Ration card",
  other: "Other",
};
const DOC_LABEL: Record<string, string> = {
  id_proof: "ID proof",
  address_proof: "Address proof",
  photo: "Photo",
  signature: "Signature",
  caf_signed: "Signed CAF",
  install_report: "Installation report",
};
/** The backend step that failed -> the form section that holds it. */
const STEP_SECTION: Record<string, FormSection> = {
  subscriber: "plan",
  pppoe: "pppoe",
  static_ip: "network",
  mac: "network",
  kyc: "kyc",
  caf: "kyc",
  invoice: "invoice",
  payment: "invoice",
  lead: "plan",
};

function Section({
  id,
  title,
  hint,
  error,
  children,
}: {
  id: FormSection | "welcome";
  title: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <section
      id={`onboard-${id}`}
      className={`rounded-xl premium-card scroll-mt-20 p-4 sm:p-5 ${error ? "ring-2 ring-destructive/40" : ""}`}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select className={M_INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function OnboardPage({ leadId }: { leadId?: string } = {}) {
  const { can } = usePartner();
  const options = useQuery({
    queryKey: ["isp", "onboarding", "options"],
    queryFn: () => onboardingService.options(),
    retry: false,
    staleTime: 0,
  });
  const [result, setResult] = useState<{
    result: OnboardingResult;
    documents: PendingDocument[];
  } | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (!can("isp_subscribers.update"))
    return (
      <MEmptyState
        icon={UserPlus}
        title="You cannot add subscribers"
        description="Your role can view subscribers but not add them."
      />
    );
  if (options.isLoading) return <LoadingBlock />;
  if (options.error || !options.data)
    return <ErrorBlock error={options.error} onRetry={() => options.refetch()} what="the form" />;
  if (result)
    return (
      <OnboardResult
        result={result.result}
        documents={result.documents}
        canEmailInvoice={options.data.features.invoice_email && can("isp_invoices.execute")}
        onAnother={() => {
          setResult(null);
          setFormKey((k) => k + 1);
          options.refetch();
        }}
      />
    );
  return (
    <OnboardFormView
      key={formKey}
      leadId={formKey === 0 ? leadId : undefined}
      options={options.data}
      onDone={(r, docs) => setResult({ result: r, documents: docs })}
    />
  );
}

function OnboardFormView({
  options,
  onDone,
  leadId,
}: {
  leadId?: string;
  options: NonNullable<Awaited<ReturnType<typeof onboardingService.options>>>;
  onDone: (r: OnboardingResult, docs: PendingDocument[]) => void;
}) {
  const { can } = usePartner();
  const customers = useIspCustomerOptions();
  const packages = usePackages({ status: "active", page_size: 100 });
  const zones = useZones(can("isp_zones.read"));
  const [f, setF] = useState<OnboardForm>(emptyOnboardForm);
  const [docs, setDocs] = useState<PendingDocument[]>([]);
  const [docKind, setDocKind] = useState("id_proof");
  const [errors, setErrors] = useState<Partial<Record<FormSection, string>>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // LEFTOVERS (APPS-2 #4): prefill from the Apps lead, once.
  const lead = useQuery({
    queryKey: ["isp", "apps", "lead", leadId],
    queryFn: () => appsService.lead(leadId as string),
    enabled: !!leadId && !!options.features.install_task,
    retry: false,
  });
  const leadUsable =
    lead.data && lead.data.status !== "converted" && lead.data.status !== "dropped";
  useEffect(() => {
    if (lead.data && leadUsable) setF((x) => ({ ...x, ...formFromLead(lead.data) }));
  }, [lead.data, leadUsable]);

  const feat = options.features;
  const canKyc = feat.kyc && can("isp_partner.update");
  const canInvoice = can("isp_invoices.create");
  const canPay = can("isp_billing.execute");
  const set =
    <K extends keyof OnboardForm>(k: K) =>
    (v: OnboardForm[K]) =>
      setF((x) => ({ ...x, [k]: v }));
  const pkg = packages.data?.items.find((p) => p.id === f.package_id);
  const expiry = useMemo(
    () => expiryPreview(f.activation_at, pkg?.validity_days),
    [f.activation_at, pkg?.validity_days],
  );
  const gstinState = f.gstin.trim().length === 15 ? gstinValid(f.gstin) : null;

  const jump = (section: FormSection) =>
    document.getElementById(`onboard-${section}`)?.scrollIntoView({ behavior: "smooth" });

  const submit = async () => {
    setErrors({});
    setTopError(null);
    const built = buildOnboarding(f, {
      features: {
        pppoe: feat.pppoe,
        static_ip: feat.static_ip,
        kyc: canKyc,
        install_task: !!feat.install_task,
      },
      can: { kyc: canKyc, invoice: canInvoice, pay: canPay },
    });
    if ("error" in built) {
      setErrors({ [built.section]: built.error });
      setTopError(`Fix this first: ${built.error}`);
      jump(built.section);
      return;
    }
    setBusy(true);
    try {
      const r = await onboardingService.create(built.body);
      onDone(r, canKyc && f.kyc_on ? docs : []);
    } catch (e) {
      // One transaction: nothing was created. The backend names the step.
      const step = requestErrorOf(e)?.data?.step;
      const section = typeof step === "string" ? STEP_SECTION[step] : undefined;
      const msg = ispErrorMessage(e);
      setTopError(`Nothing was saved. ${stepLabel(step)} failed: ${msg}`);
      if (section) {
        setErrors({ [section]: msg });
        jump(section);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        to="/partner/subscribers"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3" /> Subscribers
      </Link>
      <MSectionHeader
        title="Add subscriber"
        description={`Circuit ID ${options.next_circuit_id} is the next free one (given out when you save). Everything below is saved together; files upload right after.`}
      />
      {lead.data && (
        <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          {leadUsable
            ? `Filled in from lead #${lead.data.number} (${lead.data.name}). Saving marks the lead converted.`
            : `Lead #${lead.data.number} is already ${lead.data.status}; nothing was filled in.`}
        </p>
      )}

      <Section id="plan" title="Plan" error={errors.plan}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Customer (venue)</span>
            <CustomerSelect
              value={f.isp_customer_id}
              onChange={(v) => setF((x) => ({ ...x, isp_customer_id: v, static_ips: [] }))}
              customers={customers.data}
              allLabel={null}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Package</span>
            <select
              className={M_INPUT}
              value={f.package_id}
              onChange={(e) => set("package_id")(e.target.value)}
            >
              <option value="">Pick…</option>
              {(packages.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatRupees(p.price_paise)} / {p.validity_days} days
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Login id"
            required
            value={f.identifier}
            onChange={set("identifier")}
            hint="Mobile, email or username they sign in with."
          />
          {can("isp_zones.read") && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Zone</span>
              <select
                className={M_INPUT}
                value={f.zone_id}
                onChange={(e) => set("zone_id")(e.target.value)}
              >
                <option value="">No zone</option>
                {(zones.data ?? []).map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Select
            label="Subscriber type"
            value={f.user_type}
            onChange={set("user_type")}
            options={[
              ["home", "Home"],
              ["commercial", "Commercial"],
              ["sme", "Small business"],
            ]}
          />
          <Select
            label="Connection"
            value={f.connection_type}
            onChange={set("connection_type")}
            options={[
              ["", "Not set"],
              ["fiber", "Fiber"],
              ["wireless", "Wireless"],
              ["ethernet", "Ethernet"],
              ["other", "Other"],
            ]}
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Start service (blank = now)
            </span>
            <input
              type="datetime-local"
              className={M_INPUT}
              value={f.activation_at}
              onChange={(e) => set("activation_at")(e.target.value)}
            />
          </label>
          <div className="space-y-1.5 text-xs">
            <span className="font-medium text-muted-foreground">Expires</span>
            <p className="pt-2">
              {expiry
                ? `Around ${formatDateTime(expiry.toISOString())} (${pkg?.validity_days} days)`
                : "Pick a package"}
            </p>
          </div>
        </div>
      </Section>

      <Section id="contact" title="Contact and billing address" error={errors.contact}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="First name" value={f.first_name} onChange={set("first_name")} />
          <TextField label="Last name" value={f.last_name} onChange={set("last_name")} />
          <TextField label="Mobile" value={f.phone} onChange={set("phone")} />
          <TextField label="Email" value={f.email} onChange={set("email")} />
          <TextField
            label="Alternate email"
            value={f.alt_email}
            onChange={set("alt_email")}
            hint="e.g. their accounts team"
          />
          <TextField
            label="GSTIN (business)"
            value={f.gstin}
            onChange={(v) => set("gstin")(v.toUpperCase())}
            error={
              gstinState === false ? "Checksum does not match; check each character." : undefined
            }
            hint={gstinState ? "Format and checksum OK." : "Optional. Checked offline only."}
          />
          <TextField
            label="GST state code"
            value={f.state_code}
            onChange={set("state_code")}
            placeholder={f.gstin.length >= 2 ? f.gstin.slice(0, 2) : "e.g. 07"}
            hint="Decides CGST + SGST or IGST. Taken from the GSTIN when blank."
          />
          <div className="sm:col-span-2">
            <TextField label="Billing address" value={f.address} onChange={set("address")} />
          </div>
          <TextField label="City" value={f.billing_city} onChange={set("billing_city")} />
          <TextField label="PIN code" value={f.billing_pincode} onChange={set("billing_pincode")} />
        </div>
      </Section>

      <Section id="installation" title="Installation" error={errors.installation}>
        <Check
          label="Installed at the billing address"
          checked={f.install_same_as_billing}
          onChange={set("install_same_as_billing")}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {!f.install_same_as_billing && (
            <>
              <TextField
                label="Building / flat"
                value={f.install_building}
                onChange={set("install_building")}
              />
              <TextField
                label="Street"
                value={f.install_address}
                onChange={set("install_address")}
              />
              <TextField label="Area" value={f.install_area} onChange={set("install_area")} />
              <TextField label="City" value={f.install_city} onChange={set("install_city")} />
              <TextField
                label="PIN code"
                value={f.install_pincode}
                onChange={set("install_pincode")}
              />
            </>
          )}
          <TextField label="Latitude" value={f.latitude} onChange={set("latitude")} />
          <TextField label="Longitude" value={f.longitude} onChange={set("longitude")} />
          <TextField
            label="Installed on"
            type="date"
            value={f.installed_at}
            onChange={set("installed_at")}
          />
          <TextField label="ONT / CPE serial" value={f.ont_serial} onChange={set("ont_serial")} />
        </div>
      </Section>

      <Section id="billing_rules" title="Billing rules" error={errors.billing_rules}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Price for this subscriber (₹, optional)"
            value={f.override_price}
            onChange={set("override_price")}
            placeholder={pkg ? String(pkg.price_paise / 100) : undefined}
            hint="Blank = the package price. Used for the first invoice and renewals."
          />
          <TextField
            label="Bill on day of month (1-28, optional)"
            value={f.billing_anchor_day}
            onChange={set("billing_anchor_day")}
          />
          <Select
            label="When an invoice is overdue"
            value={f.after_due_action}
            onChange={set("after_due_action")}
            options={[
              ["suspend", "Suspend service"],
              ["keep_active", "Keep service on"],
              ["disconnect_once", "Disconnect once"],
            ]}
          />
          <div className="pt-6">
            <Check
              label="Never send payment reminders"
              checked={f.exclude_reminders}
              onChange={set("exclude_reminders")}
            />
          </div>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Comments</span>
            <textarea
              className={`${M_INPUT} min-h-[64px]`}
              value={f.comments}
              onChange={(e) => set("comments")(e.target.value)}
            />
          </label>
        </div>
      </Section>

      {feat.pppoe && (
        <Section
          id="pppoe"
          title="PPPoE login"
          hint="For a router that dials PPPoE. Speed and validity follow the package."
          error={errors.pppoe}
        >
          <Check
            label="Give this subscriber a PPPoE login"
            checked={f.pppoe_on}
            onChange={set("pppoe_on")}
          />
          {f.pppoe_on && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="PPPoE username"
                value={f.pppoe_username}
                onChange={set("pppoe_username")}
                placeholder={f.identifier || "Their login id"}
              />
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <MSeg<"generate" | "set">
                  value={f.pppoe_password_mode}
                  onChange={set("pppoe_password_mode")}
                  options={[
                    { value: "generate", label: "Generate" },
                    { value: "set", label: "Type one" },
                  ]}
                />
              </label>
              {f.pppoe_password_mode === "set" && (
                <TextField
                  label="Password"
                  type="password"
                  value={f.pppoe_password}
                  onChange={set("pppoe_password")}
                  hint="8-64 characters, no spaces, quotes, \ $ or `."
                />
              )}
            </div>
          )}
        </Section>
      )}

      {feat.static_ip && (
        <Section
          id="network"
          title="Static IP and devices"
          hint="Optional. Leave the address blank to take the next free one in the pool."
          error={errors.network}
        >
          <OnboardStaticIps
            customerId={f.isp_customer_id}
            rows={f.static_ips}
            onChange={set("static_ips")}
            queuePush={feat.static_queue_push}
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Bind these devices (MAC addresses, comma or one per line)
            </span>
            <textarea
              className={`${M_INPUT} min-h-[48px] font-mono`}
              value={f.macs}
              onChange={(e) => set("macs")(e.target.value)}
            />
          </label>
        </Section>
      )}

      {canKyc && (
        <Section
          id="kyc"
          title="KYC and CAF"
          hint="Only the last 4 digits of an Aadhaar number leave this page; the full number is checked here and never stored."
          error={errors.kyc}
        >
          <Check label="Record KYC now" checked={f.kyc_on} onChange={set("kyc_on")} />
          {f.kyc_on && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Applicant"
                  value={f.applicant_type}
                  onChange={set("applicant_type")}
                  options={[
                    ["individual", "Individual"],
                    ["organization", "Organisation"],
                  ]}
                />
                <TextField
                  label="Name as on the ID"
                  value={f.kyc_full_name}
                  onChange={set("kyc_full_name")}
                />
                <TextField
                  label="Father's / spouse's name"
                  value={f.father_or_spouse_name}
                  onChange={set("father_or_spouse_name")}
                />
                <TextField
                  label="Date of birth"
                  type="date"
                  value={f.date_of_birth}
                  onChange={set("date_of_birth")}
                />
                <Select
                  label="ID proof"
                  value={f.id_proof_type}
                  onChange={set("id_proof_type")}
                  options={[
                    ["", "Pick…"],
                    ...options.kyc.id_types.map((t) => [t, ID_LABEL[t] ?? t] as [string, string]),
                  ]}
                />
                <TextField
                  label="ID number"
                  value={f.id_number}
                  onChange={set("id_number")}
                  hint={
                    f.id_proof_type === "aadhaar"
                      ? "Full 12 digits or just the last 4; only the last 4 are sent."
                      : undefined
                  }
                />
              </div>
              <Check
                label="The ID proof is also the address proof"
                checked={f.address_proof_same_as_id}
                onChange={set("address_proof_same_as_id")}
              />
              {!f.address_proof_same_as_id && (
                <Select
                  label="Address proof"
                  value={f.address_proof_type}
                  onChange={set("address_proof_type")}
                  options={[
                    ["", "Pick…"],
                    ...options.kyc.id_types.map((t) => [t, ID_LABEL[t] ?? t] as [string, string]),
                  ]}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">CAF number</span>
                  <MSeg<"auto" | "number" | "none">
                    value={f.caf_mode}
                    onChange={set("caf_mode")}
                    options={[
                      { value: "auto", label: "Next number" },
                      { value: "number", label: "Paper CAF no." },
                      { value: "none", label: "Later" },
                    ]}
                  />
                </label>
                {f.caf_mode === "number" && (
                  <TextField
                    label="Number on the paper CAF"
                    value={f.caf_number}
                    onChange={set("caf_number")}
                  />
                )}
              </div>
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <p className="text-xs font-medium">Files (uploaded after saving)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={`${M_INPUT} w-auto`}
                    value={docKind}
                    onChange={(e) => setDocKind(e.target.value)}
                    aria-label="Document type"
                  >
                    {options.kyc.document_kinds.map((k) => (
                      <option key={k} value={k}>
                        {DOC_LABEL[k] ?? k}
                      </option>
                    ))}
                  </select>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      const bad = files.map((x) => documentProblem(x)).find(Boolean);
                      if (bad) setErrors((er) => ({ ...er, kyc: bad }));
                      const ok = files.filter((x) => !documentProblem(x));
                      setDocs((d) => [
                        ...d,
                        ...ok.map((file, i) => ({
                          key: `${Date.now()}-${i}-${file.name}`,
                          kind: docKind,
                          file,
                        })),
                      ]);
                    }}
                  />
                  <MButton variant="outline" onClick={() => fileInput.current?.click()}>
                    <Paperclip /> Add files
                  </MButton>
                  <span className="text-[11px] text-muted-foreground">
                    JPEG, PNG, WebP or PDF, up to 5 MB each.
                  </span>
                </div>
                {docs.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {docs.map((d) => (
                      <li key={d.key} className="flex items-center gap-2">
                        <span className="w-32 text-muted-foreground">
                          {DOC_LABEL[d.kind] ?? d.kind}
                        </span>
                        <span className="min-w-0 truncate">{d.file.name}</span>
                        <MButton
                          variant="ghost"
                          className="ml-auto"
                          aria-label={`Remove ${d.file.name}`}
                          onClick={() => setDocs((x) => x.filter((y) => y.key !== d.key))}
                        >
                          <Trash2 />
                        </MButton>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </Section>
      )}

      {canInvoice && (
        <Section id="invoice" title="First invoice" error={errors.invoice}>
          <Check
            label={`Issue the first invoice now${
              pkg
                ? ` (${formatRupees(rupeesToPaise(f.override_price) ?? pkg.price_paise)} for this period)`
                : ""
            }`}
            checked={f.issue_invoice}
            onChange={set("issue_invoice")}
          />
          {f.issue_invoice && canPay && (
            <>
              <Check label="Payment received now" checked={f.paid_now} onChange={set("paid_now")} />
              {f.paid_now && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Mode"
                    value={f.payment_mode}
                    onChange={set("payment_mode")}
                    options={options.payment_modes.map(
                      (k) => [k, PAYMENT_MODE_LABEL[k] ?? k] as [string, string],
                    )}
                  />
                  <TextField
                    label="Reference"
                    value={f.payment_reference}
                    onChange={set("payment_reference")}
                    hint={f.payment_mode === "cash" ? "Optional for cash" : "UTR / transaction id"}
                  />
                </div>
              )}
            </>
          )}
        </Section>
      )}

      <Section id="welcome" title="Welcome">
        <Check
          label="Prepare a WhatsApp welcome message (you send it from your phone)"
          checked={f.welcome_whatsapp}
          onChange={set("welcome_whatsapp")}
        />
        {feat.install_task && (
          <Check
            label="Create installation task (unclaimed, for a field technician)"
            checked={f.create_install_task}
            onChange={set("create_install_task")}
          />
        )}
      </Section>

      <FormError message={topError} />
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        <Link to="/partner/subscribers">
          <MButton variant="outline">Cancel</MButton>
        </Link>
        <MButton onClick={submit} disabled={busy}>
          {busy && <Spinner />} Add subscriber
        </MButton>
      </div>
    </div>
  );
}
