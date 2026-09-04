/**
 * Regression gate for the RADIUS Change-of-Authorization listener in the
 * MikroTik setup script that `buildRouterSetupScriptChunks`
 * (`src/components/routers/RouterDetailTabs.tsx`) hands a technician.
 *
 * Run: `npm run test:radius-coa`
 * Gate: `scripts/ci-gated-test.sh` (exit code + sentinel + check floor).
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything the RADIUS chunk does apart from one line is about this
 * router ASKING the hub a question: `/radius add`, the shared secret,
 * `src-address`, `use-radius=yes` on `hsprof1`. All of that carries an
 * Access-Request out and an Accept back, and all of it is already
 * regression-tested in `test-setup-script-generator.mjs`.
 *
 * `/radius incoming set accept=yes port=3799` is the OTHER direction, and
 * it is the only line in the chunk with no read-back in front of it, so it
 * gets its own file. It is what makes the router listen for the hub
 * speaking first: RADIUS Change-of-Authorization and Disconnect-Request
 * (RFC 5176). `app/domains/guest/radius_coa.py` builds and sends those
 * packets for real -- they are what "Block guest" and "End session" on the
 * customer dashboard actually do, and what backend commit `bf8e606`
 * ("Blocking a guest now actually ends the session they are in")
 * promises.
 *
 * THE FAILURE THIS PINS IS THE ONE THIS PROJECT KEEPS SHIPPING: THE SYSTEM
 * REPORTS SUCCESS WHILE DOING NOTHING. RouterOS does not listen on 3799
 * unless it is told to, and a UDP port with nothing bound to it is not an
 * error anybody observes -- the packet arrives, it is dropped, and the
 * sender is never told. The generator omitted this line entirely until
 * now, so on a router provisioned ONLY from the paste script (the normal
 * path for a new site, and the only path until a config push happens)
 * blocking a guest changed nothing at all on the device. The dashboard
 * said it worked. `/radius` was populated, guests were logging in, the
 * router was green. There was no symptom to notice.
 *
 * WHAT IS ASSERTED, AND WHY EACH PIECE SEPARATELY
 * -----------------------------------------------
 * "the script mentions /radius incoming somewhere" would have passed on
 * three different scripts that a real device would have ignored, so the
 * shape is graded field by field:
 *
 *   1. It is in the RADIUS chunk, not merely somewhere in the whole
 *      script. Chunks are pasted individually; a technician who pastes
 *      the RADIUS chunk must get the listener with it.
 *   2. `accept=yes`. `accept=no` is RouterOS's own default and is what a
 *      half-applied edit leaves behind.
 *   3. `port=3799` -- the RFC 5176 assigned port, which is what
 *      `radius_coa.py` sends to. RouterOS's OWN default here is 1700, so
 *      "the port field is present" is not the assertion; the number is.
 *      Three writers have to agree on it: this generator, the backend's
 *      `render_radius_client`, and the gateway's
 *      `set_radius_client_config`. A router listening on 1700 while the
 *      platform talks to 3799 fails exactly as silently as one not
 *      listening at all.
 *   4. It survives every option shape that produces a RADIUS chunk at
 *      all, not just one hand-picked fixture.
 *   5. It appears where there IS a `/radius` entry and nowhere else -- a
 *      script that configures no RADIUS client has no business opening a
 *      CoA listener, and a stray line would be the generator emitting
 *      configuration for a subsystem the operator deliberately declined.
 *
 * PROVEN TO FAIL ON PURPOSE
 * -------------------------
 * Deleting the emitted line from the generator was run before this file
 * was committed: checks 1-4 below fail, sentinel absent, exit 1. The
 * INJECTED checks at the end re-prove the same thing on every run without
 * needing the source mutated: they run the real matcher against the three
 * near-miss scripts a plausible bad edit produces (line gone, `accept=no`,
 * RouterOS's default `port=1700`) and require it to REJECT all three. A
 * matcher loosened into always-true -- the way this repo has lost guards
 * before -- fails those instead.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner. The real
 * generator is bundled with esbuild and CALLED; nothing here is a
 * reimplementation of it, and nothing here greps the source file (a grep
 * would pass on the line sitting in a comment, which is precisely the
 * state of this file's subject before the fix).
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "radius-coa-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail ?? ""}`);
    console.log(`  FAIL ${name}`);
  }
};

// ---------------------------------------------------------------------
// Bundle the REAL generator. Same harness as
// `test-setup-script-generator.mjs`, deliberately: the component pulls in
// React and the router, so it is bundled rather than imported, and the
// `@/` alias is resolved the way Vite does.
// ---------------------------------------------------------------------
writeFileSync(
  join(work, "entry.js"),
  `export { buildRouterSetupScriptChunks } from "@/components/routers/RouterDetailTabs";\n`,
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

const { buildRouterSetupScriptChunks } = await import(join(work, "bundle.mjs"));

// ---------------------------------------------------------------------
// THE MATCHER. One definition, used by the sweep AND by the INJECTED
// self-checks below, on purpose: an earlier guard in this repo had the
// sweep test one thing while its self-check re-derived the answer its own
// way, so mutating the sweep changed nothing the self-check could see.
//
// Field-order-independent (RouterOS does not care, and neither should
// this), but every field is required to be on the SAME entered line: the
// console runs each line as its own program, so `accept=yes` and
// `port=3799` split across two lines would be two separate writes, and
// only the reason for pinning them together would be lost.
// ---------------------------------------------------------------------
const COA_PORT = "3799";
const coaListenerLines = (script) =>
  script
    .split("\n")
    .flatMap((line) => line.split(";"))
    .map((s) => s.trim())
    .filter((s) => /^\/radius incoming set\b/.test(s));

const hasCoaListener = (script) =>
  coaListenerLines(script).some(
    (s) => /\baccept=yes\b/.test(s) && new RegExp(`\\bport=${COA_PORT}\\b`).test(s),
  );

// ---------------------------------------------------------------------
// Fixtures. A representative router first -- the shape a new site is
// actually provisioned with -- then the full option matrix.
// ---------------------------------------------------------------------
/** The same base options `test-setup-script-generator.mjs` sweeps with.
 * `generatedAt` is pinned there so the generator is deterministic; kept
 * pinned here for the same reason. */
const BASE = {
  generatedAt: "2026-08-28T00:00:00.000Z",
  apiBase: "https://master.wyfyguest.com/api/v1",
  agentCredential: "cred-abc123",
  lanBridge: "bridge-guest",
  lanIp: "10.5.50.1",
  lanCidr: "24",
  dnsServers: "8.8.8.8,1.1.1.1",
  hsUser: "guest",
  hsPass: "guestpass",
  enableFirewall: true,
  wans: [{ iface: "ether1", mode: "dhcp" }],
};

const RADIUS = {
  serverAddress: "10.20.0.1",
  sharedSecret: "s3cr3t",
  srcAddress: "10.20.0.5",
};

/** Field-for-field the same tunnel fixture `test-setup-script-generator
 * .mjs` uses, so the two files cannot disagree about what a real
 * WireGuard option shape looks like. `srcAddress` on the RADIUS side is
 * `routerTunnelIp` here for a reason: the RADIUS chunk refuses to write a
 * `src-address` the WireGuard chunk did not put on the box. */
const WG = {
  routerPrivateKey: "PRIVKEY",
  serverPublicKey: "PUBKEY",
  peerPublicKey: "PEERPUBKEY",
  routerTunnelIp: "10.20.0.5",
  serverEndpointHost: "vpn.wyfyguest.com",
  serverEndpointPort: "13231",
  tunnelSubnet: "10.20.0.0/24",
  hubTunnelIpAddress: "10.20.0.1",
};

/** The representative router: one DHCP WAN, a tunnel, and RADIUS -- what
 * the Master console generates for a real new site. */
const REPRESENTATIVE = { ...BASE, wireguard: WG, radius: RADIUS };

const chunkNamed = (chunks, label) => chunks.find((c) => c.label === label);
const allText = (chunks) => chunks.map((c) => c.script).join("\n");

console.log("\n-- the CoA listener reaches the technician's clipboard --");

{
  const chunks = buildRouterSetupScriptChunks(REPRESENTATIVE);
  const radiusChunk = chunkNamed(chunks, "RADIUS");

  check(
    "a representative router's script has a RADIUS chunk at all",
    Boolean(radiusChunk),
    "no chunk labelled RADIUS was emitted, so everything below would be vacuously true",
  );

  const script = radiusChunk?.script ?? "";
  const lines = coaListenerLines(script);

  check(
    "the RADIUS chunk enables the CoA/Disconnect listener",
    hasCoaListener(script),
    "no `/radius incoming set accept=yes port=" +
      COA_PORT +
      "` in the chunk. RouterOS does not listen for Change-of-Authorization or " +
      "Disconnect-Request unless told to, so every CoA packet `radius_coa.py` sends to this " +
      "router is dropped by the kernel with nothing bound to the port -- and neither end is " +
      "told. Blocking a guest and ending a session from the customer dashboard report success " +
      "and change nothing on the device. Emitted: " +
      JSON.stringify(lines),
  );

  check(
    "it says accept=yes, not RouterOS's own default of no",
    lines.length > 0 && lines.every((s) => /\baccept=yes\b/.test(s)),
    "`accept=no` is the factory default. A listener line that does not flip it is decoration: " +
      `emitted ${JSON.stringify(lines)}`,
  );

  check(
    `it listens on ${COA_PORT}, the RFC 5176 port the platform actually sends to`,
    lines.length > 0 && lines.every((s) => new RegExp(`\\bport=${COA_PORT}\\b`).test(s)),
    "RouterOS's own default for this is 1700. A router listening on 1700 while " +
      "`radius_coa.py` sends to 3799 fails exactly as silently as one not listening at all -- " +
      "and it is the shape that looks configured. The backend's `render_radius_client` and " +
      "the gateway's `set_radius_client_config` both write 3799; all three writers have to " +
      `agree. Emitted: ${JSON.stringify(lines)}`,
  );

  check(
    "the listener is in the RADIUS chunk itself, not somewhere else in the script",
    hasCoaListener(script),
    "chunks are pasted one at a time, so a listener living in a different chunk is a listener " +
      "the technician who pasted RADIUS did not get",
  );

  check(
    "it is a bare `set` on the singleton, with no `find` guard around it",
    lines.length > 0 && lines.every((s) => !/\bfind\b/.test(s)),
    "`/radius incoming` is a settings object, not a table: there is nothing to enumerate. A " +
      "`find` against it matches nothing forever, in silence -- the exact shape the generator " +
      `is full of warnings about. Emitted: ${JSON.stringify(lines)}`,
  );

  check(
    "exactly one listener statement is emitted, so the chunk is not doing it twice",
    lines.length === 1,
    `${lines.length} statements: ${JSON.stringify(lines)}`,
  );
}

// ---------------------------------------------------------------------
// The option matrix. One fixture is one fixture; the line has to survive
// every shape that produces a RADIUS chunk, and stay away from the ones
// that do not.
// ---------------------------------------------------------------------
console.log("\n-- across every option shape --");

const VARIANTS = [
  ["RADIUS + tunnel (the shipping shape)", REPRESENTATIVE, true],
  ["RADIUS + tunnel, basicConfigOnly", { ...REPRESENTATIVE, basicConfigOnly: true }, true],
  ["RADIUS + tunnel, firewall off", { ...REPRESENTATIVE, enableFirewall: false }, true],
  [
    "RADIUS + tunnel, static WAN",
    {
      ...REPRESENTATIVE,
      wans: [{ iface: "ether1", mode: "static", ip: "1.2.3.4", cidr: "24", gateway: "1.2.3.1" }],
    },
    true,
  ],
  [
    "RADIUS + tunnel, two WANs load-balanced",
    {
      ...REPRESENTATIVE,
      wans: [
        { iface: "ether1", mode: "dhcp" },
        { iface: "ether2", mode: "static", ip: "5.6.7.8", cidr: "24", gateway: "5.6.7.1" },
      ],
      wanRoutingMode: "load_balance",
    },
    true,
  ],
  // The negative case is as load-bearing as the positives: a script that
  // registers no RADIUS client has no CoA to receive.
  ["no RADIUS supplied at all", { ...BASE, wireguard: WG }, false],
  ["neither RADIUS nor tunnel", BASE, false],
];

for (const [variant, opts, expected] of VARIANTS) {
  const text = allText(buildRouterSetupScriptChunks(opts));
  check(
    expected
      ? `${variant}: the listener is emitted`
      : `${variant}: no listener is emitted, because there is no RADIUS client either`,
    hasCoaListener(text) === expected,
    expected
      ? "a router provisioned from this option shape would silently ignore every CoA packet"
      : "the generator opened a CoA listener for a subsystem this script does not configure -- " +
          "and for a RADIUS deselect, one the operator explicitly declined through the typed gate",
  );
}

// ---------------------------------------------------------------------
// INJECTED. A guard nobody has watched fail is decoration. These run the
// REAL matcher against the three scripts a plausible bad edit produces
// and require it to reject all of them, so the matcher cannot quietly
// become always-true the way guards in this repo have before.
// ---------------------------------------------------------------------
console.log("\n-- the matcher can actually fail --");

const NEAR_MISSES = [
  [
    "the line deleted entirely (the state this file was written to fix)",
    `:if ([:len [/radius find where comment="cloudguest-radius"]] = 0) do={ /radius add service=hotspot address="10.20.0.1" secret="s3cr3t" src-address=10.20.0.5 timeout=3s comment="cloudguest-radius" }`,
  ],
  [
    "accept=no -- the factory default, which is the same as no line at all",
    `/radius incoming set accept=no port=3799`,
  ],
  [
    "port=1700 -- RouterOS's own default, not the port the platform sends to",
    `/radius incoming set accept=yes port=1700`,
  ],
  ["the port omitted, leaving 1700 in place", `/radius incoming set accept=yes`],
  [
    "the two fields split across entered lines, which the console runs as separate programs",
    `/radius incoming set accept=yes\n/radius incoming set port=3799`,
  ],
  [
    "the line present only as a comment, which a source grep would have accepted",
    `# /radius incoming set accept=yes port=3799 -- TODO\n/radius add service=hotspot address="10.20.0.1"`,
  ],
];

for (const [what, script] of NEAR_MISSES) {
  check(
    `INJECTED: the matcher rejects ${what}`,
    !hasCoaListener(script),
    "the matcher is blind " + "to it, so it would have stayed green through exactly this defect",
  );
}

check(
  "...and accepts the real emitted line",
  hasCoaListener(`/radius incoming set accept=yes port=3799`),
  "a matcher that rejects everything passes the INJECTED checks above while protecting nothing",
);
check(
  "...and accepts it with the fields the other way round",
  hasCoaListener(`/radius incoming set port=3799 accept=yes`),
  "RouterOS does not care about field order; a matcher that does would fail on a harmless edit " +
    "and get deleted rather than fixed",
);

// =====================================================================

console.log("");
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("radius-coa-listener: all checks passed");
