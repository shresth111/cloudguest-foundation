/**
 * Render-level regression test for the venue logo on the guest sign-in card.
 *
 * Run: `npm run test:portal-venue-logo`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * Venue owners reported their logo "looks tiny" on a guest's phone. It was:
 * the sign-in card's `framed` plate was a fixed 48px square with 8px of
 * padding, so EVERY upload painted inside 30x30 CSS px at 390px -- a 4:1
 * wordmark came out 30x7px. The file was never the problem (the backend
 * stores uploads at full resolution); the box was.
 *
 * `VenueLogo adaptive` now sizes the logo by its own shape and caps it at
 * what the file's pixels support. Every one of those properties is a
 * runtime layout result that tsc and eslint cannot see, so this drives the
 * real component (bundled with esbuild) and the real Tailwind classes
 * (compiled with the repo's own `tailwindcss`) in a real Chromium at a
 * 390x844 DPR-3 phone viewport, and pins:
 *
 *   - a floor on the painted box for each logo shape (wide wordmark, square,
 *     tall crest, SVG, dark-on-transparent),
 *   - that nothing exceeds the reserved band or 70% of the zone,
 *   - that aspect ratio is preserved (no crop, no stretch),
 *   - that a tiny 96px PNG is NEVER drawn wider than its sharpness cap
 *     (96 * 1.5 / DPR), while an SVG is not capped at all,
 *   - that the band is reserved before the image arrives (no layout shift)
 *     and the image is hidden until measured (no flash of a 1200px image),
 *   - that a broken logo URL falls back to PortalDefaultBrandBadge,
 *   - that the zone width, not the viewport, picks the size (the owner's
 *     Portal designer renders this inside a phone frame on a desktop).
 *
 * The zone width (324px at a 390px viewport) is the width measured on the
 * real /portal/welcome sign-in card.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "venue-logo-test-"));
const LOGO_SRC = join(ROOT, "src/components/portal-runtime/VenueLogo.tsx");
const CARD_SRC = join(ROOT, "src/components/portal-runtime/GuestSignInCard.tsx");

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}  (${detail})`);
  }
};

// --- bundle the real component ---------------------------------------------
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { VenueLogo } from "@/components/portal-runtime/VenueLogo";
   import { venueLogoWidthCap } from "@/lib/venue-logo";
   window.venueLogoWidthCap = venueLogoWidthCap;
   window.mountLogo = (zoneWidth, url) => {
     const host = document.createElement("div");
     host.className = "zone";
     host.style.width = zoneWidth + "px";
     document.body.appendChild(host);
     createRoot(host).render(<VenueLogo logoUrl={url} alt="Test Venue" size="sm" adaptive />);
     return host;
   };`,
);
await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "portal-aliases",
      setup(b) {
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

// --- compile the real Tailwind classes ---------------------------------------
// The repo's own `tailwindcss` (a declared dependency), fed the candidate
// tokens of the two files under test. Invalid tokens are simply ignored by
// Tailwind, so a plain split is a faithful (if generous) scanner.
const tw = await import(pathToFileURL(join(ROOT, "node_modules/tailwindcss/dist/lib.mjs")).href);
const compiler = await tw.compile(`@import "tailwindcss";`, {
  base: ROOT,
  loadStylesheet: async (id, base) => {
    const file = id === "tailwindcss" ? "index.css" : id.replace(/^\.\//, "");
    const path = join(ROOT, "node_modules/tailwindcss", file);
    return { path, base, content: readFileSync(path, "utf8") };
  },
});
const candidates = new Set();
for (const f of [
  LOGO_SRC,
  join(ROOT, "src/components/portal-runtime/PortalDefaultBrandBadge.tsx"),
]) {
  for (const tok of readFileSync(f, "utf8").split(/[\s"'`]+/)) if (tok) candidates.add(tok);
}
writeFileSync(join(work, "tw.css"), compiler.build([...candidates]));

writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8><title>venue logo harness</title>
   <link rel=stylesheet href="./tw.css">
   <style>body{margin:0;padding:24px 33px} .zone{margin-bottom:16px;display:flex;justify-content:center}</style>
   <script type=module src="./bundle.js"></script>`,
);

// --- serve it, with a slow route for the layout-shift check ------------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const pending = [];
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (name === "/slow.png") {
    pending.push(res);
    return;
  }
  if (name === "/missing.png") return void res.writeHead(404).end();
  try {
    const body = readFileSync(join(work, name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "image/png" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- drive a real browser ----------------------------------------------------
const { chromium } = await import("playwright");
const browser = await chromium.launch();

async function openPage(dpr) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: dpr,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.mountLogo === "function");
  return { ctx, page };
}

// Test logos are drawn in the page itself: no fixtures, no binary files.
const drawPng = (page, w, h, dark = false) =>
  page.evaluate(
    ([w, h, dark]) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = dark ? "#0b1020" : "#0f766e";
      g.fillRect(0, 0, w, h); // full-bleed, so painted box == logo box
      return c.toDataURL("image/png");
    },
    [w, h, dark],
  );
const SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><rect width="240" height="80" fill="#6d28d9"/></svg>`,
  );

async function measure(page, zoneWidth, url) {
  return page.evaluate(
    async ([zoneWidth, url]) => {
      const host = window.mountLogo(zoneWidth, url);
      const t0 = performance.now();
      for (;;) {
        const img = host.querySelector("img");
        const r = img?.getBoundingClientRect();
        if (img && img.complete && r.width > 2) {
          const band = host.querySelector("[data-venue-logo-box]").getBoundingClientRect();
          return {
            w: r.width,
            h: r.height,
            nw: img.naturalWidth,
            nh: img.naturalHeight,
            bandH: band.height,
            fit: getComputedStyle(img).objectFit,
            alt: img.alt,
          };
        }
        if (performance.now() - t0 > 5000) return null;
        await new Promise((r) => setTimeout(r, 30));
      }
    },
    [zoneWidth, url],
  );
}

const ZONE_390 = 324; // measured on the real /portal/welcome card at 390px
const BAND_PHONE = 96;

console.log("\nPhone, 390x844 @ DPR 3 (zone 324px):");
{
  const { ctx, page } = await openPage(3);
  const shapes = [
    { id: "wide-1200x300", url: await drawPng(page, 1200, 300), minW: 200, minH: 48 },
    { id: "square-512", url: await drawPng(page, 512, 512), minW: 84, minH: 84 },
    { id: "tall-300x600", url: await drawPng(page, 300, 600), minW: 44, minH: 90 },
    { id: "svg-3to1", url: SVG, minW: 170, minH: 56 },
    { id: "dark-900x300", url: await drawPng(page, 900, 300, true), minW: 170, minH: 56 },
  ];
  for (const s of shapes) {
    const m = await measure(page, ZONE_390, s.url);
    if (!m) {
      check(`${s.id}-renders`, false, "image never laid out");
      continue;
    }
    const box = `${m.w.toFixed(1)}x${m.h.toFixed(1)}`;
    check(`${s.id}-at-least-${s.minW}x${s.minH}`, m.w >= s.minW && m.h >= s.minH, `got ${box}`);
    check(
      `${s.id}-within-band-and-70pct`,
      m.h <= BAND_PHONE + 0.5 && m.w <= ZONE_390 * 0.7 + 0.5,
      `got ${box}, band ${BAND_PHONE}, max w ${ZONE_390 * 0.7}`,
    );
    check(
      `${s.id}-keeps-aspect-ratio`,
      Math.abs(m.w / m.h / (m.nw / m.nh) - 1) < 0.02,
      `box ${box} vs natural ${m.nw}x${m.nh}`,
    );
  }

  // Shape actually drives the size: wide gets width, tall gets height.
  const wide = await measure(page, ZONE_390, shapes[0].url);
  const tall = await measure(page, ZONE_390, shapes[2].url);
  check("wide-gets-more-width-than-tall", wide.w > tall.w * 3, `${wide.w} vs ${tall.w}`);
  check("tall-gets-more-height-than-wide", tall.h > wide.h * 1.5, `${tall.h} vs ${wide.h}`);

  const tiny = await measure(page, ZONE_390, await drawPng(page, 96, 96));
  const cap = (96 * 1.5) / 3;
  check("tiny-96px-never-exceeds-sharpness-cap", tiny.w <= cap + 0.5, `got ${tiny.w}, cap ${cap}`);
  check("tiny-96px-not-postage-stamp", tiny.w >= 40, `got ${tiny.w}`);

  const svg = await measure(page, ZONE_390, SVG);
  check(
    "svg-is-not-resolution-capped",
    svg.w > (240 * 1.5) / 3 + 1,
    `svg drawn at ${svg.w}; a PNG of the same natural width would cap at ${(240 * 1.5) / 3}`,
  );

  check("object-contain", wide.fit === "contain", `got ${wide.fit}`);
  check("alt-is-the-venue-name", wide.alt === "Test Venue", `got "${wide.alt}"`);

  // Layout shift: the band is reserved before the image arrives, the image
  // is invisible until measured, and the band does not move afterwards.
  const before = await page.evaluate(() => {
    const host = window.mountLogo(324, "/slow.png");
    return new Promise((r) =>
      setTimeout(() => {
        const band = host.querySelector("[data-venue-logo-box]").getBoundingClientRect();
        const img = host.querySelector("img");
        const s = getComputedStyle(img);
        r({
          bandH: band.height,
          visibility: s.visibility,
          imgW: img.getBoundingClientRect().width,
        });
      }, 100),
    );
  });
  check("band-reserved-before-load", before.bandH === BAND_PHONE, `band ${before.bandH}`);
  check(
    "no-flash-before-measure",
    before.visibility === "hidden" && before.imgW <= 1,
    `visibility ${before.visibility}, width ${before.imgW}`,
  );
  check("band-unchanged-after-load", wide.bandH === BAND_PHONE, `band ${wide.bandH}`);
  for (const res of pending.splice(0)) res.writeHead(404).end();

  // A broken upload degrades exactly like no upload.
  const broken = await page.evaluate(async () => {
    const host = window.mountLogo(324, "/missing.png");
    for (let i = 0; i < 100; i++) {
      if (host.querySelector("svg")) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    return { svg: !!host.querySelector("svg"), img: !!host.querySelector("img") };
  });
  check("broken-url-falls-back-to-brand-badge", broken.svg && !broken.img, JSON.stringify(broken));
  await ctx.close();
}

console.log("\nCap follows device pixel ratio:");
{
  const { ctx, page } = await openPage(2);
  const tiny = await measure(page, ZONE_390, await drawPng(page, 96, 96));
  check("tiny-at-dpr2-capped-at-72", Math.abs(tiny.w - 72) < 0.6, `got ${tiny.w}`);
  await ctx.close();
}
{
  const { ctx, page } = await openPage(3);
  const caps = await page.evaluate(() => [
    window.venueLogoWidthCap(96, 3, false),
    window.venueLogoWidthCap(48, 3, false),
    window.venueLogoWidthCap(30, 3, false),
    window.venueLogoWidthCap(1200, 3, false),
    window.venueLogoWidthCap(300, 3, true),
  ]);
  check("cap-96@3x-is-48", caps[0] === 48, `got ${caps[0]}`);
  check("cap-floor-40-for-48px-file", caps[1] === 40, `got ${caps[1]}`);
  check("cap-never-above-css-natural-under-floor", caps[2] === 30, `got ${caps[2]}`);
  check("cap-1200@3x-is-600", caps[3] === 600, `got ${caps[3]}`);
  check("cap-vector-is-null", caps[4] === null, `got ${caps[4]}`);
  await ctx.close();
}

console.log("\nZone width, not viewport, picks the size:");
{
  const { ctx, page } = await openPage(3);
  const sq = await drawPng(page, 512, 512);
  const narrow = await measure(page, ZONE_390, sq);
  const wideZone = await measure(page, 406, sq); // the 440px desktop card
  check("phone-zone-square-is-88", Math.abs(narrow.w - 88) < 0.6, `got ${narrow.w}`);
  check(
    "wide-zone-square-is-100-band-112",
    Math.abs(wideZone.w - 100) < 0.6 && wideZone.bandH === 112,
    `got ${wideZone.w}, band ${wideZone.bandH}`,
  );
  await ctx.close();
}

console.log("\nThe sign-in card actually uses it:");
const card = readFileSync(CARD_SRC, "utf8");
check(
  "guest-sign-in-card-uses-adaptive-logo",
  /<VenueLogo[^>]*\badaptive\b/.test(card) && /<VenueLogo[^>]*alt=\{config\.name\}/.test(card),
  "GuestSignInCard must render <VenueLogo ... alt={config.name} ... adaptive />",
);
check("no-framed-plate-left", !/<VenueLogo[^>]*\bframed\b/.test(card), "framed plate is back");

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("\nall venue logo checks passed");
