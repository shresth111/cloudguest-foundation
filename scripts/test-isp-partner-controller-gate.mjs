/**
 * The partner console's controller-venue gate must give the customer app's
 * answers (`featureAppliesToControllerVenue`, every-router posture).
 * Run: node scripts/test-isp-partner-controller-gate.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-gate-"));
const entry = join(dir, "entry.ts");
writeFileSync(
  entry,
  `export { controllerGateFor } from "${join(ROOT, "src/components/isp-partner/customer-shell/controller-gate.ts")}";`,
);
const outfile = join(dir, "b.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  external: ["@tanstack/react-query", "react", "axios"],
  plugins: [
    {
      name: "at",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (a) =>
          b.resolve(`./src/${a.path.slice(2)}`, { resolveDir: ROOT, kind: a.kind }),
        );
        // the hook's data source is irrelevant to the pure function
        b.onResolve({ filter: /hooks\/isp-partner\/useIsp$/ }, () => ({
          path: "stub",
          namespace: "stub",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export const useIspRouters = () => ({});",
        }));
      },
    },
  ],
  define: { "import.meta.env": JSON.stringify({}) },
});
const { controllerGateFor } = await import(outfile);
let failures = 0;
const cases = [
  ["whitelist", ["aruba_instant_on"], true],
  ["mac-auth", ["aruba_instant_on", "aruba_instant_on"], true],
  ["whitelist", ["tplink_omada"], false],
  ["mac-auth", ["tplink_omada"], false],
  ["whitelist", ["aruba_instant_on", "mikrotik"], false],
  ["whitelist", [], false],
  ["mac-auth", ["mikrotik"], false],
  ["vlans", ["tplink_omada"], true],
  ["vlans", ["mikrotik", "tplink_omada"], false],
];
for (const [feature, vendors, want] of cases) {
  const got = controllerGateFor(feature, vendors).gated;
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${feature} at [${vendors.join(",")}] gated=${got}`);
}
console.log(
  failures ? `\nFAIL: ${failures} of ${cases.length}` : `\nPASS: all ${cases.length} checks passed`,
);
process.exit(failures ? 1 : 0);
