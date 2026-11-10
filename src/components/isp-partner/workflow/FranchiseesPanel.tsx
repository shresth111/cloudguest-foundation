/**
 * RAKESH-FS (P0 #1, founder 2026-11-10): franchisee logins. The ISP owner or
 * admin adds a franchisee (an `isp-franchisee` user of this same console)
 * and picks the zones it runs; the backend confines it to those zones'
 * subtrees. A franchisee cannot add users, franchisees, customers or ISPs.
 * Shown only when the backend says franchisee logins are on.
 */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog, MTable, MTd, MTh } from "@/components/master/MasterKit";
import { Card, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useCreateIspUser } from "@/hooks/isp-partner/useIsp";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import {
  useFranchisees,
  useSetFranchiseeZones,
  useWorkflowFeatures,
} from "@/hooks/isp-partner/useWorkflow";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import type { IspRoleSlug } from "@/services/isp-partner/types";
import type { WfFranchisee } from "@/services/isp-partner/workflow";

function ZonePick({ value, onChange }: { value: Set<string>; onChange: (v: Set<string>) => void }) {
  const zones = useZones(true);
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto">
      {(zones.data ?? []).map((z) => (
        <label key={z.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.has(z.id)}
            onChange={(e) => {
              const n = new Set(value);
              if (e.target.checked) n.add(z.id);
              else n.delete(z.id);
              onChange(n);
            }}
          />
          {z.name}
        </label>
      ))}
      {zones.isSuccess && !zones.data?.length && (
        <p className="text-sm text-muted-foreground">Create zones under Settings first.</p>
      )}
    </div>
  );
}

export function FranchiseesPanel() {
  const { can } = usePartner();
  const wf = useWorkflowFeatures();
  const show = wf.on && !!wf.features?.franchisee_logins && can("isp_partner.assign");
  const q = useFranchisees(show);
  const create = useCreateIspUser();
  const setZones = useSetFranchiseeZones();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<WfFranchisee | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [zones, setZonesPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  if (!show) return null;

  const openAdd = () => {
    setFirst("");
    setLast("");
    setEmail("");
    setZonesPicked(new Set());
    setError(null);
    setPassword(null);
    setAdding(true);
  };

  return (
    <Card
      title="Franchisees"
      actions={<MButton onClick={openAdd}>Add franchisee</MButton>}
      className="mt-6"
    >
      <p className="mb-3 text-xs text-muted-foreground">
        A franchisee signs in here and sees only its zones: their routers, subscribers, renewals and
        coupons. It cannot add staff, franchisees or customer sites.
      </p>
      {q.isLoading && <Spinner />}
      {q.data && q.data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No franchisees yet.</p>
      )}
      {q.data && q.data.items.length > 0 && (
        <MTable
          head={
            <>
              <MTh>Franchisee</MTh>
              <MTh>Zones</MTh>
              <MTh />
            </>
          }
        >
          {q.data.items.map((u) => (
            <tr key={u.user_id}>
              <MTd>
                {u.full_name ?? u.email}
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </MTd>
              <MTd className="text-xs">
                {u.zones.length ? u.zones.map((z) => z.name).join(", ") : "No zone: sees nothing"}
              </MTd>
              <MTd className="text-right">
                <MButton
                  variant="outline"
                  onClick={() => {
                    setZonesPicked(new Set(u.zones.map((z) => z.id)));
                    setError(null);
                    setEditing(u);
                  }}
                >
                  Zones
                </MButton>
              </MTd>
            </tr>
          ))}
        </MTable>
      )}

      <MDialog
        open={adding}
        onClose={() => setAdding(false)}
        title={password ? "Franchisee added" : "Add franchisee"}
        footer={
          password ? (
            <MButton onClick={() => setAdding(false)}>Done</MButton>
          ) : (
            <>
              <MButton variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </MButton>
              <MButton
                disabled={create.isPending || setZones.isPending}
                onClick={async () => {
                  setError(null);
                  if (!first.trim() || !last.trim() || !email.trim())
                    return setError("Name and email are required.");
                  if (zones.size === 0) return setError("Pick at least one zone.");
                  try {
                    const r = await create.mutateAsync({
                      first_name: first.trim(),
                      last_name: last.trim(),
                      email: email.trim(),
                      phone: null,
                      role: "isp-franchisee" as IspRoleSlug,
                      customer_ids: null,
                      send_welcome_email: true,
                    });
                    await setZones.mutateAsync({ userId: r.user.id, zoneIds: [...zones] });
                    setPassword(r.temporary_password);
                  } catch (err) {
                    setError(ispErrorMessage(err));
                  }
                }}
              >
                {(create.isPending || setZones.isPending) && <Spinner />} Add
              </MButton>
            </>
          )
        }
      >
        {password ? (
          <p className="text-sm">
            Welcome email sent. Temporary password:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">{password}</code>
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="First name" value={first} onChange={setFirst} required />
              <TextField label="Last name" value={last} onChange={setLast} required />
            </div>
            <TextField label="Email" value={email} onChange={setEmail} required />
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Zones it runs</p>
              <ZonePick value={zones} onChange={setZonesPicked} />
            </div>
            <FormError message={error} />
          </div>
        )}
      </MDialog>

      <MDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Zones for ${editing?.full_name ?? editing?.email ?? ""}`}
        footer={
          <>
            <MButton variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </MButton>
            <MButton
              disabled={setZones.isPending}
              onClick={async () => {
                if (!editing) return;
                setError(null);
                try {
                  await setZones.mutateAsync({ userId: editing.user_id, zoneIds: [...zones] });
                  toast.success("Zones saved.");
                  setEditing(null);
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
              }}
            >
              {setZones.isPending && <Spinner />} Save
            </MButton>
          </>
        }
      >
        <ZonePick value={zones} onChange={setZonesPicked} />
        <p className="mt-2 text-xs text-muted-foreground">Each zone includes its sub-zones.</p>
        <FormError message={error} />
      </MDialog>
    </Card>
  );
}
