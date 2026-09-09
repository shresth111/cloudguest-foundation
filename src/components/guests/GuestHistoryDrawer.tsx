import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RightDrawer } from "@/components/ui-ext/RightDrawer";
import { GuestAuthMethodBadge, GuestSessionStatusBadge } from "@/components/guests/GuestBadges";
import { useWorkspaceGuest, useWorkspaceGuestHistory } from "@/hooks/useWorkspaceGuests";
import { maskEmail, maskMac, maskPhone } from "@/lib/masking";
import { cn } from "@/lib/utils";
import type { GuestSession } from "@/types/guest";

/**
 * The venue (workspace + Users page) guest detail: identity header + the
 * guest's connection history log. QA: "on click of a user we should get
 * details of the user, similar to a log of its connections."
 *
 * Data is org-scoped (X-Organization-Id) via `useWorkspaceGuests` -- never
 * the hub's GLOBAL fan-out -- and the history list is the server-side
 * `guest_id` filter on GET /guest-sessions, so it paginates with a real
 * total and shows the guest's whole story (the per-page reconnect merge on
 * the Users table cannot see across page boundaries; this can).
 *
 * `seed` covers the demo/masked path where a row has no usable guestId
 * (demo mode) or the fetch is still the clicked row itself: render the
 * row's own card instead of a blank drawer. `masked` narrows identifiers
 * further client-side for masked accounts (the backend already masks at
 * the source for those accounts; this drawer never unmasks).
 */
export interface GuestRowSeed {
  guestId: string | null;
  title: string;
  subtitle?: string;
  meta?: string[];
}

interface GuestHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string | null;
  organizationId?: string;
  locationId?: string;
  /** Prefer the whole-org history when a guest spans locations. */
  seed?: GuestRowSeed | null;
  masked?: boolean;
  sessionActions?: {
    onDisconnect: (sessionId: string) => void;
    onExtend: (sessionId: string, minutes: number) => void;
  };
}

function maskIdentifier(identifier: string): string {
  if (identifier.includes("@")) return maskEmail(identifier);
  if (identifier.startsWith("+")) return maskPhone(identifier);
  return identifier;
}

export function GuestHistoryDrawer({
  open,
  onOpenChange,
  guestId,
  organizationId,
  locationId,
  seed,
  masked = false,
  sessionActions,
}: GuestHistoryDrawerProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const guestQuery = useWorkspaceGuest(organizationId, guestId);
  const historyQuery = useWorkspaceGuestHistory({
    guestId: guestId ?? "",
    organizationId,
    locationId,
    page,
    pageSize,
  });

  // No usable guest id (demo rows, sessions with no guest join): show the
  // clicked row as a static card rather than an empty/erroring drawer.
  const isFallback = !guestId;
  const guest = guestQuery.data ?? null;
  const history = historyQuery.data;

  const name = guest ? (guest.displayName ?? guest.identifier) : (seed?.title ?? "Guest");
  const subtitle = guest
    ? maskIdentifier(guest.identifier)
    : (seed?.subtitle ?? "Connection details");

  const renderFallback = (fallback: GuestRowSeed) => (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{fallback.title}</p>
      {fallback.subtitle && <p className="text-sm text-muted-foreground">{fallback.subtitle}</p>}
      {(fallback.meta ?? []).map((line) => (
        <p key={line} className="text-sm text-muted-foreground">
          {line}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        Full connection history is unavailable for this session.
      </p>
    </div>
  );

  const headerBadges = guest ? (
    <div className="flex flex-wrap items-center gap-2">
      {guest.isBlocked ? (
        <Badge variant="destructive">Blocked</Badge>
      ) : (
        <Badge variant="outline">Active guest</Badge>
      )}
      <Badge variant="secondary">{guest.totalVisitCount} total visits</Badge>
    </div>
  ) : null;

  const metaLines = guest
    ? [
        `First seen: ${new Date(guest.firstSeenAt).toLocaleString()}`,
        `Last seen: ${new Date(guest.lastSeenAt).toLocaleString()}`,
        ...(guest.macAddresses.length > 0
          ? [`Devices: ${guest.macAddresses.map((m) => (masked ? maskMac(m) : m)).join(", ")}`]
          : []),
      ]
    : undefined;

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      description={subtitle}
      size="xl"
      footer={
        history && history.total > pageSize ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {history.total} connections · page {page}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * pageSize >= history.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {isFallback && seed ? (
          renderFallback(seed)
        ) : (
          <>
            {guestQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading guest…
              </div>
            ) : guestQuery.isError ? (
              <p className="text-sm text-destructive">
                Could not load this guest.{" "}
                <button type="button" className="underline" onClick={() => guestQuery.refetch()}>
                  Retry
                </button>
              </p>
            ) : (
              <div className="space-y-3">
                {headerBadges}
                <div className="space-y-1 text-sm text-muted-foreground">
                  {(metaLines ?? []).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Connection history</h3>
              {historyQuery.isLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading connections…
                </div>
              ) : historyQuery.isError ? (
                <p className="text-sm text-destructive">
                  Could not load connections.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => historyQuery.refetch()}
                  >
                    Retry
                  </button>
                </p>
              ) : history && history.rows.length > 0 ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Started</th>
                        <th className="px-3 py-2 font-medium">Ended</th>
                        <th className="px-3 py-2 font-medium">Method</th>
                        <th className="px-3 py-2 font-medium">Device</th>
                        <th className="px-3 py-2 font-medium">Data</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {history.rows.map((s: GuestSession) => (
                        <ConnectionRow
                          key={s.id}
                          session={s}
                          masked={masked}
                          sessionActions={sessionActions}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  No connections on record for this guest.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </RightDrawer>
  );
}

function ConnectionRow({
  session,
  masked,
  sessionActions,
}: {
  session: GuestSession;
  masked: boolean;
  sessionActions?: GuestHistoryDrawerProps["sessionActions"];
}) {
  const canAct = sessionActions && session.status === "active";
  const dataMb = (session.bytesUploaded + session.bytesDownloaded) / 1e6;
  return (
    <tr className={cn("border-t first:border-t-0")}>
      <td className="whitespace-nowrap px-3 py-2">
        {new Date(session.startedAt).toLocaleString()}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {session.endedAt ? new Date(session.endedAt).toLocaleString() : "—"}
      </td>
      <td className="px-3 py-2">
        <GuestAuthMethodBadge method={session.authMethod} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
        {session.deviceMac ? (masked ? maskMac(session.deviceMac) : session.deviceMac) : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2">{dataMb.toFixed(1)} MB</td>
      <td className="px-3 py-2">
        <GuestSessionStatusBadge status={session.status} />
      </td>
      <td className="px-3 py-2 text-right">
        {canAct ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sessionActions!.onExtend(session.id, 30)}
            >
              Extend
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => sessionActions!.onDisconnect(session.id)}
            >
              Disconnect
            </Button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
