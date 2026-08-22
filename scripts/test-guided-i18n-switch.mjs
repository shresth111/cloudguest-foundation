/**
 * A language switch must not reset anything.
 *
 * The failure mode this guards is a REMOUNT, and a remount is invisible in
 * a diff. Any of these causes one, and every one is a plausible edit:
 *
 *   - wrapping the module in <I18nextProvider>
 *   - deriving a React `key` from a translated string
 *   - putting the language in a context whose provider sits above the
 *     stateful components
 *   - a Suspense boundary that actually suspends on `changeLanguage`
 *
 * The cost is not cosmetic. The operator is at a rack, mid-provision, with
 * router output pasted into checks, a verdict recorded against each, the
 * router's name typed into the regenerate guard and a diagnostics query on
 * screen. A language button that drops that is worse than no button.
 *
 * Shape follows `test-portal-signin-fields.mjs`, which is this repo's
 * established browser-test pattern: bundle the REAL component tree with
 * esbuild, stub only the framework edge, serve it, drive a real Chromium.
 * CI already installs Chromium for that suite, so this one costs no new
 * infrastructure -- see .github/workflows/ci.yml.
 *
 * Only `MasterShell` is stubbed. `GuidedSetup`, `PhaseView`, `CheckRow`,
 * `CopyBlock`, `GeneratedChunkCallout`, `RegenerateGuard`,
 * `DiagnosticsLookup`, `content-i18n.ts`, `progress.ts`, the analyser and
 * both content files are the real, unmodified modules.
 *
 * Needs Playwright's Chromium: `npx playwright install chromium`
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, extname } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "guided-i18n-switch-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}`);
  }
};
const same = (name, before, after, why) =>
  check(
    name,
    before === after,
    `${why}\n      before: ${String(before).slice(0, 200)}\n      after : ${String(after).slice(0, 200)}`,
  );

// --- stub only the framework edge -----------------------------------------
// The real MasterShell needs a router context, a live session, the sidebar,
// the notification bell and global search. None of that is under test, and
// standing it up would make this a test of the auth stack.
writeFileSync(
  join(work, "shell-stub.jsx"),
  `export function MasterShell({ title, children }) {
     return <div><h1 data-testid="shell-title">{title}</h1>{children}</div>;
   }`,
);

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { GuidedSetup } from "@/components/routers/guided-setup/GuidedSetup";
   import { GuidedDevanagariFont } from "@/components/routers/guided-setup/GuidedDevanagariFont";
   import masterI18n from "@/lib/master-i18n";
   import { PHASES } from "@/components/routers/guided-setup/phases.content";
   // Exposed for the test only. The content override bundles ship EMPTY
   // today (the content translation is sequenced after the output-analyser
   // work), so without this every translatable content string would be
   // identical in all three registers and the remount assertions below
   // would pass vacuously -- a React key derived from a translated label
   // would never actually change. The test installs a real override bundle
   // at runtime so the hazard is genuinely exercised.
   window.__guided = { masterI18n, PHASES };
   const router = {
     id: "harness-router-1", name: "Harness Router 1",
     model: "hAP ac2", locationName: "Test Venue", status: "online",
   };
   createRoot(document.getElementById("root")).render(
     <><GuidedDevanagariFont /><GuidedSetup router={router} onBack={() => {}} /></>
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
  loader: { ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "guided-aliases",
      setup(b) {
        b.onResolve({ filter: /^@\/components\/master\/MasterShell$/ }, () => ({
          path: join(work, "shell-stub.jsx"),
        }));
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const p of [
            base,
            `${base}.tsx`,
            `${base}.ts`,
            `${base}.json`,
            join(base, "index.ts"),
          ]) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8><title>Guided Setup switch harness</title>
   <div id=root></div><script type=module src="./bundle.js"></script>`,
);

// --- serve it --------------------------------------------------------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const candidates = [join(work, name), join(ROOT, "public", name)];
  for (const p of candidates) {
    try {
      const body = readFileSync(p);
      res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
      return res.end(body);
    } catch {
      /* try next */
    }
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- drive a real browser --------------------------------------------------
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.goto(origin);
await page.waitForSelector(".guided-setup-surface", { timeout: 15000 });

const STORAGE_KEY = "cg_guided_setup_harness-router-1";

/** Everything that must survive a switch, in one snapshot. */
const snapshot = () =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    // A wall-clock stamp written on every save; not state the operator can
    // lose, and comparing it would only measure how long the test took.
    if (parsed) delete parsed.updatedAt;
    return {
      progress: JSON.stringify(parsed),
      // THE NEVER-TRANSLATE SURFACE, asserted in a real DOM rather than
      // by inspection: paste-block scripts and, for pasteable checks, the
      // `expect` the operator compares against his terminal. Both render
      // monospaced. Scoped to `.font-mono` deliberately -- an OBSERVE-ONLY
      // check has no device output to compare, so its `expect` is a
      // sentence, renders `.font-sans`, and is SUPPOSED to translate.
      // Lumping the two together would either forbid a legitimate
      // translation or wave through a translated command.
      pres: [...document.querySelectorAll("pre.font-mono")].map((n) => n.textContent).join("␞"),
      prose_pres: [...document.querySelectorAll("pre.font-sans")]
        .map((n) => n.textContent)
        .join("␞"),
      textareas: [...document.querySelectorAll("textarea")].map((n) => n.value).join("␞"),
      inputs: [...document.querySelectorAll("input")].map((n) => n.value).join("␞"),
      boxes: [...document.querySelectorAll('[role="checkbox"]')]
        .map((n) => n.getAttribute("data-state"))
        .join("␞"),
      prose: document.body.innerText,
      lang: [...document.querySelectorAll('[aria-pressed="true"]')]
        .map((n) => n.textContent)
        .join(","),
    };
  }, STORAGE_KEY);

console.log("\nGuided Setup, mid-session language switch:\n");

// Install a runtime content-override bundle so translatable content
// really does differ per register (see the harness comment above).
await page.evaluate(() => {
  const { masterI18n, PHASES } = window.__guided;
  for (const [lng, tag] of [
    ["en", "EN"],
    ["hi", "HI"],
  ]) {
    const phases = {};
    for (const p of PHASES) {
      phases[p.id] = {
        title: `${tag} ${p.title}`,
        why: p.why ? `${tag} ${p.why}` : undefined,
        paste: Object.fromEntries(
          p.paste.map((b, i) => [String(i), { label: `${tag} ${b.label}` }]),
        ),
        checks: Object.fromEntries(p.checks.map((c) => [c.id, { label: `${tag} ${c.label}` }])),
      };
    }
    masterI18n.addResourceBundle(lng, "guidedContent", { phases }, true, true);
  }
});
await page.waitForTimeout(100);

const initial = await snapshot();
check(
  "default-register-is-hinglish",
  initial.lang === "Hinglish",
  `the field-tested register must be the default; the switcher reports "${initial.lang}"`,
);

// --- get into a genuinely mid-session state --------------------------------
// Step 5 is the secrets phase: it carries a generated chunk, so the
// regenerate guard and the "I have a copy" acknowledgement both exist.
// Picked by step NUMBER, which is the same in every register.
const rail = page.locator(".guided-setup-surface button").filter({ hasText: /^\d/ });
if ((await rail.count()) >= 5) await rail.nth(4).click();
await page.waitForTimeout(150);

// Paste router output into every check that accepts it.
const textareas = page.locator("textarea");
const taCount = await textareas.count();
for (let i = 0; i < taCount; i += 1) {
  await textareas.nth(i).fill(`harness pasted output ${i}\nflags: X\n`);
}
await page.waitForTimeout(150);

// Tick "I have a copy".
const box = page.locator('[role="checkbox"]').first();
if (await box.count()) await box.click();

// Open the regenerate guard and type the router name into it.
const guardTrigger = page
  .locator("button")
  .filter({ hasText: /Generate/ })
  .first();
if (await guardTrigger.count()) {
  await guardTrigger.click();
  await page.waitForTimeout(120);
  const guardInput = page.locator('input[autocomplete="off"]').first();
  if (await guardInput.count()) await guardInput.fill("Harness Router 1");
}

// Open diagnostics and seed a query.
const diagBtn = page
  .locator("button")
  .filter({ hasText: /ajeeb|odd|अजीब/ })
  .first();
if (await diagBtn.count()) {
  await diagBtn.click();
  await page.waitForTimeout(180);
  const search = page.locator("input[placeholder]").last();
  if (await search.count()) await search.fill("handshake");
}
await page.waitForTimeout(250);

const mid = await snapshot();
check(
  "harness-reached-mid-session",
  mid.progress !== "null" &&
    mid.textareas.replace(/␞/g, "").length > 0 &&
    mid.inputs.replace(/␞/g, "").length > 0 &&
    mid.pres.length > 0,
  `the harness never reached a stateful mid-session state, so every assertion below would be ` +
    `vacuous. progress=${mid.progress}, textareas="${mid.textareas}", inputs="${mid.inputs}"`,
);

// --- switch, and switch back -----------------------------------------------
for (const [autonym, tag] of [
  ["हिंदी", "hi"],
  ["English", "en"],
  ["Hinglish", "hi-Latn"],
]) {
  const button = page.getByRole("button", { name: autonym, exact: true });
  // Playwright scrolls a target into view before clicking, and the
  // switcher sits in the page header -- so the baseline has to be taken
  // AFTER that scroll, or scrollY would measure the test runner rather
  // than the application.
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);
  const before = await snapshot();
  const scrollBefore = await page.evaluate(() => window.scrollY);

  await button.click();
  await page.waitForTimeout(250);
  const after = await snapshot();
  const scrollAfter = await page.evaluate(() => window.scrollY);

  check(
    `switch-${tag}-actually-switched`,
    after.prose !== before.prose && after.lang === autonym,
    `clicking "${autonym}" changed no rendered prose, so this hop's assertions prove nothing`,
  );
  if (tag === "en" || tag === "hi") {
    const marker = tag === "en" ? "EN " : "HI ";
    check(
      `switch-${tag}-content-overrides-applied`,
      after.prose.includes(marker),
      `the content override bundle for "${tag}" did not reach the screen, so the remount ` +
        `assertions on this hop are vacuous -- translatable content is identical in every ` +
        `register and no key derived from it would change`,
    );
  }
  same(
    `switch-${tag}-progress-untouched`,
    before.progress,
    after.progress,
    `localStorage["${STORAGE_KEY}"] changed across a language switch. Verdicts, the current phase ` +
      `and the secrets acknowledgement all live in that blob.`,
  );
  same(
    `switch-${tag}-pasted-output-kept`,
    before.textareas,
    after.textareas,
    `router output the operator pasted was lost -- a component remounted. This is the single ` +
      `most expensive thing to lose: he has to go back to the terminal and re-run the command.`,
  );
  same(
    `switch-${tag}-typed-input-kept`,
    before.inputs,
    after.inputs,
    `typed text (the regenerate guard's router name, the diagnostics query) was lost`,
  );
  same(
    `switch-${tag}-checkbox-kept`,
    before.boxes,
    after.boxes,
    `the "I have a copy" acknowledgement was lost across a language switch`,
  );
  // The other half of the same boundary: observe-only expectations are
  // prose and must actually move, or `expectLabel` is not reaching the
  // screen and the assertion above is passing for the wrong reason.
  if (tag === "en" || tag === "hi") {
    check(
      `switch-${tag}-observe-only-expect-translated`,
      after.prose_pres !== before.prose_pres && after.prose_pres.length > 0,
      `no observe-only <pre> changed, so expectLabel is not reaching the DOM`,
    );
  }
  same(
    `switch-${tag}-commands-byte-identical`,
    before.pres,
    after.pres,
    `a <pre> changed across a language switch. Those are RouterOS commands, paste scripts and ` +
      `\`expect\` strings -- all matched character-for-character against what the device printed.`,
  );
  same(
    `switch-${tag}-scroll-kept`,
    scrollBefore,
    scrollAfter,
    `the page scrolled on a language switch -- the operator loses his place mid-phase`,
  );
}

// --- persistence -----------------------------------------------------------
await page.getByRole("button", { name: "English", exact: true }).click();
await page.waitForTimeout(180);
const beforeReload = await snapshot();
await page.reload();
await page.waitForSelector(".guided-setup-surface", { timeout: 15000 });
await page.waitForTimeout(300);
const afterReload = await snapshot();

check(
  "language-persists-across-reload",
  afterReload.lang === "English",
  `expected English after a reload, got "${afterReload.lang}" -- cg.master.lang is not read back`,
);
same(
  "progress-persists-across-reload",
  beforeReload.progress,
  afterReload.progress,
  "guided progress did not survive a reload",
);
check("no-page-errors", pageErrors.length === 0, `the page threw: ${pageErrors.join(" | ")}`);

await browser.close();
server.close();
rmSync(work, { recursive: true, force: true });

if (failures.length) {
  console.error("\nGuided Setup language switch FAILED:\n");
  for (const f of failures) console.error(`  x ${f}`);
  process.exit(1);
}
console.log("\nGuided Setup language switch: all checks passed.");
