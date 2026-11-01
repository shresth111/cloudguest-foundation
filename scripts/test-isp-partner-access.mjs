/**
 * Who may open the partner console (src/lib/isp-partner/access.ts).
 * Founder test 2026-10-23: a GLOBAL Super Admin got the raw backend
 * "which organization?" error instead of the "not an ISP account" screen.
 * Run: node scripts/test-isp-partner-access.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-access-"));
const entry = join(dir, "e.ts");
writeFileSync(entry, `export * from "${join(ROOT, "src/lib/isp-partner/access.ts")}";`);
const outfile = join(dir, "b.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: "api", namespace: "stub" }));
        b.onResolve({ filter: /^@\/types\/auth$/ }, () => ({ path: "t", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export const requestErrorOf = (e) => e;",
        }));
      },
    },
  ],
});
const m = await import(outfile);
let failures = 0;
let checks = 0;
const check = (name, ok, extra = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? ` -- ${extra}` : ""}`);
};
const role = (slug, scopeType = "organization") => ({
  roleId: "r",
  roleName: slug,
  roleSlug: slug,
  scopeType,
});

check(
  "GLOBAL Super Admin -> platform-account (before /isp/me)",
  m.accessFromRoles([role("super-admin", "global")]) === "platform-account",
);
check(
  "venue owner only -> not-partner (before /isp/me)",
  m.accessFromRoles([role("org-owner")]) === "not-partner",
);
check("isp-owner -> unknown (ask /isp/me)", m.accessFromRoles([role("isp-owner")]) === "unknown");
check("roles not loaded yet -> unknown", m.accessFromRoles([]) === "unknown");
check(
  "GLOBAL wins even with an isp role",
  m.accessFromRoles([role("isp-owner"), role("x", "global")]) === "platform-account",
);
const err = (data) => ({ status: 400, data });
check(
  "organization_required (data.error_code) -> platform-account",
  m.accessFromMeError(err({ error_code: "organization_required" })) === "platform-account",
);
check(
  "permission_denied -> not-partner",
  m.accessFromMeError(err({ error_code: "permission_denied" })) === "not-partner",
);
check(
  "ISP_PARTNER_REQUIRED (data.code) -> not-partner",
  m.accessFromMeError(err({ code: "ISP_PARTNER_REQUIRED" })) === "not-partner",
);
check(
  "ISP_PARTNER_SUSPENDED is not swallowed",
  m.accessFromMeError(err({ code: "ISP_PARTNER_SUSPENDED" })) === "unknown",
);
check(
  "network error -> unknown (Try again stays)",
  m.accessFromMeError({ status: 0 }) === "unknown",
);

const layout = readFileSync(join(ROOT, "src/components/isp-partner/PartnerLayout.tsx"), "utf8");
check("layout skips /isp/me unless roles leave it open", /roleAccess === "unknown"/.test(layout));
check(
  "layout maps /isp/me errors through accessFromMeError",
  /accessFromMeError\(me\.error\)/.test(layout),
);
check(
  "layout does not advertise the Master console (founder 2026-10-23)",
  !/masterLoginUrl|Master console|master-login/.test(layout),
);

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
