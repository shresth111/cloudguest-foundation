/**
 * Manual MikroTik Configuration Wizard — steps 3-5.
 * WAN (three mutually exclusive variants) -> DNS -> internet validation.
 *
 * Step 3 is the single most dangerous step in the whole flow, because its
 * failure mode is a router that looks configured and has no internet:
 *
 *   `/import` never pauses. A script that adds a DHCP client and reads the
 *   lease's gateway microseconds later gets an empty gateway, writes a
 *   default route with gateway 0.0.0.0, and that route is permanently
 *   Inactive. Every ping then answers `no route to host` on a perfectly
 *   healthy WAN. The obvious guard — "is the gateway empty?" — passes,
 *   because 0.0.0.0 is not the empty string.
 *
 * That is why every gateway check in this file is `isIpv4` with
 * `excludeUnspecified: true`, never a non-empty test, and why the route's
 * ACTIVE state is scored separately from the route's existence.
 */

import type { ManualStep } from "./types";

export const STEPS_PART2: ManualStep[] = [
  // =====================================================================
  {
    id: "step03-wan-dhcp",
    n: 3,
    variant: "dhcp",
    selectWhen:
      "Use this variant when the venue's internet comes from a modem or ISP router that hands out addresses automatically. This is the common case.",
    title: "Internet connection — automatic address (DHCP)",
    why: "The router needs an address from the ISP, a default route that is actually active, and NAT so guests can get out. All three can be missing while the screen still looks fine. A default route with gateway {{0.0.0.0}} exists, is listed, and routes nothing.",
    dependsOn: ["step02-interfaces"],
    estMinutes: 5,
    oncePerRouter: false,
    configure: [
      {
        label: "Add the DHCP client on the internet port. Safe to run more than once.",
        script: `:local existing [/ip dhcp-client find where interface="ether1" comment="cloudguest-dhcp-wan1"]; :put ("existing-count=" . [:tostr [:len $existing]]); :if ([:len $existing] = 0) do={ /ip dhcp-client add interface="ether1" disabled=no add-default-route=no use-peer-dns=no comment="cloudguest-dhcp-wan1" }
:put ("after-count=" . [:tostr [:len [/ip dhcp-client find where interface="ether1" comment="cloudguest-dhcp-wan1"]]])`,
        oncePerRouter: false,
      },
      {
        label:
          "Wait for the lease, then write the default route from the real gateway. Run this AFTER the block above, not in the same paste.",
        script: `:local gw ""; :local c [/ip dhcp-client find where interface="ether1"]; :put ("client-count=" . [:tostr [:len $c]]); :if ([:len $c] > 0) do={ :for i from=1 to=20 do={ :if ($gw = "" || $gw = "0.0.0.0") do={ :do { :set gw [:tostr [/ip dhcp-client get [:pick $c 0] gateway]] } on-error={ :set gw "" } }; :if ($gw = "" || $gw = "0.0.0.0") do={ :delay 2s } } }; :put ("resolved-gateway=" . $gw); :if ($gw != "" && $gw != "0.0.0.0") do={ :local r [/ip route find where comment="cloudguest-plain-wan1"]; :if ([:len $r] = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$gw distance=1 check-gateway=ping comment="cloudguest-plain-wan1" } else={ /ip route set $r gateway=$gw distance=1 check-gateway=ping } }
:put ("route-count=" . [:tostr [:len [/ip route find where comment="cloudguest-plain-wan1"]]])`,
        oncePerRouter: false,
      },
      {
        label: "Add NAT so guest traffic can leave the router. Safe to run more than once.",
        script: `:local n [/ip firewall nat find where chain=srcnat out-interface="ether1" action=masquerade]; :put ("existing-count=" . [:tostr [:len $n]]); :if ([:len $n] = 0) do={ /ip firewall nat add chain=srcnat out-interface="ether1" action=masquerade comment="cloudguest-nat-wan1" }
:put ("after-count=" . [:tostr [:len [/ip firewall nat find where chain=srcnat out-interface="ether1" action=masquerade]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== WAN DHCP ===="
:put "WYFY-BEGIN step03-dhcp"
:local c [/ip dhcp-client find where interface="ether1"]; :put ("client-count=" . [:tostr [:len $c]]); :local c0 ""; :if ([:len $c] > 0) do={ :set c0 [:pick $c 0] }; :if ($c0 != "") do={ :put ("status=" . [:tostr [/ip dhcp-client get $c0 status]]) }; :if ($c0 != "") do={ :put ("address=" . [:tostr [/ip dhcp-client get $c0 address]]) }; :if ($c0 != "") do={ :put ("gateway=" . [:tostr [/ip dhcp-client get $c0 gateway]]) }; :if ($c0 != "") do={ :put ("add-default-route=" . [:tostr [/ip dhcp-client get $c0 add-default-route]]) }; :if ($c0 != "") do={ :put ("client-comment=" . [:tostr [/ip dhcp-client get $c0 comment]]) }; :put ("default-route-count=" . [:tostr [:len [/ip route find where dst-address="0.0.0.0/0"]]]); :foreach r in=[/ip route find where dst-address="0.0.0.0/0"] do={ :put ("route=" . [:tostr [/ip route get $r gateway]] . ";distance=" . [:tostr [/ip route get $r distance]] . ";comment=" . [:tostr [/ip route get $r comment]]) }; :local activeCount -1; :do { :set activeCount [:len [/ip route find where dst-address="0.0.0.0/0" active=yes]] } on-error={ :set activeCount -1 }; :put ("active-default-routes=" . [:tostr $activeCount]); :put ("nat-count=" . [:tostr [:len [/ip firewall nat find where chain=srcnat action=masquerade out-interface="ether1"]]]); :put ("ping-gateway=" . [:tostr [/ping [:tostr [/ip dhcp-client get $c0 gateway]] count=3]])
:put "WYFY-END step03-dhcp"
:put "===================="`,
      emits: [
        {
          key: "client-count",
          type: "int",
          required: true,
          describe:
            "How many DHCP clients are attached to the internet port. Should be exactly one.",
        },
        {
          key: "status",
          type: "string",
          required: false,
          describe:
            "{{bound}} means the ISP gave the router an address. searching means it is still asking.",
        },
        {
          key: "address",
          type: "ipv4cidr",
          required: false,
          describe: "The address the ISP gave this router.",
        },
        {
          key: "gateway",
          type: "ipv4",
          required: false,
          describe: "The ISP's own address, which the router sends all outbound traffic to.",
        },
        {
          key: "add-default-route",
          type: "bool",
          required: false,
          describe:
            "Whether RouterOS is adding its own default route. It must not — the setup manages the route itself.",
        },
        {
          key: "client-comment",
          type: "string",
          required: false,
          describe: "Which system created this DHCP client.",
        },
        {
          key: "default-route-count",
          type: "int",
          required: true,
          describe: "How many default routes exist at all.",
        },
        {
          key: "route",
          type: "string",
          multi: true,
          required: false,
          describe: "One row per default route: its gateway, its distance and its comment.",
        },
        {
          key: "active-default-routes",
          type: "int",
          required: true,
          describe:
            "How many of those routes are actually carrying traffic. A route can exist and be dead. -1 means this RouterOS version could not answer, and the flag column has to be read instead.",
        },
        {
          key: "nat-count",
          type: "int",
          required: true,
          describe:
            "Whether outbound traffic is being translated. Without it guests get an address and no internet.",
        },
        {
          key: "ping-gateway",
          type: "int",
          required: false,
          describe: "How many of three pings the ISP's gateway answered.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/ip dhcp-client print detail without-paging",
        purpose: "The full lease, in the router's own words.",
      },
      {
        command: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        purpose:
          "The default routes with their flag letters — the fallback when the active check could not answer.",
      },
      {
        command: `/interface ethernet monitor [find name="ether1"] once`,
        purpose: "Whether the cable and the far end are actually up.",
      },
    ],
    fingerprint: {
      sentinelId: "step03-dhcp",
      expectedMenu: "/ip dhcp-client",
      requireAllKeys: ["client-count", "default-route-count", "active-default-routes", "nat-count"],
      requireAnyKeys: ["status", "gateway"],
      forbidKeys: ["actual-mtu", "l2mtu", "address-pool", "html-directory"],
      discriminator:
        "This check prints client-count, status and gateway. A plain interface list prints a NAME/TYPE/ACTUAL-MTU table and never prints status={{bound}}. If you see MTU numbers, you ran the wrong command.",
      commonWrongPastes: [
        {
          menu: "/interface",
          tell: "ACTUAL-MTU",
          sayInstead:
            "That is the interface list. This step asks about the address the ISP gave the router, which is a different command — copy the block from this step exactly.",
        },
        {
          menu: "/ip address",
          tell: "NETWORK",
          sayInstead:
            "That is the address list. It shows what the router has, not whether the ISP lease is healthy. Run the block from this step.",
        },
        {
          menu: "/ip route",
          tell: "DST-ADDRESS",
          sayInstead:
            "That is the routing table on its own. This step needs the lease and the route together — run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "gte", key: "client-count", value: 1 },
          { op: "eq", key: "status", value: "bound" },
          { op: "isIpv4", key: "gateway", excludeUnspecified: true },
          { op: "gte", key: "active-default-routes", value: 1 },
          { op: "gte", key: "nat-count", value: 1 },
        ],
      },
      means:
        "The ISP has given this router an address and a real gateway, there is a live default route, and outbound traffic is being translated. The internet side is genuinely up.",
    },
    outcomes: [
      {
        id: "import-race-dead-route",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "status", value: "bound" },
            { op: "isIpv4", key: "gateway", excludeUnspecified: true },
            { op: "eq", key: "active-default-routes", value: 0 },
          ],
        },
        meaning:
          "This is the known one. The lease is healthy and the gateway is real, but the default route was written before the lease arrived, so it carries gateway {{0.0.0.0}} and is permanently inactive. Every ping answers no route to host on a router with a perfectly good internet connection. It only happens when the setup was applied as a file rather than pasted line by line.",
        nextCommand: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        lookFor:
          "A route whose gateway is {{0.0.0.0}} and whose flags contain I for inactive. That is the dead route.",
        fix: [
          {
            command: `:local gw [:tostr [/ip dhcp-client get [find where interface="ether1"] gateway]]; :put ("gateway-read=" . $gw); :local r [/ip route find where comment="cloudguest-plain-wan1"]; :put ("matching-routes=" . [:tostr [:len $r]]); :if ($gw != "" && $gw != "0.0.0.0" && [:len $r] > 0) do={ /ip route set $r gateway=$gw }; :if ($gw != "" && $gw != "0.0.0.0" && [:len $r] = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$gw distance=1 check-gateway=ping comment="cloudguest-plain-wan1" }`,
            note: "Reads the real gateway out of the lease and writes it into the route this setup owns. It prints what it read and how many rows it matched first, so a match of zero is visible instead of silently succeeding. It never touches a route that does not carry this setup's own comment.",
            destructive: false,
            confidence: "field",
          },
        ],
        resolverRef: "no-route-to-host",
        confidence: "field",
      },
      {
        id: "route-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "default-route-count", value: 0 },
        meaning:
          "There is no default route at all. The route step ran while the gateway was still empty and skipped itself without an error. Nothing on this router can reach the internet.",
        nextCommand: "/ip dhcp-client print detail without-paging",
        lookFor:
          "Whether status is {{bound}} and whether a gateway line is present with a real address.",
        fix: [
          {
            command: `:local gw [:tostr [/ip dhcp-client get [find where interface="ether1"] gateway]]; :put ("gateway-read=" . $gw); :if ($gw != "" && $gw != "0.0.0.0") do={ /ip route add dst-address=0.0.0.0/0 gateway=$gw distance=1 check-gateway=ping comment="cloudguest-plain-wan1" }
:put ("route-count=" . [:tostr [:len [/ip route find where comment="cloudguest-plain-wan1"]]])`,
            note: "Adds the default route from the live lease. If the printed gateway is empty, the lease has not arrived yet — wait 30 seconds and run it again rather than typing an address by hand.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "still-searching",
        verdict: "FAIL",
        when: { op: "eq", key: "status", value: "searching..." },
        meaning:
          "The router is asking for an address and getting no answer. Either the ISP cable is in the wrong socket, or the modem upstream is off or is not handing out addresses.",
        nextCommand: `/interface ethernet monitor [find name="ether1"] once`,
        lookFor:
          "The status line. {{no-link}} means the cable or the socket; {{link-ok}} together with searching means the cable is fine and the modem upstream is the problem.",
        confidence: "field",
      },
      {
        id: "bound-no-gateway",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "status", value: "bound" },
            { op: "not", of: { op: "isIpv4", key: "gateway", excludeUnspecified: true } },
          ],
        },
        meaning:
          "The router got an address but no gateway. The upstream device gave out an address without telling the router where to send traffic — usually a cheap or misconfigured modem. Rare, and it cannot be fixed on this router alone.",
        nextCommand: "/ip dhcp-client print detail without-paging",
        lookFor:
          "Whether a gateway line appears at all. If it is missing entirely, the venue's modem has to be fixed or the WAN has to be switched to a fixed address.",
        confidence: "field",
      },
      {
        id: "no-nat",
        verdict: "FAIL",
        when: { op: "eq", key: "nat-count", value: 0 },
        meaning:
          "Outbound translation is missing. The router itself will reach the internet and every guest will not. The symptom looks exactly like a broken portal, so it is usually chased in the wrong place for an hour.",
        fix: [
          {
            command: `:local n [/ip firewall nat find where chain=srcnat out-interface="ether1" action=masquerade]; :put ("existing-count=" . [:tostr [:len $n]]); :if ([:len $n] = 0) do={ /ip firewall nat add chain=srcnat out-interface="ether1" action=masquerade comment="cloudguest-nat-wan1" }
:put ("after-count=" . [:tostr [:len [/ip firewall nat find where chain=srcnat out-interface="ether1" action=masquerade]]])`,
            note: "Adds the translation rule. It prints the count before and after, so you can see it actually created something.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "no-dhcp-client",
        verdict: "FAIL",
        when: { op: "eq", key: "client-count", value: 0 },
        meaning:
          "There is no DHCP client on the internet port. Either this venue is on a fixed address and you are on the wrong variant of this step, or the configure block was never run.",
        nextCommand: `/ip address print detail without-paging where interface="ether1"`,
        lookFor:
          "A fixed address on {{ether1}}. If there is one, switch to the fixed-address variant of this step. If there is nothing, run the configure block above.",
        confidence: "field",
      },
      {
        id: "duplicate-dhcp-clients",
        verdict: "WARNING",
        when: { op: "gte", key: "client-count", value: 2 },
        meaning:
          "More than one DHCP client on the same port. They compete for the lease and the router can end up with two addresses on one interface. Usually a factory-default client that was never cleaned up.",
        nextCommand: "/ip dhcp-client print detail without-paging",
        lookFor:
          "Which row carries the comment cloudguest-dhcp-wan1. Every other row on {{ether1}} is the leftover.",
        fix: [
          {
            command: `:local foreign [/ip dhcp-client find where interface="ether1" !comment="cloudguest-dhcp-wan1"]; :put ("removing-count=" . [:tostr [:len $foreign]]); :if ([:len $foreign] > 0) do={ /ip dhcp-client remove $foreign }`,
            note: "Removes only DHCP clients on {{ether1}} that this setup did not create. It prints how many it matched first. It never touches a client on any other interface.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "routeros-owns-default-route",
        verdict: "WARNING",
        when: { op: "eq", key: "add-default-route", value: true },
        meaning:
          "RouterOS is adding its own default route from the lease. That route is unmonitored and competes with the one this setup manages, so failover behaves unpredictably. Not urgent, but it should be turned off.",
        fix: [
          {
            command: `:local c [/ip dhcp-client find where interface="ether1"]; :put ("matching-count=" . [:tostr [:len $c]]); :if ([:len $c] > 0) do={ /ip dhcp-client set $c add-default-route=no }`,
            note: "Turns off RouterOS's own route for this client only. The count is printed first so a match of zero cannot pass as done.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "active-unknown",
        verdict: "UNKNOWN",
        when: { op: "eq", key: "active-default-routes", value: -1 },
        meaning:
          "This RouterOS version would not answer whether the route is live, so the check cannot decide on its own. The flag letters in the routing table will say.",
        nextCommand: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        lookFor:
          "The Flags legend the router prints at the top, then the flag letters on the {{0.0.0.0/0}} row. The letter that the legend maps to active must be present, and the one it maps to inactive must not.",
        confidence: "standard-routeros",
      },
      {
        id: "gateway-not-answering",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "isIpv4", key: "gateway", excludeUnspecified: true },
            { op: "eq", key: "ping-gateway", value: 0 },
            { op: "gte", key: "active-default-routes", value: 1 },
          ],
        },
        meaning:
          "The gateway does not answer pings but the route is still live. Many ISP routers block pings on purpose, so this alone is not a fault — but if step 5 also fails, this is the first thing to blame.",
        confidence: "field",
      },
    ],
    stopGate:
      "Do not go past this step until a default route is live with a real gateway. The tunnel, RADIUS and the guest portal all ride on it, and all three fail quietly without it.",
  },

  // =====================================================================
  {
    id: "step03-wan-static",
    n: 3,
    variant: "static",
    selectWhen:
      "Use this variant when the ISP has given the venue a fixed address, netmask and gateway on paper. Nothing is discovered automatically here.",
    title: "Internet connection — fixed address",
    why: "With a fixed address nothing is negotiated, so nothing self-heals either. A single wrong digit in the gateway produces exactly the same symptom as a dead cable, and the router will never correct it on its own.",
    dependsOn: ["step02-interfaces"],
    estMinutes: 5,
    oncePerRouter: false,
    configure: [
      {
        label:
          "Set the fixed address and route. Replace the three placeholder values with what the ISP gave the venue, and change nothing else.",
        script: `:local wanIp "REPLACE-ADDRESS/REPLACE-PREFIX"; :local wanGw "REPLACE-GATEWAY"; :foreach a in=[/ip address find where interface="ether1" dynamic=yes] do={ /ip address remove $a }; :local existing [/ip address find where interface="ether1" address=$wanIp]; :put ("existing-count=" . [:tostr [:len $existing]]); :if ([:len $existing] = 0) do={ /ip address add address=$wanIp interface="ether1" comment="cloudguest-addr-wan1" }; :local r [/ip route find where comment="cloudguest-plain-wan1"]; :if ([:len $r] = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$wanGw distance=1 check-gateway=ping comment="cloudguest-plain-wan1" } else={ /ip route set $r gateway=$wanGw distance=1 check-gateway=ping }
:local n [/ip firewall nat find where chain=srcnat out-interface="ether1" action=masquerade]; :if ([:len $n] = 0) do={ /ip firewall nat add chain=srcnat out-interface="ether1" action=masquerade comment="cloudguest-nat-wan1" }
:put ("address-count=" . [:tostr [:len [/ip address find where interface="ether1"]]])
:put ("route-count=" . [:tostr [:len [/ip route find where comment="cloudguest-plain-wan1"]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== WAN STATIC ===="
:put "WYFY-BEGIN step03-static"
:local a [/ip address find where interface="ether1"]; :put ("address-count=" . [:tostr [:len $a]]); :foreach x in=$a do={ :put ("addr=" . [:tostr [/ip address get $x address]] . ";dynamic=" . [:tostr [/ip address get $x dynamic]] . ";disabled=" . [:tostr [/ip address get $x disabled]] . ";comment=" . [:tostr [/ip address get $x comment]]) }
:put ("default-route-count=" . [:tostr [:len [/ip route find where dst-address="0.0.0.0/0"]]])
:local gw ""; :local r [/ip route find where comment="cloudguest-plain-wan1"]; :put ("owned-route-count=" . [:tostr [:len $r]]); :if ([:len $r] > 0) do={ :set gw [:tostr [/ip route get [:pick $r 0] gateway]] }; :put ("gateway=" . $gw); :local activeCount -1; :do { :set activeCount [:len [/ip route find where dst-address="0.0.0.0/0" active=yes]] } on-error={ :set activeCount -1 }; :put ("active-default-routes=" . [:tostr $activeCount]); :put ("nat-count=" . [:tostr [:len [/ip firewall nat find where chain=srcnat action=masquerade out-interface="ether1"]]]); :if ($gw != "" && $gw != "0.0.0.0") do={ :put ("ping-gateway=" . [:tostr [/ping $gw count=3]]) }
:put "WYFY-END step03-static"
:put "===================="`,
      emits: [
        {
          key: "address-count",
          type: "int",
          required: true,
          describe: "How many addresses sit on the internet port. Should be exactly one.",
        },
        {
          key: "addr",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each address on the port, and whether it was configured by hand or left over from an automatic lease.",
        },
        {
          key: "default-route-count",
          type: "int",
          required: true,
          describe: "How many default routes exist.",
        },
        {
          key: "owned-route-count",
          type: "int",
          required: true,
          describe: "How many default routes this setup created. Should be exactly one.",
        },
        {
          key: "gateway",
          type: "ipv4",
          required: true,
          describe: "The address the router sends outbound traffic to.",
        },
        {
          key: "active-default-routes",
          type: "int",
          required: true,
          describe:
            "How many default routes are actually carrying traffic. -1 means the version could not answer.",
        },
        {
          key: "nat-count",
          type: "int",
          required: true,
          describe: "Whether outbound translation is in place.",
        },
        {
          key: "ping-gateway",
          type: "int",
          required: false,
          describe: "How many of three pings the gateway answered.",
        },
      ],
    },
    contextCommands: [
      {
        command: `/ip address print detail without-paging where interface="ether1"`,
        purpose: "Every address on the internet port, including leftovers.",
      },
      {
        command: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        purpose: "The default routes with their flag letters.",
      },
    ],
    fingerprint: {
      sentinelId: "step03-static",
      expectedMenu: "/ip address",
      requireAllKeys: [
        "address-count",
        "owned-route-count",
        "gateway",
        "active-default-routes",
        "nat-count",
      ],
      forbidKeys: ["add-default-route", "use-peer-dns", "actual-mtu"],
      discriminator:
        "This check prints address-count and owned-route-count. If what you pasted mentions add-default-route or use-peer-dns, that is the automatic-address check and you are on the wrong variant of this step.",
      commonWrongPastes: [
        {
          menu: "/ip dhcp-client",
          tell: "use-peer-dns",
          sayInstead:
            "That is the automatic-address check. This venue is on a fixed address, so run the block from this step instead.",
        },
        {
          menu: "/interface",
          tell: "ACTUAL-MTU",
          sayInstead: "That is the interface list. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "address-count", value: 1 },
          { op: "eq", key: "owned-route-count", value: 1 },
          { op: "isIpv4", key: "gateway", excludeUnspecified: true },
          { op: "gte", key: "active-default-routes", value: 1 },
          { op: "gte", key: "nat-count", value: 1 },
        ],
      },
      means:
        "One fixed address on the internet port, one live default route pointing at a real gateway, and outbound translation in place.",
    },
    outcomes: [
      {
        id: "static-route-inactive",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "isIpv4", key: "gateway", excludeUnspecified: true },
            { op: "eq", key: "active-default-routes", value: 0 },
          ],
        },
        meaning:
          "The route has a real gateway written into it, but the router has marked it dead because the gateway does not answer. With a fixed address that almost always means the gateway address is wrong by a digit, or the address and the gateway are not on the same subnet.",
        nextCommand: `/ip address print detail without-paging where interface="ether1"`,
        lookFor:
          "The address and its prefix. Check by hand that the gateway falls inside that same range — this is the mistake in nine cases out of ten.",
        confidence: "field",
      },
      {
        id: "static-leftover-dynamic",
        verdict: "FAIL",
        when: { op: "gte", key: "address-count", value: 2 },
        meaning:
          "More than one address on the internet port. Usually the fixed address plus a leftover automatic one from an earlier attempt. The router picks a source address unpredictably and traffic goes out with the wrong one.",
        nextCommand: `/ip address print detail without-paging where interface="ether1"`,
        lookFor: "Which rows are marked dynamic. Those are the leftovers.",
        fix: [
          {
            command: `:local d [/ip address find where interface="ether1" dynamic=yes]; :put ("removing-count=" . [:tostr [:len $d]]); :if ([:len $d] > 0) do={ /ip address remove $d }`,
            note: "Removes only automatically-assigned addresses on the internet port. The fixed address configured by hand is never touched.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "static-no-address",
        verdict: "FAIL",
        when: { op: "eq", key: "address-count", value: 0 },
        meaning:
          "No address on the internet port at all. The configure block was never run, or it was run with the placeholder values still in it.",
        confidence: "field",
      },
      {
        id: "static-no-route",
        verdict: "FAIL",
        when: { op: "eq", key: "owned-route-count", value: 0 },
        meaning:
          "No default route created by this setup. The router has an address and nowhere to send traffic.",
        confidence: "field",
      },
      {
        id: "static-no-nat",
        verdict: "FAIL",
        when: { op: "eq", key: "nat-count", value: 0 },
        meaning:
          "Outbound translation is missing. The router reaches the internet and guests do not, which looks exactly like a broken portal.",
        confidence: "generator",
      },
      {
        id: "static-active-unknown",
        verdict: "UNKNOWN",
        when: { op: "eq", key: "active-default-routes", value: -1 },
        meaning:
          "This RouterOS version would not answer whether the route is live. Read the flag letters instead.",
        nextCommand: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        lookFor: "The Flags legend printed at the top, then the letters on the {{0.0.0.0/0}} row.",
        confidence: "standard-routeros",
      },
      {
        id: "static-duplicate-routes",
        verdict: "WARNING",
        when: { op: "gte", key: "owned-route-count", value: 2 },
        meaning:
          "This setup has created its default route more than once. Only one will be used and the others confuse every later diagnosis.",
        nextCommand: `/ip route print detail without-paging where comment="cloudguest-plain-wan1"`,
        lookFor: "How many rows carry the same comment, and whether their gateways differ.",
        confidence: "generator",
      },
    ],
    stopGate:
      "Do not go past this step until a default route is live with a real gateway. On a fixed address nothing corrects itself later.",
  },

  // =====================================================================
  {
    id: "step03-wan-pppoe",
    n: 3,
    variant: "pppoe",
    selectWhen:
      "Use this variant when the ISP gave the venue a username and password for the internet connection, which is common on fibre and DSL lines in India.",
    title: "Internet connection — username and password (PPPoE)",
    why: "PPPoE builds a second, virtual interface on top of the physical port, and every later command has to name that virtual one. The gateway is not stored as a property the way an automatic lease's is — it only exists while the session is up, which is why the usual gateway check comes back empty on a connection that is actually fine.",
    dependsOn: ["step02-interfaces"],
    estMinutes: 6,
    oncePerRouter: false,
    configure: [
      {
        label:
          "Create the PPPoE session. Replace the username and password with what the ISP gave the venue, and change nothing else.",
        script: `:local pppUser "REPLACE-USERNAME"; :local pppPass "REPLACE-PASSWORD"; :local existing [/interface pppoe-client find where name="cloudguest-pppoe-wan1"]; :put ("existing-count=" . [:tostr [:len $existing]]); :if ([:len $existing] = 0) do={ /interface pppoe-client add name="cloudguest-pppoe-wan1" interface="ether1" user=$pppUser password=$pppPass disabled=no add-default-route=no comment="cloudguest-pppoe-wan1" }
:put ("after-count=" . [:tostr [:len [/interface pppoe-client find where name="cloudguest-pppoe-wan1"]]])`,
        oncePerRouter: false,
      },
      {
        label:
          "Once the session is connected, write the route and the translation rule. Run this AFTER the block above, not in the same paste.",
        script: `:local gw ""; :do { :set gw [:tostr ([/interface pppoe-client monitor [find name="cloudguest-pppoe-wan1"] once as-value]->"remote-address")] } on-error={ :set gw "" }; :put ("resolved-gateway=" . $gw); :if ($gw != "" && $gw != "0.0.0.0") do={ :local r [/ip route find where comment="cloudguest-plain-wan1"]; :if ([:len $r] = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$gw distance=1 check-gateway=ping comment="cloudguest-plain-wan1" } else={ /ip route set $r gateway=$gw distance=1 check-gateway=ping } }
:local n [/ip firewall nat find where chain=srcnat out-interface="cloudguest-pppoe-wan1" action=masquerade]; :if ([:len $n] = 0) do={ /ip firewall nat add chain=srcnat out-interface="cloudguest-pppoe-wan1" action=masquerade comment="cloudguest-nat-wan1" }
:put ("route-count=" . [:tostr [:len [/ip route find where comment="cloudguest-plain-wan1"]]])
:put ("nat-count=" . [:tostr [:len [/ip firewall nat find where chain=srcnat out-interface="cloudguest-pppoe-wan1" action=masquerade]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== WAN PPPOE ===="
:put "WYFY-BEGIN step03-pppoe"
:local p [/interface pppoe-client find where name="cloudguest-pppoe-wan1"]; :put ("client-count=" . [:tostr [:len $p]]); :put ("any-pppoe-count=" . [:tostr [:len [/interface pppoe-client find]]]); :local p0 ""; :if ([:len $p] > 0) do={ :set p0 [:pick $p 0] }; :if ($p0 != "") do={ :put ("running=" . [:tostr [/interface pppoe-client get $p0 running]]) }; :if ($p0 != "") do={ :put ("disabled=" . [:tostr [/interface pppoe-client get $p0 disabled]]) }; :if ($p0 != "") do={ :put ("parent=" . [:tostr [/interface pppoe-client get $p0 interface]]) }
:local remote ""; :do { :set remote [:tostr ([/interface pppoe-client monitor [find name="cloudguest-pppoe-wan1"] once as-value]->"remote-address")] } on-error={ :set remote "" }; :put ("remote-address=" . $remote)
:local local ""; :do { :set local [:tostr ([/interface pppoe-client monitor [find name="cloudguest-pppoe-wan1"] once as-value]->"local-address")] } on-error={ :set local "" }; :put ("local-address=" . $local)
:local st ""; :do { :set st [:tostr ([/interface pppoe-client monitor [find name="cloudguest-pppoe-wan1"] once as-value]->"status")] } on-error={ :set st "" }; :put ("session-status=" . $st)
:put ("owned-route-count=" . [:tostr [:len [/ip route find where comment="cloudguest-plain-wan1"]]])
:local activeCount -1; :do { :set activeCount [:len [/ip route find where dst-address="0.0.0.0/0" active=yes]] } on-error={ :set activeCount -1 }; :put ("active-default-routes=" . [:tostr $activeCount])
:put ("nat-count=" . [:tostr [:len [/ip firewall nat find where chain=srcnat action=masquerade out-interface="cloudguest-pppoe-wan1"]]])
:put "WYFY-END step03-pppoe"
:put "===================="`,
      emits: [
        {
          key: "client-count",
          type: "int",
          required: true,
          describe: "Whether the session this setup expects exists, by name.",
        },
        {
          key: "any-pppoe-count",
          type: "int",
          required: true,
          describe:
            "How many PPPoE sessions of any name exist. More than one means an earlier attempt was left behind.",
        },
        {
          key: "running",
          type: "bool",
          required: false,
          describe: "Whether the session is connected right now.",
        },
        {
          key: "disabled",
          type: "bool",
          required: false,
          describe: "Whether the session has been switched off.",
        },
        {
          key: "parent",
          type: "string",
          required: false,
          describe: "The physical port the session runs over. Should be {{ether1}}.",
        },
        {
          key: "remote-address",
          type: "ipv4",
          required: true,
          describe:
            "The ISP's end of the session. This is the gateway. Empty means the session is not up.",
        },
        {
          key: "local-address",
          type: "ipv4",
          required: false,
          describe: "The address the ISP assigned to this router.",
        },
        {
          key: "session-status",
          type: "string",
          required: false,
          describe:
            "What the session is doing right now — {{connected}}, dialling, or an authentication failure.",
        },
        {
          key: "owned-route-count",
          type: "int",
          required: true,
          describe: "How many default routes this setup created.",
        },
        {
          key: "active-default-routes",
          type: "int",
          required: true,
          describe: "How many default routes are live. -1 means the version could not answer.",
        },
        {
          key: "nat-count",
          type: "int",
          required: true,
          describe:
            "Whether outbound translation is bound to the virtual PPPoE interface, not to the physical port.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/interface pppoe-client print detail without-paging",
        purpose: "The session's full configuration.",
      },
      {
        command: `/interface pppoe-client monitor [find name="cloudguest-pppoe-wan1"] once`,
        purpose: "The live session state and both ends of the link.",
      },
      {
        command: `/log print without-paging where topics~"ppp"`,
        purpose: "Authentication failures, which are logged and are not visible anywhere else.",
      },
    ],
    fingerprint: {
      sentinelId: "step03-pppoe",
      expectedMenu: "/interface pppoe-client",
      requireAllKeys: [
        "client-count",
        "any-pppoe-count",
        "remote-address",
        "owned-route-count",
        "nat-count",
      ],
      forbidKeys: ["use-peer-dns", "address-pool", "actual-mtu"],
      discriminator:
        "This check prints remote-address and session-status. If what you pasted has use-peer-dns in it, that is the automatic-address check and this venue is not on that.",
      commonWrongPastes: [
        {
          menu: "/interface",
          tell: "ACTUAL-MTU",
          sayInstead:
            "That is the interface list. It does show the PPPoE interface, but not whether the session is actually connected. Run the block from this step.",
        },
        {
          menu: "/ppp secret",
          tell: "SERVICE",
          sayInstead:
            "That is the list of accounts this router hands out to others. This step is about the account the ISP gave you. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "client-count", value: 1 },
          { op: "eq", key: "running", value: true },
          { op: "isIpv4", key: "remote-address", excludeUnspecified: true },
          { op: "eq", key: "owned-route-count", value: 1 },
          { op: "gte", key: "active-default-routes", value: 1 },
          { op: "gte", key: "nat-count", value: 1 },
        ],
      },
      means:
        "The session is connected, the ISP's end has a real address, the default route points at it, and translation is bound to the virtual interface.",
    },
    outcomes: [
      {
        id: "pppoe-not-running",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "client-count", value: 1 },
            { op: "eq", key: "running", value: false },
          ],
        },
        meaning:
          "The session exists but is not connected. Almost always a wrong username or password, or the ISP has not enabled the line yet. This does not show up as an error anywhere on screen — it only appears in the log.",
        nextCommand: `/log print without-paging where topics~"ppp"`,
        lookFor:
          "A line mentioning authentication failed, which means the credentials are wrong, versus a line about no reply or timeout, which means the ISP line itself is not up.",
        confidence: "standard-routeros",
      },
      {
        id: "pppoe-still-negotiating",
        verdict: "UNKNOWN",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "running", value: true },
            { op: "not", of: { op: "isIpv4", key: "remote-address", excludeUnspecified: true } },
          ],
        },
        meaning:
          "The session reports as running but has not been given the far end's address yet. Wait fifteen seconds and run the check again before changing anything. If it is still empty after a minute, treat the session as not connected.",
        nextCommand: `/interface pppoe-client monitor [find name="cloudguest-pppoe-wan1"] once`,
        lookFor: "The status line, and whether a remote-address appears at all.",
        confidence: "generator",
      },
      {
        id: "pppoe-nat-on-wrong-interface",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "running", value: true },
            { op: "eq", key: "nat-count", value: 0 },
          ],
        },
        meaning:
          "Translation is missing on the virtual PPPoE interface. If it was put on the physical port instead, it silently matches nothing — traffic leaves the router untranslated and the ISP drops it. Guests get an address and no internet.",
        nextCommand: "/ip firewall nat print detail without-paging where action=masquerade",
        lookFor:
          "The out-interface on each masquerade rule. It must name the PPPoE interface, not {{ether1}}.",
        fix: [
          {
            command: `:local n [/ip firewall nat find where chain=srcnat out-interface="cloudguest-pppoe-wan1" action=masquerade]; :put ("existing-count=" . [:tostr [:len $n]]); :if ([:len $n] = 0) do={ /ip firewall nat add chain=srcnat out-interface="cloudguest-pppoe-wan1" action=masquerade comment="cloudguest-nat-wan1" }
:put ("after-count=" . [:tostr [:len [/ip firewall nat find where chain=srcnat out-interface="cloudguest-pppoe-wan1" action=masquerade]]])`,
            note: "Adds the rule against the virtual interface. It leaves any existing rule on the physical port alone — that one is harmless, just useless.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "pppoe-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "client-count", value: 0 },
        meaning:
          "The session this setup expects does not exist by name. Either it was never created, or an earlier attempt created it under RouterOS's own automatic name, which no later command in this setup will match.",
        nextCommand: "/interface pppoe-client print detail without-paging",
        lookFor:
          "Whether a session exists under some other name, such as pppoe-out1. If it does, that is why nothing else lines up.",
        confidence: "generator",
      },
      {
        id: "pppoe-extra-sessions",
        verdict: "WARNING",
        when: { op: "gte", key: "any-pppoe-count", value: 2 },
        meaning:
          "More than one PPPoE session on this router. Both will try to dial the same line and the ISP usually accepts only one, so which one wins changes between reboots.",
        nextCommand: "/interface pppoe-client print detail without-paging",
        lookFor:
          "Which rows do not carry the comment cloudguest-pppoe-wan1. Those are the leftovers.",
        confidence: "generator",
      },
      {
        id: "pppoe-wrong-parent",
        verdict: "WARNING",
        when: { op: "neq", key: "parent", value: "ether1" },
        meaning:
          "The session is dialling over a port other than {{ether1}}. That may be deliberate at this venue, but every other step in this wizard assumes {{ether1}} is the internet side.",
        confidence: "generator",
      },
      {
        id: "pppoe-active-unknown",
        verdict: "UNKNOWN",
        when: { op: "eq", key: "active-default-routes", value: -1 },
        meaning:
          "This RouterOS version would not answer whether the route is live. Read the flag letters instead.",
        nextCommand: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        lookFor: "The Flags legend printed at the top, then the letters on the {{0.0.0.0/0}} row.",
        confidence: "standard-routeros",
      },
    ],
    stopGate:
      "Do not go past this step until the session is connected and the route is live. A PPPoE session that is down looks identical on screen to one that is up.",
  },

  // =====================================================================
  {
    id: "step04-dns",
    n: 4,
    title: "Name lookup",
    why: "Guests reach the router for name lookups, so the router has to answer them — and that same setting turns the router into an open resolver on the internet side unless two firewall rules block it. Several later steps look healthy and quietly do nothing when name lookup is broken: the portal walled-garden step resolves the portal's address at the moment it runs, and if that fails it writes nothing and reports nothing.",
    dependsOn: ["step03-wan-dhcp"],
    estMinutes: 3,
    oncePerRouter: false,
    configure: [
      {
        label: "Set the name servers and let clients use the router for lookups.",
        script: `/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes
:put ("servers=" . [:tostr [/ip dns get servers]])
:put ("allow-remote-requests=" . [:tostr [/ip dns get allow-remote-requests]])`,
        oncePerRouter: false,
      },
      {
        label:
          "Block name lookups arriving from the internet side, so this router is not an open resolver.",
        script: `:local u [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns"]; :if ([:len $u] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=udp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns" }
:local t [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns-tcp"]; :if ([:len $t] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=tcp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns-tcp" }
:put ("udp-rule-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns"]]])
:put ("tcp-rule-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns-tcp"]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== DNS ===="
:put "WYFY-BEGIN step04"
:put ("servers=" . [:tostr [/ip dns get servers]])
:local dyn ""; :do { :set dyn [:tostr [/ip dns get dynamic-servers]] } on-error={ :set dyn "" }; :put ("dynamic-servers=" . $dyn)
:put ("allow-remote-requests=" . [:tostr [/ip dns get allow-remote-requests]])
:put ("cache-size=" . [:tostr [/ip dns get cache-size]])
:local pip ""; :do { :set pip [:tostr [:resolve "auth.wyfyguest.com"]] } on-error={ :set pip "" }; :put ("portal-ip=" . $pip)
:local hip ""; :do { :set hip [:tostr [:resolve "hub.wyfyguest.com"]] } on-error={ :set hip "" }; :put ("hub-ip=" . $hip)
:put ("wan-list-count=" . [:tostr [:len [/interface list find where name="WAN"]]])
:put ("wan-list-members=" . [:tostr [:len [/interface list member find where list="WAN"]]])
:put ("block-dns-udp-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns"]]])
:put ("block-dns-tcp-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns-tcp"]]])
:put ("hotspot-dns-static-count=" . [:tostr [:len [/ip dns static find where name="wifi.wyfyguest.com"]]])
:put "WYFY-END step04"
:put "===================="`,
      emits: [
        {
          key: "servers",
          type: "csv",
          required: true,
          describe: "The name servers this router uses and hands to guests.",
        },
        {
          key: "dynamic-servers",
          type: "csv",
          required: false,
          describe: "Name servers the ISP pushed automatically. Informational.",
        },
        {
          key: "allow-remote-requests",
          type: "bool",
          required: true,
          describe:
            "Whether guests may use this router for lookups. Must be on, or no guest can browse.",
        },
        {
          key: "cache-size",
          type: "int",
          required: false,
          describe: "Lookup cache size. Informational.",
        },
        {
          key: "portal-ip",
          type: "ipv4",
          required: true,
          describe: "The address the router gets for the portal. Empty means lookups are broken.",
        },
        {
          key: "hub-ip",
          type: "ipv4",
          required: true,
          describe:
            "The address the router gets for the tunnel hub. Empty here means step 8 will silently build a tunnel that points nowhere.",
        },
        {
          key: "wan-list-count",
          type: "int",
          required: true,
          describe:
            "Whether the WAN interface list exists. The two blocking rules below are written against it.",
        },
        {
          key: "wan-list-members",
          type: "int",
          required: true,
          describe:
            "How many interfaces are in that list. A list with no members makes the blocking rules match nothing while still appearing in the rule table.",
        },
        {
          key: "block-dns-udp-count",
          type: "int",
          required: true,
          describe: "Whether lookups from the internet side are blocked.",
        },
        {
          key: "block-dns-tcp-count",
          type: "int",
          required: true,
          describe: "Whether lookups from the internet side are blocked over TCP as well.",
        },
        {
          key: "hotspot-dns-static-count",
          type: "int",
          required: false,
          describe:
            "Whether the hotspot's own name already points at the router. Step 16 creates this.",
        },
      ],
    },
    contextCommands: [
      { command: "/ip dns print without-paging", purpose: "The full name lookup configuration." },
      {
        command: "/interface list member print without-paging",
        purpose: "Which interfaces are in the WAN list the blocking rules depend on.",
      },
    ],
    fingerprint: {
      sentinelId: "step04",
      expectedMenu: "/ip dns",
      requireAllKeys: ["servers", "allow-remote-requests", "portal-ip", "hub-ip", "wan-list-count"],
      forbidKeys: ["add-default-route", "address-pool", "dst-address"],
      discriminator:
        "This check prints servers and allow-remote-requests together with a resolved portal-ip. If what you pasted has no portal-ip line, it is not this check.",
      commonWrongPastes: [
        {
          menu: "/ip dns cache",
          tell: "TTL",
          sayInstead:
            "That is the lookup cache contents, not the configuration. Run the block from this step.",
        },
        {
          menu: "/ip dns static",
          tell: "NAME",
          sayInstead: "That is the fixed name list. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "allow-remote-requests", value: true },
          { op: "present", key: "servers" },
          { op: "isIpv4", key: "portal-ip", excludeUnspecified: true },
          { op: "isIpv4", key: "hub-ip", excludeUnspecified: true },
        ],
      },
      means: "The router can look names up, and it will answer lookups for guests.",
    },
    outcomes: [
      {
        id: "dns-cannot-resolve",
        verdict: "FAIL",
        when: { op: "not", of: { op: "isIpv4", key: "portal-ip", excludeUnspecified: true } },
        meaning:
          "The router cannot turn a name into an address. Nothing that follows will work, and several of the later steps will fail without saying so — the portal walled-garden step in particular writes nothing at all when a lookup fails, and reports success anyway.",
        nextCommand: "/ping 8.8.8.8 count=4",
        lookFor:
          "Whether raw addresses are reachable. If pings succeed but names do not resolve, this is only a name-server problem. If pings fail too, go back to step 3.",
        fix: [
          {
            command: `/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes
:put ("servers=" . [:tostr [/ip dns get servers]])`,
            note: "Sets public name servers and lets guests use the router. It prints the result back so you can see the value actually landed.",
            destructive: false,
            confidence: "field",
          },
        ],
        resolverRef: "dns-resolve-failed",
        confidence: "field",
      },
      {
        id: "dns-remote-requests-off",
        verdict: "FAIL",
        when: { op: "eq", key: "allow-remote-requests", value: false },
        meaning:
          "Guests cannot use the router for name lookups. Every guest device will show connected with no working browsing, and the portal will not open either.",
        fix: [
          {
            command: `/ip dns set allow-remote-requests=yes
:put ("allow-remote-requests=" . [:tostr [/ip dns get allow-remote-requests]])`,
            note: "Turns it on and prints the result back.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "hub-name-unresolvable",
        verdict: "FAIL",
        when: { op: "not", of: { op: "isIpv4", key: "hub-ip", excludeUnspecified: true } },
        meaning:
          "The tunnel hub's name does not resolve. The tunnel step accepts a name and resolves it when the peer is created, so building the tunnel now would produce a peer pointing at nothing — and it would look completely normal in the configuration.",
        nextCommand: "/ping 8.8.8.8 count=4",
        lookFor:
          "Whether the internet is up at all. If it is, and only this one name fails, escalate — the hub's DNS record may be wrong rather than the router.",
        confidence: "briefed",
      },
      {
        id: "portal-ip-unexpected",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "isIpv4", key: "portal-ip", excludeUnspecified: true },
            { op: "neq", key: "portal-ip", value: "40.80.86.193" },
          ],
        },
        meaning:
          "The portal resolves to an address other than the one this wizard expects. Two possibilities and they need different responses: the portal genuinely moved, in which case this wizard's expected value is out of date and should be updated; or the venue's ISP is intercepting lookups, in which case guests will be sent somewhere wrong. Confirm the current address in Master console before continuing. Do not simply accept whatever the router printed.",
        nextCommand: "/ip dns cache print without-paging",
        lookFor:
          "Whether the answer came from the router's own cache or fresh from the configured name server.",
        confidence: "briefed",
      },
      {
        id: "open-resolver",
        verdict: "WARNING",
        when: {
          op: "any",
          of: [
            { op: "eq", key: "block-dns-udp-count", value: 0 },
            { op: "eq", key: "block-dns-tcp-count", value: 0 },
          ],
        },
        meaning:
          "Guests can use this router for lookups and so can the whole internet. An open resolver on a public address gets found within days and used to attack other people, and the venue's ISP will eventually cut the line. Not a guest-facing fault, but it must not ship.",
        fix: [
          {
            command: `:local u [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns"]; :if ([:len $u] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=udp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns" }
:local t [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns-tcp"]; :if ([:len $t] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=tcp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns-tcp" }
:put ("udp-rule-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns"]]])
:put ("tcp-rule-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns-tcp"]]])`,
            note: "Adds both blocking rules if they are missing. They only affect lookups arriving from the internet side; guests are unaffected.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "wan-list-empty",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "block-dns-udp-count", value: 1 },
            { op: "eq", key: "wan-list-members", value: 0 },
          ],
        },
        meaning:
          "The blocking rules exist but the WAN list they are written against is empty, so they match nothing. The rule table looks correct and protects nothing. This is exactly the shape of failure this wizard exists to catch.",
        nextCommand: "/interface list member print without-paging",
        lookFor: "Whether any interface is listed under WAN.",
        fix: [
          {
            command: `:local m [/interface list member find where interface="ether1" list="WAN"]; :put ("existing-count=" . [:tostr [:len $m]]); :if ([:len $m] = 0) do={ /interface list member add list="WAN" interface="ether1" }
:put ("after-count=" . [:tostr [:len [/interface list member find where list="WAN"]]])`,
            note: "Puts the internet port into the WAN list. If this venue is on PPPoE, use the PPPoE interface name here instead of {{ether1}}.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "no-servers-configured",
        verdict: "WARNING",
        when: { op: "absent", key: "servers" },
        meaning:
          "No name servers are configured by hand. The router may still be working from what the ISP pushed automatically, which disappears the moment the ISP link is renegotiated.",
        confidence: "generator",
      },
    ],
    stopGate:
      "Do not go past this step while name lookup is broken. Later steps will report success and write nothing.",
  },

  // =====================================================================
  {
    id: "step05-internet-validation",
    n: 5,
    title: "Proof that the internet actually works",
    why: "Steps 3 and 4 check configuration. This step checks reality, and it checks it in three separate ways because each one can pass while the others fail: raw reachability by address, name lookup, and an actual encrypted download. The third one matters on its own — a router with a wrong clock pings and resolves perfectly and cannot complete a single secure connection.",
    dependsOn: ["step03-wan-dhcp", "step04-dns"],
    estMinutes: 3,
    oncePerRouter: false,
    configure: [],
    probe: {
      command: `:put "==== INTERNET VALIDATION ===="
:put "WYFY-BEGIN step05"
:put ("ping-8888=" . [:tostr [/ping 8.8.8.8 count=4]])
:put ("ping-1111=" . [:tostr [/ping 1.1.1.1 count=4]])
:local pip ""; :do { :set pip [:tostr [:resolve "auth.wyfyguest.com"]] } on-error={ :set pip "" }; :put ("portal-ip=" . $pip); :if ($pip != "") do={ :put ("ping-portal=" . [:tostr [/ping $pip count=4]]) }
:foreach f in=[/file find where name="wyfy-https-probe.tmp"] do={ /file remove $f }
:do { /tool fetch url="https://auth.wyfyguest.com/" dst-path="wyfy-https-probe.tmp" } on-error={ :put "fetch-threw=yes" }
:put ("https-file-count=" . [:tostr [:len [/file find where name="wyfy-https-probe.tmp"]]])
:foreach f in=[/file find where name="wyfy-https-probe.tmp"] do={ :put ("https-bytes=" . [:tostr [/file get $f size]]) }
:foreach f in=[/file find where name="wyfy-https-probe.tmp"] do={ /file remove $f }
:put ("date=" . [/system clock get date])
:put "WYFY-END step05"
:put "===================="`,
      emits: [
        {
          key: "ping-8888",
          type: "int",
          required: true,
          describe: "How many of four pings a well-known public address answered.",
        },
        {
          key: "ping-1111",
          type: "int",
          required: true,
          describe:
            "The same test against a second public address, so one blocked destination is not mistaken for no internet.",
        },
        {
          key: "portal-ip",
          type: "ipv4",
          required: true,
          describe: "The address the portal resolves to right now.",
        },
        {
          key: "ping-portal",
          type: "int",
          required: false,
          describe:
            "Whether the portal's own address answers. Many servers do not answer pings, so a zero here is not on its own a fault.",
        },
        {
          key: "https-file-count",
          type: "int",
          required: true,
          describe:
            "Whether an encrypted download from the portal completed. This is the real test — it exercises name lookup, routing and the clock together.",
        },
        {
          key: "https-bytes",
          type: "int",
          required: false,
          describe:
            "How many bytes came back. Zero bytes with the file present still means the download failed.",
        },
        {
          key: "date",
          type: "datetime",
          required: true,
          describe:
            "The router's date again, because a failed encrypted download is nearly always a wrong clock.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/ping 8.8.8.8 count=4",
        purpose: "Raw reachability, on its own, to show the installer.",
      },
      {
        command: `/log print without-paging where message~"fetch"`,
        purpose: "What the download attempt actually reported.",
      },
    ],
    fingerprint: {
      sentinelId: "step05",
      expectedMenu: "/ping",
      requireAllKeys: ["ping-8888", "ping-1111", "https-file-count", "date"],
      forbidKeys: ["address-pool", "add-default-route", "html-directory"],
      discriminator:
        "This check prints ping counts and an https-file-count together. A bare ping prints a table of sequence numbers and a sent/received summary and none of those keys.",
      commonWrongPastes: [
        {
          menu: "/ping",
          tell: "sent=",
          sayInstead:
            "That is a plain ping. It only tests one of the three things this step needs. Run the block from this step.",
        },
        {
          menu: "/tool fetch",
          tell: "downloaded:",
          sayInstead:
            "That is the download on its own. Run the block from this step so all three tests are recorded together.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          {
            op: "any",
            of: [
              { op: "gte", key: "ping-8888", value: 1 },
              { op: "gte", key: "ping-1111", value: 1 },
            ],
          },
          { op: "isIpv4", key: "portal-ip", excludeUnspecified: true },
          { op: "gte", key: "https-file-count", value: 1 },
          { op: "gte", key: "https-bytes", value: 1 },
        ],
      },
      means:
        "Raw reachability, name lookup and a real encrypted download all work. This router genuinely has internet.",
    },
    outcomes: [
      {
        id: "no-internet-at-all",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "ping-8888", value: 0 },
            { op: "eq", key: "ping-1111", value: 0 },
          ],
        },
        meaning:
          "Nothing on the internet answers. The problem is in step 3, not here — most often a default route that exists but is dead.",
        nextCommand: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        lookFor:
          "Whether the gateway is a real address and whether the flag letters say the route is active. A gateway of {{0.0.0.0}} is the known failure.",
        resolverRef: "no-route-to-host",
        confidence: "field",
      },
      {
        id: "ping-ok-dns-broken",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "ping-8888", value: 1 },
            { op: "not", of: { op: "isIpv4", key: "portal-ip", excludeUnspecified: true } },
          ],
        },
        meaning:
          "Addresses are reachable but names are not. This is a name-server problem only. Go back to step 4 — the router itself is fine.",
        resolverRef: "dns-resolve-failed",
        confidence: "field",
      },
      {
        id: "https-fails-clock-suspect",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "ping-8888", value: 1 },
            { op: "isIpv4", key: "portal-ip", excludeUnspecified: true },
            { op: "eq", key: "https-file-count", value: 0 },
          ],
        },
        meaning:
          "Reachability and name lookup both work, and an encrypted download still fails. On this hardware the usual cause is a wrong clock: a router whose date is wrong cannot complete a secure connection, and nothing on screen says so. The second most likely cause is that the venue's ISP is filtering.",
        nextCommand: "/system clock print without-paging",
        lookFor:
          "The date. If it is not today, that is the cause — fix the clock in step 1 and come back here.",
        fix: [
          {
            command: `/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1
:delay 10s
:put ("date=" . [/system clock get date])
:put ("time=" . [/system clock get time])`,
            note: "Turns on NTP, waits, and prints the date back so you can see whether it corrected itself. Now that the internet is up, this normally works within a few seconds.",
            destructive: false,
            confidence: "field",
          },
        ],
        resolverRef: "fetch-failed",
        confidence: "field",
      },
      {
        id: "https-zero-bytes",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "https-file-count", value: 1 },
            { op: "eq", key: "https-bytes", value: 0 },
          ],
        },
        meaning:
          "The download created an empty file. It did not succeed. Treat this exactly like a failed download — an empty file is not a smaller success.",
        nextCommand: `/log print without-paging where message~"fetch"`,
        lookFor: "The reported status and how many bytes it claims to have downloaded.",
        resolverRef: "fetch-failed",
        confidence: "field",
      },
      {
        id: "one-address-blocked",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "ping-8888", value: 0 },
            { op: "gte", key: "ping-1111", value: 1 },
          ],
        },
        meaning:
          "One public address answers and the other does not. The internet is up; the venue's ISP is filtering that particular destination. Worth noting on the ticket, not worth stopping for.",
        confidence: "field",
      },
      {
        id: "clock-drifted-since-step1",
        verdict: "WARNING",
        when: { op: "not", of: { op: "dateNear", key: "date", days: 2 } },
        meaning:
          "The date is wrong again, or was never actually fixed in step 1. Everything downstream of this — the heartbeat, secure downloads, session timestamps — will misbehave in ways that are very hard to trace back here.",
        confidence: "field",
      },
    ],
    stopGate:
      "Every step after this one needs real internet, and several of them fail silently without it rather than reporting an error.",
  },
];
