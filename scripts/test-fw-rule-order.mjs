/**
 * Regression gate for the firewall/WireGuard rule-ordering fix.
 *
 * Run: `npm run test:fw-order`
 *
 * WHY THIS EXISTS
 * ---------------
 * Confirmed live in production (2026-08-16, router "gurugram"): RouterOS
 * evaluates `/ip firewall filter` input-chain rules top-to-bottom, first
 * match wins, and a plain `add` always appends to the end of the list.
 * The Setup Script's "Firewall" chunk emits a blanket WAN-input DROP rule
 * (`cloudguest-fw-drop-wan-input`); the "WireGuard Tunnel" chunk emits the
 * management ACCEPT rule (`cloudguest-fw-allow-wg-mgmt`). Pasted in their
 * natural order, a plain `add` left the accept rule physically below the
 * drop rule, so the drop rule ate WireGuard's own inbound handshake and
 * the management tunnel could never come up.
 *
 * The fix (PR #20) makes the generated script itself ordering-safe:
 *   - first provisioning: `place-before=$wanDropRule` inserts the accept
 *     rule above the drop rule regardless of paste order;
 *   - already-affected device: a `move` self-heals the existing
 *     mispositioned accept rule above the drop rule.
 *
 * Nine worktree branches piled edits onto this generator in one week --
 * this gate exists so none of them (nor the coming server-side port of
 * the generator, router-fleet plan P16) can silently regress the fix.
 * `tsc` cannot see any of this: it is emitted RouterOS text, not types.
 *
 * The module under test is the real `buildRouterSetupScriptChunks` from
 * `src/components/routers/RouterDetailTabs.tsx` -- a pure function --
 * bundled for Node with esbuild (already a transitive devDependency via
 * Vite), same approach as `test-portal-signin-fields.mjs`.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "fw-order-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}`);
  }
};

writeFileSync(
  join(work, "entry.js"),
  `export { buildRouterSetupScriptChunks } from "@/components/routers/RouterDetailTabs";`,
);

await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  outfile: join(work, "bundle.mjs"),
  logLevel: "error",
  // Some transitive CJS deps (axios's form-data chain) do dynamic
  // `require("util")` etc.; esbuild's ESM shim throws on those unless a
  // real Node require is in scope.
  banner: {
    js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
  },
  // Vite-injected env access in the bundled service modules -- give it a
  // harmless literal so importing the module (not the network!) works.
  define: {
    "import.meta.env.VITE_API_BASE_URL": '"/api/v1"',
    "import.meta.env": "{}",
  },
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "src-alias",
      setup(b) {
        // `@/x` -> `<root>/src/x`, with the extension probing esbuild
        // would otherwise do for us (an onResolve result must be an
        // exact file path).
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

const { buildRouterSetupScriptChunks } = await import(pathToFileURL(join(work, "bundle.mjs")).href);

const chunks = buildRouterSetupScriptChunks({
  apiBase: "https://api.example.test/api/v1",
  agentCredential: "agent-credential-test",
  wans: [{ iface: "ether1", mode: "dhcp" }],
  lanBridge: "bridgeLocal",
  lanIp: "192.168.88.1",
  lanCidr: "192.168.88.0/24",
  dnsServers: "8.8.8.8,1.1.1.1",
  hsUser: "hs-user",
  hsPass: "hs-pass",
  enableFirewall: true,
  wireguard: {
    routerPrivateKey: "test-router-private-key",
    serverPublicKey: "test-server-public-key",
    routerTunnelIp: "10.20.0.5",
    serverEndpointHost: "hub.example.test",
    serverEndpointPort: "51820",
    tunnelSubnet: "10.20.0.0/24",
    hubTunnelIpAddress: "10.20.0.1",
  },
});

const DROP = "cloudguest-fw-drop-wan-input";
const ALLOW = "cloudguest-fw-allow-wg-mgmt";

const firewall = chunks.find((c) => c.label === "Firewall");
const wg = chunks.find((c) => /wireguard/i.test(c.label));

check("Firewall chunk exists", Boolean(firewall), "no chunk labeled 'Firewall'");
check("WireGuard chunk exists", Boolean(wg), "no chunk labeled like 'WireGuard'");

if (firewall && wg) {
  // 1. The pairing anchor: the exact comment tag the WireGuard chunk
  //    targets with place-before/move must be the tag the Firewall chunk
  //    actually creates its WAN-input drop rule under. Renaming either
  //    side alone would silently turn place-before into a plain append
  //    and bring the lockout back.
  check(
    "Firewall chunk creates the WAN-input drop rule under the shared tag",
    firewall.script.includes(`action=drop comment="${DROP}"`),
    `no 'action=drop comment="${DROP}"' line in the Firewall chunk`,
  );
  check(
    "WireGuard chunk targets that same tag",
    wg.script.includes(`comment="${DROP}"`),
    `WireGuard chunk never references '${DROP}'`,
  );

  // 2. First provisioning: the management accept rule is inserted with
  //    place-before, never appended blind.
  const placeBefore = wg.script.indexOf(`comment="${ALLOW}" place-before=$wanDropRule`);
  check(
    "accept rule is inserted with place-before=$wanDropRule",
    placeBefore !== -1,
    "no place-before=$wanDropRule on the accept-rule add",
  );

  // 3. The plain-add fallback (nothing to place before yet) must be
  //    exactly one statement and the *later* branch -- if it ever becomes
  //    the first/only add again, natural paste order re-creates the
  //    lockout.
  //
  //    Split on STATEMENTS, not lines. These three guards used to be a
  //    nested `:if`/`else={}` spread over ten lines, which could not
  //    survive a real console paste: the RouterOS terminal runs each
  //    entered line as its own program, so `$wanDropRule` was read on
  //    lines after the one that bound it and `place-before=$wanDropRule`
  //    was a syntax error -- meaning the accept rule, when it was added at
  //    all, was appended BELOW the drop rule. That is exactly the
  //    confirmed-live lockout this suite exists to prevent, so the
  //    generator now emits them `;`-joined on one line. This check follows
  //    the statements wherever they live rather than assuming newlines,
  //    and asserts the identical property it always did.
  const statements = wg.script
    .split("\n")
    .flatMap((l) => l.split(";"))
    .map((s) => s.trim())
    .filter(Boolean);
  const plainAdds = statements
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s }) =>
        s.includes(`comment="${ALLOW}"`) && s.includes(" add ") && !s.includes("place-before"),
    );
  const placeBeforeAt = statements.findIndex((s) => s.includes("place-before=$wanDropRule"));
  check(
    "exactly one plain-add fallback, placed after the place-before add",
    plainAdds.length === 1 && placeBeforeAt !== -1 && plainAdds[0].i > placeBeforeAt,
    `plain adds at statements ${JSON.stringify(plainAdds.map((x) => x.i))}, place-before add at statement ${placeBeforeAt}`,
  );

  // 4. Self-heal for already-affected devices: an existing mispositioned
  //    accept rule is moved above the drop rule.
  check(
    "existing accept rule self-heals via move above the drop rule",
    wg.script.includes("/ip firewall filter move $wgAllowRule destination=$wanDropRule"),
    "no '/ip firewall filter move ... destination=$wanDropRule' self-heal",
  );
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nfw-rule-order: all checks passed");
