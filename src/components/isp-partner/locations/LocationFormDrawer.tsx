/** Create / edit a location under a customer (PRD §4.4). Creating one also
 * gives it a default captive portal on the backend. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, MDrawer, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { useCreateIspLocation, useUpdateIspLocation } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import type { IspLocation, IspLocationCreate } from "@/services/isp-partner/types";

/** The backend's `PropertyType` values. */
export const PROPERTY_TYPES: { value: string; label: string }[] = [
  ["hotel", "Hotel"],
  ["resort", "Resort"],
  ["cafe", "Café"],
  ["restaurant", "Restaurant"],
  ["hospital", "Hospital"],
  ["clinic", "Clinic"],
  ["office", "Office"],
  ["coworking_space", "Coworking space"],
  ["school", "School"],
  ["college", "College"],
  ["university", "University"],
  ["mall", "Mall"],
  ["airport", "Airport"],
  ["factory", "Factory"],
  ["warehouse", "Warehouse"],
  ["apartment", "Apartment / society"],
  ["hostel", "Hostel"],
  ["custom", "Other"],
].map(([value, label]) => ({ value, label }));

type Form = Record<
  | "name"
  | "property_type"
  | "address_line1"
  | "city"
  | "state_province"
  | "postal_code"
  | "country"
  | "timezone"
  | "latitude"
  | "longitude"
  | "contact_name"
  | "contact_phone"
  | "contact_email",
  string
>;

function initial(l: IspLocation | null, tz: string): Form {
  return {
    name: l?.name ?? "",
    property_type: l?.property_type ?? "cafe",
    address_line1: l?.address_line1 ?? "",
    city: l?.city ?? "",
    state_province: l?.state_province ?? "",
    postal_code: l?.postal_code ?? "",
    country: l?.country ?? "IN",
    timezone: l?.timezone ?? tz,
    latitude: l?.latitude != null ? String(l.latitude) : "",
    longitude: l?.longitude != null ? String(l.longitude) : "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
  };
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
const numOrNull = (v: string) => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function LocationFormDrawer({
  open,
  onClose,
  customerId,
  location,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  location: IspLocation | null;
  onSaved?: (l: IspLocation) => void;
}) {
  const { me } = usePartner();
  const [form, setForm] = useState<Form>(() => initial(location, me.isp.timezone));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const create = useCreateIspLocation(customerId);
  const update = useUpdateIspLocation(location?.id ?? "");
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setForm(initial(location, me.isp.timezone));
      setError(null);
      setFieldErrors({});
    }
  }, [open, location, me.isp.timezone]);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) {
      setFieldErrors({ name: "Required." });
      return;
    }
    setError(null);
    const body: IspLocationCreate = {
      name: form.name.trim(),
      property_type: orNull(form.property_type),
      address_line1: orNull(form.address_line1),
      city: orNull(form.city),
      state_province: orNull(form.state_province),
      postal_code: orNull(form.postal_code),
      country: orNull(form.country),
      timezone: orNull(form.timezone),
      latitude: numOrNull(form.latitude),
      longitude: numOrNull(form.longitude),
    };
    if (!location) {
      body.contact_name = orNull(form.contact_name);
      body.contact_phone = orNull(form.contact_phone);
      body.contact_email = orNull(form.contact_email);
    }
    try {
      const saved = location ? await update.mutateAsync(body) : await create.mutateAsync(body);
      toast.success(location ? "Location saved." : `${saved.name} added.`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not save the location."));
    }
  };

  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title={location ? `Edit ${location.name}` : "Add location"}
      subtitle="A venue where this customer's guest WiFi runs."
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </MButton>
          <MButton onClick={submit} disabled={busy}>
            {busy && <Spinner />} {location ? "Save" : "Add location"}
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
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Property type</span>
          <select
            className={M_INPUT}
            value={form.property_type}
            onChange={(e) => set("property_type")(e.target.value)}
          >
            {PROPERTY_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Country (2 letters)"
            value={form.country}
            onChange={set("country")}
            error={fieldErrors.country}
          />
          <TextField
            label="Timezone"
            value={form.timezone}
            onChange={set("timezone")}
            error={fieldErrors.timezone}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Latitude"
            value={form.latitude}
            onChange={set("latitude")}
            error={fieldErrors.latitude}
          />
          <TextField
            label="Longitude"
            value={form.longitude}
            onChange={set("longitude")}
            error={fieldErrors.longitude}
          />
        </div>
        {!location && (
          <>
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              On-site contact (optional)
            </p>
            <TextField label="Name" value={form.contact_name} onChange={set("contact_name")} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Phone" value={form.contact_phone} onChange={set("contact_phone")} />
              <TextField label="Email" value={form.contact_email} onChange={set("contact_email")} />
            </div>
          </>
        )}
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}
