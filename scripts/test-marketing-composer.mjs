/**
 * The Marketing campaign composer, mounted for real in Chromium, against a
 * recording stand-in for the marketing hooks (no network, no fixtures in
 * `src/`). It pins the four defects the PR #357 review found:
 *
 *   1. RESEED LOOP. After every PATCH the detail query refetches and hands
 *      the composer a new `draft` object; the seed effect used to run on it,
 *      reset to step 2 and drop what was typed -- an edited draft could never
 *      get past Details. Asserted: the step advances and the typed name
 *      survives a refetched draft.
 *   2. REDUNDANT PATCH. Nothing changed since the last accepted save => no
 *      request.
 *   3. VERSION CONFLICT. A 409 `version_conflict` re-reads the server version
 *      and says so; the next save succeeds with that version.
 *   4. SCHEDULE IDEMPOTENCY. The key survives a network error (the schedule
 *      may have landed) and is replaced only after a definitive 4xx; a double
 *      click fires one request; a campaign that is already scheduled closes
 *      onto its real state instead of an error.
 *
 * Run: node scripts/test-marketing-composer.mjs
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "marketing-composer-"));
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

writeFileSync(
  join(work, "sonner-stub.js"),
  `const rec = (kind) => (msg) => { (window.__toasts ||= []).push([kind, String(msg)]); };
   export const toast = Object.assign(rec("default"), {
     success: rec("success"), error: rec("error"), warning: rec("warning"),
     info: rec("info"), message: rec("message"),
   });
   export const Toaster = () => null;`,
);
writeFileSync(
  join(work, "dashboard-hooks-stub.js"),
  `export function useMyPermissions() { return { data: undefined }; }
   export function useIsDemo() { return false; }`,
);
writeFileSync(
  join(work, "store-stub.js"),
  `export const useCustomerStore = (sel) =>
     sel({ activeLocation: { name: "Koramangala" }, activeLocationId: "v1" });`,
);
writeFileSync(
  join(work, "service-stub.js"),
  `export const marketingError = (e) => (e && typeof e === "object" && "status" in e ? e : null);
   export const marketingErrorCode = (e) => (e && e.data && e.data.error_code) || (e && e.code) || null;
   export const marketingErrorData = (e) => e && e.data;
   export const isEntitlementError = () => false;
   export const marketingService = {
     async getCampaign(id) {
       return { ...window.__draft, id, version: window.__server.version, status: window.__server.status };
     },
   };`,
);
writeFileSync(
  join(work, "hooks-stub.js"),
  `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
   const S = () => window.__server;
   function mutation(fn) {
     return { mutateAsync: fn, isPending: false, mutate: () => {} };
   }
   export function useMarketingScope() { return { kind: "organization", organizationId: "org-1" }; }
   export function useMarketingLocationId() { return null; }
   import { marketingService as __real } from "@/services/marketing.service";
   export function useMarketingApi() { return __real; }
   export function useVenueLabel() { return () => "All venues"; }
   export function useOrgVenues() {
     return { venues: [{ id: "v1", name: "Koramangala" }, { id: "v2", name: "Indiranagar" }], isLoading: false, isError: false };
   }
   let TEMPLATES;
   export function useMarketingTemplates() {
     TEMPLATES ||= { items: [window.__template] };
     return { data: TEMPLATES, isLoading: false, isError: false };
   }
   const PREVIEW = { channel: "whatsapp", rendered: { body: "Hi Riya", subject: null }, sms: null, missing_variables: [] };
   export function useTemplatePreview() {
     return { data: PREVIEW, isFetching: false, isError: false };
   }
   // Stable object, as TanStack Query's structural sharing returns.
   const AUDIENCE = { channel: "whatsapp", matched_guests: 10, reachable: 4,
     excluded: { no_consent: 6, opted_out: 0, suppressed: 0, no_address: 0, invalid_address: 0, blocked: 0 },
     capped: false, sample: [] };
   export function useAudiencePreview() {
     return { data: AUDIENCE, isFetching: false, isError: false };
   }
   export function useCreateCampaign() {
     return mutation(async () => { throw new Error("create is not expected in this test"); });
   }
   export function useUpdateCampaign() {
     return mutation(async ({ id, body }) => {
       window.__patches.push(body);
       await sleep(40);
       if (S().status !== "draft") throw { status: 409, code: "x", message: "not a draft", data: { error_code: "invalid_status_transition" } };
       if (body.version !== S().version) throw { status: 409, code: "x", message: "conflict", data: { error_code: "version_conflict" } };
       S().version += 1;
       const saved = { ...window.__draft, ...body, id, version: S().version, updated_at: new Date().toISOString() };
       // The detail sheet's query refetches after a PATCH and re-renders the
       // composer with a NEW draft object -- the trigger of the reseed bug.
       setTimeout(() => window.__refetchDraft(saved), 0);
       return saved;
     });
   }
   export function useScheduleCampaign() {
     return mutation(async ({ id, idempotencyKey }) => {
       window.__scheduleKeys.push(idempotencyKey);
       await sleep(150);
       const next = window.__scheduleBehaviour.shift() || "ok";
       if (next === "network") throw { status: null, code: "network_error", message: "Unable to reach the server" };
       if (next === "5xx") throw { status: 503, code: "x", message: "Service unavailable", data: {} };
       if (next === "4xx") throw { status: 422, code: "x", message: "bad time", data: { error_code: "schedule_out_of_range" } };
       S().status = "sending";
       return { ...window.__draft, id, status: "sending", scheduled_at: null };
     });
   }
   export function useTestSend() { return mutation(async () => ({ results: [] })); }`,
);

const composer = join(ROOT, "src/components/marketing/campaigns/CampaignComposerSheet.tsx").replace(
  /\\/g,
  "/",
);
writeFileSync(
  join(work, "entry.jsx"),
  `import { useState } from "react";
   import { createRoot } from "react-dom/client";
   import { CampaignComposerSheet } from "${composer}";
   const STATUS = {
     channels: [
       { channel: "sms", configured: false, provider: null, mode: "unconfigured", reason: "x" },
       { channel: "whatsapp", configured: true, provider: "twilio", mode: "live", reason: null },
       { channel: "email", configured: false, provider: null, mode: "unconfigured", reason: "x" },
     ],
     portal_consent: { enabled: true, text: null, text_version: "v1" },
     consent_counts: { sms: 0, whatsapp: 4, email: 0 },
     quiet_hours: { start: "21:00", end: "09:00", timezone: "Asia/Kolkata", applies_to: ["sms"] },
     limits: { max_recipients_per_campaign: 5000, test_sends_per_day: 20 },
   };
   function App() {
     const [draft, setDraft] = useState(window.__draft);
     window.__refetchDraft = (saved) => setDraft({ ...saved });
     return <CampaignComposerSheet open onOpenChange={() => {}} status={STATUS} draft={draft}
       onDone={(id) => window.__done.push(id)} />;
   }
   createRoot(document.getElementById("root")).render(<App />);`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  define: {
    "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: true }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@/hooks/useMarketing": join(work, "hooks-stub.js"),
    "@/hooks/useCustomerDashboard": join(work, "dashboard-hooks-stub.js"),
    "@/services/marketing.service": join(work, "service-stub.js"),
    "@/stores/customerStore": join(work, "store-stub.js"),
    sonner: join(work, "sonner-stub.js"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

const TEMPLATE = {
  id: "t1",
  is_system: true,
  system_key: "weekend_offer",
  name: "Weekend offer",
  category: "offer",
  description: null,
  sms: null,
  email: null,
  whatsapp: {
    body: "Hi {{guest_name}} use {{offer_code}} {{unsubscribe_link}}",
    content_sid: "HX1",
    variable_order: [],
    approval_status: "approved",
  },
  variables: ["guest_name", "offer_code", "unsubscribe_link"],
  sendable: {
    sms: { ok: false, reason: "channel_missing_in_template" },
    whatsapp: { ok: true, reason: null },
    email: { ok: false, reason: "channel_missing_in_template" },
  },
  version: 1,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};
const DRAFT = {
  id: "c1",
  name: "Brunch",
  channel: "whatsapp",
  location_id: null,
  template: { id: "t1", name: "Weekend offer", is_system: true },
  variables: { offer_code: "BRUNCH20" },
  audience_filter: { channel: "whatsapp" },
  status: "draft",
  scheduled_at: null,
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  paused_until: null,
  stats: {
    recipients: 0,
    pending: 0,
    submitted: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
    delivered_is_tracked: false,
  },
  created_by: null,
  version: 1,
  created_at: "2026-09-25T10:00:00Z",
  updated_at: "2026-09-25T10:00:00Z",
};

const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (name === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><meta charset=utf-8><title>composer harness</title>
       <script>
         window.__template = ${JSON.stringify(TEMPLATE)};
         window.__draft = ${JSON.stringify(DRAFT)};
         window.__server = { version: 1, status: "draft" };
         window.__patches = []; window.__scheduleKeys = []; window.__scheduleBehaviour = [];
         window.__done = []; window.__toasts = [];
       </script>
       <div id=root></div><script type=module src="./bundle.js"></script>`,
    );
  }
  try {
    const body = readFileSync(join(work, name));
    res.writeHead(200, {
      "content-type": extname(name) === ".js" ? "text/javascript" : "text/plain",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const currentStep = () =>
  page
    .locator('[aria-current="step"]')
    .innerText({ timeout: 3000 })
    .then((t) => t.trim())
    .catch(
      async () =>
        `(no step; errors: ${errors.join(" | ")}; body: ${(await page.locator("body").innerText()).slice(0, 300)})`,
    );
const patches = () => page.evaluate(() => window.__patches.length);
const saveContinue = () => page.getByRole("button", { name: "Save & continue" }).click();

try {
  await page.goto(origin);
  await page.getByLabel("Campaign name").waitFor();

  console.log("\n1. an edited draft gets past Details and keeps what was typed");
  check("a continued draft opens on Details", /Details/.test(await currentStep()));
  await page.getByLabel("Campaign name").fill("Brunch — edited");
  await saveContinue();
  await page.waitForTimeout(400); // the PATCH, then the refetched draft object
  check("one PATCH was sent", (await patches()) === 1, String(await patches()));
  check(
    "the step advanced to Audience and stayed there after the refetch",
    /Audience/.test(await currentStep()),
    await currentStep(),
  );
  await page.getByRole("button", { name: /Details/ }).click();
  check(
    "the typed name survived the refetched draft",
    (await page.getByLabel("Campaign name").inputValue()) === "Brunch — edited",
  );

  console.log("\n2. nothing changed => no PATCH");
  await saveContinue();
  await page.waitForTimeout(200);
  check(
    "Save & continue with no change sends nothing",
    (await patches()) === 1,
    String(await patches()),
  );
  check("and still advances", /Audience/.test(await currentStep()));

  console.log("\n3. a version conflict re-reads the server version and says so");
  await page.evaluate(() => {
    window.__server.version += 1;
  }); // someone else saved
  await page.getByRole("button", { name: /Details/ }).click();
  await page.getByLabel("Campaign name").fill("Brunch — mine");
  await saveContinue();
  await page.waitForTimeout(300);
  const conflictText = await page
    .getByRole("alert")
    .innerText()
    .catch(() => "");
  check(
    "the conflict is explained, edits kept",
    /Someone else changed this draft/.test(conflictText),
    conflictText,
  );
  check(
    "still on Details with the edit",
    /Details/.test(await currentStep()) &&
      (await page.getByLabel("Campaign name").inputValue()) === "Brunch — mine",
  );
  await saveContinue();
  await page.waitForTimeout(400);
  check(
    "saving again succeeds with the server's version",
    /Audience/.test(await currentStep()) && (await patches()) === 3,
    `${await currentStep()} / ${await patches()}`,
  );

  console.log("\n4. schedule: one request per click, key kept until a definitive refusal");
  await saveContinue(); // -> Review, no change, no PATCH
  await page.waitForTimeout(200);
  check("reaching Review sent no PATCH", (await patches()) === 3, String(await patches()));
  await page.getByRole("button", { name: "Send now" }).click();
  const dialog = page.locator('[role="dialog"]').filter({ hasText: "Send now?" });
  await dialog.waitFor();
  const go = dialog.getByRole("button", { name: /Send now|Working/ });
  await page.evaluate(() => {
    window.__scheduleBehaviour = ["network", "5xx", "4xx", "ok"];
  });
  await go.click();
  await page.waitForTimeout(350);
  await go.click();
  await page.waitForTimeout(350);
  await go.click();
  await page.waitForTimeout(350);
  const keys = await page.evaluate(() => window.__scheduleKeys);
  check("a network error keeps the idempotency key", keys[0] === keys[1], JSON.stringify(keys));
  check("a 5xx keeps the idempotency key", keys[1] === keys[2], JSON.stringify(keys));
  await go.dblclick();
  await page.waitForTimeout(500);
  const keys2 = await page.evaluate(() => window.__scheduleKeys);
  check("a double click fires ONE schedule request", keys2.length === 4, JSON.stringify(keys2));
  check(
    "a definitive 4xx frees the key for a new attempt",
    keys2[3] !== keys2[2],
    JSON.stringify(keys2),
  );
  check(
    "scheduling never re-PATCHed an unchanged draft",
    (await patches()) === 3,
    String(await patches()),
  );
  const toasts = await page.evaluate(() => window.__toasts);
  check(
    "success is announced only once, after the 2xx",
    toasts.filter(([k]) => k === "success").length === 1,
    JSON.stringify(toasts),
  );

  console.log("\n5. a campaign that is already scheduled shows its real state, not an error");
  await page.goto(origin);
  await page.getByLabel("Campaign name").waitFor();
  await page.evaluate(() => {
    window.__server.status = "scheduled";
  });
  await page.getByLabel("Campaign name").fill("Too late");
  await saveContinue();
  await page.waitForTimeout(400);
  const done = await page.evaluate(() => window.__done);
  const t2 = await page.evaluate(() => window.__toasts);
  check(
    "the composer hands over to the campaign's real state",
    done.includes("c1"),
    JSON.stringify(done),
  );
  check(
    "with a neutral message, not an error",
    t2.some(([k, m]) => k === "message" && /already scheduled/.test(m)) &&
      !t2.some(([k]) => k === "error"),
    JSON.stringify(t2),
  );

  check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

console.log(
  failures === 0
    ? "\nall marketing composer checks passed\n"
    : `\n${failures} marketing composer check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
