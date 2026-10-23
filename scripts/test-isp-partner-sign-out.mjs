/**
 * Partner sign-out gate (src/lib/isp-partner/sign-out.ts): QA-019 B / QA-020.
 * Run: node scripts/test-isp-partner-sign-out.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-signout-"));
const entry = join(dir, "e.ts");
writeFileSync(entry, `export * from "${join(ROOT, "src/lib/isp-partner/sign-out.ts")}";`);
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
      name: "stub-axios",
      setup(b) {
        b.onResolve({ filter: /^axios$/ }, () => ({ path: "axios", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents:
            "class CanceledError extends Error { constructor(m) { super(m); this.name = 'CanceledError'; } } export default { CanceledError };",
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

// A fake axios instance: run request interceptors, then a "network" promise.
const req = [];
const res = [];
const inst = {
  interceptors: {
    request: { use: (f) => req.push(f) },
    response: { use: (ok, err) => res.push([ok, err]) },
  },
};
m.installSignOutGate(inst);
m.installSignOutGate(inst);
check("installs once per instance", req.length === 1 && res.length === 1);

const send = async (url, ms = 0) => {
  let config;
  try {
    config = await req[0]({ url });
  } catch (e) {
    return { blocked: true, name: e.name };
  }
  await new Promise((r) => setTimeout(r, ms));
  res[0][0]({ config });
  return { blocked: false };
};

check("gate open: a request passes", !(await send("/isp/overview")).blocked);
check("nothing left in flight", m.__signOutGateState().inFlight === 0);

// A slow request in flight when sign-out starts must finish BEFORE logout().
const order = [];
const slow = send("/isp/overview", 300).then(() => order.push("slow-done"));
await new Promise((r) => setTimeout(r, 10));
let cancelled = false;
await m.endPartnerSession({
  queryClient: { cancelQueries: async () => (cancelled = true) },
  logout: async () => order.push("logout"),
});
await slow;
check("queries cancelled", cancelled);
check(
  "in-flight request drained before logout()",
  order.join(",") === "slow-done,logout",
  order.join(","),
);
check("gate is closed after sign-out", m.isSignOutGateClosed());
const after = await send("/isp/overview");
check(
  "closed gate refuses new ISP calls with a cancel (not a 401)",
  after.blocked && after.name === "CanceledError",
);
check("closed gate still lets /auth/* through (login)", !(await send("/auth/login")).blocked);
m.openSignOutGate();
check("public page reopens the gate", !(await send("/isp/me")).blocked);

let threw = false;
try {
  await m.endPartnerSession({
    queryClient: {
      cancelQueries: async () => {
        throw new Error("x");
      },
    },
    logout: async () => {
      throw new Error("y");
    },
    drainMs: 10,
  });
} catch {
  threw = true;
}
check("endPartnerSession never throws", !threw);
m.openSignOutGate();

const src = (p) => readFileSync(join(ROOT, p), "utf8");
const shell = src("src/components/isp-partner/PartnerShell.tsx");
const layout = src("src/components/isp-partner/PartnerLayout.tsx");
const route = src("src/routes/partner.tsx");
check(
  "shell Sign out goes through endPartnerSession",
  /await endPartnerSession\(\{ queryClient, logout \}\)/.test(shell) &&
    !/await logout\(\);/.test(shell),
);
check(
  "layout ends not-ISP/suspended sessions through endPartnerSession",
  /void endPartnerSession\(\{ queryClient, logout \}\)/.test(layout) &&
    !/void logout\(\)/.test(layout),
);
check("layout installs the gate with the shim", /installSignOutGate\(api\)/.test(layout));
check(
  "public pages reopen the gate (layout + route)",
  /openSignOutGate\(\)/.test(layout) && /openSignOutGate\(\)/.test(route),
);
check("route guard leaves the explanation screen up", /!partnerSessionEnded\(\)/.test(route));

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
