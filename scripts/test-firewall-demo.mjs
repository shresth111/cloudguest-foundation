/**
 * Security in the DEMO workspace: Firewall, Block Websites (specific
 * websites, apps, categories, bypass protection, the Advanced rule list),
 * the Security Score and Port Forwarding.
 *
 * The real services are bundled and called with the demo session the way
 * demo.wyfyguest.com has it (sentinel token in localStorage, demo hostname).
 * Every XMLHttpRequest / fetch is recorded.
 *
 * FAILURE MODES THIS LOCKS DOWN
 *
 *   1. A DEMO CALL THAT REACHES THE BACKEND. Every read and every write the
 *      Security screens make answers with zero network requests.
 *   2. FIXTURES ON A REAL HOST. Off the demo host the same calls go to the
 *      network: the fixtures are behind the host check, not always on.
 *   3. AN EMPTY-LOOKING DEMO. The venue has routers the screens can write
 *      to, realistic rules (torrent ports, a printer allow, guest-to-staff
 *      deny), flood limit and guest isolation on with an AP note, website /
 *      address / app blocks, Cloudflare categories with harmful sites on,
 *      bypass protection, a Security Score and port forwards.
 *   4. WRITES THAT DO NOTHING. Toggle, add, delete, Apply, flood preset,
 *      isolation, app block, category save and bypass all change what the
 *      next read returns -- the same local-update behaviour as the rest of
 *      the demo -- without a request.
 *   5. LEAKS. No 10.20.x address, no WireGuard/tunnel wording, no phone
 *      number anywhere in what the screens are given.
 *
 * Run: node scripts/test-firewall-demo.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let passed = 0;
function check(name, ok, extra = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

// --- a browser-shaped global, before the bundle loads ----------------------
const requests = [];
const store = new Map([["cloudguest_token", "demo-access-token"]]);
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
const location = {
  hostname: "demo.wyfyguest.com",
  href: "https://demo.wyfyguest.com/firewall",
  pathname: "/firewall",
  origin: "https://demo.wyfyguest.com",
  search: "",
};
class RecordingXHR {
  constructor() {
    this.readyState = 0;
    this.headers = {};
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  getAllResponseHeaders() {
    return "";
  }
  send() {
    requests.push(`${this.method} ${this.url}`);
    setTimeout(() => this.onerror?.(new Error("network disabled in test")), 0);
  }
  abort() {}
  addEventListener() {}
  removeEventListener() {}
}
globalThis.window = globalThis;
globalThis.localStorage = localStorage;
globalThis.sessionStorage = localStorage;
globalThis.location = location;
globalThis.document = { cookie: "", createElement: () => ({}) };
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "node" },
  configurable: true,
});
globalThis.XMLHttpRequest = RecordingXHR;
globalThis.fetch = async (url) => {
  requests.push(`fetch ${url}`);
  throw new Error("network disabled in test");
};

const outdir = mkdtempSync(join(tmpdir(), "firewall-demo-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(outdir, "entry.ts");
writeFileSync(
  entry,
  `export { firewallService } from "${p("src/services/firewall.service.ts")}";
   export { contentFilterService } from "${p("src/services/contentFilter.service.ts")}";
   export { dnsFilteringService } from "${p("src/services/dns-filtering.service.ts")}";
   export { securityService } from "${p("src/services/security.service.ts")}";
   export { connectedDeviceService } from "${p("src/services/connected-device.service.ts")}";
   export { dhcpService } from "${p("src/services/dhcp.service.ts")}";
   export { portForwardingService } from "${p("src/services/port-forwarding.service.ts")}";
   export { routerService } from "${p("src/services/router.service.ts")}";
   export { privateNetworkRules, privateNetworksOn, isCustomerEditable, deviceTagOf, pickableDevices } from "${p("src/lib/firewall-rules.ts")}";
   export { partitionRoutersByDeviceWrite } from "${p("src/lib/router-vendors.ts")}";
   export { harmfulSitesOn } from "${p("src/lib/web-filtering.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile,
  logLevel: "error",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: { "@": p("src") },
  define: {
    // Not opted in by build flag: the demo is on because of the hostname.
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "/api/v1",
    }),
    "process.env.NODE_ENV": '"production"',
  },
});
const m = await import(`file://${outfile}`);
const {
  firewallService,
  contentFilterService,
  dnsFilteringService,
  securityService,
  connectedDeviceService,
  dhcpService,
  portForwardingService,
  routerService,
} = m;

const seen = []; // everything the screens are handed, for the leak checks
const keep = (x) => {
  seen.push(x);
  return x;
};

// ---------------------------------------------------------------------------
console.log("\nthe venue's routers");
const hq = keep(await routerService.listVenueRouters("loc-1", ""));
check(
  "Mumbai HQ has the Lobby and Floor 2 routers",
  hq.length === 2 && hq[0].id === "r-1" && hq[1].id === "r-1-floor2",
  hq.map((r) => r.name).join(", "),
);
check(
  "both are routers the Security screens can write to",
  m.partitionRoutersByDeviceWrite(hq).writable.length === 2,
);
const other = keep(await routerService.listVenueRouters("loc-2", ""));
check("another demo venue is not empty", other.length === 1);
const plain = await routerService.listForLocation("loc-1", "");
check(
  "listForLocation's own demo rows are unchanged (no other screen gains routers)",
  plain.length === 0,
  String(plain.length),
);

// ---------------------------------------------------------------------------
console.log("\nFirewall: rules");
const lobby = keep(await firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 }));
const floor2 = keep(await firewallService.list({ routerId: "r-1-floor2", page: 1, pageSize: 100 }));
check("Lobby router has several rules", lobby.rows.length >= 8, String(lobby.rows.length));
check(
  "torrent ports are blocked",
  lobby.rows.some(
    (r) => r.action === "drop" && r.destinationPort === 6881 && r.protocol === "tcp",
  ) &&
    lobby.rows.some(
      (r) => r.action === "drop" && r.destinationPort === 6881 && r.protocol === "udp",
    ),
);
const printer = lobby.rows.find((r) => r.action === "accept" && r.destinationPort === 9100);
check(
  "guests may reach the printer, shown by its name",
  !!printer && m.deviceTagOf(printer, "where")?.name === "Front-desk printer",
);
check(
  "a guest-to-staff deny",
  floor2.rows.some(
    (r) =>
      r.action === "drop" &&
      r.sourceAddress === "10.5.50.0/24" &&
      r.destinationAddress === "10.5.40.0/24",
  ),
);
check(
  "most rules are editable from the customer screen",
  lobby.rows.filter((r) => m.isCustomerEditable(r).editable).length >= 7,
);
check(
  "one rule is saved but not applied (Apply has something to do)",
  lobby.rows.filter((r) => r.devicePushStatus === "pending").length === 1,
);
const band = keep(await firewallService.getBand("r-1"));
check(
  "router is ready for rules",
  band?.state === "ready" && band.guestNetworks[0] === "10.5.50.0/24",
);
check(
  "'keep guests off private networks' is on at the Lobby router",
  m.privateNetworksOn(lobby.rows, m.privateNetworkRules(band.guestNetworks, band.guestDnsServers)),
);
const again = await firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 });
check(
  "stable: the same rules on a second read",
  JSON.stringify(again.rows) === JSON.stringify(lobby.rows),
);

console.log("\nFirewall: writes change the next read");
const torrent = lobby.rows.find((r) => r.destinationPort === 6881 && r.protocol === "tcp");
await firewallService.update(torrent.id, { isEnabled: false });
let now = await firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 });
check("toggle off sticks", now.rows.find((r) => r.id === torrent.id)?.isEnabled === false);
const created = await firewallService.create({
  routerId: "r-1",
  name: "Block game voice chat",
  chain: "forward",
  action: "drop",
  protocol: "udp",
  sourceAddress: "10.5.50.0/24",
  destinationPort: 3478,
  priority: 75,
});
now = await firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 });
check(
  "an added rule appears, saved not applied",
  now.rows.some((r) => r.id === created.id && r.devicePushStatus === "pending"),
);
const pushed = await firewallService.push("r-1");
check(
  "Apply reports what it put on and took off",
  pushed.added >= 2 && pushed.removed >= 1,
  JSON.stringify({ a: pushed.added, r: pushed.removed, u: pushed.unchanged }),
);
now = await firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 });
check(
  "after Apply nothing is left waiting",
  now.rows.every((r) => r.devicePushStatus !== "pending" && r.devicePushStatus !== "failed"),
);
await firewallService.remove(created.id);
now = await firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 });
check("delete removes it", !now.rows.some((r) => r.id === created.id));
await firewallService.update(torrent.id, { isEnabled: true });

console.log("\nFirewall: flood limit and guest isolation");
const flood = keep(await firewallService.getFloodLimit("r-1"));
check(
  "flood limit is on at Normal",
  flood?.enabled && flood.preset === "normal" && flood.limit === 150,
);
check("all three levels carry a cap", flood.presets.relaxed === 300 && flood.presets.strict === 80);
await firewallService.setFloodLimit("r-1", "strict");
check("a new level sticks", (await firewallService.getFloodLimit("r-1")).preset === "strict");
await firewallService.setFloodLimit("r-1", "off");
check("off sticks", (await firewallService.getFloodLimit("r-1")).enabled === false);
await firewallService.setFloodLimit("r-1", "normal");
const iso = keep(await firewallService.getGuestIsolation("r-1"));
check(
  "guest isolation is on between ports",
  iso?.enabled && iso.betweenPorts && iso.refusal === null,
);
check(
  "ports are listed and the WAN is left out",
  iso.ports.some((p) => p.excludedReason === "wan") && iso.isolatedPorts >= 3,
);
check("the access-point note is due", iso.apIsolationNeeded === true && iso.apPorts >= 1);
await firewallService.setGuestIsolation("r-1", false);
check("isolation off sticks", (await firewallService.getGuestIsolation("r-1")).enabled === false);
await firewallService.setGuestIsolation("r-1", true);
check(
  "Floor 2 router isolates its own Wi-Fi",
  (await firewallService.getGuestIsolation("r-1-floor2")).radiosIsolated === true,
);

console.log("\nFirewall: the rule dialog's device picker");
const devices = keep(await connectedDeviceService.list("r-1", 1, 100));
const leases = keep(await dhcpService.listLeases("r-1"));
const where = m.pickableDevices(devices.rows, leases, ["10.5.50.0/24"], "where");
check(
  "venue devices are offered as a destination",
  where.some((d) => d.name === "Front-desk printer"),
);
check(
  "guests are not offered as a destination",
  where.every((d) => !d.isGuest),
);
check(
  "the printer's address is already kept",
  where.find((d) => d.name === "Front-desk printer")?.lease === "static",
);
const nvr = where.find((d) => d.name === "CCTV recorder");
const kept = await dhcpService.keepLeaseAddress("r-1", nvr.mac, nvr.ip);
check(
  "keep-address works and sticks",
  kept.changed &&
    !(await dhcpService.listLeases("r-1")).find((l) => l.macAddress === nvr.mac).dynamic,
);

// ---------------------------------------------------------------------------
console.log("\nBlock Websites: specific websites, addresses, apps");
const sites = keep(
  await contentFilterService.list({
    routerId: "r-1",
    page: 1,
    pageSize: 100,
    excludeAppRules: true,
  }),
);
check(
  "websites are blocked by name",
  sites.rows.filter((r) => r.valueType === "domain").length >= 3,
);
check(
  "addresses are blocked (Advanced)",
  sites.rows.filter((r) => r.valueType === "ip_cidr").length >= 2,
);
check(
  "only example.* website names",
  sites.rows
    .filter((r) => r.valueType === "domain")
    .every((r) => /\.example\.(com|net|org)$/.test(r.value)),
);
check(
  "app rows are kept out of the website box",
  sites.rows.every((r) => !r.appKey),
);
const all = keep(await contentFilterService.list({ routerId: "r-1", page: 1, pageSize: 100 }));
check(
  "the Advanced list includes the app rows",
  all.rows.some((r) => r.appKey === "torrents"),
);
const apps = keep(await contentFilterService.listApps("r-1"));
const st = (list, key) => list.items.find((a) => a.key === key)?.state;
check("torrent sites are blocked at the Lobby", st(apps, "torrents") === "blocked");
check("guests keep Instagram", st(apps, "instagram") === "not_blocked");
const staffApps = keep(await contentFilterService.listApps("r-1-floor2"));
check(
  "social apps are off on the staff router",
  ["instagram", "facebook", "short_video", "snapchat"].every((k) => st(staffApps, k) === "blocked"),
);
check("the apps box carries its limitations", apps.limitations.length === 3);
await contentFilterService.blockApp("r-1", "youtube");
check(
  "blocking an app sticks",
  st(await contentFilterService.listApps("r-1"), "youtube") === "blocked",
);
await contentFilterService.unblockApp("r-1", "youtube");
check(
  "unblocking it sticks",
  st(await contentFilterService.listApps("r-1"), "youtube") === "not_blocked",
);
const site = await contentFilterService.create({
  routerId: "r-1",
  name: "streams.example.com",
  valueType: "domain",
  value: "streams.example.com",
  category: "custom",
  isEnabled: true,
});
await contentFilterService.push(site.id);
check(
  "Block + push puts a new website on the list as applied",
  (await contentFilterService.list({ routerId: "r-1", page: 1, pageSize: 100 })).rows.some(
    (r) => r.id === site.id && r.devicePushStatus === "active",
  ),
);
await contentFilterService.remove(site.id);

console.log("\nBlock Websites: categories and bypass protection");
const cats = keep(await dnsFilteringService.categories("loc-1"));
check("categories are set up", cats.state === "ready" && cats.items.length >= 5);
check(
  "a Security threats group exists",
  cats.items.some((c) => c.isSecurity && c.subcategories.length >= 3),
);
const policy = keep(await dnsFilteringService.locationPolicy("loc-1"));
check("Mumbai HQ has its own list", policy.source === "location");
check(
  "known harmful websites are blocked",
  m.harmfulSitesOn(policy.effectiveCategoryIds, cats.items),
);
const named = (n) => cats.items.find((c) => c.name === n);
check(
  "adult and gambling are blocked, social networks are not",
  policy.effectiveCategoryIds.includes(named("Adult themes").id) &&
    policy.effectiveCategoryIds.includes(named("Gambling").id) &&
    !policy.effectiveCategoryIds.includes(149),
);
const status = keep(await dnsFilteringService.routerStatus("r-1"));
check(
  "filtering is on at the Lobby router",
  status.state === "active" && status.devicePushStatus === "active",
);
check(
  "bypass protection is on",
  status.bypassHardeningEnabled && status.bypassHardeningStatus === "active",
);
await dnsFilteringService.setLocationPolicy("loc-1", [...policy.effectiveCategoryIds, 149]);
check(
  "saving a list reaches the routers' status",
  (await dnsFilteringService.routerStatus("r-1-floor2")).effectiveCategoryIds.includes(149),
);
await dnsFilteringService.setLocationPolicy("loc-1", policy.effectiveCategoryIds);
await dnsFilteringService.setBypassHardening("r-1", false);
check(
  "bypass off sticks",
  (await dnsFilteringService.routerStatus("r-1")).bypassHardeningEnabled === false,
);
await dnsFilteringService.setBypassHardening("r-1", true);
await dnsFilteringService.disable("r-1-floor2");
check(
  "Turn off sticks",
  (await dnsFilteringService.routerStatus("r-1-floor2")).state === "disabled",
);
await dnsFilteringService.enable("r-1-floor2");
check("Turn on sticks", (await dnsFilteringService.routerStatus("r-1-floor2")).state === "active");

// ---------------------------------------------------------------------------
console.log("\nSecurity Score");
const ov = keep(await securityService.overview("loc-1"));
check(
  "a score is shown",
  ov.score.available && ov.score.score >= 90 && ov.score.band === "excellent",
  String(ov.score.score),
);
check("four factors", ov.score.factors.length === 4);
const count = (k) => ov.counters.find((c) => c.key === k)?.count;
const fwNow = (await firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 })).rows
  .concat((await firewallService.list({ routerId: "r-1-floor2", page: 1, pageSize: 100 })).rows)
  .filter((r) => r.isEnabled).length;
check(
  "firewall rule count agrees with the Firewall screen",
  count("firewall_rules") === fwNow,
  `${count("firewall_rules")} vs ${fwNow}`,
);
check(
  "blocked domains and addresses are counted",
  count("blocked_domains") > 0 && count("blocked_addresses") >= 2,
);
check(
  "threat counts stay unavailable, as on the real product",
  ov.counters
    .filter((c) => c.key.startsWith("threats_"))
    .every((c) => !c.available && c.count === null),
);
check(
  "fleet: every router reporting",
  ov.fleet.routersTotal === 2 && ov.fleet.routersReporting === 2,
);
const caps = keep(await securityService.capabilities());
check(
  "firewall, flood limit, isolation, categories and apps are offered as working",
  [
    "zone_to_zone_firewall",
    "connection_flood_protection",
    "guest_client_isolation",
    "web_category_filtering",
    "application_control",
  ].every((k) => caps.find((c) => c.key === k)?.availability === "available"),
);

// ---------------------------------------------------------------------------
console.log("\nPort Forwarding");
const pf = keep(await portForwardingService.list({ routerId: "r-1", page: 1, pageSize: 100 }));
check("the Lobby router has port forwards", pf.rows.length === 2);
const off = pf.rows.find((r) => !r.isEnabled);
await portForwardingService.update(off.id, { isEnabled: true });
await portForwardingService.push(off.id);
check(
  "enable + apply sticks",
  (await portForwardingService.list({ routerId: "r-1", page: 1, pageSize: 100 })).rows.find(
    (r) => r.id === off.id,
  )?.devicePushStatus === "active",
);

// ---------------------------------------------------------------------------
console.log("\nnothing leaves the browser, nothing leaks");
check("zero network requests in demo", requests.length === 0, requests.join(", "));
const everything = JSON.stringify(seen);
check("no 10.20.x address", !/\b10\.20\./.test(everything));
check("no WireGuard / tunnel wording", !/wireguard|\bwg\d*\b|tunnel/i.test(everything));
check("no phone number", !/\+91|\b[6-9]\d{9}\b/.test(everything));

console.log("\nthe fixture file stays in its lane");
{
  const src = readFileSync(join(ROOT, "src/lib/firewall-demo.ts"), "utf8");
  check("fixture source: no 10.20.x address", !/\b10\.20\./.test(src));
  check("fixture source: no WireGuard / tunnel detail", !/wireguard|\bwg\d+\b/i.test(src));
  check("fixture source: no phone number", !/\+91|\b[6-9]\d{9}\b/.test(src));
  check(
    "fixture source imports types only",
    [...src.matchAll(/^import\s+(type\s+)?/gm)].every((x) => !!x[1]),
  );
  const importers = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && /lib\/firewall-demo"/.test(readFileSync(full, "utf8")))
        importers.push(full.slice(ROOT.length + 1));
    }
  };
  walk(join(ROOT, "src"));
  check(
    "imported only by services",
    importers.length > 0 && importers.every((f) => f.startsWith("src/services/")),
    importers.join(", "),
  );
  const ungated = [];
  for (const f of importers) {
    readFileSync(join(ROOT, f), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/\bdemo[A-Z]\w*\(/.test(line) && !/isDemo(Session)?\(\)/.test(line))
          ungated.push(`${f}:${i + 1}`);
      });
  }
  check("every fixture call sits behind the demo check", ungated.length === 0, ungated.join(", "));
}

console.log("\noff the demo host the fixtures are not served");
location.hostname = "app.wyfyguest.com";
const calls = [
  ["firewall rules", () => firewallService.list({ routerId: "r-1", page: 1, pageSize: 100 })],
  ["flood limit", () => firewallService.getFloodLimit("r-1", "org-1")],
  ["website blocks", () => contentFilterService.list({ routerId: "r-1", page: 1, pageSize: 100 })],
  ["categories", () => dnsFilteringService.categories("loc-1")],
  ["security overview", () => securityService.overview("loc-1")],
  ["venue routers", () => routerService.listVenueRouters("loc-1", "org-1")],
  ["port forwards", () => portForwardingService.list({ routerId: "r-1", page: 1, pageSize: 100 })],
];
for (const [name, call] of calls) {
  const before = requests.length;
  await call().catch(() => {});
  check(`${name} go to the network on app.wyfyguest.com`, requests.length > before);
}

console.log(
  failures === 0
    ? `\nall ${passed} firewall demo checks passed\n`
    : `\n${failures} firewall demo check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
