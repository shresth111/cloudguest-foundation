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
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Download, FileCode2, Power, PowerOff } from "lucide-react";
import { MButton, MTag } from "@/components/master/MasterKit";
import { Card, CopyField, ErrorBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIpLogsScript, useIpLogsStatus, useIpLogsToggle } from "@/hooks/isp-partner/useIpLogs";
import { saveBlob } from "@/lib/isp-partner/download";
import {
  IP_LOGS_PIPE_LABEL,
  IP_LOGS_PIPE_STATE_LABEL,
  ipLogsPipeTone,
  ipLogsStateTone,
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

function ScriptBlock({ routerId, mode }: { routerId: string; mode: "enable" | "disable" }) {
  const q = useIpLogsScript(routerId, true);
  if (q.isLoading)
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner /> Generating…
      </p>
    );
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the IP logs script" />;
  const lines = mode === "enable" ? q.data.enable_script : q.data.disable_script;
  if (!q.data.available || !lines) return null;
  const text = lines.join("\n") + "\n";
  const filename =
    mode === "enable"
      ? (q.data.filename ?? "wyfy-ip-logs.rsc")
      : (q.data.filename ?? "wyfy-ip-logs.rsc").replace(/\.rsc$/, "-off.rsc");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {mode === "enable"
            ? "Paste this into the router terminal (WinBox > New Terminal), after the setup script."
            : "Paste this into the router terminal to stop sending IP logs."}
        </p>
        <MButton
          variant="outline"
          onClick={() => saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename)}
        >
          <Download /> Download .rsc
        </MButton>
      </div>
      <CopyField label="Script" value={text} />
      <pre className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-2.5 text-[11px] leading-snug">
        <code>{text}</code>
      </pre>
      {mode === "enable" && (
        <p className="text-xs text-muted-foreground">
          Safe to paste again. The router name becomes <code>{q.data.router_name_on_device}</code>{" "}
          only if the current one has spaces. This card refreshes by itself; the first system log
          line shows up within a minute, connection logs within about 10 minutes.
        </p>
      )}
    </div>
  );
}

export function PartnerIpLogsStep({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const q = useIpLogsStatus(routerId);
  const toggle = useIpLogsToggle(routerId);
  const [shown, setShown] = useState<"enable" | "disable" | null>(null);

  if (q.isLoading || q.data === null) return null;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="IP logs" />;
  const s = q.data;
  const canRun = can("isp_partner.execute");
  const warnings = s.warnings ?? [];

  const turn = (on: boolean) =>
    toggle.mutate(on, {
      onSuccess: () => {
        setShown(on ? "enable" : "disable");
        toast.success(on ? "IP logs turned on. Now paste the script." : "IP logs turned off.");
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update IP logs"),
    });

  return (
    <Card title="IP logs" actions={<MTag label={s.state_label} tone={ipLogsStateTone(s.state)} />}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Sends this router&apos;s system logs and its connection logs (with the NAT translation) to
          Wyfy Guest. They fill NetLogs, IPDR, CGNAT lookup and LEA trace for this router.
        </p>

        {s.blocker ? (
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

        {!s.blocker && canRun && (
          <div className="flex flex-wrap gap-2">
            {!s.set_up ? (
              <MButton onClick={() => turn(true)} disabled={toggle.isPending}>
                <Power /> Turn on IP logs
              </MButton>
            ) : (
              <>
                <MButton
                  variant="outline"
                  onClick={() => setShown(shown === "enable" ? null : "enable")}
                >
                  <FileCode2 /> {shown === "enable" ? "Hide script" : "Show setup script"}
                </MButton>
                <MButton
                  variant="outline"
                  disabled={toggle.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Turn off IP logs for this router? Connection records stop being stored. Logs already stored are kept.",
                      )
                    )
                      turn(false);
                  }}
                >
                  <PowerOff /> Turn off
                </MButton>
              </>
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
        {!s.blocker && !canRun && !s.set_up && (
          <p className="text-xs text-muted-foreground">
            A Technician, Admin or Owner can turn on IP logs.
          </p>
        )}

        {shown && !s.blocker && canRun && <ScriptBlock routerId={routerId} mode={shown} />}
      </div>
    </Card>
  );
}
