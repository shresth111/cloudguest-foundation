/** Settings → Zones (ADDENDUM_03 §4): labels for filters and reports, and
 * the default place of supply for buyers in them. Not franchises, no login. */
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { MButton, MDialog, MTable, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useInvoiceMutation, useZones } from "@/hooks/isp-partner/useInvoices";
import { zonesService } from "@/services/isp-partner/invoices";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import type { Zone, ZoneBody } from "@/services/isp-partner/invoices-types";

export function ZonesCard() {
  const { can } = usePartner();
  const manage = can("isp_zones.manage");
  const q = useZones();
  const [editing, setEditing] = useState<Zone | null | "new">(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useInvoiceMutation((v: { id?: string; body: ZoneBody }) =>
    v.id ? zonesService.update(v.id, v.body) : zonesService.create(v.body),
  );
  const remove = useInvoiceMutation((id: string) => zonesService.remove(id));

  const open = (z: Zone | "new") => {
    setEditing(z);
    setName(z === "new" ? "" : z.name);
    setCity(z === "new" ? "" : (z.city ?? ""));
    setState(z === "new" ? "" : (z.state_code ?? ""));
    setNotes(z === "new" ? "" : (z.notes ?? ""));
    setError(null);
  };

  return (
    <Card
      title="Zones"
      actions={
        manage && (
          <MButton variant="outline" onClick={() => open("new")}>
            <Plus /> Add zone
          </MButton>
        )
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        A zone groups customers and subscribers for filters and reports, and gives the default GST
        place of supply for buyers in it. It has no login of its own.
      </p>
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="zones" />
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No zones yet.</p>
      ) : (
        <MTable
          head={
            <>
              <MTh>Zone</MTh>
              <MTh>City</MTh>
              <MTh>State code</MTh>
              <MTh className="text-right">In use</MTh>
              {manage && <MTh className="text-right">Actions</MTh>}
            </>
          }
        >
          {(q.data ?? []).map((z) => (
            <MTr key={z.id}>
              <MTd className="font-medium">{z.name}</MTd>
              <MTd className="text-xs">{z.city ?? "–"}</MTd>
              <MTd className="text-xs">{z.state_code ?? "–"}</MTd>
              <MTd className="text-right text-xs tabular-nums">
                {z.customers !== undefined || z.subscribers !== undefined
                  ? `${z.customers ?? 0} customers · ${z.subscribers ?? 0} subscribers`
                  : "–"}
              </MTd>
              {manage && (
                <MTd className="text-right">
                  <MButton variant="ghost" aria-label={`Edit ${z.name}`} onClick={() => open(z)}>
                    <Pencil />
                  </MButton>
                  <MButton
                    variant="ghost"
                    aria-label={`Delete ${z.name}`}
                    disabled={remove.isPending}
                    onClick={async () => {
                      try {
                        await remove.mutateAsync(z.id);
                        toast.success(`${z.name} deleted.`);
                      } catch (err) {
                        toast.error(ispErrorMessage(err));
                      }
                    }}
                  >
                    <Trash2 />
                  </MButton>
                </MTd>
              )}
            </MTr>
          ))}
        </MTable>
      )}
      <MDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add zone" : "Edit zone"}
        footer={
          <>
            <MButton variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </MButton>
            <MButton
              disabled={save.isPending}
              onClick={async () => {
                if (!name.trim()) return setError("Give the zone a name.");
                if (state && !/^\d{2}$/.test(state))
                  return setError("State code is the 2-digit GST code, e.g. 07.");
                setError(null);
                try {
                  await save.mutateAsync({
                    id: editing && editing !== "new" ? editing.id : undefined,
                    body: {
                      name: name.trim(),
                      city: city.trim() || null,
                      state_code: state || null,
                      notes: notes.trim() || null,
                    },
                  });
                  toast.success("Zone saved.");
                  setEditing(null);
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
              }}
            >
              {save.isPending && <Spinner />} Save
            </MButton>
          </>
        }
      >
        <div className="space-y-3">
          <TextField label="Name" required value={name} onChange={setName} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="City" value={city} onChange={setCity} />
            <TextField label="GST state code" value={state} onChange={setState} />
          </div>
          <TextField label="Notes" value={notes} onChange={setNotes} />
          <FormError message={error} />
        </div>
      </MDialog>
    </Card>
  );
}
