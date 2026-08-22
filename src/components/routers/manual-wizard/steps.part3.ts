/**
 * Manual MikroTik Configuration Wizard — steps 6-10.
 * Identity -> cloud registration -> WireGuard -> tunnel validation -> RADIUS.
 *
 * Steps 8 and 10 are the only `oncePerRouter: true` steps in the flow, and
 * the reason is worth stating plainly: pressing Generate again in Master
 * console rotates four secrets on the server side, while the paste-blocks
 * are all add-if-missing with no branch that updates an existing key or
 * secret. After a second Generate, re-pasting every chunk does NOT repair
 * the router. The old tunnel and RADIUS entry have to be removed first.
 * The wizard must warn before, not explain after.
 */

import type { ManualStep } from "./types";

export const STEPS_PART3: ManualStep[] = [
  // =====================================================================
  {
    id: "step06-identity",
    n: 6,
    title: "Router name",
    why: "The name is how this router is recognised in logs, in RADIUS and in Master console. A fleet where every router is called MikroTik cannot be supported at all, and the name is also what appears in the tunnel and RADIUS records the hub matches against.",
    dependsOn: ["step05-internet-validation"],
    estMinutes: 1,
    oncePerRouter: false,
    configure: [
      {
        label:
          "Set the router name. Replace the placeholder with the name shown in Master console for this router.",
        script: `/system identity set name="REPLACE-ROUTER-NAME"
:put ("identity=" . [/system identity get name])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== IDENTITY ===="
:put "WYFY-BEGIN step06"
:put ("identity=" . [/system identity get name])
:put "WYFY-END step06"
:put "===================="`,
      emits: [
        {
          key: "identity",
          type: "string",
          required: true,
          describe: "The router's name as it will appear everywhere else.",
        },
      ],
    },
    contextCommands: [
      { command: "/system identity print without-paging", purpose: "The name on its own." },
    ],
    fingerprint: {
      sentinelId: "step06",
      expectedMenu: "/system identity",
      requireAllKeys: ["identity"],
      forbidKeys: ["board-name", "address-pool", "gateway"],
      discriminator: "This check prints one line beginning with identity=. Nothing else.",
      commonWrongPastes: [
        {
          menu: "/system resource",
          tell: "board-name",
          sayInstead: "That is the hardware information. This step only needs the router's name.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "present", key: "identity" },
          { op: "neq", key: "identity", value: "MikroTik" },
        ],
      },
      means:
        "The router has a real name. Check it character for character against Master console before continuing.",
    },
    outcomes: [
      {
        id: "identity-still-factory",
        verdict: "FAIL",
        when: { op: "eq", key: "identity", value: "MikroTik" },
        meaning:
          "Still the factory name. Set it to the name Master console shows for this router — not a name you invent on site, because the hub matches on it.",
        confidence: "generator",
      },
      {
        id: "identity-placeholder",
        verdict: "FAIL",
        when: { op: "matches", key: "identity", regex: "REPLACE" },
        meaning: "The placeholder text was pasted without being replaced.",
        confidence: "generator",
      },
      {
        id: "identity-suspicious",
        verdict: "WARNING",
        when: { op: "matches", key: "identity", regex: "\\s" },
        meaning:
          "The name contains a space. It will work, but it is awkward in logs and in some RADIUS records. Prefer dashes.",
        confidence: "standard-routeros",
      },
    ],
  },

  // =====================================================================
  {
    id: "step07-cloud-registration",
    n: 7,
    title: "Reporting in to Master console",
    why: "This is the step that decides whether the router ever appears as online in Master console, and it is the one that fails most invisibly. A scheduler is created with an interval; if the clock was wrong when it was created, it captures a bad start time and never runs. The router then works perfectly for guests and reports in never — and nothing anywhere says so except a run count that stays at zero.",
    dependsOn: ["step06-identity"],
    estMinutes: 5,
    oncePerRouter: true,
    configure: [
      {
        label:
          "Paste the API Access and Heartbeat blocks from Master console. They carry this router's own credential and cannot be written by hand.",
        script: "(from Master console — the API Access and Heartbeat chunks)",
        oncePerRouter: true,
      },
    ],
    probe: {
      command: `:put "==== CLOUD REGISTRATION ===="
:put "WYFY-BEGIN step07"
:put ("api-user-count=" . [:tostr [:len [/user find where name="cloudguest-api"]]])
:local apiSvc "unknown"
:do { :set apiSvc [:tostr [/ip service get [find name="api"] disabled]] } on-error={ :set apiSvc "unknown" }
:put ("api-service-disabled=" . $apiSvc)
:local s [/system scheduler find where name="cloudguest-heartbeat-sched"]
:put ("sched-count=" . [:tostr [:len $s]])
:local s0 ""
:if ([:len $s] > 0) do={ :set s0 [:pick $s 0] }
:if ($s0 != "") do={ :put ("sched-interval=" . [:tostr [/system scheduler get $s0 interval]]) }
:if ($s0 != "") do={ :put ("sched-run-count=" . [:tostr [/system scheduler get $s0 run-count]]) }
:if ($s0 != "") do={ :put ("sched-next-run=" . [:tostr [/system scheduler get $s0 next-run]]) }
:if ($s0 != "") do={ :put ("sched-disabled=" . [:tostr [/system scheduler get $s0 disabled]]) }
:put ("heartbeat-warn-count=" . [:tostr [:len [/log find where message~"cloudguest-heartbeat"]]])
:put ("login-failure-count=" . [:tostr [:len [/log find where message~"login failure for user cloudguest-api"]]])
:put ("date=" . [/system clock get date])
:put "WYFY-END step07"
:put "===================="`,
      emits: [
        {
          key: "api-user-count",
          type: "int",
          required: true,
          describe: "Whether the account Master console uses to reach this router exists.",
        },
        {
          key: "api-service-disabled",
          type: "string",
          required: true,
          describe: "Whether the interface Master console connects over is switched off.",
        },
        {
          key: "sched-count",
          type: "int",
          required: true,
          describe: "Whether the reporting task exists at all.",
        },
        {
          key: "sched-interval",
          type: "duration",
          required: false,
          describe: "How often the router reports in. Expected five minutes.",
        },
        {
          key: "sched-run-count",
          type: "int",
          required: false,
          describe: "How many times it has actually run. Zero is the whole point of this step.",
        },
        {
          key: "sched-next-run",
          type: "string",
          required: false,
          describe: "When it will run next.",
        },
        {
          key: "sched-disabled",
          type: "bool",
          required: false,
          describe: "Whether the task has been switched off.",
        },
        {
          key: "heartbeat-warn-count",
          type: "int",
          required: true,
          describe: "How many times reporting in has failed and logged a warning.",
        },
        {
          key: "login-failure-count",
          type: "int",
          required: true,
          describe:
            "Failed logins for the Master console account. Any of these means the secrets on the router and on the server no longer match.",
        },
        {
          key: "date",
          type: "datetime",
          required: true,
          describe:
            "The clock again, because a wrong clock is the usual reason the task never runs.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/system scheduler print detail without-paging",
        purpose: "The reporting task in full, including what it runs.",
      },
      {
        command: `/log print without-paging where message~"cloudguest"`,
        purpose: "Everything this platform has logged on this router.",
      },
    ],
    fingerprint: {
      sentinelId: "step07",
      expectedMenu: "/system scheduler",
      requireAllKeys: [
        "api-user-count",
        "sched-count",
        "heartbeat-warn-count",
        "login-failure-count",
      ],
      forbidKeys: ["address-pool", "dst-address", "html-directory"],
      discriminator:
        "This check prints sched-count and sched-run-count. A plain scheduler listing prints a NAME/START-TIME/INTERVAL table and none of those keys.",
      commonWrongPastes: [
        {
          menu: "/system scheduler",
          tell: "ON-EVENT",
          sayInstead:
            "That is the scheduler listing. It does not show the log warnings this step also needs. Run the block from this step.",
        },
        {
          menu: "/user",
          tell: "GROUP",
          sayInstead: "That is the account list on its own. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "gte", key: "api-user-count", value: 1 },
          { op: "eq", key: "sched-count", value: 1 },
          { op: "eq", key: "sched-disabled", value: false },
          { op: "gte", key: "sched-run-count", value: 1 },
          { op: "eq", key: "login-failure-count", value: 0 },
        ],
      },
      means:
        "The account exists, the reporting task exists, and it has actually run at least once. Confirm in Master console that this router now shows as online.",
    },
    outcomes: [
      {
        id: "heartbeat-never-ran",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "sched-count", value: 1 },
            { op: "eq", key: "sched-run-count", value: 0 },
          ],
        },
        meaning:
          "The reporting task exists and has never run. If it was only just created this is normal — it runs every five minutes. Wait five minutes and run this check again. If it is still zero after that, the clock was wrong when the task was created and the task will never fire on its own.",
        nextCommand: "/system scheduler print detail without-paging",
        lookFor:
          "The start time and the next run time. A start time in 1970, or a next run that never moves, means the task was created against a wrong clock.",
        fix: [
          {
            command: `:local s [/system scheduler find where name="cloudguest-heartbeat-sched"]
:put ("matching-count=" . [:tostr [:len $s]])
:if ([:len $s] > 0) do={ /system scheduler set $s start-time=startup }
:put ("start-time=" . [:tostr [/system scheduler get [find where name="cloudguest-heartbeat-sched"] start-time]])`,
            note: "Only use this after confirming the clock is correct. It re-anchors the task so it stops waiting for a time that already passed. It prints the match count first, so a task that does not exist cannot pass as fixed.",
            destructive: false,
            confidence: "unverified",
          },
        ],
        confidence: "field",
      },
      {
        id: "no-scheduler",
        verdict: "FAIL",
        when: { op: "eq", key: "sched-count", value: 0 },
        meaning:
          "The reporting task does not exist. The Heartbeat block from Master console was never pasted, or was pasted into a different router. This router will never appear as online no matter how well everything else works.",
        confidence: "generator",
      },
      {
        id: "secret-mismatch",
        verdict: "FAIL",
        when: { op: "gte", key: "login-failure-count", value: 1 },
        meaning:
          "Failed logins for the Master console account are in the log. This is what a second press of Generate looks like from the router's side: the server rotated the secrets and the router still holds the old ones. Re-pasting the blocks will NOT repair it, because they only add what is missing and never update what is already there.",
        nextCommand: `/log print without-paging where message~"login failure"`,
        lookFor:
          "How recent the failures are. Failures from before the last paste are historical and can be ignored.",
        fix: [
          {
            command: `:local u [/user find where name="cloudguest-api"]
:put ("removing-count=" . [:tostr [:len $u]])
:if ([:len $u] > 0) do={ /user remove $u }`,
            note: "Removes only this platform's own account, then press Generate in Master console exactly once and paste the fresh blocks in the same sitting. Do not press Generate more than once — every press rotates the secrets again.",
            destructive: true,
            confirmPrompt:
              "This removes the account Master console uses to reach this router. Until you paste the fresh blocks, this router cannot be managed remotely. Continue?",
            confidence: "field",
          },
        ],
        resolverRef: "secret-rotation",
        confidence: "field",
      },
      {
        id: "no-api-user",
        verdict: "FAIL",
        when: { op: "eq", key: "api-user-count", value: 0 },
        meaning:
          "The Master console account does not exist. The API Access block was never pasted.",
        confidence: "generator",
      },
      {
        id: "api-service-off",
        verdict: "FAIL",
        when: { op: "eq", key: "api-service-disabled", value: "true" },
        meaning:
          "The account exists but the service it connects over is switched off, so Master console still cannot reach the router.",
        fix: [
          {
            command: `/ip service set api disabled=no
:put ("api-disabled=" . [:tostr [/ip service get [find name="api"] disabled]])`,
            note: "Switches the service on and prints the result back.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "scheduler-disabled",
        verdict: "FAIL",
        when: { op: "eq", key: "sched-disabled", value: true },
        meaning:
          "The reporting task exists but is switched off. Someone disabled it, probably while debugging.",
        fix: [
          {
            command: `:local s [/system scheduler find where name="cloudguest-heartbeat-sched"]
:put ("matching-count=" . [:tostr [:len $s]])
:if ([:len $s] > 0) do={ /system scheduler set $s disabled=no }`,
            note: "Switches it back on. The match count is printed first so an empty match is visible.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "heartbeat-warnings",
        verdict: "WARNING",
        when: { op: "gte", key: "heartbeat-warn-count", value: 1 },
        meaning:
          "Reporting in has failed at least once and logged it. The task is running, so the clock is fine — the failure is reaching the server. Usually a name lookup problem or the internet dropping.",
        nextCommand: `/log print without-paging where message~"cloudguest-heartbeat"`,
        lookFor: "Whether the failures are all old, or are still happening now.",
        confidence: "generator",
      },
      {
        id: "duplicate-schedulers",
        verdict: "WARNING",
        when: { op: "gte", key: "sched-count", value: 2 },
        meaning:
          "The reporting task exists more than once. The router reports in several times per interval, which is wasteful but not harmful. It usually means the Heartbeat block was pasted twice under slightly different names.",
        confidence: "generator",
      },
    ],
    stopGate:
      "A router that never reports in is invisible to support. Do not treat this step as cosmetic — this is the one that silently costs the most later.",
  },

  // =====================================================================
  {
    id: "step08-wireguard",
    n: 8,
    title: "Tunnel to the hub",
    why: "The tunnel is how the router reaches the login server. Without it a guest enters a correct code and watches a spinner forever, with nothing in the router's log to explain it. This step is once per router: the keys come from Master console and pressing Generate again replaces them on the server while leaving the router holding the old ones.",
    dependsOn: ["step05-internet-validation", "step04-dns"],
    estMinutes: 5,
    oncePerRouter: true,
    configure: [
      {
        label:
          "Paste the WireGuard Tunnel block from Master console. It carries this router's private key and cannot be written by hand. Paste it once.",
        script: "(from Master console — the WireGuard Tunnel chunk)",
        oncePerRouter: true,
      },
    ],
    probe: {
      command: `:put "==== WIREGUARD ===="
:put "WYFY-BEGIN step08"
:put ("wg-count=" . [:tostr [:len [/interface wireguard find]]])
:foreach w in=[/interface wireguard find] do={ :put ("wg=" . [/interface wireguard get $w name] . ";running=" . [:tostr [/interface wireguard get $w running]] . ";listen-port=" . [:tostr [/interface wireguard get $w listen-port]]) }
:put ("expected-wg-count=" . [:tostr [:len [/interface wireguard find where name="wg-cloudguest"]]])
:put ("legacy-wg-count=" . [:tostr [:len [/interface wireguard find where name="wg-cloudguard"]]])
:local w0 ""
:if ([:len [/interface wireguard find where name="wg-cloudguest"]] > 0) do={ :set w0 [:pick [/interface wireguard find where name="wg-cloudguest"] 0] }
:if ($w0 != "") do={ :put ("router-public-key=" . [:tostr [/interface wireguard get $w0 public-key]]) }
:local p [/interface wireguard peers find where interface="wg-cloudguest"]
:put ("peer-count=" . [:tostr [:len $p]])
:local p0 ""
:if ([:len $p] > 0) do={ :set p0 [:pick $p 0] }
:if ($p0 != "") do={ :put ("peer-endpoint=" . [:tostr [/interface wireguard peers get $p0 endpoint-address]]) }
:if ($p0 != "") do={ :put ("peer-port=" . [:tostr [/interface wireguard peers get $p0 endpoint-port]]) }
:if ($p0 != "") do={ :put ("peer-allowed=" . [:tostr [/interface wireguard peers get $p0 allowed-address]]) }
:if ($p0 != "") do={ :put ("peer-keepalive=" . [:tostr [/interface wireguard peers get $p0 persistent-keepalive]]) }
:local a [/ip address find where interface="wg-cloudguest"]
:put ("tunnel-address-count=" . [:tostr [:len $a]])
:foreach x in=$a do={ :put ("tunnel-address=" . [:tostr [/ip address get $x address]]) }
:local hip ""
:do { :set hip [:tostr [:resolve "hub.wyfyguest.com"]] } on-error={ :set hip "" }
:put ("hub-resolves-to=" . $hip)
:put "WYFY-END step08"
:put "===================="`,
      emits: [
        {
          key: "wg-count",
          type: "int",
          required: true,
          describe: "How many tunnels exist on this router in total.",
        },
        {
          key: "wg",
          type: "string",
          multi: true,
          required: false,
          describe: "Each tunnel: its name, whether it is up, and the port it listens on.",
        },
        {
          key: "expected-wg-count",
          type: "int",
          required: true,
          describe: "Whether the tunnel this platform expects exists, by name.",
        },
        {
          key: "legacy-wg-count",
          type: "int",
          required: true,
          describe:
            "Whether a tunnel exists under the other name the backend used to emit. Two tunnels means the firewall rule is bound to the wrong one.",
        },
        {
          key: "router-public-key",
          type: "string",
          required: false,
          describe:
            "This router's own public key. The hub has to hold the matching entry — worth reading back to whoever set the hub side up.",
        },
        {
          key: "peer-count",
          type: "int",
          required: true,
          describe: "Whether the hub is configured as a peer. Should be exactly one.",
        },
        {
          key: "peer-endpoint",
          type: "string",
          required: false,
          describe: "Where the router dials to reach the hub.",
        },
        { key: "peer-port", type: "int", required: false, describe: "The port it dials." },
        {
          key: "peer-allowed",
          type: "string",
          required: false,
          describe: "Which addresses are routed into the tunnel.",
        },
        {
          key: "peer-keepalive",
          type: "duration",
          required: false,
          describe:
            "How often the router pokes the tunnel to keep it open through the venue's own firewall.",
        },
        {
          key: "tunnel-address-count",
          type: "int",
          required: true,
          describe:
            "Whether this router has an address inside the tunnel. Without one, the tunnel comes up and carries nothing.",
        },
        {
          key: "tunnel-address",
          type: "string",
          multi: true,
          required: false,
          describe: "The router's address inside the tunnel.",
        },
        {
          key: "hub-resolves-to",
          type: "ipv4",
          required: true,
          describe:
            "What the hub's name currently resolves to, so an unresolvable endpoint is caught here rather than in step 9.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/interface wireguard print detail without-paging",
        purpose: "The tunnel in full.",
      },
      {
        command: "/interface wireguard peers print detail without-paging",
        purpose: "The hub peer in full, including the last handshake.",
      },
      {
        command: `/ip address print detail without-paging where interface="wg-cloudguest"`,
        purpose: "The router's address inside the tunnel.",
      },
    ],
    fingerprint: {
      sentinelId: "step08",
      expectedMenu: "/interface wireguard",
      requireAllKeys: ["wg-count", "expected-wg-count", "peer-count", "tunnel-address-count"],
      forbidKeys: ["address-pool", "html-directory", "add-default-route"],
      discriminator:
        "This check prints wg-count together with peer-count. The tunnel list on its own has a NAME/MTU/LISTEN-PORT header and no peer information at all.",
      commonWrongPastes: [
        {
          menu: "/interface wireguard",
          tell: "LISTEN-PORT",
          sayInstead:
            "That is the tunnel list. A tunnel can exist with no peer and no address, which is exactly the case this step is looking for. Run the block from this step.",
        },
        {
          menu: "/interface wireguard peers",
          tell: "ALLOWED-ADDRESS",
          sayInstead:
            "That is the peer list on its own. Run the block from this step so both halves are checked together.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "expected-wg-count", value: 1 },
          { op: "eq", key: "legacy-wg-count", value: 0 },
          { op: "eq", key: "peer-count", value: 1 },
          { op: "gte", key: "tunnel-address-count", value: 1 },
          { op: "isIpv4", key: "hub-resolves-to", excludeUnspecified: true },
        ],
      },
      means:
        "One tunnel with the expected name, one hub peer, an address inside the tunnel, and the hub's name resolves. Step 9 checks whether it actually carries traffic — this step only checks that it is built.",
    },
    outcomes: [
      {
        id: "two-tunnel-names",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "gte", key: "expected-wg-count", value: 1 },
            { op: "gte", key: "legacy-wg-count", value: 1 },
          ],
        },
        meaning:
          "Two tunnels exist under two different names. This happens when both the Master console blocks and the older automatic path were used on the same router. The firewall rule that lets management traffic in is bound to one of them, so the other one comes up and is silently blocked. Do not guess which to remove — check with the team which name the hub actually holds an entry for.",
        nextCommand: "/interface wireguard peers print detail without-paging",
        lookFor:
          "Which of the two tunnels has a recent handshake. That is the one the hub is actually talking to.",
        confidence: "field",
      },
      {
        id: "no-tunnel",
        verdict: "FAIL",
        when: { op: "eq", key: "expected-wg-count", value: 0 },
        meaning:
          "The tunnel does not exist. The WireGuard block from Master console was never pasted on this router.",
        confidence: "generator",
      },
      {
        id: "no-peer",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "expected-wg-count", value: 1 },
            { op: "eq", key: "peer-count", value: 0 },
          ],
        },
        meaning:
          "The tunnel exists with no hub peer. It will show as a perfectly normal interface and will never connect to anything. Usually the paste was cut short partway through the block.",
        confidence: "generator",
      },
      {
        id: "no-tunnel-address",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "expected-wg-count", value: 1 },
            { op: "eq", key: "tunnel-address-count", value: 0 },
          ],
        },
        meaning:
          "The tunnel has no address on this side. The handshake can still succeed and nothing can be sent through it. RADIUS in step 10 also needs this address as its source, so this fault surfaces two steps later as a RADIUS timeout.",
        confidence: "generator",
      },
      {
        id: "hub-name-not-resolving",
        verdict: "FAIL",
        when: { op: "not", of: { op: "isIpv4", key: "hub-resolves-to", excludeUnspecified: true } },
        meaning:
          "The hub's name does not resolve right now. If the tunnel block was pasted while this was true, the peer was created pointing at nothing and will never connect. Fix name lookup first, then remove and re-add the peer — changing the endpoint is what forces the router to look it up again.",
        nextCommand: `/ip dns print without-paging`,
        lookFor: "Whether name servers are configured at all. Go back to step 4 if not.",
        confidence: "briefed",
      },
      {
        id: "multiple-peers",
        verdict: "WARNING",
        when: { op: "gte", key: "peer-count", value: 2 },
        meaning:
          "More than one peer on this tunnel. Usually a leftover from an earlier hub address. Only one of them will handshake; the others are noise that makes every later diagnosis harder.",
        nextCommand: "/interface wireguard peers print detail without-paging",
        lookFor: "Which peer has a recent handshake and which have never handshaken at all.",
        confidence: "field",
      },
      {
        id: "keepalive-missing",
        verdict: "WARNING",
        when: { op: "absent", key: "peer-keepalive" },
        meaning:
          "No keepalive on the peer. The tunnel will connect and then quietly die whenever the venue's own router forgets the connection, typically within a few minutes of idleness. It then only comes back when the router happens to send something.",
        fix: [
          {
            command: `:local p [/interface wireguard peers find where interface="wg-cloudguest"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /interface wireguard peers set $p persistent-keepalive=25s }`,
            note: "Sets the keepalive on the existing peer. The match count is printed first so an empty match cannot pass as done.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "endpoint-is-legacy-ip",
        verdict: "WARNING",
        when: { op: "eq", key: "peer-endpoint", value: "20.219.72.235" },
        meaning:
          "The peer points at the hub's old fixed address rather than its name. It may still work today, but it will break without warning the next time the hub moves. Raise it with the team rather than editing it on site.",
        confidence: "briefed",
      },
    ],
    stopGate:
      "Do not press Generate in Master console again to fix anything here. It rotates the secrets on the server and leaves the router holding the old ones, and re-pasting every block does not repair that.",
  },

  // =====================================================================
  {
    id: "step09-wireguard-validation",
    n: 9,
    title: "Proof that the tunnel carries traffic",
    why: "A tunnel that is configured and a tunnel that works look identical in the configuration. The single most common reason a correctly built tunnel does not connect is rule order: the rule that lets tunnel traffic in ends up below the rule that drops everything arriving from the internet, so the hub's reply is thrown away by this router itself.",
    dependsOn: ["step08-wireguard"],
    estMinutes: 4,
    oncePerRouter: false,
    configure: [
      {
        label:
          "Move the tunnel rule above the drop rule, if it is below it. Safe to run more than once.",
        script: `:local allow [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]
:local drop [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]
:put ("allow-count=" . [:tostr [:len $allow]])
:put ("drop-count=" . [:tostr [:len $drop]])
:if ([:len $allow] > 0 && [:len $drop] > 0) do={ /ip firewall filter move $allow destination=$drop }`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== WIREGUARD VALIDATION ===="
:put "WYFY-BEGIN step09"
:local p [/interface wireguard peers find where interface="wg-cloudguest"]
:put ("peer-count=" . [:tostr [:len $p]])
:foreach x in=$p do={ :put ("peer=" . [:tostr [/interface wireguard peers get $x endpoint-address]] . ";handshake=" . [:tostr [/interface wireguard peers get $x last-handshake]] . ";rx=" . [:tostr [/interface wireguard peers get $x rx]] . ";tx=" . [:tostr [/interface wireguard peers get $x tx]]) }
:put ("ping-hub=" . [:tostr [/ping 10.20.0.1 count=4]])
:local allow [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]
:local drop [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]
:put ("allow-rule-count=" . [:tostr [:len $allow]])
:put ("drop-rule-count=" . [:tostr [:len $drop]])
:local allowId ""
:local dropId ""
:if ([:len $allow] > 0) do={ :set allowId [:pick $allow 0] }
:if ([:len $drop] > 0) do={ :set dropId [:pick $drop 0] }
:local pos 0
:local allowPos -1
:local dropPos -1
:foreach f in=[/ip firewall filter find] do={ :set pos ($pos + 1); :if ($f = $allowId) do={ :set allowPos $pos }; :if ($f = $dropId) do={ :set dropPos $pos } }
:put ("allow-position=" . [:tostr $allowPos])
:put ("drop-position=" . [:tostr $dropPos])
:put ("tunnel-address-count=" . [:tostr [:len [/ip address find where interface="wg-cloudguest"]]])
:put "WYFY-END step09"
:put "===================="`,
      emits: [
        {
          key: "peer-count",
          type: "int",
          required: true,
          describe: "How many hub peers this tunnel has.",
        },
        {
          key: "peer",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each peer: where it dials, when it last handshook, and how many bytes have moved in each direction.",
        },
        {
          key: "ping-hub",
          type: "int",
          required: true,
          describe:
            "How many of four pings the hub answered through the tunnel. This is the real test.",
        },
        {
          key: "allow-rule-count",
          type: "int",
          required: true,
          describe: "Whether the rule that lets tunnel traffic in exists.",
        },
        {
          key: "drop-rule-count",
          type: "int",
          required: true,
          describe: "Whether the rule that drops everything from the internet side exists.",
        },
        {
          key: "allow-position",
          type: "int",
          required: true,
          describe: "Where the allow rule sits in the list. -1 means it is not there.",
        },
        {
          key: "drop-position",
          type: "int",
          required: true,
          describe: "Where the drop rule sits. The allow rule must come first.",
        },
        {
          key: "tunnel-address-count",
          type: "int",
          required: true,
          describe: "Whether this router still has an address inside the tunnel.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/interface wireguard peers print detail without-paging",
        purpose: "The peer with its handshake time and byte counters.",
      },
      {
        command: "/ip firewall filter print without-paging chain=input",
        purpose: "The input rules in the order the router applies them.",
      },
    ],
    fingerprint: {
      sentinelId: "step09",
      expectedMenu: "/interface wireguard peers",
      requireAllKeys: ["peer-count", "ping-hub", "allow-position", "drop-position"],
      forbidKeys: ["address-pool", "html-directory"],
      discriminator:
        "This check prints ping-hub together with allow-position and drop-position. Neither the peer list nor the firewall list alone prints any of those.",
      commonWrongPastes: [
        {
          menu: "/interface wireguard peers",
          tell: "ALLOWED-ADDRESS",
          sayInstead:
            "That is the peer list. It does not show whether the firewall is throwing the hub's replies away, which is the usual cause. Run the block from this step.",
        },
        {
          menu: "/ping",
          tell: "sent=",
          sayInstead:
            "That is a bare ping. Run the block from this step so the firewall order is captured at the same time.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "peer-count", value: 1 },
          { op: "gte", key: "ping-hub", value: 1 },
          { op: "gte", key: "tunnel-address-count", value: 1 },
        ],
      },
      means:
        "The hub answers through the tunnel. This is the only proof that matters at this step.",
    },
    outcomes: [
      {
        id: "firewall-order-wrong",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "ping-hub", value: 0 },
            { op: "gte", key: "allow-position", value: 1 },
            { op: "gte", key: "drop-position", value: 1 },
            { op: "gte", key: "allow-position", value: 2 },
          ],
        },
        meaning:
          "The rule that lets tunnel traffic in sits below the rule that drops everything from the internet side, so this router throws the hub's replies away itself. Compare the two positions printed above: the allow rule must have the lower number.",
        nextCommand: "/ip firewall filter print without-paging chain=input",
        lookFor:
          "The row numbers of the two rules. The one whose comment mentions allow-wg-mgmt must appear above the one whose comment mentions drop-wan-input.",
        fix: [
          {
            command: `:local allow [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]
:local drop [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]
:put ("allow-count=" . [:tostr [:len $allow]])
:put ("drop-count=" . [:tostr [:len $drop]])
:if ([:len $allow] > 0 && [:len $drop] > 0) do={ /ip firewall filter move $allow destination=$drop }`,
            note: "Moves the allow rule directly above the drop rule and touches nothing else. Both counts are printed first, so if either rule is missing you will see it rather than getting a silent no-op. The handshake normally returns within 30 seconds.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "no-allow-rule",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "ping-hub", value: 0 },
            { op: "eq", key: "allow-rule-count", value: 0 },
          ],
        },
        meaning:
          "The rule that lets tunnel traffic in does not exist at all, and the drop rule does. Everything the hub sends is discarded on arrival.",
        fix: [
          {
            command: `:local a [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]
:local d [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]
:put ("allow-count=" . [:tostr [:len $a]])
:if ([:len $a] = 0 && [:len $d] > 0) do={ /ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt" place-before=$d }
:if ([:len $a] = 0 && [:len $d] = 0) do={ /ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt" }
:put ("after-count=" . [:tostr [:len [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]]])`,
            note: "Adds the rule, placing it above the drop rule when that rule exists. It prints the count before and after so an add that did nothing is visible.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "never-handshook",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "ping-hub", value: 0 },
            { op: "lte", key: "allow-position", value: -1 },
            { op: "lte", key: "drop-position", value: -1 },
          ],
        },
        meaning:
          "The hub does not answer and neither firewall rule is present, so the firewall is not the cause. Either the hub does not hold this router's key, or the venue's own internet connection blocks the tunnel port outbound.",
        nextCommand: "/interface wireguard peers print detail without-paging",
        lookFor:
          "The last handshake. If it has never handshaken at all, send this router's public key from step 8 to whoever manages the hub and have them confirm the hub holds it.",
        confidence: "field",
      },
      {
        id: "handshake-but-no-ping",
        verdict: "UNKNOWN",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "ping-hub", value: 0 },
            { op: "gte", key: "tunnel-address-count", value: 1 },
            { op: "some", key: "peer", of: { op: "gte", key: "peer[].rx", value: 1 } },
          ],
        },
        meaning:
          "Bytes have arrived from the hub, so the tunnel itself is alive, but the hub does not answer pings. Either the hub is deliberately not answering pings, or the addresses routed into the tunnel do not include the hub's own address. The next step's RADIUS counters will settle this — a tunnel that carries RADIUS is working regardless of pings.",
        nextCommand: "/interface wireguard peers print detail without-paging",
        lookFor: "The allowed-address value. The hub's tunnel address has to fall inside it.",
        confidence: "field",
      },
      {
        id: "tunnel-address-gone",
        verdict: "FAIL",
        when: { op: "eq", key: "tunnel-address-count", value: 0 },
        meaning:
          "The router has no address inside the tunnel any more. Nothing can be sent through it, and RADIUS in the next step will have no source address to use.",
        confidence: "generator",
      },
    ],
    stopGate:
      "If the hub does not answer, guest logins cannot be verified at all. The guest enters the right code and sees a spinner forever, and nothing appears in the router's log.",
  },

  // =====================================================================
  {
    id: "step10-radius",
    n: 10,
    title: "Login server settings",
    why: "This is what turns a guest's code into an approval. It has to point at the hub's address inside the tunnel, and it has to send from this router's own tunnel address — if it sends from the internet-side address instead, the hub cannot match it to a router and rejects it with nothing logged anywhere. Like the tunnel, this is once per router: the shared secret comes from Master console and pressing Generate again replaces it on the server only.",
    dependsOn: ["step09-wireguard-validation"],
    estMinutes: 4,
    oncePerRouter: true,
    configure: [
      {
        label:
          "Paste the RADIUS block from Master console. It carries this router's shared secret. Paste it once, in the same sitting as registering the router on the hub — registering rotates the secret.",
        script: "(from Master console — the RADIUS chunk)",
        oncePerRouter: true,
      },
      {
        label:
          "Set the source address to this router's own tunnel address. Run this after the block above.",
        script: `:local tip ""
:foreach ad in=[/ip address find where interface="wg-cloudguest"] do={ :set tip [:pick [/ip address get $ad address] 0 [:find [/ip address get $ad address] "/"]] }
:put ("tunnel-ip=" . $tip)
:local r [/radius find]
:put ("radius-count=" . [:tostr [:len $r]])
:if ($tip != "" && [:len $r] > 0) do={ /radius set $r src-address=$tip }
:put ("src-address=" . [:tostr [/radius get [:pick [/radius find] 0] src-address]])`,
        oncePerRouter: false,
      },
    ],
    probe: {
      command: `:put "==== RADIUS ===="
:put "WYFY-BEGIN step10"
:local r [/radius find]
:put ("radius-count=" . [:tostr [:len $r]])
:foreach x in=$r do={ :put ("radius=" . [:tostr [/radius get $x address]] . ";service=" . [:tostr [/radius get $x service]] . ";src=" . [:tostr [/radius get $x src-address]] . ";timeout=" . [:tostr [/radius get $x timeout]] . ";disabled=" . [:tostr [/radius get $x disabled]]) }
:local tip ""
:foreach ad in=[/ip address find where interface="wg-cloudguest"] do={ :set tip [:pick [/ip address get $ad address] 0 [:find [/ip address get $ad address] "/"]] }
:put ("tunnel-ip=" . $tip)
:local h ""
:if ([:len $r] > 0) do={ :set h [:tostr [/radius get [:pick $r 0] address]] }
:put ("radius-address=" . $h)
:if ($h != "") do={ :put ("ping-radius=" . [:tostr [/ping $h count=4]]) }
:put ("incoming-accept=" . [:tostr [/radius incoming get accept]])
:put "WYFY-END step10"
:put "===================="`,
      emits: [
        {
          key: "radius-count",
          type: "int",
          required: true,
          describe:
            "How many login servers are configured. Must be exactly one — with two, the router tries them in an order you cannot predict.",
        },
        {
          key: "radius",
          type: "string",
          multi: true,
          required: false,
          describe:
            "Each entry: its address, what it is used for, the address it sends from, how long it waits, and whether it is switched off.",
        },
        {
          key: "tunnel-ip",
          type: "ipv4",
          required: true,
          describe:
            "This router's own address inside the tunnel. The source address must match this exactly.",
        },
        {
          key: "radius-address",
          type: "ipv4",
          required: true,
          describe: "The address of the login server.",
        },
        {
          key: "ping-radius",
          type: "int",
          required: false,
          describe: "Whether the login server answers through the tunnel.",
        },
        {
          key: "incoming-accept",
          type: "bool",
          required: false,
          describe:
            "Whether the router accepts disconnect messages from the server. Informational.",
        },
      ],
    },
    contextCommands: [
      {
        command: "/radius print detail without-paging",
        purpose: "The login server settings in full.",
      },
      {
        command: `/ip address print detail without-paging where interface="wg-cloudguest"`,
        purpose: "The tunnel address the source must match.",
      },
    ],
    fingerprint: {
      sentinelId: "step10",
      expectedMenu: "/radius",
      requireAllKeys: ["radius-count", "tunnel-ip", "radius-address"],
      forbidKeys: ["address-pool", "html-directory", "add-default-route"],
      discriminator:
        "This check prints radius-count together with tunnel-ip. The counters view prints {{accepts}}, {{rejects}} and {{timeouts}} instead and belongs to step 17, not here.",
      commonWrongPastes: [
        {
          menu: "/radius monitor",
          tell: "bad-replies",
          sayInstead:
            "Those are the live counters, which step 17 uses. This step checks the settings. Run the block from this step.",
        },
        {
          menu: "/radius incoming",
          tell: "accept:",
          sayInstead: "That is only the incoming setting. Run the block from this step.",
        },
      ],
    },
    pass: {
      when: {
        op: "all",
        of: [
          { op: "eq", key: "radius-count", value: 1 },
          { op: "eq", key: "radius-address", value: "10.20.0.1" },
          { op: "isIpv4", key: "tunnel-ip", excludeUnspecified: true },
          {
            op: "some",
            key: "radius",
            of: { op: "contains", key: "radius[].service", value: "hotspot" },
          },
          { op: "some", key: "radius", of: { op: "eq", key: "radius[].src", value: "$tunnel-ip" } },
          { op: "some", key: "radius", of: { op: "eq", key: "radius[].disabled", value: false } },
        ],
      },
      means:
        "Exactly one login server, pointing at the hub inside the tunnel, sending from this router's own tunnel address, and used for the guest hotspot.",
    },
    outcomes: [
      {
        id: "wrong-source-address",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "radius-count", value: 1 },
            {
              op: "not",
              of: {
                op: "some",
                key: "radius",
                of: { op: "eq", key: "radius[].src", value: "$tunnel-ip" },
              },
            },
          ],
        },
        meaning:
          "The login server is configured but the router is not sending from its tunnel address. The hub identifies routers by the address they send from, so it cannot tell which router this is. The result is a rejection returned over a successful request with nothing logged on either side — the guest sees a spinner and there is no error anywhere.",
        nextCommand: "/radius print detail without-paging",
        lookFor:
          "The src-address value. It must equal the tunnel-ip printed by this step's check, exactly.",
        fix: [
          {
            command: `:local tip ""
:foreach ad in=[/ip address find where interface="wg-cloudguest"] do={ :set tip [:pick [/ip address get $ad address] 0 [:find [/ip address get $ad address] "/"]] }
:put ("tunnel-ip=" . $tip)
:local r [/radius find]
:put ("matching-count=" . [:tostr [:len $r]])
:if ($tip != "" && [:len $r] > 0) do={ /radius set $r src-address=$tip }
:put ("src-address=" . [:tostr [/radius get [:pick [/radius find] 0] src-address]])`,
            note: "Reads the router's tunnel address and writes it as the source. It prints the address it read, the number of entries it matched, and the value afterwards — so an empty match cannot look like success.",
            destructive: false,
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "no-radius",
        verdict: "FAIL",
        when: { op: "eq", key: "radius-count", value: 0 },
        meaning:
          "No login server configured. The RADIUS block from Master console was never pasted. Every guest code will fail to verify.",
        confidence: "generator",
      },
      {
        id: "duplicate-radius",
        verdict: "FAIL",
        when: { op: "gte", key: "radius-count", value: 2 },
        meaning:
          "More than one login server. The router will try them in an order you cannot control, and the counters view used in step 17 addresses the first one by position, so its numbers become meaningless too. Only one entry may remain.",
        nextCommand: "/radius print detail without-paging",
        lookFor:
          "Which entries point at {{10.20.0.1}} and which are leftovers from an earlier attempt or a different hub.",
        fix: [
          {
            command: `:local wrong [/radius find where address!="10.20.0.1"]
:put ("removing-count=" . [:tostr [:len $wrong]])
:if ([:len $wrong] > 0) do={ /radius remove $wrong }
:put ("remaining-count=" . [:tostr [:len [/radius find]]])`,
            note: "Removes only entries that do not point at the expected hub address. If two entries both point at it, do not remove either — that means the block was pasted twice and the team has to say which secret is current.",
            destructive: true,
            confirmPrompt:
              "This removes login server entries that point somewhere other than the hub. If this venue deliberately uses a second server, do not continue. Continue?",
            confidence: "field",
          },
        ],
        confidence: "field",
      },
      {
        id: "radius-disabled",
        verdict: "FAIL",
        when: {
          op: "some",
          key: "radius",
          of: { op: "eq", key: "radius[].disabled", value: true },
        },
        meaning:
          "The login server entry is switched off. Someone disabled it while debugging and did not switch it back.",
        fix: [
          {
            command: `:local r [/radius find]
:put ("matching-count=" . [:tostr [:len $r]])
:if ([:len $r] > 0) do={ /radius set $r disabled=no }`,
            note: "Switches it back on. The match count is printed first.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "radius-wrong-address",
        verdict: "FAIL",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "radius-count", value: 1 },
            { op: "neq", key: "radius-address", value: "10.20.0.1" },
          ],
        },
        meaning:
          "The login server points somewhere other than the hub's address inside the tunnel. If it points at a public address, the requests leave over the internet instead of the tunnel and will not be accepted.",
        confidence: "briefed",
      },
      {
        id: "radius-service-missing-hotspot",
        verdict: "FAIL",
        when: {
          op: "not",
          of: {
            op: "some",
            key: "radius",
            of: { op: "contains", key: "radius[].service", value: "hotspot" },
          },
        },
        meaning:
          "The entry exists but is not marked for use by the guest hotspot, so the hotspot will never consult it. Guests fall through to whatever local accounts exist, which is the portal bypass this setup is supposed to close.",
        fix: [
          {
            command: `:local r [/radius find]
:put ("matching-count=" . [:tostr [:len $r]])
:if ([:len $r] > 0) do={ /radius set $r service=hotspot }
:put ("service=" . [:tostr [/radius get [:pick [/radius find] 0] service]])`,
            note: "Marks the entry for hotspot use and prints the result back.",
            destructive: false,
            confidence: "generator",
          },
        ],
        confidence: "generator",
      },
      {
        id: "radius-unreachable",
        verdict: "WARNING",
        when: {
          op: "all",
          of: [
            { op: "eq", key: "radius-count", value: 1 },
            { op: "eq", key: "ping-radius", value: 0 },
          ],
        },
        meaning:
          "The login server does not answer pings. That may be deliberate on the hub's side, so it is not proof of a fault — but combined with a failure in step 9 it means the tunnel is down and no guest will be able to log in. Step 17's counters give the definitive answer.",
        confidence: "field",
      },
      {
        id: "no-tunnel-ip",
        verdict: "FAIL",
        when: { op: "not", of: { op: "isIpv4", key: "tunnel-ip", excludeUnspecified: true } },
        meaning:
          "This router has no address inside the tunnel, so there is nothing to set as the source address. Go back to step 8.",
        confidence: "generator",
      },
    ],
    stopGate:
      "Do not press Generate in Master console to fix a rejection here. It rotates the secret on the server and the router keeps the old one, and re-pasting the block does not update it.",
  },
];
