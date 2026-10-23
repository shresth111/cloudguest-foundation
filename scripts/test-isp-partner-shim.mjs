/**
 * Regression test for the ISP partner request shim
 * (`src/lib/isp-partner/api-shim.ts`, API_CONTRACT §7).
 *
 * The partner console mounts the existing `RouterSetupDrilldown` unchanged,
 * and this shim is the only thing that turns its six router-setup calls into
 * the ISP twins. What is pinned here:
 *
 *   1. Each of the six (method + path) rewrites to its `/isp/routers/{id}/...`
 *      twin, query string kept for allocate-external.
 *   2. Everything else passes through untouched -- including a same-path call
 *      with the wrong method -- so an unknown call fails closed at the
 *      original endpoint instead of being guessed at.
 *   3. `force=true` never leaves the browser, and the caller sees an AppError
 *      whose `data.code` is `ISP_FORCE_NOT_ALLOWED` -- i.e. the rejection
 *      survives the REAL `api.ts` response interceptor, which converts
 *      everything with `toAppError`.
 *   4. `X-Organization-Id` is the ISP org once set; `Authorization` is never
 *      touched by the shim.
 *   5. Every path the setup component calls (grepped from its source) is
 *      either on the allowlist or on the documented pass-through list, so a
 *      new call added on main fails this test instead of 403ing in the field.
 *
 * The real `api.ts` and real axios are bundled with esbuild; requests stop at
 * a fake adapter, so nothing touches the network.
 *
 * Run: node scripts/test-isp-partner-shim.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
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
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-shim-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { api } from "${p("src/services/api.ts")}";
   export * from "${p("src/lib/isp-partner/api-shim.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  // Loaded natively from node_modules; bundling axios drags in Node-only CJS.
  external: ["axios"],
  nodePaths: [join(ROOT, "node_modules")],
  define: { "import.meta.env": JSON.stringify({ VITE_API_BASE_URL: "/api/v1" }) },
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
const {
  api,
  installIspApiShim,
  setShimIspOrganization,
  setShimVenue,
  rewriteIspPath,
  rewriteVenuePath,
  HEADER_ISP_CUSTOMER,
  HEADER_ISP_LOCATION,
  ISP_SHIM_REWRITES,
} = mod;

const sent = [];
api.defaults.adapter = async (config) => {
  sent.push(config);
  return {
    data: { success: true, data: { ok: true } },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};
installIspApiShim(api);
installIspApiShim(api); // idempotent
setShimIspOrganization("11111111-1111-1111-1111-111111111111");

const R = "0f8c2a3e-1b2c-4d5e-8f90-123456789abc";
const cases = [
  ["post", `/routers/${R}/provisioning-token`, `/isp/routers/${R}/provisioning-token`],
  [
    "post",
    `/routers/${R}/agent-credential/regenerate`,
    `/isp/routers/${R}/agent-credential/regenerate`,
  ],
  [
    "post",
    `/routers/${R}/wireguard-peer/allocate-external`,
    `/isp/routers/${R}/wireguard-peer/allocate-external`,
  ],
  [
    "post",
    `/routers/${R}/wireguard-peer/allocate-external?rotate=true`,
    `/isp/routers/${R}/wireguard-peer/allocate-external?rotate=true`,
  ],
  ["post", `/radius/nas/register-external/${R}`, `/isp/routers/${R}/radius-nas/register-external`],
  ["put", `/platform/routers/${R}/management-access`, `/isp/routers/${R}/management-access`],
  ["get", `/routers/${R}`, `/isp/routers/${R}/as-router-device`],
];
console.log("rewrites");
check(
  "exactly six rewrite rules",
  ISP_SHIM_REWRITES.length === 6,
  String(ISP_SHIM_REWRITES.length),
);
for (const [method, url, want] of cases) {
  sent.length = 0;
  await api.request({ method, url, data: method === "get" ? undefined : {} });
  const got = sent[0]?.url;
  check(`${method.toUpperCase()} ${url.replace(R, "{id}")}`, got === want, `got ${got}`);
  check(
    `  carries the ISP org header`,
    sent[0]?.headers?.get?.("X-Organization-Id") === "11111111-1111-1111-1111-111111111111",
  );
}

console.log("pass-through");
for (const [method, url] of [
  ["get", `/routers/${R}/wireguard-peer`],
  ["put", `/routers/${R}`],
  ["delete", `/routers/${R}`],
  ["post", "/routers/provisioning/check-in"],
  ["get", "/isp/me"],
  ["get", "/locations"],
]) {
  check(
    `${method.toUpperCase()} ${url.replace(R, "{id}")} untouched`,
    rewriteIspPath(method, url) === null,
  );
}

console.log("force=true");
sent.length = 0;
let rejected = null;
try {
  await api.post(`/routers/${R}/wireguard-peer/allocate-external?rotate=true&force=true`);
} catch (err) {
  rejected = err;
}
check("never sent", sent.length === 0, `${sent.length} sent`);
check(
  "rejects with data.code ISP_FORCE_NOT_ALLOWED",
  rejected?.data?.code === "ISP_FORCE_NOT_ALLOWED",
  JSON.stringify(rejected),
);
check("status 422", rejected?.status === 422, String(rejected?.status));

console.log("authorization untouched");
sent.length = 0;
await api.get("/isp/me", { headers: { Authorization: "Bearer keep-me" } });
check("Authorization kept as given", sent[0]?.headers?.get?.("Authorization") === "Bearer keep-me");

console.log("venue surfaces (API_CONTRACT §10)");
const LOC = "22222222-2222-2222-2222-222222222222";
const CUST = "33333333-3333-3333-3333-333333333333";

// `rewriteVenuePath` is a pure allowlist function: whether a venue is pinned is
// decided by `shim()`, one layer up, because only the interceptor knows whether
// a workspace is mounted. So the "no venue" case must be asserted over the wire,
// not against the pure function.
setShimVenue(null, null);
sent.length = 0;
await api.get("/vlans?router_id=abc");
check(
  "no venue pinned -> the customer path is NOT rewritten",
  sent[0]?.url === "/vlans?router_id=abc",
  String(sent[0]?.url),
);
check(
  "no venue pinned -> no customer header",
  sent[0]?.headers?.get?.(HEADER_ISP_CUSTOMER) == null,
  String(sent[0]?.headers?.get?.(HEADER_ISP_CUSTOMER)),
);

setShimVenue(CUST, LOC);
check(
  "allowlisted path rewritten with the query key renamed",
  rewriteVenuePath("/vlans?router_id=abc&page=2") === "/isp/venue/vlans?isp_router_id=abc&page=2",
  String(rewriteVenuePath("/vlans?router_id=abc&page=2")),
);
check(
  "an already-renamed key is left alone",
  rewriteVenuePath("/dhcp-pools?isp_router_id=abc") === "/isp/venue/dhcp-pools?isp_router_id=abc",
);
check(
  "path parameters need no rename",
  rewriteVenuePath(`/dhcp-pools/routers/${R}/leases`) ===
    `/isp/venue/dhcp-pools/routers/${R}/leases`,
);
check(
  "nested path preserved",
  rewriteVenuePath(`/policies/${R}/assignments`) === `/isp/venue/policies/${R}/assignments`,
);
check("a non-allowlisted customer path is not rewritten", rewriteVenuePath("/cameras") === null);
check("substring is not a prefix match", rewriteVenuePath("/vlansx") === null);
check(
  "the six setup rules still win",
  rewriteIspPath("get", `/routers/${R}`) === `/isp/routers/${R}/as-router-device`,
);

sent.length = 0;
await api.get("/vlans?router_id=abc");
check(
  "over the wire: the venue URL is used",
  sent[0]?.url === "/isp/venue/vlans?isp_router_id=abc",
  String(sent[0]?.url),
);
check(
  "over the wire: the customer header is pinned",
  sent[0]?.headers?.get?.(HEADER_ISP_CUSTOMER) === CUST,
  String(sent[0]?.headers?.get?.(HEADER_ISP_CUSTOMER)),
);
check(
  "over the wire: the location header is pinned",
  sent[0]?.headers?.get?.(HEADER_ISP_LOCATION) === LOC,
  String(sent[0]?.headers?.get?.(HEADER_ISP_LOCATION)),
);
check(
  "over the wire: the ISP org header is still the ISP's own",
  sent[0]?.headers?.get?.("X-Organization-Id") === "11111111-1111-1111-1111-111111111111",
);

console.log("setup component call list");
const src = readFileSync(
  join(ROOT, "src/components/routers/RouterSetupScriptAdvanced.tsx"),
  "utf8",
);
const routerSvc = readFileSync(join(ROOT, "src/services/router.service.ts"), "utf8");
const provisioningToken = /async generateProvisioningToken[\s\S]*?api\.post[^`]*`([^`]+)`/.exec(
  routerSvc,
)?.[1];
const literal = [
  ...src.matchAll(/api\.(get|post|put|patch|delete)<[\s\S]*?>\(\s*[`"]([^`"]+)[`"]/g),
].map((m) => [m[1], m[2]]);
const plain = [...src.matchAll(/api\.(get|post|put|patch|delete)\(\s*[`"]([^`"]+)[`"]/g)].map(
  (m) => [m[1], m[2]],
);
const calls = [...literal, ...plain];
if (provisioningToken) calls.push(["post", provisioningToken]);
check("found the component's calls", calls.length >= 6, String(calls.length));
for (const [method, raw] of calls) {
  const url = raw.replace(/\$\{router\.id\}|\$\{routerId\}/g, R);
  const ok = rewriteIspPath(method, url) !== null || url === "/routers/provisioning/check-in";
  check(`component call ${method.toUpperCase()} ${raw} is twinned or allowed`, ok);
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
