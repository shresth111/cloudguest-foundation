/**
 * Contract test for the partner console's customer workspace
 * (`src/components/isp-partner/customer-shell/`, ADDENDUM_04).
 *
 * Pinned here:
 *   1. The workspace nav is the customer dashboard's nav: same groups, same
 *      order, same ids, same labels as `src/lib/customerNav.ts` (bundled
 *      read-only; the customer file is never imported by the shell itself).
 *   2. Every row is gated by ISP grants only (`isp_*` / `tr069.*`), never by a
 *      customer key; only How It Works is open to every ISP user.
 *   3. Add-on rows carry their add-on key, and with the ADDENDUM_04 default
 *      (allowance none) the gate keeps them closed.
 *   4. The slot contract: every slot file registers known nav ids only, the
 *      registry's priority rule holds, and the shell finds slot files by glob
 *      (so a batch adds a file and edits nothing).
 *   5. Hygiene: no WireGuard wording, no fixtures, no customer store, no
 *      import of the customer nav from the shell, and the route is a
 *      client-only un-nested sibling of the existing customer page.
 *
 * Run: node scripts/test-isp-partner-customer-shell.mjs
 */
import { build } from "esbuild";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SHELL = join(ROOT, "src/components/isp-partner/customer-shell");
let failures = 0;
let checks = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-shell-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { CUSTOMER_NAV_GROUPS } from "${p("src/lib/customerNav.ts")}";
   export * from "${p("src/components/isp-partner/customer-shell/nav.ts")}";
   export { useAddonOpen } from "${p("src/components/isp-partner/customer-shell/addons.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  nodePaths: [join(ROOT, "node_modules")],
  external: ["lucide-react"],
  plugins: [
    {
      name: "at-alias",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) =>
          b.resolve(`./src/${args.path.slice(2)}`, { resolveDir: ROOT, kind: args.kind }),
        );
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx" },
});
const mod = await import(outfile);
const { CUSTOMER_NAV_GROUPS, PARTNER_CUSTOMER_NAV_GROUPS, PARTNER_CUSTOMER_NAV } = mod;

// 1. Parity with the customer dashboard nav.
const shape = (groups) =>
  groups.map((g) => `${g.id}|${g.label}: ${g.items.map((i) => `${i.id}=${i.label}`).join(", ")}`);
const want = shape(CUSTOMER_NAV_GROUPS);
const got = shape(PARTNER_CUSTOMER_NAV_GROUPS);
check(
  "same number of groups as the customer nav",
  want.length === got.length,
  `${got.length} vs ${want.length}`,
);
want.forEach((w, i) =>
  check(
    `group ${i + 1} matches the customer nav`,
    got[i] === w,
    `\n     want ${w}\n     got  ${got[i]}`,
  ),
);

// 2. ISP grants only.
const ISP_KEY = /^(isp_[a-z]+|tr069)\.[a-z]+$/;
for (const item of PARTNER_CUSTOMER_NAV) {
  check(`${item.id}: has a scope`, ["customer", "location", "isp"].includes(item.scope));
  check(
    `${item.id}: gates are ISP keys only`,
    item.anyOf.every((k) => ISP_KEY.test(k)),
    item.anyOf.join(","),
  );
  if (item.id !== "how-it-works")
    check(`${item.id}: needs at least one grant`, item.anyOf.length > 0);
}
const by = Object.fromEntries(PARTNER_CUSTOMER_NAV.map((i) => [i.id, i]));
check("Firewall needs isp_security", by.firewall.anyOf.join() === "isp_security.read");
check("Fix a Problem needs isp_ops.execute", by.debugging.anyOf.join() === "isp_ops.execute");
check(
  "Staff Activity is owner/admin (isp_partner.assign)",
  by["admin-logs"].anyOf.join() === "isp_partner.assign",
);
check("Support Tickets is ISP-level", by.tickets.scope === "isp");
check(
  "Network rows are location-level",
  ["dhcp", "vlans", "port-forwarding", "voip", "isp-details"].every(
    (id) => by[id].scope === "location",
  ),
);

const viewerCan = new Set([
  "isp_partner.read",
  "isp_logs.read",
  "isp_engage.read",
  "isp_security.read",
  "isp_monitor.read",
  "isp_support.read",
]);
const visible = mod
  .visiblePartnerNavGroups((k) => viewerCan.has(k))
  .flatMap((g) => g.items.map((i) => i.id));
check("a viewer does not see Fix a Problem", !visible.includes("debugging"));
check("a viewer does not see Staff Activity", !visible.includes("admin-logs"));
check("a viewer sees How It Works", visible.includes("how-it-works"));
const none = mod.visiblePartnerNavGroups(() => false);
check(
  "no grants: only How It Works left, empty groups dropped",
  none.length === 1 && none[0].items.length === 1 && none[0].items[0].id === "how-it-works",
);

// 3. Add-ons.
check("Guest Messaging is the guest_marketing add-on", by.marketing.addon === "guest_marketing");
check("Traffic Lens is the traffic_flow add-on", by["traffic-lens"].addon === "traffic_flow");
check("only those two rows are add-ons", PARTNER_CUSTOMER_NAV.filter((i) => i.addon).length === 2);
check(
  "default allowance none: add-ons stay closed",
  !mod.useAddonOpen("c", "guest_marketing") && !mod.useAddonOpen("c", "traffic_flow"),
);
check("a non-add-on row is open", mod.useAddonOpen("c", undefined));

// 4. Slot contract.
const slotsSrc = readFileSync(join(SHELL, "slots.ts"), "utf8");
check(
  "shell collects slot files by glob",
  /import\.meta\.glob<SlotModule>\("\.\/slots\/\*\.tsx", \{ eager: true \}\)/.test(slotsSrc),
);
const ids = new Set(PARTNER_CUSTOMER_NAV.map((i) => i.id));
const slotFiles = readdirSync(join(SHELL, "slots")).filter((f) => f.endsWith(".tsx"));
check("built-in slot file exists", slotFiles.includes("00-existing.tsx"));
for (const f of slotFiles) {
  const src = readFileSync(join(SHELL, "slots", f), "utf8");
  check(`${f}: exports slots`, /export const slots\s*:\s*PartnerSlot\[\]/.test(src));
  const used = [...src.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
  check(`${f}: registers at least one slot`, used.length > 0);
  for (const id of used) check(`${f}: slot id "${id}" is a nav id`, ids.has(id));
}
const reg = await build({
  stdin: {
    contents: slotsSrc.replace(/import\.meta\.glob[^)]*\)/, "({})"),
    loader: "ts",
    resolveDir: SHELL,
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
  plugins: [
    {
      name: "types-only",
      setup(b) {
        b.onResolve({ filter: /^@\// }, () => ({ path: "x", namespace: "empty" }));
        b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "", loader: "js" }));
      },
    },
  ],
});
const regMod = await import(`data:text/javascript,${encodeURIComponent(reg.outputFiles[0].text)}`);
const A = () => null,
  B = () => null,
  C = () => null;
const r = regMod.buildSlotRegistry({
  "./slots/00-existing.tsx": {
    slots: [
      { id: "dhcp", component: A },
      { id: "vlans", component: A },
    ],
  },
  "./slots/b2.tsx": { slots: [{ id: "dhcp", component: B, priority: 10 }] },
  "./slots/b3.tsx": { slots: [{ id: "vlans", component: C, priority: -1 }] },
});
check("higher priority replaces a built-in", r.get("dhcp").component === B);
check("lower priority does not replace", r.get("vlans").component === A);
check("unregistered id has no slot (shell shows Coming soon)", !r.has("firewall"));

// 5. Hygiene.
const allSrc = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? allSrc(join(dir, d.name)) : [readFileSync(join(dir, d.name), "utf8")],
  );
const shellSrc = allSrc(SHELL).join("\n");
check("no WireGuard wording in the shell", !/wireguard/i.test(shellSrc));
check("no fixtures in the shell", !/__fixtures__|fixtures/.test(shellSrc));
check("no customer store in the shell", !/useCustomerStore/.test(shellSrc));
check("shell does not import the customer nav", !/@\/lib\/customerNav/.test(shellSrc));
check("Coming soon screen is honest", /Coming in this console soon/.test(shellSrc));
const routeFile = join(ROOT, "src/routes/partner.customers.$ispCustomerId_.$feature.tsx");
check("route file exists (un-nested sibling)", existsSync(routeFile));
const routeSrc = existsSync(routeFile) ? readFileSync(routeFile, "utf8") : "";
check("route is client-only", /ssr:\s*false/.test(routeSrc));
check("route validates ?location as a uuid", /UUID\.test\(search\.location\)/.test(routeSrc));
const ws = readFileSync(join(SHELL, "CustomerWorkspace.tsx"), "utf8");
check(
  "pages mount inside VenueScope when a location is picked",
  /<VenueScope[\s\S]*?\{body\}[\s\S]*?<\/VenueScope>/.test(ws),
);
check(
  "URL location must be one of this customer's",
  /locations\.find\(\(l\) => l\.id === locationId\)/.test(ws),
);
check("phones get a drawer", /lg:hidden[\s\S]*role="dialog"/.test(ws));

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
