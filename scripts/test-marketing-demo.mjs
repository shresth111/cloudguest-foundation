/**
 * The Marketing screens in the DEMO workspace, mounted for real in Chromium.
 *
 * Everything below the page is the real code: MarketingView, every tab, the
 * hooks, `useMarketingApi`, and the in-memory demo backend. Only the router
 * and the auth context are stood in (this harness has no route tree or
 * sign-in). The demo session is the real one: the sentinel token in
 * localStorage on a host where the demo is enabled.
 *
 * What it proves:
 *   1. NO /marketing (or any /api) REQUEST leaves the browser in demo mode --
 *      every request the page makes is recorded and asserted empty.
 *   2. Nothing is locked: channels are Live, the demo banner says the data is
 *      sample data, and every tab has content.
 *   3. Actions behave believably and say "Demo: nothing was actually sent".
 *   4. The live audience count reacts to the filters.
 *
 * Run: node scripts/test-marketing-demo.mjs
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "marketing-demo-"));
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

writeFileSync(
  join(work, "router-stub.js"),
  `import React from "react";
   export function useNavigate() { return () => {}; }
   export function useSearch() { return {}; }
   export function Link({ children }) { return React.createElement("a", { href: "#" }, children); }`,
);
writeFileSync(
  join(work, "auth-stub.js"),
  `export function useAuth() {
     // The demo session's own role (AuthContext's demo sign-in): Super Admin, GLOBAL.
     return { user: { id: "u-demo" }, roles: [{ roleId: "r-001", roleName: "Super Admin", roleSlug: "super-admin", scopeType: "global" }] };
   }
   export const ROLES_STORAGE_KEY = "cloudguest_roles";
   export const ORGS_STORAGE_KEY = "cloudguest_organizations";`,
);

const view = join(ROOT, "src/components/marketing/MarketingView.tsx").replace(/\\/g, "/");
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { Toaster } from "sonner";
   import { MarketingView } from "${view}";
   const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={client}>
       <MarketingView locationId="loc-1" />
       <Toaster />
     </QueryClientProvider>,
   );`,
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
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "/api/v1",
      VITE_ENABLE_DEMO_LOGIN: "true",
    }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@tanstack/react-router": join(work, "router-stub.js"),
    "@/context/AuthContext": join(work, "auth-stub.js"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (name === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><meta charset=utf-8><title>marketing demo harness</title>
       <script>
         localStorage.setItem("cloudguest_token", "demo-access-token");
         localStorage.setItem("cloudguest_roles", JSON.stringify([{ scopeType: "global", roleSlug: "super-admin" }]));
         localStorage.setItem("cloudguest_organizations", JSON.stringify([{ organizationId: "org-001", organizationName: "Acme Corp" }]));
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
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const requests = [];
page.on("request", (r) => {
  const u = new URL(r.url());
  if (!(u.origin === origin && (u.pathname === "/" || u.pathname === "/bundle.js")))
    requests.push(r.url());
});

async function closeAll() {
  for (let i = 0; i < 5 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
}
const toastsText = () =>
  page
    .locator("[data-sonner-toast]")
    .allInnerTexts()
    .then((t) => t.join(" | "));

try {
  await page.goto(origin);
  await page.getByTestId("marketing-demo-banner").waitFor({ timeout: 15000 });

  console.log("\nnothing is locked, and it says it is a demo");
  check("the demo banner is shown", await page.getByTestId("marketing-demo-banner").isVisible());
  check("no upsell / lock screen", (await page.getByText("Marketing is an add-on").count()) === 0);
  check(
    "SMS, WhatsApp and Email are all Live",
    (await page.getByText("Live", { exact: true }).count()) === 3,
  );

  console.log("\ncampaigns");
  await page.getByText("Weekend brunch offer").first().waitFor();
  for (const name of [
    "Diwali greetings 2026",
    "Weekend brunch offer",
    "Happy hour this Friday",
    "We miss you (win-back)",
    "Live jazz night invite",
    "Loyalty reward (August)",
  ]) {
    check(`lists "${name}"`, (await page.getByText(name, { exact: true }).count()) > 0);
  }

  // Send the win-back draft now.
  await page.getByText("We miss you (win-back)", { exact: true }).first().click();
  const sheet = page.locator('[role="dialog"]').filter({ hasText: "This is a draft" });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Send now" }).click();
  const confirm = page.locator('[role="dialog"]').filter({ hasText: "Send now?" });
  await confirm.waitFor();
  await confirm.getByRole("button", { name: "Send now" }).click();
  await page.getByText("Demo: nothing was actually sent.").first().waitFor({ timeout: 5000 });
  const t1 = await toastsText();
  check(
    "Send now reports the start and says nothing was sent",
    /Sending has started/.test(t1) && /Demo: nothing was actually sent/.test(t1),
    t1,
  );
  await closeAll();

  // A test send from a finished campaign.
  await page.getByText("Weekend brunch offer", { exact: true }).first().click();
  const sheet2 = page.locator('[role="dialog"]').filter({ hasText: "Accepted by provider" });
  await sheet2.waitFor();
  check("a sent campaign shows its numbers", /791/.test(await sheet2.innerText()));
  await sheet2
    .locator("tbody tr")
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  check("and its recipients log", (await sheet2.locator("tbody tr").count()) > 0);
  await sheet2.getByRole("button", { name: "Send a test" }).click();
  const testDlg = page.locator('[role="dialog"]').filter({ hasText: "Send a test" }).last();
  await testDlg.getByLabel("Phone numbers").fill("+91 98765 43210");
  await testDlg.getByRole("button", { name: "Send test" }).click();
  await testDlg.getByText("Accepted by the provider").waitFor({ timeout: 5000 });
  check("a test send shows the provider's answer", true);
  await closeAll();

  console.log("\nnew campaign, end to end");
  await page.getByRole("button", { name: "New campaign" }).click();
  const comp = page.locator('[role="dialog"]').filter({ hasText: "New campaign" });
  await comp.waitFor();
  await comp
    .getByRole("button", { name: /Weekend offer/ })
    .first()
    .click();
  await comp.getByRole("button", { name: "Save & continue" }).click();
  await comp.getByLabel("Offer code").fill("SAT15");
  await comp.getByLabel("Offer valid till").fill("5 Oct");
  await comp.getByRole("button", { name: "Save & continue" }).click();
  await comp.getByText("Who this reaches").waitFor();
  await comp.getByRole("button", { name: "Save & continue" }).click();
  await comp.getByText("What a guest receives").waitFor();
  await comp
    .getByText(/SAT15/)
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  check("the review renders the message with the offer code", /SAT15/.test(await comp.innerText()));
  await comp.getByRole("button", { name: "Schedule" }).click();
  const sched = page.locator('[role="dialog"]').filter({ hasText: "Schedule campaign" });
  await sched.waitFor();
  // SMS has the venue's own Ping4SMS row, which failed verification: the
  // campaign may only go through Wyfy after an explicit acknowledgement.
  check("the dialog says which account sends it", /Sends via: Wyfy default/.test(await sched.innerText()));
  check("the fallback warning is shown", /failed verification/.test(await sched.innerText()));
  check("Schedule is disabled until acknowledged", await sched.getByRole("button", { name: "Schedule" }).isDisabled());
  await sched.getByRole("checkbox", { name: "Send through Wyfy's default account" }).click();
  await sched.getByRole("button", { name: "Schedule" }).click();
  await page
    .getByText(/Scheduled for|quiet hours/)
    .first()
    .waitFor({ timeout: 5000 });
  const t3 = (await toastsText()) + (await sched.innerText().catch(() => ""));
  check(
    "scheduling answers like the real API (scheduled, or refused in quiet hours)",
    /Scheduled for|quiet hours/.test(t3),
    t3.slice(0, 300),
  );
  await closeAll();

  console.log("\ntemplates");
  await page.getByRole("tab", { name: "Templates" }).click();
  await page.getByText("Monsoon chai special").waitFor();
  for (const n of [
    "Welcome back",
    "Weekend offer",
    "Diwali greetings",
    "We miss you",
    "Monsoon chai special",
    "New menu launch",
  ]) {
    check(`shows template "${n}"`, (await page.getByText(n, { exact: true }).count()) > 0);
  }
  // Duplicate a Wyfy template.
  await page.getByRole("button", { name: "Duplicate" }).first().click();
  const dup = page.locator('[role="dialog"]').filter({ hasText: "Duplicate template" });
  await dup.getByRole("button", { name: "Duplicate" }).click();
  await page
    .getByText(/\(copy\)/)
    .first()
    .waitFor({ timeout: 5000 });
  check(
    "duplicating a template adds it to Your templates",
    (await page.getByText(/\(copy\)/).count()) > 0,
  );
  await closeAll();

  console.log("\naudience");
  await page.getByRole("tab", { name: "Audience" }).click();
  const reach = page.locator("text=guests reachable on").locator("xpath=preceding-sibling::p[1]");
  await reach.waitFor();
  await page.waitForTimeout(700);
  const before = await reach.innerText();
  await page.getByLabel("At least … visits").fill("4");
  await page.waitForTimeout(1200);
  const after = await reach.innerText();
  check(
    "the live count reacts to the filters",
    before !== after && Number(after.replace(/,/g, "")) < Number(before.replace(/,/g, "")),
    `${before} -> ${after}`,
  );
  check("the opt-in is on", (await page.getByText("On", { exact: true }).count()) > 0);
  check(
    "contacts are listed with masked numbers",
    (await page.locator("text=/\\+91\\*{6}\\d{4}/").count()) > 0,
  );

  console.log("\ndelivery logs");
  await page.getByRole("tab", { name: "Delivery logs" }).click();
  await page.locator("tbody tr").first().waitFor();
  check("delivery rows are listed", (await page.locator("tbody tr").count()) > 0);

  console.log("\nchannels (bring-your-own providers)");
  await page.getByRole("tab", { name: "Channels" }).click();
  const emailCard = page.getByTestId("provider-card-email");
  await emailCard.waitFor();
  check("email sends through the venue's own SES", /Using your own · Amazon SES \(offers@acmecafe\.in\)/.test(await emailCard.innerText()));
  const smsCard = page.getByTestId("provider-card-sms");
  check("the own SMS provider shows Failed with its reason", /Failed/.test(await smsCard.innerText()) && /DLT template ID/.test(await smsCard.innerText()));
  await emailCard.getByRole("button", { name: "Edit" }).click();
  const form = page.locator('[role="dialog"]').filter({ hasText: "Your own Email provider" });
  await form.waitFor();
  const secrets = form.locator('input[data-secret="true"]');
  const n = await secrets.count();
  const values = await secrets.evaluateAll((els) => els.map((e) => e.value));
  const placeholders = await secrets.evaluateAll((els) => els.map((e) => e.placeholder));
  check("secret inputs are empty, never prefilled", n === 2 && values.every((v) => v === ""), JSON.stringify(values));
  check("and show only the saved hint", placeholders.every((p) => /^Saved \(…\w{4}\)\. Leave blank to keep\.$/.test(p)), JSON.stringify(placeholders));
  await closeAll();

  await smsCard.getByRole("button", { name: "Verify" }).click();
  const vd = page.locator('[role="dialog"]').filter({ hasText: "Verify your SMS provider" });
  await vd.waitFor();
  await vd.getByLabel(/Send the test to/).fill("+91 98765 43210");
  await vd.getByRole("combobox", { name: "Template" }).click();
  await page.getByRole("option", { name: "Monsoon chai special" }).click();
  await vd.getByRole("button", { name: "Verify" }).click();
  await vd.getByTestId("verify-checks").waitFor({ timeout: 5000 });
  check("verification reports each check", /Credentials/.test(await vd.innerText()) && /Test message/.test(await vd.innerText()));
  await closeAll();
  await page.waitForTimeout(300);
  check("after verifying, the SMS card reads Verified", /Verified/.test(await smsCard.innerText()));

  console.log("\nown-provider failure on a campaign");
  await page.getByRole("tab", { name: "Campaigns" }).click();
  await page.getByText("Live jazz night invite", { exact: true }).first().click();
  const jazz = page.getByTestId("own-provider-failure");
  await jazz.waitFor({ timeout: 5000 });
  check("the failure banner says nothing went through Wyfy", /not sent through Wyfy/.test(await jazz.innerText()));
  check("the campaign shows its provider", /via Your Amazon SES/.test(await page.getByTestId("campaign-provider").innerText()));
  await closeAll();

  console.log("\nthe demo never touches the network");
  check(
    "no request other than the page itself",
    requests.length === 0,
    requests.slice(0, 5).join(", "),
  );
  check("in particular, no /marketing request", !requests.some((u) => /marketing/.test(u)));
  check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

console.log(
  failures === 0
    ? "\nall marketing demo checks passed\n"
    : `\n${failures} marketing demo check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
