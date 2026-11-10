/**
 * RAKESH-FS (P0 #1/#2): the zones one router serves. Several zones may share
 * one physical router. Shown with the workflow flag on; editing needs
 * isp_zones.manage (owner/admin), reading isp_zones.read.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton } from "@/components/master/MasterKit";
import { Card, FormError, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import {
  useRouterZones,
  useSetRouterZones,
  useWorkflowFeatures,
} from "@/hooks/isp-partner/useWorkflow";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

export function RouterZonesCard({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const wf = useWorkflowFeatures();
  const show = wf.on && can("isp_zones.read");
  const canEdit = can("isp_zones.manage");
  const q = useRouterZones(routerId, show);
  const zones = useZones(show && canEdit);
  const save = useSetRouterZones(routerId);
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setPicked(new Set(q.data.zones.map((z) => z.id)));
  }, [q.data]);

  if (!show) return null;
  const linked = q.data?.zones ?? [];

  return (
    <Card
      title="Zones served"
      actions={
        canEdit && !editing ? (
          <MButton variant="outline" onClick={() => setEditing(true)}>
            Edit
          </MButton>
        ) : null
      }
    >
      {q.isLoading && <Spinner />}
      {!editing && (
        <p className="text-sm">
          {linked.length ? linked.map((z) => z.name).join(", ") : "No zone linked yet."}
        </p>
      )}
      {!editing && (
        <p className="mt-1 text-xs text-muted-foreground">
          New subscribers in these zones are placed on this router automatically.
        </p>
      )}
      {editing && (
        <div className="space-y-2">
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {(zones.data ?? []).map((z) => (
              <label key={z.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.has(z.id)}
                  onChange={(e) =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(z.id);
                      else n.delete(z.id);
                      return n;
                    })
                  }
                />
                {z.name}
              </label>
            ))}
            {zones.isSuccess && !zones.data?.length && (
              <p className="text-sm text-muted-foreground">Create zones under Settings first.</p>
            )}
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <MButton
              disabled={save.isPending}
              onClick={async () => {
                setError(null);
                try {
                  await save.mutateAsync([...picked]);
                  toast.success("Router zones saved.");
                  setEditing(false);
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
              }}
            >
              {save.isPending && <Spinner />} Save
            </MButton>
            <MButton variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </MButton>
          </div>
        </div>
      )}
    </Card>
  );
}
