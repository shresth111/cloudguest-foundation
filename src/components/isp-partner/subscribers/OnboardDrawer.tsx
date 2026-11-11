/**
 * "Add subscriber" (ADDENDUM_05 J2): identity + package + the onboarding
 * profile in one call (`POST /isp/subscribers/onboard`). The circuit id is
 * previewed, not reserved; the API allocates it gap-free on save.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MButton, MDrawer, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ProfileFields, emptyDraft } from "@/components/isp-partner/subscribers/ProfileFields";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { useNextCircuitId, useSub360Mutation } from "@/hooks/isp-partner/useSubscriber360";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { subscriberIdentity } from "@/lib/isp-partner/onboarding";
import { draftToProfile } from "@/lib/isp-partner/subscribers360";
import { subscribers360Service } from "@/services/isp-partner/subscribers360";

export function OnboardDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can } = usePartner();
  const navigate = useNavigate();
  const customers = useIspCustomerOptions(open);
  const packages = usePackages({ status: "active", page_size: 100 }, open);
  const zones = useZones(open && can("isp_zones.read"));
  const next = useNextCircuitId(open);
  const create = useSub360Mutation(subscribers360Service.onboard);
  const [f, setF] = useState({
    isp_customer_id: "",
    identifier: "",
    package_id: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    state_code: "",
    gstin: "",
    zone_id: "",
  });
  const [draft, setDraft] = useState(emptyDraft());
  const [welcome, setWelcome] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF({
        isp_customer_id: "",
        identifier: "",
        package_id: "",
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        address: "",
        state_code: "",
        gstin: "",
        zone_id: "",
      });
      setDraft(emptyDraft());
      setWelcome(true);
      setError(null);
    }
  }, [open]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.isp_customer_id || !f.identifier.trim() || !f.package_id)
      return setError("Customer, login id and package are required.");
    const who = subscriberIdentity(f);
    if ("error" in who) return setError(who.error);
    if (f.state_code && !/^[0-9]{2}$/.test(f.state_code))
      return setError("State code is the 2-digit GST state code, e.g. 07.");
    const p = draftToProfile(draft);
    if ("error" in p) return setError(p.error);
    setError(null);
    const nz = (v: string) => (v.trim() ? v.trim() : null);
    try {
      const res = await create.mutateAsync({
        isp_customer_id: f.isp_customer_id,
        identifier: f.identifier.trim(),
        package_id: f.package_id,
        first_name: who.first_name,
        last_name: who.last_name,
        display_name: who.display_name,
        phone: who.phone,
        email: nz(f.email),
        address: nz(f.address),
        state_code: nz(f.state_code),
        gstin: nz(f.gstin)?.toUpperCase() ?? null,
        zone_id: nz(f.zone_id),
        profile: p.body,
        welcome_whatsapp: welcome,
      } as Parameters<typeof subscribers360Service.onboard>[0]);
      toast.success(`Subscriber added (circuit ${res.circuit_id}).`);
      if (res.welcome?.whatsapp_share_url) {
        window.open(res.welcome.whatsapp_share_url, "_blank", "noopener");
      }
      onClose();
      navigate({ to: "/partner/subscribers/$subscriberId", params: { subscriberId: res.id } });
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };
  if (!open) return null;
  return (
    <MDrawer
      open
      onClose={onClose}
      title="Add subscriber"
      subtitle={
        next.data ? `Circuit id ${next.data} will be assigned (next free)` : "Circuit id: next free"
      }
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton disabled={create.isPending} onClick={save}>
            {create.isPending && <Spinner />} Add subscriber
          </MButton>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Customer (venue)</span>
          <CustomerSelect
            value={f.isp_customer_id}
            onChange={set("isp_customer_id")}
            customers={customers.data}
            allLabel={null}
          />
        </label>
        <TextField
          label="Login id"
          required
          value={f.identifier}
          onChange={set("identifier")}
          hint="Phone, email or username the subscriber signs in with."
        />
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
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="First name"
            required
            value={f.first_name}
            onChange={set("first_name")}
          />
          <TextField label="Last name" value={f.last_name} onChange={set("last_name")} />
          <TextField
            label="Mobile"
            required
            value={f.phone}
            onChange={set("phone")}
            hint="Leave blank to use the login id, when that is a mobile number."
          />
          <TextField label="Email" value={f.email} onChange={set("email")} />
        </div>
        <TextField label="Billing address" value={f.address} onChange={set("address")} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="GST state code"
            value={f.state_code}
            onChange={set("state_code")}
            hint="Decides CGST+SGST vs IGST."
          />
          <TextField label="GSTIN (business)" value={f.gstin} onChange={set("gstin")} />
        </div>
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
        <ProfileFields draft={draft} onChange={setDraft} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={welcome} onChange={(e) => setWelcome(e.target.checked)} />
          Open a WhatsApp welcome message after saving (sent from your phone)
        </label>
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}
