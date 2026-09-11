/**
 * The Master console's "Add customer" wizard, onboarding a venue whose
 * network is a TP-Link Omada controller.
 *
 * Run: node scripts/test-customer-wizard-omada.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * `PlatformLocationWizard`'s device step was MikroTik-only, so a venue
 * running an Omada controller could not be onboarded from the one place the
 * platform owner creates customers. The Omada path is TWO requests, not one
 * transaction: `POST /locations/provision` with no `router`, then
 * `POST /network-integrations/platform/onboard` with the ids it returned.
 * That split is where the risk is, and none of it is visible to tsc:
 *
 *   - an Omada provision that still sent a `router` would enroll a MikroTik
 *     that does not exist;
 *   - an onboard failure reported as "provisioning failed" would get the
 *     customer provisioned twice;
 *   - a retry that re-ran provision would do the same thing silently;
 *   - a retry that lost the typed credentials would send an onboard the
 *     backend refuses;
 *   - and the MikroTik payload must not change at all.
 *
 * So this drives the REAL wizard in Chromium, through the REAL services,
 * hooks and `api` client (interceptors included), against a local server
 * that plays the backend and records every request body. Only the router's
 * `Link` is stubbed -- the wizard is not mounted inside a route tree here.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "customer-wizard-omada-"));

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
const PORTAL_HOST_AND_QUERY =
  "app.wyfyguest.com/portal?organizationId=org-existing&locationId=loc-new-1&routerId=rtr-omada-1";
const ONBOARD_FAILURE =
  "Could not reach the controller at ctl.example.com:8043: connection timed out";

/** Every API request, in order: { method, path, body }. */
let requests = [];
/** How the next onboard calls answer, consumed front to back. */
let onboardPlan = [];

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
      const withRouter = Boolean(body?.router);
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
          // The new contract: null when the request carried no router.
          router_id: withRouter ? "rtr-mikrotik-1" : null,
          router_name: withRouter ? body.router.name : null,
          owner_user_id: "user-1",
          owner_name: "Asha Rao",
          owner_username: "asha",
          owner_email: "asha@example.com",
          owner_temporary_password: "Temp!Pass-2026",
          login_url: "https://app.example.com/login",
          provisioned_at: "2026-09-12T00:00:00Z",
        }),
      );
    }
    if (req.method === "POST" && path === "/network-integrations/platform/onboard") {
      const mode = onboardPlan.shift() ?? "ok";
      if (mode === "fail") {
        return send(502, JSON.stringify({ success: false, message: ONBOARD_FAILURE, data: {} }));
      }
      return send(
        201,
        envelope(
          {
            integration: {
              id: "int-1",
              organization_id: body.organization_id,
              location_id: body.location_id,
              provider: "omada",
              name: body.name,
              status: "pending",
              external_site_id: body.external_site_id ?? null,
              portal_url_scheme: "https",
              portal_url_host_and_query: PORTAL_HOST_AND_QUERY,
              portal_readiness_gaps: [],
            },
            router_id: "rtr-omada-1",
            router_serial_number: "OMADA-SW-0001",
            router_vendor: "tplink_omada",
            synthetic_identity: true,
          },
          "Controller onboarded",
        ),
      );
    }
    return send(404, JSON.stringify({ success: false, message: `unexpected ${path}`, data: {} }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

const OPERATOR_PASSWORD = "op-Secret-9731";
const provisions = () => requests.filter((r) => r.path === "/locations/provision");
const onboards = () => requests.filter((r) => r.path === "/network-integrations/platform/onboard");
const dialog = (page) => page.locator('[role="dialog"]');
const field = (page, label) => dialog(page).locator(`div:has(> label:text-is("${label}")) > input`);
const cont = (page) =>
  dialog(page)
    .getByRole("button", { name: /^Continue/ })
    .click();

/** Organization, Location and Owner steps, identical for both device types. */
async function openAndFillCustomer() {
  requests = [];
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForSelector('[role="dialog"]');
  // Organization: pre-selected by `initialOrganizationId`, once the org list loads.
  await dialog(page).getByText("Acme Hospitality").waitFor();
  await cont(page);
  // Location.
  await field(page, "Location name").fill("Seaside Hotel");
  await dialog(page).locator('div:has(> label:text-is("Country")) button[role="combobox"]').click();
  await page.getByRole("option", { name: "IN", exact: true }).click();
  await field(page, "State / Region").fill("Goa");
  await field(page, "City").fill("Panaji");
  await field(page, "Postal code").fill("403001");
  await field(page, "Address").fill("1 Beach Road");
  await cont(page);
  // Owner.
  await field(page, "First name").fill("Asha");
  await field(page, "Last name").fill("Rao");
  await field(page, "Email").fill("asha@example.com");
  await cont(page);
  await dialog(page).getByText("First device").waitFor();
  return page;
}

async function fillOmada(page, overrides = {}) {
  await dialog(page)
    .getByRole("button", { name: /TP-Link Omada controller/ })
    .click();
  const values = {
    "Controller name": "Seaside Controller",
    "Controller address": "https://ctl.example.com:8043",
    "Hotspot operator name": "wyfy-operator",
    "Hotspot operator password": OPERATOR_PASSWORD,
    "Omada site": "Default",
    "Guest SSID (optional)": "Seaside-Guest",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    await dialog(page).getByLabel(label, { exact: true }).fill(value);
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
console.log("\n1. Omada: provision without a router, then onboard with the new ids");
{
  const page = await openAndFillCustomer();
  await fillOmada(page);
  await dialog(page)
    .getByRole("button", { name: /Pinned certificate/ })
    .click();
  const pin = "ab".repeat(32);
  await dialog(page).getByLabel("Certificate fingerprint (SHA-256)").fill(pin);
  await finishToReview(page);

  const review = await dialog(page).innerText();
  check(
    "Review summarises the controller: name, address, auth mode, site, SSID, certificate",
    review.includes("Seaside Controller") &&
      review.includes("https://ctl.example.com:8043") &&
      review.includes("Hotspot operator") &&
      review.includes("Default · Seaside-Guest") &&
      review.includes("Pinned certificate"),
    review.slice(0, 600),
  );
  check("Review never shows the operator password", !review.includes(OPERATOR_PASSWORD));
  check(
    "Review says it is two steps, not one transaction",
    /customer still exists and you can\s+retry just the controller/.test(review),
  );

  await provisionButton(page).click();
  await dialog(page).getByText("Controller connected").waitFor();

  const [prov] = provisions();
  const [onb] = onboards();
  check("exactly one provision", provisions().length === 1, String(provisions().length));
  check(
    "the provision body has NO router key at all",
    prov && !("router" in prov.body),
    JSON.stringify(Object.keys(prov?.body ?? {})),
  );
  check(
    "the rest of the provision is intact (org, location, owner, plan)",
    prov?.body.existing_organization_id === "org-existing" &&
      prov?.body.location?.name === "Seaside Hotel" &&
      prov?.body.owner?.email === "asha@example.com" &&
      prov?.body.plan_id === "plan-1",
  );
  check("exactly one onboard", onboards().length === 1, String(onboards().length));
  check("onboard happens AFTER provision", requests.indexOf(prov) < requests.indexOf(onb));
  check(
    "onboard uses the ids provision RETURNED",
    onb?.body.organization_id === "org-existing" && onb?.body.location_id === "loc-new-1",
    JSON.stringify({ org: onb?.body.organization_id, loc: onb?.body.location_id }),
  );
  check(
    "onboard carries the controller: name, address, provider",
    onb?.body.name === "Seaside Controller" &&
      onb?.body.base_url === "https://ctl.example.com:8043" &&
      onb?.body.provider === "omada",
  );
  check(
    "hotspot operator is the default auth mode, and its login is sent",
    onb?.body.auth_mode === "legacy" &&
      onb?.body.username === "wyfy-operator" &&
      onb?.body.password === OPERATOR_PASSWORD,
  );
  check(
    "no Open API app pair is sent in hotspot-operator mode",
    !("client_id" in (onb?.body ?? {})) && !("client_secret" in (onb?.body ?? {})),
  );
  check(
    "site goes up front as both id and name, SSID as its name",
    onb?.body.external_site_id === "Default" &&
      onb?.body.external_site_name === "Default" &&
      onb?.body.guest_ssid_name === "Seaside-Guest",
    JSON.stringify(onb?.body),
  );
  check(
    "certificate trust: pinned with the fingerprint",
    onb?.body.tls_mode === "pinned" && onb?.body.tls_pinned_sha256 === pin,
  );
  check(
    "no serial/MAC for a software controller, and a model the backend will accept",
    !("serial_number" in (onb?.body ?? {})) &&
      !("mac_address" in (onb?.body ?? {})) &&
      onb?.body.controller_model === "Omada Software Controller",
  );

  const text = await dialog(page).innerText();
  check("result shows the customer's temporary password", text.includes("Temp!Pass-2026"));
  check("result shows no Router row for a router-less venue", !/\nRouter\n/i.test(text));
  check("result shows the Scheme value", /Scheme\s+https/.test(text), text.slice(-900));
  check("result shows the URL without https://", text.includes(PORTAL_HOST_AND_QUERY));
  check(
    "...and never with the scheme glued on (the controller rejects that)",
    !text.includes(`https://${PORTAL_HOST_AND_QUERY}`),
  );
  check(
    "names the controller path to paste them into",
    text.includes(
      "Site View → Network Config → Authentication → Portal → (create or edit the portal for the guest SSID) → Authentication Type: External Portal Server → Host Type: URL",
    ),
  );
  check(
    "reminds to add a Pre-Authentication Access entry for the portal host",
    text.includes("Pre-Authentication Access") && text.includes("app.wyfyguest.com"),
  );
  check(
    "each value has a copy button",
    (await dialog(page).getByRole("button", { name: "Copy Scheme" }).count()) === 1 &&
      (await dialog(page).getByRole("button", { name: "Copy URL" }).count()) === 1,
  );
  check("result never shows the operator password", !text.includes(OPERATOR_PASSWORD));
  check(
    "links to the integration",
    (await dialog(page).locator('a[href^="/master/integrations?q="]').count()) === 1,
  );
  check(
    "onProvisioned got the new location id",
    (await page.evaluate(() => window.__provisioned)).join() === "loc-new-1",
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n2. Omada: onboard fails after provision -> partial success, retry only onboard");
{
  onboardPlan = ["fail", "ok"];
  const page = await openAndFillCustomer();
  await fillOmada(page);
  await finishToReview(page);
  await provisionButton(page).click();
  await dialog(page).getByText("was NOT connected").waitFor();

  const text = await dialog(page).innerText();
  check(
    "says plainly the customer and location exist but the controller does not",
    text.includes("The customer and location were created, but the controller was NOT connected."),
  );
  check("shows the backend's own message verbatim", text.includes(ONBOARD_FAILURE));
  check("does NOT report it as a provisioning failure", !text.includes("Provisioning failed"));
  check(
    "the customer's credentials are still on screen",
    text.includes("Temp!Pass-2026") && text.includes("asha"),
  );
  const retry = dialog(page).getByRole("button", { name: /Retry connecting controller/ });
  check("offers Retry connecting controller", (await retry.count()) === 1);
  check("one provision, one onboard so far", provisions().length === 1 && onboards().length === 1);

  // The typed credentials survive to the retry, and can be corrected first.
  await dialog(page).getByRole("button", { name: "Edit controller details" }).click();
  const pwValue = await dialog(page).getByLabel("Hotspot operator password").inputValue();
  check("the operator password is still in the form for the retry", pwValue === OPERATOR_PASSWORD);
  check(
    "...in a password input, not echoed as text",
    (await dialog(page).getByLabel("Hotspot operator password").getAttribute("type")) ===
      "password" && !(await dialog(page).innerText()).includes(OPERATOR_PASSWORD),
  );
  await dialog(page)
    .getByLabel("Controller address", { exact: true })
    .fill("https://ctl2.example.com:8043");

  await retry.click();
  await dialog(page).getByText("Controller connected").waitFor();
  check(
    "retry did NOT call provision again",
    provisions().length === 1,
    String(provisions().length),
  );
  check("retry called onboard again", onboards().length === 2, String(onboards().length));
  const second = onboards()[1]?.body ?? {};
  check(
    "retry targets the SAME organization and location",
    second.organization_id === "org-existing" && second.location_id === "loc-new-1",
  );
  check(
    "retry sends the credentials typed before the failure",
    second.username === "wyfy-operator" && second.password === OPERATOR_PASSWORD,
  );
  check("retry sends the corrected address", second.base_url === "https://ctl2.example.com:8043");
  check(
    "success replaces the failure",
    !(await dialog(page).innerText()).includes("was NOT connected"),
  );
  check(
    "nothing but the listed endpoints was called",
    requests.every((r) =>
      [
        "/organizations",
        "/plans",
        "/features",
        "/locations/provision",
        "/network-integrations/platform/onboard",
      ].includes(r.path),
    ),
    JSON.stringify(requests.map((r) => r.path)),
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n3. Omada: the draft is validated before anything is created");
{
  const page = await openAndFillCustomer();
  await fillOmada(page, {
    "Controller address": "http://ctl.example.com:8043/omada",
    "Hotspot operator password": "",
    "Omada site": "",
  });
  await cont(page);
  const text = await dialog(page).innerText();
  check("stays on the device step", text.includes("First device"));
  check("refuses plain http", /Use https:\/\//.test(text), text.slice(0, 800));
  check("requires the operator password", text.includes("Operator password is required"));
  check("requires the site", /Required — the controller cannot let a guest online/.test(text));

  await dialog(page)
    .getByLabel("Controller address", { exact: true })
    .fill("https://ctl.example.com:8043/omada");
  await cont(page);
  check(
    "refuses a path after the port",
    (await dialog(page).innerText()).includes("Scheme, host and port only — no path"),
  );

  await dialog(page)
    .getByRole("button", { name: /Open API client/ })
    .click();
  await cont(page);
  const openapi = await dialog(page).innerText();
  check(
    "Open API still requires the hotspot operator login",
    openapi.includes("Client ID is required") && openapi.includes("Operator password is required"),
  );
  check("no request was made", !requests.some((r) => r.method === "POST"));
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n4. MikroTik: the payload is unchanged and no onboard is made");
{
  const page = await openAndFillCustomer();
  check(
    "MikroTik is still the default device type",
    (await dialog(page)
      .getByRole("button", { name: /MikroTik router/ })
      .getAttribute("aria-pressed")) === "true",
  );
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
    "the router object is exactly what it was before this change",
    JSON.stringify(prov?.body.router) ===
      JSON.stringify({
        name: "Lobby Router 1",
        serial_number: "SN0001",
        mac_address: "AA:BB:CC:DD:EE:01",
        model: "Test Model X",
      }),
    JSON.stringify(prov?.body.router),
  );
  check("no onboard call", onboards().length === 0);
  const text = await dialog(page).innerText();
  check("result shows the Router row", /Router\s+Lobby Router 1/.test(text));
  check(
    "no controller panel",
    !text.includes("Controller connected") && !text.includes("NOT connected"),
  );
  await page.close();
}

await browser.close();
server.close();
console.log(
  failures === 0
    ? "\ncustomer wizard omada: all checks passed"
    : `\ncustomer wizard omada: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
