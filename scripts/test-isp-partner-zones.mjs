/**
 * ZONE-1 zone tree + "Switch zone" helpers (`src/lib/isp-partner/zones.ts`).
 * Pins: the tree is built without losing orphans or looping on a cycle;
 * search keeps the path to a match; a zone cannot move under its own
 * subtree; which requests carry `scope_zone_id` (never `/isp/me`, never the
 * tree itself, never non-`/isp` calls); and the per-user selection with
 * `?zone=` overriding and `?zone=all` clearing.
 *
 * Run: node scripts/test-isp-partner-zones.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-zones-"));
const outfile = join(outdir, "zones.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/zones.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const m = await import(outfile);

let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`,
  );
};

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const node = (n, name, parent, extra = {}) => ({
  id: id(n),
  name,
  parent_id: parent === null ? null : id(parent),
  depth: 0,
  path_ids: [],
  path_names: [name],
  city: null,
  state_code: null,
  children: 0,
  customers: 0,
  subscribers: 0,
  subtree_customers: 0,
  subtree_subscribers: 0,
  can_delete: true,
  ...extra,
});
// North (1) > Sector 12 (2) > Block B (3); North > alpha (4); South (5); orphan (6, parent 99)
const nodes = [
  node(3, "Block B", 2, { city: "Noida" }),
  node(1, "North", null),
  node(2, "Sector 12", 1),
  node(5, "South", null),
  node(4, "alpha", 1),
  node(6, "Orphan", 99),
];
const names = (items) => items.map((i) => [i.node.name, names(i.children)]);

const tree = m.buildZoneTree(nodes);
eq("forest with orphan as root, siblings by name (case-insensitive)", names(tree), [
  [
    "North",
    [
      ["alpha", []],
      ["Sector 12", [["Block B", []]]],
    ],
  ],
  ["Orphan", []],
  ["South", []],
]);
eq(
  "descendants of North",
  m.zoneDescendantIds(nodes, id(1)).sort(),
  [id(1), id(2), id(3), id(4)].sort(),
);
eq("descendants of a leaf", m.zoneDescendantIds(nodes, id(3)), [id(3)]);
const cyc = [node(7, "A", 8), node(8, "B", 7)];
eq("descendants survive a cycle", m.zoneDescendantIds(cyc, id(7)).sort(), [id(7), id(8)].sort());
eq(
  "North cannot move under itself or its subtree",
  m
    .allowedParents(nodes, id(1))
    .map((n) => n.name)
    .sort(),
  ["Orphan", "South"],
);
eq(
  "Sector 12 may move under North, alpha, South, Orphan",
  m
    .allowedParents(nodes, id(2))
    .map((n) => n.name)
    .sort(),
  ["North", "Orphan", "South", "alpha"],
);
eq("search keeps the path to a match", names(m.filterZoneTree(tree, "block")), [
  ["North", [["Sector 12", [["Block B", []]]]]],
]);
eq("search by city", names(m.filterZoneTree(tree, "noida")).length, 1);
eq("search no match", m.filterZoneTree(tree, "zzz"), []);
eq("empty search = whole tree", m.filterZoneTree(tree, "  ").length, 3);
eq(
  "path label",
  m.zonePathLabel({ name: "Block B", path_names: ["North", "Sector 12", "Block B"] }),
  "North › Sector 12 › Block B",
);

// which calls carry the zone
eq("subscribers list scoped", m.shouldScopeRequest("/isp/subscribers/directory"), true);
eq("absolute api url scoped", m.shouldScopeRequest("https://api.x/api/v1/isp/routers"), true);
eq("/isp/me not scoped", m.shouldScopeRequest("/isp/me"), false);
eq("/isp/me?x not scoped", m.shouldScopeRequest("/isp/me?x=1"), false);
eq("/isp/zones/tree not scoped", m.shouldScopeRequest("/isp/zones/tree"), false);
eq("/isp/zones not scoped", m.shouldScopeRequest("/isp/zones"), false);
eq("/isp/members is scoped (prefix is not /isp/me/)", m.shouldScopeRequest("/isp/members"), true);
eq("venue call not scoped", m.shouldScopeRequest("/guests"), false);
eq("auth not scoped", m.shouldScopeRequest("/auth/login"), false);
eq("undefined url", m.shouldScopeRequest(undefined), false);

// selection store
const mem = () => {
  const s = new Map();
  return {
    getItem: (k) => (s.has(k) ? s.get(k) : null),
    setItem: (k, v) => s.set(k, String(v)),
    removeItem: (k) => s.delete(k),
    dump: () => Object.fromEntries(s),
  };
};
const st = mem();
let notified = 0;
const off = m.subscribeZoneScope(() => (notified += 1));
eq("nothing saved -> all zones", m.initZoneScope("u1", "", st), null);
m.setZoneScope(id(2), st);
eq("selection saved per user", st.dump(), { "wyfy.isp.zone.u1": id(2) });
eq("restored on next load", m.initZoneScope("u1", "", st), id(2));
eq("another user does not inherit it", m.initZoneScope("u2", "", st), null);
eq("?zone= wins and is saved", m.initZoneScope("u1", `?zone=${id(5)}`, st), id(5));
eq("saved after ?zone=", st.getItem("wyfy.isp.zone.u1"), id(5));
eq("?zone=all clears", m.initZoneScope("u1", "?zone=all", st), null);
eq("cleared in storage", st.getItem("wyfy.isp.zone.u1"), null);
eq("garbage ?zone= ignored", m.initZoneScope("u1", "?zone=../../x", st), null);
st.setItem("wyfy.isp.zone.u1", "not-a-uuid");
eq("garbage in storage ignored", m.initZoneScope("u1", "", st), null);
m.setZoneScope(id(1), st);
m.setZoneScope(null, st);
eq("all zones removes the key", st.getItem("wyfy.isp.zone.u1"), null);
eq("listeners notified", notified > 0, true);
m.setZoneScope(id(3), st);
m.resetZoneScope();
eq("reset clears memory", m.getZoneScope(), null);
eq("reset keeps the saved choice for next sign-in", st.getItem("wyfy.isp.zone.u1"), id(3));
off();

// totals ordering
const rows = [
  { zone_id: id(3), parent_id: id(2), name: "Block B" },
  { zone_id: id(5), parent_id: null, name: "South" },
  { zone_id: id(2), parent_id: id(1), name: "Sector 12" },
  { zone_id: id(1), parent_id: null, name: "North" },
  { zone_id: id(9), parent_id: id(10), name: "Loop" },
  { zone_id: id(10), parent_id: id(9), name: "Pool" },
];
eq(
  "totals in tree order, cycle rows kept",
  m.orderTotalsDepthFirst(rows).map((r) => r.name),
  ["North", "Sector 12", "Block B", "South", "Loop", "Pool"],
);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
