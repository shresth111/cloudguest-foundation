/**
 * Regression gate for the MikroTik setup-script generator in
 * `src/components/routers/RouterDetailTabs.tsx`.
 *
 * Run: `npm run test:setup-script`
 * Gate: `scripts/ci-gated-test.sh` (exit code + sentinel + check floor).
 *
 * WHY THIS EXISTS
 * ---------------
 * `buildRouterSetupScriptChunks` emits text that a technician pastes into
 * a real MikroTik. `tsc` cannot see a single defect in it: every value is
 * a `string` and every bug is in what the string MEANS to RouterOS. The
 * two failure modes below are both confirmed live, and both have the same
 * shape as every other incident in this project -- THE SYSTEM REPORTED
 * SUCCESS WHILE DOING NOTHING.
 *
 * 1. THE CONSOLE-SCOPE DEFECT
 *    The RouterOS terminal runs EACH ENTERED LINE as its own program. A
 *    `:local` declared on one line does not exist on the next. Every use
 *    of it is a syntax error, and a block whose verdict is computed from
 *    such a variable prints a confident wrong answer instead of failing
 *    visibly. Already found and fixed in two sibling modules (PRs #125,
 *    #126); `test-output-analyser.mjs` and `test-manual-wizard-engine.mjs`
 *    carry the equivalent guard. This generator had it in 12 of its chunk
 *    kinds, including the Heartbeat chunk, where the scheduler line
 *    succeeded on its own while the immediate check-in beneath it silently
 *    did not fire.
 *
 * 2. THE MULTI-STATEMENT `do={}` DEFECT
 *    `;`-chaining two statements inside an inline `do={ ... }` threw a
 *    real "syntax error" on a live router, at the exact boundary between
 *    the two statements. The generator's standing discipline since is one
 *    statement per `do={}` body. Braces as a grouping construct are off
 *    the table entirely: whether console brace-continuation makes a block
 *    survive a paste was never verified on this hardware, so a body spread
 *    over several lines is treated as exactly as suspect as a `;`-chained
 *    one.
 *
 * PROVEN TO FAIL ON PURPOSE
 * -------------------------
 * A guard that only ever passes is decoration. Both guards below are
 * pointed at the exact shapes that shipped broken (marked INJECTED), and
 * both carry anti-over-strictness self-checks: the cheapest way to defeat
 * a guard like this is to make it so aggressive that the next person turns
 * it off, so each one is also asserted NOT to fire on the legal shape it
 * exists to enforce.
 *
 * Each guard was mutated in the REAL generator (not just fed a fixture)
 * and this suite re-run. All six mutations were caught:
 *
 *   "WAN + Bridge" `:foreach` reverted to `:local` + next-line `:if` .. 1
 *   a `;`-chained pair put back inside an inline `do={}` ............... 2
 *   `active=yes routing-mark=""` dropped from the route lookup ........ 16
 *   `public_ip_address` emitted unconditionally (the "" collapse) ...... 8
 *   `active=yes` dropped from the SELECTING sweep only ................. 8
 *   (that last one initially slipped through -- the check asserted the
 *    qualifiers appeared somewhere rather than on every lookup, so the
 *    counting and selecting lookups could disagree about what "a default
 *    route" means. The check now walks every occurrence. That is a real
 *    hole this mutation pass found, not a confirmation.)
 *
 * And both anti-over-strictness self-checks were proven to bite by
 * mutating the guards themselves into being too aggressive:
 *
 *   scope guard stops treating `:for`/`:foreach` vars as bindings ...... 3
 *   do={} splitter stops skipping string contents ...................... 3
 *   do={} opener scan stops skipping string contents ................... 1
 *
 * SECTION 6 -- THE FIVE SILENT FAILURES
 * -------------------------------------
 * Five more defects of the same family: RouterOS reporting success for
 * work it did not do. A hardcoded `flash/hotspot/` path whose `set [find
 * ...]` no-ops silently on boards without that prefix; a local `guest`
 * hotspot user that bypassed RADIUS entirely (RouterOS checks local users
 * FIRST); `keepalive-timeout=none` with no `idle-timeout` to replace it,
 * so nothing ever closed a session; a WAN connectivity check that ran
 * before `/ip dns set servers=` and so printed FAIL on every healthy
 * router; and a tunnel interface named `wg-cloudguest` where the backend
 * (`network_config/renderers.py:672`) says `wg-cloudguard`.
 *
 * Fifteen mutations of the REAL generator, all caught:
 *
 *   portal pattern loses its leading slash (rlogin/alogin collide) ..... 10
 *   the `/file set` stops being gated on a non-zero match count ......... 5
 *   the not-found branch stops printing anything ........................ 5
 *   the hardcoded `flash/` prefix comes back ........................... 11
 *   the local `guest` hotspot user is created again ..................... 1
 *   the remaining-local-users warning is dropped ........................ 1
 *   the `idle-timeout` line is removed entirely ......................... 2
 *   `idle-timeout` set to 2m, re-creating the false-logout incident ..... 1
 *   one default-profile `set` goes back to being unguarded .............. 1
 *   the WAN check moves back ahead of the DNS chunk ..................... 8
 *   the configured-resolver count is no longer reported ................. 1
 *   the tunnel interface reverts to `wg-cloudguest` ..................... 5
 *   an existing accept rule is no longer repointed ...................... 1
 *   the legacy-interface count and warning are dropped .................. 1
 *   the tunnel's final PASS/FAIL state check is dropped ................. 1
 *
 * The resolver-count mutation initially slipped through, and that was a
 * real hole rather than a confirmation: the check asserted the count was
 * PRINTED but not that it was READ from the device, so pinning it at 0
 * still passed while telling the operator "no resolver at all" on a router
 * whose DNS was fine. The check now requires the `/ip dns get servers`
 * read itself. Same lesson as the `active=yes` miss recorded above.
 *
 * THE THREE FRESH-ROUTER TRAPS (sections 7-9, added 2026-08-23)
 * ------------------------------------------------------------
 * Three defects that hit a factory-fresh router specifically, and that
 * every one of the guards above was blind to because none of them is about
 * what a line MEANS -- they are about what the script never said at all.
 *
 * 7. THE GENERATOR NEVER SET THE CLOCK.
 *    `grep -c "ntp client\|time-zone-name"` over the generator returned 0.
 *    This hardware has no battery-backed clock, so a fresh or power-cycled
 *    router boots with a wrong date; a wrong date fails HTTPS certificate
 *    validation, so the heartbeat's `/tool fetch` is rejected before it is
 *    sent, so the router shows offline in Master console forever -- while
 *    guests get working WiFi and nobody suspects anything. Setting NTP is
 *    not the fix on its own: enabling the client does not synchronise it,
 *    so the chunk also CHECKS and prints a FAIL.
 * 8. A BROKEN VENUE DNS PRODUCED A TUNNEL PEER POINTING AT NOTHING.
 *    RouterOS resolves `endpoint-address` once, at peer creation, and
 *    never again. Confirmed live 2026-08-22: `/tool fetch` returned
 *    `resolving error` while WAN, DHCP, gateway, default route and
 *    `/ip dns` servers were all healthy. The `add` succeeded, nothing was
 *    printed, and the tunnel never handshook.
 * 9. RE-CLICKING GENERATE SILENTLY INVALIDATED THE SCRIPT ON SCREEN.
 *    Master console now says so in a blocking dialog and a banner that
 *    does not disappear, and names which secrets re-pasting cannot repair.
 *    Section 9 asserts that table against what the generator ACTUALLY
 *    emits, because a warning nothing checks is how it becomes a lie.
 *
 * Sixteen mutations of the real source were injected and this suite
 * re-run. All sixteen were caught:
 *
 *   clock chunk removed entirely ..................................... 121
 *   clock chunk moved after the Heartbeat chunk ....................... 10
 *   NTP servers given as hostnames instead of raw IPs ................. 20
 *   NTP configured but never verified (verdict line dropped) .......... 60
 *   the NTP status read left unguarded by `:do {} on-error={}` ........ 10
 *   the date/year backstop dropped from the PASS verdict .............. 10
 *   `time-zone-autodetect=no` dropped ................................. 10
 *   peer add reverted to the unconditional hostname form .............. 16
 *   the `:resolve` left unguarded (it throws on failure) ............... 2
 *   peer built anyway on DNS failure with no fallback available ........ 1
 *   today's hub IP typed into the generator as a default fallback ...... 3
 *   the peer's `comment=` dropped ...................................... 2
 *   the repair table flipped to claim RADIUS is repairable ............. 1
 *   RADIUS `else={}` starts writing `secret=`, table not updated ....... 1
 *   `rotatingSecrets` stops reporting the agent credential ............. 2
 *   the WireGuard chunk grows an `else=`, table not updated ............ 1
 *
 *   (the year-backstop mutation initially slipped through -- the check
 *    asserted the year appeared SOMEWHERE in the chunk rather than in the
 *    PASS condition, so a chunk could parse the year carefully and then
 *    ignore it. The check now asserts the verdict itself. That is a real
 *    hole this mutation pass found, not a confirmation -- the same shape
 *    as the `active=yes` hole section 3 found the same way.)
 *
 * THE SECOND RESET STATE (section 10, added 2026-08-23)
 * ----------------------------------------------------
 * A MikroTik hardware reset produces one of TWO states depending on how
 * long the button is held: WITH the default configuration (a bridge with
 * ether2..5 in it, a DHCP client on ether1, defconf firewall rules, and
 * `/interface list member add interface=ether1 list=WAN`), or WITH NO
 * DEFAULTS AT ALL. Every chunk this generator emits had only ever been
 * run against the first.
 *
 * Audited chunk by chunk. Most of it already worked: the bridge, the
 * "WAN" list and every other object are create-if-missing; the sole
 * `place-before` already has an explicit "target does not exist" branch;
 * the portal-page writes, the hotspot default user profile, the tunnel and
 * the two checkpoints already count what they found. ONE behavioural
 * defect was found, and it is an L2 hole:
 *
 *   For a PPPoE WAN this generator puts only the VIRTUAL
 *   `cloudguest-pppoe-wan<N>` interface into the "WAN" interface list --
 *   "WAN + Bridge" cannot add a list member for an interface that does not
 *   exist yet. The PHYSICAL port carrying the session therefore tests as
 *   "not a WAN port" in the LAN sweep. With defaults, MikroTik's own
 *   defconf `ether1 -> WAN` membership covered for that. Without defaults
 *   nothing does, and the sweep bridges the live uplink into the guest
 *   LAN -- WAN and LAN on one L2 segment, silently, because bridging a
 *   port is a legal thing to do.
 *
 * The rest of section 10 is the reporting half: six chunks that create or
 * mutate something defconf would have supplied now bind a count, print it,
 * and take a named FAIL branch on zero -- because `set [find ...]` against
 * an empty match SUCCEEDS on RouterOS and an empty `:foreach` exits clean,
 * so "no error" was never evidence of anything.
 *
 * Twenty mutations of the real generator and four of the guards
 * themselves were injected and this suite re-run. All twenty-four caught:
 *
 *   the pppoe-client exclusion removed from the LAN sweep .............. 2
 *   the exclusion applied to the attach pass only ...................... 1
 *   the exclusion hardcoded to ether1 instead of read live ............. 2
 *   the LAN Ports count/verdict line dropped ........................... 2
 *   LAN Ports counts but never prints the number ....................... 1
 *   LAN Ports stops naming the ports it bridged ........................ 1
 *   the stale-defconf cleanup reverts to a bare silent :foreach ........ 2
 *   the stale-defconf cleanup loses every zero branch .................. 2
 *   the stale-defconf zero branch stops naming the count ............... 1
 *   the cleanup counts but no longer removes anything .................. 1
 *   the WAN + Bridge base-object count dropped ......................... 2
 *   the Hotspot five-object verification dropped ....................... 2
 *   the certificate chunk's state check dropped ........................ 2
 *   the RADIUS chunk stops reading hsprof1 back ........................ 2
 *   a FAIL branch loses its :log warning ............................... 1
 *   place-before points at a defconf rule directly ..................... 2
 *   the WireGuard no-target (bare router) add branch dropped ........... 1
 *   the LAN bridge add loses its existence test ........................ 1
 *   a chunk starts matching on RouterOS's own `defconf` comment ........ 1
 *   a second chunk starts depending on the `bridgeLocal` name .......... 1
 *   zero-branch guard stops accepting the negated-verdict form ......... 4
 *   the unguarded-add detector stops recognising an add ................ 2
 *   the place-before guard stops requiring the length test ............. 1
 *   the existence-test predicate stops recognising `] = 0` ............. 1
 *
 *   (three initially slipped through, and two were real holes in the
 *    GUARDS rather than confirmations. The place-before and unguarded-add
 *    checks each kept a PRIVATE COPY of the regex their self-check tested,
 *    so mutating the copy the sweep actually used changed nothing the
 *    self-check could see -- the exact "a guard that cannot be shown to
 *    fail is not a guard" shape. Both predicates are now shared by the
 *    sweep and its self-checks. The third, removing one of three zero
 *    branches from the cleanup chunk, was a legitimate survivor: the
 *    remaining two still reported the zero case. The mutation was
 *    sharpened to remove all three, and a separate check now pins the
 *    branch to naming the number rather than saying something vague.)
 *
 * THE PARENTHESIS (section 11, added 2026-08-23)
 * ---------------------------------------------
 * A whole-script RouterOS syntax QA pass, prompted by a live failure. The
 * founder pasted the "WAN Routing" chunk into a real hEX and the console
 * answered with nothing but `error`.
 *
 * A concatenation used as a command ARGUMENT must be parenthesised. This
 * shipped without them:
 *
 *   :log warning "cloudguest: WAN1 gateway ... (still \"" . $wan1Gw . "\") ..."
 *
 * RouterOS parses `:log warning "<string>"` as a complete command and then
 * meets `. $wan1Gw . "..."` as a second, meaningless command in the same
 * statement. Because a chunk is `;`-joined onto ONE entered line, the
 * error aborted the ENTIRE line: the DHCP gateway poll, the plain default
 * route and every routing-mark'd route below it never ran. The router was
 * left with no default route -- the exact "no gateway-health signal" state
 * the chunk exists to prevent, reached by a syntax error instead of a
 * logic one.
 *
 * Sections 1 and 2 were both blind to it. No variable crosses a line, and
 * the `do={}` body holds exactly one statement. Malformed ARGUMENT syntax
 * is a third failure class. It was the only such site in the generator --
 * every other concatenating `:put`/`:log`/`:error` already had parens --
 * so one site, missed once, and now swept for.
 *
 * Three further whole-script budgets are pinned here, each a real
 * constraint that nothing was measuring: every `/...` path must be a known
 * RouterOS menu (`/ip pppoe-client` for `/interface pppoe-client` is
 * invisible to every other guard and silently matches nothing forever); no
 * emitted line over 3300 chars (WinBox mangles long pastes -- the reason
 * this generator chunks at all; longest today is 3125, in the chunk that
 * just failed); no chunk blocking the console over 60s (the polls block on
 * purpose, and a frozen terminal gets read as a hang and power-cycled --
 * two WANs already reach 50s).
 *
 * Eleven mutations injected, all eleven caught:
 *
 *   the parens come off the line that errored on the hEX ............... 1
 *   a different chunk loses its parens (heartbeat fault trace) ......... 1
 *   a :put count line loses its parens ................................. 1
 *   /interface pppoe-client mistyped as /ip pppoe-client ............... 3
 *   /ip hotspot user profile mistyped as /ip hotspot userprofile ....... 2
 *   the DHCP gateway poll grows past the console-freeze budget ......... 2
 *   the line-length budget stops reflecting the real longest line ...... 1
 *   concat guard stops requiring the leading paren ..................... 1
 *   concat guard stops skipping string contents (over-strict) .......... 1
 *   the menu allowlist silently swallows anything ...................... 1
 *   the menu extractor stops matching command paths .................... 2
 *
 *   (two initially slipped through and both were real holes in the new
 *    GUARDS. The menu check accumulated offenders inline while its
 *    self-check re-derived the answer separately, so mutating the sweep
 *    changed nothing the self-check saw -- the third time that exact shape
 *    has been caught in this file, and the predicate is now shared. And
 *    the concat guard's anti-over-strictness sample was `"print. Then"`,
 *    which has no space-dot-space in it, so it passed even with
 *    string-skipping switched off; it now uses a message that really
 *    contains the pattern.)
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "setup-script-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail ?? ""}`);
    console.log(`  FAIL ${name}`);
  }
};

writeFileSync(
  join(work, "entry.js"),
  [
    `export { buildRouterSetupScriptChunks } from "@/components/routers/RouterDetailTabs";`,
    `export { chunksToSingleLineScript } from "@/components/routers/RouterDetailTabs";`,
    `export { validateSetupScriptChunks } from "@/components/routers/RouterDetailTabs";`,
    // Sections 8 below assert the Master-console panel's "what a
    // re-Generate breaks" table against what the generator ACTUALLY
    // emits. That table lives in its own module precisely so it can be
    // imported here without React/router/axios coming with it.
    `export { SECRET_REPAIR, rotatingSecrets } from "@/lib/setup-script-secrets";`,
  ].join("\n"),
);

await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  outfile: join(work, "bundle.mjs"),
  logLevel: "error",
  banner: {
    js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": '"/api/v1"',
    "import.meta.env": "{}",
  },
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "src-alias",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

const {
  buildRouterSetupScriptChunks,
  chunksToSingleLineScript,
  validateSetupScriptChunks,
  SECRET_REPAIR,
  rotatingSecrets,
} = await import(pathToFileURL(join(work, "bundle.mjs")).href);

// ---------------------------------------------------------------------
// The option matrix
// ---------------------------------------------------------------------
// Every branch in the generator that changes what RouterOS text comes
// out: each WAN addressing mode, each routing mode, one/two/three WANs,
// the explicit-LAN allowlist, `basicConfigOnly`, and each optional
// subsystem. A guard is only worth its floor if it actually sees the
// chunk that will break.

const BASE = {
  apiBase: "https://master.wyfyguest.com/api/v1",
  agentCredential: "cred-abc123",
  lanBridge: "bridge-guest",
  lanIp: "10.5.50.1",
  lanCidr: "24",
  dnsServers: "8.8.8.8,1.1.1.1",
  hsUser: "guest",
  hsPass: "guestpass",
  enableFirewall: true,
};

/** Documentation-range addresses (RFC 5737), deliberately -- so that if
 * one of these ever DOES leak into a shipped script it is obviously a test
 * fixture and not somebody's live hub. */
const WG_FALLBACK_ADDR = "198.51.100.7";
const WG_LITERAL_HOST = "203.0.113.11";
/** The address that got baked into 64 field routers' `endpoint-address=`
 * because it lived as a literal in code. Those routers are now unreachable
 * and need physical visits. The backend carries the same guard over its
 * own source (`tests/unit/test_network_config.py`); this is the frontend
 * half. */
const BANNED_HUB_LITERAL = "20.219.72.235";

const WG = {
  routerPrivateKey: "PRIVKEY",
  serverPublicKey: "PUBKEY",
  routerTunnelIp: "10.20.0.5",
  serverEndpointHost: "vpn.wyfyguest.com",
  serverEndpointPort: "13231",
  tunnelSubnet: "10.20.0.0/24",
  hubTunnelIpAddress: "10.20.0.1",
};

const PORTAL = {
  frontendBase: "https://portal.wyfyguest.com",
  organizationId: "org-1",
  locationId: "loc-1",
  routerId: "rtr-1",
};

const STATIC_WAN = {
  iface: "ether1",
  mode: "static",
  ip: "1.2.3.4",
  cidr: "24",
  gateway: "1.2.3.1",
};
const DHCP_WAN = { iface: "ether1", mode: "dhcp" };
const PPPOE_WAN = { iface: "ether1", mode: "pppoe", pppoeUsername: "u", pppoePassword: "p" };

const VARIANTS = [
  ["single DHCP WAN", { ...BASE, wans: [DHCP_WAN] }],
  ["single static WAN", { ...BASE, wans: [STATIC_WAN] }],
  ["single PPPoE WAN", { ...BASE, wans: [PPPOE_WAN] }],
  [
    "two WANs, load balance",
    {
      ...BASE,
      wans: [
        DHCP_WAN,
        { iface: "ether2", mode: "static", ip: "5.6.7.8", cidr: "24", gateway: "5.6.7.1" },
      ],
      wanRoutingMode: "load_balance",
    },
  ],
  [
    "two WANs, weighted load balance",
    {
      ...BASE,
      wans: [
        { ...DHCP_WAN, weight: 70 },
        { iface: "ether2", mode: "dhcp", weight: 30 },
      ],
      wanRoutingMode: "load_balance",
    },
  ],
  [
    "three WANs, failover only",
    {
      ...BASE,
      wans: [
        DHCP_WAN,
        { iface: "ether2", mode: "dhcp" },
        { iface: "ether3", mode: "pppoe", pppoeUsername: "u", pppoePassword: "p" },
      ],
      wanRoutingMode: "failover_only",
    },
  ],
  [
    "every optional subsystem on",
    {
      ...BASE,
      wans: [DHCP_WAN],
      lanIfs: ["ether3", "ether4"],
      wireguard: WG,
      radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t" },
      apiAccess: { username: "cloudguest", secret: "pw" },
      identity: "gurgaon-branch",
      portalUrl: PORTAL,
    },
  ],
  [
    "basicConfigOnly, IP-literal portal, firewall off",
    {
      ...BASE,
      wans: [DHCP_WAN],
      enableFirewall: false,
      basicConfigOnly: true,
      wireguard: WG,
      radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t" },
      portalUrl: { ...PORTAL, frontendBase: "https://192.168.1.9" },
    },
  ],
  // The two WireGuard-endpoint shapes section 8 exists for, in the sweep
  // so guards 1 and 2 see them too. `WG` above is the shape that ships
  // today (a hostname, no fallback address -- see `serverEndpointAddress`'s
  // own docstring for why the backend supplies none).
  [
    "wireguard with a backend-supplied fallback address",
    { ...BASE, wans: [DHCP_WAN], wireguard: { ...WG, serverEndpointAddress: WG_FALLBACK_ADDR } },
  ],
  [
    "wireguard whose endpoint host is already an address",
    { ...BASE, wans: [DHCP_WAN], wireguard: { ...WG, serverEndpointHost: WG_LITERAL_HOST } },
  ],
];

/** Every chunk this generator can put in front of a technician, labelled
 * with the variant that produced it, de-duplicated by body. */
const pasteables = [];
{
  const seen = new Set();
  for (const [variant, opts] of VARIANTS) {
    for (const chunk of buildRouterSetupScriptChunks(opts)) {
      const key = `${chunk.label}\u0000${chunk.script}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pasteables.push([`${variant} :: ${chunk.label}`, chunk.script]);
    }
  }
}

// =====================================================================
// 1. THE CONSOLE-SCOPE GUARD
// =====================================================================
// Identical rule to `test-output-analyser.mjs` and
// `test-manual-wizard-engine.mjs`, deliberately: a variable REFERENCED on
// a line must have been BOUND on that same line, by `:local`, `:global`,
// or a `:for` / `:foreach` loop variable. `:set` is a USE, not a binder --
// that is precisely what failed on the hEX. A `:local` declared and
// consumed inside one line is legal and is the intended way to keep
// carried state.

console.log("\n-- the console-scope guard --");

const RE_VAR_USE = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
const RE_SET = /:set\s+([A-Za-z_][A-Za-z0-9_]*)/g;
const RE_BIND = /:(?:local|global)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
const RE_LOOP = /:(?:for|foreach)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:from|in)\b/g;
const names = (line, re) => [...line.matchAll(re)].map((m) => m[1]);
/** Names read on this line that this line did not bind. */
const unboundOn = (line) => {
  const bound = new Set([...names(line, RE_BIND), ...names(line, RE_LOOP)]);
  // `:set x` READS an existing binding, so it is a use, not a bind.
  const used = new Set([...names(line, RE_VAR_USE), ...names(line, RE_SET)]);
  return [...used].filter((v) => !bound.has(v));
};

check(
  "the guard has every emitted chunk in scope, across the whole option matrix",
  pasteables.length >= 40,
  `only ${pasteables.length} distinct chunk bodies swept -- a branch of the generator stopped being exercised`,
);

{
  const offenders = [];
  for (const [label, script] of pasteables) {
    script.split("\n").forEach((line, n) => {
      for (const v of unboundOn(line)) offenders.push(`${label}, line ${n + 1}: $${v}`);
    });
  }
  check(
    "no emitted chunk carries a variable across a line break",
    offenders.length === 0,
    `${offenders.length} unbound reference(s). The RouterOS console runs each line as its own ` +
      `program, so these read a variable that no longer exists -- the line will either be a ` +
      `syntax error or, worse, evaluate against nothing and print a confident wrong answer. ` +
      `Join the statements onto ONE line with ";", or restructure the chunk to carry no state ` +
      `at all.\n      ${offenders.slice(0, 12).join("\n      ")}` +
      (offenders.length > 12 ? `\n      ... and ${offenders.length - 12} more` : ""),
  );
}

// A guard that cannot see the pattern it was written for is decoration,
// so it is pointed at the exact shapes this generator actually shipped.
const SCOPE_REGRESSIONS = [
  [
    "the Heartbeat chunk's own three-line form, which is why the scheduler existed but the router never checked in",
    `:local wan1Ip ""\n:if ([:len [/ip address find where interface="ether1"]] > 0) do={ :set wan1Ip [:pick [/ip address get [find interface="ether1"] address] 0 1] }\n:do { /tool fetch url="https://master.wyfyguest.com/api/v1/agent/heartbeat" http-data=("{\\"public_ip_address\\":\\"" . $wan1Ip . "\\"}") output=none } on-error={ :log warning "failed" }`,
  ],
  [
    "the guided-setup block that failed on the hEX",
    `:local dirty 0\n:if ([:len [/ip hotspot find]] > 0) do={ :set dirty ($dirty + 1) }`,
  ],
  [
    "the WAN+Bridge find-then-remove pair",
    `:local wan1Port [/interface bridge port find where interface="ether1"]\n:if ([:len $wan1Port] > 0) do={ /interface bridge port remove $wan1Port }`,
  ],
  [
    "the WAN Routing gateway carried into a route add",
    `:local wan1Gw ""\n:if ($wan1Gw != "" && $wan1Gw != "0.0.0.0") do={ /ip route add dst-address=0.0.0.0/0 gateway=$wan1Gw }`,
  ],
];
for (const [what, script] of SCOPE_REGRESSIONS) {
  const caught = script.split("\n").some((line, n) => n > 0 && unboundOn(line).length > 0);
  check(`INJECTED: the scope guard fires on ${what}`, caught, "the guard is blind to it");
}

// ANTI-OVER-STRICTNESS. The same shapes, legally flattened. If the guard
// fired on these it would ban the very fix it exists to enforce, and the
// cheapest way to defeat it would be to make it so strict that someone
// loosens it.
{
  const LEGAL = SCOPE_REGRESSIONS.map(([, s]) => s.split("\n").join("; "));
  const bad = LEGAL.filter((s) => unboundOn(s).length > 0);
  check(
    "...and does NOT fire on those same scripts flattened onto one line",
    bad.length === 0,
    `the guard bans the legal single-line shape: ${bad.join(" || ")}`,
  );
}
check(
  "...and understands a `:foreach` loop variable as a binding",
  unboundOn(
    `:foreach p in=[/interface bridge port find where interface="ether1"] do={ /interface bridge port remove $p }`,
  ).length === 0,
  "a no-state `:foreach` -- the generator's own replacement idiom -- is reported as an offender",
);
check(
  "...and understands a `:for` loop variable as a binding",
  unboundOn(
    `:for i from=1 to=255 do={ :if ([:len [/ip route find where distance=$i]] > 0) do={ :log info "x" } }`,
  ).length === 0,
  "a `:for` counter is reported as an offender",
);
check(
  "...and does NOT fire on a chunk that uses no variables at all",
  unboundOn(`/ip hotspot profile set [find name="hsprof1"] login-by=http-pap`).length === 0,
  "a plain command line is reported as an offender",
);

// =====================================================================
// 2. THE MULTI-STATEMENT `do={}` GUARD
// =====================================================================
// `;`-chaining two statements inside an inline `do={ ... }` threw a real
// syntax error on a live router. Splitting the same body over several
// lines is not a fix -- it only trades a confirmed defect for an
// unverified assumption about console brace-continuation. So the rule is
// the body itself: exactly one statement, however it is spelled.

console.log("\n-- the multi-statement do={} guard --");

/** Every block body opened by `do={`, `:do {`, `on-error={` or `else={`,
 * with the statements it contains. String contents are skipped, so a
 * `do={` inside a `:put` message is not mistaken for real syntax. */
function doBodies(script) {
  const s = script;
  const opens = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{" && /(?::do|\bdo=|on-error=|else=)\s*$/.test(s.slice(Math.max(0, i - 12), i))) {
      opens.push(i);
    }
  }

  const bodies = [];
  for (const open of opens) {
    let depth = 0;
    let close = -1;
    let str = false;
    for (let i = open; i < s.length; i++) {
      const c = s[i];
      if (str) {
        if (c === "\\") i++;
        else if (c === '"') str = false;
        continue;
      }
      if (c === '"') {
        str = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        close = i;
        break;
      }
    }
    if (close === -1) continue; // unbalanced -- validateSetupScriptChunks' job
    const body = s.slice(open + 1, close);

    // Split on separators at THIS body's own depth: `;` or a newline.
    // Nested braces/brackets/parens and string contents are skipped, so a
    // nested single-statement block counts as one statement, not many.
    const parts = [];
    let cur = "";
    let d = 0;
    let bstr = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (bstr) {
        cur += c;
        if (c === "\\") cur += body[++i] ?? "";
        else if (c === '"') bstr = false;
        continue;
      }
      if (c === '"') {
        bstr = true;
        cur += c;
        continue;
      }
      if (c === "{" || c === "[" || c === "(") d++;
      else if (c === "}" || c === "]" || c === ")") d--;
      if (d === 0 && (c === ";" || c === "\n")) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    parts.push(cur);
    bodies.push({ body, statements: parts.map((p) => p.trim()).filter(Boolean) });
  }
  return bodies;
}

const multiStatement = (script) => doBodies(script).filter((b) => b.statements.length > 1);

{
  const offenders = [];
  for (const [label, script] of pasteables) {
    for (const b of multiStatement(script)) {
      offenders.push(
        `${label}: ${b.statements.length} statements in do={ ${b.body.trim().slice(0, 90)} }`,
      );
    }
  }
  check(
    "no emitted chunk has a multi-statement do={} body",
    offenders.length === 0,
    `${offenders.length} offender(s). A ";"-chained pair inside an inline do={} threw a real ` +
      `syntax error on a live router, and spreading the same body over lines only swaps that ` +
      `confirmed defect for an unverified assumption about console brace-continuation. Split it ` +
      `into separate guarded statements instead.\n      ${offenders.slice(0, 12).join("\n      ")}` +
      (offenders.length > 12 ? `\n      ... and ${offenders.length - 12} more` : ""),
  );
}

// The guard must also hold for the flattened single-paste export, which
// is a third way this same text reaches a device.
{
  const offenders = [];
  for (const [variant, opts] of VARIANTS) {
    const one = chunksToSingleLineScript(buildRouterSetupScriptChunks(opts));
    for (const b of multiStatement(one)) {
      offenders.push(
        `${variant}: ${b.statements.length} statements in do={ ${b.body.trim().slice(0, 70)} }`,
      );
    }
  }
  check(
    "chunksToSingleLineScript's output has none either",
    offenders.length === 0,
    `flattening every chunk onto one line created ${offenders.length} multi-statement do={} ` +
      `bodies:\n      ${offenders.slice(0, 6).join("\n      ")}`,
  );
}

const DO_REGRESSIONS = [
  [
    'the `;`-chained pair that threw "syntax error" on a live router',
    `:if ([:len [/ip address find where interface="ether1"]] > 0) do={ :local wan1Full [/ip address get [find interface="ether1"] address]; :set wan1Ip [:pick $wan1Full 0 1] }`,
  ],
  [
    "the DHCP gateway poll's attempt-then-delay body",
    `:for t from=1 to=30 do={ :if ([:len $gw] = 0) do={ :do { :set gw [:tostr [/ip dhcp-client get [find] gateway]] } on-error={ :set gw "" }; :if ([:len $gw] = 0) do={ :delay 1s } } }`,
  ],
  [
    "the LAN Ports remove-then-add body, spread over lines instead of chained",
    `:if ([:len [/interface bridge port find]] = 0) do={\n  /interface bridge port remove $existingPort\n  /interface bridge port add bridge="br" interface=$ethName\n}`,
  ],
  [
    "the wanExistenceCheck put-then-error body",
    `:if ([:len [/interface find where name="ether1"]] = 0) do={\n  :put ("missing")\n  :error ("missing")\n}`,
  ],
];
for (const [what, script] of DO_REGRESSIONS) {
  check(
    `INJECTED: the do={} guard fires on ${what}`,
    multiStatement(script).length > 0,
    "the guard is blind to it",
  );
}

// ANTI-OVER-STRICTNESS. Every one of these is a legal shape the generator
// relies on today. A guard that flagged them would be turned off within a
// week, which is worth more to an attacker of this codebase's discipline
// than a guard that is merely absent.
const DO_LEGAL = [
  [
    "a plain single-statement do={}",
    `:if ([:len [/ip pool find]] = 0) do={ /ip pool add name="p" }`,
  ],
  [
    "an :if with single-statement do={} AND else={}",
    `:if ([:len [/user find]] = 0) do={ /user add name="a" } else={ /user set [find] password="b" }`,
  ],
  [
    "a nested :foreach whose body is one statement inside an :if whose body is that :foreach",
    `:if ([:len [/ip dhcp-client find]] = 0) do={ :foreach c in=[/ip dhcp-client find] do={ /ip dhcp-client remove $c } }`,
  ],
  [
    ":do {} on-error={} with one statement in each",
    `:do { :set dnsOk ([:len [:resolve "a.b"]] > 0) } on-error={ :set dnsOk false }`,
  ],
  [
    "a :do nested inside an on-error, one statement at every level",
    `:do { :set hbIf [:tostr [/ip route get $r immediate-gw]] } on-error={ :do { :set hbIf [:tostr [/ip route get $r gateway]] } on-error={ :set hbIf "" } }`,
  ],
  [
    "a single statement containing semicolons INSIDE a string literal",
    `:if ($x = 1) do={ :log warning "cloudguest: one; two; three" }`,
  ],
  [
    "a single statement whose string literal contains the text do={",
    `:if ($x = 1) do={ :put "paste this: :if (y) do={ a; b }" }`,
  ],
  [
    "a top-level `;`-joined line, which is the whole point of the fix",
    `:local a ""; :if ($a = "") do={ :set a "x" }; :put $a`,
  ],
];
for (const [what, script] of DO_LEGAL) {
  const found = multiStatement(script);
  check(
    `...and does NOT fire on ${what}`,
    found.length === 0,
    `wrongly flagged: ${JSON.stringify(found.map((b) => b.statements))}`,
  );
}
check(
  "...and the guard actually inspects bodies rather than trivially passing",
  doBodies(`:if ($x = 1) do={ :put "a" } else={ :put "b" }`).length === 2,
  "doBodies found no block bodies at all in a script that plainly has two",
);

// =====================================================================
// 3. THE UPLINK IS DERIVED, NOT NAMED
// =====================================================================
// The founder's objection, verbatim: "aisa hona nahi chahiye, bas ISP koi
// sa bhi ho wo le le". A venue with two or three ISPs whose live uplink is
// on ether2 reported an EMPTY public_ip_address while looking perfectly
// healthy. The port a link is plugged into is not evidence; the interface
// the active default route goes out of is.

console.log("\n-- the heartbeat reports the live uplink, not a named port --");

const heartbeatChunks = (opts) =>
  buildRouterSetupScriptChunks(opts).filter((c) => c.label.startsWith("Heartbeat"));

for (const [variant, opts] of VARIANTS) {
  const hb = heartbeatChunks(opts);
  const all = hb.map((c) => c.script).join("\n");
  const wanNames = opts.wans.map((w) => w.iface);

  check(
    `${variant}: emits an immediate check-in AND a scheduler, as separate pastes`,
    hb.length === 2,
    `found ${hb.length} heartbeat chunk(s): ${hb.map((c) => c.label).join(", ")}`,
  );
  // The actual regression. Every one of these names used to be baked into
  // the address lookup, so a router whose uplink was on any other port
  // reported "".
  check(
    `${variant}: never names a WAN port in the address lookup`,
    !wanNames.some((n) => all.includes(`interface="${n}"`)),
    `hardcodes one of ${JSON.stringify(wanNames)} -- that is the ether1 assumption, moved`,
  );
  // EVERY default-route lookup, not just one of them. An earlier version
  // of this check asserted only that the qualifiers appeared SOMEWHERE in
  // the chunk, and a mutation that stripped them from the counting lookup
  // while leaving them on the selecting one went undetected -- the count
  // and the selection would then disagree about what "a default route"
  // means, which is exactly how "1 route, looks healthy" gets printed for
  // a router whose fetch says `Network unreachable`. So this walks every
  // occurrence and requires each to carry both qualifiers.
  const defaultRouteLookups = [
    ...all.replace(/\\(.)/g, "$1").matchAll(/dst-address="0\.0\.0\.0\/0"([^\]]*)/g),
  ].map((m) => m[1]);
  check(
    `${variant}: EVERY default-route lookup requires the route to be ACTIVE`,
    defaultRouteLookups.length > 0 && defaultRouteLookups.every((t) => t.includes("active=yes")),
    "a route that merely EXISTS is not a route that works -- RouterOS keeps an unreachable " +
      `default route in the table and flags it Inactive. Unqualified: ${JSON.stringify(
        defaultRouteLookups.filter((t) => !t.includes("active=yes")),
      )}`,
  );
  // This generator itself creates routing-mark'd default routes per WAN in
  // load-balance mode, so an unqualified find returns several and "the
  // first" would be whichever mark sorted first.
  check(
    `${variant}: EVERY default-route lookup reads the MAIN table, not a routing-mark'd copy`,
    defaultRouteLookups.length > 0 &&
      defaultRouteLookups.every((t) => t.includes(`routing-mark=""`)),
    "the heartbeat is router-originated traffic and is routed by the main table; the marked " +
      `copies belong to LAN traffic. Unqualified: ${JSON.stringify(
        defaultRouteLookups.filter((t) => !t.includes(`routing-mark=""`)),
      )}`,
  );
  check(
    `${variant}: picks among multiple active defaults by ascending distance, deliberately`,
    /:for hbDist from=1 to=\d+ do=\{/.test(all) && all.includes("distance=$hbDist"),
    "no explicit ascending-distance sweep -- the choice would depend on find order",
  );
  check(
    `${variant}: says so in the log when more than one default route is active`,
    /hbDefCount > 1/.test(all) && /active default routes/.test(all),
    "multiple live uplinks are silently collapsed into one reported address",
  );
  check(
    `${variant}: consults the WAN interface list the generator itself builds`,
    all.includes(`list="WAN"`),
    "the uplink is never cross-checked against this script's own notion of a WAN port",
  );
}

// =====================================================================
// 4. AN UNREAD ADDRESS IS NEVER REPORTED AS AN ADDRESS
// =====================================================================
// The backend does `if public_ip_address is not None: update_data[...]`
// (app/domains/router/service.py). So an ABSENT key leaves the last known
// good address alone, while an EMPTY STRING overwrites it with blank.
// Today's script sends the empty string, which is why a router whose
// uplink moved ports shows a blank Public IP rather than a stale one: it
// is actively told the wrong thing.

console.log("\n-- three faults, three traces, and no invented address --");

for (const [variant, opts] of VARIANTS) {
  const all = heartbeatChunks(opts)
    .map((c) => c.script)
    .join("\n");

  check(
    `${variant}: public_ip_address appears ONLY under a guard that an address was read`,
    (() => {
      // Every statement mentioning the key must also test $hbIp.
      const stmts = all
        .split("\n")
        .flatMap((l) => l.split(";"))
        .filter((s) => s.includes("public_ip_address") && !s.includes(":log"));
      return stmts.length > 0 && stmts.every((s) => s.includes("$hbIp"));
    })(),
    'the key is emitted unconditionally, so an unread address reaches the backend as "" and ' +
      "overwrites the last known good value",
  );
  check(
    `${variant}: the fallback body carries no public_ip_address key at all`,
    /:local hbJson "\{(?:\\"management_ip_address\\":\\"[^"]*\\")?\}"/.test(all),
    "the not-read body is not a bare {} (plus management IP) -- it must OMIT the key, not blank it",
  );

  // Three faults that an empty string would collapse into one.
  check(
    `${variant}: "no active default route" has its own trace`,
    /hbDefCount = 0\) do=\{ :log warning "cloudguest-hb: no ACTIVE default route/.test(all),
    "missing",
  );
  check(
    `${variant}: "route found, interface unresolved" has its own trace`,
    /hbDefCount > 0 && \$hbIf = ""\) do=\{ :log warning/.test(all),
    "missing",
  );
  check(
    `${variant}: "uplink found, no address on it" has its own trace`,
    /\$hbIf != "" && \$hbIp = ""\) do=\{ :log warning/.test(all),
    "missing",
  );
  // A scheduler on-event that fails produces no toast, no popup and
  // nothing waiting for anyone to look. Counted after undoing one level
  // of RouterOS escaping, so the scheduler's stored copy -- where the
  // quotes arrive as \" -- is counted too, not skipped.
  check(
    `${variant}: both fetches leave a :log warning when they fail`,
    (
      all.replace(/\\(.)/g, "$1").match(/on-error=\{ :log warning "cloudguest-hb: \/tool fetch/g) ??
      []
    ).length === 2,
    "a fetch failure would be completely silent",
  );
  // The reported run-count=0 / next-run stuck weeks in the past.
  check(
    `${variant}: the scheduler pins start-time so no wrong clock is captured`,
    all.includes("start-time=startup"),
    "RouterOS captures the current system clock at add time when start-time is omitted",
  );
  check(
    `${variant}: the scheduler is removed and re-added, not add-if-missing`,
    all.includes("/system scheduler remove $existingHeartbeatSched"),
    "a device that got a bad entry would keep it forever",
  );
}

// The stored on-event copy and the pasted copy must be the same program.
// Having them drift is how the recurring copy ended up reporting nothing
// for every DHCP renewal after the first.
for (const [variant, opts] of VARIANTS) {
  const hb = heartbeatChunks(opts);
  const immediate = hb.find((c) => !c.label.includes("Scheduler"))?.script ?? "";
  const scheduler = hb.find((c) => c.label.includes("Scheduler"))?.script ?? "";
  const onEvent = scheduler.match(/on-event="((?:\\.|[^"\\])*)"/)?.[1] ?? "";
  // Undo exactly one level of RouterOS string escaping.
  const unescaped = onEvent.replace(/\\n/g, "\n").replace(/\\(.)/g, "$1");
  check(
    `${variant}: the scheduler's stored body is the immediate body, escaped once`,
    unescaped === immediate.trim(),
    "the two copies have drifted -- the recurring one is what runs for the router's whole life",
  );
}

// =====================================================================
// 5. THE GENERATOR'S OWN VALIDATOR STILL PASSES
// =====================================================================
// `validateSetupScriptChunks` already catches unbalanced brackets/quotes
// and, critically, a bare `$` inside an `on-event="..."` body -- RouterOS
// interpolates that at CREATION time, baking an empty value into the
// stored script forever. The heartbeat's on-event body is the one place
// in this file that can regress it.

console.log("\n-- the generator's own static validator --");

for (const [variant, opts] of VARIANTS) {
  const results = validateSetupScriptChunks(buildRouterSetupScriptChunks(opts));
  const errors = results.flatMap((r) =>
    r.issues.filter((i) => i.severity === "error").map((i) => `${r.label}: ${i.message}`),
  );
  check(`${variant}: zero validator errors`, errors.length === 0, errors.join(" | "));
  const warnings = results.flatMap((r) =>
    r.issues.filter((i) => i.severity === "warning").map((i) => `${r.label}: ${i.message}`),
  );
  check(`${variant}: zero validator warnings`, warnings.length === 0, warnings.join(" | "));
}

// =====================================================================
// 6. THE FIVE SILENT FAILURES
// =====================================================================
// Every defect below shipped, survived review, and produced NO error --
// which is precisely why each one survived. They share one shape: RouterOS
// reporting success for work it did not do. So each guard here asserts two
// separate things: that the CONDITION is handled at all, and that the
// operator is TOLD when it is not met. A fix that quietly does the right
// thing is only half of what was asked for -- the paste output has to say
// so, because the whole class of bug is "nothing said anything".

console.log("\n-- the five silent failures --");

/** The variant that turns on every optional subsystem, so portal, hotspot,
 * WireGuard and firewall chunks all exist to be inspected. */
const FULL = VARIANTS.find(([v]) => v === "every optional subsystem on")[1];
const fullChunks = buildRouterSetupScriptChunks(FULL);
const chunkByLabel = (chunks, needle) => chunks.filter((c) => c.label.includes(needle));
const allText = (chunks) => chunks.map((c) => c.script).join("\n");
const fullText = allText(fullChunks);

// ---------------------------------------------------------------------
// 1. The portal page path is DISCOVERED, and a miss is loud.
// ---------------------------------------------------------------------
// `flash/` is a per-model detail. `set [find ...]` against an empty match
// succeeds silently, so on a board without that prefix all five writes did
// nothing and the guest got MikroTik's stock blue login page.

const portalChunks = chunkByLabel(fullChunks, "Portal Redirect Page");

check(
  "portal: all five stock hotspot pages still get an override chunk",
  portalChunks.length === 5,
  `got ${portalChunks.length} -- a page stopped being overridden`,
);

check(
  "portal: no chunk hardcodes the flash/ path prefix anywhere",
  !allText(fullChunks).includes("flash/hotspot/"),
  "the model-specific prefix is back; on boards without it every /file set silently writes nothing",
);

for (const chunk of portalChunks) {
  const base = chunk.label.match(/\(([^)]+)\)/)[1];
  const s = chunk.script;
  check(
    `portal ${base}: the path is discovered with /file find, not assumed`,
    s.includes(`[/file find where name~"/${base}"]`),
    "no discovery -- the path is being assumed again",
  );
  check(
    `portal ${base}: the write is gated on a non-zero match count`,
    /:if \(\$pfHits > 0\) do=\{ \/file set \[find where name~"\/[a-z]+\.html"\] contents=/.test(s),
    "the /file set is unguarded, so an empty match writes nothing and reports success",
  );
  check(
    `portal ${base}: a miss prints a visible FAIL naming the consequence`,
    /:if \(\$pfHits = 0\) do=\{ :put "  FAIL -- portal page [a-z]+\.html: 0 files matched/.test(
      s,
    ) && s.includes("NOTHING WAS WRITTEN"),
    "a miss is silent -- the exact defect this replaces",
  );
  check(
    `portal ${base}: a hit reports the count it actually wrote`,
    s.includes(`:tostr $pfHits`) && s.includes("overwrote"),
    "success is asserted rather than counted",
  );
}

// The pattern's leading slash is the whole anti-collision argument, so it
// is proven rather than asserted. RouterOS's `~` is a regex substring
// match, modelled here exactly as such.
{
  const rosLike = (name, pattern) => new RegExp(pattern).test(name);
  check(
    "INJECTED: a bare-basename pattern WOULD swallow rlogin.html and alogin.html",
    rosLike("flash/hotspot/rlogin.html", "login.html") &&
      rosLike("flash/hotspot/alogin.html", "login.html"),
    "the collision this pattern defends against is not real -- re-check the reasoning",
  );
  check(
    "portal: the shipped /basename pattern does NOT collide with rlogin/alogin",
    !rosLike("flash/hotspot/rlogin.html", "/login.html") &&
      !rosLike("flash/hotspot/alogin.html", "/login.html"),
    "login.html's chunk would overwrite all three pages with login.html's content",
  );
  check(
    "portal: the pattern still matches BOTH directory layouts",
    rosLike("flash/hotspot/login.html", "/login.html") &&
      rosLike("hotspot/login.html", "/login.html"),
    "the discovery does not actually discover -- one of the two real layouts misses",
  );
}

// ---------------------------------------------------------------------
// 2. No local hotspot user (RouterOS checks local users BEFORE RADIUS).
// ---------------------------------------------------------------------

const hotspotChunk = chunkByLabel(fullChunks, "Hotspot")[0].script;

check(
  "hotspot: no chunk creates a local hotspot user, in any variant",
  !VARIANTS.some(([, o]) =>
    allText(buildRouterSetupScriptChunks(o)).includes("/ip hotspot user add"),
  ),
  "a local user is a complete portal bypass: no OTP, no session row, no consent, no data cap",
);

check(
  "hotspot: the account this generator used to create is actively removed",
  hotspotChunk.includes("/ip hotspot user remove [find where name="),
  "every already-provisioned router keeps its bypass account forever",
);

check(
  "hotspot: the removal reports how many accounts it removed",
  hotspotChunk.includes(":tostr $hsLocal") && hotspotChunk.includes("bypassed OTP"),
  "removal is silent, so nobody learns the router had a bypass",
);

check(
  "hotspot: any REMAINING local user is counted and called a bypass out loud",
  /:local hsLeft \[:len \[\/ip hotspot user find\]\]/.test(hotspotChunk) &&
    hotspotChunk.includes("checks local users BEFORE RADIUS") &&
    hotspotChunk.includes(":tostr $hsLeft"),
  "a hand-added second bypass account stays invisible",
);

// ---------------------------------------------------------------------
// 3. Something actually closes a session.
// ---------------------------------------------------------------------
// keepalive-timeout=none was set with no idle-timeout to replace it, so
// nothing ever reaped a session: slots stayed held, device counts only
// went up, RADIUS never saw an accounting Stop.

check(
  "hotspot: an idle-timeout is set on the default user profile",
  /idle-timeout=\d+[smh]/.test(hotspotChunk),
  "nothing closes a session -- a guest who left hours ago still holds a slot",
);

check(
  "hotspot: the idle-timeout is far enough from the 2m keepalive that caused the false-logout incident",
  (() => {
    const m = hotspotChunk.match(/idle-timeout=(\d+)([smh])/);
    if (!m) return false;
    const mins = m[2] === "h" ? +m[1] * 60 : m[2] === "m" ? +m[1] : +m[1] / 60;
    return mins >= 15 && mins <= 120;
  })(),
  "too short re-creates the false-logout bug under a new name; too long never frees the slot",
);

check(
  "hotspot: keepalive-timeout=none is still set (the false-logout fix is not undone)",
  hotspotChunk.includes("keepalive-timeout=none"),
  "re-enabling keepalive brings back the confirmed screen-lock logout incident",
);

check(
  "hotspot: every default-profile set is gated on the profile existing",
  !/\/ip hotspot user profile set \[find name="default"\]/.test(hotspotChunk) &&
    (
      hotspotChunk.match(
        /:if \(\[:len \[\/ip hotspot user profile find where name="default"\]\] > 0\) do=\{ \/ip hotspot user profile set/g,
      ) ?? []
    ).length === 3,
  "an unguarded `set` against an empty match succeeds silently -- the same trap as the portal /file set",
);

check(
  "hotspot: the applied profile values are read back and printed, not assumed",
  hotspotChunk.includes(":local hsProf") &&
    hotspotChunk.includes("/ip hotspot user profile get [find where name=") &&
    hotspotChunk.includes("FAIL -- no hotspot user profile named default"),
  "success is inferred from the absence of an error",
);

// ---------------------------------------------------------------------
// 4. The WAN check runs AFTER the router has a resolver.
// ---------------------------------------------------------------------
// The WAN DHCP client is added with use-peer-dns=no, so before `/ip dns
// set servers=` runs the router has no resolver from any source. Checking
// DNS first made a healthy router report FAIL every single time.

for (const [variant, opts] of VARIANTS) {
  const cs = buildRouterSetupScriptChunks(opts);
  const dnsIdx = cs.findIndex((c) => c.label === "LAN IP" || c.label === "LAN IP + DNS");
  const wanIdx = cs.findIndex((c) => c.label.startsWith("WAN Connectivity Check"));
  check(
    `${variant}: the WAN connectivity check comes AFTER DNS is configured`,
    dnsIdx !== -1 && wanIdx !== -1 && dnsIdx < wanIdx,
    `LAN-IP/DNS chunk at ${dnsIdx}, WAN check at ${wanIdx} -- checking DNS before configuring it ` +
      `makes a perfectly healthy router print FAIL, which trains people to ignore the check`,
  );
}

{
  const wanCheck = chunkByLabel(fullChunks, "WAN Connectivity Check")[0].script;
  // Asserting only that the count is PRINTED is not enough, and this
  // suite's own mutation pass proved it: pinning `dnsCount` at 0 while
  // leaving every `:put` in place still passed, and would have told the
  // operator "no resolver at all" on a router with working DNS servers --
  // a confidently wrong verdict, which is the exact failure shape this
  // whole section exists to end. So the value must be shown to come off
  // the DEVICE, not merely to be displayed.
  check(
    "wan check: the resolver count is read from the device, not just printed",
    wanCheck.includes(":local dnsCount") &&
      wanCheck.includes(":tostr $dnsCount") &&
      /:set dnsCount \[:len \[\/ip dns get servers\]\]/.test(wanCheck),
    "a bare DNS FAIL cannot distinguish 'no resolver set yet' from 'resolver is broken' -- " +
      "and a count that is never read from /ip dns reports 0 on a healthy router",
  );
  check(
    "wan check: zero resolvers is explained as a not-yet-pasted chunk, not a WAN fault",
    wanCheck.includes("$dnsCount = 0") && wanCheck.includes("The WAN itself may be perfectly fine"),
    "the technician is sent to debug a WAN that was never broken",
  );
  check(
    "wan check: a configured-but-unanswering resolver reads differently from none at all",
    wanCheck.includes("$dnsCount > 0") && wanCheck.includes("is not answering"),
    "the two opposite causes collapse into one message again",
  );
}

// ---------------------------------------------------------------------
// 5. One tunnel interface name, and it is the backend's.
// ---------------------------------------------------------------------
// Backend `network_config/renderers.py:672` declares
// WIREGUARD_INTERFACE_NAME = "wg-cloudguard" and ~14 tests pin it.
// `wg-cloudguest` exists nowhere in backend code.

{
  const wg = chunkByLabel(fullChunks, "WireGuard Tunnel")[0].script;

  check(
    "wireguard: the interface created matches the backend's authoritative name",
    wg.includes('/interface wireguard add name="wg-cloudguard"'),
    "a second, divergent tunnel interface -- the hub only ever talks to wg-cloudguard",
  );
  check(
    "wireguard: nothing is created or bound under the old wg-cloudguest name",
    !/(?:add name|interface|in-interface)="wg-cloudguest"/.test(fullText),
    "the two-interface state is back",
  );
  check(
    "wireguard: the peer and the tunnel address both bind to the same interface",
    wg.includes('/interface wireguard peers add interface="wg-cloudguard"') &&
      wg.includes('/ip address add address="10.20.0.5/24" interface="wg-cloudguard"'),
    "peer or address bound to a different interface than the one created",
  );
  check(
    "wireguard: the management accept rule binds to the authoritative name",
    wg.includes('in-interface="wg-cloudguard" action=accept comment="cloudguest-fw-allow-wg-mgmt"'),
    "the firewall rule is bound to the wrong tunnel, so the hub handshake is dropped",
  );
  // The add-guards only fire when the rule is ABSENT, so an already
  // provisioned router keeps a rule pointing at the dead interface.
  check(
    "wireguard: an EXISTING accept rule is repointed, not left on the dead interface",
    wg.includes(
      ':if ([:len $wgAllowRule] > 0) do={ /ip firewall filter set $wgAllowRule in-interface="wg-cloudguard" }',
    ),
    "every router provisioned before this fix keeps its rule bound to wg-cloudguest and never handshakes",
  );
  check(
    "wireguard: a surviving legacy interface is counted and reported, not silently doubled up",
    wg.includes(':local wgLegacy [:len [/interface wireguard find where name="wg-cloudguest"]]') &&
      wg.includes(":tostr $wgLegacy") &&
      wg.includes("TWO tunnels"),
    "the old interface stays on the device with nothing pointing it out",
  );
  check(
    "wireguard: the legacy interface is REPORTED rather than removed",
    !wg.includes('/interface wireguard remove [find where name="wg-cloudguest"]}') &&
      !/do=\{ \/interface wireguard remove/.test(wg),
    "removing the old tunnel can drop the operator's own management session mid-provision",
  );
  check(
    "wireguard: the final state is counted and given a PASS/FAIL, not assumed",
    wg.includes(":local wgIf") &&
      wg.includes(":local wgPeer") &&
      wg.includes(":local wgAddr") &&
      wg.includes("RESULT: FAIL -- a count above is 0"),
    "three add-if-missing guards in a row can all no-op and still look clean",
  );
}

// =====================================================================
// 7. THE CLOCK IS SET, EARLY, AND ITS FAILURE IS VISIBLE
// =====================================================================
// `grep -c "ntp client\|time-zone-name"` over the generator returned 0.
// The hEX has no battery-backed clock, so every fresh or power-cycled
// router boots with a wrong date, and a wrong date fails HTTPS certificate
// validation -- so the heartbeat's `/tool fetch` is rejected before it is
// sent, the router shows offline in Master console forever, and the guest
// WiFi works perfectly the whole time. That is the silent shape this
// project keeps producing, so the chunk does not merely CONFIGURE NTP: it
// checks that the clock actually ended up sane and prints a FAIL if not.
// Enabling NTP is not synchronising; plenty of venue firewalls pass ping
// and DNS and drop outbound UDP 123.

console.log("\n-- the clock is set, before anything speaks HTTPS --");

const clockChunkOf = (chunks) => chunks.find((c) => c.label.startsWith("Clock + NTP"));

for (const [variant, opts] of VARIANTS) {
  const chunks = buildRouterSetupScriptChunks(opts);
  const clock = clockChunkOf(chunks);
  check(
    `${variant}: emits a clock/NTP chunk at all`,
    !!clock,
    "the generator never sets the clock",
  );
  const s = clock?.script ?? "";

  check(
    `${variant}: sets the timezone explicitly, autodetect off`,
    s.includes("time-zone-name=Asia/Kolkata") && s.includes("time-zone-autodetect=no"),
    "a router left on autodetect resolves its zone over the network it may not have yet",
  );
  check(
    `${variant}: enables the NTP client against both runbook servers`,
    /\/system ntp client set enabled=yes/.test(s) &&
      s.includes("216.239.35.0") &&
      s.includes("162.159.200.1"),
    "NTP is never turned on, so the clock stays whatever the firmware booted with",
  );
  // The servers must be plain IPs. A `pool.ntp.org` here would need DNS,
  // and "internet fine, DNS broken" is a confirmed-live state on this
  // hardware (see the WireGuard chunk's own `:resolve` guard) -- an NTP
  // server that cannot be resolved is an NTP server that never syncs.
  check(
    `${variant}: every NTP server is a raw address, never a name needing DNS`,
    (() => {
      // Only real arguments -- the failure text names `servers=` and
      // `primary-ntp=` in prose, and matching those would make this pass
      // vacuously.
      const args = [...s.matchAll(/(?:servers|primary-ntp|secondary-ntp)=([^\s}")]+)/g)].flatMap(
        (m) => m[1].split(","),
      );
      return (
        args.length > 0 &&
        args.every((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a) && a.split(".").every((o) => +o <= 255))
      );
    })(),
    "an NTP server given by name cannot sync a router whose DNS is broken -- which is exactly " +
      "the router this chunk exists for",
  );

  // ORDER. The whole point of "add it early". The clock has to be right
  // BEFORE the only chunk in this generator that speaks HTTPS, or TLS
  // rejects the check-in and nothing anywhere says why.
  const clockIdx = chunks.findIndex((c) => c.label.startsWith("Clock + NTP"));
  // `/tool fetch url=` -- an actual invocation. The clock chunk's own
  // failure text NAMES `/tool fetch` in prose to explain the consequence,
  // and matching that would make this check compare the chunk to itself.
  const httpsIdxs = chunks
    .map((c, i) => (/\/tool fetch url=/.test(c.script) ? i : -1))
    .filter((i) => i >= 0);
  check(
    `${variant}: the clock chunk comes BEFORE every chunk that does HTTPS`,
    clockIdx >= 0 && httpsIdxs.length > 0 && httpsIdxs.every((i) => i > clockIdx),
    `clock at ${clockIdx}, /tool fetch at ${JSON.stringify(httpsIdxs)} -- a wrong clock fails ` +
      "certificate validation, so a heartbeat pasted first is rejected before it is even sent",
  );
  const wanCheckIdx = chunks.findIndex((c) => c.label.startsWith("WAN Connectivity Check"));
  check(
    `${variant}: ...and AFTER the WAN connectivity checkpoint`,
    wanCheckIdx >= 0 && clockIdx > wanCheckIdx,
    "NTP needs a working uplink; run earlier and it can only ever report a failure that says " +
      "nothing about the clock",
  );

  // VERIFICATION, not configuration. This is the half that makes the
  // failure visible instead of silent.
  check(
    `${variant}: reads the NTP client's own status and tests it for "synchronized"`,
    s.includes("/system ntp client get status") && s.includes('= "synchronized"'),
    "setting NTP is not syncing NTP -- without this the chunk reports success on a router whose " +
      "clock never moved",
  );
  check(
    `${variant}: every NTP status read is wrapped in :do {} on-error={}`,
    (() => {
      const reads = [...s.matchAll(/\[\/system ntp client get status\]/g)];
      return (
        reads.length > 0 &&
        reads.every((m) => {
          const before = s.slice(Math.max(0, m.index - 60), m.index);
          return /:do \{[^{}]*$/.test(before);
        })
      );
    })(),
    "not every RouterOS version exposes that property; an unguarded read aborts the rest of the " +
      "line, which on a `;`-joined line means the verdict never prints at all",
  );
  // Asserted on the VERDICT, not merely on the chunk containing the
  // words. An earlier version of this check only required
  // `/system clock get date` and a `$clkYear <|>= NNNN` to appear
  // somewhere, and a mutation that dropped the year from the PASS
  // condition while leaving it in the date-parsing ladder above went
  // undetected -- the chunk would then have parsed the year carefully and
  // then ignored it. Same hole, same shape, as the one section 3's
  // default-route check found by walking every occurrence instead of one.
  check(
    `${variant}: the PASS verdict requires BOTH the NTP status AND a sane date`,
    s.includes("/system clock get date") &&
      /:if \(\$clkStatus = "synchronized" && \$clkYear >= \d{4}\) do=\{ :set clkVerdict "PASS" \}/.test(
        s,
      ),
    "the status property is the primary signal but is not readable on every RouterOS, and the " +
      "date is the backstop -- a verdict computed from only one of them passes a router with an " +
      "unreadable status and a 1970 clock",
  );
  check(
    `${variant}: prints an explicit FAIL verdict, not just a status line`,
    /RESULT: FAIL/.test(s) && /RESULT: PASS/.test(s),
    "a chunk that prints the status and no verdict leaves the technician to decide whether " +
      '"using-local-clock" is bad -- this is the same manual checkpoint shape as the WAN check',
  );
  check(
    `${variant}: leaves a :log warning on the device when the clock is wrong`,
    /:log warning \("cloudguest-clock: NTP NOT synchronised/.test(s),
    "terminal output scrolls past; /log print is what remote support can read afterwards",
  );
  check(
    `${variant}: says WHY it matters in the failure output, not just that it failed`,
    /HTTPS certificate validation/.test(s) && /OFFLINE in Master console/.test(s),
    'a bare "FAIL" trains people to continue anyway; naming the consequence is what stops them',
  );
}

// The regression in its original form: the string the founder grepped for.
{
  const everyChunkEverywhere = VARIANTS.flatMap(([, opts]) =>
    buildRouterSetupScriptChunks(opts).map((c) => c.script),
  ).join("\n");
  check(
    "INJECTED: the original defect -- zero matches for `ntp client` / `time-zone-name` anywhere",
    /ntp client/.test(everyChunkEverywhere) && /time-zone-name/.test(everyChunkEverywhere),
    "this is the exact grep that returned 0 and started this work",
  );
}

// =====================================================================
// 8. A TUNNEL PEER IS NEVER BUILT AGAINST AN UNRESOLVED NAME
// =====================================================================
// RouterOS resolves `endpoint-address` ONCE, when the peer is created,
// and never again. If venue DNS is not working at that moment the peer is
// created pointing at nothing and NOTHING REPORTS IT -- the `add`
// succeeds and the tunnel simply never handshakes. Confirmed live
// (2026-08-22): `/tool fetch` returned `resolving error` while WAN, DHCP,
// gateway, default route and `/ip dns` servers were all healthy.

console.log("\n-- the wireguard peer's endpoint is verified, never assumed --");

const wgChunkFor = (wireguard) =>
  buildRouterSetupScriptChunks({ ...BASE, wans: [DHCP_WAN], wireguard }).find(
    (c) => c.label === "WireGuard Tunnel",
  )?.script ?? "";

const WG_CASES = [
  ["hostname, no fallback address (what ships today)", WG, false],
  [
    "hostname with a backend-supplied fallback",
    { ...WG, serverEndpointAddress: WG_FALLBACK_ADDR },
    true,
  ],
];

for (const [what, wireguard, hasFallback] of WG_CASES) {
  const s = wgChunkFor(wireguard);
  check(
    `${what}: verifies the hostname resolves ON THE DEVICE with :resolve`,
    s.includes(":resolve $wgHost"),
    "without this the peer is created against whatever the name did or did not resolve to, " +
      "with no signal either way",
  );
  check(
    `${what}: the :resolve is guarded -- it throws on failure`,
    /:do \{ :set wgDnsOk \(\[:len \[:resolve \$wgHost\]\] > 0\) \} on-error=\{ :set wgDnsOk false \}/.test(
      s,
    ),
    "an unguarded :resolve aborts the rest of the line, so the peer is never added AND nothing " +
      "is printed -- a worse version of the bug",
  );
  // The real guarantee: the `add` cannot run on an unresolved name.
  check(
    `${what}: every peer add is gated on the resolution result`,
    (() => {
      const adds = [...s.matchAll(/\/interface wireguard peers add/g)];
      return (
        adds.length > 0 &&
        adds.every((m) =>
          /:if \(\$wgGo = true && [^)]*\) do=\{ $/.test(s.slice(0, m.index).slice(-200)),
        )
      );
    })(),
    "an ungated add is the original bug: a peer pointing at nothing, created silently",
  );
  check(
    `${what}: the peer's endpoint-address is the checked variable, not a literal`,
    s.includes("endpoint-address=$wgEp") &&
      !s.includes(`endpoint-address="${WG.serverEndpointHost}"`),
    "a literal endpoint-address cannot express the fallback and cannot be checked first",
  );
  check(
    `${what}: leaves a comment on the peer saying which it holds and why`,
    s.includes("comment=$wgCmt") && s.includes("cloudguest-wg-hub:"),
    "a technician reading /interface wireguard peers print detail next week has no other way to " +
      "tell a name from a substituted address",
  );
  check(
    `${what}: says so loudly in the pasted output when DNS fails`,
    /\*\*\* WIREGUARD: DNS FAILED/.test(s) && /:log warning \("cloudguest-wg: /.test(s),
    "the whole failure mode is that nothing reports it",
  );
}

{
  // No fallback available: the correct behaviour is to build NOTHING.
  // A peer created now would point at nothing forever AND could never be
  // repaired by re-pasting, because the add-if-missing guard would find
  // it and skip. Creating nothing leaves that guard's `find` empty, so a
  // plain re-paste after DNS is fixed does the right thing.
  const s = wgChunkFor(WG);
  check(
    "no fallback address: the peer is REFUSED on DNS failure, not built against nothing",
    !s.includes(":set wgGo true"),
    "with no address to fall back to, creating the peer anyway produces an unrepairable router",
  );
  check(
    "no fallback address: the output explains that nothing was created, and why",
    /NO TUNNEL WAS BUILT/.test(s) && /NO PEER WAS/.test(s) && /re-paste THIS chunk/.test(s),
    "refusing silently is the same defect wearing a different hat",
  );
  check(
    "no fallback address: no address is invented in place of the missing one",
    !/endpoint-address="?\d{1,3}(\.\d{1,3}){3}/.test(s),
    "the generator must never type an address the backend did not give it",
  );
}
{
  const s = wgChunkFor({ ...WG, serverEndpointAddress: WG_FALLBACK_ADDR });
  check(
    "with a fallback address: it is used, and only on failure",
    s.includes(`:if ($wgDnsOk = false) do={ :set wgEp "${WG_FALLBACK_ADDR}" }`) &&
      s.includes(":set wgGo true"),
    "the founder's decision was hostname FIRST, address as the fallback -- not the other way round",
  );
  check(
    "with a fallback address: the peer comment records that it is a raw address, and what to do",
    /:set wgCmt "cloudguest-wg-hub: RAW ADDRESS [\d.]+ .*did NOT resolve/.test(s) &&
      /Remove this peer and re-paste/.test(s),
    "an address left on a peer with no explanation is how the next engineer inherits a mystery",
  );
}
{
  // `endpoint_host` is documented backend-side as "hostname OR IP".
  const s = wgChunkFor({ ...WG, serverEndpointHost: WG_LITERAL_HOST });
  check(
    "an endpoint host that is already an address skips the DNS dance entirely",
    !s.includes(":resolve") && s.includes(`endpoint-address="${WG_LITERAL_HOST}"`),
    "there is nothing to resolve and no fallback to choose; pretending otherwise is noise",
  );
  check(
    "...but still comments the peer, because 'why is this an address' is the same question",
    /comment="cloudguest-wg-hub: RAW ADDRESS/.test(s),
    "missing",
  );
}

// THE 64-ROUTER REGRESSION. `20.219.72.235` lived as a literal in code,
// got baked into `endpoint-address=` on 64 field routers, and when the
// hub's subscription died those routers became unreachable. They need
// physical visits. The backend guards its own source against this literal
// reappearing; this is the frontend half.
{
  const everything = [
    ...VARIANTS.flatMap(([, opts]) => buildRouterSetupScriptChunks(opts).map((c) => c.script)),
    wgChunkFor(WG),
    wgChunkFor({ ...WG, serverEndpointAddress: WG_FALLBACK_ADDR }),
  ].join("\n");
  check(
    `INJECTED: the dead hub address ${BANNED_HUB_LITERAL} appears in NO generated script`,
    !everything.includes(BANNED_HUB_LITERAL),
    "this exact literal is why 64 routers now need physical visits -- the hub's address must " +
      "come from the backend, never from this repo",
  );
}

// =====================================================================
// 9. THE PANEL'S "WHAT A RE-GENERATE BREAKS" TABLE IS TRUE
// =====================================================================
// Clicking Generate a second time rotates secrets server-side. Master
// console now says so, in a blocking dialog and a banner that does not
// disappear -- and, critically, says WHICH of them re-pasting the new
// script cannot repair. That claim is only worth making if it stays true,
// so it is asserted here against what the generator actually emits rather
// than against what someone believed when they wrote the sentence.

console.log("\n-- the re-generate warning matches what the chunks really do --");

// Named `REGEN_CHUNKS`, not `FULL`: section 6 already binds `FULL` at
// module scope to the *options* object for the every-subsystem-on variant.
// Two module-scope `const FULL`s is a SyntaxError, and the two are not
// interchangeable anyway -- that one is opts, this one is chunks.
const REGEN_CHUNKS = buildRouterSetupScriptChunks({
  ...BASE,
  wans: [DHCP_WAN],
  wireguard: WG,
  radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t" },
  apiAccess: { username: "cloudguest-api", secret: "pw" },
});
const scriptOf = (pred) =>
  REGEN_CHUNKS.filter(pred)
    .map((c) => c.script)
    .join("\n");
/** Just the `else={ ... }` bodies -- the UPDATE branches. Deliberately
 * not `doBodies`, which also returns every `do={}` (the ADD branches),
 * where `secret=`/`password=` legitimately appear on a first run. */
const elseBodies = (script) =>
  [...script.matchAll(/else=\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => m[1]);

{
  const wg = scriptOf((c) => c.label === "WireGuard Tunnel");
  check(
    "the WireGuard chunk really has NO update branch",
    !/else=/.test(wg),
    "if it grew one, SECRET_REPAIR.wireguard.repairableByRepaste must be flipped to true -- " +
      "the dialog and banner would otherwise be telling the operator a lie",
  );
  check(
    "...so the table says the WireGuard keypair is NOT repairable by re-pasting",
    SECRET_REPAIR.wireguard.repairableByRepaste === false,
    "the table disagrees with the chunk",
  );
  check(
    "...and says what to remove on the device instead",
    /wg-cloudguard/.test(SECRET_REPAIR.wireguard.why),
    'a "cannot be repaired" with no next step just moves the dead end',
  );
}
{
  const radius = scriptOf((c) => c.label === "RADIUS");
  check(
    "the RADIUS chunk's else-branch exists but never writes secret=",
    /else=\{/.test(radius) && elseBodies(radius).every((b) => !b.includes("secret=")),
    "if the else branch started setting the secret, re-pasting WOULD repair RADIUS and " +
      "SECRET_REPAIR.radius.repairableByRepaste must be flipped",
  );
  check(
    "...so the table says the RADIUS secret is NOT repairable by re-pasting",
    SECRET_REPAIR.radius.repairableByRepaste === false,
    "the table disagrees with the chunk",
  );
}
{
  const api = scriptOf((c) => c.label.startsWith("API Access"));
  check(
    "the API Access chunk DOES have a real password-update branch",
    /else=\{ \/user set \[find name="[^"]*"\] password=/.test(api),
    "without it, the table's claim that the API password is repairable is false",
  );
  check(
    "...so the table says the API password IS repairable by re-pasting",
    SECRET_REPAIR.api.repairableByRepaste === true,
    "the table disagrees with the chunk",
  );
}
{
  const hb = scriptOf((c) => c.label.startsWith("Heartbeat"));
  check(
    "the agent credential is carried inline by BOTH heartbeat chunks",
    (hb.match(/X-Agent-Credential: cred-abc123/g) ?? []).length === 2,
    "if only one copy carried it, re-pasting would leave the other stale and the table's " +
      '"repairable" claim would be half true, which is worse than false',
  );
  check(
    "the heartbeat scheduler is removed and re-added, so a re-paste overwrites it",
    hb.includes("/system scheduler remove $existingHeartbeatSched"),
    "an add-if-missing scheduler would keep the OLD credential forever",
  );
  check(
    "...so the table says the agent credential IS repairable by re-pasting",
    SECRET_REPAIR.agent.repairableByRepaste === true,
    "the table disagrees with the chunk",
  );
  check(
    "...and names the two chunks to re-paste",
    /Heartbeat Scheduler/.test(SECRET_REPAIR.agent.why),
    'a "just re-paste it" that does not say which piece is a guess dressed as advice',
  );
}
check(
  "the agent credential rotates on EVERY generate, whatever the toggles say",
  [
    { enableWireguard: false, enableRadius: false, mintApiSecret: false },
    { enableWireguard: true, enableRadius: true, mintApiSecret: true },
  ].every((o) => rotatingSecrets(o).includes("agent")),
  "both branches of onGenerate's credential block mint a fresh plaintext -- if this were ever " +
    "conditional the dialog would under-report what it is about to break",
);
check(
  "an optional subsystem that is switched off is not claimed to rotate",
  JSON.stringify(
    rotatingSecrets({ enableWireguard: false, enableRadius: false, mintApiSecret: false }),
  ) === JSON.stringify(["agent"]),
  "over-reporting trains people to click through the dialog, which is how it stops working",
);
check(
  "every secret the table calls unrepairable explains what to remove first",
  Object.values(SECRET_REPAIR)
    .filter((v) => !v.repairableByRepaste)
    .every((v) => v.why.length > 40 && /remove|delete/i.test(v.why)),
  "an unrepairable secret with no recovery instruction is a dead end, not a warning",
);

// =====================================================================
// 10. THE ROUTER THAT CAME UP WITH NO DEFAULT CONFIGURATION
// =====================================================================
// A MikroTik hardware reset produces one of TWO states depending on how
// long the button is held. Every chunk this generator emits has only ever
// been run against the first:
//
//   WITH defaults -- `bridgeLocal`/`bridge` exists with ether2..5 in it, a
//     DHCP client sits on ether1, the defconf firewall rules are present,
//     and -- the one that turned out to matter -- MikroTik's own defconf
//     has already run `/interface list member add interface=ether1
//     list=WAN`.
//   WITHOUT defaults -- none of that. No bridge, no lists, no DHCP client,
//     no firewall rules, every interface bare.
//
// The whole failure class here is the same one this suite exists for:
// on RouterOS, `set [find ...]` against an EMPTY match SUCCEEDS -- no
// output, no error, no trace -- and `:foreach` over an empty `find`
// iterates zero times and exits clean. A chunk can therefore run
// perfectly on a bare router and configure nothing, and the only honest
// evidence of which happened is a number the chunk prints itself.
//
// Section 10 asserts two different things, and they are not the same
// thing: that the ONE real defect found (10.1) stays fixed, and that
// every chunk which creates or mutates a defconf-provided object now
// COUNTS what it did (10.2 - 10.7).

console.log("\n-- the router that came up with no default configuration --");

/** Chunks for a PPPoE WAN with every LAN-side subsystem on -- the variant
 * the bare-router L2 hole lives in. */
const BARE_PPPOE = buildRouterSetupScriptChunks({
  ...BASE,
  wans: [PPPOE_WAN],
  wireguard: WG,
  radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t" },
  portalUrl: PORTAL,
});
const bareChunk = (chunks, needle) => {
  const hit = chunks.filter((c) => c.label.includes(needle));
  return hit.map((c) => c.script).join("\n");
};

// ---------------------------------------------------------------------
// 10.1 THE PPPoE PARENT PORT WAS SWEPT INTO THE GUEST BRIDGE.
// ---------------------------------------------------------------------
// The only behavioural defect in this section, and it is a WAN/LAN L2
// hole, not a reporting gap.
//
// For a PPPoE WAN this generator deliberately puts only the VIRTUAL
// `cloudguest-pppoe-wan<N>` interface into the "WAN" interface list --
// "WAN + Bridge" cannot add a list member for an interface that does not
// exist yet. So the PHYSICAL port carrying the session is not in the WAN
// list, and the LAN sweep's "is this a WAN port" test says no.
//
// With defaults, defconf's own `ether1 -> WAN` membership covered for
// that. Without defaults nothing does, and the sweep bridges the live
// uplink port into the guest LAN. Silently: bridging a port is legal and
// RouterOS has no opinion about it.

{
  const lanPorts = bareChunk(BARE_PPPOE, "LAN Ports");
  const PPPOE_EXCLUSION = `[:len [/interface pppoe-client find where interface=[/interface ethernet get $eth name]]] = 0`;

  check(
    "bare router: the LAN sweep excludes any port carrying a pppoe-client",
    lanPorts.includes(PPPOE_EXCLUSION),
    "a PPPoE WAN's physical port is not in the 'WAN' interface list (only its virtual " +
      "interface is), so without this live-state test the sweep bridges the uplink into the " +
      "guest LAN on any router whose defconf 'ether1 -> WAN' membership is absent",
  );

  check(
    "bare router: BOTH sweep passes apply the exclusion, not just one",
    (lanPorts.match(/\/interface pppoe-client find where interface=/g) ?? []).length >= 2,
    "the detach pass and the attach pass must agree on what is eligible -- if only the attach " +
      "pass excludes the uplink, the detach pass still rips it out of whatever bridge holds it",
  );

  check(
    "bare router: the exclusion is live state, not a second hardcoded copy of the WAN names",
    !/pppoe-client find where interface="ether1"/.test(lanPorts),
    "a hardcoded name drifts from the device the moment an interface is renamed -- the same " +
      "duplication WAN_RENAME_WARNING_HEADER exists because of",
  );

  // MODELLED, NOT ASSERTED. The eligibility test is a boolean over device
  // state, so the hole is reproduced here as that boolean rather than
  // described in a comment. `wanList` is what each reset state actually
  // leaves behind.
  const eligibleUnderShippedRule = (port, wanList, pppoeParents) =>
    !wanList.includes(port) && !pppoeParents.includes(port);
  const eligibleUnderOldRule = (port, wanList) => !wanList.includes(port);

  check(
    "INJECTED: with defaults, defconf's own ether1->WAN membership hid the hole",
    eligibleUnderOldRule("ether1", ["ether1", "cloudguest-pppoe-wan1"]) === false,
    "if the old rule already rejected ether1 here, the defect story is wrong -- re-check it",
  );
  check(
    "INJECTED: with NO defaults, the old rule swept the live PPPoE uplink into the guest bridge",
    eligibleUnderOldRule("ether1", ["cloudguest-pppoe-wan1"]) === true,
    "the bare-router hole this fix exists for is not reproducible -- re-check the reasoning " +
      "before trusting the fix",
  );
  check(
    "bare router: the shipped rule rejects the PPPoE parent port in BOTH reset states",
    eligibleUnderShippedRule("ether1", ["ether1", "cloudguest-pppoe-wan1"], ["ether1"]) === false &&
      eligibleUnderShippedRule("ether1", ["cloudguest-pppoe-wan1"], ["ether1"]) === false,
    "the fix does not actually close the hole",
  );
  check(
    "...and still admits an ordinary LAN port, so the fix is not just 'reject everything'",
    eligibleUnderShippedRule("ether3", ["cloudguest-pppoe-wan1"], ["ether1"]) === true,
    "an over-strict rule that bridges nothing is a worse bug than the one being fixed",
  );
}

// ---------------------------------------------------------------------
// 10.2 - 10.7 NEVER INFER SUCCESS FROM THE ABSENCE OF AN ERROR.
// ---------------------------------------------------------------------
// Each chunk below creates or mutates something a default configuration
// would have provided. On a bare router each is doing that work for the
// first time, and every one of them used to be silent about the outcome.
// Each now binds a count and prints it, with a FAIL branch that names the
// consequence -- the same shape section 6 already requires of the portal
// pages and section 8 of the tunnel.

/** A chunk reports honestly when it (a) reads a count off the device,
 * (b) prints that count, and (c) has a branch for the zero case that says
 * something, rather than leaving zero indistinguishable from success.
 *
 * Two legal spellings of that zero branch, both already in this file: an
 * explicit `:if ($n = 0) do={ ... }`, and -- where several counts share
 * one verdict -- the negated all-positive form
 * `:if (!($a > 0 && $n > 0)) do={ ... }` the WireGuard chunk established.
 * Accepting only the first would ban the second, which is how a guard
 * gets loosened by the next person instead of obeyed. */
const reportsACount = (script, localName) => ({
  binds: new RegExp(`:local ${localName} \\[:len \\[/`).test(script),
  prints: script.includes(`[:tostr $${localName}]`),
  hasZeroBranch:
    new RegExp(`\\$${localName}[^;]*=\\s*0\\)\\s*do=\\{`).test(script) ||
    new RegExp(`:if \\(!\\([^;]*\\$${localName} > 0[^;]*\\)\\)\\s*do=\\{`).test(script),
});

const COUNTED = [
  [
    "WAN + Bridge counts the interface list and the bridge it creates",
    bareChunk(BARE_PPPOE, "WAN + Bridge"),
    "lanBrN",
    "every later chunk binds to this bridge by name; a find that matches nothing is silent",
  ],
  [
    "the stale-defconf cleanup says whether it removed anything",
    bareChunk(BARE_PPPOE, "Stale Factory-Default DHCP Client"),
    "staleDefconfN",
    "an empty :foreach is a clean no-op -- indistinguishable from having cleared the fault",
  ],
  [
    "LAN Ports counts what actually ended up in the guest bridge",
    bareChunk(BARE_PPPOE, "LAN Ports"),
    "lanPortsN",
    "a bridge with no port in it carries the LAN address, DHCP and hotspot and serves nobody",
  ],
  [
    "the Hotspot chunk counts the five objects it creates",
    bareChunk(BARE_PPPOE, "Hotspot"),
    "hsProf1",
    "the unconditional `set [find name=hsprof1]` lines succeed against an empty match",
  ],
  [
    "the certificate chunk counts what its three set [find] lines target",
    bareChunk(BARE_PPPOE, "Self-Signed HTTPS Certificate"),
    "ctLeaf",
    "three `set [find ...]` lines that cannot fail is the trap, not the reassurance",
  ],
  [
    "the RADIUS chunk reads hsprof1 back after wiring use-radius into it",
    bareChunk(BARE_PPPOE, "RADIUS"),
    "rdProf",
    "a /radius entry plus a hotspot that never asks it anything fails every guest login",
  ],
];

for (const [what, script, localName, why] of COUNTED) {
  const r = reportsACount(script, localName);
  check(`bare router: ${what}`, r.binds, `no :local ${localName} read off the device -- ${why}`);
  check(
    `bare router: ...and $${localName} is PRINTED, not just read`,
    r.prints,
    `$${localName} is never rendered into the paste output, so the operator sees nothing`,
  );
  check(
    `bare router: ...and a zero $${localName} takes a branch that says so`,
    r.hasZeroBranch,
    `zero is silently indistinguishable from success -- ${why}`,
  );
}

// The zero branches have to say something USEFUL, not just exist. Same
// requirement section 6 puts on the portal pages: a fix that quietly does
// the right thing is half of what was asked for.
for (const [what, script] of [
  ["LAN Ports", bareChunk(BARE_PPPOE, "LAN Ports")],
  ["Hotspot", bareChunk(BARE_PPPOE, "Hotspot")],
  ["WAN + Bridge", bareChunk(BARE_PPPOE, "WAN + Bridge")],
  ["Self-Signed HTTPS Certificate", bareChunk(BARE_PPPOE, "Self-Signed HTTPS Certificate")],
  ["RADIUS", bareChunk(BARE_PPPOE, "RADIUS")],
]) {
  check(
    `bare router: ${what}'s failure output names the consequence and logs it`,
    /:put "  (RESULT: )?FAIL/.test(script) && /:log warning "cloudguest[^"]{30,}/.test(script),
    "a FAIL with no consequence and no log line scrolls past in a terminal and is gone",
  );
}

check(
  "bare router: LAN Ports names the ports it bridged, not just how many",
  bareChunk(BARE_PPPOE, "LAN Ports").includes(
    `:foreach lanP in=[/interface bridge port find where bridge=`,
  ),
  "ether2..ether5 is an hEX detail, not a rule -- on an unfamiliar board a bare count would " +
    "look identical whether the sweep picked the right ports or the wrong ones",
);

// The zero case in this chunk specifically is the EXPECTED case on a bare
// router, so it has to read as an outcome ("0 found, nothing removed"),
// not as an absence. A generic "has a zero branch" test passes on a chunk
// whose zero branch says something vague; this pins the number.
check(
  "bare router: the stale-defconf cleanup's zero branch states the count, not just a sentence",
  /:if \(\$staleDefconfN = 0\) do=\{ :put "[^"]*\b0\b[^"]*" \}/.test(
    bareChunk(BARE_PPPOE, "Stale Factory-Default DHCP Client"),
  ),
  "on a bare router this is the normal outcome, and 'nothing was said' is exactly how the " +
    "operator concludes the duplicate-address fault was cleared when it was never there",
);

check(
  "bare router: the stale-defconf cleanup still actually removes the client it counts",
  /:foreach staleDefconfClient in=\[\/ip dhcp-client find where interface="bridgeLocal"\] do=\{ \/ip dhcp-client remove \$staleDefconfClient \}/.test(
    bareChunk(BARE_PPPOE, "Stale Factory-Default DHCP Client"),
  ),
  "counting is an addition to the removal, not a replacement for it -- the duplicate-address " +
    "fault on bridgeLocal is a confirmed live incident",
);

// ---------------------------------------------------------------------
// 10.8 NOTHING IS POSITIONED AGAINST A RULE ONLY DEFCONF PROVIDES.
// ---------------------------------------------------------------------
// `place-before=` against a rule that does not exist is the exact syntax
// error that once put the WireGuard accept rule BELOW the WAN drop rule on
// a real router. A bare router has no defconf firewall rules at all, so
// any `place-before` whose target is assumed rather than counted is that
// bug waiting for the second reset state.

{
  /** ONE predicate, used by the sweep AND by the self-checks below. It was
   * duplicated at first, and a mutation of the sweep's copy then went
   * uncaught because the self-check was still testing its own private
   * copy -- exactly the "guard that cannot be shown to fail" this section
   * is supposed to rule out. Shared, so mutating it breaks both. */
  const placeBeforeOk = (line, target) =>
    target.startsWith("$") &&
    new RegExp(`:local ${target.slice(1)} \\[/`).test(line) &&
    new RegExp(`\\[:len \\${target}\\]\\s*>\\s*0`).test(line);

  const offenders = [];
  for (const [label, script] of pasteables) {
    script.split("\n").forEach((line, n) => {
      for (const m of line.matchAll(/place-before=(\S+)/g)) {
        if (!placeBeforeOk(line, m[1]))
          offenders.push(`${label}, line ${n + 1}: place-before=${m[1]}`);
      }
    });
  }
  check(
    "bare router: every place-before targets a variable bound on the same line AND guarded non-empty",
    offenders.length === 0,
    `${offenders.length} unguarded place-before target(s). On a router with no defconf firewall ` +
      `the target find is empty, and place-before against an empty match is the syntax error ` +
      `that landed the WireGuard accept rule below the drop rule on "gurugram".\n      ` +
      offenders.join("\n      "),
  );
  check(
    "INJECTED: the place-before guard rejects a literal defconf-rule target",
    !placeBeforeOk(
      `/ip firewall filter add action=accept place-before=[/ip firewall filter find where comment="defconf: drop all not coming from LAN"]`,
      `[/ip`,
    ),
    "the guard accepts the exact shape it exists to ban",
  );
  check(
    "INJECTED: ...and rejects a variable that is bound but never length-checked",
    !placeBeforeOk(
      `:local wanDropRule [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]; /ip firewall filter add action=accept place-before=$wanDropRule`,
      `$wanDropRule`,
    ),
    "binding the target is not the same as knowing it matched something -- an empty match is " +
      "precisely the case place-before cannot survive",
  );
  check(
    "...and ACCEPTS the shipped shape, so the guard is not simply banning place-before",
    placeBeforeOk(
      `:local wanDropRule [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]; :if ([:len $wgAllowRule] = 0 && [:len $wanDropRule] > 0) do={ /ip firewall filter add action=accept place-before=$wanDropRule }`,
      `$wanDropRule`,
    ),
    "the guard bans the correct, shipped form -- which is how a guard gets deleted",
  );
}

check(
  "bare router: the WireGuard chunk still has a no-target branch that plain-adds the rule",
  /:if \(\[:len \$wgAllowRule\] = 0 && \[:len \$wanDropRule\] = 0\) do=\{ \/ip firewall filter add [^}]*\}/.test(
    bareChunk(BARE_PPPOE, "WireGuard Tunnel"),
  ),
  "without this branch a bare router (or one where the Firewall chunk was pasted second) gets " +
    "NO management accept rule at all instead of one in the wrong place",
);

// ---------------------------------------------------------------------
// 10.9 EVERY OBJECT A DEFAULT CONFIG WOULD HAVE PROVIDED IS CREATED, NOT
//      ASSUMED.
// ---------------------------------------------------------------------
// An `add` with no existence test in front of it errors on the second
// paste; an object that is only ever `set` and never `add`ed does nothing
// at all on the first paste against a bare router. Every `add` this
// generator emits must therefore carry an existence test on its own
// entered line -- the console runs each line as its own program, so a
// guard on a different line is not a guard.

{
  /** `/system scheduler add` is deliberately unconditional: the line above
   * it removes the existing entry first, because existence alone does not
   * mean the entry is healthy (see that chunk's own comment). */
  const INTENTIONALLY_UNGUARDED = [/\/system scheduler add /];
  /** Shared by the sweep and by both self-checks, for the same reason the
   * place-before predicate above is: a self-check that keeps its own copy
   * of the regex cannot see the sweep's copy being mutated, and a mutation
   * of the sweep therefore passes. Verified: mutating either of these two
   * now turns the self-checks red. */
  const IS_ADD_LINE = (line) => /(?:^|[{;\s])\/[a-z][a-z0-9 /-]* add /.test(line);
  const HAS_EXISTENCE_TEST = (line) => /\]\s*=\s*0/.test(line);

  const offenders = [];
  for (const [label, script] of pasteables) {
    script.split("\n").forEach((line, n) => {
      if (line.trimStart().startsWith("#")) return;
      if (!IS_ADD_LINE(line)) return;
      if (INTENTIONALLY_UNGUARDED.some((re) => re.test(line))) return;
      if (HAS_EXISTENCE_TEST(line)) return;
      offenders.push(`${label}, line ${n + 1}: ${line.slice(0, 110)}`);
    });
  }
  check(
    "bare router: every emitted `add` carries an existence test on its own entered line",
    offenders.length === 0,
    `${offenders.length} unguarded add(s). On a bare router the object does not exist and on a ` +
      `re-paste it does, so an add with no [:len [find ...]] = 0 test is broken in one of the ` +
      `two directions whichever way you look at it.\n      ` +
      offenders.slice(0, 10).join("\n      "),
  );
  check(
    "INJECTED: that guard actually recognises an unguarded add",
    IS_ADD_LINE(`/interface bridge add name="bridge-guest"`) &&
      !HAS_EXISTENCE_TEST(`/interface bridge add name="bridge-guest"`),
    "the add-detection regex does not match a bare add, so the guard cannot fire at all",
  );
  check(
    "INJECTED: ...and does NOT fire on the guarded form it exists to require",
    IS_ADD_LINE(
      `:if ([:len [/interface bridge find where name="bridge-guest"]] = 0) do={ /interface bridge add name="bridge-guest" }`,
    ) &&
      HAS_EXISTENCE_TEST(
        `:if ([:len [/interface bridge find where name="bridge-guest"]] = 0) do={ /interface bridge add name="bridge-guest" }`,
      ),
    "the guard bans the very shape it is asking for, which is how a guard gets switched off",
  );
}

// The `bridgeLocal` literal is a defconf artifact name. It is legitimate
// in the cleanup chunk (that chunk's entire job is to look for it) and
// nowhere else -- any other chunk matching on it would silently match
// nothing on a bare router while looking like it worked.
{
  const elsewhere = BARE_PPPOE.filter(
    (c) => c.script.includes("bridgeLocal") && !c.label.includes("Stale Factory-Default"),
  ).map((c) => c.label);
  check(
    "bare router: no chunk except the cleanup one matches on the defconf `bridgeLocal` name",
    elsewhere.length === 0,
    `${elsewhere.join(", ")} depend(s) on a name a bare router never had`,
  );
  check(
    "bare router: no chunk matches on RouterOS's own `defconf` comment either",
    !BARE_PPPOE.some((c) => /comment[=~]"?defconf/.test(c.script)),
    "defconf-commented rules do not exist on a router reset with no default configuration, so " +
      "any find keyed on them is empty and every set against it succeeds while doing nothing",
  );
}

// =====================================================================
// 11. RouterOS SYNTAX QA OVER EVERY EMITTED LINE
// =====================================================================
// A full-script QA pass over the advanced module, prompted by a live
// failure: the founder pasted the "WAN Routing" chunk into a real hEX and
// the console answered with nothing but `error`.
//
// THE DEFECT. A concatenation passed as a command ARGUMENT must be
// wrapped in parentheses on RouterOS. This shipped:
//
//   :log warning "cloudguest: WAN1 gateway ... (still \"" . $wan1Gw . "\") ..."
//
// The console parses `:log warning "<string>"` as a complete command and
// then meets `. $wan1Gw . "..."` as a second, meaningless command inside
// the same statement. That is a hard syntax error, and because this
// generator `;`-joins a whole chunk onto ONE entered line, the error
// aborts the ENTIRE line: the DHCP gateway poll, the plain default route,
// and every routing-mark'd route below it never ran. The router was left
// with no default route at all -- the precise "no gateway-health signal"
// state the chunk exists to prevent, reached by a syntax error rather
// than a logic error.
//
// Neither existing guard could see it. It is not a variable crossing a
// line (section 1) and not a multi-statement body (section 2); the
// `do={}` here holds exactly one statement. It is malformed ARGUMENT
// syntax, a third thing.
//
// It was the ONLY unparenthesised concatenation in the generator -- every
// other one already had parens. One site, missed once. So it is swept for
// now instead of being left to review, along with three other whole-script
// properties the same QA pass measured.

console.log("\n-- RouterOS syntax QA over every emitted line --");

/** Strips double-quoted string contents from a line, so a `.`, `/` or
 * `;` that is only ever text inside a `:put` message is never mistaken
 * for syntax. Same skip-strings discipline as `doBodies`. */
const stripStrings = (line) => {
  let out = "";
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += '""';
      continue;
    }
    out += c;
  }
  return out;
};

// ---------------------------------------------------------------------
// 11.1 A CONCATENATION IS AN EXPRESSION, AND AN ARGUMENT MUST BE WRAPPED.
// ---------------------------------------------------------------------

/** Command arguments that concatenate, and whether they are parenthesised.
 * Deliberately runs against the RAW line, not the stripped one: the
 * argument text itself is what has to be inspected. The `.` test uses
 * surrounding spaces, which is how this generator always spells
 * concatenation and which cannot collide with a dotted IP or a filename. */
const CONCAT_ARG = /(:put|:log\s+(?:info|warning|error)|:error)\s+([^;}]+)/g;
const concatOffenders = (script) => {
  const bad = [];
  for (const line of script.split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    for (const m of line.matchAll(CONCAT_ARG)) {
      const arg = m[2].trim();
      if (!/\s\.\s/.test(stripStrings(arg))) continue;
      if (arg.startsWith("(")) continue;
      bad.push(`${m[1]} ${arg.slice(0, 120)}`);
    }
  }
  return bad;
};

{
  const offenders = [];
  for (const [label, script] of pasteables) {
    for (const o of concatOffenders(script)) offenders.push(`${label}: ${o}`);
  }
  check(
    "QA: every concatenated command argument is parenthesised",
    offenders.length === 0,
    `${offenders.length} unparenthesised concatenation(s). RouterOS parses the command as ` +
      `complete at the end of the first string and then chokes on the trailing ". $var .", ` +
      `which aborts the WHOLE ;-joined line -- confirmed live on the founder's hEX, where it ` +
      `left the router with no default route.\n      ` +
      offenders.slice(0, 8).join("\n      "),
  );
}

// The guard is pointed at the exact text that failed on the device, and
// at the corrected form, so it cannot quietly stop being able to tell
// them apart.
check(
  "INJECTED: the guard fires on the exact line that errored on the hEX",
  concatOffenders(
    `:if (!($wan1Gw != "" && $wan1Gw != "0.0.0.0")) do={ :log warning "cloudguest: WAN1 gateway did not resolve (still \\"" . $wan1Gw . "\\") -- no default route added for this WAN; re-paste this chunk once the link is up" }`,
  ).length === 1,
  "the guard is blind to the shape it was written for",
);
check(
  "...and does NOT fire on the parenthesised form that replaced it",
  concatOffenders(
    `:if (!($wan1Gw != "" && $wan1Gw != "0.0.0.0")) do={ :log warning ("cloudguest: WAN1 gateway did not resolve (still \\"" . $wan1Gw . "\\") -- no default route added for this WAN; re-paste this chunk once the link is up") }`,
  ).length === 0,
  "the guard bans the fix, which is how a guard gets switched off",
);
check(
  "...and does NOT fire on a plain string argument with no concatenation",
  concatOffenders(`:if ($lanPortsN = 0) do={ :put "  RESULT: FAIL -- NOTHING is bridged in." }`)
    .length === 0,
  "over-strict: an ordinary literal message is reported as an offender",
);
// ANTI-OVER-STRICTNESS, and it has to use a message that really does
// contain a space-dot-space, or it proves nothing: the first version of
// this check used "print. Then", which has no leading space and so passed
// even with string-skipping switched off. A guard that cannot be shown to
// fail is not a guard, and that applies to the self-checks too.
check(
  "...and is not fooled by a space-dot-space that is only ever text inside a message",
  concatOffenders(`:put "  Pool ranges read as 10.5.50.10 . 10.5.50.254 in some MikroTik docs."`)
    .length === 0,
  "the guard reads a literal message as a concatenation, so it would ban ordinary output text",
);

// ---------------------------------------------------------------------
// 11.2 EVERY COMMAND PATH IS A REAL RouterOS MENU.
// ---------------------------------------------------------------------
// `/ip pppoe-client` does not exist -- it is `/interface pppoe-client`.
// A path typo is invisible to every other guard here and produces either
// a syntax error or, on a `find`, an empty match that every `set` then
// succeeds against silently. The allowlist is the set this generator
// touches today; adding a menu is a deliberate edit to this list, not
// something that slips in.

const KNOWN_MENUS = new Set([
  "/certificate",
  "/file",
  "/interface",
  "/interface bridge",
  "/interface bridge port",
  "/interface ethernet",
  "/interface list",
  "/interface list member",
  "/interface pppoe-client",
  "/interface wireguard",
  "/interface wireguard peers",
  "/ip address",
  "/ip arp",
  "/ip dhcp-client",
  "/ip dhcp-server",
  "/ip dhcp-server network",
  "/ip dns",
  "/ip dns static",
  "/ip firewall address-list",
  "/ip firewall filter",
  "/ip firewall mangle",
  "/ip firewall nat",
  "/ip hotspot",
  "/ip hotspot profile",
  "/ip hotspot user",
  "/ip hotspot user profile",
  "/ip hotspot walled-garden",
  "/ip hotspot walled-garden ip",
  "/ip pool",
  "/ip route",
  "/ip service",
  "/radius",
  "/system clock",
  "/system identity",
  "/system ntp client",
  "/system scheduler",
  "/tool",
  "/user",
]);

const MENU_VERB =
  /(\/[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*?)\s+(add|set|remove|find|get|print|monitor|sign|move|fetch|enable|disable|export)\b/g;
const menusIn = (script) => {
  const found = new Set();
  for (const line of script.split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    for (const m of stripStrings(line).matchAll(MENU_VERB)) found.add(m[1]);
  }
  return found;
};

/** ONE predicate for "paths this script uses that are not known menus",
 * shared by the sweep and by its own self-checks. Kept shared on purpose:
 * an earlier version had the sweep accumulate offenders inline while the
 * self-check re-derived the answer its own way, so mutating the sweep
 * changed nothing the self-check could see. Two guards in this file had
 * already been caught by exactly that. */
const unknownMenusIn = (script) => [...menusIn(script)].filter((m) => !KNOWN_MENUS.has(m));

{
  const unknown = new Map();
  for (const [label, script] of pasteables) {
    for (const menu of unknownMenusIn(script)) unknown.set(menu, label);
  }
  check(
    "QA: every command path is a known RouterOS menu",
    unknown.size === 0,
    `${unknown.size} unrecognised path(s): ` +
      [...unknown].map(([m, l]) => `${m} (${l})`).join(", ") +
      `. Either it is a typo -- /ip pppoe-client for /interface pppoe-client is the shape to ` +
      `watch, and on a find it silently matches nothing forever -- or it is a real new menu, ` +
      `in which case add it to KNOWN_MENUS deliberately.`,
  );
  check(
    "INJECTED: the menu guard catches the /ip pppoe-client typo",
    unknownMenusIn(
      `:if ([:len [/ip pppoe-client find where interface="ether1"]] = 0) do={ :put "x" }`,
    ).length === 1,
    "the guard cannot see a wrong menu path, so it protects nothing",
  );
  check(
    "...and passes the real /interface pppoe-client path",
    unknownMenusIn(
      `:if ([:len [/interface pppoe-client find where interface="ether1"]] = 0) do={ :put "x" }`,
    ).length === 0,
    "the guard rejects a correct path",
  );
  check(
    "QA: the allowlist has no dead entries left behind by a removed chunk",
    [...KNOWN_MENUS].every((m) => pasteables.some(([, s]) => menusIn(s).has(m))),
    "a menu in the list that nothing emits means a chunk was deleted and the list was not " +
      "updated -- the list stops describing the script and starts being decoration",
  );
}

// ---------------------------------------------------------------------
// 11.3 THE PASTE STAYS INSIDE WHAT WinBox HAS SURVIVED.
// ---------------------------------------------------------------------
// This file's entire chunking discipline exists because WinBox's terminal
// was confirmed live to drop/mangle characters on a very long paste. The
// longest line this generator emits is the WAN Routing chunk's, at ~3.1KB
// -- and that is the chunk that just failed on the founder's router. The
// failure was the parens, not the length, but a budget that nothing
// measures is a budget that grows until it is the length.

const MAX_LINE = 3300;
{
  const longest = pasteables
    .flatMap(([label, s]) => s.split("\n").map((l) => [l.length, label]))
    .sort((a, b) => b[0] - a[0])[0];
  check(
    `QA: no emitted line exceeds ${MAX_LINE} chars (longest is ${longest[0]})`,
    longest[0] <= MAX_LINE,
    `${longest[1]} emits a ${longest[0]}-char line. WinBox's terminal mangles long pastes -- ` +
      `that is why this generator chunks at all. Split the chunk rather than raising this.`,
  );
}

// ---------------------------------------------------------------------
// 11.4 A CHUNK MAY NOT SILENTLY FREEZE THE TERMINAL.
// ---------------------------------------------------------------------
// The DHCP gateway poll and the NTP poll both block the console on
// purpose -- `/import` never pauses, and waiting is the whole fix for the
// lease-not-bound-yet defect. But a technician staring at a frozen
// terminal with no output decides it has hung and reboots. Two WANs
// already put WAN Routing at 50s; three would be 75. Budgeted.

const MAX_DELAY_S = 60;
{
  const worst = pasteables
    .map(([label, s]) => [
      [...s.matchAll(/:delay\s+(\d+)s/g)].reduce((a, m) => a + Number(m[1]), 0),
      label,
    ])
    .sort((a, b) => b[0] - a[0])[0];
  check(
    `QA: no chunk blocks the console for more than ${MAX_DELAY_S}s (worst is ${worst[0]}s)`,
    worst[0] <= MAX_DELAY_S,
    `${worst[1]} can block for ${worst[0]}s with no output. A technician reads a frozen ` +
      `terminal as a hang and power-cycles the router mid-provision.`,
  );
}

// =====================================================================

console.log("");
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("setup-script-generator: all checks passed");
