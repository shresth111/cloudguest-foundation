import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  Search,
  Power,
  TerminalSquare,
  Router as RouterIcon,
  Loader2,
  Copy,
  FileCode2,
  Globe,
  Download,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Workflow,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MSeg,
  MTag,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  MButton,
  MStat,
} from "@/components/master/MasterKit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { routerService } from "@/services/router.service";
import { isDemo } from "@/services/customer.service";
import { useGenerateProvisioningToken } from "@/hooks/useRouters";
import {
  buildRouterSetupScriptChunks,
  chunksToMarkdown,
  chunksToRouterOsScript,
  chunksToSingleLineScript,
  validateSetupScriptChunks,
  GUEST_PORTAL_PUBLIC_BASE,
  RemoteAccessCard,
} from "@/components/routers/RouterDetailTabs";
import type { RouterSetupScriptValidationResult } from "@/components/routers/RouterDetailTabs";
import api, { getAbsoluteApiBase } from "@/services/api";
import type { AppError } from "@/services/api";
import type { RouterDevice } from "@/types/router";
import { copyToClipboard } from "@/lib/utils";

export const Route = createFileRoute("/master/routers")({
  // Same pattern as master.customers.tsx's `open` -- MasterSearch (the
  // header's real platform search) has nowhere to deep-link a router to but
  // this list's own local-state drawer (`sel` below), so it hands in the
  // router id here and this auto-selects it once the real fleet has loaded.
  // `setup` is the same idea for the other, heavier drill-down: it swaps
  // the whole page into the full-width Setup Script view for that router
  // (see RouterFleetScreen's `setupRouter` below) instead of the lightweight
  // browse drawer -- also real, shareable/bookmarkable deep links, not just
  // internal navigation state.
  validateSearch: z.object({ open: z.string().optional(), setup: z.string().optional() }),
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

function ControlButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Power;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? "Real device control isn't wired up yet -- use Device Console for real commands."
          : undefined
      }
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-background"
    >
      <Icon className="h-4 w-4 text-primary" /> {label}
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary";

/** Matches DeviceVendor in wyfy-device-gateway's contract (PRD section 4.1)
 * -- same string identifiers so this dropdown's value and the backend's
 * Router.vendor column always agree. MikroTik is the only one with a real
 * adapter/setup flow today; every other entry exists so this Master-console
 * screen can honestly say "not yet supported" instead of hiding the
 * hardware a customer actually has. */
const DEVICE_VENDORS: { value: string; label: string }[] = [
  { value: "mikrotik", label: "MikroTik" },
  { value: "tplink_omada", label: "TP-Link Omada" },
  { value: "ruckus", label: "Ruckus" },
  { value: "unifi", label: "UniFi" },
  { value: "aruba", label: "Aruba" },
  { value: "cisco_meraki", label: "Cisco Meraki" },
];

function vendorLabel(value: string): string {
  return DEVICE_VENDORS.find((v) => v.value === value)?.label ?? value;
}

/** Honest empty state for every vendor besides MikroTik -- wyfy-device-gateway
 * (see PRD) only has a real, working adapter for MikroTik today; every other
 * vendor is a stub. Rather than let the one-paste script panel below
 * silently generate a MikroTik-flavored RouterOS script for hardware that
 * isn't MikroTik, this replaces it outright once a different vendor is
 * selected. Real per-vendor provisioning flows are Phase 2+, once a real
 * adapter (e.g. UniFi) exists. */
function VendorNotSupportedPanel({ vendor }: { vendor: string }) {
  const label = vendorLabel(vendor);
  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <FileCode2 className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{label} support is coming soon</p>
      <p className="mx-auto max-w-sm text-xs text-muted-foreground">
        MikroTik is the only supported vendor today -- there's no setup script or provisioning flow
        for {label} hardware yet. Switch the vendor back to MikroTik if this router is actually a
        MikroTik device, or check back once {label} support ships.
      </p>
    </div>
  );
}

/** One-paste MikroTik setup: fetches a provisioning token, checks the
 * router in immediately (dashboard-side, so the agent credential is known
 * up front), and renders a ready-to-paste RouterOS script -- see
 * buildRouterSetupScriptChunks's own doc comment for exactly what it
 * covers. */
// NOTE: the RADIUS server's address baked into the generated RouterOS
// script's `/radius add address=...` line is deliberately NOT a constant
// here anymore -- it used to be the hub's public IP (20.219.72.235),
// confirmed live to leave a router stuck with "RADIUS server is not
// responding" forever at any site whose ISP blocks outbound RADIUS UDP
// (1812/1813) but never touches WireGuard's own single UDP port every
// router already tunnels through. RADIUS requires WireGuard (enforced by
// the checkbox below), so `wireguard.hubTunnelIpAddress` -- the hub's own
// address *inside* that tunnel -- is always available by the time RADIUS
// is wired up, and is what gets used instead. See where `radius` is built
// below.

/** RouterOS API login the platform itself uses for this router's control-plane
 * calls (Device Console, VLAN/DHCP pushes, diagnostics) -- distinct from the
 * heartbeat's `agentCredential`. Generated fresh per router, per script run. */
const API_ACCESS_USERNAME = "cloudguest-api";
function generateApiSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Real IPv4 address -- each octet 0-255, no leading-zero ambiguity issues
 * to worry about here since this only ever gates a toast, not a parser. */
function isValidIpv4(value: string): boolean {
  const octets = value.trim().split(".");
  if (octets.length !== 4) return false;
  return octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

/** A CIDR prefix length, 1-32 -- matches the WAN/LAN validation the QA
 * report flagged as missing (no format check today; a typo only ever
 * surfaces as a bare RouterOS error on-site). 0 is excluded: a /0 default
 * route on a WAN or LAN address is never a real, intended configuration
 * here. */
function isValidCidr(value: string): boolean {
  if (!/^\d{1,2}$/.test(value.trim())) return false;
  const n = Number(value.trim());
  return n >= 1 && n <= 32;
}

/** Every hotspot login this generator has ever shipped as a *placeholder*
 * default (`welcome123`, still the field's own placeholder text) plus the
 * handful of passwords real people reach for first when asked to "just
 * type something" -- the QA report's own finding: a shippable default
 * with zero warning. Not exhaustive password-strength checking (that's a
 * much bigger job); this only catches "you typed the well-known default
 * or something equally guessable," which is the actual reported gap. */
const KNOWN_WEAK_HOTSPOT_PASSWORDS = new Set([
  "welcome123",
  "password",
  "password123",
  "guest",
  "guest123",
  "12345678",
  "123456789",
  "admin",
  "admin123",
  "changeme",
]);

/** Readable random password -- avoids visually ambiguous characters
 * (0/O, 1/l/I) since this may end up read aloud or hand-typed by guest-
 * facing staff, unlike `generateApiSecret`'s pure hex (never seen by a
 * human, only pasted). Pre-fills the hotspot password field so a fresh
 * script never ships the old `welcome123` default un-warned -- see
 * `KNOWN_WEAK_HOTSPOT_PASSWORDS` for the inline warning if someone types
 * a guessable value in anyway. */
function generateHotspotPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function RouterSetupScriptPanel({ router }: { router: RouterDevice }) {
  const generate = useGenerateProvisioningToken();
  const [busy, setBusy] = useState(false);
  const [chunks, setChunks] = useState<
    import("@/components/routers/RouterDetailTabs").RouterSetupScriptChunk[] | null
  >(null);
  const [validation, setValidation] = useState<RouterSetupScriptValidationResult[] | null>(null);
  // Soft step-lock: chunk N+1's Copy button stays disabled until chunk N's
  // has actually been clicked -- these have real ordering dependencies
  // (WAN+Bridge before anything that references the bridge, etc.) but were
  // previously freely clickable in any order with nothing to stop a
  // field engineer from pasting them out of sequence.
  const [copiedChunkIdx, setCopiedChunkIdx] = useState<Set<number>>(new Set());
  const [ispCount, setIspCount] = useState<1 | 2 | 3>(1);
  const [wans, setWans] = useState<import("@/components/routers/RouterDetailTabs").WanEntry[]>([
    { iface: "ether1", mode: "dhcp", ip: "", cidr: "30", gateway: "" },
    { iface: "ether2", mode: "dhcp", ip: "", cidr: "30", gateway: "" },
    { iface: "ether3", mode: "dhcp", ip: "", cidr: "30", gateway: "" },
  ]);
  // Blank (default) keeps the original "every non-WAN port becomes LAN"
  // sweep -- see buildRouterSetupScriptChunks's own `hasExplicitLan`
  // docstring. Filling this in switches to an explicit allowlist: only
  // these interfaces join the LAN bridge, everything else is left alone.
  const [lanIfsRaw, setLanIfsRaw] = useState("");
  const [enableFirewall, setEnableFirewall] = useState(true);
  const [enableWireguard, setEnableWireguard] = useState(false);
  const [enableRadius, setEnableRadius] = useState(false);
  // Only shown/meaningful with 2+ ISPs -- see buildRouterSetupScriptChunks's
  // own WanRoutingMode docstring for why failover-only is a real,
  // structurally simpler alternative, not a stripped-down load-balance.
  const [wanRoutingMode, setWanRoutingMode] = useState<"load_balance" | "failover_only">(
    "load_balance",
  );
  // Higher-level choice than `wanRoutingMode` above (and meaningful even
  // with a single WAN, unlike that toggle) -- see
  // buildRouterSetupScriptChunks's own `basicConfigOnly` docstring for
  // exactly what this drops (WAN Addressing, WAN Routing, Basic Mangle
  // Rules, and the DNS-server-setting half of LAN IP + DNS) versus what it
  // keeps (NAT masquerade + "WAN" interface-list membership still bind to
  // whatever's typed into "WAN N interface" below -- that field stays
  // meaningful and required even in this mode, only the mode-specific
  // static/DHCP/PPPoE fields under it disappear). Defaults to `false` --
  // the full, existing flow -- so nothing about today's default script
  // changes for a technician who never touches this toggle.
  const [basicConfigOnly, setBasicConfigOnly] = useState(false);
  // Ratio inputs are opt-in -- undefined/empty means "even split," the
  // existing, only-ever-generated behavior. Keyed by WAN index (0-2), a
  // plain string so a field can sit legitimately empty while typing.
  const [wanWeightsRaw, setWanWeightsRaw] = useState<Record<number, string>>({});
  const [form, setForm] = useState(() => ({
    lanBridge: "bridge",
    lanIp: "192.168.88.1",
    lanCidr: "24",
    dnsServers: "8.8.8.8,1.1.1.1",
    hsUser: "guest",
    // Pre-filled random, not the old "welcome123" default -- see
    // generateHotspotPassword's own docstring.
    hsPass: generateHotspotPassword(),
  }));

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setWan(
    idx: number,
    patch: Partial<import("@/components/routers/RouterDetailTabs").WanEntry>,
  ) {
    setWans((arr) => arr.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }

  async function onGenerate() {
    // A blank LAN bridge name renders as `:local lanBridge ""` -- every
    // later line that binds something to `$lanBridge` (IP address, DHCP
    // server, hotspot) then fails on the device with "input does not match
    // any value of interface", after already having minted and consumed a
    // provisioning token. Cheaper to block before spending that token.
    if (!form.lanBridge.trim()) {
      toast.error("LAN bridge name can't be empty");
      return;
    }
    if (!isValidIpv4(form.lanIp)) {
      toast.error(`"${form.lanIp}" isn't a valid LAN IP address`);
      return;
    }
    if (!isValidCidr(form.lanCidr)) {
      toast.error(`"${form.lanCidr}" isn't a valid CIDR prefix (1-32)`);
      return;
    }
    // Same "block before spending the token" reasoning as the LAN-bridge
    // check above -- a static WAN with a blank ip/cidr/gateway renders
    // `:local wan1Gw ""`, which the WAN Routing chunk's own `:if ($wan1Gw
    // != "")` guard then silently skips instead of erroring, leaving that
    // WAN with an address but no route at all.
    const activeWans = wans.slice(0, ispCount).map((w, idx) => {
      const raw = wanWeightsRaw[idx]?.trim();
      const weight = raw ? Number(raw) : undefined;
      return weight && weight > 0 ? { ...w, weight } : { ...w, weight: undefined };
    });
    const lanIfs = lanIfsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Every check in this block only makes sense against the mode-specific
    // WAN fields (static IP/CIDR/gateway, PPPoE credentials) -- all hidden,
    // and irrelevant, in `basicConfigOnly` mode (buildRouterSetupScriptChunks
    // never generates "WAN Addressing"/"WAN Routing" there at all, so it
    // never reads any of them). Skipped outright so a WAN whose `mode`
    // happens to still say "static"/"pppoe" from before this toggle was
    // switched on -- fields the technician can no longer even see, let
    // alone fix -- can't block generation with a confusing error.
    if (!basicConfigOnly) {
      const incompleteStaticWan = activeWans.find(
        (w) => w.mode === "static" && (!w.ip?.trim() || !w.cidr?.trim() || !w.gateway?.trim()),
      );
      if (incompleteStaticWan) {
        toast.error(
          `WAN "${incompleteStaticWan.iface}" is set to Static but is missing an IP, CIDR, or gateway`,
        );
        return;
      }
      // Format validation on top of the "not empty" check above -- a typo
      // here used to only ever surface as a bare RouterOS error on-site,
      // after the token above was already spent.
      const malformedStaticWan = activeWans.find(
        (w) =>
          w.mode === "static" &&
          (!isValidIpv4(w.ip ?? "") || !isValidCidr(w.cidr ?? "") || !isValidIpv4(w.gateway ?? "")),
      );
      if (malformedStaticWan) {
        toast.error(
          `WAN "${malformedStaticWan.iface}": check the IP/CIDR/gateway format -- "${malformedStaticWan.ip}/${malformedStaticWan.cidr}" via "${malformedStaticWan.gateway}" doesn't look right`,
        );
        return;
      }
      // Same "block before spending the token" reasoning as the static-WAN
      // checks above -- a PPPoE WAN with a blank username/password renders
      // `/interface pppoe-client add ... user="" password=""`, which the
      // router accepts without complaint and then just never establishes a
      // session, silently, with nothing in this UI to explain why.
      const incompletePppoeWan = activeWans.find(
        (w) => w.mode === "pppoe" && (!w.pppoeUsername?.trim() || !w.pppoePassword?.trim()),
      );
      if (incompletePppoeWan) {
        toast.error(
          `WAN "${incompletePppoeWan.iface}" is set to PPPoE but is missing a username or password`,
        );
        return;
      }
    }
    const lanWanOverlap = lanIfs.find((li) => activeWans.some((w) => w.iface === li));
    if (lanWanOverlap) {
      toast.error(
        `"${lanWanOverlap}" is listed as both a WAN and a LAN interface -- fix before generating`,
      );
      return;
    }
    // Same "every enabled WAN weighted, or none of them" rule the backend's
    // own validate_wan_routing_weights enforces -- checked here too so a
    // half-filled ratio is caught before a token is spent, not silently
    // treated as an even split by the generator (which would make the
    // real on-device ratio depend on which fields happen to be filled in).
    if (!basicConfigOnly && wanRoutingMode === "load_balance" && ispCount > 1) {
      const weightedCount = activeWans.filter((w) => w.weight !== undefined).length;
      if (weightedCount > 0 && weightedCount < activeWans.length) {
        toast.error(
          "Set a bandwidth ratio for every WAN, or leave all of them blank for an even split",
        );
        return;
      }
    }
    setBusy(true);
    setChunks(null);
    setCopiedChunkIdx(new Set());
    setValidation(null);
    try {
      // generate_provisioning_token/check-in (BE-008) is deliberately
      // gated to pending_provisioning/provisioning -- a fresh *device
      // enrollment*, not a config refresh -- so re-running this panel
      // against an already-online (or offline) router to add a WAN, tweak
      // load balancing, etc. used to 409. That router already has a
      // working agent credential; it doesn't need a new *device
      // enrollment*, just a fresh plaintext of the credential it already
      // has to embed in the regenerated script (the old plaintext isn't
      // recoverable -- disclosed exactly once, at issuance). See
      // POST /routers/{id}/agent-credential/regenerate's own docstring for
      // why this is a real, separate, purpose-built endpoint rather than
      // relaxing generate_provisioning_token's own status gate.
      let agentCredential: string | undefined;
      if (router.status === "pending_provisioning" || router.status === "provisioning") {
        const { token } = await generate.mutateAsync(router.id);
        const checkinResp = await api.post<{ agent_credential?: string }>(
          "/routers/provisioning/check-in",
          { token },
        );
        agentCredential = checkinResp.data.agent_credential;
      } else {
        const regenResp = await api.post<{ agent_credential?: string }>(
          `/routers/${router.id}/agent-credential/regenerate`,
        );
        agentCredential = regenResp.data.agent_credential;
      }
      if (!agentCredential) {
        toast.error("Could not obtain an agent credential for this router.");
        return;
      }

      // Allocates a fresh keypair + the next free tunnel IP server-side --
      // this dashboard never generates or sees a WireGuard private key
      // it didn't just mint for this specific router.
      let wireguard: import("@/components/routers/RouterDetailTabs").WireguardPeerInfo | undefined;
      if (enableWireguard) {
        // Routed through the backend, not fetch()'d directly against the
        // hub bridge from here -- that bridge has no CORS/OPTIONS support,
        // so a direct browser call always failed once a custom auth header
        // was involved (confirmed live). The backend makes the same call
        // server-to-server (CORS is a browser-only restriction) and
        // records the result in one step. A failure here must not take
        // down the whole "1-shot" script -- WAN/LAN/hotspot/firewall/
        // API-access/heartbeat are all independently useful without a
        // tunnel, so this degrades to "no WireGuard in this script" with a
        // clear toast instead of aborting generation entirely.
        try {
          const wg = await api.post<{
            peer_private_key: string;
            hub_public_key: string;
            tunnel_ip_address: string;
            hub_endpoint_host: string;
            hub_endpoint_port: number;
            tunnel_network_cidr: string;
            hub_tunnel_ip_address: string;
          }>(`/routers/${router.id}/wireguard-peer/allocate-external`);
          wireguard = {
            routerPrivateKey: wg.data.peer_private_key,
            serverPublicKey: wg.data.hub_public_key,
            routerTunnelIp: wg.data.tunnel_ip_address,
            serverEndpointHost: wg.data.hub_endpoint_host,
            serverEndpointPort: String(wg.data.hub_endpoint_port),
            tunnelSubnet: wg.data.tunnel_network_cidr,
            hubTunnelIpAddress: wg.data.hub_tunnel_ip_address,
          };
        } catch (err) {
          wireguard = undefined;
          toast.error(
            (err as AppError).message ||
              "Couldn't reach the WireGuard hub -- script generated without a tunnel. Everything else is still included.",
          );
        }
      }

      // Gives this router its own genuine NAS identity -- resolved
      // dynamically server-side via %{client:shortname}/%{client:backend_secret}
      // per-client blocks in FreeRADIUS, not one shared identifier for
      // every router. Needs the tunnel IP WireGuard just allocated, so
      // RADIUS implies WireGuard (enforced by the checkbox below).
      let radius: { serverAddress: string; sharedSecret: string } | undefined;
      if (enableRadius && wireguard) {
        // Same CORS problem, same fix -- routed through the backend
        // instead of fetch()'d directly against the FreeRADIUS bridge.
        try {
          const nas = await api.post<{ shared_secret: string }>(
            `/radius/nas/register-external/${router.id}`,
          );
          // The hub's tunnel-side IP, not its public one -- see this
          // panel's own module-level comment above for why.
          radius = {
            serverAddress: wireguard.hubTunnelIpAddress,
            sharedSecret: nas.data.shared_secret,
          };
        } catch (err) {
          radius = undefined;
          toast.error(
            (err as AppError).message ||
              "Couldn't reach the RADIUS server -- script generated without RADIUS. Everything else is still included.",
          );
        }
      }

      // Also unlocks Device Console for this router (it stays permanently
      // disabled -- "no credentials" -- until the platform has a RouterOS
      // API login on file). Recorded on the router row now, and created on
      // the device itself by the script below, so one script run + one
      // paste is enough to make the router fully controllable end to end.
      const apiSecret = generateApiSecret();
      let apiAccess: { username: string; secret: string } | undefined;
      try {
        await api.put(`/routers/${router.id}`, {
          api_username: API_ACCESS_USERNAME,
          api_secret: apiSecret,
        });
        apiAccess = { username: API_ACCESS_USERNAME, secret: apiSecret };
      } catch (err) {
        toast.error(
          (err as AppError).message ||
            "Could not record API credentials -- Device Console will stay locked for this router until they're set.",
        );
      }

      setChunks(
        buildRouterSetupScriptChunks({
          // Absolute, not `api.defaults.baseURL` directly -- see
          // `getAbsoluteApiBase`'s docstring: this gets baked verbatim into
          // a RouterOS `/tool fetch url=...` command, which has no origin
          // to resolve a relative URL against ("Mode not specified").
          apiBase: getAbsoluteApiBase(),
          agentCredential,
          wans: activeWans,
          wanRoutingMode,
          basicConfigOnly,
          lanIfs: lanIfs.length > 0 ? lanIfs : undefined,
          enableFirewall,
          wireguard,
          radius,
          apiAccess,
          identity: router.locationName,
          // GUEST_PORTAL_PUBLIC_BASE, not window.location.origin -- see
          // that constant's own docstring in RouterDetailTabs.tsx: this
          // must be the real, stable, guest-facing portal domain
          // regardless of whatever URL Master console itself happens to be
          // served from.
          portalUrl: {
            frontendBase: GUEST_PORTAL_PUBLIC_BASE,
            organizationId: router.organizationId,
            locationId: router.locationId,
            routerId: router.id,
          },
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
        WAN interface list + NAT (1-3 ISPs), WAN addressing (static IP, DHCP, or PPPoE, per link),
        LAN bridge, hotspot, basic firewall, platform check-in + heartbeat (also reports WAN1's live
        IP), and Device Console access — all in one script, one paste. 2+ ISPs also get real
        per-connection-classifier <strong>load balancing</strong> plus distance/check-gateway-based
        <strong> failover</strong> (a WAN whose gateway stops answering pings automatically drops
        out, its share of traffic falling back to the next WAN — no dashboard action needed).
        Already configured WAN connectivity and DNS by hand? Pick{" "}
        <strong>Basic (I'll configure WAN/DNS myself)</strong> below for a shorter script that skips
        all of that and only covers LAN/hotspot/firewall/etc.
      </p>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-[11px]">
        <p className="font-medium text-foreground">
          ⚠ Before you start — check this first if the router is brand new
        </p>
        <p className="mt-1 text-muted-foreground">
          Most new MikroTik routers ship <strong>locked</strong> (RouterOS "device-mode") — they
          won't let this script's{" "}
          <code className="rounded bg-background px-1 py-0.5">/tool fetch</code>/scheduler commands
          run at all until unlocked once, by hand,{" "}
          <strong>with the router physically in front of you</strong>: power it on, and while it's
          booting hold the reset button for about 5 seconds. This{" "}
          <strong>cannot be done remotely, and cannot be done after you've left the site</strong> —
          do it now if this is a fresh unit, especially one going somewhere you won't be able to
          physically reach later (ceiling mount, locked cabinet, shipped ahead). If a piece below
          fails with a permission-style error and this step was skipped, that's almost always why.
        </p>
      </div>

      <ol className="list-decimal space-y-1 rounded-lg border border-border bg-muted/30 p-2.5 pl-6 text-[11px] text-muted-foreground">
        <li>
          Connect a laptop to the router by <strong>Ethernet cable</strong> (not a serial/console
          cable), then open <strong>WinBox</strong> (the graphical app) — not a terminal/SSH
          session, and not a browser.
        </li>
        <li>
          In WinBox, open <strong>New Terminal</strong> and run{" "}
          <code className="rounded bg-background px-1 py-0.5">/interface print</code>. Interface
          names vary by model/device (
          <code className="rounded bg-background px-1 py-0.5">ether1</code>,{" "}
          <code className="rounded bg-background px-1 py-0.5">eth1</code>, or even a custom-renamed
          name) — match the "WAN 1/2/3 interface" fields below to whatever name actually shows up
          there.
        </li>
        <li>
          <strong>Do not rename a WAN interface</strong> (e.g.{" "}
          <code className="rounded bg-background px-1 py-0.5">
            /interface ethernet set ... name=...
          </code>
          ) at any point before or while pasting this script — every line below refers to it by the
          exact name entered in step above. Renaming it first (even to something more readable)
          makes every later match on that name silently fail, and that unrecognized port then gets
          swept into the guest LAN bridge instead of staying on the WAN side (confirmed live). If
          you want a friendlier name, rename it only <strong>after</strong> the whole script has run
          successfully.
        </li>
        <li>
          {basicConfigOnly ? (
            <>
              Bring each WAN's own connectivity up yourself first — <strong>Static</strong>,{" "}
              <strong>DHCP</strong>, or <strong>PPPoE</strong>, whichever that specific ISP link
              needs — and set the router's own DNS servers, both by hand in WinBox, before pasting
              anything below. "Basic Configuration" mode is selected, so this script only fills in
              the interface's name for NAT — it never touches WAN IP/routing/DNS itself.
            </>
          ) : (
            <>
              For each WAN below, pick <strong>Static</strong> or <strong>DHCP</strong> to match
              what that specific ISP link actually is — a static/leased-line IP needs the IP, CIDR,
              and gateway your ISP gave you; DHCP needs nothing, the router negotiates its own
              address.
            </>
          )}
        </li>
        <li>
          Fill in the rest of the fields below, then click <strong>Generate script</strong> and{" "}
          <strong>Copy</strong>.
        </li>
        <li>
          The script appears below in numbered pieces — copy and paste each one into WinBox's New
          Terminal <strong>one at a time, in order</strong>, pressing Enter after each. This avoids
          WinBox's terminal dropping characters on one huge paste. If a piece prints a loud{" "}
          <code className="rounded bg-background px-1 py-0.5">*** ERROR ***</code> banner about a
          missing WAN interface, stop and fix the interface name (do not continue pasting further
          pieces) before re-running.
        </li>
      </ol>

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

      <div className="space-y-2 rounded-lg border border-border p-2.5">
        <p className="text-[11px] font-medium text-foreground">
          How should WAN connectivity + DNS be set up?
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setBasicConfigOnly(false)}
            className={`rounded-lg border p-2 text-left text-[11px] ${!basicConfigOnly ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}
          >
            <div className="font-medium text-foreground">Full (script configures it)</div>
            <div className="text-muted-foreground">
              This script sets each WAN's own IP (static/DHCP/PPPoE), routing/failover, and the
              router's DNS servers for you.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setBasicConfigOnly(true)}
            className={`rounded-lg border p-2 text-left text-[11px] ${basicConfigOnly ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}
          >
            <div className="font-medium text-foreground">Basic (I'll configure WAN/DNS myself)</div>
            <div className="text-muted-foreground">
              You've already brought each WAN up by hand in WinBox and set DNS yourself — this
              script skips all of that and only touches LAN/hotspot/firewall/etc. Still needs to
              know each WAN's interface name, for NAT.
            </div>
          </button>
        </div>
      </div>

      {!basicConfigOnly && ispCount > 1 && (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <p className="text-[11px] font-medium text-foreground">
            If one connection goes down, what should happen?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setWanRoutingMode("failover_only")}
              className={`rounded-lg border p-2 text-left text-[11px] ${wanRoutingMode === "failover_only" ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}
            >
              <div className="font-medium text-foreground">Failover only</div>
              <div className="text-muted-foreground">
                WAN 1 carries everything while healthy; the rest sit ready and take over
                automatically only if it drops.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setWanRoutingMode("load_balance")}
              className={`rounded-lg border p-2 text-left text-[11px] ${wanRoutingMode === "load_balance" ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}
            >
              <div className="font-medium text-foreground">Share the load</div>
              <div className="text-muted-foreground">
                Traffic splits across every connection all the time, still with automatic failover
                if one drops.
              </div>
            </button>
          </div>
          {wanRoutingMode === "load_balance" && (
            <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">
                Splits evenly by default. Only fill these in if one connection should carry more
                than the others (e.g. a 100mbps primary paired with a 20mbps backup) — leave every
                box blank for an even split.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {wans.slice(0, ispCount).map((_, idx) => (
                  <input
                    key={idx}
                    className={inputCls}
                    value={wanWeightsRaw[idx] ?? ""}
                    onChange={(e) => setWanWeightsRaw((m) => ({ ...m, [idx]: e.target.value }))}
                    placeholder={`WAN ${idx + 1} weight`}
                    inputMode="numeric"
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                A target, not an exact guarantee — with only a handful of devices connected, the
                real split can look uneven for a while. It evens out as more guests connect.
              </p>
            </div>
          )}
          {wanRoutingMode === "failover_only" && (
            <p className="text-[11px] text-muted-foreground">
              Priority order: WAN 1 carries everything while healthy. If it drops, traffic moves to
              WAN 2; if that also drops, to WAN 3 — and back to WAN 1 automatically once it
              recovers. No dashboard action needed.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {wans.slice(0, ispCount).map((w, idx) => (
          <div key={idx} className="space-y-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-2">
              <label className="block text-[11px] text-muted-foreground">
                WAN {idx + 1} interface
              </label>
              <input
                className={`${inputCls} flex-1`}
                value={w.iface}
                onChange={(e) => setWan(idx, { iface: e.target.value })}
                placeholder={`ether${idx + 1}`}
              />
            </div>
            {basicConfigOnly && (
              <p className="text-[11px] text-muted-foreground">
                Whatever this WAN's own interface is named on the device already — the physical port
                for a static/DHCP link you set up yourself, or the virtual PPPoE interface WinBox
                created if you dialed PPPoE by hand. Only used for NAT + the "WAN" interface list;
                its IP/routing are entirely up to what you already configured.
              </p>
            )}
            {!basicConfigOnly && (
              <div className="flex gap-1.5">
                {(["dhcp", "static", "pppoe"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWan(idx, { mode: m })}
                    className={`rounded border px-2 py-0.5 text-[11px] font-medium ${w.mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-accent"}`}
                  >
                    {m === "dhcp" ? "DHCP" : m === "static" ? "Static" : "PPPoE"}
                  </button>
                ))}
              </div>
            )}
            {!basicConfigOnly && w.mode === "static" && (
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  className={inputCls}
                  value={w.ip ?? ""}
                  onChange={(e) => setWan(idx, { ip: e.target.value })}
                  placeholder="IP e.g. 203.0.113.5"
                />
                <input
                  className={inputCls}
                  value={w.cidr ?? ""}
                  onChange={(e) => setWan(idx, { cidr: e.target.value })}
                  placeholder="CIDR e.g. 30"
                />
                <input
                  className={inputCls}
                  value={w.gateway ?? ""}
                  onChange={(e) => setWan(idx, { gateway: e.target.value })}
                  placeholder="Gateway e.g. 203.0.113.1"
                />
              </div>
            )}
            {!basicConfigOnly && w.mode === "pppoe" && (
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  className={inputCls}
                  value={w.pppoeUsername ?? ""}
                  onChange={(e) => setWan(idx, { pppoeUsername: e.target.value })}
                  placeholder="PPPoE username"
                />
                <input
                  className={inputCls}
                  type="password"
                  value={w.pppoePassword ?? ""}
                  onChange={(e) => setWan(idx, { pppoePassword: e.target.value })}
                  placeholder="PPPoE password"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">LAN bridge name</label>
          <input
            className={inputCls}
            value={form.lanBridge}
            onChange={(e) => set("lanBridge", e.target.value)}
            placeholder="bridge"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">LAN IP</label>
          <input
            className={inputCls}
            value={form.lanIp}
            onChange={(e) => set("lanIp", e.target.value)}
            placeholder="192.168.88.1"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">LAN CIDR</label>
          <input
            className={inputCls}
            value={form.lanCidr}
            onChange={(e) => set("lanCidr", e.target.value)}
            placeholder="24"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-[11px] text-muted-foreground">
            LAN interfaces (comma-separated, e.g. ether4,ether5) — blank = every port that isn't a
            WAN above
          </label>
          <input
            className={inputCls}
            value={lanIfsRaw}
            onChange={(e) => setLanIfsRaw(e.target.value)}
            placeholder="blank = auto (all non-WAN ports)"
          />
        </div>
        {!basicConfigOnly && (
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">DNS servers</label>
            <input
              className={inputCls}
              value={form.dnsServers}
              onChange={(e) => set("dnsServers", e.target.value)}
              placeholder="8.8.8.8,1.1.1.1"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Hotspot username</label>
          <input
            className={inputCls}
            value={form.hsUser}
            onChange={(e) => set("hsUser", e.target.value)}
            placeholder="guest"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Hotspot password</label>
          <input
            className={inputCls}
            value={form.hsPass}
            onChange={(e) => set("hsPass", e.target.value)}
            placeholder="welcome123"
          />
          {KNOWN_WEAK_HOTSPOT_PASSWORDS.has(form.hsPass.trim().toLowerCase()) && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
              <AlertTriangle className="h-3 w-3" /> This is a well-known default -- pick something
              less guessable.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={enableFirewall}
            onChange={(e) => setEnableFirewall(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Also add basic firewall rules
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
          Also create a WireGuard tunnel (for remote reachability from the platform)
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
          Also enable RADIUS (needs a WireGuard tunnel IP for a unique NAS identity — WireGuard will
          turn on automatically)
        </label>
      </div>

      <MButton variant="primary" onClick={onGenerate} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
        {busy ? "Generating..." : "Generate script"}
      </MButton>

      {chunks && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Paste these <strong>one at a time</strong>, in order, into the router's WinBox/WebFig
              Terminal — press Enter after each before pasting the next. Splitting it up like this
              avoids the terminal dropping characters on one huge paste (confirmed live on a real
              device). Each piece is safe to re-run if you need to retry it. After the WAN chunks,
              paste <strong>"WAN Connectivity Check"</strong> and read its output before continuing
              — it must print <strong>PASS</strong> on both lines (ping + DNS) before it's safe to
              paste anything below it (Hotspot, RADIUS, WireGuard, Heartbeat all assume the internet
              is actually up). If it prints FAIL, fix the WAN link/DNS and re-paste that same chunk
              to re-check — don't continue past a FAIL. Or skip pasting entirely: download the{" "}
              <strong>.rsc</strong> file below, upload it once via WebFig's <strong>Files</strong>{" "}
              tab, then run{" "}
              <code className="rounded bg-background px-1 py-0.5">
                /import file=&lt;name&gt;.rsc
              </code>{" "}
              — no terminal paste at all, so nothing to corrupt. <strong>Copy (1 line)</strong>{" "}
              below is still one giant paste under the hood -- on a real config it usually ends up
              several times longer than any single chunk above, which is exactly the kind of paste
              that's corrupted terminals before. Prefer Download .rsc if you have any doubt.
            </p>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  const oneLine = chunksToSingleLineScript(chunks);
                  // No hard size a real config lands under -- even a
                  // single-WAN, no-extras router flattens to 5-figure
                  // character counts (measured directly against this
                  // generator's own output), well past any individual
                  // chunk that's actually been proven safe to paste. This
                  // warns every time rather than only past some threshold,
                  // since in practice there is no realistic "small enough"
                  // case -- see chunksToSingleLineScript's own docstring.
                  const proceed = window.confirm(
                    `This paste is ${oneLine.length.toLocaleString()} characters on one line -- several times longer than any single chunk above, and this is exactly the kind of paste that has corrupted WinBox/WebFig terminals before (a corrupted hotspot/portal command silently drops the guest sign-in page, with no error shown).\n\nDownload .rsc has no such risk -- it's a real file upload, no terminal paste at all.\n\nCopy the one-line version anyway?`,
                  );
                  if (!proceed) return;
                  const ok = await copyToClipboard(oneLine);
                  if (ok)
                    toast.success(
                      "Copied full script as one line -- verify the hotspot page after pasting",
                    );
                  else toast.error("Couldn't copy automatically -- try Download .rsc instead.");
                }}
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent"
                title="Flattens the whole script onto one line -- still one large paste under the hood, not risk-free. Download .rsc is the actually safe alternative."
              >
                <Copy className="h-3 w-3" /> Copy (1 line)
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = validateSetupScriptChunks(chunks);
                  setValidation(result);
                  const errorCount = result.reduce(
                    (n, r) => n + r.issues.filter((i) => i.severity === "error").length,
                    0,
                  );
                  const warningCount = result.reduce(
                    (n, r) => n + r.issues.filter((i) => i.severity === "warning").length,
                    0,
                  );
                  if (errorCount === 0 && warningCount === 0)
                    toast.success("Validated -- no issues found");
                  else if (errorCount > 0)
                    toast.error(
                      `Validation found ${errorCount} error(s), ${warningCount} warning(s) -- see details below`,
                    );
                  else
                    toast.warning(
                      `Validation found ${warningCount} warning(s) -- see details below`,
                    );
                }}
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                title="Check this script for syntax issues (unbalanced brackets/quotes, unescaped $variables, corrupted lines) before pasting or downloading -- runs entirely in your browser, no device needed"
              >
                <ShieldCheck className="h-3 w-3" /> Validate
              </button>
              <button
                type="button"
                onClick={() => {
                  const rsc = chunksToRouterOsScript(chunks, router.locationName);
                  const blob = new Blob([rsc], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `mikrotik-${router.locationName || router.id}.rsc`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Downloaded .rsc -- upload via WebFig Files, then /import it");
                }}
                className="flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
                title="Download a plain RouterOS script -- upload via WebFig Files, then run /import file=... (no terminal paste needed)"
              >
                <Download className="h-3 w-3" /> Download .rsc
              </button>
              <button
                type="button"
                onClick={() => {
                  const md = chunksToMarkdown(chunks, router.locationName);
                  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `mikrotik-${router.locationName || router.id}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Downloaded mikrotik.md");
                }}
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                title="Download this router's full script as one reviewable Markdown file (documentation only -- do not upload this one to the router)"
              >
                <Download className="h-3 w-3" /> Download .md
              </button>
            </div>
          </div>
          {validation &&
            (() => {
              const errorCount = validation.reduce(
                (n, r) => n + r.issues.filter((i) => i.severity === "error").length,
                0,
              );
              const warningCount = validation.reduce(
                (n, r) => n + r.issues.filter((i) => i.severity === "warning").length,
                0,
              );
              return (
                <div
                  className={`rounded-lg border p-2.5 text-[11px] ${errorCount > 0 ? "border-destructive/40 bg-destructive/5" : warningCount > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {errorCount === 0 && warningCount === 0 ? (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> All{" "}
                        {validation.length} pieces passed validation -- no issues found.
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> {errorCount}{" "}
                        error(s), {warningCount} warning(s) found across{" "}
                        {validation.filter((r) => r.issues.length > 0).length} piece(s).
                      </>
                    )}
                  </div>
                  {(errorCount > 0 || warningCount > 0) && (
                    <ul className="mt-1.5 space-y-1">
                      {validation
                        .filter((r) => r.issues.length > 0)
                        .map((r) => (
                          <li key={r.chunkIndex}>
                            <span className="font-medium">
                              {r.chunkIndex + 1}. {r.label}:
                            </span>
                            <ul className="ml-4 list-disc">
                              {r.issues.map((issue, idx) => (
                                <li
                                  key={idx}
                                  className={
                                    issue.severity === "error"
                                      ? "text-destructive"
                                      : "text-amber-600"
                                  }
                                >
                                  {issue.message}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                    </ul>
                  )}
                  <p className="mt-1.5 text-muted-foreground">
                    This checks the script's own text for syntax problems -- it does not run
                    anything on a real device.
                  </p>
                </div>
              );
            })()}
          {chunks.map((chunk, i) => {
            const chunkValidation = validation?.[i];
            const hasErrors = chunkValidation?.issues.some((issue) => issue.severity === "error");
            const hasWarnings = chunkValidation?.issues.some(
              (issue) => issue.severity === "warning",
            );
            const isCopied = copiedChunkIdx.has(i);
            const isLocked = i > 0 && !copiedChunkIdx.has(i - 1);
            return (
              <div key={chunk.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                    {i + 1}. {chunk.label}
                    {isCopied && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                    {chunkValidation &&
                      (hasErrors ? (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      ) : hasWarnings ? (
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                      ) : (
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      ))}
                  </span>
                  <button
                    type="button"
                    disabled={isLocked}
                    title={
                      isLocked
                        ? `Copy piece ${i} first -- these run in order`
                        : hasErrors
                          ? "This piece has a validation error -- you'll be asked to confirm"
                          : undefined
                    }
                    onClick={async () => {
                      if (hasErrors) {
                        const issues =
                          chunkValidation?.issues
                            .filter((iss) => iss.severity === "error")
                            .map((iss) => iss.message)
                            .join("\n- ") ?? "";
                        const proceed = window.confirm(
                          `"${chunk.label}" has a validation error:\n- ${issues}\n\nPasting it as-is will very likely fail (or worse, partially apply) on the real device. Copy anyway?`,
                        );
                        if (!proceed) return;
                      }
                      const ok = await copyToClipboard(chunk.script);
                      if (ok) {
                        toast.success(`Copied: ${chunk.label}`);
                        setCopiedChunkIdx((prev) => new Set(prev).add(i));
                      } else {
                        toast.error(
                          "Couldn't copy automatically -- select the text below and copy it manually.",
                        );
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                <pre
                  className={`max-h-48 overflow-auto rounded-lg bg-muted/50 p-2.5 text-[10px] leading-snug ${isLocked ? "opacity-50" : ""}`}
                >
                  <code>{chunk.script}</code>
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The setup-script drill-down's own page -- everything a real, non-demo
 * router needs to go from "selected in the fleet table" to "script in
 * hand," at full page width instead of squeezed into the ~448px browse
 * drawer (`MDrawer`'s own `max-w-md`) that used to hold this directly.
 * Purely a layout shell around the same `RouterSetupScriptPanel` /
 * `VendorNotSupportedPanel` and the same `updateVendor` mutation the browse
 * drawer used to call -- no script-building/validation logic lives here. */
function RouterSetupDrilldown({
  router,
  demo,
  vendorSaving,
  onVendorChange,
}: {
  router: RouterDevice;
  demo: boolean;
  vendorSaving: boolean;
  onVendorChange: (vendor: string) => void;
}) {
  const vendor = router.vendor || "mikrotik";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <p className="text-lg font-semibold tracking-tight">{router.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {router.model} ·{" "}
            {router.managementIpAddress ?? router.publicIpAddress ?? "IP not yet assigned"} ·{" "}
            {router.organizationName} / {router.locationName}
          </p>
        </div>
        <MTag
          label={router.status === "pending_provisioning" ? "Awaiting check-in" : router.status}
          tone={router.status === "pending_provisioning" ? "pending" : undefined}
        />
      </div>

      {demo ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Setup Script generation isn't part of the demo experience -- it mints a real provisioning
          token and agent credential against the live backend.
        </div>
      ) : (
        <>
          <div className="max-w-xs">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Vendor</label>
            <select
              className={inputCls}
              value={vendor}
              disabled={vendorSaving}
              onChange={(e) => onVendorChange(e.target.value)}
            >
              {DEVICE_VENDORS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          {vendor === "mikrotik" ? (
            <RouterSetupScriptPanel router={router} />
          ) : (
            <VendorNotSupportedPanel vendor={vendor} />
          )}
        </>
      )}
    </div>
  );
}

function RouterFleetScreen() {
  const navigate = useNavigate();
  const { open: openRouterId, setup: setupRouterId } = Route.useSearch();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<RouterDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [rebootTarget, setRebootTarget] = useState<RouterDevice | null>(null);
  const [rebooting, setRebooting] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);
  const demo = isDemo();

  // Persists the vendor selection against the real router record (`Router.vendor`
  // -- router/models.py:77) and mirrors it into local state so this screen's
  // conditional setup-script/"not yet supported" rendering below reacts
  // immediately, without waiting on a full re-list.
  async function updateVendor(router: RouterDevice, vendor: string) {
    setVendorSaving(true);
    try {
      await api.put(`/routers/${router.id}`, { vendor });
      setSel((prev) => (prev && prev.id === router.id ? { ...prev, vendor } : prev));
      setRouters((prev) => prev.map((r) => (r.id === router.id ? { ...r, vendor } : r)));
    } catch (err) {
      toast.error((err as AppError).message || "Could not update vendor");
    } finally {
      setVendorSaving(false);
    }
  }

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
        .filter(
          (r) =>
            !q ||
            `${r.name} ${r.managementIpAddress ?? ""} ${r.publicIpAddress ?? ""} ${r.organizationName} ${r.locationName}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        ),
    [routers, filter, q],
  );

  // Fleet-wide counts for the summary tiles above the table -- same 3-way
  // bucketing as the filter segmented control (`displayStatus`), over the
  // *unfiltered* fleet so these always read as "the whole fleet," not
  // "whatever the current filter/search happens to show."
  const summary = useMemo(() => {
    let online = 0;
    let degraded = 0;
    let offline = 0;
    for (const r of routers) {
      const s = displayStatus(r);
      if (s === "online") online++;
      else if (s === "degraded") degraded++;
      else offline++;
    }
    return { total: routers.length, online, degraded, offline };
  }, [routers]);

  // The Setup Script generator is its own drill-down (`?setup=<id>`), a
  // distinct URL/page-state from the lightweight browse drawer (`?open=<id>`
  // / `sel`) -- see this route's own `validateSearch` doc comment for why.
  // Looked up against the already-loaded fleet rather than fetched
  // separately: this list already pulls the full fleet (pageSize 200) on
  // mount, and every router this could ever be pointed at is in it.
  const setupRouter = useMemo(
    () => (setupRouterId ? (routers.find((r) => r.id === setupRouterId) ?? null) : null),
    [setupRouterId, routers],
  );
  function goToSetup(id: string) {
    setSel(null);
    navigate({ to: "/master/routers", search: { setup: id } });
  }
  function backToFleet() {
    navigate({ to: "/master/routers", search: {} });
  }

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
  const statusLabel = (r: RouterDevice) =>
    r.status === "pending_provisioning" ? "Awaiting check-in" : r.status;

  return (
    <MasterShell title="Router Fleet">
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title={setupRouter ? `Setup Script — ${setupRouter.name}` : "Router Fleet"}
          actions={
            setupRouter ? (
              <MButton variant="outline" onClick={backToFleet}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Router Fleet
              </MButton>
            ) : undefined
          }
        />

        {/* Two distinct modes on one route, told apart by the `setup` search
            param: browse/manage the fleet (table + a lightweight summary
            drawer) vs. this router's own full-width Setup Script drill-down.
            Keeps the actively-maintained generator (RouterSetupScriptPanel,
            untouched below) off the cramped ~448px browse drawer it used to
            be squeezed into, without introducing a whole new route file --
            same `?open=<id>` / now `?setup=<id>` deep-link convention this
            page already used for the browse drawer. */}
        {setupRouterId && !setupRouter ? (
          loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading router…
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <p>Couldn't find that router -- it may have been removed.</p>
              <MButton variant="outline" onClick={backToFleet}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Router Fleet
              </MButton>
            </div>
          )
        ) : setupRouter ? (
          <RouterSetupDrilldown
            router={setupRouter}
            demo={demo}
            vendorSaving={vendorSaving}
            onVendorChange={(vendor) => updateVendor(setupRouter, vendor)}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MStat label="Total routers" value={summary.total} icon={RouterIcon} />
              <MStat label="Online" value={summary.online} tone="success" icon={CheckCircle2} />
              <MStat
                label="Degraded"
                value={summary.degraded}
                tone="warning"
                icon={AlertTriangle}
              />
              <MStat label="Offline" value={summary.offline} tone="danger" icon={WifiOff} />
            </div>

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
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, IP, customer…"
                  className="w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <MTable
              loading={loading}
              head={
                <>
                  <MTh>Router</MTh>
                  <MTh className="hidden md:table-cell">Model</MTh>
                  <MTh className="hidden sm:table-cell">Customer</MTh>
                  <MTh>RouterOS</MTh>
                  <MTh>Last seen</MTh>
                  <MTh>Status</MTh>
                  {!demo && <MTh className="text-right">Actions</MTh>}
                </>
              }
            >
              {!loading &&
                rows.map((r) => (
                  <MTr key={r.id} onClick={() => setSel(r)}>
                    <MTd>
                      <p className="font-semibold">{r.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.managementIpAddress ?? r.publicIpAddress ?? "IP not yet assigned"} ·{" "}
                        {r.locationName}
                      </p>
                    </MTd>
                    <MTd className="hidden text-sm md:table-cell">{r.model}</MTd>
                    <MTd className="hidden text-sm sm:table-cell">{r.organizationName}</MTd>
                    <MTd>
                      <span className="font-mono text-xs">{r.routerOsVersion ?? "—"}</span>
                    </MTd>
                    <MTd className="text-xs text-muted-foreground">{timeAgo(r.lastSeenAt)}</MTd>
                    <MTd>
                      <MTag
                        label={statusLabel(r)}
                        tone={r.status === "pending_provisioning" ? "pending" : undefined}
                      />
                    </MTd>
                    {!demo && (
                      <MTd className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to="/master/routers/setup/$routerId"
                            params={{ routerId: r.id }}
                            onClick={(e) => e.stopPropagation()}
                            title="Open server-driven provisioning wizard"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:bg-accent"
                          >
                            <Workflow className="h-3 w-3" /> Wizard
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToSetup(r.id);
                            }}
                            title="Generate this router's setup script"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:bg-accent"
                          >
                            <FileCode2 className="h-3 w-3" /> Setup script
                          </button>
                        </div>
                      </MTd>
                    )}
                  </MTr>
                ))}
            </MTable>
            {!loading && rows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {routers.length === 0
                  ? "No routers provisioned yet."
                  : "No routers match your filter."}
              </p>
            )}

            <MDrawer
              open={!!sel}
              onClose={() => setSel(null)}
              title={sel?.name ?? ""}
              subtitle={
                sel
                  ? `${sel.model} · ${sel.managementIpAddress ?? sel.publicIpAddress ?? "IP not yet assigned"} · ${sel.organizationName} / ${sel.locationName}`
                  : ""
              }
              footer={
                sel &&
                (demo ? (
                  <MButton
                    variant="primary"
                    className="w-full justify-center"
                    onClick={() => act(`Opening remote console for ${sel.name}`)}
                  >
                    <TerminalSquare /> Open Device Console
                  </MButton>
                ) : (
                  <Link to="/master/console" className="w-full">
                    <MButton variant="primary" className="w-full justify-center">
                      <TerminalSquare /> Open Device Console
                    </MButton>
                  </Link>
                ))
              }
            >
              {sel && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                      <p className="text-lg font-semibold capitalize">{statusLabel(sel)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">Last seen</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {timeAgo(sel.lastSeenAt)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground">RouterOS</p>
                      <p className="text-lg font-semibold">{sel.routerOsVersion ?? "—"}</p>
                    </div>
                  </div>

                  {!demo && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                      Restart/Upgrade/Sync Config aren't wired to real device control yet -- use
                      Device Console for those. Reboot is real.
                    </p>
                  )}

                  {!demo && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Vendor
                      </label>
                      <select
                        className={inputCls}
                        value={sel.vendor || "mikrotik"}
                        disabled={vendorSaving}
                        onChange={(e) => updateVendor(sel, e.target.value)}
                      >
                        {DEVICE_VENDORS.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!demo && (
                    <MButton
                      variant="primary"
                      className="w-full justify-center"
                      onClick={() => goToSetup(sel.id)}
                    >
                      <FileCode2 className="h-4 w-4" /> Generate Setup Script
                    </MButton>
                  )}

                  {!demo && (sel.managementIpAddress || sel.publicIpAddress) && (
                    <RemoteAccessCard routerId={sel.id} />
                  )}

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Power</p>
                    <div className="grid grid-cols-2 gap-2">
                      <ControlButton
                        icon={Power}
                        label="Reboot"
                        onClick={() =>
                          demo ? act(`${sel.name}: reboot queued`) : setRebootTarget(sel)
                        }
                      />
                    </div>
                  </div>

                  {!demo && (
                    <Link to="/routers/$routerId" params={{ routerId: sel.id }} className="block">
                      <MButton variant="outline" className="w-full justify-center">
                        Manage this router <RouterIcon className="h-3.5 w-3.5" />
                      </MButton>
                      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                        WireGuard tunnel, config rollback/backup, diagnostics, connected devices,
                        and the audit log all live on the full router screen.
                      </p>
                    </Link>
                  )}
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RouterIcon className="h-3.5 w-3.5" /> Safe business-level operations only.
                  </p>
                </div>
              )}
            </MDrawer>
          </>
        )}

        <AlertDialog
          open={!!rebootTarget}
          onOpenChange={(o) => !o && !rebooting && setRebootTarget(null)}
        >
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
      </MPageShell>
    </MasterShell>
  );
}
