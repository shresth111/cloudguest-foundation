import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { MButton, MDrawer, MTag } from "@/components/master/MasterKit";
import { useRouterLogging, useRouterLoggingWrite } from "@/hooks/useDeviceLogs";
import { requestErrorOf } from "@/services/api";
import {
  BLOCKER_LABEL,
  RECEIVING_STATE,
  formatAgo,
  verdictLabel,
} from "@/lib/device-logs-presentation";

/**
 * Master -> Device Logs -> one router: whether it is sending, what the last
 * read-back from the device said, the paste script (rendered by the backend
 * from the same rows the API writer uses -- this screen never builds its
 * own copy), and Apply / Remove.
 *
 * Apply's 200 is not "done": the response carries the read-back verdict and
 * the toast reports that, so a write RouterOS accepted but did not hold is
 * shown as a mismatch, not a success. The confirm step is inline rather
 * than a dialog, because a dialog opened from MDrawer renders under its
 * backdrop (both are z-[60]).
 */
export function DeviceLogsRouterDrawer({
  routerId,
  onClose,
  canManage,
}: {
  routerId: string | null;
  onClose: () => void;
  canManage: boolean;
}) {
  const q = useRouterLogging(routerId);
  const write = useRouterLoggingWrite(routerId ?? "");
  const [confirming, setConfirming] = useState<"apply" | "remove" | null>(null);
  const now = Date.now();
  const d = q.data;
  const busy = write.apply.isPending || write.remove.isPending;

  const run = async (op: "apply" | "remove") => {
    setConfirming(null);
    try {
      const detail = await (op === "apply" ? write.apply : write.remove).mutateAsync();
      const ok = detail.status?.verified_ok;
      const what = op === "apply" ? "Remote logging written" : "Remote logging removed";
      if (ok) toast.success(`${what} and verified on the router.`);
      else
        toast.warning(
          `${what}, but the read-back does not match: ${detail.status?.verify_detail ?? "no detail"}`,
        );
    } catch (err) {
      toast.error(requestErrorOf(err)?.message || "The router could not be reached.");
    }
  };

  const disabledReason = !d
    ? null
    : !d.feature_enabled
      ? "Device logging is switched off on this platform."
      : !canManage
        ? "Needs the device_logs.manage permission."
        : d.blocker
          ? d.blocker_detail
          : null;
  const configured = !!d?.status?.enabled;

  return (
    <MDrawer
      open={!!routerId}
      onClose={onClose}
      title={d?.router_name ?? "Router"}
      subtitle={
        d
          ? [d.location_name, d.organization_name].filter(Boolean).join(" · ") || undefined
          : undefined
      }
      footer={
        d && (
          <div className="w-full space-y-2">
            {disabledReason && (
              <p className="text-[11px] text-muted-foreground">{disabledReason}</p>
            )}
            {confirming ? (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs">
                  {confirming === "apply"
                    ? "This writes a logging action and four logging rules to the live router over its API, then reads them back. Nothing else on the router is changed."
                    : "This removes Wyfy's logging action and its rules from the live router, then reads back that they are gone."}
                </p>
                <div className="flex gap-2">
                  <MButton disabled={busy} onClick={() => void run(confirming)}>
                    {confirming === "apply" ? "Write to router" : "Remove from router"}
                  </MButton>
                  <MButton variant="outline" onClick={() => setConfirming(null)}>
                    Cancel
                  </MButton>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <MButton disabled={!!disabledReason || busy} onClick={() => setConfirming("apply")}>
                  {busy && write.apply.isPending
                    ? "Writing…"
                    : configured
                      ? "Re-apply and verify"
                      : "Set up remote logging"}
                </MButton>
                {configured && (
                  <MButton
                    variant="outline"
                    disabled={
                      busy || !d.feature_enabled || !canManage || d.blocker === "NOT_MIKROTIK"
                    }
                    onClick={() => setConfirming("remove")}
                  >
                    {write.remove.isPending ? "Removing…" : "Remove"}
                  </MButton>
                )}
              </div>
            )}
          </div>
        )
      }
    >
      {q.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : q.isError || !d ? (
        <p className="text-sm text-destructive">
          {requestErrorOf(q.error)?.message ?? "Couldn't load this router."}
        </p>
      ) : (
        <div className="space-y-5 text-sm">
          <section className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <MTag label={RECEIVING_STATE[d.state].label} tone={RECEIVING_STATE[d.state].tone} />
              {d.blocker && <MTag label={BLOCKER_LABEL[d.blocker]} tone="warning" />}
              <span className="text-xs text-muted-foreground">
                {d.vendor}
                {d.tunnel_ip ? ` · tunnel ${d.tunnel_ip}` : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{RECEIVING_STATE[d.state].detail}</p>
            {d.blocker_detail && <p className="text-xs text-amber-700">{d.blocker_detail}</p>}
          </section>

          {d.status && (
            <section className="space-y-1 rounded-lg border border-border p-3 text-xs">
              <p>
                <span className="text-muted-foreground">Last line received: </span>
                {formatAgo(d.status.last_received_at, now)}
              </p>
              <p>
                <span className="text-muted-foreground">Sends to: </span>
                {d.status.remote_host}:{d.status.remote_port} (UDP, inside the tunnel)
              </p>
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">Last read-back: </span>
                <MTag
                  label={verdictLabel(d.status.verified_ok).label}
                  tone={verdictLabel(d.status.verified_ok).tone}
                />
                {d.status.last_verified_at && (
                  <span className="text-muted-foreground">
                    {formatAgo(d.status.last_verified_at, now)}
                  </span>
                )}
              </p>
              {d.status.verify_detail && d.status.verified_ok === false && (
                <p className="font-mono text-[11px] text-destructive">{d.status.verify_detail}</p>
              )}
              {!d.status.enabled && (
                <p className="text-muted-foreground">Removed from the router by Wyfy.</p>
              )}
            </section>
          )}

          {d.script ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold">Paste script (RouterOS terminal)</h4>
                <MButton
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(d.script!.join("\n"))
                      .then(() => toast.success("Script copied."))
                      .catch(() => toast.error("Couldn't copy. Select the text instead."));
                  }}
                >
                  <Copy /> Copy
                </MButton>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">
                {d.script.join("\n")}
              </pre>
              <p className="text-[11px] text-muted-foreground">
                The same configuration the "Set up" button writes. A pasted router is not tracked
                here until a line arrives or Set up is run once to read it back.
              </p>
            </section>
          ) : null}
        </div>
      )}
    </MDrawer>
  );
}
