/**
 * Manual MikroTik Configuration Wizard — steps 1-2.
 * Router info/clock -> physical ports.
 *
 * Split across `steps.part1..part5.ts` purely for file size;
 * `steps.content.ts` concatenates them into the single exported
 * `MANUAL_STEPS` array.
 *
 * Every `probe.command` here obeys the module invariants:
 *   - bracketed by WYFY-BEGIN/WYFY-END <sentinelId>
 *   - emits FACTS only, never a verdict
 *   - emits an explicit `*-count=` for anything that is a set
 *   - `print`s carry `without-paging`
 *   - never `get`s an item without first proving the find is non-empty
 */

import type { ManualStep } from "./types";

export const STEPS_PART1: ManualStep[] = [
  // =====================================================================
  {
    id: "step01-router-info",
    n: 1,
    title: "Router identity, firmware and clock",
    why: "Two things here decide whether everything after it is real. A hEX has no battery clock, so a fresh or power-cycled router boots with a wrong date — and a wrong date silently breaks the heartbeat scheduler and every HTTPS fetch, so the router works for guests but shows offline in Master console forever. And WireGuard does not exist on RouterOS 6 at all, so a v6 box cannot be onboarded until it is upgraded. Both are cheaper to find now than in step 9.",
    dependsOn: [],
    estMinutes: 3,
    oncePerRouter: false,
    configure: [
      {
        label: "Set the timezone and turn on NTP. Run this first, before anything else.",
        script: `/system clock set time-zone-name=Asia/Kolkata
/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== ROUTER INFO + CLOCK ===="
:put "WYFY-BEGIN step01"
:put ("version=" . [/system resource get version])
:put ("board=" . [/system resource get board-name])
:local arch "unknown"
:do { :set arch [/system resource get architecture-name] } on-error={ :set arch "unknown" }
:put ("arch=" . $arch)
:put ("uptime=" . [:tostr [/system resource get uptime]])
:put ("free-flash=" . [:tostr [/system resource get free-hdd-space]])
:put ("identity=" . [/system identity get name])
:put ("date=" . [/system clock get date])
:put ("time=" . [/system clock get time])
:put ("timezone=" . [:tostr [/system clock get time-zone-name]])
:local ntpEn "unknown"
:do { :set ntpEn [:tostr [/system ntp client get enabled]] } on-error={ :set ntpEn "unknown" }
:put ("ntp-enabled=" . $ntpEn)
:local ntpSt "unknown"
:do { :set ntpSt [:tostr [/system ntp client get status]] } on-error={ :set ntpSt "unknown" }
:put ("ntp-status=" . $ntpSt)
:local wgMenu "absent"
:do { :set wgMenu ("present-" . [:tostr [:len [/interface wireguard find]]]) } on-error={ :set wgMenu "absent" }
:put ("wg-menu=" . $wgMenu)
:put "WYFY-END step01"
:put "===================="`,
      emits: [
        {
          key: "version",
          type: "version",
          required: true,
          describe: "RouterOS version running on this router.",
        },
        { key: "board", type: "string", required: true, describe: "Hardware model." },
        {
          key: "arch",
          type: "string",
          required: false,
          describe: "CPU architecture. Only used for support tickets.",
        },
        {
          key: "uptime",
          type: "duration",
          required: true,
          describe:
            "How long since the last reboot. A very short uptime plus a wrong date means the router just lost power.",
        },
        {
          key: "free-flash",
          type: "int",
          required: true,
          describe: "Free storage in bytes. The portal redirect pages need room to be written.",
        },
        {
          key: "identity",
          type: "string",
          required: true,
          describe: "The router's name. Still MikroTik means step 6 has not been done.",
        },
        {
          key: "date",
          type: "datetime",
          required: true,
          describe: "The router's own idea of today's date.",
        },
        { key: "time", type: "string", required: true, describe: "The router's own clock time." },
        { key: "timezone", type: "string", required: true, describe: "Timezone name." },
        {
          key: "ntp-enabled",
          type: "string",
          required: true,
          describe: "Whether the NTP client is switched on.",
        },
        {
          key: "ntp-status",
          type: "string",
          required: true,
          describe:
            "Whether NTP has actually synchronised, which is not the same as being switched on.",
        },
        {
          key: "wg-menu",
          type: "string",
          required: true,
          describe: "Whether this RouterOS build even has WireGuard.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/system resource print without-paging",
        purpose: "Full hardware and firmware detail to attach to a support ticket.",
      },
      {
        command: "/system package print without-paging",
        purpose: "Which RouterOS packages are installed and enabled on this box.",
      },
    ],
    fingerprint: {
      sentinelId: "step01",
      expectedMenu: "/system resource",
      requireAllKeys: ["version", "board", "date", "time", "wg-menu"],
      forbidKeys: ["add-default-route", "address-pool", "dst-address"],
      discriminator:
        "This check prints version, board, date and wg-menu on their own lines. If what you pasted has none of those, you ran a different command.",
      commonWrongPastes: [
        {
          menu: "/system routerboard",
          tell: "routerboard:",
          sayInstead:
            "That is the routerboard check. Copy the whole block from this step, including the first and last lines, and run that instead.",
        },
        {
          menu: "/system clock",
          tell: "gmt-offset",
          sayInstead:
            "That is only the clock. This step needs the full block, which also reads the firmware version.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "dateNear", key: "date", days: 2 },
          { op: "gte", key: "version", value: 7 },
          { op: "matches", key: "wg-menu", regex: "^present-" },
        ],
      },
      means:
        "The clock is right, the firmware is version 7, and WireGuard is available. Safe to continue.",
    },
    outcomes: [
      {
        id: "clock-wrong",
        verdict: "FAIL",
        when: { op: "not", of: { op: "dateNear", key: "date", days: 2 } },
        meaning:
          "The router's date is wrong. This box has no battery clock, so it boots with a wrong date after every power cut. Nothing will look broken — guests will get internet — but the heartbeat scheduler captures a bad start time, the router reports offline in Master console forever, and HTTPS downloads fail. Fix it now; it is very hard to spot later.",
        nextCommand: "/system clock print without-paging",
        lookFor:
          "The date line. Anything in 1970, 2000, or more than two days away from today is wrong.",
        fix: [
          {
            command: "/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1",
            note: "Turn on NTP. This needs working internet, so if step 5 has not passed yet, do that first and come back. Wait 15 seconds and run the check again.",
            destructive: false,
            confidence: "field",
          },
          {
            command:
              "/system ntp client set enabled=yes primary-ntp=216.239.35.0 secondary-ntp=162.159.200.1",
            note: "Use this form instead only if the router is on RouterOS 6. The servers= form does not exist there and is rejected.",
            destructive: false,
            confidence: "standard-routeros",
          },
          {
            command: "/system clock set time-zone-name=Asia/Kolkata",
            note: "Set the timezone. Without it the clock can be right and every timestamp still off by hours.",
            destructive: false,
            confidence: "field",
          },
        ],
        resolverRef: "clock-wrong",
        confidence: "field",
      },
      {
        id: "routeros-v6",
        verdict: "FAIL",
        when: { op: "lte", key: "version", value: 6 },
        meaning:
          "This router is on RouterOS 6. WireGuard does not exist there, so the tunnel, RADIUS and the whole guest login cannot be built on this box as it stands.",
        nextCommand: "/system package print without-paging",
        lookFor: "The version column, and whether a v7 upgrade package is already uploaded.",
        fix: [
          {
            command: "/system package update check-for-updates",
            note: "Check what upgrade is available. Do not start the upgrade unattended — a RouterOS major upgrade reboots the router and can take it off the network. Confirm with the team first.",
            destructive: false,
            confidence: "standard-routeros",
          },
        ],
        resolverRef: "bad-command-name",
        confidence: "standard-routeros",
      },
      {
        id: "wireguard-menu-missing",
        verdict: "FAIL",
        when: { op: "eq", key: "wg-menu", value: "absent" },
        meaning:
          "This RouterOS build has no WireGuard menu even though the version looks like 7. Usually a stripped or unusual package set on this hardware.",
        nextCommand: "/system package print without-paging",
        lookFor:
          "Whether the main system package is present and enabled, and whether anything is marked scheduled for disable.",
        confidence: "standard-routeros",
      },
      {
        id: "ntp-not-synced",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "dateNear", key: "date", days: 2 },
            { op: "notIn", key: "ntp-status", values: ["synchronized", "synchronised"] },
          ],
        },
        meaning:
          "The date is right today but NTP has not synchronised, so it will drift and it will be wrong again after the next power cut. Worth fixing now while you are standing at the router.",
        nextCommand: "/system ntp client print without-paging",
        lookFor: "Whether enabled is yes and whether any server address is listed.",
        fix: [
          {
            command: "/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1",
            note: "Re-apply the NTP settings, then wait 15 seconds and re-run the check.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "identity-default",
        verdict: "WARNING",
        when: { op: "eq", key: "identity", value: "MikroTik" },
        meaning:
          "The router still has its factory name. Step 6 sets the real one. Harmless right now, but a fleet of routers all called MikroTik is unsupportable.",
        confidence: "generator",
      },
      {
        id: "flash-nearly-full",
        verdict: "WARNING",
        when: { op: "lte", key: "free-flash", value: 1000000 },
        meaning:
          "Under 1 MB of free storage. The portal redirect pages in step 16 are written into the router's own filesystem, and a write that runs out of room does not always report an error.",
        nextCommand: "/file print without-paging",
        lookFor:
          "Large leftover files — old backup files, uploaded .rsc scripts, an old upgrade package.",
        confidence: "standard-routeros",
      },
      {
        id: "just-rebooted",
        verdict: "WARNING",
        when: { op: "durationBetween", key: "uptime", minSeconds: 0, maxSeconds: 120 },
        meaning:
          "The router came up less than two minutes ago. DHCP, NTP and the WAN link may not have settled. Wait a minute and run the check again before reading anything into a failure further down.",
        confidence: "field",
      },
    ],
    stopGate:
      "Do not go past this step with a wrong date. Everything after it will appear to work and the router will still never report in.",
  },

  // =====================================================================
  {
    id: "step02-interfaces",
    n: 2,
    title: "Physical ports",
    why: "Everything later names ports literally — {{ether1}} for the internet, a bridge called {{bridge}} for the guest LAN. If a previous engineer renamed a port, or the ISP cable is in the wrong socket, the later commands do not fail loudly. Some of them match nothing and succeed anyway.",
    dependsOn: ["step01-router-info"],
    estMinutes: 3,
    oncePerRouter: false,
    configure: [],
    probe: {
      command: `:put "==== INTERFACES ===="
:put "WYFY-BEGIN step02"
:put ("eth-count=" . [:tostr [:len [/interface ethernet find]]])
:foreach i in=[/interface ethernet find] do={ :put ("eth=" . [/interface ethernet get $i name] . ";running=" . [:tostr [/interface ethernet get $i running]] . ";disabled=" . [:tostr [/interface ethernet get $i disabled]]) }
:put ("wan-present=" . [:tostr ([:len [/interface ethernet find where name="ether1"]] > 0)])
:local wanRun "unknown"
:do { :set wanRun [:tostr [/interface ethernet get [find name="ether1"] running]] } on-error={ :set wanRun "unknown" }
:put ("wan-running=" . $wanRun)
:put ("wan-in-bridge-count=" . [:tostr [:len [/interface bridge port find where interface="ether1"]]])
:put ("bridge-count=" . [:tostr [:len [/interface bridge find]]])
:foreach b in=[/interface bridge find] do={ :put ("bridge=" . [/interface bridge get $b name]) }
:put ("bridge-correct-name=" . [:tostr ([:len [/interface bridge find where name="bridge"]] > 0)])
:put ("bridge-wrong-name=" . [:tostr ([:len [/interface bridge find where name="bridge1"]] > 0)])
:put ("factory-bridge=" . [:tostr ([:len [/interface bridge find where name="bridgeLocal"]] > 0)])
:put ("stale-defconf-dhcp=" . [:tostr [:len [/ip dhcp-client find where interface="bridgeLocal"]]])
:put "WYFY-END step02"
:put "===================="`,
      emits: [
        {
          key: "eth-count",
          type: "int",
          required: true,
          describe: "How many physical ethernet ports this router has.",
        },
        {
          key: "eth",
          type: "string",
          multi: true,
          required: true,
          describe:
            "One row per port: its name, whether a cable is live on it, and whether it is switched off.",
        },
        {
          key: "wan-present",
          type: "bool",
          required: true,
          describe: "Whether a port literally named {{ether1}} exists.",
        },
        {
          key: "wan-running",
          type: "string",
          required: true,
          describe: "Whether {{ether1}} has a live cable in it.",
        },
        {
          key: "wan-in-bridge-count",
          type: "int",
          required: true,
          describe: "Whether the internet port has been added to a LAN bridge. It must not be.",
        },
        { key: "bridge-count", type: "int", required: true, describe: "How many bridges exist." },
        {
          key: "bridge",
          type: "string",
          multi: true,
          required: false,
          describe: "Names of the bridges that exist.",
        },
        {
          key: "bridge-correct-name",
          type: "bool",
          required: true,
          describe:
            "Whether a bridge named {{bridge}} exists — the name the rest of this wizard uses.",
        },
        {
          key: "bridge-wrong-name",
          type: "bool",
          required: true,
          describe:
            "Whether a bridge named {{bridge1}} exists, which the old Fleet Wizard created.",
        },
        {
          key: "factory-bridge",
          type: "bool",
          required: true,
          describe: "Whether the factory default bridge is still present.",
        },
        {
          key: "stale-defconf-dhcp",
          type: "int",
          required: true,
          describe:
            "A leftover DHCP client on the factory bridge. It keeps its old lease and gives the router the same IP on two interfaces.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/interface print without-paging",
        purpose: "Every interface on the router, with its type.",
      },
      {
        command: "/interface ethernet print without-paging",
        purpose: "The physical ports and their link state.",
      },
      {
        command: "/interface bridge port print without-paging",
        purpose: "Which ports belong to which bridge.",
      },
    ],
    fingerprint: {
      sentinelId: "step02",
      expectedMenu: "/interface ethernet",
      requireAllKeys: ["eth-count", "wan-present", "wan-running", "bridge-count"],
      forbidKeys: ["add-default-route", "address-pool"],
      discriminator:
        "This check prints eth-count and wan-present. A plain interface list has a NAME/TYPE/ACTUAL-MTU header and none of those keys.",
      commonWrongPastes: [
        {
          menu: "/interface",
          tell: "ACTUAL-MTU",
          sayInstead:
            "That is the plain interface list. Run the block from this step instead — it also checks whether the internet port has been put into the LAN bridge by mistake.",
        },
        {
          menu: "/interface bridge",
          tell: "PROTOCOL-MODE",
          sayInstead: "That is only the bridge list. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "gte", key: "eth-count", value: 2 },
          { op: "eq", key: "wan-present", value: true },
          { op: "eq", key: "wan-running", value: "true" },
          { op: "eq", key: "wan-in-bridge-count", value: 0 },
        ],
      },
      means:
        "{{ether1}} exists, has a live cable, and is not part of any LAN bridge. The port layout is what the rest of the setup expects.",
    },
    outcomes: [
      {
        id: "wan-renamed",
        verdict: "FAIL",
        when: { op: "eq", key: "wan-present", value: false },
        meaning:
          "There is no port called {{ether1}}. Someone renamed it, or this model names its ports differently. Every later command that names {{ether1}} will either error or, worse, match nothing and silently do nothing.",
        nextCommand: "/interface ethernet print without-paging",
        lookFor:
          "The NAME column. Note the real name of the port the ISP cable is in — every command in this wizard has to use that name instead.",
        resolverRef: "input-does-not-match-interface",
        confidence: "generator",
      },
      {
        id: "wan-in-bridge",
        verdict: "FAIL",
        when: { op: "gte", key: "wan-in-bridge-count", value: 1 },
        meaning:
          "The internet port has been added to a LAN bridge. That puts the ISP and the guests on the same layer-2 network: the hotspot cannot control traffic, and the router can end up handing guest addresses upstream. This is a real fault, not cosmetic.",
        nextCommand: "/interface bridge port print without-paging",
        lookFor: "The row whose INTERFACE is {{ether1}}. Note which BRIDGE it belongs to.",
        fix: [
          {
            command: `:local p [/interface bridge port find where interface="ether1"]
:put ("removing-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /interface bridge port remove $p }`,
            note: "Removes only the bridge membership of {{ether1}} and nothing else. It prints how many rows it is about to remove first, so you can see it actually matched something.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "wan-no-link",
        verdict: "FAIL",
        when: { op: "eq", key: "wan-running", value: "false" },
        meaning:
          "No live cable on {{ether1}}. The ISP cable goes in {{ether1}} and the laptop goes in {{ether2}} — the two are very often swapped.",
        nextCommand: `/interface ethernet monitor [find name="ether1"] once`,
        lookFor:
          "The status line. {{no-link}} means nothing is plugged in or the far end is off; {{link-ok}} means the cable is fine and the problem is further up.",
        confidence: "field",
      },
      {
        id: "bridge-named-bridge1",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "bridge-wrong-name", value: true },
            { op: "eq", key: "bridge-correct-name", value: false },
          ],
        },
        meaning:
          "This router has a bridge called {{bridge1}}, not {{bridge}}. That is the old Fleet Wizard's default and it does not match anything else in this setup. Do not rename it blind — decide now, with the team, whether this router keeps {{bridge1}} (in which case every later command must be edited to say {{bridge1}}) or is rebuilt on {{bridge}}.",
        nextCommand: "/interface bridge port print without-paging",
        lookFor:
          "How many ports are already in {{bridge1}}, and whether anything is already using it.",
        confidence: "generator",
      },
      {
        id: "stale-factory-dhcp-client",
        verdict: "WARNING",
        when: { op: "gte", key: "stale-defconf-dhcp", value: 1 },
        meaning:
          "A leftover DHCP client is still bound to the factory bridge. It keeps its last lease even with no ports attached, so the router ends up with the same address on two interfaces. Seen live as roughly 65 percent packet loss to the WAN gateway with nothing wrong with the cabling.",
        fix: [
          {
            command: `:local c [/ip dhcp-client find where interface="bridgeLocal"]
:put ("removing-count=" . [:tostr [:len $c]])
:if ([:len $c] > 0) do={ /ip dhcp-client remove $c }`,
            note: "Removes only the DHCP client attached to the factory bridge. That bridge is never used by this platform, so nothing else is affected.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "single-port-device",
        verdict: "WARNING",
        when: { op: "lte", key: "eth-count", value: 1 },
        meaning:
          "Only one physical port. There is no separate management port, so any change that breaks the network also cuts you off from the router. Work over the console cable or over WinBox by MAC address, not over IP.",
        confidence: "standard-routeros",
      },
    ],
    stopGate:
      "Do not continue if {{ether1}} is missing or is inside a bridge. Later steps name it literally and will quietly do nothing.",
  },
];
