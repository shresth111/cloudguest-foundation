/**
 * Render-level security + behaviour test for the venue-authored post-login
 * page's sandbox.
 *
 * Run: `node scripts/test-post-login-html-sandbox.mjs`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * `POST_LOGIN_HTML_SANDBOX` is a security control on a page that is
 * same-origin with the OTP and phone-number screens, and every claim made
 * about it is a claim about *runtime browser behaviour* that neither `tsc`
 * nor a source-text grep can see. A future edit that adds `allow-scripts`
 * "just to make the height work", or a refactor that drops the attribute
 * while keeping the component, would pass every other gate in this repo.
 *
 * So this drives a real Chromium against the real `buildPostLoginSrcDoc`
 * output and the real sandbox string, and asserts the four things the design
 * actually depends on:
 *
 *   1. Script in venue HTML does not run.       (the security claim)
 *   2. The frame cannot reach this document.    (opaque origin)
 *   3. Markup and CSS still render.             (the feature is useful)
 *   4. A link still opens, in a new tab.        (allow-popups, and the
 *                                                `<base target="_blank">`
 *                                                that makes a bare link
 *                                                behave)
 *
 * Check 4 is the one the brief asked to be confirmed rather than assumed:
 * `allow-popups` + `allow-popups-to-escape-sandbox` is the documented pair,
 * but a *bare* `<a href>` with no `target` navigates the FRAME, not a new
 * tab, and would strand a guest inside a 44vh box with no way back. The
 * `<base>` element is what fixes that, and this proves it.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "post-login-sandbox-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    console.log(`  FAIL ${name}: ${detail}`);
    failures.push(name);
  }
};

// The real module, bundled -- not a copy of its constants.
const outfile = join(work, "post-login-html.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/post-login-html.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "neutral",
  logLevel: "silent",
});
const { POST_LOGIN_HTML_SANDBOX, buildPostLoginSrcDoc } = await import(pathToFileURL(outfile).href);

/* A hostile-ish venue paste: a script that would mark the DOM and steal from
 * the parent if it ran, a bare link with no `target`, and enough real markup
 * and CSS to prove the useful half still works. */
const VENUE_HTML = `
<style>#hello { color: rgb(0, 128, 0); font-weight: 700; }</style>
<h2 id="hello">Welcome!</h2>
<p>Show this screen at the desk.</p>
<a id="bare" href="/venue-site">Our menu</a>
<script>
  document.documentElement.setAttribute("data-script-ran", "yes");
  try { window.top.document.body.setAttribute("data-escaped", "yes"); } catch (e) {}
</script>
`;

const PAGE = `<!doctype html><html><body style="margin:0">
<div id="wrap" style="height:200px;overflow-y:auto">
  <iframe id="f" title="Post-login page" sandbox="${POST_LOGIN_HTML_SANDBOX}"
          referrerpolicy="no-referrer" style="display:block;height:100%;width:100%;border:0"
          srcdoc="${buildPostLoginSrcDoc(VENUE_HTML).replace(/"/g, "&quot;")}"></iframe>
</div>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/venue-site") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><title>venue site</title><h1>venue site</h1>");
    return;
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(PAGE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${base}/`);

const frame = page.frameLocator("#f");
await frame.locator("#hello").waitFor({ timeout: 5000 });

// 1. The security claim: no script execution inside the frame.
const scriptRan = await page
  .frames()
  .find((f) => f !== page.mainFrame())
  .evaluate(() => document.documentElement.getAttribute("data-script-ran"));
check("venue <script> does NOT execute", scriptRan === null, `data-script-ran=${scriptRan}`);

// ...and it certainly did not reach out of the frame.
const escaped = await page.evaluate(() => document.body.getAttribute("data-escaped"));
check("nothing from the frame touched this document", escaped === null, `data-escaped=${escaped}`);

// 2. Opaque origin: the embedder cannot read into the frame either, which is
//    the same wall in the other direction and the proof `allow-same-origin`
//    is genuinely absent.
const reachable = await page.evaluate(() => {
  try {
    return document.getElementById("f").contentDocument !== null;
  } catch {
    return false;
  }
});
check(
  "the frame is cross-origin to the portal (no allow-same-origin)",
  reachable === false,
  "contentDocument was readable",
);

// 3. The feature half: markup and the venue's own CSS both render.
const color = await frame.locator("#hello").evaluate((el) => getComputedStyle(el).color);
check(
  "venue markup renders",
  (await frame.locator("#hello").textContent()) === "Welcome!",
  "heading missing",
);
check("venue CSS applies", color === "rgb(0, 128, 0)", `computed color was ${color}`);

// 4. A BARE link -- no target attribute -- opens a new tab rather than
//    navigating the frame, courtesy of the injected `<base target="_blank">`,
//    and the popup is a normal document (allow-popups-to-escape-sandbox).
const [popup] = await Promise.all([
  page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
  frame.locator("#bare").click(),
]);
check("a bare venue link opens a NEW TAB, not inside the frame", popup !== null, "no popup opened");
if (popup) {
  await popup.waitForLoadState().catch(() => {});
  check(
    "and that tab is a real, un-sandboxed document",
    (await popup.title()) === "venue site",
    `popup title was ${await popup.title().catch(() => "(unreadable)")}`,
  );
  await popup.close();
}
check(
  "the portal page itself did not navigate",
  page.url() === `${base}/`,
  `page.url() is ${page.url()}`,
);

// 5. Long content scrolls instead of being clipped -- the consequence of not
//    being able to auto-size the frame. Asserted on the FRAME's own scroller
//    (Chromium's behaviour); the wrapper `<div>` in PostLoginHtmlFrame is the
//    fallback scroller for iOS, which this headless Chromium cannot exercise.
const scrollable = await page
  .frames()
  .find((f) => f !== page.mainFrame())
  .evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", "<div style='height:2000px'></div>");
    document.scrollingElement.scrollTop = 500;
    return document.scrollingElement.scrollTop > 0;
  });
check("tall venue content scrolls inside the frame", scrollable === true, "frame did not scroll");

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll post-login HTML sandbox checks passed.");
