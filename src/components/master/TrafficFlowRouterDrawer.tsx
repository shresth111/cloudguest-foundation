import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { MButton, MDrawer, MTag } from "@/components/master/MasterKit";
import { useRouterFlowConfig, useRouterFlowWrite } from "@/hooks/useTrafficFlow";
import { requestErrorOf } from "@/services/api";
import {
  TRAFFIC_FLOW_MODULE_NAME,
  applyBlockers,
  dryRunSummary,
  flowState,
  formatAgo,
  lastDataLabel,
  scriptText,
  verdictLabel,
  windowsLastHourLabel,
  writeVerdictMessage,
} from "@/lib/traffic-flow";
import type { FlowWriteResult } from "@/types/traffic-flow";

type Op = "apply" | "remove";

/**
 * Master -> Traffic Lens -> one router (screen M3): its state, what the last
 * read-back from the device said, the paste and removal scripts (rendered by
 * the backend from the same description the device writer uses -- this
 * screen never builds its own copy), a read-only dry run, and Apply / Remove.
 *
 * Apply's 200 is not "done": the response carries the read-back verdict and
 * both the toast and the "Last write" block report that, so a write RouterOS
 * accepted but did not hold is a warning, not a success. And a verified
 * Apply only moves the router to "Waiting for first data"; data arriving is
 * a separate fact.
 *
 * The confirm step is inline rather than a dialog, because a dialog opened
 * from MDrawer renders under its backdrop (both are z-[60]).
 *
 * The caller mounts this with `key={routerId}` so one router's last write
 * is never shown against another.
 */
export function TrafficFlowRouterDrawer({
  routerId,
  onClose,
  canApply,
  windowSeconds,
}: {
  routerId: string | null;
  onClose: () => void;
  /** The operator holds traffic_flows.update. */
  canApply: boolean;
  /** From GET /status, for the "n of 12" windows figure. */
  windowSeconds: number;
}) {
  const q = useRouterFlowConfig(routerId);
  const write = useRouterFlowWrite(routerId ?? "");
  const [confirming, setConfirming] = useState<Op | null>(null);
  const [lastWrite, setLastWrite] = useState<{ op: Op; result: FlowWriteResult } | null>(null);
  const [dryRun, setDryRun] = useState<FlowWriteResult | null>(null);
  const now = Date.now();
  const d = q.data;
  const st = d?.status ?? null;
  const busy = write.apply.isPending || write.remove.isPending || write.dryRun.isPending;

  const run = async (op: Op) => {
    setConfirming(null);
    setDryRun(null);
    try {
      const result = await (op === "apply" ? write.apply : write.remove).mutateAsync();
      setLastWrite({ op, result });
      const msg = writeVerdictMessage(op, result);
      if (msg.tone === "success") toast.success(msg.text);
      else toast.warning(msg.text);
    } catch (err) {
      toast.error(
        requestErrorOf(err)?.message || "The router could not be reached. Nothing was changed.",
      );
    }
  };

  const check = async () => {
    try {
      setDryRun(await write.dryRun.mutateAsync());
    } catch (err) {
      toast.error(requestErrorOf(err)?.message || "The router could not be read.");
    }
  };

  const blockers = applyBlockers(d, canApply);
  const applyBlocked = blockers.length > 0;
  const configured = st?.configured === true;
  const unsupported = st?.state === "unsupported_vendor";
  const paste = scriptText(d?.paste_script);
  const removal = scriptText(d?.removal_script);
  const state = flowState(st?.state);

  return (
    <MDrawer
      open={!!routerId}
      onClose={onClose}
      title={st?.router_name ?? "Router"}
      subtitle={
        st
          ? [st.location_name, st.organization_name].filter(Boolean).join(" · ") || undefined
          : undefined
      }
      footer={
        d && (
          <div className="w-full space-y-2">
            {applyBlocked && (
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                {blockers.map((b) => (
                  <li key={b}>Apply is unavailable: {b}</li>
                ))}
              </ul>
            )}
            {confirming ? (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs">
                  {confirming === "apply"
                    ? "This writes the traffic-flow settings and one export target to the live router over its API, then reads them back. Nothing else on the router is changed."
                    : "This removes the platform's export target from the live router and switches export off, then reads back that it is gone. Data already collected stays until it ages out."}
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
                <MButton disabled={applyBlocked || busy} onClick={() => setConfirming("apply")}>
                  {write.apply.isPending
                    ? "Writing…"
                    : configured
                      ? "Re-apply and verify"
                      : "Apply"}
                </MButton>
                <MButton
                  variant="outline"
                  disabled={applyBlocked || busy}
                  onClick={() => void check()}
                >
                  {write.dryRun.isPending ? "Reading…" : "Dry run (read only)"}
                </MButton>
                {configured && !unsupported && (
                  <MButton
                    variant="outline"
                    disabled={!canApply || busy}
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
              <MTag label={state.label} tone={state.tone} />
              <span className="text-xs text-muted-foreground">
                {st?.vendor ?? "Unknown vendor"}
                {d.routeros_version ? ` · RouterOS ${d.routeros_version}` : ""}
                {d.desired?.src_address ? ` · tunnel ${d.desired.src_address}` : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{state.detail}</p>
          </section>

          {lastWrite && (
            <section
              className={
                lastWrite.result.ok === true
                  ? "space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs"
                  : "space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
              }
            >
              <p className="font-medium">
                Last write from this screen:{" "}
                {writeVerdictMessage(lastWrite.op, lastWrite.result).text}
              </p>
              {lastWrite.result.state && (
                <p className="text-muted-foreground">
                  State after the read-back: {flowState(lastWrite.result.state).label}.
                  {lastWrite.op === "apply" && lastWrite.result.ok === true
                    ? " A verified write is not proof of data; the router reads Receiving only once a window has arrived."
                    : ""}
                </p>
              )}
              {(lastWrite.result.writes ?? []).length === 0 && lastWrite.result.ok === true && (
                <p className="text-muted-foreground">
                  The router already matched; nothing was written.
                </p>
              )}
            </section>
          )}

          {dryRun && (
            <section className="space-y-1.5 rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">{dryRunSummary(dryRun)}</p>
              {(dryRun.planned_writes ?? []).length > 0 && (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">
                  {(dryRun.planned_writes ?? []).join("\n")}
                </pre>
              )}
              {(dryRun.differences ?? []).map((m) => (
                <p key={m} className="text-muted-foreground">
                  {m}
                </p>
              ))}
            </section>
          )}

          {st && (
            <section className="space-y-1 rounded-lg border border-border p-3 text-xs">
              <p>
                <span className="text-muted-foreground">Last data: </span>
                {lastDataLabel(st, now)}
              </p>
              <p>
                <span className="text-muted-foreground">Windows in the last hour: </span>
                {windowsLastHourLabel(st, windowSeconds)}
              </p>
              {d.desired && (
                <p>
                  <span className="text-muted-foreground">Sends to: </span>
                  {d.desired.target_host}:{d.desired.target_port} ({d.desired.version}, UDP, inside
                  the tunnel)
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Switched on by Wyfy: </span>
                {st.configured ? formatAgo(st.configured_at, now) : "no"}
              </p>
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">Last read-back: </span>
                <MTag
                  label={verdictLabel(st.last_verdict_ok).label}
                  tone={verdictLabel(st.last_verdict_ok).tone}
                />
                {st.last_verified_at && (
                  <span className="text-muted-foreground">
                    {formatAgo(st.last_verified_at, now)}
                  </span>
                )}
              </p>
              {st.last_verdict_detail && st.last_verdict_ok === false && (
                <p className="font-mono text-[11px] text-destructive">{st.last_verdict_detail}</p>
              )}
            </section>
          )}

          {paste && (
            <ScriptBlock
              title="Paste script (RouterOS terminal)"
              text={paste}
              note={`The same configuration Apply writes. A pasted router is not switched on here: ${TRAFFIC_FLOW_MODULE_NAME} tracks it only after Apply has run once and read it back.`}
            />
          )}
          {removal && (
            <ScriptBlock
              title="Removal script (RouterOS terminal)"
              text={removal}
              note="Undoes the paste script by hand. Remove does the same over the API and reads back the result."
            />
          )}
          {!paste && !unsupported && (
            <p className="text-xs text-muted-foreground">
              The platform rendered no paste script for this router (it has no tunnel to send
              through).
            </p>
          )}
        </div>
      )}
    </MDrawer>
  );
}

function ScriptBlock({ title, text, note }: { title: string; text: string; note: string }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold">{title}</h4>
        <MButton
          variant="ghost"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(text)
              .then(() => toast.success("Script copied."))
              .catch(() => toast.error("Couldn't copy. Select the text instead."));
          }}
        >
          <Copy /> Copy
        </MButton>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">
        {text}
      </pre>
      <p className="text-[11px] text-muted-foreground">{note}</p>
    </section>
  );
}
