/**
 * Manual MikroTik Configuration Wizard — steps 15-18.
 * DHCP server -> hotspot -> login-server integration -> end-to-end proof.
 *
 * These four steps carry the largest concentration of confirmed silent
 * failures in the whole product. In order of how much time each has cost:
 *
 *  - `flash/hotspot/login.html` — the `flash/` prefix exists only on some
 *    models. On the others `/file set [find name="flash/hotspot/login.html"]`
 *    matches nothing, SUCCEEDS, and changes nothing. The guest sees
 *    MikroTik's stock blue login page and the router reports no error at
 *    any point. Step 16 discovers the real path BEFORE anything is written.
 *  - `login-by` defaults to `cookie,http-chap`, which silently rejects the
 *    portal's login form. Correct code, no error, nothing in the log.
 *  - A local `guest` hotspot account is checked BEFORE the login server, so
 *    anyone who knows it bypasses the portal entirely — no code, no record,
 *    no data limit.
 *  - `keepalive-timeout=none` is correct, but that makes `idle-timeout` the
 *    only thing that ever closes a session, and nothing sets it.
 *  - `/radius monitor` has FOUR counters, not three. `bad-replies` means a
 *    reply arrived and failed validation. Watching only rejects makes it
 *    invisible.
 */

import type { ManualStep } from "./types";

export const STEPS_PART5: ManualStep[] = [
  // =====================================================================
  {
    id: "step15-dhcp-server",
    n: 15,
    title: "Handing addresses to guests",
    why: "The server itself is only half of it. The other half is the network entry that tells guests which gateway and which name server to use — and that entry is a separate object that can be missing while the server looks perfectly configured. When it is missing, guests get an address and nothing else works, which reads exactly like a broken portal.",
    dependsOn: ["step14-dhcp-pool"],
    estMinutes: 3,
    oncePerRouter: false,
    configure: [
      {
        label: "Create the DHCP server and its network entry. Safe to run more than once.",
        script: `:local s [/ip dhcp-server find where interface="bridge"]
:put ("server-existing=" . [:tostr [:len $s]])
:if ([:len $s] = 0) do={ /ip dhcp-server add name="hotspot-dhcp" interface="bridge" address-pool="hotspot-pool" disabled=no }
:local n [/ip dhcp-server network find where address="10.5.50.0/24"]
:put ("network-existing=" . [:tostr [:len $n]])
:if ([:len $n] = 0) do={ /ip dhcp-server network add address=10.5.50.0/24 gateway=10.5.50.1 dns-server=10.5.50.1 }
:put ("server-count=" . [:tostr [:len [/ip dhcp-server find where interface="bridge"]]])
:put ("network-count=" . [:tostr [:len [/ip dhcp-server network find where address="10.5.50.0/24"]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== DHCP SERVER ===="
:put "WYFY-BEGIN step15"
:local s [/ip dhcp-server find where interface="bridge"]
:put ("server-count=" . [:tostr [:len $s]])
:put ("all-server-count=" . [:tostr [:len [/ip dhcp-server find]]])
:foreach x in=[/ip dhcp-server find] do={ :put ("server=" . [/ip dhcp-server get $x name] . ";if=" . [:tostr [/ip dhcp-server get $x interface]] . ";pool=" . [:tostr [/ip dhcp-server get $x address-pool]] . ";disabled=" . [:tostr [/ip dhcp-server get $x disabled]] . ";lease=" . [:tostr [/ip dhcp-server get $x lease-time]]) }
:local n [/ip dhcp-server network find]
:put ("network-count=" . [:tostr [:len $n]])
:foreach x in=$n do={ :put ("network=" . [:tostr [/ip dhcp-server network get $x address]] . ";gw=" . [:tostr [/ip dhcp-server network get $x gateway]] . ";dns=" . [:tostr [/ip dhcp-server network get $x dns-server]]) }
:put ("lease-count=" . [:tostr [:len [/ip dhcp-server lease find]]])
:put ("pool-count=" . [:tostr [:len [/ip pool find where name="hotspot-pool"]]])
:put "WYFY-END step15"
:put "===================="`,
      emits: [
        {
          key: "server-count",
          type: "int",
          required: true,
          describe: "Whether a DHCP server is attached to the guest bridge. Must be exactly one.",
        },
        {
          key: "all-server-count",
          type: "int",
          required: true,
          describe:
            "How many DHCP servers exist in total, including leftovers on other interfaces.",
        },
        {
          key: "server",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each server: its name, the interface it serves, the range it hands out from, whether it is switched off, and how long a lease lasts.",
        },
        {
          key: "network-count",
          type: "int",
          required: true,
          describe:
            "How many network entries exist. Without one, guests get an address and no gateway.",
        },
        {
          key: "network",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each network entry: the range it covers, the gateway it advertises, and the name server it advertises.",
        },
        {
          key: "lease-count",
          type: "int",
          required: false,
          describe: "How many devices currently hold an address.",
        },
        {
          key: "pool-count",
          type: "int",
          required: true,
          describe:
            "Whether the range this server binds to still exists. A server bound to a missing range hands out nothing.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/ip dhcp-server print detail without-paging",
        purpose: "The DHCP servers in full.",
      },
      {
        command: "/ip dhcp-server network print detail without-paging",
        purpose: "The network entries — the half that is usually missing.",
      },
      {
        command: "/ip dhcp-server lease print without-paging",
        purpose: "Which devices currently hold an address.",
      },
    ],
    fingerprint: {
      sentinelId: "step15",
      expectedMenu: "/ip dhcp-server",
      requireAllKeys: ["server-count", "network-count", "pool-count"],
      forbidKeys: ["ranges", "html-directory", "add-default-route"],
      discriminator:
        "This check prints server-count and network-count together. The address range listing prints ranges instead and belongs to step 14.",
      commonWrongPastes: [
        {
          menu: "/ip pool",
          tell: "RANGES",
          sayInstead:
            "That is the address range, which was the previous step. This step is about the server that hands those addresses out.",
        },
        {
          menu: "/ip dhcp-server lease",
          tell: "HOST-NAME",
          sayInstead:
            "Those are the addresses currently handed out. They do not tell you whether the gateway is being advertised. Run the block from this step.",
        },
        {
          menu: "/ip dhcp-client",
          tell: "use-peer-dns",
          sayInstead:
            "That is the router asking the ISP for an address. This step is the opposite direction — the router handing addresses to guests.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "server-count", value: 1 },
          { op: "gte", key: "network-count", value: 1 },
          { op: "eq", key: "pool-count", value: 1 },
          { op: "some", key: "server", of: { op: "eq", key: "server[].disabled", value: false } },
          {
            op: "some",
            key: "server",
            of: { op: "eq", key: "server[].pool", value: "hotspot-pool" },
          },
          { op: "some", key: "network", of: { op: "eq", key: "network[].gw", value: "10.5.50.1" } },
          {
            op: "some",
            key: "network",
            of: { op: "eq", key: "network[].dns", value: "10.5.50.1" },
          },
        ],
      },
      means:
        "One server on the guest bridge, bound to the guest range, switched on, and advertising the router as both gateway and name server.",
    },
    outcomes: [
      {
        id: "network-entry-missing",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "server-count", value: 1 },
            { op: "eq", key: "network-count", value: 0 },
          ],
        },
        meaning:
          "The server exists but there is no network entry, so guests are handed an address with no gateway and no name server. The device shows as connected with a valid address and nothing works. This is one of the most commonly misread faults in the whole setup, because everything visible looks correct.",
        nextCommand: "/ip dhcp-server network print detail without-paging",
        lookFor: "Whether any row exists at all. An empty listing here is the fault.",
        fix: [
          {
            command: `:local n [/ip dhcp-server network find where address="10.5.50.0/24"]
:put ("existing-count=" . [:tostr [:len $n]])
:if ([:len $n] = 0) do={ /ip dhcp-server network add address=10.5.50.0/24 gateway=10.5.50.1 dns-server=10.5.50.1 }
:put ("after-count=" . [:tostr [:len [/ip dhcp-server network find where address="10.5.50.0/24"]]])`,
            note: "Adds the missing network entry. Devices already connected keep their broken settings until their lease renews — reconnect one to test.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "network-wrong-gateway",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "network-count", value: 1 },
            {
              op: "not",
              of: {
                op: "some",
                key: "network",
                of: { op: "eq", key: "network[].gw", value: "10.5.50.1" },
              },
            },
          ],
        },
        meaning:
          "The network entry advertises a gateway that is not this router. Guests will send their traffic to a device that is not there. If step 13 deliberately used a different address for this venue, this value has to match that one.",
        nextCommand: "/ip dhcp-server network print detail without-paging",
        lookFor: "The gateway value, compared against the router's own address from step 13.",
        confidence: "generator",
      },
      {
        id: "network-wrong-dns",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "network-count", value: 1 },
            {
              op: "not",
              of: {
                op: "some",
                key: "network",
                of: { op: "eq", key: "network[].dns", value: "10.5.50.1" },
              },
            },
          ],
        },
        meaning:
          "Guests are being pointed at a name server other than this router. The captive portal depends on the router answering name lookups — if guests use a public name server directly, the portal never appears and they simply have no internet with no explanation.",
        fix: [
          {
            command: `:local n [/ip dhcp-server network find where address="10.5.50.0/24"]
:put ("matching-count=" . [:tostr [:len $n]])
:if ([:len $n] > 0) do={ /ip dhcp-server network set $n dns-server=10.5.50.1 }
:put ("dns=" . [:tostr [/ip dhcp-server network get [find where address="10.5.50.0/24"] dns-server]])`,
            note: "Points guests at the router for name lookups and prints the result back.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "server-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "server-count", value: 0 },
        meaning:
          "No DHCP server on the guest bridge. Guest devices will connect to the network and never receive an address at all.",
        confidence: "generator",
      },
      {
        id: "server-disabled",
        verdict: "FAIL",
        when: {
          op: "some",
          key: "server",
          of: { op: "eq", key: "server[].disabled", value: true },
        },
        meaning: "The DHCP server exists but is switched off. Guests receive no address.",
        fix: [
          {
            command: `:local s [/ip dhcp-server find where interface="bridge"]
:put ("matching-count=" . [:tostr [:len $s]])
:if ([:len $s] > 0) do={ /ip dhcp-server set $s disabled=no }`,
            note: "Switches it on. The match count is printed first so an empty match cannot pass as done.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "server-bound-to-missing-pool",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "server-count", value: 1 },
            { op: "eq", key: "pool-count", value: 0 },
          ],
        },
        meaning:
          "The server is bound to an address range that no longer exists. It will run, accept requests, and hand out nothing.",
        confidence: "generator",
      },
      {
        id: "duplicate-servers",
        verdict: "FAIL",
        when: { op: "gte", key: "server-count", value: 2 },
        meaning:
          "Two DHCP servers on the same bridge. They both answer, guests get whichever reply arrives first, and half the venue ends up with the wrong settings. Which half changes constantly.",
        nextCommand: "/ip dhcp-server print detail without-paging",
        lookFor: "Which server is named {{hotspot-dhcp}}. The others are leftovers.",
        confidence: "standard-routeros",
      },
      {
        id: "multiple-networks",
        verdict: "WARNING",
        when: { op: "gte", key: "network-count", value: 2 },
        meaning:
          "More than one network entry. Only the one matching the guest range is used; the others are usually harmless leftovers, but check none of them also covers the guest range with different values.",
        confidence: "standard-routeros",
      },
    ],
    stopGate:
      "Guests getting an address with no gateway is indistinguishable from a broken portal. Do not carry this fault into the hotspot step.",
  },

  // =====================================================================
  {
    id: "step16-hotspot",
    n: 16,
    title: "The guest login page",
    why: "This step holds more silent failures than any other. Three of them will let a guest connect, see something that looks like a login page, and never actually get online — with nothing in the router's log at any point. The file path check has to come first, because the command that installs the portal pages succeeds against a path that does not exist and changes nothing.",
    dependsOn: ["step15-dhcp-server", "step04-dns"],
    estMinutes: 8,
    oncePerRouter: false,
    configure: [
      {
        label:
          "Find out where this model actually keeps the hotspot pages. Run this BEFORE pasting any portal page block from Master console.",
        script: `:put ("flash-prefix-count=" . [:tostr [:len [/file find where name="flash/hotspot/login.html"]]])
:put ("plain-prefix-count=" . [:tostr [:len [/file find where name="hotspot/login.html"]]])
:foreach f in=[/file find where name~"login.html"] do={ :put ("found=" . [/file get $f name]) }`,
        oncePerRouter: false,
      },
      {
        label: "Create the hotspot and its profile. Safe to run more than once.",
        script: `:local pr [/ip hotspot profile find where name="hsprof1"]
:if ([:len $pr] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=10.5.50.1 html-directory=hotspot dns-name="wifi.wyfyguest.com" }
/ip hotspot profile set [find name="hsprof1"] login-by=http-pap dns-name="wifi.wyfyguest.com" hotspot-address=10.5.50.1
:local ds [/ip dns static find where name="wifi.wyfyguest.com"]
:if ([:len $ds] = 0) do={ /ip dns static add name="wifi.wyfyguest.com" address=10.5.50.1 comment="cloudguest-hotspot-dns-name" } else={ /ip dns static set $ds address=10.5.50.1 }
:local hs [/ip hotspot find where interface="bridge"]
:if ([:len $hs] = 0) do={ /ip hotspot add name="hotspot1" interface="bridge" address-pool="hotspot-pool" profile="hsprof1" disabled=no }
:put ("profile-count=" . [:tostr [:len [/ip hotspot profile find where name="hsprof1"]]])
:put ("server-count=" . [:tostr [:len [/ip hotspot find where interface="bridge"]]])`,
        oncePerRouter: false,
      },
      {
        label:
          "Close the three gaps the generated blocks leave behind: sessions that never end, one device per guest, and the local account that bypasses the portal.",
        script: `:local hs [/ip hotspot find]
:put ("hotspot-count=" . [:tostr [:len $hs]])
:if ([:len $hs] > 0) do={ /ip hotspot set $hs idle-timeout=5m }
:local up [/ip hotspot user profile find where name="default"]
:put ("user-profile-count=" . [:tostr [:len $up]])
:if ([:len $up] > 0) do={ /ip hotspot user profile set $up shared-users=5 keepalive-timeout=none }
:local gu [/ip hotspot user find where name="guest"]
:put ("guest-user-count=" . [:tostr [:len $gu]])
:if ([:len $gu] > 0) do={ /ip hotspot user set $gu disabled=yes }`,
        oncePerRouter: false,
      },
      {
        label:
          "Let guests reach the portal before they log in. Both lists are needed — one covers plain traffic, the other encrypted.",
        script: `:local pip ""
:do { :set pip [:tostr [:resolve "portal.wyfyguest.com"]] } on-error={ :set pip "" }
:put ("portal-ip=" . $pip)
:local h [/ip hotspot walled-garden find where comment="cloudguest-portal"]
:if ([:len $h] = 0) do={ /ip hotspot walled-garden add dst-host="portal.wyfyguest.com" action=allow comment="cloudguest-portal" }
:local i [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]
:if ($pip != "" && [:len $i] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address=$pip comment="cloudguest-portal-https" }
:if ($pip != "" && [:len $i] > 0) do={ /ip hotspot walled-garden ip set $i dst-address=$pip }
:put ("host-list-count=" . [:tostr [:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]]])
:put ("ip-list-count=" . [:tostr [:len [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== HOTSPOT ===="
:put "WYFY-BEGIN step16"
:local hs [/ip hotspot find where interface="bridge"]
:put ("hotspot-count=" . [:tostr [:len $hs]])
:put ("all-hotspot-count=" . [:tostr [:len [/ip hotspot find]]])
:foreach x in=[/ip hotspot find] do={ :put ("hotspot=" . [/ip hotspot get $x name] . ";if=" . [:tostr [/ip hotspot get $x interface]] . ";profile=" . [:tostr [/ip hotspot get $x profile]] . ";disabled=" . [:tostr [/ip hotspot get $x disabled]] . ";idle=" . [:tostr [/ip hotspot get $x idle-timeout]]) }
:local pr [/ip hotspot profile find where name="hsprof1"]
:put ("profile-count=" . [:tostr [:len $pr]])
:local p0 ""
:if ([:len $pr] > 0) do={ :set p0 [:pick $pr 0] }
:if ($p0 != "") do={ :put ("login-by=" . [:tostr [/ip hotspot profile get $p0 login-by]]) }
:if ($p0 != "") do={ :put ("dns-name=" . [:tostr [/ip hotspot profile get $p0 dns-name]]) }
:if ($p0 != "") do={ :put ("html-directory=" . [:tostr [/ip hotspot profile get $p0 html-directory]]) }
:if ($p0 != "") do={ :put ("hotspot-address=" . [:tostr [/ip hotspot profile get $p0 hotspot-address]]) }
:local up [/ip hotspot user profile find where name="default"]
:put ("user-profile-count=" . [:tostr [:len $up]])
:local u0 ""
:if ([:len $up] > 0) do={ :set u0 [:pick $up 0] }
:if ($u0 != "") do={ :put ("shared-users=" . [:tostr [/ip hotspot user profile get $u0 shared-users]]) }
:if ($u0 != "") do={ :put ("keepalive-timeout=" . [:tostr [/ip hotspot user profile get $u0 keepalive-timeout]]) }
:put ("guest-user-count=" . [:tostr [:len [/ip hotspot user find where name="guest"]]])
:foreach g in=[/ip hotspot user find where name="guest"] do={ :put ("guest-user-disabled=" . [:tostr [/ip hotspot user get $g disabled]]) }
:put ("local-user-count=" . [:tostr [:len [/ip hotspot user find]]])
:put ("flash-prefix-count=" . [:tostr [:len [/file find where name="flash/hotspot/login.html"]]])
:put ("plain-prefix-count=" . [:tostr [:len [/file find where name="hotspot/login.html"]]])
:put ("login-file-count=" . [:tostr [:len [/file find where name~"login.html"]]])
:foreach f in=[/file find where name~"login.html"] do={ :put ("login-file=" . [/file get $f name] . ";size=" . [:tostr [/file get $f size]]) }
:local lc ""
:do { :set lc [:tostr [/file get [find where name~"login.html"] contents]] } on-error={ :set lc "" }
:put ("login-has-portal-url=" . [:tostr ([:typeof [:find $lc "portal.wyfyguest.com"]] != "nothing")])
:put ("login-has-link-token=" . [:tostr ([:typeof [:find $lc "link-login-only"]] != "nothing")])
:put ("wg-host-count=" . [:tostr [:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]]])
:put ("wg-ip-count=" . [:tostr [:len [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]]])
:foreach w in=[/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"] do={ :put ("wg-ip=" . [:tostr [/ip hotspot walled-garden ip get $w dst-address]]) }
:local pip ""
:do { :set pip [:tostr [:resolve "portal.wyfyguest.com"]] } on-error={ :set pip "" }
:put ("portal-resolves-to=" . $pip)
:put ("hotspot-dns-static-count=" . [:tostr [:len [/ip dns static find where name="wifi.wyfyguest.com"]]])
:put "WYFY-END step16"
:put "===================="`,
      emits: [
        {
          key: "hotspot-count",
          type: "int",
          required: true,
          describe: "Whether a hotspot is running on the guest bridge.",
        },
        {
          key: "all-hotspot-count",
          type: "int",
          required: true,
          describe: "How many hotspots exist in total.",
        },
        {
          key: "hotspot",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each hotspot: its name, interface, profile, whether it is off, and how long a session may sit idle.",
        },
        {
          key: "profile-count",
          type: "int",
          required: true,
          describe: "Whether the profile every other setting hangs off exists.",
        },
        {
          key: "login-by",
          type: "csv",
          required: false,
          describe:
            "Which login methods the router accepts. The portal's form needs {{http-pap}}. The factory default rejects it.",
        },
        {
          key: "dns-name",
          type: "string",
          required: false,
          describe: "The name a guest can type to reach the login page.",
        },
        {
          key: "html-directory",
          type: "string",
          required: false,
          describe: "Which folder the router serves the login pages from.",
        },
        {
          key: "hotspot-address",
          type: "ipv4",
          required: false,
          describe: "The address the hotspot answers on.",
        },
        {
          key: "user-profile-count",
          type: "int",
          required: true,
          describe: "Whether the guest session profile exists.",
        },
        {
          key: "shared-users",
          type: "int",
          required: false,
          describe:
            "How many devices one guest may use. At one, a guest's laptop is refused after their phone connects.",
        },
        {
          key: "keepalive-timeout",
          type: "duration",
          required: false,
          describe:
            "Whether the router polls sessions to see if they are alive. Off is correct here, which makes the idle timeout the only thing that ever ends a session.",
        },
        {
          key: "guest-user-count",
          type: "int",
          required: true,
          describe: "Whether a local guest account exists on the router.",
        },
        {
          key: "guest-user-disabled",
          type: "bool",
          multi: true,
          required: false,
          describe:
            "Whether that account is switched off. The router checks local accounts before the login server, so an enabled one is a complete bypass of the portal.",
        },
        {
          key: "local-user-count",
          type: "int",
          required: true,
          describe:
            "How many local accounts exist in total. Every one of them bypasses the portal.",
        },
        {
          key: "flash-prefix-count",
          type: "int",
          required: true,
          describe:
            "Whether this model keeps the pages under a flash folder. This is the path the generated blocks assume.",
        },
        {
          key: "plain-prefix-count",
          type: "int",
          required: true,
          describe:
            "Whether this model keeps them without that prefix. On such a model the generated blocks write to nothing and report success.",
        },
        {
          key: "login-file-count",
          type: "int",
          required: true,
          describe: "How many login pages exist anywhere on the router.",
        },
        {
          key: "login-file",
          type: "string",
          multi: true,
          required: false,
          describe: "The real path of each login page and its size.",
        },
        {
          key: "login-has-portal-url",
          type: "bool",
          required: true,
          describe:
            "Whether the login page actually contains the portal's address. False means the page is still MikroTik's stock one.",
        },
        {
          key: "login-has-link-token",
          type: "bool",
          required: true,
          describe:
            "Whether the page carries the token the portal needs to complete a login. A page with the address but not this token produces a guest stuck on a spinner.",
        },
        {
          key: "wg-host-count",
          type: "int",
          required: true,
          describe: "Whether unauthenticated guests may reach the portal over plain traffic.",
        },
        {
          key: "wg-ip-count",
          type: "int",
          required: true,
          describe:
            "Whether they may reach it over encrypted traffic. This is the one that breaks most often, and almost all real guest traffic is encrypted.",
        },
        {
          key: "wg-ip",
          type: "ipv4",
          multi: true,
          required: false,
          describe: "Which address is allowed through.",
        },
        {
          key: "portal-resolves-to",
          type: "ipv4",
          required: true,
          describe:
            "What the portal resolves to right now, to compare against what is allowed through.",
        },
        {
          key: "hotspot-dns-static-count",
          type: "int",
          required: false,
          describe: "Whether the login page's own name points at this router.",
        },
      ],
    },
    contextCommands: [
      { command: "/ip hotspot print detail without-paging", purpose: "The hotspot in full." },
      {
        command: "/ip hotspot profile print detail without-paging",
        purpose: "Every profile setting, including the login methods.",
      },
      {
        command: "/ip hotspot user print without-paging",
        purpose: "Local accounts, every one of which bypasses the portal.",
      },
      {
        command: "/ip hotspot walled-garden ip print without-paging",
        purpose: "What unauthenticated guests may reach over encrypted traffic.",
      },
      {
        command: `/file print without-paging where name~"login.html"`,
        purpose: "Where the login page actually lives on this model.",
      },
    ],
    fingerprint: {
      sentinelId: "step16",
      expectedMenu: "/ip hotspot",
      requireAllKeys: [
        "hotspot-count",
        "profile-count",
        "guest-user-count",
        "flash-prefix-count",
        "plain-prefix-count",
        "wg-ip-count",
      ],
      requireAnyKeys: ["login-by", "dns-name"],
      forbidKeys: ["add-default-route", "ranges", "accepts", "bad-replies"],
      discriminator:
        "This check prints hotspot-count together with flash-prefix-count and wg-ip-count. The counters view prints {{accepts}} and {{bad-replies}} instead and belongs to step 17.",
      commonWrongPastes: [
        {
          menu: "/ip hotspot",
          tell: "ADDRESS-POOL",
          sayInstead:
            "That is the hotspot listing. It does not show the login methods, the local accounts, or where the login page really lives — which are the three things that actually break. Run the block from this step.",
        },
        {
          menu: "/ip hotspot active",
          tell: "UPTIME",
          sayInstead:
            "Those are the guests logged in right now. That belongs to the last step. This step checks the configuration.",
        },
        {
          menu: "/file",
          tell: "CREATION-TIME",
          sayInstead:
            "That is the file listing on its own. Run the block from this step so the file path is checked together with the rest.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "hotspot-count", value: 1 },
          { op: "eq", key: "profile-count", value: 1 },
          { op: "contains", key: "login-by", value: "http-pap" },
          { op: "eq", key: "dns-name", value: "wifi.wyfyguest.com" },
          { op: "durationBetween", key: "hotspot[].idle", minSeconds: 60, maxSeconds: 1800 },
          { op: "gte", key: "shared-users", value: 2 },
          { op: "eq", key: "login-has-portal-url", value: true },
          { op: "eq", key: "login-has-link-token", value: true },
          { op: "gte", key: "wg-host-count", value: 1 },
          { op: "gte", key: "wg-ip-count", value: 1 },
          { op: "eq", key: "local-user-count", value: 0 },
        ],
      },
      means:
        "The hotspot is running on the guest bridge, it accepts the portal's login form, the real portal pages are installed at the path this model actually uses, guests can reach the portal before logging in over both plain and encrypted traffic, and there is no local account that bypasses any of it.",
    },
    outcomes: [
      {
        id: "portal-pages-not-installed",
        verdict: "FAIL",
        when: { op: "eq", key: "login-has-portal-url", value: false },
        meaning:
          "The login page on this router is still MikroTik's stock one. The guest connects, sees a plain blue MikroTik login box instead of the Wyfy portal, and has no way forward. If the portal page blocks were pasted and reported no error, this is the flash-prefix problem: the command writes to a path this model does not have, matches nothing, and succeeds.",
        nextCommand: `/file print without-paging where name~"login.html"`,
        lookFor:
          "The real path printed in the NAME column. Compare it to the path the Master console block writes to. If they differ, that is the fault, and the block has to be re-issued against the real path.",
        confidence: "field",
      },
      {
        id: "flash-prefix-mismatch",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "flash-prefix-count", value: 0 },
            { op: "gte", key: "plain-prefix-count", value: 1 },
          ],
        },
        meaning:
          "This model keeps the hotspot pages without the flash prefix, and the generated blocks write to the flash path. Those writes will match nothing, report nothing, and change nothing. Do not paste the portal page blocks as-is on this router — the path has to be corrected first, and that is a change to the generator, not something to work around on site.",
        nextCommand: `/file print without-paging where name~"hotspot"`,
        lookFor:
          "Every hotspot page path on this model. Send the exact list to whoever maintains the generator.",
        confidence: "field",
      },
      {
        id: "login-page-missing-token",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "login-has-portal-url", value: true },
            { op: "eq", key: "login-has-link-token", value: false },
          ],
        },
        meaning:
          "The login page points at the portal but does not carry the token the portal needs to finish the login. The guest reaches the portal, enters a correct code, and then sits on a spinner forever because the portal has nothing to submit back to the router. This looks exactly like a tunnel or login-server fault and is neither.",
        confidence: "field",
      },
      {
        id: "login-by-rejects-portal",
        verdict: "FAIL",
        when: { op: "notContains", key: "login-by", value: "http-pap" },
        meaning:
          "The router does not accept the kind of login form the portal submits. This is RouterOS's own factory default and it is the single most invisible failure in the product: the guest enters the correct code, nothing happens, and nothing is written to the router's log either.",
        fix: [
          {
            command: `:local p [/ip hotspot profile find where name="hsprof1"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /ip hotspot profile set $p login-by=http-pap }
:put ("login-by=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] login-by]])`,
            note: "Sets the accepted login method and prints it back. The match count comes first, so a profile that does not exist cannot pass as fixed.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "local-guest-account-enabled",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "guest-user-count", value: 1 },
            {
              op: "some",
              key: "guest-user-disabled",
              of: { op: "eq", key: "guest-user-disabled[]", value: false },
            },
          ],
        },
        meaning:
          "There is a local account on the router and it is switched on. The router checks local accounts before it asks the login server, so anyone who knows it is straight onto the internet with no code, no record, no data limit and no session. The account name and password are printed on a Master console screen, which makes this a real exposure rather than a theoretical one.",
        fix: [
          {
            command: `:local g [/ip hotspot user find where name="guest"]
:put ("matching-count=" . [:tostr [:len $g]])
:if ([:len $g] > 0) do={ /ip hotspot user set $g disabled=yes }
:put ("disabled=" . [:tostr [/ip hotspot user get [find name="guest"] disabled]])`,
            note: "Switches the account off and prints the result back. It is disabled rather than removed, so a venue that genuinely relies on it can be restored after a conversation rather than silently losing access.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "other-local-accounts",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "local-user-count", value: 1 },
            { op: "eq", key: "guest-user-count", value: 0 },
          ],
        },
        meaning:
          "Local accounts exist under names other than guest. Every one of them is checked before the login server and therefore bypasses the portal completely. Do not remove them without asking — some venues deliberately keep a staff account — but they must be known about.",
        nextCommand: "/ip hotspot user print without-paging",
        lookFor: "Each account name and whether it is switched off.",
        confidence: "field",
      },
      {
        id: "walled-garden-ip-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "wg-ip-count", value: 0 },
        meaning:
          "Unauthenticated guests cannot reach the portal over encrypted traffic. Almost all real traffic is encrypted, so in practice no guest can open the portal at all — and the router logs nothing, because blocking unauthenticated traffic is exactly what a captive portal is meant to do. The generated block that sets this up looks up the portal's address at the moment it runs and writes nothing if the lookup fails, without reporting anything.",
        nextCommand: "/ip hotspot walled-garden ip print without-paging",
        lookFor: "Whether any row exists. An empty listing here is the fault.",
        fix: [
          {
            command: `:local pip ""
:do { :set pip [:tostr [:resolve "portal.wyfyguest.com"]] } on-error={ :set pip "" }
:put ("portal-ip=" . $pip)
:local i [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]
:put ("existing-count=" . [:tostr [:len $i]])
:if ($pip != "" && [:len $i] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address=$pip comment="cloudguest-portal-https" }
:if ($pip != "" && [:len $i] > 0) do={ /ip hotspot walled-garden ip set $i dst-address=$pip }
:put ("after-count=" . [:tostr [:len [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]]])`,
            note: "Looks the portal up and allows its address through. It prints the address it resolved first — if that line is empty, name lookup is broken and nothing was written, so fix step 4 before trying again.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "walled-garden-stale-ip",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "wg-ip-count", value: 1 },
            { op: "isIpv4", key: "portal-resolves-to", excludeUnspecified: true },
            {
              op: "not",
              of: {
                op: "some",
                key: "wg-ip",
                of: { op: "eq", key: "wg-ip[]", value: "$portal-resolves-to" },
              },
            },
          ],
        },
        meaning:
          "The address allowed through is not the address the portal resolves to now. The portal moved and this router was never updated. Guests cannot open the portal, and the configuration looks complete.",
        fix: [
          {
            command: `:local pip ""
:do { :set pip [:tostr [:resolve "portal.wyfyguest.com"]] } on-error={ :set pip "" }
:put ("portal-ip=" . $pip)
:local i [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]
:put ("matching-count=" . [:tostr [:len $i]])
:if ($pip != "" && [:len $i] > 0) do={ /ip hotspot walled-garden ip set $i dst-address=$pip }
:put ("after=" . [:tostr [/ip hotspot walled-garden ip get [find where comment="cloudguest-portal-https"] dst-address]])`,
            note: "Updates the existing entry rather than adding a second one, and prints the value afterwards.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "walled-garden-host-missing",
        verdict: "WARNING",
        when: { op: "eq", key: "wg-host-count", value: 0 },
        meaning:
          "The plain-traffic entry is missing. The encrypted one covers most real traffic, so guests will usually still get through, but some devices' own connectivity checks use plain traffic and will report no internet.",
        fix: [
          {
            command: `:local h [/ip hotspot walled-garden find where comment="cloudguest-portal"]
:put ("existing-count=" . [:tostr [:len $h]])
:if ([:len $h] = 0) do={ /ip hotspot walled-garden add dst-host="portal.wyfyguest.com" action=allow comment="cloudguest-portal" }
:put ("after-count=" . [:tostr [:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]]])`,
            note: "Adds the plain-traffic entry. The two lists are separate mechanisms and both are needed.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "sessions-never-end",
        verdict: "FAIL",
        when: {
          op: "not",
          of: { op: "durationBetween", key: "hotspot[].idle", minSeconds: 60, maxSeconds: 1800 },
        },
        meaning:
          "Nothing ever closes a guest session. Session polling is deliberately off, which leaves the idle timeout as the only backstop, and it is not set. Sessions accumulate forever, data limits never take effect, and the active list grows until the venue's guests start being refused.",
        fix: [
          {
            command: `:local hs [/ip hotspot find]
:put ("matching-count=" . [:tostr [:len $hs]])
:if ([:len $hs] > 0) do={ /ip hotspot set $hs idle-timeout=5m }
:put ("idle-timeout=" . [:tostr [/ip hotspot get [:pick [/ip hotspot find] 0] idle-timeout]])`,
            note: "Sets a five minute idle timeout and prints it back.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "one-device-per-guest",
        verdict: "FAIL",
        when: { op: "lte", key: "shared-users", value: 1 },
        meaning:
          "A guest may use only one device. Their phone connects, then their laptop is refused outright with an error about no more sessions. It is a hard failure, not a soft limit, and it generates support calls immediately.",
        fix: [
          {
            command: `:local up [/ip hotspot user profile find where name="default"]
:put ("matching-count=" . [:tostr [:len $up]])
:if ([:len $up] > 0) do={ /ip hotspot user profile set $up shared-users=5 }
:put ("shared-users=" . [:tostr [/ip hotspot user profile get [find name="default"] shared-users]])`,
            note: "Allows five devices per guest and prints the result back.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "hotspot-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "hotspot-count", value: 0 },
        meaning:
          "There is no hotspot on the guest bridge. Guests will get an address and go straight onto the internet with no login at all — which is both a revenue loss and, in most jurisdictions, a compliance problem.",
        confidence: "generator",
      },
      {
        id: "hotspot-disabled",
        verdict: "FAIL",
        when: {
          op: "some",
          key: "hotspot",
          of: { op: "eq", key: "hotspot[].disabled", value: true },
        },
        meaning:
          "The hotspot exists but is switched off, which has the same effect as not having one.",
        fix: [
          {
            command: `:local hs [/ip hotspot find where interface="bridge"]
:put ("matching-count=" . [:tostr [:len $hs]])
:if ([:len $hs] > 0) do={ /ip hotspot set $hs disabled=no }`,
            note: "Switches it on. The match count is printed first.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "dns-name-wrong",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "present", key: "dns-name" },
            { op: "neq", key: "dns-name", value: "wifi.wyfyguest.com" },
          ],
        },
        meaning:
          "The name a guest can type to reach the login page is not the fleet's. Guests whose device does not open the portal by itself are told to type that name into the address bar, and it will not work.",
        confidence: "generator",
      },
      {
        id: "profile-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "profile-count", value: 0 },
        meaning:
          "The profile every hotspot setting hangs off does not exist. Nothing else in this step can be set, and any command that tries will match nothing and succeed.",
        confidence: "generator",
      },
      {
        id: "hotspot-dns-static-missing",
        verdict: "WARNING",
        when: { op: "eq", key: "hotspot-dns-static-count", value: 0 },
        meaning:
          "The login page's own name does not point at this router. Guests told to type it into the address bar will be sent to the internet instead of to the login page.",
        fix: [
          {
            command: `:local d [/ip dns static find where name="wifi.wyfyguest.com"]
:put ("existing-count=" . [:tostr [:len $d]])
:if ([:len $d] = 0) do={ /ip dns static add name="wifi.wyfyguest.com" address=10.5.50.1 comment="cloudguest-hotspot-dns-name" }
:if ([:len $d] > 0) do={ /ip dns static set $d address=10.5.50.1 }
:put ("after-count=" . [:tostr [:len [/ip dns static find where name="wifi.wyfyguest.com"]]])`,
            note: "Points the name at the router. Counts before and after are printed.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
    ],
    stopGate:
      "Three separate faults in this step let a guest connect, see a login page, and never get online — with nothing in the router's log. Every check here has to be green before the phone test is worth doing.",
  },

  // =====================================================================
  {
    id: "step17-radius-hotspot",
    n: 17,
    title: "Connecting the login page to the login server",
    why: "The hotspot and the login server can both be perfectly configured and not be joined to each other. And the counters that prove whether a guest's code was actually checked have four numbers, not three — a reply that arrives and fails validation is counted separately from a rejection and from a timeout, and it is invisible if you only watch rejections. That fourth counter was the last root cause found in a multi-hour outage.",
    dependsOn: ["step10-radius", "step16-hotspot"],
    estMinutes: 5,
    oncePerRouter: false,
    configure: [
      {
        label: "Tell the hotspot to use the login server, and to report sessions back to it.",
        script: `:local p [/ip hotspot profile find where name="hsprof1"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /ip hotspot profile set $p use-radius=yes radius-accounting=yes }
:put ("use-radius=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] use-radius]])
:put ("radius-accounting=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] radius-accounting]])`,
        oncePerRouter: false,
      },
      {
        label:
          "Turn on packet-level logging for the login server, so a failed guest login leaves a trace. Remember to turn it off again after testing.",
        script: `:local l [/system logging find where topics~"radius"]
:put ("existing-count=" . [:tostr [:len $l]])
:if ([:len $l] = 0) do={ /system logging add topics=radius action=memory }
:put ("after-count=" . [:tostr [:len [/system logging find where topics~"radius"]]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== RADIUS HOTSPOT ===="
:put "WYFY-BEGIN step17"
:local p [/ip hotspot profile find where name="hsprof1"]
:put ("profile-count=" . [:tostr [:len $p]])
:local p0 ""
:if ([:len $p] > 0) do={ :set p0 [:pick $p 0] }
:if ($p0 != "") do={ :put ("use-radius=" . [:tostr [/ip hotspot profile get $p0 use-radius]]) }
:if ($p0 != "") do={ :put ("radius-accounting=" . [:tostr [/ip hotspot profile get $p0 radius-accounting]]) }
:if ($p0 != "") do={ :put ("login-by=" . [:tostr [/ip hotspot profile get $p0 login-by]]) }
:put ("radius-count=" . [:tostr [:len [/radius find]]])
:local tip ""
:foreach ad in=[/ip address find where interface="wg-cloudguest"] do={ :set tip [:pick [/ip address get $ad address] 0 [:find [/ip address get $ad address] "/"]] }
:put ("tunnel-ip=" . $tip)
:if ([:len [/radius find]] > 0) do={ :put ("radius-src=" . [:tostr [/radius get [:pick [/radius find] 0] src-address]]) }
:put ("local-user-count=" . [:tostr [:len [/ip hotspot user find]]])
:put ("radius-log-count=" . [:tostr [:len [/system logging find where topics~"radius"]]])
:put "---- counters below ----"
/radius monitor 0 once
:put "WYFY-END step17"
:put "===================="`,
      emits: [
        {
          key: "profile-count",
          type: "int",
          required: true,
          describe: "Whether the hotspot profile exists.",
        },
        {
          key: "use-radius",
          type: "bool",
          required: true,
          describe:
            "Whether the hotspot asks the login server at all. Off means guest codes are never checked.",
        },
        {
          key: "radius-accounting",
          type: "bool",
          required: true,
          describe:
            "Whether sessions are reported back. Off means data usage is never recorded and limits never apply.",
        },
        {
          key: "login-by",
          type: "csv",
          required: false,
          describe:
            "The accepted login methods, re-checked here because the login-server block can overwrite them.",
        },
        {
          key: "radius-count",
          type: "int",
          required: true,
          describe:
            "How many login servers exist. The counters below address the first one by position, so this must be exactly one for them to mean anything.",
        },
        {
          key: "tunnel-ip",
          type: "ipv4",
          required: true,
          describe: "This router's address inside the tunnel.",
        },
        {
          key: "radius-src",
          type: "ipv4",
          required: true,
          describe:
            "The address the router sends login requests from. Must equal the tunnel address exactly.",
        },
        {
          key: "local-user-count",
          type: "int",
          required: true,
          describe: "Local accounts, which are checked before the login server and bypass it.",
        },
        {
          key: "radius-log-count",
          type: "int",
          required: false,
          describe: "Whether packet-level logging is on, so a failed login leaves a trace.",
        },
        {
          key: "pending",
          type: "int",
          required: false,
          describe: "Requests waiting for an answer right now.",
        },
        {
          key: "requests",
          type: "int",
          required: false,
          describe: "Total requests sent since the router last restarted.",
        },
        { key: "accepts", type: "int", required: true, describe: "Guest codes approved." },
        {
          key: "rejects",
          type: "int",
          required: true,
          describe: "Guest codes refused. The server was reached and said no.",
        },
        {
          key: "resends",
          type: "int",
          required: false,
          describe: "Requests sent again because no answer arrived in time.",
        },
        {
          key: "timeouts",
          type: "int",
          required: true,
          describe:
            "Requests that never got any answer. The tunnel is down or the server is not listening.",
        },
        {
          key: "bad-replies",
          type: "int",
          required: true,
          describe:
            "Answers that arrived and failed validation. This is the fourth counter, it is not a rejection, and it is invisible if you only watch rejections. It means the server side is building a malformed reply.",
        },
        {
          key: "delta-accepts",
          type: "int",
          required: false,
          describe:
            "Computed by the app: the change in approvals between the reading taken before the phone test and the one taken after. A single reading proves nothing.",
        },
        {
          key: "delta-rejects",
          type: "int",
          required: false,
          describe: "Computed by the app: the change in refusals across the phone test.",
        },
        {
          key: "delta-timeouts",
          type: "int",
          required: false,
          describe: "Computed by the app: the change in unanswered requests across the phone test.",
        },
        {
          key: "delta-bad-replies",
          type: "int",
          required: false,
          describe: "Computed by the app: the change in malformed answers across the phone test.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/radius monitor 0 once",
        purpose: "The four counters on their own, for a second reading after the phone test.",
      },
      {
        command: `/log print without-paging where topics~"radius"`,
        purpose: "Packet-level detail on what was actually exchanged.",
      },
      {
        command: "/ip hotspot profile print detail without-paging",
        purpose: "Every profile setting, to confirm the login-server settings stuck.",
      },
    ],
    fingerprint: {
      sentinelId: "step17",
      expectedMenu: "/radius monitor",
      requireAllKeys: [
        "use-radius",
        "radius-accounting",
        "accepts",
        "rejects",
        "timeouts",
        "bad-replies",
      ],
      forbidKeys: ["ranges", "add-default-route", "actual-mtu"],
      discriminator:
        "This check prints use-radius together with all four counters — {{accepts}}, {{rejects}}, {{timeouts}} and {{bad-replies}}. If {{bad-replies}} is missing from what you pasted, the copy was cut short: that counter is printed last and it is the one that matters most.",
      commonWrongPastes: [
        {
          menu: "/radius",
          tell: "SECRET",
          sayInstead:
            "That is the login server settings, which was step 10. This step needs the live counters as well. Run the block from this step.",
        },
        {
          menu: "/ip hotspot profile",
          tell: "HTML-DIRECTORY",
          sayInstead:
            "That is the hotspot profile on its own. Run the block from this step so the counters are captured at the same time.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "use-radius", value: true },
          { op: "eq", key: "radius-accounting", value: true },
          { op: "eq", key: "radius-count", value: 1 },
          { op: "eq", key: "radius-src", value: "$tunnel-ip" },
          { op: "contains", key: "login-by", value: "http-pap" },
          { op: "eq", key: "local-user-count", value: 0 },
          { op: "gte", key: "delta-accepts", value: 1 },
          { op: "eq", key: "delta-timeouts", value: 0 },
          { op: "eq", key: "delta-bad-replies", value: 0 },
        ],
      },
      means:
        "The hotspot asks the login server, sends from the right address, and a real guest login during the test was approved with no timeouts and no malformed answers. Note that this cannot pass on a single reading — it needs one before the phone test and one after.",
    },
    outcomes: [
      {
        id: "needs-second-reading",
        verdict: "UNKNOWN",
        when: { op: "absent", key: "delta-accepts" },
        meaning:
          "Only one reading has been taken. These counters are totals since the router last restarted, so a single reading says nothing at all about whether a guest login works. Do the phone test in the last step now, then run this check a second time — the difference between the two readings is the answer.",
        nextCommand: "/radius monitor 0 once",
        lookFor:
          "Run this once before the phone test and once after. Compare the four numbers. Only the change matters.",
        confidence: "field",
      },
      {
        id: "use-radius-off",
        verdict: "FAIL",
        when: { op: "eq", key: "use-radius", value: false },
        meaning:
          "The hotspot is not asking the login server at all. Guest codes are never checked. Whatever local account exists is the only way in, and if none does, nobody can log in.",
        fix: [
          {
            command: `:local p [/ip hotspot profile find where name="hsprof1"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /ip hotspot profile set $p use-radius=yes }
:put ("use-radius=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] use-radius]])`,
            note: "Joins the hotspot to the login server and prints the result back.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "accounting-off",
        verdict: "FAIL",
        when: { op: "eq", key: "radius-accounting", value: false },
        meaning:
          "Sessions are not reported back to the server. Guests can log in and nothing is recorded — no usage, no data limits, no session history. Everything looks fine until someone asks for a report or a limit fails to apply.",
        fix: [
          {
            command: `:local p [/ip hotspot profile find where name="hsprof1"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /ip hotspot profile set $p radius-accounting=yes }
:put ("radius-accounting=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] radius-accounting]])`,
            note: "Turns session reporting on and prints the result back.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "bad-replies-rising",
        verdict: "FAIL",
        when: { op: "gte", key: "delta-bad-replies", value: 1 },
        meaning:
          "Answers are arriving from the server and this router is discarding them as invalid. This is not a rejection and not a timeout — it is a third thing, and it is a fault on the server side, not on this router. The known cause is a reply built without the field the router requires to trust it. Do not change anything on the router: report the router's name and this counter to the team.",
        nextCommand: `/log print without-paging where topics~"radius"`,
        lookFor:
          "The packet-level detail around the failed login. Attach it to the ticket — this is the evidence the server side needs.",
        resolverRef: "radius-bad-replies",
        confidence: "field",
      },
      {
        id: "timeouts-rising",
        verdict: "FAIL",
        when: { op: "gte", key: "delta-timeouts", value: 1 },
        meaning:
          "Requests are going out and nothing is coming back. The request is not reaching the server, which almost always means the tunnel is down rather than anything about the login itself.",
        nextCommand: "/ping 10.20.0.1 count=4",
        lookFor: "Whether the hub answers at all. If it does not, go back to step 9.",
        confidence: "field",
      },
      {
        id: "rejects-rising",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "delta-rejects", value: 1 },
            { op: "eq", key: "delta-accepts", value: 0 },
          ],
        },
        meaning:
          "The server is being reached and is refusing. Either the shared secret no longer matches, or the server does not recognise this router. Do not press Generate in Master console to fix it — that rotates the secret again and makes it worse. Follow the recovery path instead.",
        nextCommand: `/log print without-paging where topics~"radius"`,
        lookFor:
          "Whether the refusal carries any reason at all. A refusal with no reason usually means the router was not recognised.",
        resolverRef: "secret-rotation",
        confidence: "field",
      },
      {
        id: "src-address-drifted",
        verdict: "FAIL",
        when: { op: "neq", key: "radius-src", value: "$tunnel-ip" },
        meaning:
          "The router is no longer sending login requests from its tunnel address. The server identifies routers by that address, so it cannot tell which router this is and will refuse with nothing logged on either side.",
        fix: [
          {
            command: `:local tip ""
:foreach ad in=[/ip address find where interface="wg-cloudguest"] do={ :set tip [:pick [/ip address get $ad address] 0 [:find [/ip address get $ad address] "/"]] }
:put ("tunnel-ip=" . $tip)
:local r [/radius find]
:put ("matching-count=" . [:tostr [:len $r]])
:if ($tip != "" && [:len $r] > 0) do={ /radius set $r src-address=$tip }
:put ("src-address=" . [:tostr [/radius get [:pick [/radius find] 0] src-address]])`,
            note: "Re-reads the tunnel address and writes it as the source, printing every value it used.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "counters-meaningless",
        verdict: "UNKNOWN",
        when: { op: "neq", key: "radius-count", value: 1 },
        meaning:
          "The counters address the first login server by position, so with none or more than one configured they do not describe the server this setup uses. Fix step 10 first — nothing read here can be trusted until exactly one exists.",
        confidence: "field",
      },
      {
        id: "login-by-overwritten",
        verdict: "FAIL",
        when: { op: "notContains", key: "login-by", value: "http-pap" },
        meaning:
          "The accepted login method no longer includes the one the portal uses. The certificate block sets this value too, so pasting it after step 16 can quietly undo that step's fix.",
        fix: [
          {
            command: `:local p [/ip hotspot profile find where name="hsprof1"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /ip hotspot profile set $p login-by=http-pap }
:put ("login-by=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] login-by]])`,
            note: "Restores the accepted login method and prints it back.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "local-accounts-still-present",
        verdict: "WARNING",
        when: { op: "gte", key: "local-user-count", value: 1 },
        meaning:
          "Local accounts still exist. They are checked before the login server, so a guest using one never reaches it — which also means a successful phone test can pass without the login server being involved at all. Disable them before testing or the test proves nothing.",
        confidence: "field",
      },
    ],
    stopGate:
      "Do not accept a single counter reading as proof. Take one before the phone test and one after, and read all four numbers, not just rejections.",
  },

  // =====================================================================
  {
    id: "step18-end-to-end",
    n: 18,
    title: "A real phone, end to end",
    why: "Every check up to here reads the router's own opinion of itself. This one does not. A router can pass all seventeen and still deliver a broken experience — and several of the faults this product has actually shipped were only ever visible from a guest's phone. The router cannot answer this step; only a person with a phone can.",
    dependsOn: ["step17-radius-hotspot"],
    estMinutes: 10,
    oncePerRouter: false,
    configure: [],
    probe: {
      command: `:put "==== END TO END ===="
:put "WYFY-BEGIN step18"
:put ("hosts-seen=" . [:tostr [:len [/ip hotspot host find]]])
:put ("active-logins=" . [:tostr [:len [/ip hotspot active find]]])
:foreach a in=[/ip hotspot active find] do={ :put ("active=" . [:tostr [/ip hotspot active get $a user]] . ";addr=" . [:tostr [/ip hotspot active get $a address]] . ";uptime=" . [:tostr [/ip hotspot active get $a uptime]]) }
:put ("leases=" . [:tostr [:len [/ip dhcp-server lease find]]])
:put ("radius-count=" . [:tostr [:len [/radius find]]])
:put ("local-user-count=" . [:tostr [:len [/ip hotspot user find]]])
:put ("date=" . [/system clock get date])
:put "---- counters below ----"
/radius monitor 0 once
:put "WYFY-END step18"
:put "===================="`,
      emits: [
        {
          key: "hosts-seen",
          type: "int",
          required: true,
          describe:
            "How many devices the router can see on the guest network, logged in or not. Zero while a phone is connected means the phone is not reaching this router at all.",
        },
        {
          key: "active-logins",
          type: "int",
          required: true,
          describe:
            "How many devices are actually logged in. This is the number that proves a login worked.",
        },
        {
          key: "active",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each logged-in device: which account, which address, and how long it has been on.",
        },
        {
          key: "leases",
          type: "int",
          required: false,
          describe: "How many devices currently hold an address.",
        },
        {
          key: "radius-count",
          type: "int",
          required: true,
          describe: "How many login servers exist, so the counters below can be interpreted.",
        },
        {
          key: "local-user-count",
          type: "int",
          required: true,
          describe:
            "Local accounts. If any exist, a successful test may not have involved the login server at all.",
        },
        {
          key: "date",
          type: "datetime",
          required: true,
          describe: "The clock one last time — session records with a wrong date are unusable.",
        },
        {
          key: "accepts",
          type: "int",
          required: true,
          describe: "Guest codes approved since the router restarted.",
        },
        { key: "rejects", type: "int", required: true, describe: "Guest codes refused." },
        { key: "timeouts", type: "int", required: true, describe: "Requests that got no answer." },
        {
          key: "bad-replies",
          type: "int",
          required: true,
          describe: "Answers that arrived and failed validation.",
        },
        {
          key: "delta-accepts",
          type: "int",
          required: false,
          describe: "Computed by the app: approvals gained during this phone test.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/ip hotspot active print without-paging",
        purpose: "Who is logged in right now.",
      },
      {
        command: "/ip hotspot host print without-paging",
        purpose: "Every device the router can see, logged in or not.",
      },
      {
        command: `/log print without-paging where topics~"hotspot"`,
        purpose: "What the hotspot did during the test.",
      },
    ],
    fingerprint: {
      sentinelId: "step18",
      expectedMenu: "/ip hotspot active",
      requireAllKeys: ["hosts-seen", "active-logins", "accepts", "bad-replies"],
      forbidKeys: ["ranges", "html-directory", "add-default-route"],
      discriminator:
        "This check prints hosts-seen and active-logins together with the four counters. A plain active listing has a USER/ADDRESS/UPTIME header and no counters.",
      commonWrongPastes: [
        {
          menu: "/ip hotspot active",
          tell: "SESSION-TIME-LEFT",
          sayInstead:
            "That is the logged-in list on its own. Run the block from this step so the counters are captured with it.",
        },
        {
          menu: "/ip hotspot host",
          tell: "TO-ADDRESS",
          sayInstead:
            "That is every device the router can see, which includes devices that have not logged in. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "gte", key: "hosts-seen", value: 1 },
          { op: "gte", key: "active-logins", value: 1 },
          { op: "gte", key: "delta-accepts", value: 1 },
          { op: "eq", key: "local-user-count", value: 0 },
          { op: "dateNear", key: "date", days: 2 },
        ],
      },
      means:
        "A real phone connected, was approved by the login server, and is logged in. Together with the operator confirming on the phone that a fresh website loads, this router is ready.",
    },
    outcomes: [
      {
        id: "phone-not-reaching-router",
        verdict: "FAIL",
        when: { op: "eq", key: "hosts-seen", value: 0 },
        meaning:
          "The router cannot see the phone at all. Nothing about the login matters yet. Either the phone joined a different network, or the access point is not connected to a port in the guest bridge. Check that the phone's mobile data is switched off — a phone quietly using mobile data looks connected and makes every test pass falsely.",
        nextCommand: "/interface bridge port print without-paging",
        lookFor:
          "Whether the port the access point is plugged into is actually in the guest bridge.",
        confidence: "field",
      },
      {
        id: "seen-but-not-logged-in",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "hosts-seen", value: 1 },
            { op: "eq", key: "active-logins", value: 0 },
          ],
        },
        meaning:
          "The router sees the phone and the phone has not logged in. This is the normal state before a successful login — so if the guest has already entered a correct code, the login did not complete. The counters below say where it stopped: approvals that did not rise mean the code never reached the server.",
        nextCommand: "/radius monitor 0 once",
        lookFor:
          "Which of the four numbers moved. Nothing moving at all means the login form never reached the router, which points back to the portal pages in step 16.",
        confidence: "field",
      },
      {
        id: "logged-in-without-server",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "active-logins", value: 1 },
            { op: "gte", key: "local-user-count", value: 1 },
            { op: "eq", key: "delta-accepts", value: 0 },
          ],
        },
        meaning:
          "A device is logged in and the login server approved nothing. The login used a local account and bypassed the portal completely — no code, no record, no data limit. The test looks like a success and proves the opposite of what it was meant to prove.",
        nextCommand: "/ip hotspot active print without-paging",
        lookFor:
          "The account name against the logged-in device. If it matches a local account rather than a phone number, this is the bypass.",
        fix: [
          {
            command: `:local u [/ip hotspot user find]
:put ("local-account-count=" . [:tostr [:len $u]])
:foreach x in=$u do={ :put ("account=" . [/ip hotspot user get $x name] . ";disabled=" . [:tostr [/ip hotspot user get $x disabled]]) }`,
            note: "Lists every local account and whether it is switched off. This only reports — decide with the team which to disable, because some venues deliberately keep a staff account.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "spinner-after-correct-code",
        verdict: "UNKNOWN",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "hosts-seen", value: 1 },
            { op: "eq", key: "active-logins", value: 0 },
            { op: "gte", key: "delta-accepts", value: 1 },
          ],
        },
        meaning:
          "The login server approved the code and the router never let the device through. The approval happened, so the tunnel, the server and the secret are all fine — the failure is between the portal page and the router. On an iPhone this is a known application-side problem with the login window blocking browser storage, and it is not something to fix on the router. Record it and hand it to the team.",
        nextCommand: `/log print without-paging where topics~"hotspot"`,
        lookFor:
          "Whether the router received a login attempt at all. Nothing at all means the portal never submitted, which is the application-side case.",
        confidence: "field",
      },
      {
        id: "session-expired-immediately",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "active-logins", value: 1 },
            { op: "gte", key: "delta-accepts", value: 1 },
          ],
        },
        meaning:
          "If the guest is logged in and has working internet but the app showed a session expired message, the router's work is complete. That message comes from the guest's browser blocking storage, which happens inside the iPhone login window and in private browsing. Do not change anything on the router — report it.",
        confidence: "field",
      },
      {
        id: "clock-wrong-at-the-end",
        verdict: "WARNING",
        when: { op: "not", of: { op: "dateNear", key: "date", days: 2 } },
        meaning:
          "The clock is wrong again at the end of the build. Every session record from this router will carry the wrong time and the router will report itself offline. Go back to step 1 before leaving the site.",
        confidence: "field",
      },
    ],
    stopGate:
      "Do not mark this router as live until a real phone, with mobile data switched off, has logged in and loaded a website it has never opened before. Every other check reads the router's opinion of itself.",
  },
];

/**
 * The parts of this step that a router cannot answer. The app must record
 * an explicit yes or no from the operator for each; an unanswered item is
 * UNKNOWN, never PASS.
 *
 * These are the confirmed traps, in the order they catch people out.
 */
export const STEP18_OPERATOR_CHECKLIST: {
  id: string;
  ask: string;
  ifNo: string;
  confidence: "field" | "briefed";
}[] = [
  {
    id: "mobile-data-off",
    ask: "Is mobile data switched off on the test phone, right now?",
    ifNo: "Switch it off and start the test again. A phone silently falls back to mobile data and every part of the test passes while nothing actually works. Never run this test without it off.",
    confidence: "field",
  },
  {
    id: "portal-opens-itself",
    ask: "Did the Wyfy sign-in page open by itself when the phone joined the network?",
    ifNo: "Open the browser's address bar — the address bar, not the search box — and type wifi.wyfyguest.com. If the Wyfy page appears that way, the router is fine and only the automatic pop-up is not working. If a plain blue MikroTik page appears instead, the portal pages were never installed: go back to step 16.",
    confidence: "field",
  },
  {
    id: "code-arrives",
    ask: "Did the code arrive on the phone?",
    ifNo: "This is not a router problem. The router is not involved in sending the code at all. Report it with the phone number used and the time.",
    confidence: "briefed",
  },
  {
    id: "login-completes",
    ask: "After entering the code, did the phone reach a connected screen?",
    ifNo: "Run the check on this step again and look at which counter moved. If approvals rose, the router approved it and the failure is in the app — record it and hand it over. If nothing moved, the code never reached the router.",
    confidence: "field",
  },
  {
    id: "fresh-site-loads",
    ask: "Open a website the phone has never opened before. Does it load normally?",
    ifNo: "A site that was opened before can load from the phone's own cache and look like working internet. If a genuinely new site does not load, the login opened the portal but not the internet — check the outbound translation rule in step 3.",
    confidence: "field",
  },
  {
    id: "reconnect-survives",
    ask: "Switch the phone's Wi-Fi off, wait ten seconds, switch it back on. Does it either work straight away or offer the sign-in page again?",
    ifNo: "If it shows connected with no internet, that is a known application-side fault that has been fixed once already. Report it rather than changing the router.",
    confidence: "field",
  },
  {
    id: "second-device",
    ask: "Connect a second device with the same phone number. Does it get online too?",
    ifNo: "The guest is limited to one device. Go back to step 16 and check how many devices a guest is allowed.",
    confidence: "field",
  },
];
