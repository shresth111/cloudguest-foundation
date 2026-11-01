/**
 * Onboarding profile fields (ADDENDUM_05 J2), shared by "Add subscriber" and
 * the 360 page's "Edit profile". Controlled: the parent owns the draft.
 */
import { M_INPUT } from "@/components/master/MasterKit";
import { TextField } from "@/components/isp-partner/kit";
import { isoToLocalDate, isoToLocalInput } from "@/lib/isp-partner/subscribers360";
import type { SubscriberProfile } from "@/services/isp-partner/subscribers360-types";

export type ProfileDraft = Record<
  | "alt_email"
  | "gender"
  | "billing_city"
  | "billing_pincode"
  | "install_address"
  | "install_area"
  | "install_building"
  | "install_city"
  | "install_pincode"
  | "latitude"
  | "longitude"
  | "installed_at"
  | "user_type"
  | "connection_type"
  | "ont_serial"
  | "stb_serial"
  | "override_price"
  | "billing_anchor_day"
  | "after_due_action"
  | "activation_at"
  | "comments",
  string
> & { install_same_as_billing: boolean; exclude_reminders: boolean };

export function emptyDraft(p?: SubscriberProfile | null): ProfileDraft {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const op = p?.override_price_paise;
  return {
    alt_email: s(p?.alt_email),
    gender: s(p?.gender),
    billing_city: s(p?.billing_city),
    billing_pincode: s(p?.billing_pincode),
    install_same_as_billing: p?.install_same_as_billing ?? true,
    install_address: s(p?.install_address),
    install_area: s(p?.install_area),
    install_building: s(p?.install_building),
    install_city: s(p?.install_city),
    install_pincode: s(p?.install_pincode),
    latitude: s(p?.latitude),
    longitude: s(p?.longitude),
    installed_at: isoToLocalDate(p?.installed_at),
    user_type: p?.user_type ?? "home",
    connection_type: s(p?.connection_type),
    ont_serial: s(p?.ont_serial),
    stb_serial: s(p?.stb_serial),
    override_price:
      op === null || op === undefined
        ? ""
        : op % 100
          ? `${Math.floor(op / 100)}.${String(op % 100).padStart(2, "0")}`
          : String(op / 100),
    billing_anchor_day: s(p?.billing_anchor_day),
    after_due_action: p?.after_due_action ?? "suspend",
    exclude_reminders: p?.exclude_reminders ?? false,
    activation_at: isoToLocalInput(p?.activation_at),
    comments: s(p?.comments),
  };
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function ProfileFields({
  draft,
  onChange,
  showActivation = true,
}: {
  draft: ProfileDraft;
  onChange: (d: ProfileDraft) => void;
  showActivation?: boolean;
}) {
  const set = (k: keyof ProfileDraft) => (v: string | boolean) =>
    onChange({ ...draft, [k]: v } as ProfileDraft);
  return (
    <div className="space-y-3">
      <Section title="Contact and billing address">
        <TextField
          label="Alternate email (accounts team)"
          value={draft.alt_email}
          onChange={set("alt_email")}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Billing city"
            value={draft.billing_city}
            onChange={set("billing_city")}
          />
          <TextField
            label="Billing PIN code"
            value={draft.billing_pincode}
            onChange={set("billing_pincode")}
          />
        </div>
        <Select
          label="Gender"
          value={draft.gender}
          onChange={set("gender")}
          options={[
            ["", "Not recorded"],
            ["female", "Female"],
            ["male", "Male"],
            ["other", "Other"],
            ["undisclosed", "Prefer not to say"],
          ]}
        />
      </Section>
      <Section title="Installation">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.install_same_as_billing}
            onChange={(e) => set("install_same_as_billing")(e.target.checked)}
          />
          Installed at the billing address
        </label>
        {!draft.install_same_as_billing && (
          <>
            <TextField
              label="Installation address"
              value={draft.install_address}
              onChange={set("install_address")}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Area" value={draft.install_area} onChange={set("install_area")} />
              <TextField
                label="Building / floor"
                value={draft.install_building}
                onChange={set("install_building")}
              />
              <TextField label="City" value={draft.install_city} onChange={set("install_city")} />
              <TextField
                label="PIN code"
                value={draft.install_pincode}
                onChange={set("install_pincode")}
              />
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Latitude"
            value={draft.latitude}
            onChange={set("latitude")}
            hint="e.g. 28.613940"
          />
          <TextField
            label="Longitude"
            value={draft.longitude}
            onChange={set("longitude")}
            hint="e.g. 77.209020"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Connection"
            value={draft.connection_type}
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
            <span className="text-xs font-medium text-muted-foreground">Installed on</span>
            <input
              type="date"
              className={M_INPUT}
              value={draft.installed_at}
              onChange={(e) => set("installed_at")(e.target.value)}
            />
          </label>
          <TextField
            label="ONT / CPE serial"
            value={draft.ont_serial}
            onChange={set("ont_serial")}
          />
          <TextField
            label="Set-top box serial"
            value={draft.stb_serial}
            onChange={set("stb_serial")}
          />
        </div>
      </Section>
      <Section title="Plan and billing">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Subscriber type"
            value={draft.user_type}
            onChange={set("user_type")}
            options={[
              ["home", "Home"],
              ["commercial", "Commercial"],
              ["sme", "SME"],
            ]}
          />
          <TextField
            label="Override price (₹)"
            value={draft.override_price}
            onChange={set("override_price")}
            hint="Blank = the package price. Used on every renewal."
          />
          <TextField
            label="Billing day of month"
            value={draft.billing_anchor_day}
            onChange={set("billing_anchor_day")}
            hint="1–28. Blank = the activation day."
          />
          <Select
            label="After the due date"
            value={draft.after_due_action}
            onChange={set("after_due_action")}
            options={[
              ["suspend", "Suspend service"],
              ["keep_active", "Keep active"],
              ["disconnect_once", "Disconnect once"],
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.exclude_reminders}
            onChange={(e) => set("exclude_reminders")(e.target.checked)}
          />
          Don't send payment reminders to this subscriber
        </label>
      </Section>
      <Section title="Activation and notes">
        {showActivation && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Activate on (blank = now)
            </span>
            <input
              type="datetime-local"
              className={M_INPUT}
              value={draft.activation_at}
              onChange={(e) => set("activation_at")(e.target.value)}
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Internal comments</span>
          <textarea
            className={`${M_INPUT} min-h-[64px]`}
            value={draft.comments}
            onChange={(e) => set("comments")(e.target.value)}
          />
        </label>
      </Section>
    </div>
  );
}
