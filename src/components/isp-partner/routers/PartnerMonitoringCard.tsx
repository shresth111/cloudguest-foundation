/**
 * PROV-FIX D4: "Traffic monitoring" on the partner router page.
 *
 * The ISP owner or admin switches monitoring on for their own router; the
 * traffic history graph (NETMON) then fills in. Before this only Wyfy Guest
 * support could switch it on. While the backend flag is off the status
 * endpoint answers 404, the query resolves to `null` and this card renders
 * nothing.
 */
import { toast } from "sonner";
import { Activity, PowerOff } from "lucide-react";
import { MButton, MTag } from "@/components/master/MasterKit";
import { Card, ErrorBlock, Spinner } from "@/components/isp-partner/kit";
import { useRouterMonitoring, useRouterMonitoringToggle } from "@/hooks/isp-partner/useProvFix";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { formatAgo, formatIst } from "@/lib/isp-partner/format";

export function PartnerMonitoringCard({
  routerId,
  enabled,
}: {
  routerId: string;
  enabled: boolean;
}) {
  const q = useRouterMonitoring(routerId, enabled);
  const toggle = useRouterMonitoringToggle(routerId);
  if (!enabled || q.data === null) return null;
  if (q.isLoading)
    return (
      <Card title="Traffic monitoring">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner /> Loading…
        </p>
      </Card>
    );
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="traffic monitoring" />;
  const m = q.data;
  const run = (on: boolean) =>
    toggle.mutate(on, {
      onSuccess: () =>
        toast.success(on ? "Traffic monitoring is on." : "Traffic monitoring is off."),
      onError: (e) => ispToastError(e, "Could not change traffic monitoring."),
    });
  return (
    <Card title="Traffic monitoring">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <MTag label={m.enabled ? "On" : "Off"} tone={m.enabled ? "online" : "normal"} />
          {m.enabled && (
            <span className="text-xs text-muted-foreground">
              {m.last_reading_at ? (
                <span title={formatIst(m.last_reading_at)}>
                  Last reading {formatAgo(m.last_reading_at)}
                  {m.last_reading_ok === false ? " (the last attempt failed)" : ""}
                </span>
              ) : (
                "First reading within 5 minutes."
              )}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {m.enabled
            ? "Wyfy Guest reads this router's traffic every few minutes for the traffic history graph."
            : "Switch this on to see this router's traffic history. The router must be online, and Read now must work on this page."}
        </p>
        {m.can_change ? (
          <MButton
            variant={m.enabled ? "outline" : "primary"}
            disabled={toggle.isPending}
            onClick={() => run(!m.enabled)}
          >
            {toggle.isPending ? <Spinner /> : m.enabled ? <PowerOff /> : <Activity />}
            {m.enabled ? "Switch off" : "Switch on monitoring"}
          </MButton>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only an owner or admin of your ISP account can change this.
          </p>
        )}
      </div>
    </Card>
  );
}
