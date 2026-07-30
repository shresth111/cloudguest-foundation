import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  Search, Power, RefreshCw, ArrowUpCircle, RotateCcw, Network, Shield, Waypoints,
  MapPinned, ScrollText, TerminalSquare, Router as RouterIcon, Loader2, Copy, FileCode2,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MSectionHeader, MSeg, MTag, MTable, MTh, MTd, MTr, MDrawer, MButton,
} from "@/components/master/MasterKit";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { routerService } from "@/services/router.service";
import { isDemo } from "@/services/customer.service";
import { useGenerateProvisioningToken } from "@/hooks/useRouters";
import { buildRouterSetupScript } from "@/components/routers/RouterDetailTabs";
import api from "@/services/api";
import type { AppError } from "@/services/api";
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

const inputCls =
  "w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary";

/** One-paste MikroTik setup: fetches a provisioning token, checks the
 * router in immediately (dashboard-side, so the agent credential is known
 * up front), and renders a ready-to-paste RouterOS script -- see
 * buildRouterSetupScript's own doc comment for exactly what it covers. */
// Single shared-tenant RADIUS/WireGuard control plane -- see
// RouterSetupScriptPanel's own comment on why these are constants rather
// than per-router secrets today.
const RADIUS_SERVER_ADDRESS = "20.219.72.235";
const WG_AGENT_URL = "http://20.219.72.235:9091/wg/peer";
const WG_AGENT_SECRET = "wgagent-7a647fb42b822aa44cb2da2092a4b79a";
const RADIUS_AGENT_URL = "http://20.219.72.235:9092/radius/client";
const RADIUS_AGENT_SECRET = "radiusagent-f37ae8fca1db9695975657196ea19b2e";

function RouterSetupScriptPanel({ router }: { router: RouterDevice }) {
  const generate = useGenerateProvisioningToken();
  const [busy, setBusy] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [ispCount, setIspCount] = useState<1 | 2 | 3>(1);
  const [wanIfs, setWanIfs] = useState<string[]>(["ether1", "ether2", "ether3"]);
  const [enableFirewall, setEnableFirewall] = useState(true);
  const [enableWireguard, setEnableWireguard] = useState(false);
  const [enableRadius, setEnableRadius] = useState(false);
  const [form, setForm] = useState({
    lanBridge: "bridge",
    lanIp: "192.168.88.1",
    lanCidr: "24",
    dnsServers: "8.8.8.8,1.1.1.1",
    hsUser: "guest",
    hsPass: "welcome123",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setWanIf(idx: number, value: string) {
    setWanIfs((arr) => arr.map((v, i) => (i === idx ? value : v)));
  }

  async function onGenerate() {
    setBusy(true);
    setScript(null);
    try {
      const { token } = await generate.mutateAsync(router.id);
      const checkinResp = await api.post<{ agent_credential?: string }>(
        "/routers/provisioning/check-in",
        { token },
      );
      const agentCredential = checkinResp.data.agent_credential;
      if (!agentCredential) {
        toast.error("Check-in succeeded but no agent credential was returned.");
        return;
      }

      // Allocates a fresh keypair + the next free tunnel IP server-side --
      // this dashboard never generates or sees a WireGuard private key
      // it didn't just mint for this specific router.
      let wireguard: import("@/components/routers/RouterDetailTabs").WireguardPeerInfo | undefined;
      if (enableWireguard) {
        const wgResp = await fetch(WG_AGENT_URL, {
          method: "POST",
          headers: { "X-Agent-Secret": WG_AGENT_SECRET },
        });
        if (!wgResp.ok) throw new Error("WireGuard peer allocation failed");
        const wg = await wgResp.json();
        wireguard = {
          routerPrivateKey: wg.router_private_key,
          serverPublicKey: wg.server_public_key,
          routerTunnelIp: wg.router_tunnel_ip,
          serverEndpointHost: wg.server_endpoint_host,
          serverEndpointPort: wg.server_endpoint_port,
          tunnelSubnet: wg.tunnel_subnet,
        };
      }

      // Gives this router its own genuine NAS identity -- resolved
      // dynamically server-side via %{client:shortname}/%{client:backend_secret}
      // per-client blocks in FreeRADIUS, not one shared identifier for
      // every router. Needs the tunnel IP WireGuard just allocated, so
      // RADIUS implies WireGuard (enforced by the checkbox below).
      let radius: { serverAddress: string; sharedSecret: string } | undefined;
      if (enableRadius && wireguard) {
        let nasIdentifier: string;
        let sharedSecret: string;
        try {
          const existing = await api.get<{ id: string; nas_identifier: string }>(
            `/routers/${router.id}/nas`,
          );
          nasIdentifier = existing.data.nas_identifier;
          const regen = await api.post<{ shared_secret: string }>(
            `/radius/nas/${existing.data.id}/regenerate-secret`,
          );
          sharedSecret = regen.data.shared_secret;
        } catch {
          const created = await api.post<{ nas_identifier: string; shared_secret: string }>(
            "/radius/nas",
            { router_id: router.id, nas_identifier: `cg-${router.id.slice(0, 8)}` },
          );
          nasIdentifier = created.data.nas_identifier;
          sharedSecret = created.data.shared_secret;
        }
        const radiusAgentResp = await fetch(RADIUS_AGENT_URL, {
          method: "POST",
          headers: { "X-Agent-Secret": RADIUS_AGENT_SECRET, "Content-Type": "application/json" },
          body: JSON.stringify({
            tunnel_ip: wireguard.routerTunnelIp,
            nas_identifier: nasIdentifier,
            secret: sharedSecret,
          }),
        });
        if (!radiusAgentResp.ok) throw new Error("RADIUS client registration failed");
        radius = { serverAddress: RADIUS_SERVER_ADDRESS, sharedSecret };
      }

      setScript(
        buildRouterSetupScript({
          apiBase: api.defaults.baseURL || "",
          agentCredential,
          wanIfs: wanIfs.slice(0, ispCount),
          enableFirewall,
          wireguard,
          radius,
          ...form,
        }),
      );
      toast.success("Script ready");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to generate setup script");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FileCode2 className="h-3.5 w-3.5" /> Setup Script -- 1-shot MikroTik configuration
      </p>
      <p className="text-xs text-muted-foreground">
        WAN internet (1-3 ISP, DHCP, failover if 2+), LAN bridge, Hotspot, basic firewall aur
        platform check-in + heartbeat -- ek hi script me. WAN IP khud DHCP se milegi.
      </p>

      <div className="flex gap-1.5">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setIspCount(n)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${ispCount === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-accent"}`}
          >
            {n} ISP{n > 1 ? "s" : ""}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {wanIfs.slice(0, ispCount).map((v, idx) => (
          <div key={idx}>
            <label className="mb-1 block text-[11px] text-muted-foreground">WAN {idx + 1} interface</label>
            <input className={inputCls} value={v} onChange={(e) => setWanIf(idx, e.target.value)} placeholder={`ether${idx + 1}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">LAN bridge name</label>
          <input className={inputCls} value={form.lanBridge} onChange={(e) => set("lanBridge", e.target.value)} placeholder="bridge" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">LAN IP</label>
          <input className={inputCls} value={form.lanIp} onChange={(e) => set("lanIp", e.target.value)} placeholder="192.168.88.1" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">LAN CIDR</label>
          <input className={inputCls} value={form.lanCidr} onChange={(e) => set("lanCidr", e.target.value)} placeholder="24" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">DNS servers</label>
          <input className={inputCls} value={form.dnsServers} onChange={(e) => set("dnsServers", e.target.value)} placeholder="8.8.8.8,1.1.1.1" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Hotspot username</label>
          <input className={inputCls} value={form.hsUser} onChange={(e) => set("hsUser", e.target.value)} placeholder="guest" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Hotspot password</label>
          <input className={inputCls} value={form.hsPass} onChange={(e) => set("hsPass", e.target.value)} placeholder="welcome123" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={enableFirewall} onChange={(e) => setEnableFirewall(e.target.checked)} className="h-3.5 w-3.5 rounded border-input" />
          Basic firewall rules bhi lagao
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={enableWireguard}
            onChange={(e) => {
              setEnableWireguard(e.target.checked);
              if (!e.target.checked) setEnableRadius(false);
            }}
            className="h-3.5 w-3.5 rounded border-input"
          />
          WireGuard tunnel bhi banao (platform se remote reachability)
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={enableRadius}
            onChange={(e) => {
              setEnableRadius(e.target.checked);
              if (e.target.checked) setEnableWireguard(true);
            }}
            className="h-3.5 w-3.5 rounded border-input"
          />
          RADIUS bhi on karo (isko unique NAS identity ke liye WireGuard tunnel IP chahiye -- WireGuard apne aap on ho jayega)
        </label>
      </div>

      <MButton variant="primary" onClick={onGenerate} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
        {busy ? "Generating..." : "Generate script"}
      </MButton>

      {script && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Router ke WinBox New Terminal me paste karo</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(script);
                toast.success("Copied");
              }}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-2.5 text-[10px] leading-snug">
            <code>{script}</code>
          </pre>
        </div>
      )}
    </div>
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
  const [rebootTarget, setRebootTarget] = useState<RouterDevice | null>(null);
  const [rebooting, setRebooting] = useState(false);
  const demo = isDemo();

  const confirmReboot = async () => {
    if (!rebootTarget) return;
    setRebooting(true);
    try {
      await routerService.reboot(rebootTarget.id);
      toast.success(`${rebootTarget.name}: reboot command sent — back online in ~1-2 minutes`);
    } catch (err) {
      toast.error((err as AppError).message || "Could not reach the device to reboot it");
    } finally {
      setRebooting(false);
      setRebootTarget(null);
    }
  };

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
                Restart/Upgrade/Sync Config aren't wired to real device control yet -- use Device
                Console for those. Reboot is real.
              </p>
            )}

            {!demo && <RouterSetupScriptPanel router={sel} />}

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Power &amp; Firmware</p>
              <div className="grid grid-cols-2 gap-2">
                <ControlButton icon={RotateCcw} label="Restart" disabled={!demo} onClick={() => act(`${sel.name}: restart queued`)} />
                <ControlButton icon={Power} label="Reboot" onClick={() => (demo ? act(`${sel.name}: reboot queued`) : setRebootTarget(sel))} />
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

      <AlertDialog open={!!rebootTarget} onOpenChange={(o) => !o && !rebooting && setRebootTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reboot {rebootTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately restarts the physical device. Every guest currently connected at{" "}
              {rebootTarget?.locationName} will be disconnected, and the router will be
              unreachable for its normal 1-2 minute boot cycle. Use with caution — this cannot be
              undone once sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rebooting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmReboot();
              }}
              disabled={rebooting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rebooting ? "Rebooting…" : "Reboot device"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MasterShell>
  );
}
