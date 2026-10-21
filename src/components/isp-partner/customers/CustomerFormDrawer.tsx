/**
 * Create / edit a customer (PRD §4.3). There is deliberately NO login,
 * admin-email or invite field: ISP customers never get a login. The contact
 * email is a contact only; nothing is sent to it.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, MDrawer } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { useCreateIspCustomer, useUpdateIspCustomer } from "@/hooks/isp-partner/useIsp";
import { ispErrorCode, ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import type { IspCustomer, IspCustomerCreate } from "@/services/isp-partner/types";

type Form = Record<
  | "name"
  | "slug"
  | "legal_name"
  | "gstin"
  | "external_ref"
  | "contact_name"
  | "contact_email"
  | "contact_phone"
  | "address_line1"
  | "city"
  | "state_province"
  | "postal_code"
  | "timezone"
  | "notes",
  string
>;

function initial(c: IspCustomer | null, tz: string): Form {
  return {
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    legal_name: c?.legal_name ?? "",
    gstin: c?.gstin ?? "",
    external_ref: c?.external_ref ?? "",
    contact_name: c?.contact_name ?? "",
    contact_email: c?.contact_email ?? "",
    contact_phone: c?.contact_phone ?? "",
    address_line1: c?.address_line1 ?? "",
    city: c?.city ?? "",
    state_province: c?.state_province ?? "",
    postal_code: c?.postal_code ?? "",
    timezone: c?.timezone ?? tz,
    notes: c?.notes ?? "",
  };
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

export function CustomerFormDrawer({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** null = create. */
  customer: IspCustomer | null;
  onSaved?: (c: IspCustomer) => void;
}) {
  const { me } = usePartner();
  const [form, setForm] = useState<Form>(() => initial(customer, me.isp.timezone));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const create = useCreateIspCustomer();
  const update = useUpdateIspCustomer(customer?.id ?? "");
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setForm(initial(customer, me.isp.timezone));
      setError(null);
      setFieldErrors({});
    }
  }, [open, customer, me.isp.timezone]);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim()))
      errs.contact_email = "Enter a valid email.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    const body: IspCustomerCreate = {
      name: form.name.trim(),
      legal_name: orNull(form.legal_name),
      gstin: orNull(form.gstin),
      external_ref: orNull(form.external_ref),
      contact_name: orNull(form.contact_name),
      contact_email: form.contact_email.trim(),
      contact_phone: orNull(form.contact_phone),
      address_line1: orNull(form.address_line1),
      city: orNull(form.city),
      state_province: orNull(form.state_province),
      postal_code: orNull(form.postal_code),
      timezone: orNull(form.timezone),
      notes: orNull(form.notes),
    };
    try {
      let saved: IspCustomer;
      if (customer) {
        saved = await update.mutateAsync(body);
        toast.success("Customer saved.");
      } else {
        const slug = orNull(form.slug);
        saved = await create.mutateAsync(slug ? { ...body, slug } : body);
        toast.success(`${saved.name} added.`);
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const code = ispErrorCode(err);
      const fe = ispFieldErrors(err);
      if (code === "ISP_CUSTOMER_SLUG_TAKEN") fe.slug = ispErrorMessage(err);
      if (code === "ISP_EXTERNAL_REF_TAKEN") fe.external_ref = ispErrorMessage(err);
      setFieldErrors(fe);
      setError(ispErrorMessage(err, "Could not save the customer."));
    }
  };

  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title={customer ? `Edit ${customer.name}` : "Add customer"}
      subtitle="A business you provide WiFi to. Customers do not get a login."
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </MButton>
          <MButton onClick={submit} disabled={busy}>
            {busy && <Spinner />} {customer ? "Save" : "Add customer"}
          </MButton>
        </div>
      }
    >
      <div className="space-y-3">
        <TextField
          label="Name"
          required
          value={form.name}
          onChange={set("name")}
          error={fieldErrors.name}
        />
        {!customer && (
          <TextField
            label="Slug"
            value={form.slug}
            onChange={set("slug")}
            error={fieldErrors.slug}
            hint="Optional. Leave empty to have one made from the name. It cannot be changed later."
          />
        )}
        <TextField
          label="Legal name"
          value={form.legal_name}
          onChange={set("legal_name")}
          error={fieldErrors.legal_name}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="GSTIN"
            value={form.gstin}
            onChange={set("gstin")}
            error={fieldErrors.gstin}
          />
          <TextField
            label="Your account no."
            value={form.external_ref}
            onChange={set("external_ref")}
            error={fieldErrors.external_ref}
            hint="Your own reference for this customer."
          />
        </div>
        <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Contact
        </p>
        <TextField
          label="Contact person"
          value={form.contact_name}
          onChange={set("contact_name")}
          error={fieldErrors.contact_name}
        />
        <TextField
          label="Contact email"
          required
          type="email"
          value={form.contact_email}
          onChange={set("contact_email")}
          error={fieldErrors.contact_email}
          hint="For your records only. No account is created and nothing is emailed."
        />
        <TextField
          label="Contact phone"
          value={form.contact_phone}
          onChange={set("contact_phone")}
          error={fieldErrors.contact_phone}
        />
        <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Address
        </p>
        <TextField
          label="Address"
          value={form.address_line1}
          onChange={set("address_line1")}
          error={fieldErrors.address_line1}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="City"
            value={form.city}
            onChange={set("city")}
            error={fieldErrors.city}
          />
          <TextField
            label="State"
            value={form.state_province}
            onChange={set("state_province")}
            error={fieldErrors.state_province}
          />
          <TextField
            label="PIN code"
            value={form.postal_code}
            onChange={set("postal_code")}
            error={fieldErrors.postal_code}
          />
        </div>
        <TextField
          label="Timezone"
          value={form.timezone}
          onChange={set("timezone")}
          error={fieldErrors.timezone}
        />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Notes</span>
          <textarea
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes")(e.target.value)}
          />
        </label>
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}
