/**
 * Manual MikroTik Configuration Wizard — steps 11-14.
 * Bridge/LAN -> VLAN -> LAN address -> guest address pool.
 *
 * Note on ordering: the tunnel and login-server steps (8-10) come BEFORE
 * these in the agreed flow, which means the hotspot profile they reference
 * does not exist yet when step 10 runs. That is survivable — the RADIUS
 * block creates a bare profile defensively if it is missing — but it does
 * mean step 16 must re-check every profile setting rather than assuming
 * step 10 left it alone.
 */

import type { ManualStep } from "./types";

export const STEPS_PART4: ManualStep[] = [
  // =====================================================================
  {
    id: "step11-bridge-lan",
    n: 11,
    title: "Guest network bridge",
    why: "Every guest port has to be joined into one bridge, and that bridge has to be called {{bridge}}, because the address, the address pool, the DHCP server and the hotspot are all bound to it by name. A wrong name here does not error — commands that reference it match nothing and succeed. The other half of this step is making sure the internet port is not in the bridge, which would put the ISP and the guests on the same network.",
    dependsOn: ["step02-interfaces"],
    estMinutes: 4,
    oncePerRouter: false,
    configure: [
      {
        label:
          "Create the bridge and add every port except the internet port. Safe to run more than once.",
        script: `:local b [/interface bridge find where name="bridge"]; :put ("bridge-existing=" . [:tostr [:len $b]]); :if ([:len $b] = 0) do={ /interface bridge add name="bridge" }
/interface bridge set [find name="bridge"] disabled=no
:foreach eth in=[/interface ethernet find] do={ :local n [/interface ethernet get $eth name]; :if ($n != "ether1") do={ :local ex [/interface bridge port find where interface=$n]; :if ([:len $ex] = 0) do={ /interface bridge port add bridge="bridge" interface=$n } } }
:put ("bridge-count=" . [:tostr [:len [/interface bridge find where name="bridge"]]])
:put ("port-count=" . [:tostr [:len [/interface bridge port find where bridge="bridge"]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== BRIDGE LAN ===="
:put "WYFY-BEGIN step11"
:put ("bridge-count=" . [:tostr [:len [/interface bridge find where name="bridge"]]])
:put ("all-bridge-count=" . [:tostr [:len [/interface bridge find]]])
:foreach b in=[/interface bridge find] do={ :put ("bridge=" . [/interface bridge get $b name] . ";disabled=" . [:tostr [/interface bridge get $b disabled]] . ";running=" . [:tostr [/interface bridge get $b running]]) }
:put ("port-count=" . [:tostr [:len [/interface bridge port find where bridge="bridge"]]])
:foreach p in=[/interface bridge port find where bridge="bridge"] do={ :put ("port=" . [:tostr [/interface bridge port get $p interface]]) }
:put ("wan-in-bridge-count=" . [:tostr [:len [/interface bridge port find where interface="ether1"]]])
:put ("lan-list-count=" . [:tostr [:len [/interface list find where name="LAN"]]])
:put ("lan-list-members=" . [:tostr [:len [/interface list member find where list="LAN"]]])
:put ("allow-lan-rule-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-allow-lan"]]])
:put "WYFY-END step11"
:put "===================="`,
      emits: [
        {
          key: "bridge-count",
          type: "int",
          required: true,
          describe:
            "Whether a bridge named {{bridge}} exists. This exact name is what every later step binds to.",
        },
        {
          key: "all-bridge-count",
          type: "int",
          required: true,
          describe: "How many bridges exist in total.",
        },
        {
          key: "bridge",
          type: "string",
          multi: true,
          required: false,
          describe: "Each bridge: its name, whether it is switched off, and whether it is up.",
        },
        {
          key: "port-count",
          type: "int",
          required: true,
          describe: "How many ports are joined into the guest bridge.",
        },
        {
          key: "port",
          type: "string",
          multi: true,
          required: false,
          describe: "Which ports are in the guest bridge.",
        },
        {
          key: "wan-in-bridge-count",
          type: "int",
          required: true,
          describe: "Whether the internet port has been joined into any bridge. It must not be.",
        },
        {
          key: "lan-list-count",
          type: "int",
          required: false,
          describe:
            "Whether the LAN interface list exists. Some firewall rules are written against it.",
        },
        {
          key: "lan-list-members",
          type: "int",
          required: false,
          describe: "How many interfaces are in it.",
        },
        {
          key: "allow-lan-rule-count",
          type: "int",
          required: false,
          describe:
            "Whether the rule that lets guests reach the router itself exists. Without it the portal cannot be opened.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/interface bridge print detail without-paging",
        purpose: "Every bridge on the router.",
      },
      {
        command: "/interface bridge port print without-paging",
        purpose: "Which port belongs to which bridge.",
      },
    ],
    fingerprint: {
      sentinelId: "step11",
      expectedMenu: "/interface bridge",
      requireAllKeys: ["bridge-count", "all-bridge-count", "port-count", "wan-in-bridge-count"],
      forbidKeys: ["address-pool", "add-default-route", "html-directory"],
      discriminator:
        "This check prints bridge-count and wan-in-bridge-count. A plain bridge listing prints a NAME/MTU/PROTOCOL-MODE table and says nothing about which ports are in it.",
      commonWrongPastes: [
        {
          menu: "/interface bridge",
          tell: "PROTOCOL-MODE",
          sayInstead:
            "That is the bridge listing. It does not show whether the internet port has been joined into it, which is what this step is really checking. Run the block from this step.",
        },
        {
          menu: "/interface bridge port",
          tell: "HW",
          sayInstead:
            "That is the port listing. Run the block from this step so both halves are checked together.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "bridge-count", value: 1 },
          { op: "gte", key: "port-count", value: 1 },
          { op: "eq", key: "wan-in-bridge-count", value: 0 },
        ],
      },
      means:
        "One bridge with the expected name, at least one guest port in it, and the internet port kept out of it.",
    },
    outcomes: [
      {
        id: "bridge-wrong-name",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "bridge-count", value: 0 },
            { op: "gte", key: "all-bridge-count", value: 1 },
          ],
        },
        meaning:
          "A bridge exists but not under the name every later step uses. This is the single most damaging kind of mistake in this whole flow, because the commands that bind to it do not fail — they match nothing and report success. The address, the pool, the DHCP server and the hotspot will all appear to be configured and none of them will be attached to anything.",
        nextCommand: "/interface bridge print without-paging",
        lookFor:
          "The names that do exist. If the guest ports are already in a bridge under a different name, decide with the team whether to rename it or to run the rest of this wizard against that name — do not do both.",
        fix: [
          {
            command: `:local b [/interface bridge find where name="bridge"]; :put ("existing-count=" . [:tostr [:len $b]]); :if ([:len $b] = 0) do={ /interface bridge add name="bridge" }
:put ("after-count=" . [:tostr [:len [/interface bridge find where name="bridge"]]])`,
            note: "Creates the correctly-named bridge. It does not touch the existing one — moving ports between bridges drops every connected device, so do that deliberately, not as part of a fix.",
            destructive: false,
            confidence: "generator",
          },
        ],
        resolverRef: "input-does-not-match-interface",
        confidence: "generator",
      },
      {
        id: "no-bridge-at-all",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "bridge-count", value: 0 },
            { op: "eq", key: "all-bridge-count", value: 0 },
          ],
        },
        meaning:
          "There is no bridge on this router. Guests have nothing to connect to. Run the configure block above.",
        confidence: "generator",
      },
      {
        id: "wan-joined-to-bridge",
        verdict: "FAIL",
        when: { op: "gte", key: "wan-in-bridge-count", value: 1 },
        meaning:
          "The internet port is inside a bridge. The ISP and the guests are now on the same network: the hotspot cannot control guest traffic, and the router may hand guest addresses upstream to the ISP's equipment.",
        fix: [
          {
            command: `:local p [/interface bridge port find where interface="ether1"]; :put ("removing-count=" . [:tostr [:len $p]]); :if ([:len $p] > 0) do={ /interface bridge port remove $p }`,
            note: "Removes only the internet port's bridge membership. It prints the match count first.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "no-ports-in-bridge",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "bridge-count", value: 1 },
            { op: "eq", key: "port-count", value: 0 },
          ],
        },
        meaning:
          "The bridge exists with no ports in it. It will carry an address, a pool and a hotspot and no guest will ever reach any of them. On a router where the access points connect over a wired port, this is silent and total.",
        confidence: "generator",
      },
      {
        id: "bridge-disabled",
        verdict: "FAIL",
        when: {
          op: "some",
          key: "bridge",
          of: { op: "eq", key: "bridge[].disabled", value: true },
        },
        meaning:
          "A bridge is switched off. If it is the guest bridge, nothing on the guest side works.",
        fix: [
          {
            command: `:local b [/interface bridge find where name="bridge"]; :put ("matching-count=" . [:tostr [:len $b]]); :if ([:len $b] > 0) do={ /interface bridge set $b disabled=no }`,
            note: "Switches the guest bridge back on. The match count is printed first.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "extra-bridges",
        verdict: "WARNING",
        when: { op: "gte", key: "all-bridge-count", value: 2 },
        meaning:
          "More than one bridge exists. Usually a factory default left behind. Harmless on its own, but if guest ports are split across two bridges, half the venue will have no internet and the other half will work — which is very hard to read from the router alone.",
        nextCommand: "/interface bridge port print without-paging",
        lookFor: "Whether every guest port is in the same bridge.",
        confidence: "generator",
      },
      {
        id: "no-allow-lan-rule",
        verdict: "WARNING",
        when: { op: "eq", key: "allow-lan-rule-count", value: 0 },
        meaning:
          "The rule that lets guests reach the router itself is missing. Depending on what other rules exist, guests may be unable to open the portal or to get an address at all.",
        fix: [
          {
            command: `:local a [/ip firewall filter find where comment="cloudguest-fw-allow-lan"]; :put ("existing-count=" . [:tostr [:len $a]]); :if ([:len $a] = 0) do={ /ip firewall filter add chain=input in-interface="bridge" action=accept comment="cloudguest-fw-allow-lan" }
:put ("after-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-allow-lan"]]])`,
            note: "Adds the rule if it is missing. Counts before and after are printed.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
    ],
    stopGate:
      "A wrongly-named bridge makes every later step report success while attaching to nothing. Do not continue past this.",
  },

  // =====================================================================
  {
    id: "step12-vlan",
    n: 12,
    title: "VLANs",
    why: "Most venues in this fleet do not use VLANs at all — the guest network is one flat bridge. This step exists to prove that, not to configure something. It matters because a VLAN someone else left on the router silently changes which traffic reaches the hotspot, and because a venue that genuinely needs VLANs needs a plan agreed in advance rather than improvised on site.",
    dependsOn: ["step11-bridge-lan"],
    estMinutes: 3,
    oncePerRouter: false,
    configure: [],
    probe: {
      command: `:put "==== VLAN ===="
:put "WYFY-BEGIN step12"
:local v [/interface vlan find]; :put ("vlan-count=" . [:tostr [:len $v]]); :foreach x in=$v do={ :put ("vlan=" . [/interface vlan get $x name] . ";id=" . [:tostr [/interface vlan get $x vlan-id]] . ";parent=" . [:tostr [/interface vlan get $x interface]] . ";disabled=" . [:tostr [/interface vlan get $x disabled]]) }
:local vf "unknown"; :do { :set vf [:tostr [/interface bridge get [find name="bridge"] vlan-filtering]] } on-error={ :set vf "unknown" }; :put ("bridge-vlan-filtering=" . $vf)
:local bv 0; :do { :set bv [:len [/interface bridge vlan find]] } on-error={ :set bv -1 }; :put ("bridge-vlan-rows=" . [:tostr $bv])
:put "WYFY-END step12"
:put "===================="`,
      emits: [
        {
          key: "vlan-count",
          type: "int",
          required: true,
          describe: "How many VLAN interfaces exist. For a standard venue this is zero.",
        },
        {
          key: "vlan",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each VLAN: its name, its tag, the interface it sits on, and whether it is switched off.",
        },
        {
          key: "bridge-vlan-filtering",
          type: "string",
          required: true,
          describe:
            "Whether the guest bridge is enforcing VLAN tags. Turning this on without a full VLAN table cuts every guest off instantly.",
        },
        {
          key: "bridge-vlan-rows",
          type: "int",
          required: true,
          describe:
            "How many VLAN entries the bridge holds. -1 means this RouterOS version could not answer.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/interface vlan print detail without-paging",
        purpose: "Every VLAN interface on the router.",
      },
      {
        command: "/interface bridge vlan print without-paging",
        purpose: "The bridge's own VLAN table.",
      },
    ],
    fingerprint: {
      sentinelId: "step12",
      expectedMenu: "/interface vlan",
      requireAllKeys: ["vlan-count", "bridge-vlan-filtering", "bridge-vlan-rows"],
      forbidKeys: ["address-pool", "add-default-route"],
      discriminator:
        "This check prints vlan-count and bridge-vlan-filtering. A plain VLAN listing prints a NAME/VLAN-ID/INTERFACE table and nothing about the bridge's own filtering.",
      commonWrongPastes: [
        {
          menu: "/interface vlan",
          tell: "VLAN-ID",
          sayInstead:
            "That is the VLAN listing. It does not show whether the bridge is enforcing tags, which is the dangerous half. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "vlan-count", value: 0 },
          { op: "in", key: "bridge-vlan-filtering", values: ["false", "unknown"] },
        ],
      },
      means:
        "No VLANs and no tag enforcement on the guest bridge. This is the normal, expected state for this fleet — a flat guest network.",
    },
    outcomes: [
      {
        id: "vlan-filtering-on",
        verdict: "FAIL",
        when: { op: "eq", key: "bridge-vlan-filtering", value: "true" },
        meaning:
          "The guest bridge is enforcing VLAN tags. Unless this venue has an agreed VLAN plan and a complete table to go with it, every guest port stops passing traffic the moment this is on — and the configuration otherwise looks perfect. Do not switch it off on a venue that was designed with it: confirm with the team first.",
        nextCommand: "/interface bridge vlan print without-paging",
        lookFor:
          "Whether there is a complete table listing every port as tagged or untagged. An empty or partial table with filtering on means the guest network is down right now.",
        confidence: "standard-routeros",
      },
      {
        id: "unexpected-vlans",
        verdict: "WARNING",
        when: { op: "gte", key: "vlan-count", value: 1 },
        meaning:
          "VLAN interfaces exist on a fleet where the standard build has none. They may belong to the venue's own network and be nothing to do with this setup. Do not remove them. Record them on the ticket and check with the team whether the hotspot is meant to sit on one of them rather than on the flat bridge.",
        nextCommand: "/interface vlan print detail without-paging",
        lookFor:
          "Which interface each VLAN sits on. A VLAN on the guest bridge affects this setup; a VLAN on the internet port almost certainly belongs to the ISP.",
        confidence: "briefed",
      },
      {
        id: "vlan-support-unknown",
        verdict: "UNKNOWN",
        when: { op: "eq", key: "bridge-vlan-rows", value: -1 },
        meaning:
          "This RouterOS version would not answer about the bridge's VLAN table. Read it directly instead before deciding anything.",
        nextCommand: "/interface bridge vlan print without-paging",
        lookFor: "Whether any rows exist at all.",
        confidence: "unverified",
      },
    ],
  },

  // =====================================================================
  {
    id: "step13-lan-address",
    n: 13,
    title: "The router's address on the guest network",
    why: "This one address is the gateway for every guest, the name server every guest is handed, the address the hotspot answers on, and the address the portal's own name points at. It has to be on the bridge and there has to be exactly one of it. A leftover automatic address alongside it makes the router pick a source unpredictably, which produces faults that come and go.",
    dependsOn: ["step11-bridge-lan"],
    estMinutes: 3,
    oncePerRouter: false,
    configure: [
      {
        label: "Put the address on the guest bridge, clearing any leftover automatic one first.",
        script: `:foreach a in=[/ip address find where interface="bridge" dynamic=yes] do={ /ip address remove $a }
:local ex [/ip address find where interface="bridge" address="10.5.50.1/24"]; :put ("existing-count=" . [:tostr [:len $ex]]); :if ([:len $ex] = 0) do={ /ip address add address=10.5.50.1/24 interface="bridge" comment="cloudguest-lan" }
:put ("after-count=" . [:tostr [:len [/ip address find where interface="bridge"]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== LAN ADDRESS ===="
:put "WYFY-BEGIN step13"
:local a [/ip address find where interface="bridge"]; :put ("lan-address-count=" . [:tostr [:len $a]]); :foreach x in=$a do={ :put ("lan=" . [:tostr [/ip address get $x address]] . ";dynamic=" . [:tostr [/ip address get $x dynamic]] . ";disabled=" . [:tostr [/ip address get $x disabled]] . ";network=" . [:tostr [/ip address get $x network]]) }
:put ("expected-address-count=" . [:tostr [:len [/ip address find where interface="bridge" address="10.5.50.1/24"]]])
:local wanAddr ""; :foreach x in=[/ip address find where interface="ether1"] do={ :set wanAddr [:tostr [/ip address get $x address]] }; :put ("wan-address=" . $wanAddr)
:put ("total-address-count=" . [:tostr [:len [/ip address find]]])
:foreach x in=[/ip address find] do={ :put ("addr=" . [:tostr [/ip address get $x address]] . ";if=" . [:tostr [/ip address get $x interface]]) }
:put "WYFY-END step13"
:put "===================="`,
      emits: [
        {
          key: "lan-address-count",
          type: "int",
          required: true,
          describe: "How many addresses sit on the guest bridge. Must be exactly one.",
        },
        {
          key: "lan",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each address on the guest bridge, and whether it was set by hand or arrived automatically.",
        },
        {
          key: "expected-address-count",
          type: "int",
          required: true,
          describe: "Whether the exact expected address is present.",
        },
        {
          key: "wan-address",
          type: "string",
          required: false,
          describe:
            "The address on the internet port, so an overlap between the two sides can be spotted.",
        },
        {
          key: "total-address-count",
          type: "int",
          required: true,
          describe: "How many addresses the router has in total.",
        },
        {
          key: "addr",
          type: "string",
          multi: true,
          required: false,
          describe: "Every address on the router with the interface it belongs to.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/ip address print detail without-paging",
        purpose: "Every address on the router.",
      },
    ],
    fingerprint: {
      sentinelId: "step13",
      expectedMenu: "/ip address",
      requireAllKeys: ["lan-address-count", "expected-address-count", "total-address-count"],
      forbidKeys: ["ranges", "address-pool", "add-default-route"],
      discriminator:
        "This check prints lan-address-count and expected-address-count. The address pool listing prints ranges instead and belongs to step 14.",
      commonWrongPastes: [
        {
          menu: "/ip pool",
          tell: "RANGES",
          sayInstead:
            "That is the address pool, which is the next step. This step is about the router's own address.",
        },
        {
          menu: "/ip address",
          tell: "NETWORK",
          sayInstead:
            "That is the plain address listing. It does not check for a leftover automatic address on the bridge. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "lan-address-count", value: 1 },
          { op: "eq", key: "expected-address-count", value: 1 },
          { op: "noOverlap", key: "lan", otherKey: "wan-address" },
        ],
      },
      means:
        "Exactly one address on the guest bridge, the expected one, and it does not clash with the address the ISP gave the router.",
    },
    outcomes: [
      {
        id: "lan-wan-overlap",
        verdict: "FAIL",
        when: { op: "not", of: { op: "noOverlap", key: "lan", otherKey: "wan-address" } },
        meaning:
          "The guest network and the ISP's network are the same range. The router cannot decide which side an address belongs to, so guest traffic goes to the ISP and ISP traffic goes to the guests, at random. It usually shows up as some sites working and others not.",
        nextCommand: "/ip address print detail without-paging",
        lookFor:
          "Both addresses side by side. If the ISP hands out the same range this fleet uses for guests, the guest range has to change — and every value derived from it changes with it, so do that with the team, not on site.",
        confidence: "standard-routeros",
      },
      {
        id: "lan-address-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "lan-address-count", value: 0 },
        meaning:
          "The guest bridge has no address. Guests will connect to the network and get nothing — no address, no gateway, no portal.",
        confidence: "generator",
      },
      {
        id: "lan-extra-address",
        verdict: "FAIL",
        when: { op: "gte", key: "lan-address-count", value: 2 },
        meaning:
          "More than one address on the guest bridge. The router picks a source address unpredictably, so faults come and go rather than being consistently broken — which is far harder to diagnose than a clean failure.",
        nextCommand: `/ip address print detail without-paging where interface="bridge"`,
        lookFor: "Which rows are marked dynamic. Those are leftovers and can go.",
        fix: [
          {
            command: `:local d [/ip address find where interface="bridge" dynamic=yes]; :put ("removing-count=" . [:tostr [:len $d]]); :if ([:len $d] > 0) do={ /ip address remove $d }
:put ("remaining-count=" . [:tostr [:len [/ip address find where interface="bridge"]]])`,
            note: "Removes only automatically-assigned addresses from the guest bridge. If two addresses are both set by hand, do not guess — ask which one the venue is meant to use.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "lan-address-different",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "lan-address-count", value: 1 },
            { op: "eq", key: "expected-address-count", value: 0 },
          ],
        },
        meaning:
          "The guest bridge has one address but not the one this wizard expects. That may be deliberate for this venue. If it is, every later step has to use the matching values — the pool range, the DHCP server's gateway and name server, and the hotspot's address all derive from it. Confirm before continuing rather than accepting the mismatch.",
        confidence: "briefed",
      },
      {
        id: "lan-address-disabled",
        verdict: "FAIL",
        when: { op: "some", key: "lan", of: { op: "eq", key: "lan[].disabled", value: true } },
        meaning:
          "The address on the guest bridge is switched off, which is the same as not having one.",
        confidence: "generator",
      },
    ],
    stopGate:
      "Everything on the guest side is derived from this address. Do not continue while it is missing, duplicated, or clashing with the ISP's range.",
  },

  // =====================================================================
  {
    id: "step14-dhcp-pool",
    n: 14,
    title: "Range of addresses for guests",
    why: "The pool is where guest devices get their addresses from. It has to sit inside the guest network and it must not include the router's own address. A pool that overlaps the router produces one guest device per venue that cannot reach the portal at all, and it is never the same device twice.",
    dependsOn: ["step13-lan-address"],
    estMinutes: 2,
    oncePerRouter: false,
    configure: [
      {
        label: "Create the guest address range. Safe to run more than once.",
        script: `:local p [/ip pool find where name="hotspot-pool"]; :put ("existing-count=" . [:tostr [:len $p]]); :if ([:len $p] = 0) do={ /ip pool add name="hotspot-pool" ranges=10.5.50.10-10.5.50.254 }
:put ("after-count=" . [:tostr [:len [/ip pool find where name="hotspot-pool"]]])
:put ("ranges=" . [:tostr [/ip pool get [find name="hotspot-pool"] ranges]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== DHCP POOL ===="
:put "WYFY-BEGIN step14"
:local p [/ip pool find where name="hotspot-pool"]; :put ("pool-count=" . [:tostr [:len $p]])
:put ("all-pool-count=" . [:tostr [:len [/ip pool find]]])
:foreach x in=[/ip pool find] do={ :put ("pool=" . [/ip pool get $x name] . ";ranges=" . [:tostr [/ip pool get $x ranges]]) }
:local used 0; :do { :set used [:len [/ip pool used find where pool="hotspot-pool"]] } on-error={ :set used -1 }; :put ("addresses-in-use=" . [:tostr $used])
:put ("lan-address=" . [:tostr [/ip address get [find where interface="bridge"] address]])
:put "WYFY-END step14"
:put "===================="`,
      emits: [
        {
          key: "pool-count",
          type: "int",
          required: true,
          describe: "Whether the guest address range exists under the expected name.",
        },
        {
          key: "all-pool-count",
          type: "int",
          required: true,
          describe: "How many address ranges exist in total.",
        },
        {
          key: "pool",
          type: "string",
          multi: true,
          required: false,
          describe: "Each range: its name and the addresses it covers.",
        },
        {
          key: "addresses-in-use",
          type: "int",
          required: false,
          describe:
            "How many addresses are handed out right now. -1 means this version could not answer.",
        },
        {
          key: "lan-address",
          type: "string",
          required: true,
          describe: "The router's own address, so an overlap with the range can be checked.",
        },
      ],
    },
    contextCommands: [
      { command: "/ip pool print without-paging", purpose: "Every address range on the router." },
      {
        command: "/ip pool used print without-paging",
        purpose: "Which addresses are currently handed out.",
      },
    ],
    fingerprint: {
      sentinelId: "step14",
      expectedMenu: "/ip pool",
      requireAllKeys: ["pool-count", "all-pool-count", "lan-address"],
      forbidKeys: ["address-pool", "lease-time", "html-directory"],
      discriminator:
        "This check prints pool-count and a ranges value. The DHCP server listing prints address-pool and lease-time instead and belongs to step 15.",
      commonWrongPastes: [
        {
          menu: "/ip dhcp-server",
          tell: "LEASE-TIME",
          sayInstead:
            "That is the DHCP server, which is the next step. This step is about the range of addresses it hands out.",
        },
        {
          menu: "/ip dhcp-server lease",
          tell: "HOST-NAME",
          sayInstead: "Those are the addresses currently handed out, not the range they come from.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "pool-count", value: 1 },
          {
            op: "some",
            key: "pool",
            of: { op: "eq", key: "pool[].ranges", value: "10.5.50.10-10.5.50.254" },
          },
        ],
      },
      means:
        "The guest address range exists, under the expected name, covering the expected addresses.",
    },
    outcomes: [
      {
        id: "pool-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "pool-count", value: 0 },
        meaning:
          "The guest address range does not exist. The DHCP server in the next step binds to it by name, so creating that server first would bind it to nothing.",
        fix: [
          {
            command: `:local p [/ip pool find where name="hotspot-pool"]; :put ("existing-count=" . [:tostr [:len $p]]); :if ([:len $p] = 0) do={ /ip pool add name="hotspot-pool" ranges=10.5.50.10-10.5.50.254 }
:put ("after-count=" . [:tostr [:len [/ip pool find where name="hotspot-pool"]]])`,
            note: "Creates the range. Counts before and after are printed so you can see it landed.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "pool-range-different",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "pool-count", value: 1 },
            {
              op: "not",
              of: {
                op: "some",
                key: "pool",
                of: { op: "eq", key: "pool[].ranges", value: "10.5.50.10-10.5.50.254" },
              },
            },
          ],
        },
        meaning:
          "The range exists but covers different addresses than expected. Check by hand that it sits inside the guest network and does not include the router's own address. If the venue's address was deliberately changed in step 13, this is expected and correct.",
        nextCommand: "/ip pool print without-paging",
        lookFor:
          "Whether the first address in the range is above the router's own address, and whether the whole range is inside the guest network.",
        confidence: "briefed",
      },
      {
        id: "pool-includes-router",
        verdict: "FAIL",
        when: {
          op: "some",
          key: "pool",
          of: { op: "contains", key: "pool[].ranges", value: "10.5.50.1-" },
        },
        meaning:
          "The range starts at the router's own address. One guest device per venue will be handed the router's address and will fail completely, and it will be a different device each time. Nothing in the configuration looks wrong.",
        fix: [
          {
            command: `:local p [/ip pool find where name="hotspot-pool"]; :put ("matching-count=" . [:tostr [:len $p]]); :if ([:len $p] > 0) do={ /ip pool set $p ranges=10.5.50.10-10.5.50.254 }
:put ("ranges=" . [:tostr [/ip pool get [find name="hotspot-pool"] ranges]])`,
            note: "Moves the start of the range clear of the router. Devices already holding an address keep it until their lease expires.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "standard-routeros",
      },
      {
        id: "duplicate-pools",
        verdict: "WARNING",
        when: { op: "gte", key: "all-pool-count", value: 2 },
        meaning:
          "More than one address range exists. Harmless if only one is bound to the guest DHCP server, but a leftover range makes it easy to bind the wrong one later.",
        nextCommand: "/ip pool print without-paging",
        lookFor:
          "Which ranges overlap each other. Two overlapping ranges hand the same address to two devices.",
        confidence: "generator",
      },
      {
        id: "pool-nearly-exhausted",
        verdict: "WARNING",
        when: { op: "gte", key: "addresses-in-use", value: 200 },
        meaning:
          "Most of the range is already handed out. New guests will start being refused an address entirely, which looks like a broken hotspot. Either the venue is busier than the range allows, or old leases are not being released — check the session timeout settings in step 16.",
        confidence: "standard-routeros",
      },
    ],
  },
];
