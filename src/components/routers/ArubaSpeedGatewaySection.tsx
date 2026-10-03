/**
 * Master: "Per-guest speed: MikroTik gateway" on an Aruba Instant On fleet
 * row. Links a Wyfy-managed MikroTik at the same venue as the router that
 * applies each guest's speed (the Aruba + MikroTik hybrid). See
 * `lib/aruba-speed-gateway.ts` for the contract and why it exists.
 *
 * Writes only to Wyfy's own database (the link). Nothing here talks to
 * Instant On or to the MikroTik.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MButton, MTag, M_INPUT } from "@/components/master/MasterKit";
import {
  FEATURE_OFF_COPY,
  HYBRID_WIRING_COPY,
  NO_CANDIDATES_COPY,
  candidateVerdict,
  speedGatewayErrorMessage,
  speedGatewaySummary,
  type SpeedGatewayStatus,
} from "@/lib/aruba-speed-gateway";
import { requestErrorMessage } from "@/services/api";
import { arubaInstantOnService } from "@/services/aruba-instant-on.service";

function speedGatewayQueryKey(routerId: string) {
  return ["master", "aruba-speed-gateway", routerId];
}

export function ArubaSpeedGatewaySection({ routerId }: { routerId: string }) {
  const qc = useQueryClient();
  const key = speedGatewayQueryKey(routerId);
  const status = useQuery({
    queryKey: key,
    queryFn: () => arubaInstantOnService.getSpeedGateway(routerId),
    retry: false,
  });
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);

  async function write(action: () => Promise<SpeedGatewayStatus>, ok: string, fallback: string) {
    setBusy(true);
    try {
      const next = await action();
      qc.setQueryData(key, next);
      setChoice("");
      toast.success(ok);
    } catch (err) {
      toast.error(speedGatewayErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (status.isLoading) {
    body = (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Looking up this venue&rsquo;s speed gateway…
      </p>
    );
  } else if (status.isError || !status.data) {
    body = (
      <p className="text-xs text-destructive">
        {requestErrorMessage(status.error, "The speed gateway setting did not load.")}
      </p>
    );
  } else {
    const s = status.data;
    const selectable = s.candidates.filter((c) => c.routerId !== s.gateway?.routerId);
    body = (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <MTag
            label={s.featureEnabled ? "Feature on" : "Feature off"}
            tone={s.featureEnabled ? "online" : "pending"}
          />
          {s.gateway && (
            <MTag
              label={s.perGuestSpeedActive ? "Per-guest speed live" : "Not applying"}
              tone={s.perGuestSpeedActive ? "online" : "warning"}
            />
          )}
        </div>
        {!s.featureEnabled && (
          <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="speed-gw-off">
            {FEATURE_OFF_COPY}
          </p>
        )}
        <p className="text-xs text-foreground" data-testid="speed-gw-summary">
          {speedGatewaySummary(s)}
        </p>
        {s.gateway && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Gateway: <strong className="text-foreground">{s.gateway.name}</strong>
              {s.gateway.model ? ` · ${s.gateway.model}` : ""}
              {s.gateway.status ? ` · ${s.gateway.status}` : ""}
            </span>
            <MButton
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Unlink this gateway? Wyfy removes the guest speed limits it added on that router, and guests at this venue go back to whatever Instant On sets.",
                  )
                )
                  return;
                void write(
                  () => arubaInstantOnService.unlinkSpeedGateway(routerId),
                  "Speed gateway unlinked",
                  "Could not unlink the gateway — nothing was changed.",
                );
              }}
            >
              Unlink
            </MButton>
          </div>
        )}
        {s.candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="speed-gw-no-candidates">
            {NO_CANDIDATES_COPY}
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <label className="block text-xs text-muted-foreground" htmlFor="speed-gw-select">
                {s.gateway ? "Replace with" : "MikroTik at this location"}
              </label>
              <select
                id="speed-gw-select"
                className={M_INPUT}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="">Choose a MikroTik…</option>
                {selectable.map((c) => {
                  const v = candidateVerdict(c);
                  return (
                    <option key={c.routerId} value={c.routerId} disabled={!v.selectable}>
                      {c.name}
                      {c.model ? ` (${c.model})` : ""}
                      {v.reason ? ` — ${v.reason}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <MButton
              disabled={!choice || busy}
              onClick={() =>
                void write(
                  () => arubaInstantOnService.linkSpeedGateway(routerId, choice),
                  "Speed gateway linked",
                  "Could not link the gateway — nothing was changed.",
                )
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Link
            </MButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="space-y-3 rounded-lg border border-border p-3 text-xs"
      data-testid="aruba-speed-gateway"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Gauge className="h-4 w-4 text-muted-foreground" /> Per-guest speed: MikroTik gateway
      </p>
      <p className="text-muted-foreground">
        Instant On cannot limit each guest&rsquo;s speed. A Wyfy-managed MikroTik in front of the
        access points can. It works only when wired like this:
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
        {HYBRID_WIRING_COPY.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {body}
    </div>
  );
}
