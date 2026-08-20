#!/usr/bin/env node
/**
 * Pixel-based contrast measurement for the guest portal's welcome surface.
 *
 * Run:  npm run measure:portal-contrast            (needs a dev server, see below)
 *       npm run measure:portal-contrast -- --write-screenshots
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * captive-portal-v7-design-spec.md §1.5 is explicit that automated tooling
 * cannot verify this surface: axe-core's `color-contrast` rule returns
 * **`incomplete` -- "background color cannot be determined"** for text over a
 * `background-image`, and throws with impact "unknown" when a *parent*
 * carries one. Lighthouse inherits the same blind spot. So every "passes
 * axe" claim about text standing on a venue photograph is vacuous.
 *
 * The spec's own prescription: "render at 390x844, extract the text region,
 * compute worst-pixel contrast, assert. There is no off-the-shelf package
 * for this." This is that.
 *
 * WHAT IT MEASURES, AND WHAT THE NUMBER MEANS
 * -------------------------------------------
 * For each named text zone it takes the rendered element's bounding box,
 * screenshots that box *twice* -- once with the text visible, once with the
 * text's own colour forced to `transparent` -- and computes, per pixel of
 * the backing-only capture, the WCAG 2.x contrast ratio between the text
 * colour and that backing pixel. It reports the **worst** pixel that lies
 * under a glyph, not the average and not the mode.
 *
 * Using a text-hidden capture for the backing is what makes this correct
 * over a photograph: sampling the composited pixels directly would measure
 * the glyph against itself wherever a glyph covers a pixel. The glyph mask
 * comes from the difference between the two captures, so only pixels a
 * glyph actually paints on are considered -- which is also why an oversized
 * bounding box (a `w-fit` plate with padding, say) does not drag the number
 * down with padding pixels that carry no text.
 *
 * A ratio here is a *lower bound on what the guest sees*, because the worst
 * pixel is taken. That is the only useful statistic for a background nobody
 * has reviewed: the venue uploads the photo, and the design has to hold.
 *
 * HOW THE BACKGROUNDS ARE CHOSEN
 * ------------------------------
 * Four cases, and the first is not a photograph:
 *
 *   worst-case  A synthetic pure-#FFFFFF field. This is the adversarial
 *               input the §1.3 alpha proof is derived against -- no real
 *               photo can be worse for white text, so a pass here is a
 *               pass against every possible upload. Run it first; if it
 *               fails, nothing else matters.
 *   bright      A blown-out, high-key photo (white lobby / overcast sky) --
 *               the §1.1 L2 case, where a white card's own edge measures
 *               ~1.14:1 and the composition dissolves.
 *   dark        A near-black photo -- the case that used to make
 *               `--pg-ink-faint` measure 1.81:1.
 *   busy        High-frequency detail. Note the honest limit the spec
 *               records: a mathematically compliant ratio can still read
 *               badly over a busy image because glyph edges compete with
 *               image edges. This case is here to be looked at, not only
 *               to be scored.
 *
 * PREREQUISITE
 * ------------
 * A dev server on --base (default http://localhost:4320):
 *     npx vite dev --port 4320
 * The `/captive-portal/resolve` call is intercepted in-browser and answered
 * with a synthetic config, so no backend is required. Playwright is already
 * a devDependency; chromium must be installed (`npx playwright install
 * chromium`).
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { PNG } from "./lib/tiny-png.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://localhost:4320");
const OUT = arg("out", "/tmp/portal-contrast");
const WRITE_SHOTS = args.includes("--write-screenshots");

// --- WCAG 2.x sRGB relative luminance ---------------------------------------
const chan = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const lum = (r, g, b) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const ratioL = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

// --- the four backgrounds, as data: URIs so nothing is fetched --------------
// Small SVGs rather than real JPEGs on purpose: they are deterministic, they
// need no binary asset in the repo, and `background-size: cover` scales them
// to the same box a photo would occupy. `busy` carries genuine
// high-frequency content, which is the property that matters.
const svg = (body, w = 24, h = 24) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`,
  );

const BACKGROUNDS = {
  "worst-case": svg(`<rect width="24" height="24" fill="#FFFFFF"/>`),
  bright: svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.6" stop-color="#F2F4F7"/>
       <stop offset="1" stop-color="#DCE3EA"/></linearGradient></defs>
     <rect width="24" height="24" fill="url(#g)"/>
     <circle cx="6" cy="5" r="4" fill="#FFFFFF"/>`,
  ),
  dark: svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0" stop-color="#0B0F14"/><stop offset="1" stop-color="#1C2430"/></linearGradient></defs>
     <rect width="24" height="24" fill="url(#g)"/>
     <circle cx="18" cy="19" r="2" fill="#F8FAFC"/>`,
  ),
  busy: svg(
    `<rect width="24" height="24" fill="#8A6E52"/>
     <g stroke="#F5EFE6" stroke-width="1">
       <path d="M0 3h24M0 9h24M0 15h24M0 21h24"/></g>
     <g fill="#2B1D12"><rect x="2" y="4" width="4" height="4"/><rect x="12" y="10" width="5" height="5"/>
       <rect x="7" y="17" width="6" height="3"/></g>
     <circle cx="20" cy="5" r="3" fill="#FFFFFF"/>`,
  ),
  none: null,
};

/** The synthetic resolve payload. Deliberately exercises the awkward cases:
 *  a real welcome message, a long-ish venue name, and no uploaded logo (the
 *  common state for a new venue, and the one where our own mark stands in
 *  for a real business's branding). */
const backendConfig = (overrides = {}) => ({
  id: "measure",
  name: "The Grand Ashoka Residency",
  theme: "light",
  logo_url: null,
  background_image_url: null,
  primary_color: "#6366f1",
  secondary_color: "#1E293B",
  default_language: "en",
  supported_languages: ["en", "hi"],
  advertisement_banner_url: null,
  advertisement_banner_link: null,
  terms_and_conditions_text: "Fair use applies.",
  terms_and_conditions_url: null,
  privacy_policy_text: null,
  privacy_policy_url: null,
  splash_headline: null,
  splash_welcome_message: "Complimentary high-speed WiFi for our guests. Ask reception for help.",
  redirect_url: null,
  otp_sms_enabled: true,
  otp_email_enabled: false,
  otp_whatsapp_enabled: false,
  username_password_enabled: false,
  voucher_enabled: false,
  resolved_via_location_override: true,
  is_open_now: true,
  business_hours_closed_message: null,
  guest_font_choice: "system",
  background_overlay_strength: 55,
  background_focal_x: 50,
  background_focal_y: 25,
  background_luminance: null,
  background_top_luminance: null,
  background_entropy: null,
  pin_login_enabled: false,
  location_country: "IN",
  ...overrides,
});

/** Every text zone this harness scores, as a stable `data-pg-measure` value
 * emitted by the components themselves. Matching on a purpose-built
 * attribute rather than on a Tailwind class list is deliberate: class lists
 * are churn, and a selector that silently stops matching reports a pass --
 * the worst failure mode an accessibility gate can have.
 *
 * `legacy` is the structural selector that finds the same zone on a build
 * predating the attribute, so the same tool can measure a before/after pair
 * across the branch point. It is a fallback, never the primary. */
const ZONES = [
  { key: "eyebrow", legacy: null },
  { key: "headline", legacy: "main h1" },
  { key: "welcome", legacy: "main h1 + p" },
  { key: "powered-by", legacy: "footer > span:last-child" },
  { key: "powered-by-brand", legacy: null },
  { key: "footer-terms", legacy: "footer a" },
];

async function measureZone(page, key, legacy) {
  const handle =
    (await page.$(`[data-pg-measure="${key}"]`)) ?? (legacy ? await page.$(legacy) : null);
  if (!handle) return { key, found: false };

  const box = await handle.boundingBox();
  if (!box || box.width < 1 || box.height < 1) return { key, found: false };

  const color = await handle.evaluate((el) => getComputedStyle(el).color);
  const m = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (!m) return { key, found: false };
  const textRgb = [Number(m[1]), Number(m[2]), Number(m[3])];
  const textLum = lum(...textRgb);

  const fontSize = await handle.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const fontWeight = await handle.evaluate((el) => Number(getComputedStyle(el).fontWeight) || 400);

  const clip = {
    x: Math.floor(box.x),
    y: Math.floor(box.y),
    width: Math.ceil(box.width),
    height: Math.ceil(box.height),
  };

  const withText = PNG.decode(await page.screenshot({ clip }));
  await handle.evaluate((el) => {
    el.dataset.pgMeasurePrevColor = el.style.color;
    el.style.setProperty("color", "transparent", "important");
    el.style.setProperty("text-shadow", "none", "important");
  });
  const withoutText = PNG.decode(await page.screenshot({ clip }));
  await handle.evaluate((el) => {
    el.style.color = el.dataset.pgMeasurePrevColor ?? "";
    el.style.removeProperty("text-shadow");
    delete el.dataset.pgMeasurePrevColor;
  });

  // A pixel counts as "under a glyph" when hiding the text changed it. The
  // threshold rejects antialiasing noise at the very edge of a stroke, where
  // the glyph contributes a few percent of coverage and the measured ratio
  // would describe a pixel no reader perceives as text.
  const GLYPH_DELTA = 24;
  let worst = Infinity;
  let worstPixel = null;
  let glyphPixels = 0;

  for (let i = 0; i < withText.data.length; i += 4) {
    const d =
      Math.abs(withText.data[i] - withoutText.data[i]) +
      Math.abs(withText.data[i + 1] - withoutText.data[i + 1]) +
      Math.abs(withText.data[i + 2] - withoutText.data[i + 2]);
    if (d < GLYPH_DELTA) continue;
    glyphPixels++;
    const r = ratioL(
      textLum,
      lum(withoutText.data[i], withoutText.data[i + 1], withoutText.data[i + 2]),
    );
    if (r < worst) {
      worst = r;
      worstPixel = [withoutText.data[i], withoutText.data[i + 1], withoutText.data[i + 2]];
    }
  }

  // WCAG's own large-text definition, applied to the measured computed
  // values rather than to what the stylesheet was believed to say.
  const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
  return {
    key,
    found: true,
    textColor: `rgb(${textRgb.join(",")})`,
    fontSize: Number(fontSize.toFixed(2)),
    fontWeight,
    isLarge,
    required: isLarge ? 3 : 4.5,
    glyphPixels,
    worstBackingPixel: worstPixel ? `rgb(${worstPixel.join(",")})` : null,
    worst: glyphPixels ? Number(worst.toFixed(3)) : null,
  };
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  let failures = 0;

  for (const [bgName, bgUri] of Object.entries(BACKGROUNDS)) {
    for (const scale of ["1", "1.25"]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      // ORDER MATTERS AND IS NOT ALPHABETICAL: Playwright evaluates route
      // handlers **last-registered-first**, so the catch-all has to be
      // registered BEFORE the specific handler it must not shadow. Written
      // the natural way round, the `/api/v1/**` stub answers
      // `/captive-portal/resolve` with `null`, the runtime resolves no
      // config at all, and the harness silently measures the "No sign-in
      // methods are available" screen on a blank canvas -- four different
      // backgrounds producing four identical numbers, which is how this was
      // caught.
      //
      // The catch-all itself is not optional: an unhandled request 500s,
      // and an error state is not the screen under test.
      await page.route("**/api/v1/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
      );
      await page.route("**/captive-portal/resolve*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(backendConfig({ background_image_url: bgUri })),
        }),
      );

      await page.goto(
        `${BASE}/portal/welcome?organizationId=11111111-1111-4111-8111-111111111111&locationId=22222222-2222-4222-8222-222222222222&routerId=33333333-3333-4333-8333-333333333333`,
        { waitUntil: "networkidle" },
      );
      await page.waitForSelector('main h1, [data-pg-measure="headline"]', { timeout: 20000 });
      if (scale !== "1") {
        await page.evaluate((s) => {
          document.querySelector(".portal-runtime")?.style.setProperty("--pg-type-scale", s);
        }, scale);
      }
      await page.waitForTimeout(250);

      if (WRITE_SHOTS) {
        mkdirSync(OUT, { recursive: true });
        await page.screenshot({ path: `${OUT}/${bgName}-scale${scale}.png`, fullPage: false });
      }

      for (const zone of ZONES) {
        const r = await measureZone(page, zone.key, zone.legacy);
        const row = { background: bgName, typeScale: scale, ...r };
        results.push(row);
        if (r.found && r.worst !== null && r.worst < r.required) failures++;
      }
      await context.close();
    }
  }
  await browser.close();

  const w = (s, n) => String(s).padEnd(n);
  console.log(
    `\n${w("background", 12)}${w("scale", 7)}${w("zone", 14)}${w("size/wt", 11)}${w("text", 18)}${w("worst bg px", 18)}${w("ratio", 9)}${w("need", 6)}`,
  );
  console.log("-".repeat(95));
  for (const r of results) {
    if (!r.found) {
      console.log(`${w(r.background, 12)}${w(r.typeScale, 7)}${w(r.key, 14)}NOT RENDERED`);
      continue;
    }
    const ok = r.worst === null || r.worst >= r.required;
    console.log(
      `${w(r.background, 12)}${w(r.typeScale, 7)}${w(r.key, 14)}${w(`${r.fontSize}/${r.fontWeight}`, 11)}${w(r.textColor, 18)}${w(r.worstBackingPixel ?? "-", 18)}${w(r.worst ?? "-", 9)}${w(r.required, 6)}${ok ? "" : "  <-- FAIL"}`,
    );
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    `\n${results.length} measurements, ${failures} below threshold. JSON: ${OUT}/results.json`,
  );
  if (WRITE_SHOTS) console.log(`Screenshots: ${OUT}/`);
  process.exit(failures ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
