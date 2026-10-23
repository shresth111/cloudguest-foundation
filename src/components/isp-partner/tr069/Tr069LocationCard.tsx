/** Per-location TR-069 switch and inform interval (API_CONTRACT §5). The
 * setting takes effect on a router when its TR-069 script is pasted again. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, M_INPUT } from "@/components/master/MasterKit";
import { Card, CopyField, ErrorBlock, FormError, Spinner } from "@/components/isp-partner/kit";
import { useSetTr069Location, useTr069Location } from "@/hooks/isp-partner/useTr069";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

export function Tr069LocationCard({
  locationId,
  canManage,
}: {
  locationId: string;
  canManage: boolean;
}) {
  const q = useTr069Location(locationId);
  const save = useSetTr069Location(locationId);
  const [enabled, setEnabled] = useState(false);
  const [interval, setIntervalS] = useState("300");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setIntervalS(String(q.data.periodic_inform_interval_s));
    }
  }, [q.data]);

  if (q.error)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="TR-069 settings" />;

  const onSave = async () => {
    const n = Number(interval);
    if (!Number.isInteger(n) || n < 60 || n > 86400) {
      setError("The check-in interval must be a whole number of seconds from 60 to 86400.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({ enabled, periodic_inform_interval_s: n });
      toast.success(
        "Saved. Turning TR-069 off here refuses this location's devices at the ACS on their next check-in. Routers set up before this change: paste the TR-069 script again so they use the location credential.",
      );
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };

  return (
    <Card title="TR-069 at this location">
      {q.isLoading || !q.data ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner /> Loading…
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canManage}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Manage this location&apos;s routers over TR-069
          </label>
          <label className="block max-w-xs space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Check-in interval (seconds)
            </span>
            <input
              className={M_INPUT}
              inputMode="numeric"
              value={interval}
              disabled={!canManage}
              onChange={(e) => setIntervalS(e.target.value)}
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Queued tasks (refresh, reboot) run at the device&apos;s next check-in, so a shorter
            interval means faster actions.
          </p>
          {q.data.enabled && q.data.acs_url && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-medium">This location&apos;s ACS credential</p>
              <CopyField label="ACS URL" value={q.data.acs_url} />
              {q.data.username && <CopyField label="Username" value={q.data.username} />}
              {q.data.password ? (
                <CopyField label="Password" value={q.data.password} secret />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  The password is shown only to roles that manage TR-069.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {q.data.notes ?? "Devices using this credential are assigned to this location."}{" "}
                Configure non-MikroTik CPEs at this location with it; MikroTik routers get it from
                their TR-069 script.
              </p>
            </div>
          )}
          <FormError message={error} />
          {canManage && (
            <MButton onClick={onSave} disabled={save.isPending}>
              {save.isPending && <Spinner />} Save
            </MButton>
          )}
        </div>
      )}
    </Card>
  );
}
