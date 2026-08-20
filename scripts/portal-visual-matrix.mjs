#!/usr/bin/env node
/**
 * Screenshot matrix for the guest portal's welcome surface.
 *
 * Run:  node scripts/portal-visual-matrix.mjs --out=/tmp/portal-shots
 *       (needs `npx vite dev --port 4320` running, same as
 *        scripts/measure-portal-contrast.mjs)
 *
 * The contrast harness answers "is this legible"; this answers "does this
 * hold together", which is a different question and the one that is easy to
 * skip. Every case below is here because it is a real venue's real state,
 * not because it rounds out a grid:
 *
 *   - 320px wide, because that is still the narrowest viewport in use and
 *     the sign-in column is a fixed 420px max with 16px gutters.
 *   - --pg-type-scale 1.25, the accessibility control Part 7 shipped. Text
 *     that clips or overlaps here is a 1.4.4 failure, not a cosmetic one.
 *   - A long Devanagari venue name, which is not merely "a long string":
 *     Devanagari hangs from the shirorekha with matras stacking above AND
 *     below, so its vertical envelope exceeds Latin at the same font-size.
 *   - A long Tamil venue name, which the current font stack does not name a
 *     face for at all (it names only "Noto Sans Devanagari"), so this shot
 *     records what a Tamil venue actually gets today.
 *   - RTL (Arabic), where the footer's separator dots and the plate's
 *     padding have to survive direction reversal.
 *   - No welcome message, one line, and four lines -- the last being the
 *     case that pushes the primary CTA below the fold (§2 W2).
 *   - prefers-reduced-motion and prefers-contrast: more, the two OS
 *     preferences this surface answers.
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const BASE = arg("base", "http://localhost:4320");
const OUT = arg("out", "/tmp/portal-shots");

const PHOTO = (body, w = 24, h = 24) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`,
  );

const PHOTOS = {
  bright: PHOTO(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE3EA"/></linearGradient></defs><rect width="24" height="24" fill="url(#g)"/>`,
  ),
  dark: PHOTO(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B0F14"/><stop offset="1" stop-color="#1C2430"/></linearGradient></defs><rect width="24" height="24" fill="url(#g)"/>`,
  ),
  busy: PHOTO(
    `<rect width="24" height="24" fill="#8A6E52"/><g stroke="#F5EFE6" stroke-width="1"><path d="M0 3h24M0 9h24M0 15h24M0 21h24"/></g><g fill="#2B1D12"><rect x="2" y="4" width="4" height="4"/><rect x="12" y="10" width="5" height="5"/></g><circle cx="20" cy="5" r="3" fill="#FFFFFF"/>`,
  ),
  none: null,
};

const LONG_HI = "होटल श्री महाराजा पैलेस एवं सम्मेलन केंद्र";
const LONG_TA = "ஸ்ரீ மகாராஜா அரண்மனை மற்றும் மாநாட்டு மையம்";
const LONG_EN_MSG =
  "Welcome to our home away from home. Complimentary high-speed WiFi is included with your stay, and our front desk team is available around the clock should you need anything at all during your visit.";

const CASES = [
  { id: "01-baseline-390-photo", photo: "busy" },
  { id: "02-baseline-390-none", photo: "none" },
  { id: "03-bright-photo", photo: "bright" },
  { id: "04-dark-photo", photo: "dark" },
  { id: "05-320-wide", photo: "busy", width: 320 },
  { id: "06-typescale-125", photo: "busy", scale: "1.25" },
  { id: "07-320-typescale-125", photo: "busy", width: 320, scale: "1.25" },
  { id: "08-hindi-long-name", photo: "busy", lang: "hi", name: LONG_HI },
  {
    id: "09-hindi-320-scale125",
    photo: "busy",
    lang: "hi",
    name: LONG_HI,
    width: 320,
    scale: "1.25",
  },
  { id: "10-tamil-long-name", photo: "busy", name: LONG_TA },
  { id: "11-rtl-arabic", photo: "busy", lang: "ar" },
  { id: "12-no-welcome-message", photo: "busy", message: null },
  { id: "13-long-welcome-message", photo: "busy", message: LONG_EN_MSG },
  { id: "14-prefers-contrast-more", photo: "busy", contrast: "more" },
  { id: "15-reduced-motion", photo: "busy", motion: "reduce" },
  { id: "16-venue-logo", photo: "busy", logo: true },
];

const VENUE_LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48"><rect width="120" height="48" fill="#0F3D2E"/><text x="60" y="30" font-size="16" font-family="Georgia" fill="#E8D8A8" text-anchor="middle">ASHOKA</text></svg>`,
  );

const config = (c) => ({
  id: "shot",
  name: c.name ?? "The Grand Ashoka Residency",
  theme: "light",
  logo_url: c.logo ? VENUE_LOGO : null,
  background_image_url: PHOTOS[c.photo] ?? null,
  primary_color: "#6366f1",
  secondary_color: "#1E293B",
  default_language: c.lang ?? "en",
  supported_languages: ["en", "hi", "ar"],
  advertisement_banner_url: null,
  advertisement_banner_link: null,
  terms_and_conditions_text: "Fair use applies.",
  terms_and_conditions_url: null,
  privacy_policy_text: null,
  privacy_policy_url: null,
  splash_headline: null,
  splash_welcome_message:
    c.message === null
      ? null
      : (c.message ?? "Complimentary high-speed WiFi for our guests. Ask reception for help."),
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
});

const URL_ =
  "/portal/welcome?organizationId=11111111-1111-4111-8111-111111111111" +
  "&locationId=22222222-2222-4222-8222-222222222222" +
  "&routerId=33333333-3333-4333-8333-333333333333";

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

for (const c of CASES) {
  const ctx = await browser.newContext({
    viewport: { width: c.width ?? 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: c.motion === "reduce" ? "reduce" : "no-preference",
    contrast: c.contrast === "more" ? "more" : "no-preference",
    locale: c.lang === "ar" ? "ar" : c.lang === "hi" ? "hi-IN" : "en-IN",
  });
  const page = await ctx.newPage();
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "null" }),
  );
  await page.route("**/captive-portal/resolve*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(config(c)),
    }),
  );
  await page.goto(BASE + URL_, { waitUntil: "networkidle" });
  await page.waitForSelector("main h1", { timeout: 20000 });
  if (c.scale) {
    await page.evaluate(
      (s) => document.querySelector(".portal-runtime")?.style.setProperty("--pg-type-scale", s),
      c.scale,
    );
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${c.id}.png` });
  console.log(`${c.id}  ${c.width ?? 390}x844  scale=${c.scale ?? "1"}`);
  await ctx.close();
}

await browser.close();
console.log(`\n${CASES.length} shots in ${OUT}`);
