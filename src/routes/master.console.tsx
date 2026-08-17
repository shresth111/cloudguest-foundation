import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { TerminalSquare, Send, AlertTriangle, Loader2 } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MField,
  M_INPUT,
  MButton,
  MTag,
  MDialog,
} from "@/components/master/MasterKit";
import { routerService } from "@/services/router.service";
import { provisioningService, type ConsoleCommandResult } from "@/services/provisioning.service";
import type { RouterDevice } from "@/types/router";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/master/console")({
  component: DeviceConsoleScreen,
});

interface HistoryEntry {
  id: string;
  routerName: string;
  command: string;
  at: string;
  result: ConsoleCommandResult | null;
  error: string | null;
}

function DeviceConsoleScreen() {
  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [loadingRouters, setLoadingRouters] = useState(true);
  const [routerId, setRouterId] = useState("");
  const [command, setCommand] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { rows } = await routerService.list({ page: 1, pageSize: 200 });
        if (!cancelled) setRouters(rows);
      } catch {
        if (!cancelled) toast.error("Could not load routers");
      } finally {
        if (!cancelled) setLoadingRouters(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRouter = routers.find((r) => r.id === routerId) ?? null;
  const canRun = !!selectedRouter && command.trim().length > 0 && !running;

  const runCommand = async () => {
    if (!selectedRouter) return;
    const trimmed = command.trim();
    setConfirming(false);
    setRunning(true);
    const entryId = crypto.randomUUID();
    try {
      const result = await provisioningService.executeConsoleCommand(selectedRouter.id, trimmed);
      setHistory((h) => [
        {
          id: entryId,
          routerName: selectedRouter.name,
          command: trimmed,
          at: new Date().toISOString(),
          result,
          error: null,
        },
        ...h,
      ]);
      if (result.exitStatus !== 0) toast.warning(`Command exited with status ${result.exitStatus}`);
      else toast.success("Command executed");
    } catch (err) {
      const message = (err as AppError).message ?? "Command failed";
      setHistory((h) => [
        {
          id: entryId,
          routerName: selectedRouter.name,
          command: trimmed,
          at: new Date().toISOString(),
          result: null,
          error: message,
        },
        ...h,
      ]);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <MasterShell title="Device Console">
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title="Device Console"
          actions={<MTag label="Super Admin / Network Administrator only" tone="high" />}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <MField label="Target router">
              <select
                className={M_INPUT}
                value={routerId}
                onChange={(e) => setRouterId(e.target.value)}
                disabled={loadingRouters}
              >
                <option value="">{loadingRouters ? "Loading routers…" : "Select a router…"}</option>
                {routers.map((r) => (
                  <option key={r.id} value={r.id} disabled={!r.hasApiCredentials}>
                    {r.name} · {r.locationName} / {r.organizationName}
                    {!r.hasApiCredentials ? " (no credentials)" : ""}
                  </option>
                ))}
              </select>
            </MField>

            <MField label="Command">
              <textarea
                className={`${M_INPUT} min-h-[90px] font-mono text-sm`}
                placeholder="/interface print"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canRun) setConfirming(true);
                }}
              />
            </MField>

            {/* Immediate-effect notice -- same contextual-line pattern used
                elsewhere in the console (see LocationPolicies.tsx/
                BlockUsers.tsx's own "Redesign the immediate-effect warning
                as a contextual line" passes): a slim line right above the
                button it actually concerns, replacing what used to be a
                persistent, page-length amber banner shown on every visit
                regardless of whether a command was about to run. Same real
                warning, just no longer standing page furniture. */}
            <div className="flex flex-col items-end gap-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                Runs immediately, with no undo and no safe-command whitelist — every command is
                audited.
              </p>
              <MButton variant="primary" disabled={!canRun} onClick={() => setConfirming(true)}>
                {running ? <Loader2 className="animate-spin" /> : <Send />} Run Command
              </MButton>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Session history</p>
              {history.length === 0 && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TerminalSquare className="h-4 w-4" /> No commands run yet this session.
                </p>
              )}
              {history.map((h) => (
                <div key={h.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold">{h.command}</p>
                    {h.error ? (
                      <MTag label="Connection failed" tone="offline" />
                    ) : (
                      <MTag
                        label={`exit ${h.result?.exitStatus}`}
                        tone={h.result?.exitStatus === 0 ? "online" : "degraded"}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {h.routerName} · {new Date(h.at).toLocaleTimeString()}
                  </p>
                  {h.error ? (
                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                      {h.error}
                    </pre>
                  ) : (
                    <>
                      {h.result?.stdout && (
                        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
                          {h.result.stdout}
                        </pre>
                      )}
                      {h.result?.stderr && (
                        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                          {h.result.stderr}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Selected router</p>
            {selectedRouter ? (
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{selectedRouter.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedRouter.model} · {selectedRouter.vendor}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedRouter.locationName} / {selectedRouter.organizationName}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {selectedRouter.managementIpAddress ??
                    selectedRouter.publicIpAddress ??
                    "no IP on file"}
                </p>
                <MTag label={selectedRouter.status} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick a router to see its details here.
              </p>
            )}
          </div>
        </div>

        <MDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title="Run this command?"
          footer={
            <>
              <MButton variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </MButton>
              <MButton variant="primary" onClick={runCommand}>
                <Send /> Run on {selectedRouter?.name}
              </MButton>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This will run immediately on{" "}
              <span className="font-semibold text-foreground">{selectedRouter?.name}</span>, with no
              confirmation on the device side.
            </p>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
              {command}
            </pre>
          </div>
        </MDialog>
      </MPageShell>
    </MasterShell>
  );
}
