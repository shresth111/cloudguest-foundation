/**
 * Render-level regression test for the Edit Plan dialog
 * (`src/components/billing/PlanManagement.tsx`'s `PlanEditor`).
 *
 * Run: `npm run test:plan-editor`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * Reported from the live master console as "it doesn't work and it won't
 * go away": the Edit Plan dialog opened, Save did nothing at all, and
 * there was no message of any kind explaining why. Three separate defects
 * produced that one symptom, and NONE of them is visible to `tsc`,
 * `eslint`, or `vite build` -- every one of them type-checks perfectly:
 *
 *   1. THE SILENT ONE. `LimitField` renders `<input type="number" min={1}>`.
 *      A plan whose backend feature row carries `limit_value: 0` (or a
 *      storage quota under ~512 MB, which `toPlan` rounds down to 0 GB)
 *      loads that input with value 0 -- which fails the BROWSER'S OWN
 *      constraint validation. Chromium then refuses to fire the form's
 *      submit event at all: no React handler, no zod resolver, no request,
 *      no message. Measured before the fix: 0 submit events. The form now
 *      carries `noValidate`, making RHF + planSchema the only validator --
 *      the only one of the two that can render something a user can read.
 *
 *   2. `PlanEditor` rendered a validation message for exactly ONE of its
 *      thirteen fields (`name`). A resolver rejection on any other field
 *      aborted the submit with nothing on screen.
 *
 *   3. `save.mutate` was given an `onSuccess` and no `onError`, so a
 *      rejected save (a 403 on /plans/{id} being the likely one) resolved
 *      into nothing: the dialog sat open waiting on a success that was
 *      never coming.
 *
 * All three share a failure mode this repo has shipped before and that no
 * static gate can see: THE FORM SILENTLY DOES NOTHING. So the load-bearing
 * assertion here is the submit-event count -- restore `min={1}` without
 * `noValidate` and check `limit-zero-submit-fires` goes red immediately.
 *
 * The component under test is the real `PlanManagement`, bundled with
 * esbuild. Only two edges are substituted: `@/hooks/useBilling` (which
 * would drag in axios and a live QueryClient) and `sonner` (whose toasts
 * render outside the dialog). planSchema, react-hook-form, the zod
 * resolver and every UI primitive are the real ones.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "plan-editor-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name} -- ${detail}`);
  }
};

// --- stubs -----------------------------------------------------------
// The mutation edge. `window.__saveMode` decides how the "server" answers,
// so one bundle covers success, a 403, and an unreachable server.
writeFileSync(
  join(work, "billing-hooks-stub.js"),
  `import { useRef, useState } from "react";
   export function useDeletePlan() {
     return { mutate: (id, opts) => { window.__calls.push({ kind: "delete" }); opts?.onError?.(window.__errorFor("delete")); } };
   }
   export function useSavePlan() {
     const [isPending, setPending] = useState(false);
     const ref = useRef(null);
     if (!ref.current) {
       ref.current = {
         mutate: (vars, opts) => {
           window.__calls.push({ kind: "mutate", vars });
           setPending(true);
           const mode = window.__saveMode || "ok";
           if (mode === "hang") return;            // stays in flight forever
           setTimeout(() => {
             setPending(false);
             if (mode === "ok") { window.__calls.push({ kind: "success" }); opts?.onSuccess?.({}); }
             else { window.__calls.push({ kind: "error", mode }); opts?.onError?.(window.__errorFor(mode)); }
           }, 30);
         },
       };
     }
     return { ...ref.current, isPending };
   }`,
);

writeFileSync(
  join(work, "sonner-stub.js"),
  `export const toast = Object.assign(
     (m) => window.__calls.push({ kind: "toast", level: "plain", m }),
     { success: (m) => window.__calls.push({ kind: "toast", level: "success", m }),
       error: (m, o) => window.__calls.push({ kind: "toast", level: "error", m, o }) });
   export const Toaster = () => null;`,
);

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { PlanManagement } from "@/components/billing/PlanManagement";
   window.__calls = [];
   // Real AppError shapes, exactly as api.ts's response interceptor builds
   // them (see toAppError) -- a 403 carries status + code, never an Error.
   window.__errorFor = (mode) => ({
     403: { status: 403, code: "forbidden", message: "Permission denied: 'plan:update' is required at global scope" },
     offline: { status: null, code: "network_error", message: "Unable to reach the server" },
     delete: { status: 403, code: "forbidden", message: "Permission denied" },
   }[mode]);
   createRoot(document.getElementById("root")).render(<PlanManagement plans={[window.__plan]} />);`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "plan-editor-aliases",
      setup(b) {
        b.onResolve({ filter: /^@\/hooks\/useBilling$/ }, () => ({
          path: join(work, "billing-hooks-stub.js"),
        }));
        b.onResolve({ filter: /^sonner$/ }, () => ({ path: join(work, "sonner-stub.js") }));
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

// A plan shaped exactly like billing.service.ts's toPlan() output.
const VALID_PLAN = {
  id: "plan-1",
  name: "Starter",
  tier: "starter",
  currency: "INR",
  monthlyPrice: 999,
  annualPrice: 11988,
  includedLocations: 1,
  includedRouters: 1,
  includedGuests: 500,
  storageLimitGb: 10,
  apiAccess: false,
  whiteLabel: false,
  pmsIntegration: false,
  aiFeatures: false,
  supportLevel: "basic",
  popular: false,
};

let servedPlan = VALID_PLAN;
const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (name === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><meta charset=utf-8><title>plan editor harness</title>
       <script>window.__plan = ${JSON.stringify(servedPlan)};</script>
       <div id=root></div><script type=module src="./bundle.js"></script>`,
    );
  }
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

/** Open the editor for `plan`, press Save, and report what happened. */
async function attemptSave(plan, { saveMode = "ok", before } = {}) {
  servedPlan = plan;
  const page = await browser.newPage();
  await page.goto(origin);
  await page.getByRole("button", { name: /^Edit$/ }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate((m) => {
    window.__saveMode = m;
  }, saveMode);

  // Count real submit events on the real <form>. This is the assertion
  // that catches defect 1: native constraint validation suppresses the
  // event entirely, so React never learns the user pressed anything.
  await page.evaluate(() => {
    window.__submits = 0;
    document
      .querySelector('[role="dialog"] form')
      .addEventListener("submit", () => window.__submits++, true);
  });

  if (before) await before(page);
  await page.getByRole("button", { name: /Save plan|Saving/ }).click();
  await page.waitForTimeout(250);

  const open = (await page.locator('[role="dialog"]').count()) > 0;
  return {
    page,
    open,
    submits: await page.evaluate(() => window.__submits),
    calls: await page.evaluate(() => window.__calls),
    banner: open ? await page.locator('[role="dialog"] [role="alert"]').allInnerTexts() : [],
    messages: open ? await page.locator('[role="dialog"] .text-destructive').allInnerTexts() : [],
  };
}

console.log("\nEdit Plan dialog:");

// --- 1. the happy path still works -----------------------------------
{
  const r = await attemptSave(VALID_PLAN);
  check("valid-save-submits", r.submits === 1, `expected 1 submit event, got ${r.submits}`);
  check(
    "valid-save-calls-mutation",
    r.calls.some((c) => c.kind === "mutate"),
    "a valid plan must actually reach the save mutation",
  );
  check("valid-save-closes-dialog", !r.open, "a successful save must dismiss the dialog");
  check(
    "valid-save-toasts",
    r.calls.some((c) => c.kind === "toast" && c.level === "success"),
    "a successful save must confirm itself",
  );
  await r.page.close();
}

// --- 2. THE SILENT ONE: a limit of 0 must still reach React ----------
// Regression guard for `noValidate`. Remove it and submits drops to 0.
for (const [label, patch] of [
  ["locations", { includedLocations: 0 }],
  ["routers", { includedRouters: 0 }],
  ["guests", { includedGuests: 0 }],
  ["storage", { storageLimitGb: 0 }],
]) {
  const r = await attemptSave({ ...VALID_PLAN, ...patch });
  check(
    `limit-zero-submit-fires-${label}`,
    r.submits === 1,
    `a plan with ${label} = 0 produced ${r.submits} submit events -- the browser's own ` +
      "constraint validation is suppressing the event again; the <form> needs noValidate",
  );
  check(
    `limit-zero-explains-itself-${label}`,
    r.banner.length > 0 && r.messages.some((m) => /at least 1|Unlimited/i.test(m)),
    `a plan with ${label} = 0 must say which field is wrong, not just refuse ` +
      `(banner=${JSON.stringify(r.banner)} messages=${JSON.stringify(r.messages)})`,
  );
  check(
    `limit-zero-does-not-fake-success-${label}`,
    !r.calls.some((c) => c.kind === "mutate") && r.open,
    "an invalid plan must not reach the mutation, and the dialog must stay open",
  );
  await r.page.close();
}

// --- 3. a blank price is a validation failure, not a no-op -----------
{
  const r = await attemptSave(VALID_PLAN, {
    before: (page) => page.locator('[role="dialog"] input[type=number]').first().fill(""),
  });
  check("blank-price-submits", r.submits === 1, `expected 1 submit event, got ${r.submits}`);
  check(
    "blank-price-explains-itself",
    r.messages.some((m) => /monthly price/i.test(m)),
    `clearing the price must name the price field (got ${JSON.stringify(r.messages)})`,
  );
  await r.page.close();
}

// --- 4. a failed request must say so, in the dialog ------------------
{
  const r = await attemptSave(VALID_PLAN, { saveMode: "403" });
  check(
    "rejected-save-reaches-mutation",
    r.calls.some((c) => c.kind === "mutate"),
    "the request must actually be attempted",
  );
  check("rejected-save-keeps-dialog-open", r.open, "a failed save must not look like it worked");
  check(
    "rejected-save-shows-a-reason",
    r.banner.some((b) => /permission/i.test(b) && /403/.test(b)),
    `a 403 must name the permission problem and the status (got ${JSON.stringify(r.banner)})`,
  );
  check(
    "rejected-save-does-not-claim-success",
    !r.calls.some((c) => c.kind === "toast" && c.level === "success"),
    "a failed save must never emit the success toast",
  );

  // ...and the user must still be able to leave.
  const cancel = r.page.getByRole("button", { name: "Cancel" });
  check("rejected-save-cancel-enabled", await cancel.isEnabled(), "Cancel must survive a failure");
  await cancel.click();
  await r.page.waitForTimeout(200);
  check(
    "rejected-save-cancel-closes",
    (await r.page.locator('[role="dialog"]').count()) === 0,
    "Cancel must dismiss the dialog after a failed save",
  );
  await r.page.close();
}

// --- 5. an unreachable server is distinguishable from a rejection ----
{
  const r = await attemptSave(VALID_PLAN, { saveMode: "offline" });
  check(
    "offline-save-shows-a-reason",
    r.banner.some((b) => /reach the server/i.test(b)),
    `a network failure must say nothing was saved (got ${JSON.stringify(r.banner)})`,
  );
  await r.page.close();
}

// --- 6. the dialog is never a trap ------------------------------------
{
  servedPlan = VALID_PLAN;
  const page = await browser.newPage();
  await page.goto(origin);
  await page.getByRole("button", { name: /^Edit$/ }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() => {
    window.__saveMode = "hang";
  });
  await page.getByRole("button", { name: /Save plan/ }).click();
  await page.waitForTimeout(80);

  const cancel = page.getByRole("button", { name: "Cancel" });
  check(
    "in-flight-cancel-enabled",
    await cancel.isEnabled(),
    "Cancel must stay usable while a save is in flight -- a dialog the user " +
      "cannot escape is worse than the bug this file fixes",
  );
  check(
    "in-flight-save-disabled",
    !(await page.getByRole("button", { name: /Saving/ }).isEnabled()),
    "the Save button must not allow a double submit while in flight",
  );
  await cancel.click();
  await page.waitForTimeout(200);
  check(
    "in-flight-cancel-closes",
    (await page.locator('[role="dialog"]').count()) === 0,
    "Cancel must dismiss the dialog even mid-request",
  );
  await page.close();
}

// --- 7. Escape and the close affordance both work --------------------
{
  servedPlan = VALID_PLAN;
  const page = await browser.newPage();
  await page.goto(origin);
  await page.getByRole("button", { name: /^Edit$/ }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check(
    "escape-closes",
    (await page.locator('[role="dialog"]').count()) === 0,
    "Escape must dismiss the dialog",
  );

  await page.getByRole("button", { name: /^Edit$/ }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(200);
  check(
    "close-button-closes",
    (await page.locator('[role="dialog"]').count()) === 0,
    "the dialog's own close affordance must dismiss it",
  );
  await page.close();
}

// --- 8. every field can render a message -----------------------------
// A source-level backstop for defect 2: it is the omission of a message
// slot, not its contents, that made this dialog look dead. Counted rather
// than eyeballed so a field added later without one is visible here.
{
  const src = readFileSync(join(ROOT, "src/components/billing/PlanManagement.tsx"), "utf8");
  const slots = (src.match(/<FieldError\b/g) ?? []).length;
  // 6 = name, tier, supportLevel, currency, monthlyPrice, and the one
  // inside LimitField that serves all four included-limit fields. The four
  // boolean switches cannot fail z.boolean(), so they need no slot.
  check(
    "every-field-has-an-error-slot",
    slots >= 6,
    `only ${slots} <FieldError> slots -- each editable field needs one, or its ` +
      "rejection is invisible again",
  );
  check(
    "form-is-novalidate",
    /<form\s+noValidate/.test(src),
    "the <form> must keep noValidate, or native constraint validation silently " +
      "suppresses submit for any out-of-range value",
  );
  check(
    "save-has-an-error-handler",
    /onError:/.test(src),
    "save.mutate must handle rejection, or a failed save shows nothing at all",
  );
}

await browser.close();
server.close();

console.log("");
if (failures.length) {
  console.log(`plan-editor-feedback: ${failures.length} FAILED`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("plan-editor-feedback: all checks passed");
