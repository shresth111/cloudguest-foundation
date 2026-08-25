/**
 * Manual MikroTik Configuration Wizard — fleet ground truth.
 *
 * SINGLE SOURCE OF TRUTH for every literal this wizard bakes into a command
 * or compares an output against. Nothing else in `manual-wizard/` may
 * hard-code these values; import from here.
 *
 * NOTHING IN THIS FILE IS EVER TRANSLATED. These are device/protocol
 * literals — interface names, IPs, hostnames, RouterOS config values.
 *
 * ---------------------------------------------------------------------
 * PROVENANCE / CONFIDENCE — read before trusting any value.
 * ---------------------------------------------------------------------
 * Each entry is tagged in `DEFAULT_PROVENANCE` below with one of:
 *   "generator"   — read out of the live generator
 *                   (`RouterDetailTabs.tsx` / `RouterSetupScriptAdvanced.tsx`)
 *                   on 2026-08-22. Highest confidence available offline.
 *   "field"       — confirmed on real hardware, recorded in the
 *                   `wyfy-router-provisioning` / `wyfy-radius-captive-portal-incident`
 *                   memories.
 *   "briefed"     — stated by the product owner for this feature and not
 *                   independently re-verifiable from the repo.
 *   "unverified"  — carried forward from prior art, could be stale.
 *                   MUST be re-confirmed before a builder ships it.
 */

import type { Lit } from "./types";

export const FLEET_DEFAULTS = {
  /** LAN bridge name. The generator emits `bridge`. The Fleet Wizard's
   * `bridge1` default is WRONG and is a known source of
   * `input does not match any value of interface`. */
  lanBridge: "bridge" as Lit,
  /** The wrong-but-in-the-wild bridge name. Used only to produce a precise
   * error message, never emitted into a command. */
  lanBridgeWrongAlias: "bridge1" as Lit,
  /** Factory-default bridge RouterOS ships on some hEX builds. Never used
   * by this platform; carries a stale DHCP client that must be removed. */
  factoryBridge: "bridgeLocal" as Lit,

  wanInterface: "ether1" as Lit,
  /** The port the installer's laptop goes into. NEVER ether1. */
  mgmtInterface: "ether2" as Lit,

  lanIp: "10.5.50.1" as Lit,
  lanCidr: 24,
  lanIpCidr: "10.5.50.1/24" as Lit,
  lanNetwork: "10.5.50.0/24" as Lit,
  dhcpPoolName: "hotspot-pool" as Lit,
  dhcpPoolRange: "10.5.50.10-10.5.50.254" as Lit,
  dhcpPoolStart: "10.5.50.10" as Lit,
  dhcpPoolEnd: "10.5.50.254" as Lit,
  dhcpServerName: "hotspot-dhcp" as Lit,

  hotspotServerName: "hotspot1" as Lit,
  hotspotProfileName: "hsprof1" as Lit,
  hotspotUserProfileName: "default" as Lit,
  /** The hotspot's own DNS name — what the guest types in the address bar. */
  hotspotDnsName: "wifi.wyfyguest.com" as Lit,
  hotspotHtmlDirectory: "hotspot" as Lit,

  portalHost: "auth.wyfyguest.com" as Lit,
  /** Expected A record for `portalHost`. A different answer is a WARNING
   * (ISP DNS hijack, or the portal genuinely moved), never a silent PASS.
   *
   * Was `20.219.51.94` — the app VM on the OLD Azure subscription, which was
   * deallocated during the 2026-08-21/22 migration and no longer answers. The
   * stale value made this check fire a WARNING on a perfectly healthy router
   * and send the operator hunting an ISP hijack that was not happening.
   * `auth.`, `portal.`, `app.` and `master.wyfyguest.com` all resolve here —
   * one VM, four names — so this address moves whenever the app VM moves. */
  portalIp: "40.80.86.193" as Lit,
  portalBase: "https://auth.wyfyguest.com" as Lit,

  /** WireGuard interface name emitted by the FRONTEND generator. */
  wgInterface: "wg-cloudguest" as Lit,
  /** WireGuard interface name emitted by the BACKEND bootstrap path.
   * If both exist on one device the firewall rule is bound to the wrong
   * one. Detecting this is a hard FAIL, not a warning. */
  wgInterfaceBackendAlias: "wg-cloudguard" as Lit,
  wgListenPort: 13231,
  /** Hub endpoint. Was the bare IP `20.219.72.235` in earlier content;
   * the fleet has moved to a DNS name. A DNS name means the router MUST
   * be able to resolve it at the moment the WireGuard chunk is pasted. */
  hubEndpointHost: "hub.wyfyguest.com" as Lit,
  hubEndpointPort: 51820,
  /** Stale literal still present in `guided-setup/diagnostics.content.ts`.
   * Kept only so the wizard can recognise and call out an old config. */
  hubEndpointLegacyIp: "20.219.72.235" as Lit,

  tunnelSubnet: "10.20.0.0/24" as Lit,
  /** Hub's address inside the tunnel — also the RADIUS server address. */
  hubTunnelIp: "10.20.0.1" as Lit,

  radiusTimeout: "3s" as Lit,
  radiusService: "hotspot" as Lit,

  ntpServers: "216.239.35.0,162.159.200.1" as Lit,
  ntpServersList: ["216.239.35.0", "162.159.200.1"] as Lit[],
  timeZoneName: "Asia/Kolkata" as Lit,

  publicDnsServers: "8.8.8.8,1.1.1.1" as Lit,

  apiUserName: "cloudguest-api" as Lit,
  heartbeatSchedulerName: "cloudguest-heartbeat-sched" as Lit,
  heartbeatIntervalMinutes: 5,

  /** Every `comment=` tag the generator stamps on config it owns. The
   * wizard only ever touches rows carrying one of these. Anything else on
   * the device belongs to the venue or a previous engineer and is never
   * modified or removed. */
  ownedComments: [
    "cloudguest-plain-wan1",
    "cloudguest-route-wan1",
    "cloudguest-backup-wan1-via-wan2",
    "cloudguest-dhcp-wan1",
    "cloudguest-pppoe-wan1",
    "cloudguest-addr-wan1",
    "cloudguest-nat-wan1",
    "cloudguest-fw-established",
    "cloudguest-fw-drop-invalid",
    "cloudguest-fw-allow-lan",
    "cloudguest-fw-allow-icmp",
    "cloudguest-fw-drop-wan-input",
    "cloudguest-fw-fwd-established",
    "cloudguest-fw-fwd-drop-invalid",
    "cloudguest-fw-allow-wg-mgmt",
    "cloudguest-fw-block-wan-dns",
    "cloudguest-fw-block-wan-dns-tcp",
    "cloudguest-block-dot-udp",
    "cloudguest-block-dot-tcp",
    "cloudguest-block-doh",
    "cloudguest-portal",
    "cloudguest-portal-https",
    "cloudguest-hotspot-dns-name",
    "cloudguest-api",
    "cloudguest-doh",
  ] as Lit[],

  /** Every stock hotspot page the generator overwrites. `flash/` prefix is
   * MODEL-DEPENDENT — see `PORTAL_FILE_PATH_CANDIDATES`. */
  portalOverrideFiles: [
    "login.html",
    "rlogin.html",
    "alogin.html",
    "status.html",
    "logout.html",
  ] as Lit[],

  /** The generator hard-codes the first form. On a model without a `flash/`
   * mount the second form is the real path, and `/file set [find name=...]`
   * against the first SUCCEEDS SILENTLY while changing nothing. The wizard
   * MUST discover which one exists before pasting any redirect-page chunk. */
  portalFilePathCandidates: ["flash/hotspot/login.html", "hotspot/login.html"] as Lit[],

  // CERTIFICATE NAMES REMOVED. `caCertName` and `leafCertName` sat here
  // with zero consumers anywhere in the tree, naming two certificates the
  // generator stopped creating when the self-signed hotspot certificate
  // was deleted -- a router-signed cert in front of a guest produced a
  // full-screen security warning, and it decided the scheme of
  // `$(link-login-only)` as well, so the OTP posted to an endpoint no
  // browser trusted. Defaults that name objects nothing creates are how a
  // wizard starts describing a router that no longer exists.
  //
  // The literals themselves stay in `PROTECTED_TOKENS` and `types.ts` on
  // purpose: those registries exist so output pasted from an ALREADY
  // provisioned router is parsed and never translated, and the field fleet
  // still carries these certificates.

  /** Sentinel wrapper. Every probe this wizard emits is bracketed by these
   * so the parser can (a) prove the right command ran, (b) ignore terminal
   * junk around the paste, (c) detect a half-copied screen. */
  sentinelBegin: "WYFY-BEGIN" as Lit,
  sentinelEnd: "WYFY-END" as Lit,
} as const;

/** Where each default came from, and how much a builder may trust it. */
export const DEFAULT_PROVENANCE: Record<
  string,
  { source: "generator" | "field" | "briefed" | "unverified"; note: string }
> = {
  lanBridge: {
    source: "generator",
    note: 'RouterSetupScriptAdvanced.tsx:215 `lanBridge: "bridge"`. RouterFleetSetupWizard.tsx:249 defaults to `bridge1` — that path is wrong.',
  },
  wanInterface: { source: "generator", note: "wanIfs[0] default across the generator." },
  lanIpCidr: {
    source: "briefed",
    note: "Product owner. Generator takes lanIp as an input, not a constant.",
  },
  dhcpPoolRange: {
    source: "generator",
    note: "Derived in RouterDetailTabs.tsx from lanIp: `${base3}.10` .. `${base3}.254`.",
  },
  hotspotDnsName: { source: "generator", note: "RouterDetailTabs.tsx:1522 HOTSPOT_DNS_NAME." },
  portalHost: { source: "generator", note: "RouterDetailTabs.tsx:1542 GUEST_PORTAL_PUBLIC_BASE." },
  portalIp: {
    source: "field",
    note: "Verified 2026-08-22 by resolving portal.wyfyguest.com — 40.80.86.193, the app VM on the current Azure subscription. app. and master. resolve to the same host. Not derivable from the repo, and it moves whenever the app VM moves, so re-verify against DNS rather than trusting this literal. Treat a mismatch as WARNING, never FAIL.",
  },
  wgInterface: { source: "generator", note: "RouterDetailTabs.tsx WireGuard chunk." },
  wgListenPort: { source: "generator", note: "listen-port=13231 in the WireGuard chunk." },
  hubEndpointHost: {
    source: "briefed",
    note: "Product owner says the hub is now hub.wyfyguest.com. The generator reads serverEndpointHost from the backend, so this cannot be confirmed from the frontend repo. diagnostics.content.ts still documents 20.219.72.235:51820.",
  },
  hubEndpointPort: {
    source: "field",
    note: "Verified 2026-08-22 on the live hub (20.219.135.94): `wg show wg0 listen-port` returns 51820, with 62 peers attached.",
  },
  tunnelSubnet: { source: "briefed", note: "Product owner." },
  hubTunnelIp: { source: "briefed", note: "Product owner; matches diagnostics.content.ts." },
  ntpServers: {
    source: "field",
    note: "phases.content.ts clock phase, written from a live session.",
  },
  portalFilePathCandidates: {
    source: "field",
    note: "The `flash/` prefix is model-dependent — confirmed in the provisioning memory. The generator hard-codes the flash/ form.",
  },
  radiusTimeout: { source: "generator", note: "`/radius add ... timeout=3s`." },
  heartbeatIntervalMinutes: {
    source: "generator",
    note: "`/system scheduler add ... interval=5m`.",
  },
};
