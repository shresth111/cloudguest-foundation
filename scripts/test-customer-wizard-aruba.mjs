/**
 * The Master console's "Add customer" wizard, onboarding a venue whose access
 * points are Aruba Instant On (PM_SPEC §5 Wave 2).
 *
 * Run: node scripts/test-customer-wizard-aruba.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * The Aruba option is ONE request: `POST /locations/provision` with an
 * `instant_on_site` object, which the backend turns into one NAS-only
 * `aruba_instant_on` fleet row inside the provisioning transaction. What tsc
 * cannot see, and this pins:
 *
 *   - the `instant_on_site` body is exactly Router Fleet's "Add Instant On
 *     site" body minus organization/location: blank optionals OMITTED (the
 *     schema forbids unknown keys and mints a missing serial/MAC), MAC
 *     normalised, and never sent together with `router`;
 *   - the same field rules as that dialog, plus the static-IP question, whose
 *     "No" warns and offers the MikroTik path but does not block;
 *   - no Omada onboard call, and no second request of any kind;
 *   - the result names the Aruba row and links to its Instant On setup panel
 *     (`/master/routers?advanced=<routerId>`), as Router Fleet does;
 *   - a backend refusal is shown verbatim as a provisioning failure (nothing
 *     was saved -- it is one transaction);
 *   - the MikroTik and Omada payloads do not change, and the device wizard
 *     (`VENDOR_CHOICES`) does not grow an Aruba option.
 *
 * Same harness as `test-customer-wizard-omada.mjs`: the REAL wizard bundled
 * with esbuild, in Chromium, through the real services/hooks/`api` client,
 * against a local server that plays the backend and records every request.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "customer-wizard-aruba-"));

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// The bundle: the real wizard, mounted open, in a real QueryClient.
// ---------------------------------------------------------------------------
writeFileSync(
  join(work, "router-stub.jsx"),
  `export function Link({ to, search, children, onClick, className }) {
     const q = search ? "?" + new URLSearchParams(search).toString() : "";
     return <a href={to + q} className={className} onClick={(e) => { e.preventDefault(); onClick?.(e); }}>{children}</a>;
   }`,
);
writeFileSync(
  join(work, "entry.jsx"),
  `import { useState } from "react";
   import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { PlatformLocationWizard } from "@/components/locations/PlatformLocationWizard";
   window.__provisioned = [];
   function Harness() {
     const [open, setOpen] = useState(true);
     return (
       <PlatformLocationWizard
         open={open}
         onOpenChange={setOpen}
         onProvisioned={(id) => window.__provisioned.push(id)}
         initialOrganizationId="org-existing"
       />
     );
   }
   const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={qc}><Harness /></QueryClientProvider>,
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
  define: {
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "/api/v1",
    }),
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    {
      name: "customer-wizard-aliases",
      setup(b) {
        b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: join(work, "router-stub.jsx"),
        }));
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// The backend: the harness page plus every endpoint the wizard calls.
// ---------------------------------------------------------------------------
const SITE_ID = "fe0177b6-2ff9-4c0b-9326-091953c67f5f";
const REFUSAL =
  "Instant On site fe0177b6-2ff9-4c0b-9326-091953c67f5f is already mapped to another fleet device. One Instant On site is one fleet row.";

/** Every API request, in order: { method, path, body }. */
let requests = [];
/** "ok" or "refuse" for the next provision. */
let provisionMode = "ok";

const envelope = (data, message = "ok") => JSON.stringify({ success: true, message, data });
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) {
    const name = url.pathname === "/" ? "/index.html" : url.pathname;
    if (name === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(
        `<!doctype html><meta charset=utf-8><title>customer wizard harness</title>
         <div id=root></div><script type=module src="./bundle.js"></script>`,
      );
    }
    try {
      const body = readFileSync(join(work, name));
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(body);
    } catch {
      return res.writeHead(404).end();
    }
  }

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const body = raw ? JSON.parse(raw) : undefined;
    requests.push({ method: req.method, path, body });
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(payload);
    };

    if (req.method === "GET" && path === "/organizations") {
      return send(200, envelope({ items: [{ id: "org-existing", name: "Acme Hospitality" }] }));
    }
    if (req.method === "GET" && path === "/plans") {
      return send(
        200,
        envelope({
          items: [
            {
              id: "plan-1",
              name: "Starter",
              plan_type: "standard",
              base_price: "999.00",
              currency: "INR",
            },
          ],
        }),
      );
    }
    if (req.method === "GET" && path === "/features") {
      return send(200, envelope({ features: [] }));
    }
    if (req.method === "POST" && path === "/locations/provision") {
      if (provisionMode === "refuse") {
        provisionMode = "ok";
        return send(
          409,
          JSON.stringify({
            success: false,
            message: REFUSAL,
            data: { code: "NAS_ONLY_SITE_REFUSED", reason: "site_already_onboarded" },
          }),
        );
      }
      const aruba = body?.instant_on_site;
      const mikrotik = body?.router;
      return send(
        201,
        envelope({
          organization_id: "org-existing",
          organization_name: "Acme Hospitality",
          location_id: "loc-new-1",
          location_name: body?.location?.name,
          location_code: "LOC-0001",
          plan_id: "plan-1",
          plan_name: "Starter",
          router_id: aruba ? "rtr-aruba-1" : mikrotik ? "rtr-mikrotik-1" : null,
          router_name: aruba?.name ?? mikrotik?.name ?? null,
          router_vendor: aruba ? "aruba_instant_on" : mikrotik ? "mikrotik" : null,
          instant_on_site_id: aruba?.instant_on_site_id ?? null,
          tunnel_ip_address: mikrotik ? "10.100.0.5" : null,
          owner_user_id: "user-1",
          owner_name: "Asha Rao",
          owner_username: "asha",
          owner_email: "asha@example.com",
          owner_temporary_password: "Temp!Pass-2026",
          login_url: "https://app.example.com/login",
          provisioned_at: "2026-10-02T00:00:00Z",
        }),
      );
    }
    if (req.method === "POST" && path === "/network-integrations/platform/onboard") {
      return send(
        201,
        envelope({
          integration: {
            id: "int-1",
            organization_id: body.organization_id,
            location_id: body.location_id,
            provider: "omada",
            name: body.name,
            status: "pending",
            external_site_id: body.external_site_id ?? null,
            portal_url_scheme: "https",
            portal_url_host_and_query: "app.wyfyguest.com/portal?x=1",
            portal_readiness_gaps: [],
          },
          router_id: "rtr-omada-1",
          router_serial_number: "OMADA-SW-0001",
          router_vendor: "tplink_omada",
          synthetic_identity: true,
        }),
      );
    }
    return send(404, JSON.stringify({ success: false, message: `unexpected ${path}`, data: {} }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

const provisions = () => requests.filter((r) => r.path === "/locations/provision");
const onboards = () => requests.filter((r) => r.path === "/network-integrations/platform/onboard");
const posts = () => requests.filter((r) => r.method === "POST");
const dialog = (page) => page.locator('[role="dialog"]');
const field = (page, label) => dialog(page).locator(`div:has(> label:text-is("${label}")) > input`);
const byLabel = (page, label) => dialog(page).getByLabel(label, { exact: true });
const cont = (page) =>
  dialog(page)
    .getByRole("button", { name: /^Continue/ })
    .click();
const text = (page) => dialog(page).innerText();

/** Organization, Location and Owner steps, identical for every device type. */
async function openAndFillCustomer() {
  requests = [];
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForSelector('[role="dialog"]');
  await dialog(page).getByText("Acme Hospitality").waitFor();
  await cont(page);
  await field(page, "Location name").fill("Seaside Hotel");
  await dialog(page).locator('div:has(> label:text-is("Country")) button[role="combobox"]').click();
  await page.getByRole("option", { name: "India (IN)", exact: true }).click();
  await field(page, "State / Region").fill("Goa");
  await field(page, "City").fill("Panaji");
  await field(page, "Postal code").fill("403001");
  await field(page, "Address").fill("1 Beach Road");
  await cont(page);
  await field(page, "First name").fill("Asha");
  await field(page, "Last name").fill("Rao");
  await field(page, "Email").fill("asha@example.com");
  await cont(page);
  await dialog(page).getByText("First device").waitFor();
  return page;
}

const arubaCard = (page) => dialog(page).getByRole("button", { name: /^Aruba Instant On/ });
const staticYes = (page) => dialog(page).getByRole("button", { name: /Yes, a static public IP/ });
const staticNo = (page) => dialog(page).getByRole("button", { name: /No \/ not sure/ });

async function fillAruba(page, values = {}) {
  await arubaCard(page).click();
  const all = {
    "Device name": "Aruba AP21 Lobby",
    "AP serial (optional)": "VNV5M1K1M6",
    "AP MAC (optional)": "54-f0-b1-c8-a9-0a",
    "Instant On site name (optional)": "inhouse-office",
    "Instant On site id (optional)": SITE_ID,
    ...values,
  };
  for (const [label, value] of Object.entries(all)) {
    await byLabel(page, label).fill(value);
  }
}

/** Plan and Features, then land on Review. */
async function finishToReview(page) {
  await cont(page);
  await dialog(page)
    .getByRole("button", { name: /Starter/ })
    .click();
  await cont(page);
  await cont(page);
  await dialog(page).getByText("Review & confirm").waitFor();
}

const provisionButton = (page) => dialog(page).getByRole("button", { name: /Provision location/ });

// ---------------------------------------------------------------------------
console.log("\n1. The Device step offers Aruba Instant On as a third choice");
{
  const page = await openAndFillCustomer();
  const cards = await dialog(page).locator("button[aria-pressed]").allInnerTexts();
  check(
    "three device cards: MikroTik, Omada, Aruba Instant On",
    cards.some((c) => c.startsWith("MikroTik router")) &&
      cards.some((c) => c.startsWith("TP-Link Omada controller")) &&
      cards.some((c) => c.startsWith("Aruba Instant On")),
    JSON.stringify(cards),
  );
  check(
    "MikroTik is still the default",
    (await dialog(page)
      .getByRole("button", { name: /MikroTik router/ })
      .getAttribute("aria-pressed")) === "true",
  );
  check(
    "the stepper names the new option",
    (await page.locator("body").innerText()).includes(
      "Router, Omada controller or Aruba Instant On",
    ),
  );
  await arubaCard(page).click();
  check(
    "choosing it marks it pressed",
    (await arubaCard(page).getAttribute("aria-pressed")) === "true",
  );
  check(
    "it shows the Instant On fields, not the MikroTik or Omada ones",
    (await byLabel(page, "Device name").count()) === 1 &&
      (await byLabel(page, "AP serial (optional)").count()) === 1 &&
      (await byLabel(page, "AP MAC (optional)").count()) === 1 &&
      (await byLabel(page, "Instant On site name (optional)").count()) === 1 &&
      (await byLabel(page, "Instant On site id (optional)").count()) === 1 &&
      (await dialog(page).getByPlaceholder("Lobby Router").count()) === 0 &&
      (await byLabel(page, "Controller address").count()) === 0,
  );
  check(
    "asks whether the venue has a static public IP",
    (await text(page)).includes("Does this venue have a static public IP?"),
  );
  check(
    "says nothing is sent to the APs or the hub now",
    (await text(page)).includes("Nothing is sent to the access points or the RADIUS hub now"),
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n2. Validation: the Add Instant On site rules, plus the static-IP answer");
{
  const page = await openAndFillCustomer();
  await arubaCard(page).click();
  await cont(page);
  let t = await text(page);
  check("stays on the device step", t.includes("First device"));
  check("requires a device name", t.includes("Give the device a name."));
  check("requires the static-IP answer", t.includes("Answer this"));
  check("serial / MAC / site are optional (no error for them)", !t.includes("100 characters"));

  await byLabel(page, "Device name").fill("Aruba AP21 Lobby");
  await byLabel(page, "AP MAC (optional)").fill("not-a-mac");
  await byLabel(page, "Instant On site name (optional)").fill("inhouse-office");
  await staticYes(page).click();
  await cont(page);
  t = await text(page);
  check("refuses a malformed MAC", t.includes("six hex pairs"), t.slice(0, 900));
  check("refuses a site name with no site id", t.includes("Enter the Instant On site id too"));
  check("no request was made", posts().length === 0);

  await byLabel(page, "AP MAC (optional)").fill("");
  await byLabel(page, "Instant On site name (optional)").fill("");
  await cont(page);
  check("valid with only a name and the answer", (await text(page)).includes("Assign plan"));
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n3. No static IP: a clear warning, a way back to MikroTik, but not a block");
{
  const page = await openAndFillCustomer();
  await fillAruba(page);
  await staticNo(page).click();
  const warning = dialog(page).getByTestId("instant-on-no-static-ip");
  check("the warning appears", (await warning.count()) === 1);
  const w = (await warning.count()) ? await warning.innerText() : "";
  check(
    "it says Aruba will not work without one, and why",
    w.includes("will not work at this venue without a static public IP") && w.includes("RADIUS"),
    w,
  );
  check("it names the MikroTik gateway path", w.includes("MikroTik gateway"));
  await staticYes(page).click();
  check("answering Yes removes it", (await warning.count()) === 0);
  await staticNo(page).click();

  // "No" does not block: Continue goes on, and Review repeats the warning.
  await finishToReview(page);
  check(
    "Review repeats the no-static-IP warning",
    (await dialog(page).getByTestId("review-no-static-ip").count()) === 1,
  );
  check("...and still lets the operator provision", await provisionButton(page).isEnabled());

  // Back to Device: the switch button takes the MikroTik path.
  for (let i = 0; i < 3; i += 1) {
    await dialog(page).getByRole("button", { name: /Back/ }).click();
  }
  await dialog(page).getByText("First device").waitFor();
  await dialog(page).getByRole("button", { name: "Use a MikroTik gateway instead" }).click();
  check(
    "the switch selects MikroTik and shows its fields",
    (await dialog(page)
      .getByRole("button", { name: /MikroTik router/ })
      .getAttribute("aria-pressed")) === "true" &&
      (await dialog(page).getByPlaceholder("Lobby Router").count()) === 1,
  );
  await dialog(page).getByPlaceholder("Lobby Router").fill("Gateway 1");
  await dialog(page).getByRole("combobox").filter({ hasText: "Select or type a model" }).click();
  await page.getByPlaceholder("Search models, or type a model not listed...").fill("RB5009");
  await page.getByRole("option", { name: 'Use "RB5009"' }).click();
  await field(page, "Serial number").fill("SN0009");
  await field(page, "MAC address").fill("AA:BB:CC:DD:EE:09");
  await finishToReview(page);
  await provisionButton(page).click();
  await dialog(page).getByText("Location provisioned").waitFor();
  const [prov] = provisions();
  check(
    "after switching, the provision carries the router and NO instant_on_site",
    prov?.body.router?.name === "Gateway 1" && !("instant_on_site" in (prov?.body ?? {})),
    JSON.stringify(Object.keys(prov?.body ?? {})),
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n4. Aruba: one provision, the Instant On body, no onboard, the setup link");
{
  const page = await openAndFillCustomer();
  await fillAruba(page);
  await staticYes(page).click();
  await finishToReview(page);

  const review = await text(page);
  check(
    "Review shows the Aruba details",
    review.includes("Aruba Instant On site") &&
      review.includes("Aruba AP21 Lobby") &&
      review.includes("VNV5M1K1M6") &&
      review.includes(`inhouse-office · ${SITE_ID}`) &&
      /Static public IP\s+Yes/.test(review),
    review.slice(0, 900),
  );
  check(
    "Review says it is one transaction",
    review.includes("created together, or none of them is"),
  );
  check("no Router row in Review", !/\nRouter\n/.test(review));
  check(
    "no static-IP warning when the answer was Yes",
    (await dialog(page).getByTestId("review-no-static-ip").count()) === 0,
  );

  await provisionButton(page).click();
  await dialog(page).getByText("Location provisioned").waitFor();

  const [prov] = provisions();
  check("exactly one provision", provisions().length === 1, String(provisions().length));
  check("no Omada onboard", onboards().length === 0);
  check(
    "only the provision was POSTed",
    posts().length === 1,
    JSON.stringify(posts().map((p) => p.path)),
  );
  check(
    "instant_on_site is exactly the Add Instant On site body minus org/location, MAC normalised",
    JSON.stringify(prov?.body.instant_on_site) ===
      JSON.stringify({
        name: "Aruba AP21 Lobby",
        serial_number: "VNV5M1K1M6",
        mac_address: "54:F0:B1:C8:A9:0A",
        instant_on_site_id: SITE_ID,
        instant_on_site_name: "inhouse-office",
      }),
    JSON.stringify(prov?.body.instant_on_site),
  );
  check(
    "no router key at all",
    !("router" in (prov?.body ?? {})),
    JSON.stringify(Object.keys(prov?.body ?? {})),
  );
  check(
    "the static-IP answer is not sent (the backend has no such field)",
    !JSON.stringify(prov?.body).includes("static"),
  );
  check(
    "the rest of the provision is intact (org, location, owner, plan)",
    prov?.body.existing_organization_id === "org-existing" &&
      prov?.body.location?.name === "Seaside Hotel" &&
      prov?.body.owner?.email === "asha@example.com" &&
      prov?.body.plan_id === "plan-1",
  );

  const t = await text(page);
  check("result names the Aruba row", /Aruba Instant On site\s+Aruba AP21 Lobby/.test(t), t);
  check("the temporary password is shown, unchanged", t.includes("Temp!Pass-2026"));
  check("an 'Instant On site added' panel", t.includes("Instant On site added"));
  check(
    "it says nothing was sent to the APs or hub yet",
    t.includes("Nothing has been sent to the access points or the RADIUS hub yet"),
  );
  const link = dialog(page).getByRole("link", { name: /Open Instant On setup/ });
  check(
    "links to the row's Instant On setup panel in Router Fleet",
    (await link.count()) === 1 &&
      (await link.getAttribute("href")) === "/master/routers?advanced=rtr-aruba-1",
    String(await link.getAttribute("href").catch(() => null)),
  );
  check("no Omada controller panel", !t.includes("Controller connected"));
  check(
    "onProvisioned got the new location id",
    (await page.evaluate(() => window.__provisioned)).join() === "loc-new-1",
  );
  await link.click();
  check(
    "following the link closes the wizard",
    (await page.locator('[role="dialog"]').count()) === 0,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n5. Aruba with only a name: blank optionals are omitted, not sent empty");
{
  const page = await openAndFillCustomer();
  await arubaCard(page).click();
  await byLabel(page, "Device name").fill("  Aruba Cafe  ");
  await staticYes(page).click();
  await finishToReview(page);
  check(
    "Review says serial/MAC will be minted and no site recorded",
    /minted · minted/.test(await text(page)) && (await text(page)).includes("Not recorded"),
  );
  await provisionButton(page).click();
  await dialog(page).getByText("Location provisioned").waitFor();
  const [prov] = provisions();
  check(
    "instant_on_site is just the trimmed name",
    JSON.stringify(prov?.body.instant_on_site) === JSON.stringify({ name: "Aruba Cafe" }),
    JSON.stringify(prov?.body.instant_on_site),
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n6. A refusal is a provisioning failure, verbatim, with nothing claimed");
{
  provisionMode = "refuse";
  const page = await openAndFillCustomer();
  await fillAruba(page);
  await staticYes(page).click();
  await finishToReview(page);
  await provisionButton(page).click();
  await dialog(page).getByText("Provisioning failed").waitFor();
  const t = await text(page);
  check("shows the backend's sentence verbatim", t.includes(REFUSAL));
  check("does not claim the site was added", !t.includes("Instant On site added"));
  check("does not show a temporary password", !t.includes("Temp!Pass-2026"));
  check("one provision attempt, nothing else", posts().length === 1);
  check(
    "the operator can still go back",
    await dialog(page).getByRole("button", { name: /Back/ }).isVisible(),
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n7. MikroTik and Omada payloads are unchanged");
{
  const page = await openAndFillCustomer();
  // Visit Aruba and fill it, then go back to MikroTik: nothing of the Aruba
  // draft may leak into the MikroTik provision.
  await fillAruba(page);
  await dialog(page)
    .getByRole("button", { name: /MikroTik router/ })
    .click();
  await dialog(page).getByPlaceholder("Lobby Router").fill("Lobby Router 1");
  await dialog(page).getByRole("combobox").filter({ hasText: "Select or type a model" }).click();
  await page.getByPlaceholder("Search models, or type a model not listed...").fill("Test Model X");
  await page.getByRole("option", { name: 'Use "Test Model X"' }).click();
  await field(page, "Serial number").fill("SN0001");
  await field(page, "MAC address").fill("AA:BB:CC:DD:EE:01");
  await finishToReview(page);
  await provisionButton(page).click();
  await dialog(page).getByText("Location provisioned").waitFor();
  const [prov] = provisions();
  check(
    "MikroTik: the router object is exactly what it was",
    JSON.stringify(prov?.body.router) ===
      JSON.stringify({
        name: "Lobby Router 1",
        serial_number: "SN0001",
        mac_address: "AA:BB:CC:DD:EE:01",
        model: "Test Model X",
      }),
    JSON.stringify(prov?.body.router),
  );
  check("MikroTik: no instant_on_site key", !("instant_on_site" in (prov?.body ?? {})));
  const t = await text(page);
  check("MikroTik: result row is labelled Router", /Router\s+Lobby Router 1/.test(t));
  check("MikroTik: no Instant On panel", !t.includes("Instant On site added"));
  await page.close();
}
{
  const page = await openAndFillCustomer();
  await dialog(page)
    .getByRole("button", { name: /TP-Link Omada controller/ })
    .click();
  await dialog(page)
    .getByRole("button", { name: /Hotspot operator/ })
    .click();
  for (const [label, value] of Object.entries({
    "Controller name": "Seaside Controller",
    "Controller address": "https://ctl.example.com:8043",
    "Hotspot operator name": "wyfy-operator",
    "Hotspot operator password": "op-Secret-9731",
    "Omada site id": "6aa3913c3ee1605f71ac35a1",
  })) {
    await byLabel(page, label).fill(value);
  }
  await finishToReview(page);
  await provisionButton(page).click();
  await dialog(page).getByText("Controller connected").waitFor();
  const [prov] = provisions();
  check(
    "Omada: provision has neither router nor instant_on_site",
    !("router" in (prov?.body ?? {})) && !("instant_on_site" in (prov?.body ?? {})),
    JSON.stringify(Object.keys(prov?.body ?? {})),
  );
  check("Omada: the onboard still follows", onboards().length === 1);
  check("Omada: no Instant On panel", !(await text(page)).includes("Instant On site added"));
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n8. The device wizard does not grow an Aruba option");
{
  const schemas = readFileSync(join(ROOT, "src/lib/router-schemas.ts"), "utf8");
  const vendorBlock = schemas.slice(
    schemas.indexOf("export const VENDOR_CHOICES"),
    schemas.indexOf("export const AUTH_MODE_CHOICES"),
  );
  check(
    "VENDOR_CHOICES (shared with RouterWizard) has no Aruba entry",
    vendorBlock.length > 0 && !/aruba/i.test(vendorBlock),
  );
  check(
    "ROUTER_VENDORS is unchanged",
    /export const ROUTER_VENDORS = \["mikrotik", "tplink_omada"\] as const;/.test(schemas),
  );
}

await browser.close();
server.close();
console.log(
  failures === 0
    ? "\ncustomer wizard aruba: all checks passed"
    : `\ncustomer wizard aruba: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
