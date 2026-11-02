/**
 * SMALL-5: per-ISP switch for incidents opened automatically when a router
 * stays DOWN (and resolved when it stays UP). Default off. Everything here
 * 404s with the INCIDENTS flag, so the card renders nothing then. Editing
 * needs `isp_incidents.manage`; others see the current setting.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MButton } from "@/components/master/MasterKit";
import { Card, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { AUTO_INCIDENT_KEYS, minutesProblem } from "@/lib/isp-partner/incident-auto";
import { incidentAutoService } from "@/services/isp-partner/incident-auto";

export function AutoIncidentsCard() {
  const { can } = usePartner();
  const canEdit = can("isp_incidents.manage");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: AUTO_INCIDENT_KEYS.settings,
    queryFn: () => incidentAutoService.settings(),
    retry: false,
  });
  const [enabled, setEnabled] = useState(false);
  const [down, setDown] = useState("10");
  const [up, setUp] = useState("15");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setDown(String(q.data.down_minutes));
      setUp(String(q.data.up_minutes));
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      incidentAutoService.putSettings({
        enabled,
        down_minutes: Number(down),
        up_minutes: Number(up),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTO_INCIDENT_KEYS.settings });
      toast.success("Auto incidents saved.");
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  if (q.isError || !q.data) return null;
  const problem = minutesProblem(down) ?? minutesProblem(up);
  return (
    <Card title="Open incidents automatically">
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          When a router stays down for the time below, an incident opens on it by itself (one per
          router at a time). It resolves by itself, reason “Power/link restored – auto”, once the
          router stays up for the second time. Venues run through a vendor controller are skipped.
          Auto-resolved incidents never get automatic grace.
        </p>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEdit}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Open and resolve incidents automatically
        </label>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <TextField
            label="Down for (minutes)"
            value={down}
            onChange={setDown}
            disabled={!canEdit}
          />
          <TextField label="Up for (minutes)" value={up} onChange={setUp} disabled={!canEdit} />
        </div>
        {problem && <p className="text-xs text-destructive">{problem}</p>}
        <FormError message={error} />
        {canEdit && (
          <MButton
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            disabled={save.isPending || !!problem}
          >
            {save.isPending && <Spinner />} Save
          </MButton>
        )}
      </div>
    </Card>
  );
}
