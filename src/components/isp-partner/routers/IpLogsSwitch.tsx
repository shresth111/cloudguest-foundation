/**
 * DEFAULT-LOGS (founder 2026-11-11: "ya button bana do logging on/off ka"):
 * one obvious "IP logs: ON / OFF" switch, used at the top of the router page,
 * in the IP logs card and on each row of the Routers list.
 *
 * Flipping it always asks first (an in-app dialog, never `window.confirm`),
 * then calls the same backend routes the card always used
 * (`POST /isp/routers/{id}/ip-logs/enable|disable`, `isp_partner.execute`,
 * scope-checked by the backend), then shows what to paste:
 * ON -> the enable script, OFF -> the removal script. A router whose setup
 * script has not been generated yet needs no paste: ON means "already in the
 * setup script", OFF means "left out of it".
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { CopyField, ErrorBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIpLogsScript, useIpLogsToggle } from "@/hooks/isp-partner/useIpLogs";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { ipLogsConfirmCopy, ipLogsResultCopy, ipLogsSwitchOn } from "@/lib/isp-partner/iplogs";
import type { IpLogsStatus } from "@/services/isp-partner/iplogs";
import { cn } from "@/lib/utils";

/** The paste script (enable or removal), with copy and download. */
export function ScriptBlock({ routerId, mode }: { routerId: string; mode: "enable" | "disable" }) {
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
          only if the current one has spaces. The first system log line shows up within a minute,
          connection logs within about 10 minutes.
        </p>
      )}
    </div>
  );
}

export function IpLogsSwitch({
  status,
  size = "md",
  showRouterLink = false,
}: {
  status: IpLogsStatus;
  size?: "sm" | "md";
  /** On the Routers list: the "already in the setup script" result links to the router page. */
  showRouterLink?: boolean;
}) {
  const { can } = usePartner();
  const routerId = status.isp_router_id;
  const toggle = useIpLogsToggle(routerId);
  const [asking, setAsking] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ on: boolean; needsLink: boolean } | null>(null);
  const on = ipLogsSwitchOn(status);
  const unsupported = status.blocker === "not_mikrotik";
  const canChange = can("isp_partner.execute") && !unsupported;
  const needsLink = status.blocker === "needs_link";

  const confirm = (turnOn: boolean) =>
    toggle.mutate(turnOn, {
      onSuccess: (data) => {
        setAsking(null);
        setResult({ on: turnOn, needsLink: data.blocker === "needs_link" });
      },
      onError: (e) => ispToastError(e, "Could not change IP logs."),
    });

  const copy = asking === null ? null : ipLogsConfirmCopy(asking, needsLink);
  const label = unsupported ? "IP logs: not supported" : `IP logs: ${on ? "ON" : "OFF"}`;

  return (
    // Rows of the Routers list navigate on click: nothing in here may bubble.
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={!canChange || toggle.isPending}
        title={
          canChange
            ? on
              ? "Turn IP logs off"
              : "Turn IP logs on"
            : unsupported
              ? "IP logs can be turned on for MikroTik routers only."
              : "A Technician, Admin or Owner can change IP logs."
        }
        onClick={() => setAsking(!on)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs",
          on
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-border bg-card text-muted-foreground hover:border-primary",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "relative inline-block rounded-full transition-colors",
            size === "sm" ? "h-3 w-5" : "h-4 w-7",
            on ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 rounded-full bg-white shadow transition-all",
              size === "sm" ? "h-2 w-2" : "h-3 w-3",
              on ? (size === "sm" ? "left-2.5" : "left-3.5") : "left-0.5",
            )}
          />
        </span>
        {toggle.isPending ? <Spinner /> : label}
      </button>

      <MDialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={copy?.title ?? ""}
        footer={
          <>
            <MButton variant="outline" onClick={() => setAsking(null)} disabled={toggle.isPending}>
              Cancel
            </MButton>
            <MButton onClick={() => confirm(!!asking)} disabled={toggle.isPending}>
              {toggle.isPending && <Spinner />} {copy?.confirm}
            </MButton>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p className="font-medium">{status.router_name}</p>
          <p className="text-muted-foreground">{copy?.body}</p>
        </div>
      </MDialog>

      <MDialog
        open={result !== null}
        onClose={() => setResult(null)}
        title={result?.on ? "IP logs are ON" : "IP logs are OFF"}
        wide={!!result && !result.needsLink}
        footer={<MButton onClick={() => setResult(null)}>Done</MButton>}
      >
        {result && (
          <div className="space-y-3 text-sm">
            <p>{ipLogsResultCopy(result.on, result.needsLink)}</p>
            {result.needsLink ? (
              result.on &&
              showRouterLink && (
                <Link
                  to="/partner/routers/$ispRouterId"
                  params={{ ispRouterId: routerId }}
                  className="text-xs text-primary hover:underline"
                >
                  Open the router page to generate the setup script
                </Link>
              )
            ) : (
              <ScriptBlock routerId={routerId} mode={result.on ? "enable" : "disable"} />
            )}
          </div>
        )}
      </MDialog>
    </span>
  );
}
