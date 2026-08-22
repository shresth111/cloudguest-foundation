/**
 * Manual MikroTik Configuration Wizard — the Error Resolver knowledge base.
 *
 * The installer pastes a RouterOS error. The app matches it here and walks
 * a DIAGNOSTIC LADDER — run this, look for that, and only then a fix.
 *
 * ---------------------------------------------------------------------
 * WHY A LADDER AND NOT A LOOKUP
 * ---------------------------------------------------------------------
 * Every error in this file has more than one cause, and the causes need
 * opposite responses. `input does not match any value of interface` means
 * "the bridge is called bridge1" on one router and "the PPPoE interface
 * has not been created yet" on another; removing config on the first is
 * harmless and on the second destroys a working WAN. A lookup table that
 * jumps straight to a fix is how this product acquired its failure history.
 *
 * So: rung 0 is NEVER a fix. Rung 0 is always a read-only command whose
 * output selects a branch. Fixes only ever hang off a branch.
 *
 * ---------------------------------------------------------------------
 * SAFETY, ENFORCED NOT DOCUMENTED
 * ---------------------------------------------------------------------
 * See `NEVER_AUTO_RUN` and `SAFETY_RULES` at the bottom. The short form:
 * no destructive command runs without an explicit typed confirmation; no
 * router reset is ever offered as a first, second or third response; and
 * nothing on the device that this platform did not create is ever removed.
 *
 * ---------------------------------------------------------------------
 * TRANSLATION
 * ---------------------------------------------------------------------
 * `meansHere`, `lookFor`, `means`, `note`, `confirmPrompt` and `doNot` are
 * English source prose and need Hindi. `errorText`, `aliases`, `command`
 * and `tell` are device literals and must ship byte-identical in both
 * locales — `tell` especially: it is the token the operator hunts for in
 * real output, and a translated `As` or `bound` sends them looking for
 * something that will never be there.
 */

import type { FixAction, Lit, ResolverEntry, T } from "./types";

export const RESOLVER: ResolverEntry[] = [
  // =====================================================================
  {
    id: "clock-wrong",
    errorText: "(no error — the router's date is simply wrong)",
    aliases: ["jan/01/1970", "1970-01-01", "invalid-before", "certificate is not valid yet"],
    meansHere:
      "This hardware has no battery-backed clock, so it boots with a wrong date after every power cut, and there is no error message anywhere. This is the most expensive silent failure recorded on this product because everything visible keeps working: guests connect, browse and log in perfectly, while the router's reporting task captures a start time that has already passed and never fires again, so the router shows offline in Master console forever. Secure downloads also fail, which is what breaks the reporting even when the task does run. Nothing in the generated blocks sets the clock at all.",
    seenInSteps: ["step01-router-info", "step05-internet-validation", "step07-cloud-registration"],
    sequence: [
      {
        command: "/system clock print without-paging",
        lookFor:
          "The date, compared against today. Note that the date is printed in one of two formats depending on the RouterOS version, so read the year rather than pattern-matching the whole string.",
        branches: [
          {
            tell: "1970",
            means:
              "The clock was never set since the last power cut. This is the cause of whatever sent you here. It cannot be fixed without working internet, so check that first if the time service does not take.",
            thenStepIndex: 1,
          },
          {
            tell: "2000",
            means:
              "Same condition as a 1970 date — some builds fall back to a different epoch. Treat it identically.",
            thenStepIndex: 1,
          },
          {
            tell: "time-zone-name: manual",
            means:
              "No timezone is set, so even a correct clock produces timestamps hours away from real time. Session records and log lines from this router will not line up with anything.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: "/ping 8.8.8.8 count=4",
        lookFor:
          "Whether the router has internet at all. The time service cannot set the clock without it, and a router that has just been powered on may not have finished getting an address yet.",
        branches: [
          {
            tell: "received=0",
            means:
              "No internet, so the clock cannot correct itself. Fix the internet connection first — the clock is downstream of it, not the other way round.",
            thenStepIndex: -1,
          },
          {
            tell: "received=4",
            means:
              "Internet works, so the time service will correct the clock within a few seconds of being switched on.",
            thenStepIndex: -1,
            fix: [
              {
                command: `/system clock set time-zone-name=Asia/Kolkata
/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1
:delay 12s
:put ("date=" . [/system clock get date])
:put ("time=" . [/system clock get time])
:local st "unknown"
:do { :set st [:tostr [/system ntp client get status]] } on-error={ :set st "unknown" }
:put ("ntp-status=" . $st)`,
                note: "Sets the timezone, switches the time service on, waits, then prints the date, the time and the service status back so you can see it actually took. If the date has not moved, the router has no internet yet — fix that rather than running this again.",
                destructive: false,
                confidence: "field",
              },
              {
                command: `/system clock set time-zone-name=Asia/Kolkata
/system ntp client set enabled=yes primary-ntp=216.239.35.0 secondary-ntp=162.159.200.1
:delay 12s
:put ("date=" . [/system clock get date])`,
                note: "Use this form instead only on RouterOS 6, where the setting has a different name. On version 7 it is rejected. Check the version from step 1 before choosing.",
                destructive: false,
                confidence: "standard-routeros",
              },
            ],
          },
        ],
      },
      {
        command: "/system scheduler print detail without-paging",
        lookFor:
          "The reporting task's run count and its next run time. A task created while the clock was wrong keeps a start time that has already passed and never fires, even after the clock is corrected.",
        branches: [
          {
            tell: "run-count=0",
            means:
              "The task has never run. If it was created only minutes ago this is normal — it runs every five minutes, so wait and look again. If the clock was wrong when it was created, it will still be zero after that, and the task has to be re-anchored.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local s [/system scheduler find where name="cloudguest-heartbeat-sched"]
:put ("matching-count=" . [:tostr [:len $s]])
:if ([:len $s] > 0) do={ /system scheduler set $s start-time=startup }
:put ("start-time=" . [:tostr [/system scheduler get [find where name="cloudguest-heartbeat-sched"] start-time]])`,
                note: "Only run this after the clock is confirmed correct, or it re-anchors the task to another wrong time. It prints the match count first, so a task that does not exist cannot pass as fixed. This re-anchoring has not been confirmed on a real device — watch the run count for two intervals afterwards rather than assuming it worked.",
                destructive: false,
                confidence: "unverified",
              },
            ],
          },
        ],
      },
    ],
    doNot: [
      "Do not set the date by hand and leave it there. It will be wrong again after the next power cut and the fault comes back looking entirely new.",
      "Do not treat a router that serves guests correctly as proof the clock is fine. Guests are unaffected by a wrong clock; only the reporting and secure connections are.",
      "Do not re-anchor the reporting task before the clock is correct.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "already-have-such-entry",
    errorText: "failure: already have such entry",
    aliases: ["already have such entry", "entry already exists"],
    meansHere:
      "RouterOS refused to create something because an identical one is already there. In this setup that is nearly always harmless — a block was pasted twice — but it can also mean an earlier attempt left behind a version with different settings, which is not harmless at all. The question is never whether it exists, it is whether the one that exists is the right one.",
    seenInSteps: [
      "step03-wan-dhcp",
      "step11-bridge-lan",
      "step13-lan-address",
      "step14-dhcp-pool",
      "step15-dhcp-server",
      "step16-hotspot",
      "step10-radius",
    ],
    sequence: [
      {
        command: "(no command yet — first identify which menu the failed command belonged to)",
        lookFor:
          "The first part of the command that failed, up to the word add. That names the menu. The next rung reads that menu.",
        branches: [
          {
            tell: "/ip address",
            means: "The router's own address. Read the address list next.",
            thenStepIndex: 1,
          },
          {
            tell: "/ip pool",
            means: "The guest address range. Read the range list next.",
            thenStepIndex: 2,
          },
          { tell: "/radius", means: "The login server. Read its settings next.", thenStepIndex: 3 },
          { tell: "/ip hotspot", means: "The hotspot. Read it next.", thenStepIndex: 4 },
          {
            tell: "/interface bridge",
            means: "The guest bridge. Read the bridge list next.",
            thenStepIndex: 5,
          },
          {
            tell: "/ip firewall",
            means: "A firewall rule. Read the rules next.",
            thenStepIndex: 6,
          },
        ],
      },
      {
        command: "/ip address print detail without-paging",
        lookFor:
          "Whether the address that already exists is the one you were trying to add, and which interface it is on.",
        branches: [
          {
            tell: "10.5.50.1/24",
            means:
              "The right address is already there. Nothing to do — the block had already been run. Move on.",
            thenStepIndex: -1,
          },
          {
            tell: "dynamic=yes",
            means:
              "An automatically-assigned address is occupying the interface. That one can go; the one you are adding is the real one.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local d [/ip address find where interface="bridge" dynamic=yes]
:put ("removing-count=" . [:tostr [:len $d]])
:if ([:len $d] > 0) do={ /ip address remove $d }`,
                note: "Removes only automatically-assigned addresses on the guest bridge. Anything set by hand is untouched.",
                destructive: false,
                confidence: "generator",
              },
            ],
          },
        ],
        // A third reading — a different hand-set address on the same
        // interface — has no safe automatic answer and is handled by the
        // step's own outcome, which asks the team rather than guessing.
      },
      {
        command: "/ip pool print without-paging",
        lookFor:
          "Whether a range with the same name already exists, and whether it covers the same addresses.",
        branches: [
          {
            tell: "10.5.50.10-10.5.50.254",
            means: "The right range is already there. Nothing to do.",
            thenStepIndex: -1,
          },
          {
            tell: "hotspot-pool",
            means:
              "A range with the same name exists covering different addresses. Correct it rather than adding a second one.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local p [/ip pool find where name="hotspot-pool"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /ip pool set $p ranges=10.5.50.10-10.5.50.254 }
:put ("ranges=" . [:tostr [/ip pool get [find name="hotspot-pool"] ranges]])`,
                note: "Updates the existing range instead of creating a duplicate. Devices already holding an address keep it until their lease expires.",
                destructive: false,
                confidence: "generator",
              },
            ],
          },
        ],
      },
      {
        command: "/radius print detail without-paging",
        lookFor:
          "How many entries there are and whether they point at the hub. Two entries is a real fault, not a duplicate paste.",
        branches: [
          {
            tell: "10.20.0.1",
            means:
              "An entry pointing at the hub already exists. Do not add a second one. If the login server is refusing, that is a secret problem and not something a second entry fixes — go to the secret rotation entry.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "/ip hotspot print detail without-paging",
        lookFor: "Whether a hotspot is already running on the guest bridge.",
        branches: [
          {
            tell: "bridge",
            means:
              "A hotspot is already on the guest bridge. RouterOS allows only one per interface, which is what the error was telling you. Check its settings in step 16 rather than trying to create another.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "/interface bridge print without-paging",
        lookFor: "Whether the bridge already exists and under what name.",
        branches: [
          {
            tell: "bridge",
            means: "The correctly-named bridge is already there. Nothing to do.",
            thenStepIndex: -1,
          },
          {
            tell: "bridge1",
            means:
              "A bridge exists under the old name. Do not rename it and do not add a second one — moving ports between bridges drops every connected device. Decide with the team which name this router uses.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "/ip firewall filter print without-paging",
        lookFor: "Whether a rule carrying the same comment already exists.",
        branches: [
          {
            tell: "cloudguest-",
            means:
              "A rule this setup created already exists. Duplicating firewall rules is harmless but makes the order impossible to reason about later. Leave it as it is.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not remove the existing entry to make room for a new one before reading what it contains.",
      "Do not run a remove command without a where clause naming exactly what you mean.",
      "Do not treat this error as a failure of the step — most of the time nothing is wrong.",
    ],
    confidence: "generator",
  },

  // =====================================================================
  {
    id: "input-does-not-match-interface",
    errorText: "input does not match any value of interface",
    aliases: [
      "input does not match any value of in-interface",
      "input does not match any value of out-interface",
    ],
    meansHere:
      "A command named an interface that does not exist at that moment. In this setup there are four realistic causes and they need different responses: the guest bridge is called {{bridge1}} rather than {{bridge}}; the internet port was renamed by a previous engineer; a PPPoE interface is being referenced before it has been created; or the tunnel does not exist yet. The dangerous part is what does NOT produce this error — a firewall or translation rule accepts any interface name as plain text, so a rule against a non-existent interface is created happily and then silently matches nothing forever.",
    seenInSteps: [
      "step02-interfaces",
      "step03-wan-pppoe",
      "step09-wireguard-validation",
      "step11-bridge-lan",
      "step13-lan-address",
      "step15-dhcp-server",
      "step16-hotspot",
    ],
    sequence: [
      {
        command: "/interface print without-paging",
        lookFor:
          "Every interface that actually exists, with its real name. Compare against the name in the command that failed.",
        branches: [
          {
            tell: "bridge1",
            means:
              "The guest bridge is called {{bridge1}}, not {{bridge}}. This router was built by the older automatic wizard, whose default name does not match anything else in this setup. Every command in this flow that names the bridge has to be changed to {{bridge1}}, or the router has to be rebuilt on the correct name. Do not do both, and do not rename a bridge that already has guests on it.",
            thenStepIndex: -1,
          },
          {
            tell: "ether1",
            means:
              "The internet port does exist under that name, so the failing command named something else. Read the failing command again — the name it used is the one that is missing.",
            thenStepIndex: 1,
          },
          {
            tell: "pppoe-out",
            means:
              "A PPPoE session exists under RouterOS's own automatic name rather than the name this setup expects. Nothing in this flow will match it. It has to be recreated with the expected name, which drops the internet connection for a few seconds.",
            thenStepIndex: -1,
          },
          {
            tell: "wg-cloudguest",
            means:
              "The tunnel exists, so the failing command named something else. Check for a typo in the tunnel name in the command that failed.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "/interface ethernet print without-paging",
        lookFor:
          "The real names of the physical ports. On some models and after some previous engineers, these are not {{ether1}} and {{ether2}}.",
        branches: [
          {
            tell: "ether1",
            means:
              "The standard names are in use. The failed command named a bridge or a virtual interface, not a physical port — go back to the full interface list.",
            thenStepIndex: 0,
          },
          {
            tell: "WAN",
            means:
              "A previous engineer renamed the ports to describe their role. Every command in this flow has to use the real names. Write them down before continuing, and put them on the ticket — the next person will hit exactly this.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not create an interface just to make the error go away. An empty bridge that exists satisfies the command and still carries no guests.",
      "Do not rename an interface that already has guests or a live internet connection on it without agreeing it first.",
      "Do not assume a firewall or translation rule is correct because it did not produce this error. Those rules accept any name and match nothing.",
    ],
    confidence: "generator",
  },

  // =====================================================================
  {
    id: "input-does-not-match-ca",
    errorText: "input does not match any value of ca",
    meansHere:
      "A certificate was asked to be signed by an authority that RouterOS does not recognise as one. In this product this comes from one specific mistake: asking a certificate to sign itself by naming itself as its own authority. That can never work — the name after ca= has to be a different certificate that is already signed and already an authority. A brand new certificate is an unsigned template with no authority at all, so naming it as its own signer resolves against nothing. The correct form for a self-signed root is the bare sign command with no ca= at all. This went undetected for months because the block was wrapped in a guard that skipped it entirely on any router where the certificate already existed, so no error appeared and nothing ran.",
    seenInSteps: ["step16-hotspot"],
    sequence: [
      {
        command: "/certificate print detail without-paging",
        lookFor:
          "Whether each certificate has actually been signed. A signed certificate has a serial number and validity dates. An unsigned template has neither — that is the reliable tell, more reliable than the flag letters.",
        branches: [
          {
            tell: "serial-number",
            means:
              "At least one certificate is genuinely signed. Check whether it is the authority one. If the authority is signed and the leaf still fails, the signing had not finished when the leaf was attempted — wait and try the leaf again.",
            thenStepIndex: 1,
          },
          {
            tell: "cloudguest-ca",
            means:
              "The authority certificate exists. If it has no serial number and no validity dates it was never signed, which is the whole cause. Sign it on its own, with no ca= naming anything.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local c [/certificate find where name="cloudguest-ca"]
:put ("matching-count=" . [:tostr [:len $c]])
:if ([:len $c] > 0) do={ /certificate sign cloudguest-ca }
:delay 5s
:put ("after=" . [:tostr [/certificate get [find name="cloudguest-ca"] serial-number]])`,
                note: "Signs the authority certificate with no ca= at all, which is the correct form for one that signs itself. It waits, then prints the serial number back — signing can return before it has finished, so an immediate read shows nothing even on success.",
                destructive: false,
                confidence: "field",
              },
            ],
          },
          {
            tell: "no such item",
            means:
              "There is no certificate at all, so the failing command named one that does not exist. Nothing is broken — this whole area is optional.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: `/certificate print detail without-paging where name="cloudguest-ca"`,
        lookFor:
          "Whether the authority certificate carries validity dates. Without them it is a template, not an authority, and nothing can be signed by it.",
        branches: [
          {
            tell: "invalid-after",
            means:
              "The authority is properly signed. The leaf can now be signed by naming it — that part was always correct. If it still fails, wait a few seconds and try again; signing returns before it completes.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local l [/certificate find where name="cloudguest-hotspot-cert"]
:put ("matching-count=" . [:tostr [:len $l]])
:delay 3s
:if ([:len $l] > 0) do={ /certificate sign cloudguest-hotspot-cert ca=cloudguest-ca }`,
                note: "Signs the page certificate using the authority. Naming the authority here is correct — it is a different certificate. Only the authority signing itself must omit ca=.",
                destructive: false,
                confidence: "field",
              },
            ],
          },
        ],
      },
    ],
    doNot: [
      "Never name a certificate as its own authority. It cannot work and the error is the same every time.",
      "Do not remove every certificate on the router to clear this. Some of them may belong to the venue.",
      "Do not treat this as blocking. The guest login works without any of it — the path guests actually take never touches this certificate, so if it is fighting you, skip it and record it.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "expected-end-of-command",
    errorText: "expected end of command",
    aliases: ["syntax error", "expected command name"],
    meansHere:
      "RouterOS read the command, understood the start of it, and then found extra text it could not account for. Almost always the paste was damaged rather than the command being wrong: a long line wrapped and its tail arrived as a separate command, an opening brace was copied without its closing one, or two commands landed on one line with nothing between them. A value containing a space that is not inside quotes does the same thing.",
    seenInSteps: ["step01-router-info", "step03-wan-dhcp", "step06-identity", "step16-hotspot"],
    sequence: [
      {
        command: "(no command — paste the exact text you ran, not the output)",
        lookFor:
          "Whether the text you pasted is complete: every opening brace has a closing one, every opening quote has a closing one, and no line has been split in the middle.",
        branches: [
          {
            tell: "do={",
            means:
              "The block uses braces. Count them — if the number of opening and closing braces differs, the copy was cut short. Copy the block again from the first character to the last.",
            thenStepIndex: -1,
          },
          {
            tell: '"',
            means:
              "Count the quotes on the failing line. An odd number means a value containing a space was left unquoted, and RouterOS read the part after the space as a new command.",
            thenStepIndex: -1,
          },
          {
            tell: "REPLACE",
            means:
              "The placeholder text was never replaced. If the value you meant to put there contains a space, it has to be inside quotes.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "(re-copy the block from the app and paste it again without editing it)",
        lookFor:
          "Whether it runs cleanly this time. If it does, the first paste was damaged in transit and nothing is wrong with the router.",
        branches: [
          {
            tell: "expected end of command",
            means:
              "It fails identically on a clean paste, so the command itself is wrong rather than the copy. Do not try to repair it by hand — report the exact command and the exact error, because it will be wrong for every other router too.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not rewrite the command from memory to get past it. A command that runs but does something slightly different is far worse than one that refuses.",
      "Do not paste half a block and then the other half. Some blocks depend on values set earlier in the same block.",
      "Do not retype a long key or secret by hand. Copy it.",
    ],
    confidence: "standard-routeros",
  },

  // =====================================================================
  {
    id: "invalid-value",
    errorText: "invalid value",
    aliases: ["invalid value for argument", "invalid value of"],
    meansHere:
      "RouterOS understood which setting you meant and refused what you tried to put in it. Either the format is wrong, or the value is outside what that setting accepts. In this setup the usual ones are a login method that does not exist under that name, an address written without its prefix length, and an address range written with the wrong separator.",
    seenInSteps: ["step03-wan-static", "step13-lan-address", "step14-dhcp-pool", "step16-hotspot"],
    sequence: [
      {
        command: "(no command — read the failing command and identify which setting was refused)",
        lookFor: "The word immediately before the equals sign in the part RouterOS objected to.",
        branches: [
          {
            tell: "login-by",
            means:
              "The accepted login methods are a fixed list of names. The portal needs {{http-pap}} exactly; there is no method called pap on its own.",
            thenStepIndex: 1,
          },
          {
            tell: "address",
            means:
              "An address here needs its prefix length. Without one RouterOS may accept it and treat it as covering a single address, which is worse than refusing.",
            thenStepIndex: -1,
          },
          {
            tell: "ranges",
            means:
              "An address range is written as the first address, a hyphen, then the last address, with no spaces around the hyphen.",
            thenStepIndex: -1,
          },
          {
            tell: "shared-users",
            means: "This has to be a whole number of at least one.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "/ip hotspot profile print detail without-paging",
        lookFor:
          "The login-by value on any profile that already works, to see the exact spelling RouterOS uses.",
        branches: [
          {
            tell: "http-pap",
            means: "That is the exact spelling. Use it as written.",
            thenStepIndex: -1,
          },
          {
            tell: "http-chap",
            means:
              "The profile is on the factory default, which the portal cannot use. Change it to {{http-pap}}.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local p [/ip hotspot profile find where name="hsprof1"]
:put ("matching-count=" . [:tostr [:len $p]])
:if ([:len $p] > 0) do={ /ip hotspot profile set $p login-by=http-pap }
:put ("login-by=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] login-by]])`,
                note: "Sets the accepted login method and prints it back.",
                destructive: false,
                confidence: "field",
              },
            ],
          },
        ],
      },
    ],
    doNot: [
      "Do not try nearby spellings until one is accepted. Read an existing working value instead.",
      "Do not drop the prefix length from an address to make the error go away.",
    ],
    confidence: "standard-routeros",
  },

  // =====================================================================
  {
    id: "no-such-item",
    errorText: "no such item",
    aliases: ["no such item (4)", "no such command"],
    meansHere:
      "A command tried to read or change something by lookup and the lookup matched nothing. This error is genuinely good news, and it is worth understanding why: a READ against an empty lookup fails loudly like this, but a WRITE against an empty lookup SUCCEEDS AND REPORTS NOTHING. So this error is the honest half of the same condition that, on a set command, produces the silent failure this whole wizard exists to catch. When you see it, the lookup found nothing — believe it, and go and find out why nothing is there.",
    seenInSteps: [
      "step07-cloud-registration",
      "step09-wireguard-validation",
      "step10-radius",
      "step14-dhcp-pool",
      "step16-hotspot",
    ],
    sequence: [
      {
        command:
          "(no command — take the lookup out of the failing command and run it as a print instead)",
        lookFor:
          "How many rows come back. If the answer is none, that is the whole explanation: nothing matches what the command was looking for.",
        branches: [
          {
            tell: "0",
            means:
              "Nothing matches. The thing the command was trying to change was never created. Go back to the step that creates it — and note that if that step used a set command rather than an add, it will have reported success while doing nothing.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: "/interface print without-paging",
        lookFor:
          "Whether the interface the lookup was filtering on exists at all under that exact name. A lookup filtered on a non-existent interface always matches nothing.",
        branches: [
          {
            tell: "bridge1",
            means:
              "The bridge has a different name, so every lookup filtered on the expected name matches nothing. This is the root cause of a whole family of these errors on one router.",
            thenStepIndex: -1,
          },
          {
            tell: "ether1",
            means:
              "The interfaces are named as expected, so the missing thing is genuinely missing rather than mis-addressed. Re-run the step that creates it.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not create a placeholder just to stop the error. An object that exists with the wrong settings is harder to find than one that is missing.",
      "Do not conclude that a set command which did NOT produce this error therefore worked. That is precisely the case that fails silently.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "bad-command-name",
    errorText: "bad command name",
    aliases: ["expected command name", "no such command prefix"],
    meansHere:
      "RouterOS does not have the menu the command named. Either it was mistyped, or this RouterOS version or this hardware genuinely does not have that feature. In this setup the one that actually happens is the tunnel: it does not exist on RouterOS 6 at all, so a router that was never upgraded fails here and cannot be onboarded as it stands.",
    seenInSteps: ["step01-router-info", "step08-wireguard"],
    sequence: [
      {
        command: "/system resource print without-paging",
        lookFor: "The version line and the architecture line.",
        branches: [
          {
            tell: "6.",
            means:
              "This is RouterOS 6. The tunnel feature does not exist in it. This router needs a major upgrade before it can be onboarded, and that reboots it and can take it off the network — arrange it with the team rather than starting it on site.",
            thenStepIndex: -1,
          },
          {
            tell: "7.",
            means:
              "This is RouterOS 7, so the feature should exist. Check the installed packages next — a stripped build can be missing it.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: "/system package print without-paging",
        lookFor:
          "Whether the packages are all present and enabled, and whether any is marked as scheduled for disable after the next restart.",
        branches: [
          {
            tell: "scheduled for disable",
            means:
              "A package is on its way out at the next restart. Whoever did that meant something by it — find out before undoing it.",
            thenStepIndex: -1,
          },
          {
            tell: "system",
            means:
              "The main package is present. If the menu still does not exist, the command was mistyped — copy it from the app rather than typing it.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not start a major RouterOS upgrade on site without agreeing it. It reboots the router and can leave it unreachable.",
      "Do not enable or disable packages to make a menu appear. That changes what the router does after its next restart, not now.",
    ],
    confidence: "standard-routeros",
  },

  // =====================================================================
  {
    id: "timeouts",
    errorText: "timeout",
    aliases: ["timed out", "action timed out", "connection timed out", "request timed out"],
    meansHere:
      "Something waited for an answer and got none. Four completely different things in this setup report a timeout and they have nothing to do with each other: the terminal session dropping, a ping getting no reply, a download stalling, and the login server not answering. Deciding which one you have is the entire job — the responses are unrelated.",
    seenInSteps: [
      "step05-internet-validation",
      "step09-wireguard-validation",
      "step17-radius-hotspot",
    ],
    sequence: [
      {
        command: "(no command — decide which kind of timeout this is)",
        lookFor:
          "Where the timeout appeared: in the terminal itself, in a ping result, in a download, or in the login server counters.",
        branches: [
          {
            tell: "sent=4 received=0",
            means:
              "A ping got no reply. If it was the hub, the tunnel is down; if it was a public address, the internet is down. These need different steps.",
            thenStepIndex: 1,
          },
          {
            tell: "timeouts",
            means:
              "The login server counter. Requests are leaving and nothing is coming back, which nearly always means the tunnel rather than the login server.",
            thenStepIndex: 2,
          },
          {
            tell: "downloaded",
            means: "A download stalled. Go to the failed download entry.",
            thenStepIndex: -1,
          },
          {
            tell: "closed",
            means:
              "The terminal session itself dropped. Nothing is wrong with the router. Reconnect and run the command again — and if you are working over the network rather than the console, be aware that a change you make can be what cuts you off.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "/ping 8.8.8.8 count=4",
        lookFor: "Whether anything on the internet answers at all.",
        branches: [
          {
            tell: "received=0",
            means:
              "No internet. This is a step 3 problem — most often a default route that exists and is dead.",
            thenStepIndex: -1,
          },
          {
            tell: "received=4",
            means:
              "The internet is fine, so the timeout was specific to what you were pinging. If that was the hub, the tunnel is the problem.",
            thenStepIndex: 2,
          },
        ],
      },
      {
        command: "/ping 10.20.0.1 count=4",
        lookFor: "Whether the hub answers through the tunnel.",
        branches: [
          {
            tell: "received=0",
            means:
              "The hub does not answer. The most common single cause is the firewall rule order — the rule that lets tunnel traffic in has ended up below the rule that drops everything from the internet, so this router discards the hub's replies itself.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local allow [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]
:local drop [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]
:put ("allow-count=" . [:tostr [:len $allow]])
:put ("drop-count=" . [:tostr [:len $drop]])
:if ([:len $allow] > 0 && [:len $drop] > 0) do={ /ip firewall filter move $allow destination=$drop }`,
                note: "Moves the allow rule above the drop rule and changes nothing else. Both counts print first, so a missing rule is visible rather than becoming a silent no-op.",
                destructive: false,
                confidence: "field",
              },
            ],
          },
          {
            tell: "received=4",
            means:
              "The hub answers, so the tunnel is up. A login server timeout with a working tunnel points at the server side — report it rather than changing the router.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not treat all four kinds of timeout as one problem. A terminal drop and a login server timeout have nothing in common.",
      "Do not restart the router to clear a timeout. It hides the cause and the timeout comes back.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "no-route-to-host",
    errorText: "no route to host",
    aliases: ["network is unreachable", "host unreachable"],
    meansHere:
      "The router had nowhere to send the packet. In this product this is the signature of one specific, confirmed fault: a default route that exists, is listed, and carries the address {{0.0.0.0}} as its gateway, which routes nothing. It happens when the setup was applied as a file rather than pasted step by step — applying a file does not pause, so the gateway is read out of the ISP lease microseconds before the lease arrives. The obvious check for it does not work, because {{0.0.0.0}} is a value and not an empty one.",
    seenInSteps: ["step03-wan-dhcp", "step05-internet-validation"],
    sequence: [
      {
        command: `/ip route print detail without-paging where dst-address="0.0.0.0/0"`,
        lookFor:
          "The gateway on each default route, and the flag letters against it. Read the Flags legend the router prints at the top rather than assuming what the letters mean.",
        branches: [
          {
            tell: "gateway=0.0.0.0",
            means:
              "This is the known fault. The route was written before the ISP lease arrived. The lease itself is almost certainly healthy — read the real gateway out of it and write it into the route.",
            thenStepIndex: 1,
            fix: [
              {
                command: `:local gw [:tostr [/ip dhcp-client get [find where interface="ether1"] gateway]]
:put ("gateway-read=" . $gw)
:local r [/ip route find where comment="cloudguest-plain-wan1"]
:put ("matching-routes=" . [:tostr [:len $r]])
:if ($gw != "" && $gw != "0.0.0.0" && [:len $r] > 0) do={ /ip route set $r gateway=$gw }`,
                note: "Reads the gateway from the live lease and writes it into the route this setup owns. It prints what it read and how many routes it matched, so an empty match cannot look like success. It never touches a route this setup did not create.",
                destructive: false,
                confidence: "field",
              },
            ],
          },
          {
            tell: "Is",
            means:
              "The route is marked inactive. If the gateway is a real address rather than {{0.0.0.0}}, the gateway is not answering and the router has taken the route out of service by itself. That is a cable or ISP problem, not a routing one.",
            thenStepIndex: 2,
          },
          {
            tell: "As",
            means:
              "The route is active with a real gateway, so routing is fine and the message was misleading. The real problem is name lookup or a firewall rule.",
            thenStepIndex: -1,
          },
        ],
      },
      {
        command: "/ip dhcp-client print detail without-paging",
        lookFor:
          "Whether the lease shows as {{bound}} and whether a gateway with a real address appears. If the gateway is blank the lease has not arrived yet — wait thirty seconds rather than typing an address by hand.",
        branches: [
          {
            tell: "bound",
            means:
              "The lease is healthy. Copy the gateway from here into the route and the internet comes straight back.",
            thenStepIndex: -1,
          },
          {
            tell: "searching",
            means:
              "There is no lease yet, so there is no gateway to copy. This is a cable or upstream problem and no route change will help.",
            thenStepIndex: 2,
          },
        ],
      },
      {
        command: `/interface ethernet monitor [find name="ether1"] once`,
        lookFor: "The status line.",
        branches: [
          {
            tell: "no-link",
            means:
              "Nothing is plugged in, or the device at the other end is off. Check that the ISP cable is in {{ether1}} and the laptop is in {{ether2}} — they get swapped constantly.",
            thenStepIndex: -1,
          },
          {
            tell: "link-ok",
            means:
              "The cable is fine and the far end is alive, so the problem is the venue's own modem or the ISP line. Nothing on this router will fix it.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not type a gateway address from memory or from another site. Read it from the lease on this router.",
      "Do not remove and recreate the default route as a first response. Correcting the gateway on the existing one is enough and keeps the comment that identifies it.",
      "Do not conclude the WAN is broken because a ping failed. The route being dead produces an identical message on a perfectly healthy connection.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "dns-resolve-failed",
    errorText: "could not resolve",
    aliases: ["dns name does not exist", "resolve: failure"],
    meansHere:
      "A name could not be turned into an address. This matters far more than it looks, because several blocks in this setup look a name up while they run and write nothing at all when the lookup fails — without reporting anything. The one that catches people is the block that lets guests reach the portal before logging in: with name lookup broken it creates no entry, returns cleanly, and no guest can ever open the portal.",
    seenInSteps: ["step04-dns", "step05-internet-validation", "step08-wireguard", "step16-hotspot"],
    sequence: [
      {
        command: "/ping 8.8.8.8 count=4",
        lookFor:
          "Whether raw addresses are reachable, which separates a name problem from no internet at all.",
        branches: [
          {
            tell: "received=0",
            means: "There is no internet at all. Names are the least of it — go back to step 3.",
            thenStepIndex: -1,
          },
          {
            tell: "received=4",
            means:
              "The internet is up and only names are failing. This is a name server problem on this router.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: "/ip dns print without-paging",
        lookFor:
          "Whether any name server is configured, and whether the router answers lookups for guests.",
        branches: [
          {
            tell: "servers:",
            means:
              "Servers are configured. If lookups still fail, the venue's ISP may be blocking them, or the configured servers may be unreachable from this connection.",
            thenStepIndex: -1,
            fix: [
              {
                command: `/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes
:put ("servers=" . [:tostr [/ip dns get servers]])
:local t ""
:do { :set t [:tostr [:resolve "portal.wyfyguest.com"]] } on-error={ :set t "" }
:put ("resolves-to=" . $t)`,
                note: "Sets two well-known public name servers and immediately tries a lookup, printing the answer. If the answer line is empty the change did not help and the problem is upstream of this router.",
                destructive: false,
                confidence: "field",
              },
            ],
          },
        ],
      },
    ],
    doNot: [
      "Do not paste the blocks that depend on a lookup while this is broken. They will report success and write nothing.",
      "Do not put an address in place of a name in a block to work around it. The address changes and the router is then wrong forever with nobody knowing.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "fetch-failed",
    errorText: "status: failed",
    aliases: ["downloaded: 0KiB", "failure: closed", "fetch failed"],
    meansHere:
      "A download from the router did not complete. On this hardware the first thing to suspect is the clock: this model has no battery clock, so it boots with a wrong date after every power cut, and a router whose date is wrong cannot complete a secure connection at all. Nothing on screen says so. The same fault is why a router can serve guests perfectly and never once report itself to Master console.",
    seenInSteps: ["step05-internet-validation", "step07-cloud-registration"],
    sequence: [
      {
        command: "/system clock print without-paging",
        lookFor:
          "The date. Anything in 1970 or 2000, or more than a couple of days away from today, is the cause.",
        branches: [
          {
            tell: "1970",
            means:
              "The clock never got set. This is the cause. Fix it, then try the download again — nothing else needs changing.",
            thenStepIndex: -1,
            fix: [
              {
                command: `/system clock set time-zone-name=Asia/Kolkata
/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1
:delay 10s
:put ("date=" . [/system clock get date])
:put ("time=" . [/system clock get time])`,
                note: "Sets the timezone, turns the time service on, waits, and prints the result. It needs working internet — if the date does not move, fix step 5 first. On RouterOS 6 the servers setting has a different name and this will be rejected.",
                destructive: false,
                confidence: "field",
              },
            ],
          },
          {
            tell: "2026",
            means:
              "The clock looks right, so the failure is elsewhere. Check whether names resolve at all.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: "/ping 8.8.8.8 count=4",
        lookFor: "Whether there is any internet at all.",
        branches: [
          {
            tell: "received=0",
            means: "No internet. Go back to step 3 — nothing will download.",
            thenStepIndex: -1,
          },
          {
            tell: "received=4",
            means:
              "Internet works and the clock is right, so the download is being blocked or the far end is refusing. Record the exact address it was trying to reach and report it — this is not something to work around on the router.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not set the clock by hand and leave it there. It will be wrong again after the next power cut, and the fault comes back looking completely new.",
      "Do not turn off certificate checking to make a download work. That hides a wrong clock rather than fixing it.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "secret-rotation",
    errorText: "login failure for user",
    aliases: ["Auth-Type: Reject", "rejects increasing", "invalid user name or password"],
    meansHere:
      "The router and the server no longer share the same secret. In this product there is one overwhelmingly common way this happens: pressing Generate in Master console a second time. Every press replaces four secrets on the server side, while the blocks that install them on the router only ever add what is missing and never update what is already there. So after a second Generate, re-pasting every single block does NOT repair the router — it appears to run cleanly and changes nothing. The old values have to be removed first.",
    seenInSteps: ["step07-cloud-registration", "step10-radius", "step17-radius-hotspot"],
    sequence: [
      {
        command: `/log print without-paging where message~"login failure"`,
        lookFor:
          "Whether the failures are recent or historical. Failures from before the last paste mean nothing.",
        branches: [
          {
            tell: "cloudguest-api",
            means:
              "The account Master console uses is being refused, which is the clearest sign that Generate was pressed again. The router is holding secrets the server has already replaced.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: "/radius monitor 0 once",
        lookFor:
          "Whether refusals are rising while approvals are not. That confirms the server is being reached and is refusing.",
        branches: [
          {
            tell: "rejects",
            means:
              "The server is reachable and refusing. This is the secret, not the tunnel. Recovery means removing this platform's own secrets from the router, pressing Generate exactly once, and pasting the fresh blocks in the same sitting.",
            thenStepIndex: -1,
            fix: [
              {
                command: `:local r [/radius find]
:local w [/interface wireguard find where name="wg-cloudguest"]
:local u [/user find where name="cloudguest-api"]
:put ("radius-count=" . [:tostr [:len $r]])
:put ("tunnel-count=" . [:tostr [:len $w]])
:put ("api-user-count=" . [:tostr [:len $u]])`,
                note: "This only reports what would be removed. Read the three counts, confirm they are what you expect, and only then run the removal below. Nothing is changed by this command.",
                destructive: false,
                confidence: "field",
              },
              {
                command: `/radius remove [find]
/interface wireguard remove [find name="wg-cloudguest"]
/user remove [find name="cloudguest-api"]
:put ("radius-remaining=" . [:tostr [:len [/radius find]]])
:put ("tunnel-remaining=" . [:tostr [:len [/interface wireguard find where name="wg-cloudguest"]]])
:put ("api-user-remaining=" . [:tostr [:len [/user find where name="cloudguest-api"]]])`,
                note: "Removes only this platform's own tunnel, login server entry and account. The guest network, the hotspot and the internet connection are all untouched. Immediately afterwards, press Generate in Master console EXACTLY ONCE and paste the fresh tunnel, login server and account blocks. Do not press Generate again after that, whatever happens.",
                destructive: true,
                confirmPrompt:
                  "This removes the tunnel, the login server entry and the management account from this router. Guests already connected keep working, but no new guest can log in until the fresh blocks are pasted. You must have Master console open and ready before continuing. Continue?",
                confidence: "field",
              },
            ],
          },
        ],
      },
    ],
    doNot: [
      "Never press Generate a second time to fix a refusal. It is the cause, and pressing it again makes the router further out of date, not closer.",
      "Do not re-paste the blocks hoping they will update the secrets. They only add what is missing — on a router that already has them, they run cleanly and change nothing.",
      "Do not reset the router. Everything except these three items is fine and a reset means rebuilding all of it.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "radius-bad-replies",
    errorText: "bad-replies",
    meansHere:
      "The login server answered and this router threw the answer away as invalid. This is a fourth counter, separate from refusals and from timeouts, and it is completely invisible if you only watch refusals. It means the answer arrived without a field this router requires before it will trust it. It is a fault in how the server builds its answer, not anything about this router — and it was the final root cause in a multi-hour outage where every other check on the router passed.",
    seenInSteps: ["step17-radius-hotspot"],
    sequence: [
      {
        command: "/radius monitor 0 once",
        lookFor:
          "All four numbers. Take a reading, have a guest try to log in, then take a second reading and compare. Only the change means anything.",
        branches: [
          {
            tell: "bad-replies",
            means:
              "If this number rose while approvals did not, the server is answering and this router is rejecting the answer. Nothing on the router will fix it. Collect the evidence below and hand it over.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: `/log print without-paging where topics~"radius"`,
        lookFor:
          "The packet-level record of the exchange. This is the evidence the server side needs and it cannot be reconstructed later.",
        branches: [
          {
            tell: "radius",
            means:
              "Copy the whole of this output, along with this router's name and its tunnel address, and hand it to the team. Do not change any setting on this router in the meantime — a changed router makes the evidence unreadable.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not change the shared secret in response to this. The secret is correct — a wrong secret produces refusals, not this.",
      "Do not lower the router's own validation requirements to make logins succeed. That accepts answers that could come from anywhere.",
      "Do not restart the router before collecting the log. The counters reset and the evidence is gone.",
    ],
    confidence: "field",
  },

  // =====================================================================
  {
    id: "not-enough-permissions",
    errorText: "not enough permissions",
    aliases: ["not enough permissions (9)", "action failed - not enough permissions"],
    meansHere:
      "The account you are logged in with is not allowed to do this. Either you are on a restricted account, or the management account was created in the wrong group.",
    seenInSteps: ["step07-cloud-registration"],
    sequence: [
      {
        command: "/user print without-paging",
        lookFor: "Which accounts exist and which group each is in.",
        branches: [
          {
            tell: "full",
            means:
              "A fully-privileged account exists. If you are not logged in as it, log out and back in as that account rather than changing any permissions.",
            thenStepIndex: -1,
          },
          {
            tell: "read",
            means:
              "You are on a read-only account. Nothing can be configured from it. Log in with the correct account — do not raise this one's permissions to get around it.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not raise an account's permissions to get past this. Log in as the right account instead.",
      "Do not create a new fully-privileged account to work around it without agreeing it — that is a permanent way in that nobody will remember.",
    ],
    confidence: "standard-routeros",
  },

  // =====================================================================
  {
    id: "interface-already-used",
    errorText: "interface already used by another",
    aliases: ["interface is already used"],
    meansHere:
      "RouterOS allows only one of some things per interface — one hotspot, one DHCP server. Something is already attached where you are trying to attach another. In this setup it usually means a previous attempt is still there under a different name.",
    seenInSteps: ["step15-dhcp-server", "step16-hotspot"],
    sequence: [
      {
        command: "/ip hotspot print detail without-paging",
        lookFor: "Whether a hotspot is already attached to the guest bridge, and under what name.",
        branches: [
          {
            tell: "hotspot1",
            means:
              "This setup's own hotspot is already there. Nothing to add — go and check its settings in step 16 instead.",
            thenStepIndex: -1,
          },
          {
            tell: "hotspot",
            means:
              "A hotspot under a different name is attached. Do not remove it before checking whether guests are currently using it — removing it drops everyone instantly.",
            thenStepIndex: 1,
          },
        ],
      },
      {
        command: "/ip hotspot active print without-paging",
        lookFor: "Whether anyone is logged in right now.",
        branches: [
          {
            tell: "0",
            means:
              "Nobody is using it, so replacing it disrupts nothing. Remove the old one and re-run the step that creates the correct one.",
            thenStepIndex: -1,
          },
        ],
      },
    ],
    doNot: [
      "Do not remove a hotspot that has guests on it during opening hours.",
      "Do not attach a second one to a different interface to get around it. That splits the venue in two and both halves behave differently.",
    ],
    confidence: "standard-routeros",
  },
];

// ---------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------

/**
 * Commands the wizard must NEVER run automatically, never offer as a
 * one-click fix, and never include in a `FixAction` with
 * `destructive: false`.
 *
 * This list is enforcement, not documentation: a test should assert that
 * no `FixAction.command` anywhere in `MANUAL_STEPS` or `RESOLVER` contains
 * any of these patterns unless `destructive` is true AND a
 * `confirmPrompt` is present.
 */
export const NEVER_AUTO_RUN: { pattern: Lit; why: T }[] = [
  {
    pattern: "/system reset-configuration",
    why: "Wipes the entire router. It is never the answer to a specific error, and on a live venue it takes every guest offline and loses any configuration the venue added themselves. Only ever offered as a deliberate, separately confirmed choice — never as the fix for a message.",
  },
  {
    pattern: "/system reboot",
    why: "Hides the cause and takes the venue offline. A fault that a restart clears comes back.",
  },
  {
    pattern: "/file remove [find]",
    why: "An unfiltered file removal can delete the venue's own uploads and the router's own packages.",
  },
  {
    pattern: "/ip firewall filter remove [find]",
    why: "Removes every firewall rule including the venue's own. The router is left open.",
  },
  {
    pattern: "/interface bridge remove",
    why: "Drops every connected device instantly and takes the guest network down until it is rebuilt.",
  },
  {
    pattern: "/user remove [find]",
    why: "An unfiltered account removal can delete the only way back into the router.",
  },
  {
    pattern: "/system package disable",
    why: "Changes what the router can do after its next restart, in a way nobody will connect to this session.",
  },
  {
    pattern: "/system routerboard upgrade",
    why: "Firmware work is never part of diagnosing an error message.",
  },
  {
    pattern: "/certificate remove [find]",
    why: "Unfiltered, this removes certificates that may belong to the venue. Only ever with a where clause naming this platform's own.",
  },
];

/**
 * The rules every generated fix in this module already follows. They are
 * listed so a builder adding a nineteenth entry follows them too.
 */
export const SAFETY_RULES: T[] = [
  "Rung zero of a ladder is never a fix. It is always a read-only command whose output chooses the branch.",
  "Every fix that changes something prints a count of what it matched BEFORE it changes anything, so an empty match is visible instead of passing as success.",
  "Every fix that changes something prints the resulting value AFTER, so the operator can see it landed.",
  "A remove command always carries a where clause naming exactly what this platform created. Never a bare find.",
  "Nothing carrying a comment this platform did not write is ever modified or removed.",
  "A destructive fix requires an explicit typed confirmation that names what will stop working.",
  "A router reset is never offered as a response to an error message. It is a separate, deliberate decision.",
  "When two readings disagree, the wizard asks for one more command. It never picks the more optimistic reading.",
  "If no ladder branch matches the output, the answer is that the wizard does not know — never a guess at the most likely fix.",
];

/**
 * Fixes that look tempting and are wrong. Each one has actually been tried
 * on this product and made things worse. Surfaced in the UI when the
 * matching resolver entry is opened.
 */
export const TEMPTING_AND_WRONG: {
  instead: T;
  dontDo: Lit;
  why: T;
  confidence: "field" | "generator";
}[] = [
  {
    instead: "Read the gateway from the lease and write it into the existing route.",
    dontDo: '/ip route remove [find where dst-address="0.0.0.0/0"]',
    why: "Removing the default route to recreate it loses the comment that identifies it as this platform's, so every later check and every automatic repair stops finding it.",
    confidence: "field",
  },
  {
    instead:
      "Remove this platform's three secrets, press Generate once, and paste the fresh blocks.",
    dontDo: "(pressing Generate again in Master console)",
    why: "Every press replaces the secrets on the server while the router keeps the old ones, and the blocks that install them only add what is missing. Pressing it again is the cause, not the cure.",
    confidence: "field",
  },
  {
    instead: "Sign the authority certificate on its own, with no ca= naming anything.",
    dontDo: "/certificate sign cloudguest-ca ca=cloudguest-ca",
    why: "A certificate cannot be its own authority. This exact command failed silently for months because a guard skipped it on any router where the certificate already existed.",
    confidence: "field",
  },
  {
    instead: "Find out which path this model actually uses, then correct the block.",
    dontDo: "(re-pasting the portal page blocks after they appeared to succeed)",
    why: "On a model without the flash folder those blocks write to a path that does not exist. They match nothing, succeed, and change nothing — re-pasting produces exactly the same non-result.",
    confidence: "field",
  },
  {
    instead: "Turn the local account off, then test again.",
    dontDo: "(treating a successful phone login as proof the login server works)",
    why: "The router checks local accounts before the login server, so a test can pass without the server being involved at all. That is the bypass, not the proof.",
    confidence: "field",
  },
];

/** Convenience: every fix in this file, so a test can assert the safety
 * rules hold across all of them without walking the ladders by hand. */
export const ALL_RESOLVER_FIXES: FixAction[] = RESOLVER.flatMap((entry) =>
  entry.sequence.flatMap((rung) => rung.branches.flatMap((branch) => branch.fix ?? [])),
);
