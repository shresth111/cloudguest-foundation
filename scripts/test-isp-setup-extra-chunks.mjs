/**
 * Guard: the TR-069 step appended to the END of the partner setup script.
 *
 * Proves, against the REAL RouterDetailTabs.tsx generator:
 *  - flag OFF: the build plugin transforms no module, so the bundle is
 *    byte-identical;
 *  - flag ON, nothing registered (TR-069 off, or any non-partner page): the
 *    chunks, the .rsc and the one-line copy are byte-identical to an
 *    untransformed build of the same generator;
 *  - registered on the partner host: the TR-069 chunk is the LAST chunk, and
 *    it appears in the .rsc and the one-line copy, after every main chunk;
 *  - registered but not on a partner host (Master/customer): unchanged;
 *  - the TR-069 chunk passes the panel's own chunk validator.
 *
 * Run: node scripts/test-isp-setup-extra-chunks.mjs
 */
import { build } from "esbuild";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const work = mkdtempSync(join(ROOT, "node_modules/.cache/isp-setup-chunks-"));

let failures = 0;
let checks = 0;
const check = (name, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- ${detail}`}`);
};

const srcAlias = {
  name: "src-alias",
  setup(b) {
    b.onResolve({ filter: /^@\// }, (args) => {
      const base = join(ROOT, "src", args.path.slice(2));
      for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")])
        if (existsSync(p) && extname(p)) return { path: p };
      return { errors: [{ text: `cannot resolve ${args.path}` }] };
    });
  },
};

// the plugin module itself
await build({
  entryPoints: [join(ROOT, "vite-plugins/isp-setup-extra-chunks.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "plugin.mjs"),
  logLevel: "silent",
  external: ["vite"],
});
const plugin = await import(pathToFileURL(join(work, "plugin.mjs")).href);

const TABS = join(ROOT, "src/components/routers/RouterDetailTabs.tsx");
const tabs = readFileSync(TABS, "utf8");
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
  const off = plugin.ispSetupExtraChunks(env);
  const touched = files.filter((f) => off.transform.call(ctx, readFileSync(f, "utf8"), f) !== null);
  check(
    `flag ${JSON.stringify(env.VITE_ISP_PARTNER_ENABLED ?? "unset")}: no module transformed (${files.length})`,
    touched.length === 0,
    touched.join(", "),
  );
}

// 2. Flag ON: only RouterDetailTabs, one line, line numbers kept.
const on = plugin.ispSetupExtraChunks({ VITE_ISP_PARTNER_ENABLED: "true" });
const others = files.filter(
  (f) => f !== TABS && on.transform.call(ctx, readFileSync(f, "utf8"), f) !== null,
);
check("flag on: no other module transformed", others.length === 0, others.join(", "));
const res = on.transform.call(ctx, tabs, TABS);
check("flag on: RouterDetailTabs transformed", Boolean(res));
check(
  "the generator signature exists exactly once",
  tabs.split(plugin.CHUNKS_SIGNATURE).length === 2,
);
const IMPORT_LINE =
  'import { ispAppendSetupChunks as __ispAppendSetupChunks } from "@/lib/isp-partner/setup-extra-chunks";';
const out = res?.code ?? "";
const body = out.slice(0, out.lastIndexOf("\n" + IMPORT_LINE));
check("line numbers kept", body.split("\n").length === tabs.split("\n").length);
check(
  "only the signature line changed",
  body.split("\n").filter((l, i) => l !== tabs.split("\n")[i]).length === 1,
);
check(
  "a changed signature is left alone, with a warning",
  on.transform.call(
    ctx,
    tabs.replace(plugin.CHUNKS_SIGNATURE, "export function buildRouterSetupScriptChunks(o: {"),
    TABS,
  ) === null && ctx.warned.length === 1,
);

// 3. Behaviour: bundle the generator plain and transformed, and compare.
const ENTRY = [
  `export { buildRouterSetupScriptChunks, chunksToRouterOsScript, chunksToSingleLineScript, validateSetupScriptChunks } from "@/components/routers/RouterDetailTabs";`,
  `export { setPartnerSetupExtraChunks, TR069_CHUNK_LABEL } from "@/lib/isp-partner/setup-extra-chunks";`,
].join("\n");
async function bundle(name, transformed) {
  writeFileSync(join(work, `${name}.js`), ENTRY);
  const plugins = [srcAlias];
  if (transformed)
    plugins.unshift({
      name: "apply",
      setup(b) {
        b.onLoad({ filter: /RouterDetailTabs\.tsx$/ }, () => ({
          contents: plugin.transformSetupChunks(tabs),
          loader: "tsx",
        }));
      },
    });
  await build({
    entryPoints: [join(work, `${name}.js`)],
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
      "import.meta.env.VITE_ISP_PARTNER_ENABLED": '"true"',
      "import.meta.env": "{}",
    },
    nodePaths: [resolve(ROOT, "node_modules")],
    plugins,
  });
  return import(pathToFileURL(join(work, `${name}.mjs`)).href);
}
const plain = await bundle("plain", false);
const wrapped = await bundle("wrapped", true);

const OPTS = {
  generatedAt: "2026-10-24T00:00:00.000Z",
  apiBase: "https://network-staging.wyfyguest.com/api/v1",
  agentCredential: "cred-abc123",
  lanBridge: "bridge-guest",
  lanIp: "10.5.50.1",
  lanCidr: "24",
  dnsServers: "8.8.8.8,1.1.1.1",
  hsUser: "guest",
  hsPass: "guestpass",
  enableFirewall: true,
  wans: [{ iface: "ether1", mode: "dhcp" }],
  portalUrl: {
    frontendBase: "https://auth-isp.wyfyguest.com",
    organizationId: "org-1",
    locationId: "loc-1",
    routerId: "rtr-1",
  },
};
const rsc = (m, c) =>
  m.chunksToRouterOsScript(c, "hEX").replace(/^# Generated .*$/m, "# Generated <t>");
const setHost = (h) => {
  globalThis.window = { location: { hostname: h } };
};

setHost("network-staging.wyfyguest.com");
const a = plain.buildRouterSetupScriptChunks(OPTS);
const b = wrapped.buildRouterSetupScriptChunks(OPTS);
check(
  "nothing registered: chunks identical",
  JSON.stringify(a) === JSON.stringify(b),
  `${a.length} vs ${b.length}`,
);
check("nothing registered: .rsc byte-identical", rsc(plain, a) === rsc(wrapped, b));
check(
  "nothing registered: one-line copy byte-identical",
  plain.chunksToSingleLineScript(a) === wrapped.chunksToSingleLineScript(b),
);

const TR =
  '# Wyfy Guest Network: TR-069 management (test)\n/system script remove [find where name="wyfy-tr069-install"]\n/system script add name="wyfy-tr069-install" dont-require-permissions=yes source=":put \\"x\\""\n/system script run wyfy-tr069-install\n';
wrapped.setPartnerSetupExtraChunks([{ label: wrapped.TR069_CHUNK_LABEL, script: TR }]);
const c = wrapped.buildRouterSetupScriptChunks(OPTS);
check("registered: one chunk more", c.length === a.length + 1, `${c.length} vs ${a.length}`);
check(
  "registered: TR-069 chunk is LAST",
  c[c.length - 1].label === wrapped.TR069_CHUNK_LABEL && c[c.length - 1].script === TR,
);
check(
  "registered: main chunks unchanged and first",
  JSON.stringify(c.slice(0, a.length)) === JSON.stringify(a),
);
const r = wrapped.chunksToRouterOsScript(c, "hEX");
const lastMain = a[a.length - 1].script
  .trim()
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .pop();
check(
  "registered: .rsc carries the step after every main chunk",
  r.includes("/system script run wyfy-tr069-install") &&
    r.lastIndexOf(lastMain) < r.indexOf("/system script run wyfy-tr069-install"),
);
check(
  "registered: one-line copy carries the step",
  wrapped.chunksToSingleLineScript(c).includes("/system script run wyfy-tr069-install"),
);
const issues = wrapped
  .validateSetupScriptChunks([c[c.length - 1]])
  .flatMap((x) => x.issues)
  .filter((i) => i.severity === "error");
check(
  "TR-069 chunk passes the panel validator",
  issues.length === 0,
  JSON.stringify(issues).slice(0, 300),
);

for (const h of ["master.wyfyguest.com", "app.wyfyguest.com", "staging-isp.wyfyguest.com", ""]) {
  setHost(h);
  check(
    `registered but on ${h || "(no window)"}: unchanged`,
    JSON.stringify(wrapped.buildRouterSetupScriptChunks(OPTS)) === JSON.stringify(a),
  );
}
setHost("network-staging.wyfyguest.com");
wrapped.setPartnerSetupExtraChunks([]);
check(
  "cleared: identical again",
  JSON.stringify(wrapped.buildRouterSetupScriptChunks(OPTS)) === JSON.stringify(a),
);

// 4. Wiring.
const step = readFileSync(
  join(ROOT, "src/components/isp-partner/routers/PartnerTr069SetupStep.tsx"),
  "utf8",
);
check(
  "step registers only when the location's TR-069 is on",
  /on && script\.data \?/.test(step) && /enabled === true/.test(step),
);
check("step clears on unmount", /return \(\) => setPartnerSetupExtraChunks\(\[\]\)/.test(step));
check("step tells the user it may reboot", /reboots at the very end/.test(step));
const page = readFileSync(
  join(ROOT, "src/components/isp-partner/routers/RouterDetailPage.tsx"),
  "utf8",
);
check(
  "partner router page mounts the step",
  /<PartnerTr069SetupStep routerId=\{routerId\} locationId=\{device\.data\.locationId\} \/>/.test(
    page,
  ),
);
const card = readFileSync(
  join(ROOT, "src/components/isp-partner/tr069/Tr069ScriptPanel.tsx"),
  "utf8",
);
check(
  "location card keeps the separate script and says it may reboot",
  /reboots at the end/.test(card) && /useTr069RouterScript/.test(card),
);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
console.log("all checks passed");
