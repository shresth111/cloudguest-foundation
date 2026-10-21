import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { MButton, MDrawer, MField, M_INPUT } from "@/components/master/MasterKit";
import { TemporaryPasswordPanel } from "@/components/master/isp-partners/TemporaryPasswordPanel";
import { requestErrorOf } from "@/services/api";
import {
  ispPartnerPlatformService,
  type CreateIspPartnerResult,
  type IspPartner,
  type PlanOption,
} from "@/services/isp-partner/platform";
import { TIMEZONE_OPTIONS } from "@/lib/countries";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function emptyForm() {
  return {
    name: "",
    slug: "",
    legalName: "",
    gstin: "",
    contactEmail: "",
    contactPhone: "",
    supportPhone: "",
    supportEmail: "",
    timezone: "Asia/Kolkata",
    defaultCustomerPlanId: "",
    maxCustomers: "",
    notes: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerEmail: "",
    ownerPhone: "",
    sendWelcomeEmail: true,
  };
}
type Form = ReturnType<typeof emptyForm>;

/** Contract field name (snake_case, from 422 `fieldErrors`) -> form key. */
const FIELD_OF: Record<string, keyof Form> = {
  name: "name",
  slug: "slug",
  legal_name: "legalName",
  gstin: "gstin",
  contact_email: "contactEmail",
  contact_phone: "contactPhone",
  support_phone: "supportPhone",
  support_email: "supportEmail",
  timezone: "timezone",
  default_customer_plan_id: "defaultCustomerPlanId",
  max_customers: "maxCustomers",
  notes: "notes",
  "owner.first_name": "ownerFirstName",
  "owner.last_name": "ownerLastName",
  "owner.email": "ownerEmail",
  "owner.phone": "ownerPhone",
};

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.name.trim().length < 2) e.name = "Enter the ISP's name.";
  if (!SLUG_RE.test(f.slug)) e.slug = "Lowercase letters, digits and single hyphens only.";
  if (f.gstin.trim() && !GSTIN_RE.test(f.gstin.trim().toUpperCase()))
    e.gstin = "Enter a valid 15-character GSTIN.";
  if (!EMAIL_RE.test(f.contactEmail.trim())) e.contactEmail = "Enter a valid email address.";
  if (f.supportEmail.trim() && !EMAIL_RE.test(f.supportEmail.trim()))
    e.supportEmail = "Enter a valid email address.";
  if (!f.defaultCustomerPlanId) e.defaultCustomerPlanId = "Pick the plan every customer runs on.";
  if (f.maxCustomers.trim() && !/^\d+$/.test(f.maxCustomers.trim()))
    e.maxCustomers = "A whole number, or leave it empty for no limit.";
  if (!f.ownerFirstName.trim()) e.ownerFirstName = "Required.";
  if (!f.ownerLastName.trim()) e.ownerLastName = "Required.";
  if (!EMAIL_RE.test(f.ownerEmail.trim())) e.ownerEmail = "Enter the owner's email.";
  return e;
}

const nullIfBlank = (v: string) => (v.trim() ? v.trim() : null);

export function CreateIspPartnerDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (partner: IspPartner) => void;
}) {
  const [form, setForm] = useState<Form>(emptyForm());
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateIspPartnerResult | null>(null);

  useEffect(() => {
    if (!open || plans) return;
    ispPartnerPlatformService
      .listPlans()
      .then(setPlans)
      .catch((err) => setPlansError(requestErrorOf(err)?.message ?? "Could not load plans."));
  }, [open, plans]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
  }

  function close() {
    setForm(emptyForm());
    setSlugTouched(false);
    setErrors({});
    setResult(null);
    onClose();
  }

  async function submit() {
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      const created = await ispPartnerPlatformService.create({
        name: form.name.trim(),
        slug: form.slug,
        legalName: nullIfBlank(form.legalName),
        gstin: form.gstin.trim() ? form.gstin.trim().toUpperCase() : null,
        contactEmail: form.contactEmail.trim(),
        contactPhone: nullIfBlank(form.contactPhone),
        supportPhone: nullIfBlank(form.supportPhone),
        supportEmail: nullIfBlank(form.supportEmail),
        timezone: form.timezone,
        defaultCustomerPlanId: form.defaultCustomerPlanId,
        maxCustomers: form.maxCustomers.trim() ? Number(form.maxCustomers.trim()) : null,
        notes: nullIfBlank(form.notes),
        owner: {
          firstName: form.ownerFirstName.trim(),
          lastName: form.ownerLastName.trim(),
          email: form.ownerEmail.trim(),
          phone: nullIfBlank(form.ownerPhone),
          sendWelcomeEmail: form.sendWelcomeEmail,
        },
      });
      setResult(created);
      onCreated(created.ispPartner);
      toast.success(`${created.ispPartner.name} created`);
    } catch (err) {
      const e = requestErrorOf(err);
      const code = (e?.data?.code as string | undefined) ?? e?.code;
      if (code === "ISP_SLUG_TAKEN") setErrors({ slug: "This slug is already taken." });
      else if (code === "USER_EMAIL_TAKEN")
        setErrors({ ownerEmail: "A user with this email already exists." });
      else if (code === "PLAN_NOT_FOUND")
        setErrors({ defaultCustomerPlanId: "That plan no longer exists." });
      else if (e?.fieldErrors && Object.keys(e.fieldErrors).length) {
        const mapped: Partial<Record<keyof Form, string>> = {};
        for (const [k, msg] of Object.entries(e.fieldErrors)) {
          const key = FIELD_OF[k.replace(/^body\./, "")];
          if (key) mapped[key] = msg;
        }
        setErrors(mapped);
        toast.error(e.message || "Fix the highlighted fields.");
      } else toast.error(e?.message || "Could not create the ISP partner.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Form, label: string, props: Record<string, unknown> = {}) => (
    <MField label={label}>
      <input
        className={M_INPUT}
        value={String(form[key])}
        onChange={(e) => {
          if (key === "slug") setSlugTouched(true);
          set(key, e.target.value as never);
        }}
        aria-invalid={!!errors[key]}
        {...props}
      />
      {errors[key] && <span className="text-xs text-destructive">{errors[key]}</span>}
    </MField>
  );

  return (
    <MDrawer
      open={open}
      onClose={close}
      title={result ? "ISP partner created" : "Create ISP partner"}
      subtitle={
        result
          ? result.ispPartner.name
          : "Creates the ISP's organization, its network dashboard and its first owner."
      }
      footer={
        result ? (
          <div className="flex justify-end">
            <MButton onClick={close}>Done</MButton>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <MButton variant="outline" onClick={close} disabled={saving}>
              Cancel
            </MButton>
            <MButton onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} Create ISP partner
            </MButton>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {result.ispPartner.name} is live. Its owner signs in at the ISP network dashboard, not
            the customer app.
          </p>
          <TemporaryPasswordPanel credential={result.owner} title="Owner sign-in" />
        </div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ISP
            </h4>
            {field("name", "Name", { placeholder: "Airlink Broadband" })}
            {field("slug", "Slug", { placeholder: "airlink-broadband" })}
            {field("legalName", "Legal name (optional)")}
            {field("gstin", "GSTIN (optional)")}
            {field("contactEmail", "Contact email", { type: "email" })}
            {field("contactPhone", "Contact phone (optional)", { inputMode: "tel" })}
            {field("supportPhone", "Support phone shown to the ISP's staff (optional)", {
              inputMode: "tel",
            })}
            {field("supportEmail", "Support email (optional)", { type: "email" })}
            <MField label="Timezone">
              <select
                className={M_INPUT}
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </MField>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customers
            </h4>
            <MField label="Plan every customer of this ISP runs on">
              <select
                className={M_INPUT}
                value={form.defaultCustomerPlanId}
                onChange={(e) => set("defaultCustomerPlanId", e.target.value)}
                disabled={!plans}
                aria-invalid={!!errors.defaultCustomerPlanId}
              >
                <option value="">{plans ? "Select a plan" : "Loading plans..."}</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {(errors.defaultCustomerPlanId || plansError) && (
                <span className="text-xs text-destructive">
                  {errors.defaultCustomerPlanId ?? plansError}
                </span>
              )}
            </MField>
            {field("maxCustomers", "Customer limit (empty = unlimited)", { inputMode: "numeric" })}
            <MField label="Notes (optional, Master only)">
              <textarea
                className={M_INPUT}
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </MField>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              First owner
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {field("ownerFirstName", "First name")}
              {field("ownerLastName", "Last name")}
            </div>
            {field("ownerEmail", "Email (their sign-in)", { type: "email" })}
            {field("ownerPhone", "Phone (optional)", { inputMode: "tel" })}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.sendWelcomeEmail}
                onChange={(e) => set("sendWelcomeEmail", e.target.checked)}
              />
              Email the owner a welcome with the sign-in link
            </label>
          </section>
        </div>
      )}
    </MDrawer>
  );
}
