import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  Search, Power, RefreshCw, ArrowUpCircle, RotateCcw, Network, Shield, Waypoints,
  MapPinned, ScrollText, TerminalSquare, Router as RouterIcon, Loader2,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MSectionHeader, MSeg, MTag, MTable, MTh, MTd, MTr, MDrawer, MButton,
} from "@/components/master/MasterKit";
import { routerService } from "@/services/router.service";
import { isDemo } from "@/services/customer.service";
import type { RouterDevice } from "@/types/router";

export const Route = createFileRoute("/master/routers")({
  // Same pattern as master.customers.tsx's `open` -- MasterSearch (the
  // header's real platform search) has nowhere to deep-link a router to but
  // this list's own local-state drawer (`sel` below), so it hands in the
  // router id here and this auto-selects it once the real fleet has loaded.
  validateSearch: z.object({ open: z.string().optional() }),
  component: RouterFleetScreen,
});

type Filter = "all" | "online" | "degraded" | "offline";

/** Real router.status values collapse to this table's 3-way filter --
 * "degraded" covers everything that isn't cleanly online or fully offline
 * (provisioning, suspended, an unhealthy health check, etc.). */
function displayStatus(r: RouterDevice): "online" | "degraded" | "offline" {
  if (r.status === "offline" || r.status === "decommissioned") return "offline";
  if (r.status === "online" && r.healthStatus !== "unhealthy") return "online";
  return "degraded";
}

function timeAgo(iso: string | null): string {
  // Honestly still means "no check-in has ever been recorded" -- every real
  // router on this platform is in this state today, since none has yet
  // completed the router-agent enrollment/heartbeat flow (confirmed against
  // real data: 0 rows in `heartbeat_logs`, every real `Router` row has a
  // NULL `last_seen_at`). "Awaiting first check-in" reads as the expected,
  // pre-connection state a freshly-provisioned router sits in rather than
  // as a dead/broken one -- without inventing a check-in that never
  // happened.
  if (!iso) return "Awaiting first check-in";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function ControlButton({ icon: Icon, label, onClick, disabled }: { icon: typeof Power; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Real device control isn't wired up yet -- use Device Console for real commands." : undefined}
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-background"
    >
      <Icon className="h-4 w-4 text-primary" /> {label}
    </button>
  );
}

function RouterFleetScreen() {
  const navigate = useNavigate();
  const { open: openRouterId } = Route.useSearch();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<RouterDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const demo = isDemo();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { rows } = await routerService.list({ page: 1, pageSize: 200 });
        setRouters(rows);
      } catch {
        toast.error("Could not load the router fleet from the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!openRouterId || routers.length === 0) return;
    const match = routers.find((r) => r.id === openRouterId);
    if (match) setSel(match);
    navigate({ to: "/master/routers", search: {}, replace: true });
  }, [openRouterId, routers]);

  const rows = useMemo(
    () =>
      routers
        .filter((r) => (filter === "all" ? true : displayStatus(r) === filter))
        .filter((r) => !q || `${r.name} ${r.managementIpAddress ?? ""} ${r.publicIpAddress ?? ""} ${r.organizationName} ${r.locationName}`.toLowerCase().includes(q.toLowerCase())),
    [routers, filter, q],
  );

  // Real per-router hardware control (restart, reboot, firmware upgrade,
  // VLAN/firewall edits, etc.) has no backend endpoint for isolated
  // one-click actions like these -- the actual mechanism for running real
  // commands against a real router is the Device Console
  // (/master/console's RouterOS command execution). These buttons used to
  // always fire a fake "queued"/"synced" toast for *every* account, real or
  // demo, regardless of whether the selected router was real -- which reads
  // as "the buttons don't work" once you're looking at your own real
  // hardware and nothing actually happens. Kept as a simulated demo
  // experience under isDemo() (same convention as the rest of this
  // console); disabled with an honest explanation for real accounts,
  // pointing at Device Console instead of faking success.
  const act = (msg: string) => toast.success(msg);
  // "pending" on its own reads as stuck/broken -- this status just means
  // the router has been provisioned server-side but has never yet
  // completed its first real check-in (see timeAgo's own doc comment for
  // the real data backing that). Keeps the same amber "in progress" tone
  // (via the explicit `tone="pending"` passed at each call site below),
  // just with honest, less alarming copy.
  const statusLabel = (r: RouterDevice) => (r.status === "pending_provisioning" ? "Awaiting check-in" : r.status);

  return (
    <MasterShell title="Router Fleet">
      <MSectionHeader eyebrow="Infrastructure" title="Router Fleet" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MSeg
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "online", label: "Online" },
            { value: "degraded", label: "Degraded" },
            { value: "offline", label: "Offline" },
          ]}
        />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, IP, customer…" className="w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading router fleet…
        </div>
      ) : (
        <MTable head={<><MTh>Router</MTh><MTh className="hidden md:table-cell">Model</MTh><MTh className="hidden sm:table-cell">Customer</MTh><MTh>RouterOS</MTh><MTh>Last seen</MTh><MTh>Status</MTh></>}>
          {rows.map((r) => (
            <MTr key={r.id} onClick={() => setSel(r)}>
              <MTd>
                <p className="font-semibold">{r.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{r.managementIpAddress ?? r.publicIpAddress ?? "IP not yet assigned"} · {r.locationName}</p>
              </MTd>
              <MTd className="hidden text-sm md:table-cell">{r.model}</MTd>
              <MTd className="hidden text-sm sm:table-cell">{r.organizationName}</MTd>
              <MTd><span className="font-mono text-xs">{r.routerOsVersion ?? "—"}</span></MTd>
              <MTd className="text-xs text-muted-foreground">{timeAgo(r.lastSeenAt)}</MTd>
              <MTd><MTag label={statusLabel(r)} tone={r.status === "pending_provisioning" ? "pending" : undefined} /></MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {routers.length === 0 ? "No routers provisioned yet." : "No routers match your filter."}
        </p>
      )}

      <MDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.name ?? ""}
        subtitle={sel ? `${sel.model} · ${sel.managementIpAddress ?? sel.publicIpAddress ?? "IP not yet assigned"} · ${sel.organizationName} / ${sel.locationName}` : ""}
        footer={sel && (
          demo ? (
            <MButton variant="primary" className="w-full justify-center" onClick={() => act(`Opening remote console for ${sel.name}`)}><TerminalSquare /> Open Remote Console</MButton>
          ) : (
            <Link to="/master/console" className="w-full">
              <MButton variant="primary" className="w-full justify-center"><TerminalSquare /> Open Device Console</MButton>
            </Link>
          )
        )}
      >
        {sel && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border p-2.5 text-center"><p className="text-[11px] font-medium text-muted-foreground">Status</p><p className="text-lg font-semibold capitalize">{statusLabel(sel)}</p></div>
              <div className="rounded-lg border border-border p-2.5 text-center"><p className="text-[11px] font-medium text-muted-foreground">Last seen</p><p className="text-lg font-semibold tabular-nums">{timeAgo(sel.lastSeenAt)}</p></div>
              <div className="rounded-lg border border-border p-2.5 text-center"><p className="text-[11px] font-medium text-muted-foreground">RouterOS</p><p className="text-lg font-semibold">{sel.routerOsVersion ?? "—"}</p></div>
            </div>

            {!demo && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                Quick actions below aren't wired to real device control yet -- use Device Console to run real commands on this router.
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Power &amp; Firmware</p>
              <div className="grid grid-cols-2 gap-2">
                <ControlButton icon={RotateCcw} label="Restart" disabled={!demo} onClick={() => act(`${sel.name}: restart queued`)} />
                <ControlButton icon={Power} label="Reboot" disabled={!demo} onClick={() => act(`${sel.name}: reboot queued`)} />
                <ControlButton icon={ArrowUpCircle} label="Upgrade" disabled={!demo} onClick={() => act(`${sel.name}: firmware upgrade started`)} />
                <ControlButton icon={RefreshCw} label="Sync Config" disabled={!demo} onClick={() => act(`${sel.name}: config synced`)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Network</p>
              <div className="grid grid-cols-2 gap-2">
                <ControlButton icon={Network} label="VLAN & DHCP" disabled={!demo} onClick={() => act("Opening VLAN & DHCP")} />
                <ControlButton icon={Shield} label="Firewall" disabled={!demo} onClick={() => act("Opening firewall rules")} />
                <ControlButton icon={RefreshCw} label="Reset Sessions" disabled={!demo} onClick={() => act(`${sel.name}: sessions reset`)} />
                <ControlButton icon={Waypoints} label="WireGuard" disabled={!demo} onClick={() => act("Opening WireGuard tunnel")} />
                <ControlButton icon={MapPinned} label="Move Location" disabled={!demo} onClick={() => act("Move location")} />
                <ControlButton icon={ScrollText} label="View Logs" disabled={!demo} onClick={() => act(`Fetching logs for ${sel.name}`)} />
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><RouterIcon className="h-3.5 w-3.5" /> Safe business-level operations only.</p>
          </div>
        )}
      </MDrawer>
    </MasterShell>
  );
}
