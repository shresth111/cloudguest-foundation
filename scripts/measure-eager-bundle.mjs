/**
 * What does the browser have to download before the app can paint?
 *
 * WHY THIS EXISTS
 * ---------------
 * demo.wyfyguest.com fetched 37 asset chunks before the sign-in form
 * appeared -- roughly 1.7 MB, of which `vendor-2-charts` alone is 408 kB, a
 * charting library downloaded so that someone can type a password. Fixing
 * that needs a way to tell, locally, whether a change actually moved a chunk
 * out of the eager graph.
 *
 * Every cheaper proxy for that question is wrong, and each one cost a wasted
 * change before this script existed:
 *
 *   - Entry chunk *size* is insensitive: deferring a component moves it to
 *     its own chunk without shrinking the entry, so a real improvement and a
 *     no-op look identical.
 *   - Grepping the entry for a chunk *name* is worse than useless: Vite
 *     emits a `__vite__mapDeps` array at the top of the entry listing every
 *     chunk reachable by *dynamic* import, so a successfully-deferred chunk
 *     still appears by name. That is why three separate "is it out?" checks
 *     came back "still there" regardless of the answer.
 *   - Running the built app locally is not currently possible: `vite
 *     preview` looks for `dist/server/server.js` while the build writes
 *     `.output/`, and the nitro output is a Cloudflare worker, so it needs
 *     wrangler rather than node.
 *
 * WHAT IT DOES
 * ------------
 * Walks the *static* import graph from the entry chunk, which is exactly the
 * set the browser must have before it can run anything. Static and dynamic
 * imports are distinguished syntactically:
 *
 *     import { x } from "./chunk-HASH.js"   <- static, followed
 *     import "./chunk-HASH.js"              <- static side effect, followed
 *     import("./chunk-HASH.js")             <- dynamic, NOT followed
 *
 * and the `__vite__mapDeps` prelude is stripped first so its listing of
 * dynamic chunks cannot be mistaken for imports.
 *
 * Run: node scripts/measure-eager-bundle.mjs
 *      node scripts/measure-eager-bundle.mjs --json    (for diffing runs)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ASSETS = resolve(import.meta.dirname, "..", ".output", "public", "assets");

let files;
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`No build found at ${ASSETS}\nRun \`npx vite build\` first.`);
  process.exit(1);
}

const entry = files.find((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
if (!entry) {
  console.error("Could not find the entry chunk (assets/index-*.js).");
  process.exit(1);
}

/** Vite writes `const __vite__mapDeps=(i,m=...,d=(m.f||(m.f=[ ...paths... ])))`
 *  at the top of a chunk that has dynamic imports. Those paths are the
 *  *dynamic* dependency listing -- the exact thing that must not be counted
 *  as an eager import. Remove the array before parsing anything else. */
function stripMapDeps(source) {
  const start = source.indexOf("__vite__mapDeps");
  if (start === -1) return source;
  const open = source.indexOf("[", start);
  const close = source.indexOf("]", open);
  if (open === -1 || close === -1) return source;
  return source.slice(0, open) + source.slice(close + 1);
}

/** Static import specifiers only. `import(` is deliberately not matched. */
function staticImports(source) {
  const code = stripMapDeps(source);
  const found = new Set();
  // `from "./x.js"` / `from'./x.js'` -- the named/default/namespace forms.
  for (const m of code.matchAll(/\bfrom\s*["']\.\/([A-Za-z0-9_.$-]+\.js)["']/g)) {
    found.add(m[1]);
  }
  // Bare side-effect import: `import "./x.js"`. Guard against `import(`.
  for (const m of code.matchAll(/\bimport\s*["']\.\/([A-Za-z0-9_.$-]+\.js)["']/g)) {
    found.add(m[1]);
  }
  return found;
}

const eager = new Set([entry]);
const queue = [entry];
while (queue.length) {
  const current = queue.pop();
  let source;
  try {
    source = readFileSync(join(ASSETS, current), "utf8");
  } catch {
    continue;
  }
  for (const dep of staticImports(source)) {
    if (!eager.has(dep) && files.includes(dep)) {
      eager.add(dep);
      queue.push(dep);
    }
  }
}

const rows = [...eager]
  .map((f) => ({ name: f, bytes: statSync(join(ASSETS, f)).size }))
  .sort((a, b) => b.bytes - a.bytes);
const total = rows.reduce((sum, r) => sum + r.bytes, 0);

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      { entry, chunks: rows.length, totalBytes: total, files: rows.map((r) => r.name).sort() },
      null,
      2,
    ),
  );
} else {
  const label = (n) => n.replace(/-[A-Za-z0-9_-]{8,}\.js$/, "");
  console.log(`Eager (static) graph from ${entry}\n`);
  for (const r of rows) {
    console.log(`  ${String(Math.round(r.bytes / 1024)).padStart(6)}k  ${label(r.name)}`);
  }
  console.log(
    `\n  ${rows.length} chunks, ${(total / 1024 / 1024).toFixed(2)} MB raw\n` +
      `\nThis is what a visitor downloads before anything renders.\n` +
      `Anything here that a signed-out visitor does not need is the target.`,
  );
}
