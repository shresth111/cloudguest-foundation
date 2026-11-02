/**
 * Partner security pages keep their plain answers for "router not set up" and
 * "categories not available", whatever generic copy a 5xx or uncoded refusal
 * gets from ispErrorMessage.
 * Run: node scripts/test-isp-partner-b4-messages.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-b4-"));
const entry = join(dir, "entry.ts");
writeFileSync(
  entry,
  `export { friendlyB4Message } from "${join(ROOT, "src/lib/isp-partner/b4-messages.ts")}";`,
);
const outfile = join(dir, "b.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  packages: "external",
  plugins: [
    {
      name: "at",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (a) =>
          b.resolve(`./src/${a.path.slice(2)}`, { resolveDir: ROOT, kind: a.kind }),
        );
      },
    },
  ],
  define: { "import.meta.env": JSON.stringify({}) },
});
const { friendlyB4Message } = await import(outfile);
const err = (status, message) => ({ status, code: "x", message, data: {} });
const RID = "d5c8732e-6752-4bd5-a498-7302df60c32a";
let failures = 0;
function check(name, ok, got) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- ${got}`}`);
}
const cats = friendlyB4Message(
  err(
    503,
    "Category filtering is not configured on this platform yet (no Cloudflare Gateway account is connected).",
  ),
);
check("503 categories keeps its own answer", /not available on this platform/.test(cats), cats);
check("no generic copy on it", !/something went wrong/i.test(cats), cats);
const creds = friendlyB4Message(
  err(
    400,
    `Router '${RID}' is missing device connection credentials (management or public IP, API username, or API secret)`,
  ),
);
check(
  "400 credentials says the router is not ready",
  /not ready for remote changes/.test(creds),
  creds,
);
check("no router id shown", !creds.includes(RID), creds);
check("no credential wording shown", !/credential|API secret/i.test(creds), creds);
const other = friendlyB4Message(err(500, "boom"));
check("any other failure stays generic copy", !/boom/.test(other) && other.length > 0, other);
console.log(failures ? `\nFAIL: ${failures}` : "\nPASS: all checks passed");
process.exit(failures ? 1 : 0);
