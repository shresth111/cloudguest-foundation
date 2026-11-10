/**
 * RAKESH-FS: what each zone may sell. No package ticked = every package.
 * A franchisee only sees (and can only sell) the allowed packages; the
 * backend enforces it. Owner/admin (isp_zones.manage), workflow flag on.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, M_INPUT } from "@/components/master/MasterKit";
import { Card, FormError, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import {
  useSetZonePackages,
  useWorkflowFeatures,
  useZonePackages,
} from "@/hooks/isp-partner/useWorkflow";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

export function ZonePackagesCard() {
  const { can } = usePartner();
  const wf = useWorkflowFeatures();
  const show = wf.on && !!wf.features?.franchisee_logins && can("isp_zones.manage");
  const zones = useZones(show);
  const packages = usePackages({ status: "active", page_size: 100 }, show);
  const [zoneId, setZoneId] = useState("");
  const q = useZonePackages(zoneId, show);
  const save = useSetZonePackages(zoneId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPicked(new Set((q.data?.items ?? []).map((p) => p.id)));
  }, [q.data]);
  if (!show) return null;

  return (
    <Card title="Packages each zone may sell" className="mt-6">
      <div className="space-y-3">
        <select
          className={M_INPUT}
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          aria-label="Zone"
        >
          <option value="">Pick a zone</option>
          {(zones.data ?? []).map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        {zoneId && q.isLoading && <Spinner />}
        {zoneId && q.data && (
          <>
            <p className="text-xs text-muted-foreground">
              {q.data.all_packages
                ? "Now: every package. Tick some to limit this zone to them."
                : `Now: ${q.data.items.length} package(s).`}
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {(packages.data?.items ?? []).map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={(e) =>
                      setPicked((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(p.id);
                        else n.delete(p.id);
                        return n;
                      })
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <FormError message={error} />
            <MButton
              disabled={save.isPending}
              onClick={async () => {
                setError(null);
                try {
                  await save.mutateAsync([...picked]);
                  toast.success("Zone packages saved.");
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
              }}
            >
              {save.isPending && <Spinner />} Save
            </MButton>
          </>
        )}
      </div>
    </Card>
  );
}
