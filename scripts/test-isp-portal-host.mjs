/**
 * Guard for the ISP partner test-portal override
 * (src/lib/isp-partner/portal-host.ts + vite-plugins/isp-portal-host.ts).
 *
 * Run: node scripts/test-isp-portal-host.mjs
 *
 * Proves, against the REAL RouterDetailTabs.tsx and the REAL generator:
 *  - the build transform finds the GUEST_PORTAL_PUBLIC_BASE statement, rewrites
 *    it once, and keeps the module's line numbers;
 *  - on network-staging (flag on) a generated script points at auth-isp and
 *    nowhere at auth.wyfyguest.com (login pages AND walled garden);
 *  - on prod network.wyfyguest.com, on the customer/Master hosts and with the
 *    flag off, the script is byte-identical to an untransformed build.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "isp-portal-host-"));
const failures = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures.push(`${name}: ${detail ?? ""}`);
};

// 1. The plugin module itself (TS) -> bundle so node can import it.
await build({
  entryPoints: [join(ROOT, "vite-plugins/isp-portal-host.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "plugin.mjs"),
  external: ["vite"],
  logLevel: "error",
});
const { transformPortalBase, PORTAL_BASE_STATEMENT } = await import(
  pathToFileURL(join(work, "plugin.mjs"))
);

const tabsPath = join(ROOT, "src/components/routers/RouterDetailTabs.tsx");
const tabsSrc = readFileSync(tabsPath, "utf8");
const out = transformPortalBase(tabsSrc);
check("transform finds the GUEST_PORTAL_PUBLIC_BASE statement", out !== null);
check(
  "statement occurs exactly once in the source",
  tabsSrc.split(PORTAL_BASE_STATEMENT).length === 2,
);
check(
  "transformed module no longer has the bare literal statement",
  out && !out.includes(PORTAL_BASE_STATEMENT),
);
check(
  "line numbers preserved (import appended, not prepended)",
  out &&
    out
      .split("\n")
      .slice(0, tabsSrc.split("\n").length)
      .join("\n")
      .replace(
        '__ispGuestPortalBase("https://auth.wyfyguest.com")',
        '"https://auth.wyfyguest.com"',
      ) === tabsSrc,
);
check("non-matching source is left alone", transformPortalBase("export const X = 1;") === null);

// 2. Real generator, bundled once WITH the transform and once WITHOUT.
async function bundle(name, { transform, flag }) {
  writeFileSync(
    join(work, `${name}.entry.js`),
    `export { buildRouterSetupScriptChunks, chunksToRouterOsScript, GUEST_PORTAL_PUBLIC_BASE } from "@/components/routers/RouterDetailTabs";\n`,
  );
  await build({
    entryPoints: [join(work, `${name}.entry.js`)],
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    outfile: join(work, `${name}.mjs`),
    logLevel: "error",
    banner: {
      js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
    },
    define: {
      "import.meta.env.VITE_API_BASE_URL": '"/api/v1"',
      "import.meta.env.VITE_ISP_PARTNER_ENABLED": JSON.stringify(flag ? "true" : ""),
      "import.meta.env": "{}",
    },
    nodePaths: [resolve(ROOT, "node_modules")],
    plugins: [
      {
        name: "src-alias+transform",
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = join(ROOT, "src", args.path.slice(2));
            for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")])
              if (existsSync(p) && extname(p)) return { path: p };
            return { errors: [{ text: `cannot resolve ${args.path}` }] };
          });
          if (transform)
            b.onLoad({ filter: /RouterDetailTabs\.tsx$/ }, () => ({
              contents: transformPortalBase(tabsSrc),
              loader: "tsx",
              resolveDir: dirname(tabsPath),
            }));
        },
      },
    ],
  });
  return pathToFileURL(join(work, `${name}.mjs`)).href;
}
const withT = await bundle("with", { transform: true, flag: true });
const withTNoFlag = await bundle("withnoflag", { transform: true, flag: false });
const without = await bundle("without", { transform: false, flag: true });

const OPTS = (m) => ({
  generatedAt: "2026-10-23T00:00:00.000Z",
  apiBase: "https://network-staging.wyfyguest.com/api/v1",
  agentCredential: "cred",
  wans: [{ iface: "ether1", mode: "dhcp" }],
  lanBridge: "bridge-guest",
  lanIp: "10.5.50.1",
  lanCidr: "24",
  dnsServers: "8.8.8.8,1.1.1.1",
  hsUser: "guest",
  enableFirewall: true,
  portalUrl: {
    frontendBase: m.GUEST_PORTAL_PUBLIC_BASE,
    organizationId: "o",
    locationId: "l",
    routerId: "r",
  },
});
let n = 0;
async function scriptOn(url, hostname) {
  globalThis.window = { location: { hostname } };
  const m = await import(`${url}?h=${encodeURIComponent(hostname)}&n=${n++}`);
  // chunksToRouterOsScript stamps "# Generated <now>" in its header; drop it.
  const rsc = m
    .chunksToRouterOsScript(m.buildRouterSetupScriptChunks(OPTS(m)), "t")
    .replace(/^# Generated .*$/m, "");
  return { base: m.GUEST_PORTAL_PUBLIC_BASE, rsc };
}
const ref = await scriptOn(without, "network-staging.wyfyguest.com");
check("untransformed build: default portal", ref.base === "https://auth.wyfyguest.com");

const test = await scriptOn(withT, "network-staging.wyfyguest.com");
check(
  "network-staging: portal base is auth-isp",
  test.base === "https://auth-isp.wyfyguest.com",
  test.base,
);
check(
  "network-staging: script carries auth-isp",
  test.rsc.includes("https://auth-isp.wyfyguest.com/portal?"),
);
check(
  "network-staging: script has no auth.wyfyguest.com at all",
  !test.rsc.includes("auth.wyfyguest.com"),
);
check(
  "network-staging: walled garden resolves auth-isp",
  test.rsc.includes(':resolve "auth-isp.wyfyguest.com"'),
);

for (const h of [
  "network.wyfyguest.com",
  "app.wyfyguest.com",
  "master.wyfyguest.com",
  "localhost",
]) {
  const s = await scriptOn(withT, h);
  check(`${h}: script byte-identical to untransformed build`, s.rsc === ref.rsc);
}
const off = await scriptOn(withTNoFlag, "network-staging.wyfyguest.com");
check("flag off on network-staging: byte-identical to untransformed build", off.rsc === ref.rsc);

if (failures.length) {
  console.log(`\n${failures.length} FAILED\n` + failures.join("\n"));
  process.exit(1);
}
console.log("\nALL ISP PORTAL-HOST CHECKS PASSED");
