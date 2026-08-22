/**
 * Guided Setup -- one assertion per check, keyed by `Check.id`.
 *
 * =====================================================================
 * WHY THE SPECS LIVE HERE AND NOT IN `phases.content.ts`
 * =====================================================================
 * `types.ts` now carries `Check.assert?: OutputAssertion`, so a content
 * author CAN inline a spec next to the check it scores, and that stays
 * the documented path. Nothing is inlined today for one reason:
 * `phases.content.ts` and `diagnostics.content.ts` are 1,352 lines of
 * field knowledge written out of real outages, and the safest possible
 * edit to them is none. `check.assert ?? ASSERTIONS[check.id]` resolves
 * either source, so moving a spec inline later is a pure move.
 *
 * Keyed by `Check.id` alone rather than `phase:check` because `PhaseView`
 * does not hand `CheckRow` a phase id and `PhaseView` is out of scope for
 * this change. All 24 check ids are globally unique today, and
 * `scripts/test-output-analyser.mjs` asserts that they stay that way --
 * a duplicated id would silently attach the wrong assertion to a check,
 * which is the worst failure this module can have.
 *
 * =====================================================================
 * WHAT IS DELIBERATELY NOT HERE
 * =====================================================================
 * Six checks have NO assertion, and the UI marks them "app ne verify
 * nahi kiya":
 *
 *   phone-mobiledata, phone-portal, phone-otp, phone-realsite,
 *   phone-reconnect
 *     Phase 7 is the phone test. "The portal opened on my phone" is not
 *     a fact any router prints. There is no text to parse, so there is
 *     no rule to write, and pretending otherwise would be exactly the
 *     self-reporting-dressed-as-verification this feature exists to end.
 *
 *   cert-optional
 *     Its own `expect` is "khaali ho to bhi chalta hai" -- an empty list
 *     passes and a populated list passes. Every possible output is
 *     acceptable, so any rule would be theatre. Its single `failFix`
 *     keys off a RouterOS error string the installer sees while running
 *     the command, not off the print output he would paste here.
 *
 * A confidently wrong rule is worse than an absent one.
 */
import type { OutputAssertion } from "./analyse";

/**
 * Literals this module compares device output against.
 *
 * `PORTAL_IP` is read out of `phases.content.ts`'s own `expect` for
 * `wg-ip` (`dst-address=40.80.86.193`). It is compared for a WARNING, never
 * for a FAIL -- the portal's public IP can legitimately change, and the
 * content's own fix for that case is "re-run the block, it updates the
 * entry". A FAIL there would send installers chasing a healthy router.
 *
 * That legitimate-change case is no longer hypothetical: this was
 * `20.219.51.94`, the app VM on the OLD Azure subscription, which was
 * deallocated during the 2026-08-21/22 migration. Verified 2026-08-22 by
 * resolving `portal.wyfyguest.com`.
 */
const PORTAL_IP = "40.80.86.193";
const PORTAL_HOST = "portal.wyfyguest.com";
/** The WireGuard tunnel subnet the RADIUS server must be reachable on. */
const TUNNEL_SUBNET = "10.20.0.0/24";

export const ASSERTIONS: Record<string, OutputAssertion> = {
  // -------------------------------------------------------------------
  // Phase 0 -- audit
  // -------------------------------------------------------------------
  "audit-clean": {
    identify: { kind: "banner", banner: "ROUTER AUDIT" },
    requires: [{ from: "result" }],
    rules: [
      // The block's own CLEAN verdict is accepted only when the evidence
      // it printed above the verdict agrees with it. A self-printed
      // verdict is a claim, not proof -- the whole reason this analyser
      // exists is that the router's own summary was trusted before.
      {
        when: {
          op: "all",
          of: [
            { op: "textIs", ref: { from: "result" }, value: "CLEAN" },
            {
              op: "not",
              of: {
                op: "any",
                of: [
                  { op: "textIncludes", ref: { from: "raw" }, value: "purana hotspot" },
                  { op: "textIncludes", ref: { from: "raw" }, value: "purana radius" },
                  { op: "textIncludes", ref: { from: "raw" }, value: "purana wireguard" },
                  { op: "textIncludes", ref: { from: "raw" }, value: "purana api user" },
                  { op: "textIncludes", ref: { from: "raw" }, value: "purana certificate" },
                  { op: "textIncludes", ref: { from: "raw" }, value: "purani files" },
                  { op: "textIncludes", ref: { from: "raw" }, value: "purane firewall" },
                ],
              },
            },
          ],
        },
        verdict: "PASS",
        why: "Router factory-fresh hai -- koi purana Wyfy config nahi mila.",
      },
      {
        when: { op: "textIncludes", ref: { from: "raw" }, value: "purani files" },
        verdict: "FAIL",
        why: "Purane provisioning ka folder abhi bhi router pe hai. Usme purane org/location IDs wale portal links hain.",
        fix: "purani FILES/FOLDER mili, jaise flash/cloudguest-hotspot/",
      },
      {
        when: { op: "textIs", ref: { from: "result" }, value: "CLEAN" },
        verdict: "FAIL",
        why: "Block ne CLEAN bola, par upar purana config wali line bhi print hui hai. Dono ek saath sach nahi ho sakte -- ise CLEAN mat maano.",
        fix: "RESULT: PURANA CONFIG MILA aaya",
      },
      {
        when: { op: "textIncludes", ref: { from: "result" }, value: "purana" },
        verdict: "FAIL",
        why: "Purana Wyfy config mila. Iske upar naya setup karoge to guests ko purana portal dikhta rahega.",
        fix: "RESULT: PURANA CONFIG MILA aaya",
      },
    ],
    fallback:
      "Block chala to sahi par uska RESULT line samajh nahi aaya. Poora output -- `==== ROUTER AUDIT ====` se `RESULT:` line tak -- dobara copy karo.",
  },

  // -------------------------------------------------------------------
  // Phase 1 -- clock
  // -------------------------------------------------------------------
  "clock-internet": {
    identify: { kind: "banner", banner: "INTERNET + CLOCK" },
    requires: [{ from: "result" }, { from: "label", label: "ping 8.8.8.8" }],
    rules: [
      {
        when: {
          op: "all",
          of: [
            { op: "isBool", ref: { from: "label", label: "ping 8.8.8.8" }, value: true },
            { op: "dateWithinDays", ref: { from: "label", label: "date" }, days: 3 },
          ],
        },
        verdict: "PASS",
        why: "Internet chal raha hai aur router ki date bhi sahi hai.",
      },
      {
        when: { op: "isBool", ref: { from: "label", label: "ping 8.8.8.8" }, value: true },
        verdict: "WARNING",
        why: "Internet to chal raha hai, par router ki date aaj ki nahi lag rahi. Aage badhne se pehle neeche wala date check zaroor karo -- galat date pe router Master console me hamesha offline dikhega.",
      },
      {
        when: { op: "isBool", ref: { from: "label", label: "ping 8.8.8.8" }, value: false },
        verdict: "FAIL",
        why: "ping 8.8.8.8 fail hui -- router ka internet nahi chal raha.",
        fix: "ping false aaya",
      },
      {
        when: { op: "textIs", ref: { from: "result" }, value: "FAIL" },
        verdict: "FAIL",
        why: "Block ne khud FAIL bola -- ether1 ka cable check karo.",
        fix: "ping false aaya",
      },
    ],
    fallback: "`ping 8.8.8.8 :` wali line output me nahi mili. Block ka poora output copy karo.",
  },

  "clock-date": {
    identify: {
      kind: "either",
      of: [
        { kind: "menu", menu: "/system clock" },
        { kind: "banner", banner: "INTERNET + CLOCK" },
      ],
    },
    rules: [
      {
        // Compared against the APP's clock, not against any string. The
        // browser knows real time; a battery-less hEX does not, and that
        // asymmetry is the only reliable way to catch a wrong date.
        when: { op: "dateWithinDays", ref: { from: "label", label: "date" }, days: 2 },
        verdict: "PASS",
        why: "Router ki date aaj ki hai.",
      },
      {
        when: { op: "present", ref: { from: "label", label: "date" } },
        verdict: "FAIL",
        why: "Router ki date aaj ki nahi hai. Isi pe scheduler ka start-time bharta hai -- galat date pe heartbeat kabhi nahi chalega aur router Master console me hamesha offline rahega.",
        fix: "date 1970 / jan/01/1970 dikha raha hai",
      },
      {
        when: { op: "absent", ref: { from: "label", label: "date" } },
        verdict: "INCOMPLETE",
        why: "`date:` wali line output me nahi hai. `/system clock print` ka poora output paste karo.",
      },
    ],
    fallback:
      "Date padhi to gayi par uska format samajh nahi aaya. `/system clock print` ka poora output dobara paste karo.",
  },

  // -------------------------------------------------------------------
  // Phase 2 -- WAN
  // -------------------------------------------------------------------
  "wan-lease": {
    identify: {
      kind: "either",
      of: [
        { kind: "menu", menu: "/ip dhcp-client" },
        { kind: "banner", banner: "WAN LEASE + ROUTE REPAIR" },
      ],
    },
    rules: [
      {
        when: { op: "textIs", ref: { from: "label", label: "dhcp status" }, value: "bound" },
        verdict: "PASS",
        why: "ISP se address mil gaya (status bound).",
      },
      {
        when: { op: "textIs", ref: { from: "label", label: "dhcp status" }, value: "no-client" },
        verdict: "WARNING",
        why: "Is router pe DHCP client hai hi nahi -- matlab static WAN hai. Gateway khud check karna padega; aage wala route check ab aur zaroori hai.",
      },
      {
        when: { op: "present", ref: { from: "label", label: "dhcp status" } },
        verdict: "FAIL",
        why: "DHCP client ko abhi tak lease nahi mila.",
        fix: "status searching... pe atka hai",
      },
      {
        when: {
          op: "someRecord",
          then: { op: "textIs", ref: { from: "field", key: "status" }, value: "bound" },
        },
        verdict: "PASS",
        why: "ISP se address mil gaya (status bound).",
      },
      {
        when: {
          op: "someRecord",
          then: {
            op: "textIn",
            ref: { from: "field", key: "status" },
            values: ["searching", "stopped", "error", "requesting", "renewing", "rebinding"],
          },
        },
        verdict: "FAIL",
        why: "DHCP client ko abhi tak lease nahi mila -- status bound nahi hai.",
        fix: "status searching... pe atka hai",
      },
      {
        when: { op: "all", of: [{ op: "recordCount", max: 0 }, { op: "outputFramePresent" }] },
        verdict: "FAIL",
        why: "Koi DHCP client hai hi nahi. Ya to WAN static hai, ya LAN/WAN wala chunk paste nahi hua.",
      },
    ],
    fallback:
      "DHCP client ki row to dikhi par uska STATUS padha nahi ja saka. `/ip dhcp-client print detail` chala ke uska output paste karo -- usme `status=` saaf likha aata hai.",
  },

  /**
   * THE ONE THAT ATE A PROVISIONING SESSION (2026-08-21).
   *
   * `/import` never pauses, so the script reads the DHCP lease's gateway
   * microseconds after creating the client -- before the lease exists.
   * The route is then created with `gateway=0.0.0.0`, flagged `Is`
   * (Inactive), and every ping returns `no route to host`. The row prints
   * completely normally.
   *
   * Two independent structural signals are required before this can pass,
   * and either one alone is enough to fail it:
   *   - the ACTIVE flag, resolved against the legend the device printed
   *     (`As` on v7, `A S` on v6 -- never string-compared);
   *   - a gateway that is a usable IPv4, where `0.0.0.0` is explicitly
   *     not usable. `"0.0.0.0" != ""` is why the obvious guard lets this
   *     through, and that guard is live in the backend today at
   *     `mikrotik_adapter.py::_get_dynamic_default_gateway_sync`.
   */
  "wan-route-active": {
    identify: { kind: "menu", menu: "/ip route" },
    rules: [
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "dst-address" },
            value: "0.0.0.0/0",
          },
          then: { op: "isBool", ref: { from: "field", key: "has-unspecified-ipv4" }, value: true },
        },
        verdict: "FAIL",
        why: "Default route to hai, par uska gateway 0.0.0.0 hai. Ye wahi bug hai: route tab bana jab DHCP lease aaya hi nahi tha. Route dikhta hai, kaam kuch nahi karta.",
        fix: "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
      },
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "dst-address" },
            value: "0.0.0.0/0",
          },
          then: { op: "hasFlag", meaning: "inactive" },
        },
        verdict: "FAIL",
        why: "Default route Inactive (`I`) hai. Hotspot, tunnel aur RADIUS teeno isi route pe chalte hain -- teeno chup-chaap fail honge.",
        fix: "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
      },
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "dst-address" },
            value: "0.0.0.0/0",
          },
          then: { op: "hasFlag", meaning: "disabled" },
        },
        verdict: "FAIL",
        why: "Default route disabled (`X`) hai.",
        fix: "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
      },
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "dst-address" },
            value: "0.0.0.0/0",
          },
          then: {
            op: "all",
            of: [
              { op: "hasFlag", meaning: "active" },
              { op: "isIpv4", ref: { from: "field", key: "gateway" }, allowUnspecified: false },
            ],
          },
        },
        verdict: "PASS",
        why: "Default route Active hai aur uska gateway ek asli IP hai.",
      },
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "dst-address" },
            value: "0.0.0.0/0",
          },
          then: { op: "absent", ref: { from: "field", key: "gateway" } },
        },
        verdict: "FAIL",
        why: "Default route ki row me koi gateway address hai hi nahi.",
        fix: "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
      },
      {
        // RouterOS 6 has no INACTIVE flag: an inactive route just does not
        // carry `A`. So once the flags HAVE resolved, their not containing
        // "active" is itself the failure. `hasFlag` returns null when the
        // flags could not be resolved at all, and `not null` stays null,
        // so this rule cannot fire on an unreadable paste -- that case
        // still lands on the UNKNOWN fallback below.
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "dst-address" },
            value: "0.0.0.0/0",
          },
          then: { op: "not", of: { op: "hasFlag", meaning: "active" } },
        },
        verdict: "FAIL",
        why: "Default route pe ACTIVE flag nahi hai. RouterOS 6 me inactive route pe koi `I` nahi aata -- bas `A` gayab ho jata hai, aur route dikhta bilkul normal hai.",
        fix: "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
      },
      {
        when: { op: "all", of: [{ op: "recordCount", max: 0 }, { op: "outputFramePresent" }] },
        verdict: "FAIL",
        why: "Koi default route hai hi nahi -- 0.0.0.0/0 wali ek bhi row nahi mili.",
        fix: "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
      },
    ],
    // Reached when the flags could not be resolved: no `Flags:` legend in
    // the paste and no fallback letters for this menu. Guessing "probably
    // active" here is precisely the optimistic reading this module refuses
    // to make.
    fallback:
      'Route ki row to mili, par uske flags padhe nahi ja sake -- output me `Flags:` wali line nahi thi. `/ip route print where dst-address="0.0.0.0/0"` dobara chalao aur Flags wali line se lekar poora output copy karo.',
  },

  // -------------------------------------------------------------------
  // Phase 3 -- internet gate
  // -------------------------------------------------------------------
  "gate-pass": {
    identify: { kind: "banner", banner: "INTERNET GATE" },
    requires: [{ from: "result" }, { from: "label", label: "ping 8.8.8.8" }],
    rules: [
      {
        when: {
          op: "all",
          of: [
            { op: "isBool", ref: { from: "label", label: "ping 8.8.8.8" }, value: true },
            { op: "isBool", ref: { from: "label", label: "resolve portal" }, value: true },
          ],
        },
        verdict: "PASS",
        why: "Internet aur DNS dono chal rahe hain.",
      },
      {
        // The branch the content was already written for: its `when` is
        // literally "ping true par resolve false".
        when: {
          op: "all",
          of: [
            { op: "isBool", ref: { from: "label", label: "ping 8.8.8.8" }, value: true },
            { op: "isBool", ref: { from: "label", label: "resolve portal" }, value: false },
          ],
        },
        verdict: "FAIL",
        why: "Internet chal raha hai par DNS resolve nahi ho raha. Router theek hi hai -- DNS servers abhi set nahi hue.",
        fix: "ping true par resolve false",
      },
      {
        when: { op: "isBool", ref: { from: "label", label: "ping 8.8.8.8" }, value: false },
        verdict: "FAIL",
        why: "ping bhi fail ho rahi hai -- asli problem Phase 2 ke route me hai, DNS me nahi.",
        fix: "ping bhi false",
      },
    ],
    fallback:
      "Gate block ka output adhoora hai -- `ping` aur `resolve` dono lines chahiye. Poora block dobara chalao.",
  },

  // -------------------------------------------------------------------
  // Phase 4 -- hotspot hardening
  // -------------------------------------------------------------------
  "hs-idle": {
    identify: { kind: "banner", banner: "HOTSPOT AUDIT" },
    rules: [
      {
        when: { op: "textIncludes", ref: { from: "raw" }, value: "koi hotspot server nahi mila" },
        verdict: "FAIL",
        why: "Router pe koi hotspot server hai hi nahi -- Master console ka Hotspot chunk paste nahi hua.",
      },
      {
        // 00:05:00 and 5m are the same value. Compared in seconds, never
        // as text.
        when: {
          op: "durationBetween",
          ref: { from: "kv", key: "idle-timeout" },
          minSeconds: 60,
          maxSeconds: 1800,
        },
        verdict: "PASS",
        why: "idle-timeout set hai -- sessions apne aap band ho jayengi.",
      },
      {
        when: {
          op: "durationBetween",
          ref: { from: "kv", key: "idle-timeout" },
          minSeconds: 1801,
          maxSeconds: 86400,
        },
        verdict: "WARNING",
        why: "idle-timeout set to hai par bahut lamba hai. Sessions late band hongi aur active list bharti rahegi.",
      },
      {
        when: { op: "absent", ref: { from: "kv", key: "idle-timeout" } },
        verdict: "INCOMPLETE",
        why: "Audit ke output me `idle-timeout=` wali line nahi mili. Poora audit block dobara chalao.",
      },
      {
        // `none` parses to Infinity, so it lands here and not in any
        // finite range above.
        when: { op: "present", ref: { from: "kv", key: "idle-timeout" } },
        verdict: "FAIL",
        why: "idle-timeout none hai. keepalive bhi band hai, to session kabhi close hogi hi nahi -- data cap kabhi nahi lagega.",
        fix: "idle-timeout=none dikha raha hai",
      },
    ],
    fallback: "idle-timeout ki value padhi nahi ja saki. Audit block dobara chalao.",
  },

  "hs-loginby": {
    identify: { kind: "banner", banner: "HOTSPOT AUDIT" },
    rules: [
      {
        // Membership, not equality: `https,http-pap` and `http-pap,https`
        // are the same fact and RouterOS does not promise an order.
        when: { op: "memberOf", ref: { from: "label", label: "login-by" }, value: "http-pap" },
        verdict: "PASS",
        why: "login-by me http-pap hai -- portal ka form router accept karega.",
      },
      {
        when: { op: "present", ref: { from: "label", label: "login-by" } },
        verdict: "FAIL",
        why: "login-by me http-pap nahi hai. Guest sahi OTP daalega, kuch nahi hoga, aur router ke log me bhi kuch nahi aayega.",
        fix: "login-by: cookie,http-chap dikha raha hai",
      },
      {
        when: { op: "absent", ref: { from: "label", label: "login-by" } },
        verdict: "INCOMPLETE",
        why: "`login-by` wali line output me nahi mili -- audit block `hsprof1` naam ka profile dhoondta hai. Poora audit output paste karo.",
      },
    ],
    fallback: "login-by ki value padhi nahi ja saki.",
  },

  "hs-shared": {
    identify: { kind: "banner", banner: "HOTSPOT AUDIT" },
    rules: [
      {
        when: { op: "intBetween", ref: { from: "label", label: "shared-users" }, min: 5, max: 5 },
        verdict: "PASS",
        why: "shared-users 5 hai -- guest phone aur laptop dono chala sakta hai.",
      },
      {
        when: { op: "intBetween", ref: { from: "label", label: "shared-users" }, min: 2, max: 4 },
        verdict: "WARNING",
        why: "Do se zyada device to chalenge, par fleet ka standard 5 hai. Guest ka teesra device reject ho sakta hai.",
      },
      {
        when: { op: "intBetween", ref: { from: "label", label: "shared-users" }, min: 6 },
        verdict: "WARNING",
        why: "shared-users 5 se zyada hai -- ek hi OTP pe zaroorat se zyada devices chal jayenge.",
      },
      {
        when: { op: "intBetween", ref: { from: "label", label: "shared-users" }, max: 1 },
        verdict: "FAIL",
        why: "shared-users 1 hai. Guest ka doosra device 'no more sessions are allowed for user' se poora fail hoga -- ye soft error nahi hai.",
        fix: "shared-users : 1",
      },
      {
        when: { op: "absent", ref: { from: "label", label: "shared-users" } },
        verdict: "INCOMPLETE",
        why: "`shared-users` wali line output me nahi mili. Poora audit block dobara chalao.",
      },
    ],
    fallback: "shared-users ki value padhi nahi ja saki.",
  },

  "hs-guest": {
    identify: {
      kind: "either",
      of: [
        { kind: "banner", banner: "HOTSPOT AUDIT" },
        { kind: "menu", menu: "/ip hotspot user" },
      ],
    },
    rules: [
      {
        when: {
          op: "textIncludes",
          ref: { from: "label", label: "guest user" },
          value: "nahi hai",
        },
        verdict: "PASS",
        why: "Local guest user hai hi nahi -- portal bypass ka raasta band hai.",
      },
      {
        when: {
          op: "textIncludes",
          ref: { from: "label", label: "guest user" },
          value: "disabled=true",
        },
        verdict: "PASS",
        why: "Local guest user disabled hai -- portal bypass band hai.",
      },
      {
        when: {
          op: "textIncludes",
          ref: { from: "label", label: "guest user" },
          value: "disabled=false",
        },
        verdict: "FAIL",
        why: "Local guest user chalu hai. Router pehle apna local user check karta hai, RADIUS baad me -- matlab jise password pata hai wo portal poora bypass kar sakta hai: bina OTP, bina record, bina data cap.",
        fix: "guest user enabled dikha raha hai",
      },
      {
        when: {
          op: "someRecord",
          where: { op: "textIncludes", ref: { from: "raw" }, value: "guest" },
          then: { op: "hasFlag", meaning: "disabled" },
        },
        verdict: "PASS",
        why: "guest user pe X (disabled) flag hai -- portal bypass band hai.",
      },
      {
        when: {
          op: "someRecord",
          where: { op: "textIncludes", ref: { from: "raw" }, value: "guest" },
          then: { op: "not", of: { op: "hasFlag", meaning: "disabled" } },
        },
        verdict: "FAIL",
        why: "guest user ki row pe X flag nahi hai -- matlab wo abhi bhi chalu hai aur portal ko poora bypass kar sakta hai.",
        fix: "guest user enabled dikha raha hai",
      },
      {
        when: {
          op: "all",
          of: [
            {
              op: "recordCount",
              where: { op: "textIncludes", ref: { from: "raw" }, value: "guest" },
              max: 0,
            },
            { op: "outputFramePresent" },
          ],
        },
        verdict: "PASS",
        why: "Hotspot user list me koi guest user hai hi nahi.",
      },
    ],
    fallback:
      "guest user ka status pakka nahi hua -- output me `Flags:` wali line nahi thi, isliye X (disabled) flag padha nahi ja saka. Upar wala audit block chalao, wo saaf-saaf `disabled=true/false` print karta hai.",
  },

  // -------------------------------------------------------------------
  // Phase 5 -- portal
  // -------------------------------------------------------------------
  "wg-ip": {
    // `/ip hotspot walled-garden ip print` and `/ip hotspot walled-garden
    // print` are one word apart and look nearly identical. The
    // discriminator is `dst-address` vs `dst-host`: each menu's
    // fingerprint lists the other's key as a `neverKey`, so pasting the
    // wrong one is named rather than scored.
    identify: { kind: "menu", menu: "/ip hotspot walled-garden ip" },
    rules: [
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "comment" },
            value: "cloudguest-portal-https",
          },
          then: { op: "textIncludes", ref: { from: "raw" }, value: PORTAL_IP },
        },
        verdict: "PASS",
        why: `HTTPS wali list me portal ka IP (${PORTAL_IP}) set hai.`,
      },
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "comment" },
            value: "cloudguest-portal-https",
          },
          then: {
            op: "isIpv4",
            ref: { from: "field", key: "dst-address" },
            allowUnspecified: false,
          },
        },
        verdict: "WARNING",
        why: `Entry to hai par uska IP ${PORTAL_IP} nahi hai. Portal ka IP badla ho sakta hai -- walled garden block dobara chalao, wo purani entry update kar dega.`,
        fix: "dst-address kuch aur IP dikha raha hai",
      },
      {
        when: {
          op: "someRecord",
          where: {
            op: "textIncludes",
            ref: { from: "field", key: "comment" },
            value: "cloudguest-portal-https",
          },
        },
        verdict: "INCOMPLETE",
        why: "Entry mil gayi par uska dst-address padha nahi ja saka. `/ip hotspot walled-garden ip print detail` chalao.",
      },
      {
        when: { op: "all", of: [{ op: "recordCount", max: 0 }, { op: "outputFramePresent" }] },
        verdict: "FAIL",
        why: "HTTPS wali walled-garden list bilkul khaali hai. Koi guest portal khol hi nahi payega, aur router pe kahin koi error nahi dikhega.",
        fix: "list khaali hai",
      },
      {
        when: { op: "recordCount", min: 1 },
        verdict: "FAIL",
        why: "List me entries to hain par `cloudguest-portal-https` wali nahi hai. DNS theek na ho to walled garden block chup-chaap kuch set nahi karta.",
        fix: "list khaali hai",
      },
    ],
    fallback: "walled-garden ip list padhi nahi ja saki.",
  },

  "wg-host": {
    identify: { kind: "menu", menu: "/ip hotspot walled-garden" },
    rules: [
      {
        when: {
          op: "someRecord",
          where: { op: "textIncludes", ref: { from: "raw" }, value: PORTAL_HOST },
          then: {
            op: "any",
            of: [
              { op: "textIs", ref: { from: "field", key: "action" }, value: "allow" },
              { op: "textIncludes", ref: { from: "raw" }, value: "allow" },
            ],
          },
        },
        verdict: "PASS",
        why: `HTTP wali list me ${PORTAL_HOST} allow hai.`,
      },
      {
        when: {
          op: "someRecord",
          where: { op: "textIncludes", ref: { from: "raw" }, value: PORTAL_HOST },
        },
        verdict: "FAIL",
        why: `${PORTAL_HOST} ki entry to hai par uska action allow nahi hai.`,
      },
      {
        when: { op: "all", of: [{ op: "recordCount", max: 0 }, { op: "outputFramePresent" }] },
        verdict: "FAIL",
        why: "HTTP wali walled-garden list khaali hai. Dono list alag cheez hain -- ye wali http ke liye chahiye.",
        fix: "khaali hai",
      },
      {
        when: { op: "recordCount", min: 1 },
        verdict: "FAIL",
        why: `List me entries to hain par ${PORTAL_HOST} wali nahi hai.`,
        fix: "khaali hai",
      },
    ],
    fallback: "walled-garden list padhi nahi ja saki.",
  },

  "portal-files": {
    identify: {
      kind: "either",
      of: [
        { kind: "menu", menu: "/file" },
        { kind: "banner", banner: "PORTAL FILES" },
      ],
    },
    rules: [
      {
        when: {
          op: "someRecord",
          where: { op: "textIncludes", ref: { from: "field", key: "name" }, value: "login.html" },
          then: {
            op: "textIncludes",
            ref: { from: "field", key: "contents" },
            value: "$(link-login-only)",
          },
        },
        verdict: "PASS",
        why: "login.html router pe hai aur usme `$(link-login-only)` maujood hai -- Wyfy ka asli redirect page chadha hua hai.",
      },
      {
        when: {
          op: "someRecord",
          where: { op: "textIncludes", ref: { from: "field", key: "name" }, value: "login.html" },
          then: { op: "present", ref: { from: "field", key: "contents" } },
        },
        verdict: "FAIL",
        why: "File to hai par usme `$(link-login-only)` nahi hai -- ye MikroTik ka stock page hai, Wyfy ka nahi. Guest ko neela login page dikhega.",
        fix: "file to hai par size chhota hai / $(link-login-only) nahi dikh raha",
      },
      {
        when: { op: "textIs", ref: { from: "result" }, value: "FAIL" },
        verdict: "FAIL",
        why: "Router pe login.html mila hi nahi -- 'Portal Redirect Page' wale chunks abhi paste nahi hue.",
        fix: "login.html mila hi nahi",
      },
      {
        when: {
          op: "all",
          of: [
            { op: "textIs", ref: { from: "result" }, value: "OK" },
            { op: "not", of: { op: "textIncludes", ref: { from: "raw" }, value: "flash/" } },
          ],
        },
        verdict: "WARNING",
        why: "login.html mila, par uska path `flash/` se shuru nahi hota. Script `flash/hotspot/login.html` maanti hai aur RouterOS ka `set [find ...]` galat path pe bina error ke chup-chaap kuch nahi karta. Upar dikha hua asli path Master console team ko bhejo.",
        fix: "file to hai par size chhota hai / $(link-login-only) nahi dikh raha",
      },
      {
        // The block found the file at the path the generator expects. It
        // prints paths and sizes, never contents, so this is as far as
        // that block can take us: the file exists, and whether it is OURS
        // is a different fact. Deliberately UNKNOWN rather than PASS --
        // "guest sees the blue MikroTik page" is a wrong-CONTENT failure,
        // and a file-exists check cannot see it.
        when: { op: "textIs", ref: { from: "result" }, value: "OK" },
        verdict: "UNKNOWN",
        why: 'login.html sahi path pe mil gayi. Par ye block sirf path aur size dikhata hai, file ke andar ka content nahi -- aur guest ko neela MikroTik page tab bhi dikh sakta hai jab file maujood ho. Confirm karne ke liye `/file print detail where name~"login.html"` chalao.',
      },
      {
        when: { op: "all", of: [{ op: "recordCount", max: 0 }, { op: "outputFramePresent" }] },
        verdict: "FAIL",
        why: "login.html naam ki koi file router pe nahi hai.",
        fix: "login.html mila hi nahi",
      },
    ],
    // `/file print detail` does not always print `contents=`. File exists
    // is not the same fact as file is ours, and this refuses to conflate
    // them.
    fallback:
      'login.html mil to gayi, par uske andar ka content is output me nahi aaya -- sirf file hone se ye saabit nahi hota ki Wyfy ka page chadha hai. `/file print detail where name~"login.html"` chalao aur `contents=` wala hissa bhi copy karo.',
  },

  // -------------------------------------------------------------------
  // Phase 6 -- tunnel and RADIUS
  // -------------------------------------------------------------------
  "tunnel-up": {
    identify: { kind: "banner", banner: "TUNNEL + RADIUS" },
    requires: [{ from: "result" }],
    rules: [
      {
        // The block prints `radius server  : ` with nothing after it when
        // there is no entry, so the label never materialises. Absence
        // here is real evidence, and it is checked before anything else
        // because a PASS is impossible without a server to ping.
        when: { op: "absent", ref: { from: "label", label: "radius server" } },
        verdict: "FAIL",
        why: "Router pe koi RADIUS entry hi nahi hai. WireGuard pehle chahiye, phir RADIUS -- dono chunks order me paste karo.",
        fix: "RESULT: FAIL -- koi RADIUS entry nahi hai",
      },
      {
        when: {
          op: "all",
          of: [
            { op: "textIs", ref: { from: "result" }, value: "PASS" },
            {
              op: "isIpv4",
              ref: { from: "label", label: "radius server" },
              allowUnspecified: false,
            },
          ],
        },
        verdict: "PASS",
        why: "Tunnel ke through hub tak ping ja rahi hai.",
      },
      {
        when: { op: "textIs", ref: { from: "result" }, value: "FAIL" },
        verdict: "FAIL",
        why: "Hub tak ping nahi ja rahi -- tunnel down hai. Sabse common wajah: firewall ka allow rule drop rule ke neeche chala gaya.",
        fix: "last-handshake bahut purana hai ya blank hai",
      },
      {
        when: { op: "textIs", ref: { from: "result" }, value: "PASS" },
        verdict: "FAIL",
        why: "Block ne PASS bola par RADIUS server ka address ek asli IP nahi hai. Ise PASS mat maano.",
        fix: "RESULT: FAIL -- koi RADIUS entry nahi hai",
      },
    ],
    fallback:
      "Tunnel block ka RESULT line samajh nahi aaya. Poora block dobara chalao aur `==== TUNNEL + RADIUS ====` se aage sab copy karo.",
  },

  /**
   * FOUR counters, not three.
   *
   * `bad-replies` means a reply arrived and failed validation -- it is
   * neither a reject nor a timeout, and watching only rejects misses it
   * entirely. That is what cost the 2026-08-18 outage: FreeRADIUS's
   * rlm_rest-built Access-Accept carried no Message-Authenticator, and
   * RouterOS silently discarded every reply.
   *
   * `requires` names bad-replies specifically, so a paste that omits it
   * is INCOMPLETE and can never reach PASS. And all-zero counters are
   * UNKNOWN, never PASS: zero means the router has not seen a single
   * RADIUS request yet, which is the absence of evidence, not evidence.
   */
  "radius-counters": {
    identify: { kind: "menu", menu: "/radius monitor" },
    requires: [{ from: "label", label: "bad-replies" }],
    rules: [
      {
        when: { op: "intBetween", ref: { from: "label", label: "bad-replies" }, min: 1 },
        verdict: "FAIL",
        why: "bad-replies badh rahe hain. Jawab aa raha hai par router use validate hone se pehle phenk raha hai -- ye server side ki problem hai, router ki nahi.",
        fix: "bad-replies badh rahe hain",
      },
      {
        when: { op: "intBetween", ref: { from: "label", label: "timeouts" }, min: 1 },
        verdict: "FAIL",
        why: "timeouts badh rahe hain -- packet hub tak pahunch hi nahi raha.",
        fix: "timeouts badh rahe hain",
      },
      {
        when: { op: "intBetween", ref: { from: "label", label: "rejects" }, min: 1 },
        verdict: "FAIL",
        why: "rejects badh rahe hain -- hub tak pahunch to raha hai par secret match nahi ho raha.",
        fix: "rejects badh rahe hain",
      },
      {
        when: {
          op: "all",
          of: [
            { op: "intBetween", ref: { from: "label", label: "accepts" }, min: 1 },
            { op: "intBetween", ref: { from: "label", label: "bad-replies" }, max: 0 },
            { op: "intBetween", ref: { from: "label", label: "timeouts" }, max: 0 },
            { op: "intBetween", ref: { from: "label", label: "rejects" }, max: 0 },
          ],
        },
        verdict: "PASS",
        why: "accepts badh rahe hain aur rejects/timeouts/bad-replies teeno 0 hain -- RADIUS bilkul theek chal raha hai.",
      },
      {
        when: { op: "intBetween", ref: { from: "label", label: "accepts" }, max: 0 },
        verdict: "UNKNOWN",
        why: "Saare counters 0 hain -- matlab router ne abhi tak ek bhi RADIUS request dekhi hi nahi. Ye PASS nahi hai. Pehle phone se ek asli login karo, phir ye command dobara chalao.",
      },
    ],
    fallback:
      "Counters padhe nahi ja sake. `/radius monitor 0 once` chalao -- agar `no such item` aaye to `/radius` pe koi entry hi nahi hai.",
  },

  // -------------------------------------------------------------------
  // Phase 8 -- recovery
  // -------------------------------------------------------------------
  "rec-secrets-gone": {
    identify: { kind: "menu", menu: "/user" },
    rules: [
      {
        when: {
          op: "someRecord",
          where: { op: "textIncludes", ref: { from: "raw" }, value: "cloudguest-api" },
        },
        verdict: "FAIL",
        why: "cloudguest-api user abhi bhi router pe hai -- purane secrets hate nahi.",
        fix: "row abhi bhi hai",
      },
      {
        // A trustworthy empty result: the command demonstrably ran (a
        // `Flags:` legend, a column header, or the echoed prompt line is
        // present) and matched nothing. Without that frame this would be
        // indistinguishable from a paste the installer forgot to make,
        // and RouterOS's own `set [find ...]` silent-success is the exact
        // reason absence is never trusted on its own here.
        when: { op: "all", of: [{ op: "recordCount", max: 0 }, { op: "outputFramePresent" }] },
        verdict: "PASS",
        why: "cloudguest-api user router pe nahi bacha -- purane secrets hat gaye.",
      },
    ],
    fallback:
      "Output se ye pakka nahi hua ki list khaali thi ya paste hi adhoora tha. Command wali line (`[admin@...] > /user print ...`) bhi saath me copy karo.",
  },

  "rec-regenerated": {
    // NOTE: `/radius print detail` prints the RADIUS shared secret. It is
    // stripped by `redactSecrets` before this ever runs, and nothing here
    // reads `secret=` -- the menu fingerprint uses the KEY's presence,
    // which survives redaction, never its value.
    identify: { kind: "menu", menu: "/radius" },
    rules: [
      {
        when: { op: "recordCount", min: 2 },
        verdict: "FAIL",
        why: "Do ya zyada RADIUS entries hain. Router galat wali try karta reh sakta hai.",
        fix: "do entries dikh rahi hain",
      },
      {
        when: { op: "all", of: [{ op: "recordCount", max: 0 }, { op: "outputFramePresent" }] },
        verdict: "FAIL",
        why: "Ek bhi RADIUS entry nahi hai -- naya RADIUS chunk paste nahi hua.",
      },
      {
        when: { op: "someRecord", then: { op: "hasFlag", meaning: "disabled" } },
        verdict: "FAIL",
        why: "RADIUS entry disabled hai.",
      },
      {
        when: {
          op: "someRecord",
          then: {
            op: "all",
            of: [
              {
                op: "isIpv4",
                ref: { from: "field", key: "address" },
                allowUnspecified: false,
                inSubnet: TUNNEL_SUBNET,
              },
              {
                op: "durationBetween",
                ref: { from: "field", key: "timeout" },
                minSeconds: 1,
                maxSeconds: 10,
              },
            ],
          },
        },
        verdict: "PASS",
        why: "Ek RADIUS entry hai, address hub ke tunnel IP pe hai aur timeout theek hai.",
      },
      {
        when: {
          op: "someRecord",
          then: {
            op: "all",
            of: [
              {
                op: "isIpv4",
                ref: { from: "field", key: "address" },
                allowUnspecified: false,
                inSubnet: TUNNEL_SUBNET,
              },
              {
                op: "durationBetween",
                ref: { from: "field", key: "timeout" },
                minSeconds: 0,
                maxSeconds: 0.999,
              },
            ],
          },
        },
        verdict: "WARNING",
        why: "Address theek hai par timeout bahut chhota hai (RouterOS ka default 300ms). Tunnel ke upar itne kam time me jawab nahi aata -- 3s chahiye, warna timeouts badhenge.",
      },
      {
        when: {
          op: "someRecord",
          then: { op: "isIpv4", ref: { from: "field", key: "address" }, allowUnspecified: false },
        },
        verdict: "WARNING",
        why: `RADIUS entry hai par uska address tunnel subnet (${TUNNEL_SUBNET}) me nahi hai. Check karo ki ye hub ka tunnel IP hi hai.`,
      },
    ],
    fallback:
      "RADIUS entry ke fields padhe nahi ja sake. `/radius print detail` chalao (sirf `print` nahi) -- usme har value `key=value` ki tarah aati hai.",
  },

  "rec-full": {
    identify: { kind: "menu", menu: "/system routerboard" },
    requires: [{ from: "label", label: "model" }],
    rules: [
      {
        when: { op: "present", ref: { from: "label", label: "model" } },
        verdict: "PASS",
        why: "Router se connection ban gaya -- model line aa rahi hai.",
      },
    ],
    fallback:
      "`model:` wali line nahi mili. `/system routerboard print` ka poora output paste karo.",
  },
};

/** Check ids that are deliberately human-confirmed only. Kept explicit so
 * the test script can assert the list has not silently grown. */
export const UNVERIFIABLE_CHECK_IDS = [
  "phone-mobiledata",
  "phone-portal",
  "phone-otp",
  "phone-realsite",
  "phone-reconnect",
  "cert-optional",
] as const;
