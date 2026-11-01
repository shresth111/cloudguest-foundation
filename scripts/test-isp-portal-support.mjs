/**
 * QA-021 guard: the ISP support line in the guest portal footer.
 *
 * Proves, against the REAL PortalShell.tsx:
 *  - flag OFF (VITE_ISP_PARTNER_ENABLED unset or not "true"): the plugin
 *    returns null for EVERY module under src/, so the bundle is byte-identical
 *    to a build without it;
 *  - flag ON: exactly one expression in PortalShell.tsx is swapped, nothing
 *    else in it changes, line numbers are kept, and no other module is touched;
 *  - the mounted component renders exactly the default text (no wrapper
 *    element), and reaches the backend only on an ISP portal host;
 *  - the support line keeps the portal's own localized "Support" label.
 *
 * Run: node scripts/test-isp-portal-support.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-portal-support-"));
const atAlias = {
  name: "at-alias",
  setup(b) {
    b.onResolve({ filter: /^@\// }, async (args) =>
      b.resolve("./" + args.path.slice(2), { resolveDir: join(ROOT, "src"), kind: args.kind }),
    );
  },
};
async function load(entry, name) {
  const outfile = join(outdir, `${name}.mjs`);
  await build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
    external: ["vite", "react", "react-dom"],
    plugins: [atAlias],
    jsx: "automatic",
  });
  return import(outfile);
}
const plugin = await load("vite-plugins/isp-portal-support.ts", "plugin");
const lib = await load("src/lib/isp-partner/portal-support.ts", "lib");
const comp = await load("src/components/isp-partner/portal/IspPortalSupport.tsx", "comp");

let failures = 0;
let checks = 0;
const check = (name, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- ${detail}`}`);
};

const SHELL = join(ROOT, "src/components/portal-runtime/PortalShell.tsx");
const shell = readFileSync(SHELL, "utf8");
const ctx = {
  warned: [],
  warn(m) {
    this.warned.push(m);
  },
};

// 1. Flag OFF: identity for every module.
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });
const files = walk(join(ROOT, "src"));
for (const env of [{}, { VITE_ISP_PARTNER_ENABLED: "false" }, { VITE_ISP_PARTNER_ENABLED: "1" }]) {
  const off = plugin.ispPortalSupport(env);
  const touched = files.filter((f) => off.transform.call(ctx, readFileSync(f, "utf8"), f) !== null);
  check(
    `flag ${JSON.stringify(env.VITE_ISP_PARTNER_ENABLED ?? "unset")}: no module transformed (${files.length} scanned)`,
    touched.length === 0,
    touched.join(", "),
  );
}

// 2. Flag ON: only PortalShell, exactly one swap.
const on = plugin.ispPortalSupport({ VITE_ISP_PARTNER_ENABLED: "true" });
const others = files.filter(
  (f) => f !== SHELL && on.transform.call(ctx, readFileSync(f, "utf8"), f) !== null,
);
check("flag on: no other module transformed", others.length === 0, others.join(", "));
const res = on.transform.call(ctx, shell, SHELL);
const out = res?.code ?? "";
check("flag on: PortalShell transformed", Boolean(res));
check(
  "the footer expression exists exactly once in the real PortalShell",
  shell.split(plugin.SUPPORT_EXPRESSION).length === 2,
);
const IMPORT_LINE =
  'import { IspPortalSupport as __IspPortalSupport } from "@/components/isp-partner/portal/IspPortalSupport";';
check(
  "import appended once, at the end",
  out.trimEnd().endsWith(IMPORT_LINE) && out.split(IMPORT_LINE).length === 2,
);
const body = out.slice(0, out.lastIndexOf("\n" + IMPORT_LINE));
check(
  "nothing else in PortalShell changed",
  body.replace(
    '<span><__IspPortalSupport fallback={t("supportAskStaff")} /></span>',
    plugin.SUPPORT_EXPRESSION,
  ) === shell,
);
check("line numbers kept", body.split("\n").length === shell.split("\n").length);
check(
  "a changed footer is left alone, with a warning",
  on.transform.call(ctx, shell.replace(plugin.SUPPORT_EXPRESSION, "<span>x</span>"), SHELL) ===
    null && ctx.warned.length === 1,
);

// 3. Runtime: hosts, label, location id.
for (const h of [
  "auth.wyfyguest.com",
  "app.wyfyguest.com",
  "master.wyfyguest.com",
  "staging.wyfyguest.com",
  "network-staging.wyfyguest.com",
  "localhost",
])
  check(`not an ISP portal host: ${h}`, !lib.isIspPortalHost(h));
check("ISP portal host: auth-isp.wyfyguest.com", lib.isIspPortalHost("auth-isp.wyfyguest.com"));
const c = { support_phone: "+911234567890", support_email: "help@isp.example" };
check(
  "English line",
  lib.supportLine("Support: ask venue staff", c) === "Support: +911234567890 · help@isp.example",
);
check(
  "Hindi label kept",
  lib.supportLine("सहायता: वेन्यू स्टाफ से पूछें", c).startsWith("सहायता: +91"),
);
check(
  "phone only",
  lib.supportLine("Support: ask venue staff", { support_phone: "+91 98", support_email: null }) ===
    "Support: +91 98",
);
check(
  "nothing to show -> default text",
  lib.supportLine("Support: ask venue staff", { support_phone: null, support_email: " " }) ===
    "Support: ask venue staff",
);
check(
  "no contact -> default text",
  lib.supportLine("Support: ask venue staff", null) === "Support: ask venue staff",
);
check(
  "location id from the portal URL",
  lib.portalLocationId(
    "?organizationId=x&locationId=c90455cd-1111-2222-3333-444455556666&hspage=login",
  ) === "c90455cd-1111-2222-3333-444455556666" &&
    lib.portalLocationId("?locationId=../../x") === null,
);

// 4. The component renders exactly the default text, no wrapper element.
const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const markup = renderToStaticMarkup(
  React.createElement(comp.IspPortalSupport, { fallback: "Support: ask venue staff" }),
);
check("initial render is exactly the default text", markup === "Support: ask venue staff", markup);
const compSrc = readFileSync(
  join(ROOT, "src/components/isp-partner/portal/IspPortalSupport.tsx"),
  "utf8",
);
check(
  "backend call only after the ISP-host check",
  compSrc.indexOf("isIspPortalHost(window.location.hostname)) return;") > 0 &&
    compSrc.indexOf("isIspPortalHost(window.location.hostname)) return;") <
      compSrc.indexOf("fetchPortalSupport(locationId)"),
);
let fetched = 0;
globalThis.fetch = async () => {
  fetched += 1;
  return { ok: false };
};
check(
  "fetch failure -> null (default text stays)",
  (await lib.fetchPortalSupport("c90455cd-1111-2222-3333-444455556666")) === null && fetched === 1,
);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
console.log("all checks passed");
