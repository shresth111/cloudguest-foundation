/**
 * Per-guest disconnect for an Omada venue, on the row the operator is
 * already looking at.
 *
 * WHERE THIS SITS AND WHY
 * -----------------------
 * The Guests page live-session row menu. Two reasons, one of them a bug:
 *
 *   1. It is where an operator already goes to end someone's access.
 *   2. The "Disconnect" already in that menu ends our own GuestSession and
 *      issues the RADIUS/CoA disconnect for the venue's *other* enforcement
 *      path. On an Omada venue that closes our row and leaves the
 *      controller forwarding the guest's traffic. Offering the controller
 *      action anywhere but next to it would leave the incomplete one as the
 *      obvious choice.
 *
 * The alternative home -- the Connected Clients table on the Network
 * Integrations page -- is wrong twice: that table is fed by the Open API
 * client list, so on a `legacy` hotspot-operator integration (the mode this
 * disconnect actually works best in, and the one this fleet runs) it is
 * empty. A control that only appears where it cannot be used is not a
 * control.
 *
 * MIKROTIK RENDERS UNCHANGED
 * --------------------------
 * `useVenueIntegration` returns `null` for any venue with no Omada
 * integration, and this component returns `null` before it emits a single
 * element. A MikroTik venue's row menu is byte-identical to what it was.
 * Nothing here imports, wraps or re-styles the existing Disconnect or
 * Terminate items.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOmadaDisconnect, useVenueIntegration } from "@/hooks/useOmadaDisconnect";
import {
  DISCONNECT_REASON_MAX_LENGTH,
  describeDisconnectFailure,
  describeDisconnectResult,
} from "@/lib/omada-disconnect";
import type { DisconnectVerdict } from "@/lib/omada-disconnect";
import type { GuestSession } from "@/types/guest";

function guestLabel(session: GuestSession): string {
  return session.guestIdentifier?.trim() || "This guest";
}

/**
 * The row-menu entry. Renders nothing at all unless this venue has an Omada
 * controller AND we hold a MAC for the device -- the request is addressed
 * by MAC, so without one there is nothing to send and a disabled item would
 * only invite a support ticket we cannot answer.
 */
export function OmadaDisconnectMenuItem({
  session,
  onSelect,
}: {
  session: GuestSession;
  onSelect: (session: GuestSession) => void;
}) {
  const integration = useVenueIntegration(session.locationId);
  if (!integration || !session.deviceMac) return null;

  return (
    <DropdownMenuItem onClick={() => onSelect(session)}>
      <WifiOff className="h-4 w-4" />
      <span className="ml-2">End access on controller</span>
    </DropdownMenuItem>
  );
}

const TONE_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
} as const;

const TONE_CLASS = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
} as const;

/** Exported so `scripts/test-omada-disconnect-render.mjs` can prove each
 *  verdict's copy actually reaches the markup -- the result phase is behind
 *  a mutation, which a static render cannot click through. */
export function DisconnectVerdictBody({ verdict }: { verdict: DisconnectVerdict }) {
  const Icon = TONE_ICON[verdict.tone];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${TONE_CLASS[verdict.tone]}`} />
        <p className="font-medium leading-snug">{verdict.title}</p>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        {verdict.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

/**
 * Confirm, then report. One dialog with two phases rather than a toast,
 * because the answer has more in it than a toast can carry honestly -- the
 * lapsed-grant success in particular needs a sentence, and a green toast
 * saying "Disconnected" is precisely the collapse of three facts into one
 * that this feature exists to stop.
 */
export function OmadaDisconnectDialog({
  session,
  onClose,
}: {
  session: GuestSession | null;
  onClose: () => void;
}) {
  const integration = useVenueIntegration(session?.locationId ?? null);
  const disconnect = useOmadaDisconnect();
  const [reason, setReason] = useState("");
  const [verdict, setVerdict] = useState<DisconnectVerdict | null>(null);

  // A fresh target is a fresh decision: never show the previous guest's
  // answer over this guest's name.
  useEffect(() => {
    if (session) {
      setReason("");
      setVerdict(null);
    }
  }, [session]);

  if (!session) return null;

  const run = () => {
    if (!integration) return;
    disconnect.mutate(
      { integrationId: integration.id, clientMac: session.deviceMac ?? "", reason },
      {
        onSuccess: (result) => setVerdict(describeDisconnectResult(result)),
        onError: (error) =>
          setVerdict(
            describeDisconnectFailure(error as { status: number | null; message?: string }),
          ),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {verdict ? (
          <>
            <DialogHeader>
              <DialogTitle>End access</DialogTitle>
              <DialogDescription>
                {guestLabel(session)} at {session.locationName}
              </DialogDescription>
            </DialogHeader>
            <DisconnectVerdictBody verdict={verdict} />
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>End this guest's access?</DialogTitle>
              <DialogDescription>
                {guestLabel(session)} will be taken off the Wi-Fi at {session.locationName} now.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                {/* The single most important sentence in this feature. */}
                <p>
                  This ends the session they are in. The guest can open the sign-in page and connect
                  again straight away — it is not a ban, and nothing is blocked.
                </p>
                <p>
                  Device <span className="font-mono text-foreground">{session.deviceMac}</span>, on{" "}
                  {integration?.name ?? "this venue's controller"}.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="omada-disconnect-reason">Reason (optional)</Label>
                <Input
                  id="omada-disconnect-reason"
                  value={reason}
                  maxLength={DISCONNECT_REASON_MAX_LENGTH}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Recorded for staff — the guest never sees it"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={disconnect.isPending}>
                Cancel
              </Button>
              <Button onClick={run} disabled={disconnect.isPending || !integration}>
                {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                End access
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
