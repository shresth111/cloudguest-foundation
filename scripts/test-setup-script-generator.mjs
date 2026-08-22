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

const { buildRouterSetupScriptChunks, chunksToSingleLineScript, validateSetupScriptChunks } =
  await import(pathToFileURL(join(work, "bundle.mjs")).href);

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

console.log("");
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("setup-script-generator: all checks passed");
