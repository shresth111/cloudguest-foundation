import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Loader2, RotateCw } from "lucide-react";
import { RightDrawer } from "@/components/ui-ext/RightDrawer";
import { EmptyState } from "@/components/common/EmptyState";
import { resolveOrgId } from "@/services/customer.service";
import { guestDeviceEventsService } from "@/services/guestDeviceEvents.service";
import {
  DEVICE_EVENTS_FOOTNOTE,
  coverageState,
  deviceEventLabel,
  heldBackNote,
} from "@/lib/guest-device-events-presentation";
import { maskMac } from "@/lib/masking";

/**
 * Guest Connection Records -> a session row -> "Device events".
 *
 * Shows only what the backend linked to this one session: time, event, IP,
 * MAC. Never raw router log lines, never other guests' events, never router
 * admin/firewall/system events -- the endpoint does not return them. Raw
 * Device Logs stay in the Master console.
 *
 * Three honest outcomes besides the list: the router doesn't send logs (or
 * didn't yet during this session), it did and nothing was linked, or the
 * read failed -- each says which.
 */
export function GuestSessionDeviceEventsDrawer({
  sessionId,
  sessionLabel,
  masked = true,
  onClose,
}: {
  /** null = closed. */
  sessionId: string | null;
  /** Shown under the title, e.g. "Started 07-10-2026 14:02". */
  sessionLabel?: string;
  masked?: boolean;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["guest-session-device-events", sessionId],
    queryFn: async () => {
      const orgId = await resolveOrgId();
      return guestDeviceEventsService.forSession(sessionId as string, orgId);
    },
    enabled: sessionId !== null,
    retry: false,
    staleTime: 30_000,
  });

  return (
    <RightDrawer
      open={sessionId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Device events"
      description={sessionLabel ?? "What the venue's router logged about this session's device."}
      size="md"
    >
      {query.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading device events…
        </div>
      )}

      {query.isError && (
        <div className="space-y-3">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load device events"
            description="The request failed, so nothing is known either way. Try again in a moment."
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              <RotateCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </div>
      )}

      {query.data && <DeviceEventsBody data={query.data} masked={masked} />}
    </RightDrawer>
  );
}

function DeviceEventsBody({
  data,
  masked,
}: {
  data: Parameters<typeof coverageState>[0];
  masked: boolean;
}) {
  const state = coverageState(data);
  const held = heldBackNote(data.ambiguous_count);
  return (
    <div className="space-y-4">
      {state.kind === "events" ? (
        <ol className="divide-y rounded-xl border" aria-label="Device events for this session">
          {data.events.map((e, i) => (
            <li key={`${e.occurred_at}-${e.kind}-${i}`} className="grid gap-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">{deviceEventLabel(e)}</span>
                <time
                  dateTime={e.occurred_at}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {new Date(e.occurred_at).toLocaleString()}
                </time>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                <span>IP {e.ip_address}</span>
                {e.mac_address && (
                  <span>MAC {masked ? maskMac(e.mac_address) : e.mac_address}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState icon={Info} title={state.title} description={state.description} />
      )}
      {held && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{held}</span>
        </p>
      )}
      {data.coverage === "covered" && (
        <p className="text-xs text-muted-foreground">{DEVICE_EVENTS_FOOTNOTE}</p>
      )}
    </div>
  );
}
