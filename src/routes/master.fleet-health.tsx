import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, Wifi, Clock, HelpCircle } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MStat,
  MTag,
  MButton,
  MTable,
  MTh,
  MTd,
  MTr,
} from "@/components/master/MasterKit";
import { wireguardService, type FleetPeer, type FleetStatus } from "@/services/wireguard.service";

const STATUS_TAG: Record<FleetPeer["status"], { label: string; tone: string }> = {
  tracked_connected: { label: "Connected", tone: "active" },
  tracked_stale: { label: "Stale", tone: "degraded" },
  untracked_connected: { label: "Untracked (ghost peer)", tone: "critical" },
  tracked_missing_from_hub: { label: "Missing from hub", tone: "offline" },
};

function formatHandshake(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * "Fleet Reconnection" -- the platform's own `wireguard_peers` table
 * compared against the hub's own live `wg show` state, not the table
 * alone. Built after a live incident where the two had drifted sharply
 * (72 peers on the hub, 1 in the database) -- a view built on the
 * database alone would have confidently shown 1 connected router while 72
 * real ones sat on the hub unaccounted for. See
 * `WireGuardService.get_fleet_status`'s own docstring (backend) for the
 * full classification logic this page only renders.
 *
 * `untracked_connected` ("ghost peer") is the one status this page treats
 * as an alert, not routine data -- a real, live tunnel the platform has
 * no record of at all is exactly the drift this page exists to catch,
 * and it is also the "how many of the fleet actually reconnected" signal
 * the AWS hub-migration plan's own cutover sequence calls for before
 * decommissioning the old hub is ever safe to consider.
 */
function FleetHealthScreen() {
  const [status, setStatus] = useState<FleetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setStatus(await wireguardService.getFleetStatus());
    } catch {
      toast.error("Could not reach the WireGuard hub bridge for a live fleet status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const connected = status?.summary.tracked_connected ?? 0;
  const stale = status?.summary.tracked_stale ?? 0;
  const untracked = status?.summary.untracked_connected ?? 0;
  const missing = status?.summary.tracked_missing_from_hub ?? 0;
  // "Expected" = every peer this platform has a record of, whether or not
  // the hub currently confirms it -- the honest denominator for "how much
  // of what we know about has actually reconnected", not inflated by
  // ghost peers the platform never provisioned in the first place.
  const expectedTotal = connected + stale + missing;

  const rows = useMemo(() => status?.peers ?? [], [status]);

  return (
    <MasterShell title="Fleet Reconnection">
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title="Fleet Reconnection"
          actions={
            <MButton variant="outline" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
            </MButton>
          }
        />

        <p className="text-sm text-muted-foreground">
          Live comparison of what this platform has on record against what the WireGuard hub
          itself reports right now -- not the database alone.
        </p>

        {!loading && status && (
          <p className="text-sm font-medium">
            <span className="text-foreground">{connected}</span>
            <span className="text-muted-foreground"> of </span>
            <span className="text-foreground">{expectedTotal}</span>
            <span className="text-muted-foreground"> known routers currently connected</span>
            {untracked > 0 && (
              <span className="ml-2 text-rose-600 dark:text-rose-400">
                · {untracked} untracked peer{untracked === 1 ? "" : "s"} found on the hub
              </span>
            )}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MStat label="Connected" value={String(connected)} icon={Wifi} tone="success" loading={loading} />
          <MStat label="Stale" value={String(stale)} icon={Clock} tone="warning" loading={loading} />
          <MStat
            label="Untracked (ghost peers)"
            value={String(untracked)}
            icon={ShieldAlert}
            tone={untracked > 0 ? "danger" : "default"}
            beam={untracked > 0}
            loading={loading}
          />
          <MStat
            label="Missing from hub"
            value={String(missing)}
            icon={HelpCircle}
            tone={missing > 0 ? "warning" : "default"}
            loading={loading}
          />
        </div>

        <MTable
          loading={loading}
          head={
            <>
              <MTh>Router</MTh>
              <MTh>Status</MTh>
              <MTh className="hidden md:table-cell">Tunnel IP</MTh>
              <MTh className="hidden lg:table-cell">Public key</MTh>
              <MTh>Last handshake</MTh>
            </>
          }
        >
          {!loading &&
            (rows.length === 0 ? (
              <MTr>
                <MTd className="text-center text-muted-foreground" />
                <MTd />
                <MTd className="hidden md:table-cell" />
                <MTd className="hidden lg:table-cell" />
                <MTd />
              </MTr>
            ) : (
              rows.map((peer) => {
                const tag = STATUS_TAG[peer.status];
                const isGhost = peer.status === "untracked_connected";
                return (
                  <MTr
                    key={peer.publicKey}
                    className={isGhost ? "bg-rose-500/5" : undefined}
                  >
                    <MTd>
                      {peer.routerName ?? (
                        <span className="italic text-muted-foreground">Unknown router</span>
                      )}
                    </MTd>
                    <MTd>
                      <MTag label={tag.label} tone={tag.tone} />
                    </MTd>
                    <MTd className="hidden font-mono text-xs md:table-cell">
                      {peer.tunnelIpAddress ?? "—"}
                    </MTd>
                    <MTd className="hidden max-w-[220px] truncate font-mono text-xs lg:table-cell">
                      {peer.publicKey}
                    </MTd>
                    <MTd className="text-sm">{formatHandshake(peer.lastHandshakeAt)}</MTd>
                  </MTr>
                );
              })
            ))}
        </MTable>
        {!loading && rows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No peers reported by either the database or the hub.
          </p>
        )}
      </MPageShell>
    </MasterShell>
  );
}

export const Route = createFileRoute("/master/fleet-health")({
  component: FleetHealthScreen,
});
