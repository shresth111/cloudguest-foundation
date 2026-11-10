/**
 * IPLOGS-SELFSERVE: one line above NetLogs / Compliance saying which routers
 * are actually sending IP logs, so an empty page is never mistaken for "no
 * traffic". Renders nothing while the backend flag is off (404 -> null) or
 * when the ISP has no routers.
 */
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { MTag } from "@/components/master/MasterKit";
import { useIpLogsFleet } from "@/hooks/isp-partner/useIpLogs";
import {
  IP_LOGS_STATE_SHORT,
  IP_LOGS_SUMMARY_ORDER,
  ipLogsStateTone,
} from "@/lib/isp-partner/iplogs";

export function IpLogsStatusStrip() {
  const q = useIpLogsFleet();
  const data = q.data;
  if (!data || data.items.length === 0) return null;
  const notArriving = data.items.filter((i) => i.state !== "logs_arriving");
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs">
      <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="font-medium">IP logs from your routers:</span>
      {IP_LOGS_SUMMARY_ORDER.filter((s) => data.summary[s]).map((s) => (
        <MTag
          key={s}
          label={`${data.summary[s]} ${IP_LOGS_STATE_SHORT[s]}`}
          tone={ipLogsStateTone(s)}
        />
      ))}
      {!data.collectors.flows && (
        <span className="text-muted-foreground">
          Connection logs (IPDR, CGNAT lookup) are not collected on this server yet.
        </span>
      )}
      {notArriving.length > 0 && (
        <Link
          to="/partner/routers/$ispRouterId"
          params={{ ispRouterId: notArriving[0].isp_router_id }}
          className="text-primary hover:underline"
        >
          Set up {notArriving[0].router_name}
          {notArriving.length > 1 ? ` and ${notArriving.length - 1} more` : ""}
        </Link>
      )}
    </div>
  );
}
