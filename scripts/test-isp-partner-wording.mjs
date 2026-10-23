/**
 * QA-023 / D11 guard: the partner console's router setup page never names the
 * tunnel technology or shows a tunnel address, while the shared
 * RouterSetupDrilldown (Master's) is mounted unchanged and the generated
 * script keeps its tunnel.
 *
 * Checks partnerWording() against every string literal in the REAL
 * RouterSetupScriptAdvanced.tsx that names it, plus the wiring of
 * PartnerWordingScope in the partner router page.
 *
 * Run: node scripts/test-isp-partner-wording.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-wording-"));
const outfile = join(outdir, "wording.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/partner-wording.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { partnerWording, namesPlatformInternals } = await import(outfile);

let failures = 0;
let checks = 0;
const check = (name, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- ${detail}`}`);
};

// 1. Every literal in the real component that names it is translated.
// RouterDetailTabs renders the "not in this script" gap list inside the drilldown.
const src = ["RouterSetupScriptAdvanced.tsx", "RouterDetailTabs.tsx"]
  .map((f) => readFileSync(join(ROOT, "src/components/routers", f), "utf8"))
  .join("\n");
const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const literals = new Set();
// one-line "..." and `...` literals, and JSX text runs, that name it
for (const m of noComments.matchAll(/"((?:\\.|[^"\\\n])*WireGuard(?:\\.|[^"\\\n])*)"/g))
  literals.add(m[1]);
for (const m of noComments.matchAll(/`((?:\\.|[^`\\\n])*WireGuard(?:\\.|[^`\\\n])*)`/g))
  literals.add(m[1]);
for (const m of noComments.matchAll(/>([^<>{}]*WireGuard[^<>{}]*)</g)) literals.add(m[1].trim());
check("found the component's literals (sanity)", literals.size >= 10, `only ${literals.size}`);
let leaks = 0;
for (const lit of literals) {
  // `${IDENTIFIER}` placeholders are code, not words on screen
  const out = partnerWording(lit).replace(/\$\{[^}]*\}/g, "");
  if (/wireguard/i.test(out)) {
    leaks += 1;
    console.log(`       leak: ${JSON.stringify(out).slice(0, 140)}`);
  }
}
check(`all ${literals.size} literals translated`, leaks === 0, `${leaks} still name it`);

// 2. Specific phrases.
const reused =
  "This router has never connected, and the platform reused a WireGuard tunnel (10.66.0.16) whose private key it does not have";
const r = partnerWording(reused);
check("tunnel address in parentheses removed", !/10\.66\.0\.16/.test(r), r);
check("reads as cloud link", r.includes("reused a cloud link whose private key"), r);
check(
  "hub wording",
  partnerWording("Couldn't reach the WireGuard hub -- script generated without a tunnel.") ===
    "Couldn't reach the platform -- script generated without a tunnel.",
  partnerWording("Couldn't reach the WireGuard hub -- script generated without a tunnel."),
);
check(
  "tunnel IP with address",
  !/10\.20\.0\.9/.test(partnerWording("tunnel IP 10.20.0.9 is in use")),
  partnerWording("tunnel IP 10.20.0.9 is in use"),
);
check(
  "a LAN address in parentheses stays",
  partnerWording("LAN gateway (192.168.88.1)") === "LAN gateway (192.168.88.1)",
);
check(
  "typed acknowledgement phrases unchanged",
  partnerWording("type exactly:  NO PLATFORM ACCESS").endsWith("NO PLATFORM ACCESS") &&
    partnerWording("type exactly:  NO GUEST LOGIN").endsWith("NO GUEST LOGIN"),
);
check("RADIUS untouched", partnerWording("Also enable RADIUS") === "Also enable RADIUS");
const once = partnerWording(reused + " Rotate the WireGuard tunnel");
check("idempotent", partnerWording(once) === once);
check("detector", namesPlatformInternals(reused) && !namesPlatformInternals(once));

// 3. Wiring.
const scope = readFileSync(
  join(ROOT, "src/components/isp-partner/routers/PartnerWordingScope.tsx"),
  "utf8",
);
check(
  "scope skips pre/code/textarea (script stays raw)",
  /pre, code, kbd, samp, textarea, input/.test(scope),
);
check(
  "scope wraps and restores window.confirm/prompt/alert",
  /window\.confirm = confirm;/.test(scope) &&
    /window\.prompt = prompt;/.test(scope) &&
    /window\.alert = alert;/.test(scope),
);
check("scope covers the toast portal", scope.includes("[data-sonner-toaster]"));
const page = readFileSync(
  join(ROOT, "src/components/isp-partner/routers/RouterDetailPage.tsx"),
  "utf8",
);
check(
  "partner router page mounts the drilldown inside the scope",
  /<PartnerWordingScope>\s*<RouterSetupDrilldown/.test(page),
);
check(
  "partner router page hides the management (tunnel) IP",
  /managementIpAddress: null/.test(page),
);

// 4. Hygiene: no partner component file names it.
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const offenders = walk(join(ROOT, "src/components/isp-partner")).filter((p) =>
  /wireguard/i.test(readFileSync(p, "utf8")),
);
check("no partner component names it", offenders.length === 0, offenders.join(", "));

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
console.log("all checks passed");
