/**
 * Regression test for NAME REQUIRED AT SIGN-IN (the guest portal half).
 *
 * Run: `bun run test:portal-guest-name`
 * (needs Playwright's Chromium: `bunx playwright install chromium`)
 *
 * The contract (backend: cloud-guest `feat/portal-require-guest-name`):
 * after an OTP verifies, a session the server marks `name_required` must
 * see ONE "Your name" screen, must not be able to submit it empty, must send
 * the name as `display_name` to `POST /guest/sign-in-name`, and only after
 * that call resolves may the portal start opening the network.
 *
 * Three layers, each of which can break without tsc or eslint noticing:
 *
 *   1. The wire mapping (real `portal-runtime.service.ts`, axios stubbed):
 *      `name_required` reaches `RuntimeSession.nameRequired`, and
 *      `submitSignInName` posts `display_name` with the session pair.
 *   2. The pure rules (`portal-guest-name.ts`, `portal-post-connect.ts`):
 *      cleaning, the error-code mapping, the "show the screen" decision, and
 *      the post-connect card never asking for a name required at sign-in.
 *   3. The real `GuestNameStep` component in a real Chromium: the field
 *      renders with an accessible label, `autocomplete="name"`, >= 16px;
 *      submit is blocked while empty or whitespace-only (no request at
 *      all); a typed name is sent cleaned; `onDone` fires only AFTER the
 *      submit promise resolved; a `guest_name_invalid` refusal is shown and
 *      `onDone` does not fire.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "guest-name-test-"));

const failures = [];
let passed = 0;
const check = (name, ok, detail) => {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}`);
  }
};

const aliasPlugin = (stubs) => ({
  name: "portal-aliases",
  setup(b) {
    for (const [spec, file] of Object.entries(stubs)) {
      const filter = new RegExp(`^${spec.replace(/[/@.]/g, (c) => `\\${c}`)}$`);
      b.onResolve({ filter }, () => ({ path: file }));
    }
    b.onResolve({ filter: /^@\// }, (args) => {
      const base = join(ROOT, "src", args.path.slice(2));
      for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
        if (existsSync(p) && extname(p)) return { path: p };
      }
      return { errors: [{ text: `cannot resolve ${args.path}` }] };
    });
  },
});

// ---------------------------------------------------------------------------
// 1 + 2: wire mapping and pure rules, in Node
// ---------------------------------------------------------------------------
const API_STUB = `
export const calls = [];
export let nextResponse = null;
export function respondWith(v) { nextResponse = v; }
const record = (method) => async (url, body, opts) => {
  calls.push({ method, url, body, opts });
  return { data: nextResponse };
};
export const guestPortalApi = { get: record("get"), post: record("post") };
export default guestPortalApi;
`;
writeFileSync(join(work, "api-stub.js"), API_STUB);
writeFileSync(
  join(work, "node-entry.ts"),
  `export { portalRuntimeService } from "@/services/portal-runtime.service";
   export * as api from "@/services/guest-portal-api";
   export * as nameLib from "@/lib/portal-guest-name";
   export { postConnectAsksName, profileFieldsEligible } from "@/lib/portal-post-connect";`,
);
await build({
  entryPoints: [join(work, "node-entry.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "node-bundle.mjs"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [aliasPlugin({ "@/services/guest-portal-api": join(work, "api-stub.js") })],
});
const M = await import(pathToFileURL(join(work, "node-bundle.mjs")).href);

console.log("\nWire mapping (real portal-runtime.service.ts):");
const loginResponse = (nameRequired) => ({
  guest_id: "g-1",
  identifier: "+919999999999",
  is_new_guest: true,
  has_password: false,
  has_profile: false,
  has_opened_review_link: false,
  ...(nameRequired === undefined ? {} : { name_required: nameRequired }),
  session: {
    id: "s-1",
    guest_id: "g-1",
    device_id: "d-1",
    router_id: "r-1",
    location_id: "l-1",
    organization_id: "o-1",
    auth_method: "otp_sms",
    status: "active",
    started_at: "2026-10-04T00:00:00Z",
    ended_at: null,
    last_activity_at: "2026-10-04T00:00:00Z",
    ip_address: null,
    bytes_uploaded: 0,
    bytes_downloaded: 0,
    data_limit_mb: null,
    session_timeout_minutes: null,
  },
  device: null,
});
const loginParams = {
  identifier: "+919999999999",
  code: "123456",
  authMethod: "otp_sms",
  organizationId: "o-1",
  locationId: "l-1",
  routerId: "r-1",
};
M.api.respondWith(loginResponse(true));
let s = await M.portalRuntimeService.loginWithOtp(loginParams);
check("login-maps-name-required-true", s.nameRequired === true, `got ${s.nameRequired}`);
M.api.respondWith(loginResponse(false));
s = await M.portalRuntimeService.loginWithOtp(loginParams);
check("login-maps-name-required-false", s.nameRequired === false, `got ${s.nameRequired}`);
M.api.respondWith(loginResponse(undefined));
s = await M.portalRuntimeService.loginWithOtp(loginParams);
check(
  "login-absent-field-means-no-gate",
  s.nameRequired === false,
  `an older backend (no name_required) must not show the screen; got ${s.nameRequired}`,
);

M.api.respondWith({ guest_id: "g-1", display_name: "Asha Rao", has_profile: true });
M.api.calls.length = 0;
const stored = await M.portalRuntimeService.submitSignInName({
  guestId: "g-1",
  sessionId: "s-1",
  displayName: "Asha Rao",
});
const post = M.api.calls[0];
check(
  "submit-posts-to-sign-in-name",
  post?.method === "post" && post?.url === "/guest/sign-in-name",
  `got ${post?.method} ${post?.url}`,
);
check(
  "submit-sends-display-name",
  post?.body?.display_name === "Asha Rao" &&
    post?.body?.guest_id === "g-1" &&
    post?.body?.session_id === "s-1",
  `body was ${JSON.stringify(post?.body)}`,
);
check(
  "submit-maps-response",
  stored.displayName === "Asha Rao" && stored.hasProfile === true,
  JSON.stringify(stored),
);

console.log("\nPure rules:");
const L = M.nameLib;
check("clean-trims-and-collapses", L.cleanGuestName("  Asha   Rao \n") === "Asha Rao", "");
check("clean-whitespace-is-empty", L.cleanGuestName(" \t ") === "", "");
check("needs-step-on-server-bit", L.needsNameStep({ nameRequired: true }) === true, "");
check(
  "no-step-without-server-bit",
  L.needsNameStep({ nameRequired: false }) === false && L.needsNameStep(undefined) === false,
  "",
);
check(
  "error-code-invalid-maps-to-required-copy",
  L.guestNameErrorKey({ data: { code: "guest_name_invalid" } }) === "errNameRequired",
  "",
);
check(
  "error-other-maps-to-save-failed",
  L.guestNameErrorKey({ status: 500, data: {} }) === "errNameSaveFailed",
  "",
);
check(
  "authorize-refusal-is-recognised",
  L.isGuestNameRequiredError({ status: 403, data: { code: "guest_name_required" } }) === true &&
    L.isGuestNameRequiredError({ status: 403, data: {} }) === false,
  "",
);
const cfg = (o) => ({
  collectGuestName: true,
  collectGuestEmail: false,
  reviewUrl: null,
  reviewCardEnabled: false,
  guestFeedbackEnabled: false,
  feedbackDwellMinutes: 25,
  ...o,
});
const sess = (o) => ({ startedAt: "", hasProfile: false, hasOpenedReviewLink: false, ...o });
check(
  "nudge-never-re-asks-required-name-for-otp",
  M.postConnectAsksName(cfg({ requireGuestName: true }), sess({ authMethod: "otp_sms" })) ===
    false &&
    M.profileFieldsEligible(cfg({ requireGuestName: true }), sess({ authMethod: "otp_email" })) ===
      false,
  "the post-connect card asked for a name the guest already gave at sign-in",
);
check(
  "nudge-still-asks-voucher-guest",
  M.postConnectAsksName(cfg({ requireGuestName: true }), sess({ authMethod: "voucher" })) === true,
  "a voucher guest was never asked at sign-in; the venue's collect flag still applies",
);
check(
  "nudge-unchanged-when-not-required",
  M.postConnectAsksName(cfg({ requireGuestName: false }), sess({ authMethod: "otp_sms" })) === true,
  "",
);

// ---------------------------------------------------------------------------
// 3: the real component, in a real browser
// ---------------------------------------------------------------------------
writeFileSync(
  join(work, "runtime-stub.js"),
  `const EN = {
     nameStepTitle: "One last step", nameStepHint: "Enter your name to connect to the WiFi.",
     yourNameLabel: "Your name", nameStepContinue: "Connect", savingLabel: "Saving…",
     errNameRequired: "Please enter your name.", errNameSaveFailed: "We couldn't save your name.",
   };
   export function usePortalRuntime() { return { t: (k) => EN[k] ?? k }; }`,
);
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { GuestNameStep } from "@/components/portal-runtime/GuestNameStep";
   window.__calls = [];
   window.__done = [];
   window.__order = [];
   window.__mode = "ok";
   window.__release = null;
   const submit = (name) => {
     window.__calls.push(name);
     window.__order.push("submit-start");
     if (window.__mode === "invalid") {
       return Promise.reject({ status: 400, data: { code: "guest_name_invalid" } });
     }
     return new Promise((res) => {
       window.__release = () => { window.__order.push("submit-resolved"); res(); };
     });
   };
   const onDone = (name) => { window.__order.push("done"); window.__done.push(name); };
   createRoot(document.getElementById("root")).render(
     <GuestNameStep submit={submit} onDone={onDone} />,
   );`,
);
await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [aliasPlugin({ "@/context/PortalRuntimeContext": join(work, "runtime-stub.js") })],
});
writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8><title>Name step harness</title>
   <style>:root{--pg-type-scale:1} body{font-family:sans-serif;margin:24px;font-size:12px}</style>
   <div id=root></div><script type=module src="./bundle.js"></script>`,
);
const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const body = readFileSync(join(work, name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForSelector("[data-testid=guest-name-step] input");
  const input = page.getByLabel("Your name");
  // By role+type, not by name: the label reads "Saving…" mid-request.
  const button = page.locator("[data-testid=guest-name-step] button[type=submit]");

  console.log("\nGuestNameStep, rendered:");
  check("field-has-accessible-label", (await input.count()) === 1, "no input labelled 'Your name'");
  check(
    "autocomplete-name",
    (await input.getAttribute("autocomplete")) === "name",
    `autocomplete=${await input.getAttribute("autocomplete")}`,
  );
  check("required-attribute", (await input.getAttribute("required")) !== null, "");
  const fontPx = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check("font-at-least-16px", fontPx >= 16, `font-size ${fontPx}px would zoom iOS`);
  check("one-field-one-button", (await page.locator("input").count()) === 1, "");

  check("submit-disabled-when-empty", await button.isDisabled(), "button enabled with no name");
  await input.press("Enter");
  check(
    "enter-on-empty-sends-nothing",
    (await page.evaluate(() => window.__calls.length)) === 0,
    "an empty name reached the server",
  );
  await input.fill("    ");
  check(
    "submit-disabled-when-whitespace",
    await button.isDisabled(),
    "whitespace counted as a name",
  );
  await input.press("Enter");
  check(
    "enter-on-whitespace-sends-nothing",
    (await page.evaluate(() => window.__calls.length)) === 0,
    "a whitespace-only name reached the server",
  );
  check(
    "no-done-without-name",
    (await page.evaluate(() => window.__done.length)) === 0,
    "the network handoff started without a name",
  );

  await input.fill("  Asha   Rao ");
  check("submit-enabled-with-name", await button.isEnabled(), "");
  await button.click();
  await page.waitForFunction(() => window.__calls.length === 1);
  check(
    "sends-cleaned-name",
    (await page.evaluate(() => window.__calls[0])) === "Asha Rao",
    `sent ${JSON.stringify(await page.evaluate(() => window.__calls[0]))}`,
  );
  check(
    "done-waits-for-submit",
    (await page.evaluate(() => window.__done.length)) === 0,
    "onDone fired before the name was stored -- the network handoff would race the write",
  );
  check("button-disabled-while-saving", await button.isDisabled(), "double submit possible");
  await page.evaluate(() => window.__release());
  await page.waitForFunction(() => window.__done.length === 1);
  check(
    "done-after-submit-resolved",
    JSON.stringify(await page.evaluate(() => window.__order)) ===
      JSON.stringify(["submit-start", "submit-resolved", "done"]),
    `order was ${JSON.stringify(await page.evaluate(() => window.__order))}`,
  );

  // A server refusal: shown, and the network handoff never starts.
  const page2 = await browser.newPage();
  await page2.goto(origin);
  await page2.waitForSelector("[data-testid=guest-name-step] input");
  await page2.evaluate(() => {
    window.__mode = "invalid";
  });
  await page2.getByLabel("Your name").fill("x");
  await page2.getByRole("button", { name: "Connect" }).click();
  await page2.waitForSelector("[role=alert]");
  check(
    "server-refusal-shown",
    (await page2.getByRole("alert").textContent())?.includes("Please enter your name") === true,
    "guest_name_invalid was not surfaced",
  );
  check(
    "server-refusal-does-not-proceed",
    (await page2.evaluate(() => window.__done.length)) === 0,
    "onDone ran after the server refused the name",
  );
  check(
    "field-marked-invalid",
    (await page2.getByLabel("Your name").getAttribute("aria-invalid")) === "true",
    "",
  );
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} checks passed, ${failures.length} failed.`);
if (failures.length) {
  console.log("\nFailures:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("portal guest name: all checks passed");
