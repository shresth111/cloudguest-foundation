/**
 * Network total speed on the guest speed control at an Aruba venue.
 *
 * Run: node scripts/test-aruba-network-total.mjs
 *
 * The real control in Chromium against a stubbed service: hidden while the flag is
 * off, previews before any write, says applied only on the server's word.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "aruba-network-total-"));
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
  join(work, "service-stub.js"),
  `import { toVenueGuestSpeed } from "@/lib/aruba-guest-speed";
   const net = (over) => ({ network_id: "n1", network_name: "WYFY_ARUBA", enabled: true,
     download_mbps: 20, upload_mbps: 20, other_mode_limit: false, ...over });
   export const arubaGuestSpeedService = {
     async read() {
       return toVenueGuestSpeed({ status: "ok", presets_mbps: [10, 20],
         network_total_write_enabled: window.__flag,
         networks: [window.__held ? net({ enabled: false, download_mbps: null, upload_mbps: null,
           other_mode_limit: true, network_download_mbps: 40, network_upload_mbps: 15 }) : net({})] });
     },
     async apply() { window.__calls.push("per-device"); return toVenueGuestSpeed({ status: "ok" }); },
     async setNetworkTotal(_l, r) {
       window.__calls.push(r);
       if (window.__refuse && !r.dryRun) return toVenueGuestSpeed({ status: "failed", reason: window.__reason || "write_not_confirmed" });
       if (r.dryRun) return toVenueGuestSpeed({ status: "preview", preview: { network_id: r.networkId,
         download_mbps: r.downloadMbps, upload_mbps: r.uploadMbps, replaces_per_device: true } });
       const applied = net({ enabled: false, download_mbps: null, upload_mbps: null,
         other_mode_limit: true, network_download_mbps: r.downloadMbps, network_upload_mbps: r.uploadMbps });
       return toVenueGuestSpeed({ status: "applied", applied, networks: [applied],
         network_total_write_enabled: true });
     },
   };`,
);
writeFileSync(
  join(work, "entry.tsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { Toaster } from "sonner";
   import { ArubaGuestSpeedControl } from "@/components/customer/ArubaGuestSpeedControl";
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={new QueryClient()}>
       <ArubaGuestSpeedControl locationId="loc-1" />
       <Toaster />
     </QueryClientProvider>,
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
    "@/services/aruba-guest-speed.service": join(work, "service-stub.js"),
    "@": join(ROOT, "src"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".css": "empty" },
});
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") {
    const flag = url.searchParams.has("flag");
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><script>window.__calls=[];window.__flag=${flag};
      window.__held=${url.searchParams.has("held")};window.__refuse=${url.searchParams.has("refuse")};window.__reason=${JSON.stringify(url.searchParams.get("reason"))}</script>
      <div id=root></div><script type=module src="./bundle.js"></script>`);
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
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import("playwright");
const browser = await chromium.launch();
async function open(query) {
  const page = await browser.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/?${query}`);
  await page
    .getByTestId("aruba-guest-speed-current")
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  return page;
}
const calls = (page) => page.evaluate(() => window.__calls);

console.log("\n1. Flag off: the control is as it was");
{
  const page = await open("");
  check("no mode choice", (await page.getByTestId("aruba-speed-mode").count()) === 0);
  check("no network total", (await page.getByTestId("aruba-network-total").count()) === 0);
  check(
    "the per-device control shows",
    (await page.getByRole("button", { name: "Apply guest speed" }).count()) === 1,
  );
  await page.close();
}

console.log("\n2. Flag on: preview first");
{
  const page = await open("flag");
  check(
    "mode choice shows, on Each device",
    await page.getByRole("radio", { name: "Each device" }).isChecked(),
  );
  await page.getByRole("radio", { name: "Whole WiFi network" }).check();
  const box = page.getByTestId("aruba-network-total");
  check(
    "says it's per network, not the venue",
    (await box.innerText()).includes("not for the whole venue"),
  );
  check(
    "no apply before a preview",
    (await page.getByRole("button", { name: "Apply network total" }).count()) === 0,
  );
  await page.getByLabel(/Total download/).fill("");
  await page.getByLabel(/Total upload/).fill("");
  check(
    "empty boxes can't preview over a per-device cap",
    await page.getByRole("button", { name: "Preview" }).isDisabled(),
  );
  await page.getByLabel(/Total download/).fill("5000");
  check(
    "out of range can't preview",
    await page.getByRole("button", { name: "Preview" }).isDisabled(),
  );
  await page.getByLabel(/Total download/).fill("50");
  await page.getByLabel(/Total upload/).fill("20");
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByTestId("aruba-total-preview").waitFor();
  const previewText = await page.getByTestId("aruba-total-preview").innerText();
  check(
    "preview says what it would do",
    previewText.includes("50 Mbps") && previewText.includes("20 Mbps"),
    previewText,
  );
  check("preview says it replaces per-device", previewText.includes("replaces the per-device"));
  let sent = await calls(page);
  check(
    "the preview call is a dry run",
    sent.length === 1 && sent[0].dryRun === true,
    JSON.stringify(sent),
  );
  await page.getByLabel(/Total download/).fill("60");
  check(
    "changing a value drops the stale preview",
    (await page.getByRole("button", { name: "Apply network total" }).count()) === 0,
  );
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Apply network total" }).click();
  await page.getByText("Instant On confirmed the new network total.").waitFor();
  sent = await calls(page);
  const last = sent[sent.length - 1];
  check(
    "apply is a real write with the values",
    last.dryRun === false && last.downloadMbps === 60 && last.uploadMbps === 20,
    JSON.stringify(last),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

console.log("\n3. A write Instant On didn't keep says so");
{
  const page = await open("flag&refuse");
  await page.getByRole("radio", { name: "Whole WiFi network" }).check();
  await page.getByLabel(/Total download/).fill("50");
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Apply network total" }).click();
  await page.getByText(/didn't change the speed/).waitFor();
  check(
    "no success message",
    (await page.getByText("Instant On confirmed the new network total.").count()) === 0,
  );
  await page.close();
}

console.log("\n3b. A write that wasn't kept says what's in place");
for (const [reason, text] of [
  ["network_total_not_kept_restored", /previous setting was put back/],
  ["network_total_state_unknown", /don't know what's set now/],
]) {
  const page = await open(`flag&refuse&reason=${reason}`);
  await page.getByRole("radio", { name: "Whole WiFi network" }).check();
  await page.getByLabel(/Total download/).fill("50");
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Apply network total" }).click();
  await page.getByText(text).waitFor({ timeout: 10_000 });
  check(`${reason} is said plainly`, true);
  check(
    `${reason} never says it didn't change`,
    (await page.getByText(/didn't change the speed/).count()) === 0,
  );
  await page.close();
}

console.log("\n4. A network holding a total opens on it");
{
  const page = await open("flag&held");
  check(
    "mode starts on Whole WiFi network",
    await page.getByRole("radio", { name: "Whole WiFi network" }).isChecked(),
  );
  check("shows the held download", (await page.getByLabel(/Total download/).inputValue()) === "40");
  check("shows the held upload", (await page.getByLabel(/Total upload/).inputValue()) === "15");
  await page.getByLabel(/Total download/).fill("");
  await page.getByLabel(/Total upload/).fill("");
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByTestId("aruba-total-preview").waitFor();
  check(
    "removing a held total says guests will have no limit",
    (await page.getByTestId("aruba-total-preview").innerText()).includes("no speed limit"),
  );
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`aruba network total: ${failures} FAILED`);
  process.exit(1);
}
console.log("aruba network total: all checks passed");
