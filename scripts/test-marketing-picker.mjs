/**
 * Guest Messaging: choosing recipients by hand after applying filters.
 *
 * Run: node scripts/test-marketing-picker.mjs
 * The REAL RecipientPicker and hooks in Chromium against a recorded API stub.
 * Consent enforcement is the backend's: tests/unit/test_guest_marketing.py.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "marketing-picker-"));
let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

writeFileSync(
  join(work, "api-stub.js"),
  `const guests = [["g1","Asha"],["g2","Ravi"],["g3",null]].map(([id,name]) => ({ guest_id:id, display_name:name,
     masked_address:"+91••••1234", last_seen_at:"2026-11-01T10:00:00Z", total_visit_count:2 }));
   export const api = {
     async get(path) { return { data: path === "/me/organizations" ? [{ organization_id:"org-1", status:"active" }] : {} }; },
     async post(path, body) {
       window.__calls.push({ path, body });
       const q = (body.search || "").toLowerCase();
       const items = guests.filter((g) => !q || (g.display_name || "").toLowerCase().includes(q));
       return { data: { items, total: items.length, page: body.page, page_size: body.page_size } };
     },
   };
   export const TOKEN_STORAGE_KEY="t", REFRESH_TOKEN_STORAGE_KEY="r", USER_STORAGE_KEY="u", ACTIVE_ORG_STORAGE_KEY="o",
     ROLES_STORAGE_KEY="ro", ORGS_STORAGE_KEY="og", ORG_HEADER="X-Organization-Id", ORG_SCOPE_HEADER="X-Organization-Scope", ALL_ORGANIZATIONS="all";
   export function crossOrganizationHeaders() { return undefined; }
   export function resolveActiveOrganizationId() { return "org-1"; }
   export function setActiveOrganizationId() {}
   export function toAppError(e) { return e; }
   export function isAppError() { return false; }
   export function requestErrorOf() { return null; }
   export function requestErrorMessage(_, f) { return f; }
   export function getAbsoluteApiBase() { return ""; }
   export function resolveOrganizationScope() { return null; }
   export function setOrganizationScope() {}
   export default api;`,
);
writeFileSync(
  join(work, "auth-stub.js"),
  `export function useAuth() { return { user: null, roles: [], organizations: [], isAuthenticated: true }; }
   export function AuthProvider({ children }) { return children; }`,
);
writeFileSync(
  join(work, "entry.tsx"),
  `import { useState } from "react";
   import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { RecipientPicker } from "@/components/marketing/audience/RecipientPicker";
   import { audienceFilterInvalid, cleanAudienceFilter } from "@/components/marketing/marketing-helpers";
   function App() {
     const [ids, setIds] = useState(null);
     const filter = { channel: "sms", min_visits: 2, guest_ids: ids };
     window.__sent = cleanAudienceFilter(filter);
     window.__invalid = audienceFilterInvalid(filter);
     return <RecipientPicker filter={filter} onChange={setIds} />;
   }
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>,
   );`,
);
await build({
  entryPoints: [join(work, "entry.tsx")],
  bundle: true,
  format: "esm",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  logLimit: 0,
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  jsx: "automatic",
  define: {
    "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: true }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@/services/api": join(work, "api-stub.js"),
    "@/context/AuthContext": join(work, "auth-stub.js"),
    "@": join(ROOT, "src"),
  },
  plugins: [
    {
      name: "stub-relative-api",
      setup(b) {
        b.onResolve({ filter: /^\.\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".css": "empty" },
});
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><script>window.__calls=[]</script><div id=root></div><script type=module src="./bundle.js"></script>`,
    );
  }
  try {
    const body = readFileSync(join(work, url.pathname));
    res.writeHead(200, {
      "content-type": extname(url.pathname) === ".js" ? "text/javascript" : "text/plain",
    });
    return res.end(body);
  } catch {
    return res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const sent = () => page.evaluate(() => window.__sent);
const invalid = () => page.evaluate(() => window.__invalid);

await page.getByRole("radio", { name: "Everyone matching the filters" }).waitFor();
check("starts on everyone: no guest_ids sent", !("guest_ids" in (await sent())));
check(
  "asks the API for nobody until choosing",
  (await page.evaluate(() => window.__calls.length)) === 0,
);

await page.getByRole("radio", { name: "Choose people" }).click();
check("choosing with nobody picked blocks the step", (await invalid()) === true);
check("an empty pick is never sent as everyone", !("guest_ids" in (await sent())));
await page.getByRole("checkbox", { name: "Pick Asha" }).waitFor({ timeout: 10_000 });
const call = await page.evaluate(() => window.__calls[0]);
check(
  "the list uses the applied filters",
  call.path === "/marketing/audience/candidates" && call.body.audience.min_visits === 2,
  JSON.stringify(call),
);
check("the list request carries no picks", !("guest_ids" in call.body.audience));

await page.getByRole("checkbox", { name: "Pick Asha" }).click();
check("one pick is sent", JSON.stringify((await sent()).guest_ids) === '["g1"]');
check("the step is valid again", (await invalid()) === false);
check("the count shows it", (await page.getByTestId("picked-count").innerText()).includes("1"));

await page.getByRole("checkbox", { name: "Pick Asha" }).click();
check("unpicking returns to blocked, not everyone", (await invalid()) === true);

await page.getByRole("checkbox", { name: "Pick everyone on this page" }).click();
check("pick page picks all three", (await sent()).guest_ids?.length === 3);
await page.getByRole("checkbox", { name: "Pick everyone on this page" }).click();
check("unpick page clears them", (await invalid()) === true);

await page.getByRole("checkbox", { name: "Pick Ravi" }).click();
await page.getByLabel("Search by name").fill("asha");
await page
  .getByRole("checkbox", { name: "Pick Ravi" })
  .waitFor({ state: "detached", timeout: 10_000 });
check(
  "a pick survives a search that hides them",
  JSON.stringify((await sent()).guest_ids) === '["g2"]',
);

await page.getByRole("radio", { name: "Everyone matching the filters" }).click();
check(
  "back to everyone drops the picks",
  !("guest_ids" in (await sent())) && (await invalid()) === false,
);
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`marketing picker: ${failures} FAILED`);
  process.exit(1);
}
console.log("marketing picker: all checks passed");
