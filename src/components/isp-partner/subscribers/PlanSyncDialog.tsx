/**
 * "Apply to existing subscribers" (ADDENDUM_05 J19). Opens on a dry run (what
 * would change, who is online now), then applies: subscriber speed groups
 * follow their package, queue profiles follow the group, and connected guests
 * are re-pushed live through the existing queue path. Ending live sessions is
 * opt-in.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { FormError, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useSub360Mutation } from "@/hooks/isp-partner/useSubscriber360";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { subscribers360Service } from "@/services/isp-partner/subscribers360";
import type { PlanSyncResult } from "@/services/isp-partner/subscribers360-types";

export function PlanSyncDialog({
  target,
  onClose,
}: {
  target: { kind: "package" | "group"; id: string; name: string } | null;
  onClose: () => void;
}) {
  const { can } = usePartner();
  const [dry, setDry] = useState<PlanSyncResult | null>(null);
  const [kick, setKick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useSub360Mutation((v: { dry_run: boolean; kick_online: boolean }) =>
    subscribers360Service.planSync(target!.kind, target!.id, { ...v, live_push: true }),
  );
  useEffect(() => {
    setDry(null);
    setKick(false);
    setError(null);
    if (!target) return;
    run
      .mutateAsync({ dry_run: true, kick_online: false })
      .then(setDry)
      .catch((err) => setError(ispErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);
  if (!target) return null;
  const canApply = can("isp_subscribers.manage");
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Apply ${target.name} to existing subscribers`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Close
          </MButton>
          {canApply && (
            <MButton
              disabled={run.isPending || !dry || dry.subscribers === 0}
              onClick={async () => {
                setError(null);
                try {
                  const r = await run.mutateAsync({ dry_run: false, kick_online: kick });
                  toast.success(
                    `Applied to ${r.subscribers} subscriber(s); ${r.live_pushed_sessions ?? 0} live session(s) updated.`,
                  );
                  onClose();
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
              }}
            >
              {run.isPending && <Spinner />} Apply now
            </MButton>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {!dry && !error ? (
          <Spinner />
        ) : dry ? (
          <ul className="space-y-1 text-xs">
            <li>
              <span className="font-semibold tabular-nums">{dry.subscribers}</span> subscriber(s) on
              this {target.kind === "package" ? "package" : "speed group"}
            </li>
            <li>
              <span className="font-semibold tabular-nums">{dry.speed_group_changes}</span> will
              move to the package's current speed group
            </li>
            <li>
              <span className="font-semibold tabular-nums">{dry.online_sessions}</span> online now
              across {dry.locations_with_online} venue(s): their speed is re-pushed to the router
              live
            </li>
          </ul>
        ) : null}
        {canApply && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={kick} onChange={(e) => setKick(e.target.checked)} />
            Also end live sessions (they sign in again at the new speed)
          </label>
        )}
        {!canApply && (
          <p className="text-xs text-muted-foreground">
            Only an ISP owner or admin can apply this.
          </p>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}
