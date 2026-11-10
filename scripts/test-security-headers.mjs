#!/usr/bin/env node
/**
 * Baseline security headers from src/lib/console-hosts.ts.
 *
 * Pins: HSTS on sign-in hosts only (never the guest portal hosts, which
 * captive-portal flows must not be pinned to), a CSP that never restricts
 * scripts/styles (that would break the inline theme and font scripts), and
 * portal pages staying frameable.
 */
import { build } from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".tmp-test-security-headers");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const outfile = join(OUT, "console-hosts.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/console-hosts.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { withSecurityHeaders } = await import(pathToFileURL(outfile).href);
rmSync(OUT, { recursive: true, force: true });

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(ok ? `  ok ${name}` : `  FAIL ${name} -- ${detail}`);
  if (!ok) failed += 1;
};
const headersFor = (host, path, initial = {}) =>
  withSecurityHeaders(
    new Response("x", { headers: initial }),
    new Request(`https://${host}${path}`, { headers: { host } }),
  ).headers;

for (const host of [
  "app.wyfyguest.com",
  "master.wyfyguest.com",
  "demo.wyfyguest.com",
  "auth.wyfyguest.com",
]) {
  check(
    `HSTS 30 days on ${host}`,
    headersFor(host, "/").get("strict-transport-security") === "max-age=2592000",
    headersFor(host, "/").get("strict-transport-security"),
  );
}
for (const host of ["portal.wyfyguest.com", "wifi.wyfyguest.com", "localhost"]) {
  check(`no HSTS on ${host}`, !headersFor(host, "/portal/x").has("strict-transport-security"));
}
const hsts = headersFor("app.wyfyguest.com", "/").get("strict-transport-security");
check("HSTS never includeSubDomains", !/includesubdomains/i.test(hsts ?? ""), hsts);

const appCsp = headersFor("app.wyfyguest.com", "/dashboard").get("content-security-policy") ?? "";
check(
  "CSP blocks plugins and base hijack",
  appCsp.includes("object-src 'none'") && appCsp.includes("base-uri 'self'"),
  appCsp,
);
check("CSP not frameable off portal", appCsp.includes("frame-ancestors 'self'"), appCsp);
check(
  "CSP leaves scripts/styles alone",
  !/(script|style|default|connect|img|font)-src/.test(appCsp),
  appCsp,
);

const portal = headersFor("portal.wyfyguest.com", "/portal/abc");
const portalCsp = portal.get("content-security-policy") ?? "";
check("portal CSP has no frame-ancestors", !portalCsp.includes("frame-ancestors"), portalCsp);
check("portal has no X-Frame-Options", !portal.has("x-frame-options"));
check("portal still gets object-src none", portalCsp.includes("object-src 'none'"), portalCsp);

const own = headersFor("app.wyfyguest.com", "/", {
  "content-security-policy": "default-src 'self'",
});
check(
  "existing CSP is never overridden",
  own.get("content-security-policy") === "default-src 'self'",
);

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("security headers: all checks passed");
