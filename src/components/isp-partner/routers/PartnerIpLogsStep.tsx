/**
 * IPLOGS-SELFSERVE: "Turn on IP logs" on the partner router page.
 *
 * One card: what is arriving from this router (system logs, connection logs,
 * NAT translations), warnings (behind another NAT, clock off, RouterOS 6...),
 * and the one paste script the backend renders. "Turn on" records that the
 * router is meant to send, so its connection records are stored; pasting
 * the script makes the router send.
 *
 * While the backend flag is off every endpoint answers 404, the status
 * resolves to `null` and this card renders nothing.
 *
 * DEFAULT-LOGS: the Turn on / Turn off buttons are now the one
 * "IP logs: ON / OFF" switch (`IpLogsSwitch`, in-app confirm both ways). A
 * router added before logging was on by default gets a "Turn on IP logs"
 * prompt; nothing is switched on for it silently.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, FileCode2 } from "lucide-react";
import { MButton, MTag } from "@/components/master/MasterKit";
import { Card, ErrorBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { IpLogsSwitch, ScriptBlock } from "@/components/isp-partner/routers/IpLogsSwitch";
import { useIpLogsStatus } from "@/hooks/isp-partner/useIpLogs";
import {
  IP_LOGS_PIPE_LABEL,
  IP_LOGS_PIPE_STATE_LABEL,
  ipLogsNeedsPrompt,
  ipLogsPipeTone,
  ipLogsStateTone,
  ipLogsSwitchOn,
} from "@/lib/isp-partner/iplogs";
import type { IpLogsPipe, IpLogsStatus } from "@/services/isp-partner/iplogs";

function PipeRow({ name, pipe }: { name: keyof IpLogsStatus["pipes"]; pipe: IpLogsPipe }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-1.5 sm:grid-cols-[10rem_auto_minmax(0,1fr)]">
      <span className="text-sm">{IP_LOGS_PIPE_LABEL[name]}</span>
      <MTag label={IP_LOGS_PIPE_STATE_LABEL[pipe.state]} tone={ipLogsPipeTone(pipe.state)} />
      <span className="col-span-2 text-xs text-muted-foreground sm:col-span-1">
        {pipe.last_at_ist ? `Last at ${pipe.last_at_ist} IST` : "Nothing received yet"}
        {name !== "nat" &&
          pipe.count_last_hour > 0 &&
          ` · ${pipe.count_last_hour} in the last hour`}
      </span>
    </div>
  );
}

export function PartnerIpLogsStep({
  routerId,
  foldedIntoSetup = false,
}: {
  routerId: string;
  /** DEFAULT-LOGS: true when this page's Generate folds IP logs into the
   * setup script (both backend probes answered). */
  foldedIntoSetup?: boolean;
}) {
  const { can } = usePartner();
  const q = useIpLogsStatus(routerId);
  const [shown, setShown] = useState(false);

  if (q.isLoading || q.data === null) return null;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="IP logs" />;
  const s = q.data;
  const canRun = can("isp_partner.execute");
  const warnings = s.warnings ?? [];
  const on = ipLogsSwitchOn(s);

  return (
    <Card title="IP logs" actions={<MTag label={s.state_label} tone={ipLogsStateTone(s.state)} />}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Sends this router&apos;s system logs and its connection logs (with the NAT translation) to
          Wyfy Guest. They fill NetLogs, IPDR, CGNAT lookup and LEA trace for this router.
        </p>

        {ipLogsNeedsPrompt(s) && canRun && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <p>
              IP logs are off for this router. It was added before they were on by default. Turn
              them on to fill NetLogs, IPDR and CGNAT lookup.
            </p>
            <IpLogsSwitch status={s} />
          </div>
        )}

        {s.blocker === "needs_link" && on && foldedIntoSetup ? (
          <div className="flex gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <p>
              IP logs are ON and already part of this router&apos;s setup script. Press Generate
              above and paste the script once; nothing else to paste.
            </p>
          </div>
        ) : s.blocker ? (
          <div className="flex gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <p>{s.blocker_hint}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            <PipeRow name="syslog" pipe={s.pipes.syslog} />
            <PipeRow name="flows" pipe={s.pipes.flows} />
            <PipeRow name="nat" pipe={s.pipes.nat} />
          </div>
        )}

        {warnings.length > 0 && (
          <ul className="space-y-1.5">
            {warnings.map((w) => (
              <li
                key={w.code}
                className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        )}

        {s.blocker !== "not_mikrotik" && canRun && (
          <div className="flex flex-wrap items-center gap-2">
            <IpLogsSwitch status={s} />
            {!s.blocker && s.set_up && s.can_change !== false && (
              <MButton variant="outline" onClick={() => setShown(!shown)}>
                <FileCode2 /> {shown ? "Hide script" : "Show IP logs script"}
              </MButton>
            )}
            <Link to="/partner/logs" className="self-center text-xs text-primary hover:underline">
              Open NetLogs
            </Link>
            <Link
              to="/partner/compliance"
              className="self-center text-xs text-primary hover:underline"
            >
              IPDR and CGNAT lookup
            </Link>
          </div>
        )}
        {!canRun && (
          <p className="text-xs text-muted-foreground">
            IP logs are {on ? "ON" : "OFF"}. A Technician, Admin or Owner can change them.
          </p>
        )}

        {shown && !s.blocker && canRun && s.can_change !== false && (
          <ScriptBlock routerId={routerId} mode="enable" />
        )}
      </div>
    </Card>
  );
}
