#!/usr/bin/env node
/**
 * Generates `mikrotik.md` -- a redacted, reviewable snapshot of the exact
 * RouterOS script `buildRouterSetupScriptChunks` (see
 * `src/components/routers/RouterDetailTabs.tsx`) actually produces for a
 * real router, in the same numbered-piece shape the Master Console's
 * "Setup Script" panel (`src/routes/master.routers.tsx`) shows an operator.
 *
 * Deliberately NOT a live import of `buildRouterSetupScriptChunks` itself:
 * that function lives in a component file with module-level React/Radix-UI
 * imports, which would drag a full bundler/JSX toolchain into what should
 * be a zero-dependency, `node mikrotik.md`-and-done doc generator. Instead
 * this mirrors that function's real, current output verbatim (confirmed
 * against the source on 2026-08-15) with every genuinely per-deployment
 * value swapped for a placeholder token -- see the `PLACEHOLDERS` table
 * below for the full list. If `buildRouterSetupScriptChunks` changes,
 * update the matching chunk here in the same change (this file's own
 * chunk labels intentionally match that function's `label` strings
 * one-to-one, so a diff between them is easy to spot).
 *
 * Usage: node scripts/generate-mikrotik-md.mjs > mikrotik.md
 *        node scripts/generate-mikrotik-md.mjs -o mikrotik.md
 */
import { writeFileSync } from "node:fs";

// Every value below is a placeholder or a genuinely non-secret architecture
// constant (interface names, the LAN subnet, public hostnames) -- never a
// real per-router secret or ID. See module docstring.
const P = {
  API_BASE: "https://master.wyfyguest.com/api/v1",
  AGENT_CREDENTIAL: "<AGENT_CREDENTIAL>",
  WAN1_IF: "ether1",
  LAN_BRIDGE: "bridge",
  LAN_IP: "10.5.50.1",
  LAN_CIDR: "24",
  DNS_SERVERS: "8.8.8.8,1.1.1.1",
  HS_USER: "guest",
  HS_PASS: "<HOTSPOT_GUEST_PASSWORD>",
  HOTSPOT_DNS_NAME: "wifi.wyfyguest.com",
  PORTAL_HOST: "portal.wyfyguest.com",
  ORG_ID: "<ORGANIZATION_ID>",
  LOCATION_ID: "<LOCATION_ID>",
  ROUTER_ID: "<ROUTER_ID>",
  LOCATION_NAME: "<LOCATION_NAME>",
  API_USERNAME: "cloudguest-api",
  API_SECRET: "<MIKROTIK_API_PASSWORD>",
  WG_PRIVATE_KEY: "<WIREGUARD_PRIVATE_KEY>",
  WG_SERVER_PUBLIC_KEY: "<WIREGUARD_SERVER_PUBLIC_KEY>",
  WG_HUB_ENDPOINT: "<WIREGUARD_HUB_ENDPOINT_HOST>",
  WG_HUB_PORT: "51820",
  WG_TUNNEL_SUBNET: "10.20.0.0/24",
  WG_ROUTER_TUNNEL_IP: "10.20.0.30",
  RADIUS_SERVER: "10.20.0.1",
  RADIUS_SECRET: "<RADIUS_SECRET>",
};

const portalQs =
  `organizationId=${P.ORG_ID}&locationId=${P.LOCATION_ID}&routerId=${P.ROUTER_ID}` +
  `&mac=$(mac)&dst=$(link-orig)&link-login-only=$(link-login-only)`;

function portalRedirectHtml(title) {
  return (
    `<!DOCTYPE html>\\n<html><head><meta charset=\\"utf-8\\">\\n` +
    `<script>location.replace(\\"https://${P.PORTAL_HOST}/portal?${portalQs}\\");</script>\\n` +
    `<meta http-equiv=\\"refresh\\" content=\\"0;url=https://${P.PORTAL_HOST}/portal?${portalQs}\\">\\n` +
    `<title>${title}</title>\\n` +
    `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0F172A,#1E293B)}\\n` +
    `.spin{width:28px;height:28px;border-radius:9999px;border:3px solid rgba(255,255,255,0.15);border-top-color:#fff;animation:s 0.7s linear infinite}\\n` +
    `@keyframes s{to{transform:rotate(360deg)}}</style>\\n</head>\\n<body><div class=\\"spin\\"></div></body></html>`
  );
}

// One entry per chunk `buildRouterSetupScriptChunks` currently emits (1-19,
// in its exact push order for a 1-WAN, WireGuard+RADIUS-enabled, firewall-on
// router -- the same shape as a real provisioned router), followed by the
// genuinely-missing chunks this review recommends adding (20-23; see
// section B/C of the accompanying audit for the reasoning behind each).
const chunks = [
  {
    label: "WAN + Bridge",
    script: `# =====================================================================
# WARNING: do NOT rename any WAN interface (e.g. \`/interface ethernet
# set ... name=...\`) before or while pasting this script. Every line
# below refers to it by the exact name shown in "WAN N interface"
# above -- renaming it first makes every later match on that name
# silently fail, and the unrecognized port then gets swept into the
# LAN bridge instead (WAN/LAN on one L2 segment). Re-generate the
# script with the device's CURRENT interface name if it does not
# match, instead of renaming the interface to match the script.
# =====================================================================
:if ([:len [/interface list find where name="WAN"]] = 0) do={ /interface list add name="WAN" }
:if ([:len [/interface bridge find where name="${P.LAN_BRIDGE}"]] = 0) do={ /interface bridge add name="${P.LAN_BRIDGE}" }
/interface bridge set [find name="${P.LAN_BRIDGE}"] disabled=no
:if ([:len [/interface ethernet find where name="${P.WAN1_IF}"]] = 0) do={
  :put ("*** ERROR: WAN interface \\"" . "${P.WAN1_IF}" . "\\" was not found on this device. Did you rename it? Re-check /interface print and re-generate this script with the CURRENT name -- do NOT rename the interface to match the script. Aborting before touching bridge/NAT config. ***")
  :error ("cloudguest-setup: WAN interface " . "${P.WAN1_IF}" . " not found")
}
:local wan1Port [/interface bridge port find where interface="${P.WAN1_IF}"]
:if ([:len $wan1Port] > 0) do={ /interface bridge port remove $wan1Port }
:if ([:len [/interface list member find where interface="${P.WAN1_IF}" list="WAN"]] = 0) do={ /interface list member add list="WAN" interface="${P.WAN1_IF}" }
:if ([:len [/ip firewall nat find where chain=srcnat out-interface="${P.WAN1_IF}" action=masquerade]] = 0) do={ /ip firewall nat add chain=srcnat out-interface="${P.WAN1_IF}" action=masquerade comment="cloudguest-nat-wan1" }`,
  },
  {
    label: "WAN Addressing (static IP or DHCP client per WAN)",
    script: `:if ([:len [/ip dhcp-client find where interface="${P.WAN1_IF}"]] = 0) do={
  /ip dhcp-client add interface="${P.WAN1_IF}" disabled=no add-default-route=no use-peer-dns=no comment="cloudguest-dhcp-wan1"
}`,
  },
  {
    label: "WAN Routing (load balancing + failover)",
    script: `:local wan1Gw ""
:if ([:len [/ip dhcp-client find where interface="${P.WAN1_IF}"]] > 0) do={ :set wan1Gw [/ip dhcp-client get [find interface="${P.WAN1_IF}"] gateway] }
:if ($wan1Gw != "") do={
  :if ([:len [/ip route find where comment="cloudguest-plain-wan1"]] = 0) do={
    /ip route add dst-address=0.0.0.0/0 gateway=$wan1Gw distance=1 check-gateway=ping comment="cloudguest-plain-wan1"
  } else={ /ip route set [find comment="cloudguest-plain-wan1"] gateway=$wan1Gw }
}`,
  },
  {
    label: "LAN Ports (add every non-WAN port to the bridge)",
    script: `:foreach eth in=[/interface ethernet find] do={
  :local ethName [/interface ethernet get $eth name]
  :local isWan ([:len [/interface list member find where interface=$ethName list="WAN"]] > 0)
  :local isLan true
  :if (!$isWan && $isLan) do={
    :local existingPort [/interface bridge port find where interface=$ethName]
    :if ([:len $existingPort] > 0) do={
      :if ([:len [/interface bridge port find where interface=$ethName bridge="${P.LAN_BRIDGE}"]] = 0) do={
        /interface bridge port remove $existingPort
        /interface bridge port add bridge="${P.LAN_BRIDGE}" interface=$ethName
      }
    } else={
      /interface bridge port add bridge="${P.LAN_BRIDGE}" interface=$ethName
    }
  }
}`,
  },
  {
    label: "LAN IP + DNS",
    script: `:foreach addr in=[/ip address find where interface="${P.LAN_BRIDGE}" dynamic=yes] do={ /ip address remove $addr }
:if ([:len [/ip address find where interface="${P.LAN_BRIDGE}" address="${P.LAN_IP}/${P.LAN_CIDR}"]] = 0) do={ /ip address add address=${P.LAN_IP}/${P.LAN_CIDR} interface="${P.LAN_BRIDGE}" }
/ip dns set servers=${P.DNS_SERVERS} allow-remote-requests=yes`,
  },
  {
    label: "Hotspot",
    script: `:if ([:len [/ip pool find where name="hotspot-pool"]] = 0) do={ /ip pool add name="hotspot-pool" ranges=10.5.50.10-10.5.50.254 }
:if ([:len [/ip dhcp-server find where interface="${P.LAN_BRIDGE}"]] = 0) do={
  /ip dhcp-server add name="hotspot-dhcp" interface="${P.LAN_BRIDGE}" address-pool="hotspot-pool" disabled=no
  /ip dhcp-server network add address=10.5.50.0/${P.LAN_CIDR} gateway=${P.LAN_IP} dns-server=${P.LAN_IP}
}
:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=${P.LAN_IP} html-directory=hotspot dns-name="${P.HOTSPOT_DNS_NAME}" }
/ip hotspot profile set [find name="hsprof1"] login-by=http-pap
/ip hotspot profile set [find name="hsprof1"] dns-name="${P.HOTSPOT_DNS_NAME}"
:if ([:len [/ip dns static find where name="${P.HOTSPOT_DNS_NAME}"]] = 0) do={ /ip dns static add name="${P.HOTSPOT_DNS_NAME}" address=${P.LAN_IP} comment="cloudguest-hotspot-dns-name" } else={ /ip dns static set [find name="${P.HOTSPOT_DNS_NAME}"] address=${P.LAN_IP} }
:if ([:len [/ip hotspot find where interface="${P.LAN_BRIDGE}"]] = 0) do={ /ip hotspot add name="hotspot1" interface="${P.LAN_BRIDGE}" address-pool="hotspot-pool" profile="hsprof1" disabled=no }
:if ([:len [/ip hotspot user find where name="${P.HS_USER}"]] = 0) do={ /ip hotspot user add name="${P.HS_USER}" password="${P.HS_PASS}" server="hotspot1" }`,
  },
  {
    label: "Walled Garden (let unauthenticated guests reach the portal)",
    script: `:if ([:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]] = 0) do={ /ip hotspot walled-garden add dst-host="${P.PORTAL_HOST}" action=allow comment="cloudguest-portal" }`,
  },
  { label: "Portal Redirect Page (login.html)", script: `/file set [find name="flash/hotspot/login.html"] contents="${portalRedirectHtml("Sign-in required")}"` },
  { label: "Portal Redirect Page (rlogin.html)", script: `/file set [find name="flash/hotspot/rlogin.html"] contents="${portalRedirectHtml("Sign-in required")}"` },
  { label: "Portal Redirect Page (alogin.html)", script: `/file set [find name="flash/hotspot/alogin.html"] contents="${portalRedirectHtml("You're connected")}"` },
  { label: "Portal Redirect Page (status.html)", script: `/file set [find name="flash/hotspot/status.html"] contents="${portalRedirectHtml("You're connected")}"` },
  { label: "Portal Redirect Page (logout.html)", script: `/file set [find name="flash/hotspot/logout.html"] contents="${portalRedirectHtml("Signed out")}"` },
  {
    label: "Block DNS-over-HTTPS (forces captive portal to actually show)",
    script: `:if ([:len [/ip firewall address-list find where list="cloudguest-doh-ips"]] = 0) do={
  /ip firewall address-list add list="cloudguest-doh-ips" address=1.1.1.1 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=1.0.0.1 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=8.8.8.8 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=8.8.4.4 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=9.9.9.9 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=149.112.112.112 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=208.67.222.222 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=208.67.220.220 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=94.140.14.14 comment="cloudguest-doh"
  /ip firewall address-list add list="cloudguest-doh-ips" address=94.140.15.15 comment="cloudguest-doh"
}
:if ([:len [/ip firewall filter find where comment="cloudguest-block-dot-udp"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=udp dst-port=853 action=drop comment="cloudguest-block-dot-udp" }
:if ([:len [/ip firewall filter find where comment="cloudguest-block-dot-tcp"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=tcp dst-port=853 action=drop comment="cloudguest-block-dot-tcp" }
:if ([:len [/ip firewall filter find where comment="cloudguest-block-doh"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=tcp dst-port=443 dst-address-list=cloudguest-doh-ips action=drop comment="cloudguest-block-doh" }`,
  },
  {
    label: "Firewall",
    script: `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-established"]] = 0) do={ /ip firewall filter add chain=input connection-state=established,related action=accept comment="cloudguest-fw-established" }
:if ([:len [/ip firewall filter find where comment="cloudguest-fw-drop-invalid"]] = 0) do={ /ip firewall filter add chain=input connection-state=invalid action=drop comment="cloudguest-fw-drop-invalid" }
:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-lan"]] = 0) do={ /ip firewall filter add chain=input in-interface="${P.LAN_BRIDGE}" action=accept comment="cloudguest-fw-allow-lan" }
:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-icmp"]] = 0) do={ /ip firewall filter add chain=input protocol=icmp action=accept comment="cloudguest-fw-allow-icmp" }
:if ([:len [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN action=drop comment="cloudguest-fw-drop-wan-input" }
:if ([:len [/ip firewall filter find where comment="cloudguest-fw-fwd-established"]] = 0) do={ /ip firewall filter add chain=forward connection-state=established,related action=accept comment="cloudguest-fw-fwd-established" }
:if ([:len [/ip firewall filter find where comment="cloudguest-fw-fwd-drop-invalid"]] = 0) do={ /ip firewall filter add chain=forward connection-state=invalid action=drop comment="cloudguest-fw-fwd-drop-invalid" }`,
  },
  { label: "Router Identity", script: `/system identity set name="${P.LOCATION_NAME}"` },
  {
    label: "API Access (unlocks Device Console)",
    script: `/ip service set api disabled=no
:if ([:len [/user find where name="${P.API_USERNAME}"]] = 0) do={
  /user add name="${P.API_USERNAME}" password="${P.API_SECRET}" group=full comment="cloudguest-api"
} else={
  /user set [find name="${P.API_USERNAME}"] password="${P.API_SECRET}"
}`,
  },
  {
    label: "WireGuard Tunnel",
    script: `:if ([:len [/interface wireguard find where name="wg-cloudguest"]] = 0) do={
  /interface wireguard add name="wg-cloudguest" private-key="${P.WG_PRIVATE_KEY}" listen-port=13231
}
:if ([:len [/interface wireguard peers find where interface="wg-cloudguest"]] = 0) do={
  /interface wireguard peers add interface="wg-cloudguest" public-key="${P.WG_SERVER_PUBLIC_KEY}" endpoint-address="${P.WG_HUB_ENDPOINT}" endpoint-port=${P.WG_HUB_PORT} allowed-address="${P.WG_TUNNEL_SUBNET}" persistent-keepalive=25s
}
:if ([:len [/ip address find where interface="wg-cloudguest"]] = 0) do={
  /ip address add address="${P.WG_ROUTER_TUNNEL_IP}/24" interface="wg-cloudguest"
}
:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]] = 0) do={
  /ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt"
}`,
  },
  {
    label: "RADIUS",
    script: `:if ([:len [/radius find where address="${P.RADIUS_SERVER}"]] = 0) do={
  /radius add service=hotspot address="${P.RADIUS_SERVER}" secret="${P.RADIUS_SECRET}" timeout=3s
}
/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes`,
  },
  {
    label: "Heartbeat (reports management + WAN1 IP)",
    script: `:if ([:len [/system scheduler find name="cloudguest-heartbeat-sched"]] = 0) do={
  /system scheduler add name="cloudguest-heartbeat-sched" interval=5m on-event=("/tool fetch url=\\"" . "${P.API_BASE}" . "/agent/heartbeat\\" http-method=post http-header-field=\\"Content-Type: application/json,X-Agent-Credential: " . "${P.AGENT_CREDENTIAL}" . "\\" http-data=\\"{\\\\\\"management_ip_address\\\\\\":\\\\\\"${P.WG_ROUTER_TUNNEL_IP}\\\\\\"}\\" output=none")
}
:local wan1Ip ""
:if ([:len [/ip address find where interface="${P.WAN1_IF}"]] > 0) do={
  :local wan1Full [/ip address get [find interface="${P.WAN1_IF}"] address]
  :set wan1Ip [:pick $wan1Full 0 [:find $wan1Full "/"]]
}
/tool fetch url="${P.API_BASE}/agent/heartbeat" http-method=post http-header-field="Content-Type: application/json,X-Agent-Credential: ${P.AGENT_CREDENTIAL}" http-data=("{\\"management_ip_address\\":\\"${P.WG_ROUTER_TUNNEL_IP}\\",\\"public_ip_address\\":\\"" . $wan1Ip . "\\"}") output=none`,
  },

  // ---- New, genuinely-missing chunks recommended by the accompanying
  // production review (mikrotik-review.md, sections B/C). Continues the
  // existing numbering; each is additive and idempotent, matching every
  // chunk above's own `:if ([:len [find ...]] = 0) do={ ... }` convention.
  {
    label: "Explicit LAN/Hotspot -> WAN forward accept (future-proofing)",
    script: `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-fwd-lan-to-wan"]] = 0) do={ /ip firewall filter add chain=forward in-interface="${P.LAN_BRIDGE}" out-interface-list=WAN action=accept comment="cloudguest-fw-fwd-lan-to-wan" }`,
  },
  {
    label: "Restrict RouterOS API service to the management network",
    script: `:local mgmtAddrs "${P.LAN_IP}/${P.LAN_CIDR}"
:if ([:len [/interface wireguard find where name="wg-cloudguest"]] > 0) do={ :set mgmtAddrs ($mgmtAddrs . "," . "${P.WG_TUNNEL_SUBNET}") }
/ip service set api address=$mgmtAddrs`,
  },
  {
    label: "Hotspot template file existence guard",
    script: `:foreach f in={"login.html";"rlogin.html";"alogin.html";"status.html";"logout.html"} do={
  :if ([:len [/file find where name=("flash/hotspot/" . $f)]] = 0) do={
    :put ("*** ERROR: hotspot template file \\"flash/hotspot/" . $f . "\\" was not found on this device -- the Portal Redirect Page chunks that follow would silently no-op instead of actually overwriting it. This usually means the Hotspot chunk above hasn't run yet, or this device's hotspot package files are non-standard. Re-run the Hotspot chunk first, or verify with /file print. ***")
    :error ("cloudguest-setup: hotspot template file " . $f . " not found")
  }
}`,
  },
  {
    label: "Disable local hotspot fallback user when RADIUS is authoritative",
    script: `:if ([:len [/radius find where address="${P.RADIUS_SERVER}"]] > 0) do={
  :if ([:len [/ip hotspot user find where name="${P.HS_USER}" disabled=no]] > 0) do={
    /ip hotspot user set [find name="${P.HS_USER}"] disabled=yes comment="cloudguest-fallback-disabled-radius-active"
  }
} else={
  :if ([:len [/ip hotspot user find where name="${P.HS_USER}" disabled=yes comment="cloudguest-fallback-disabled-radius-active"]] > 0) do={
    /ip hotspot user set [find name="${P.HS_USER}"] disabled=no
  }
}`,
  },
];

const lines = ["# MikroTik CloudGuest Provisioning Script", ""];
chunks.forEach((c, i) => {
  lines.push(`## ${i + 1}. ${c.label}`, "", "```routeros", c.script, "```", "");
});

const md = lines.join("\n");
const outIdx = process.argv.indexOf("-o");
if (outIdx !== -1 && process.argv[outIdx + 1]) {
  writeFileSync(process.argv[outIdx + 1], md);
  console.error(`Wrote ${process.argv[outIdx + 1]} (${chunks.length} chunks)`);
} else {
  process.stdout.write(md);
}
