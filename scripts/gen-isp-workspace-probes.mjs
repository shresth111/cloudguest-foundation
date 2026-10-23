/**
 * Generate the workspace probe manifest the test box's e2e replays
 * (QA pass 1: "every workspace item, with the real param shapes each page
 * sends, for each role").
 *
 * For every item of the partner customer-workspace nav (`customer-shell/nav.ts`)
 * that has a slot (`customer-shell/slots/*.tsx`, highest priority wins), the
 * page collector lists every GET the page can reach and the axios `params`
 * keys it sends; each is then passed through the REAL request shim with a
 * venue pinned, so the manifest holds the exact wire request (URL after the
 * /isp/venue rewrite, params after the scope-alias rename).
 *
 * Run: node scripts/gen-isp-workspace-probes.mjs > scripts/lib/isp-workspace-probes.json
 */
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { makeCollector, UUID } from "./lib/isp-page-calls.mjs";
import { loadShim } from "./lib/isp-shim-bundle.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// -- nav ------------------------------------------------------
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-nav-"));
const navOut = join(dir, "nav.mjs");
await build({
  entryPoints: [join(ROOT, "src/components/isp-partner/customer-shell/nav.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: navOut,
  logLevel: "silent",
  external: ["lucide-react", "react"],
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
const navMod = await import(navOut);
const NAV = navMod.PARTNER_CUSTOMER_NAV;

// -- slots ---------------------------------------------------------------------
const SLOTS_DIR = "src/components/isp-partner/customer-shell/slots";
const slotFor = new Map();
for (const f of readdirSync(join(ROOT, SLOTS_DIR)).sort()) {
  const rel = `${SLOTS_DIR}/${f}`;
  const text = read(rel);
  const imports = new Map();
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    for (const name of m[1]
      .split(",")
      .map((x) =>
        x
          .trim()
          .split(/\s+as\s+/)
          .pop(),
      )
      .filter(Boolean))
      imports.set(name, m[2]);
  }
  for (const m of text.matchAll(
    /\{\s*id:\s*"([^"]+)"\s*,(?:\s*priority:\s*(\d+)\s*,)?\s*component:\s*(\w+)/g,
  )) {
    const [, id, prio, comp] = m;
    const spec = imports.get(comp);
    if (!spec) continue;
    const file = `src/${spec.slice(2)}.tsx`;
    const prev = slotFor.get(id);
    if (!prev || Number(prio ?? 0) >= prev.priority)
      slotFor.set(id, { file, exportName: comp, priority: Number(prio ?? 0) });
  }
}

// -- calls through the real shim -------------------------------------------------
const { collect, paramShapes } = makeCollector(ROOT);
const shim = await loadShim(ROOT);
const ISP = "11111111-1111-1111-1111-111111111111";
const CUST = "22222222-2222-2222-2222-222222222222";
const LOC = "33333333-3333-3333-3333-333333333333";
shim.setShimIspOrganization(ISP);
shim.setShimVenue(CUST, LOC);
const KEEP = new Set([
  "location_id",
  "router_id",
  "organization_id",
  "customer_id",
  "page",
  "page_size",
  "days",
  "limit",
  "isp_customer_id",
  "isp_location_id",
  "isp_router_id",
  "start_date",
  "end_date",
  "since",
  "until",
  "voucher_ids",
]);
const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 86400000);
const VALUE = {
  location_id: LOC,
  isp_location_id: LOC,
  organization_id: CUST,
  customer_id: CUST,
  isp_customer_id: CUST,
  router_id: UUID,
  isp_router_id: UUID,
  page: 1,
  page_size: 25,
  days: 30,
  limit: 25,
  start_date: weekAgo.toISOString(),
  end_date: now.toISOString(),
  since: weekAgo.toISOString(),
  until: now.toISOString(),
  voucher_ids: UUID,
};

const items = [];
for (const item of NAV) {
  const slot = slotFor.get(item.id);
  const out = {
    id: item.id,
    label: item.label,
    scope: item.scope,
    anyOf: [...item.anyOf],
    addon: item.addon ?? null,
    slot: slot ? `${slot.file}#${slot.exportName}` : null,
    gated: [],
    calls: [],
  };
  if (slot) {
    const calls = collect([{ file: slot.file, exportName: slot.exportName }]);
    // Permission keys the page (or a component it mounts) checks with can():
    // a call behind such a check is never made for a role without the key.
    const gated = new Set();
    for (const f of calls.visited ?? []) {
      if (f.startsWith("src/services/")) continue;
      for (const m of read(f).matchAll(/can\(\s*"([a-z0-9_]+\.[a-z0-9_]+)"\s*\)/g)) gated.add(m[1]);
    }
    out.gated = [...gated].sort();
    for (const [key, from] of calls) {
      const [verb, path] = key.split(" ");
      if (verb !== "get" || !path.startsWith("/")) continue;
      const keys = [...(paramShapes.get(key) ?? [])].filter((k) => KEEP.has(k));
      const params = Object.fromEntries(keys.map((k) => [k, VALUE[k]]));
      shim.sent.length = 0;
      await shim.api.request({ method: "get", url: path, params });
      const cfg = shim.sent[0];
      if (!cfg?.url?.startsWith("/isp/")) continue; // not reachable from the partner host
      out.calls.push({
        url: cfg.url.replaceAll(UUID, "{id}"),
        params: cfg.params ?? {},
        from: from.replace(/^src\//, ""),
      });
    }
  }
  items.push(out);
}

const rev = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    return null;
  }
})();
process.stdout.write(
  JSON.stringify(
    {
      generated_from: rev,
      placeholders: { isp: ISP, customer: CUST, location: LOC, id: "{id}" },
      items,
    },
    null,
    1,
  ),
);
