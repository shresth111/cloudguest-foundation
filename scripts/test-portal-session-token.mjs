/**
 * Regression check for the guest `session_token` registry (backend QA
 * 2026-11-06, H1): a token a login returned must be found again by its
 * `sessionId` -- across a reload when Web Storage works, and in memory when
 * it throws (Apple's Captive Network Assistant) -- and nothing may throw.
 *
 * Same shape as the other scripts here: this repo has no test runner, so
 * the real `src/lib/portal-session-token.ts` is bundled with esbuild and
 * driven with a fake `window`.
 *
 * Run: node scripts/test-portal-session-token.mjs
 */
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "session-token-test-"));

async function load(tag) {
  const outfile = join(work, `bundle-${tag}.mjs`);
  await build({
    entryPoints: [join(ROOT, "src/lib/portal-session-token.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile,
    logLevel: "silent",
  });
  return import(`${outfile}?${tag}`);
}

function workingStorage(store = new Map()) {
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("SecurityError: storage disabled (CNA)");
  },
  setItem() {
    throw new Error("SecurityError: storage disabled (CNA)");
  },
};

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${e.message}`);
  }
}

await check("remembers a token by sessionId", async () => {
  globalThis.window = { sessionStorage: workingStorage() };
  const m = await load("a");
  m.rememberSessionToken("s1", "tok1");
  assert.equal(m.sessionTokenFor("s1"), "tok1");
  assert.equal(m.sessionTokenFor("s2"), undefined);
});

await check("survives a reload through sessionStorage", async () => {
  const store = new Map();
  globalThis.window = { sessionStorage: workingStorage(store) };
  (await load("b1")).rememberSessionToken("s1", "tok1");
  // A fresh module instance = a fresh page after the hotspot hand-off.
  const reloaded = await load("b2");
  assert.equal(reloaded.sessionTokenFor("s1"), "tok1");
});

await check("never throws when storage throws (CNA), memory still works", async () => {
  globalThis.window = { sessionStorage: throwingStorage };
  const m = await load("c");
  m.rememberSessionToken("s1", "tok1");
  assert.equal(m.sessionTokenFor("s1"), "tok1");
  assert.equal(m.sessionTokenFor("other"), undefined);
});

await check("a null token (session/active) records nothing", async () => {
  globalThis.window = { sessionStorage: workingStorage() };
  const m = await load("d");
  m.rememberSessionToken("s1", null);
  assert.equal(m.sessionTokenFor("s1"), undefined);
});

await check("keeps only the last five sessions", async () => {
  const store = new Map();
  globalThis.window = { sessionStorage: workingStorage(store) };
  const m = await load("e");
  for (let i = 0; i < 7; i += 1) m.rememberSessionToken(`s${i}`, `t${i}`);
  const stored = JSON.parse(store.get("wyfy:guest-session-tokens"));
  assert.equal(stored.length, 5);
  assert.deepEqual(stored[0], ["s2", "t2"]);
});

await check("every mutating portal call attaches the token", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(ROOT, "src/services/portal-runtime.service.ts"), "utf8");
  for (const path of [
    "/guest/set-password",
    "/guest/session/disconnect",
    "/guest/profile",
    "/guest/sign-in-name",
    "/guest/marketing-consent",
    "/guest/review-link-opened",
    "/guest/review-prompt-shown",
  ]) {
    const at = src.indexOf(`"${path}"`);
    assert.ok(at > 0, `${path} call not found`);
    const body = src.slice(at, src.indexOf("});", at));
    assert.ok(body.includes("session_token: sessionTokenFor("), `${path} sends no token`);
  }
  assert.ok(src.includes("rememberSessionToken(s.id, data.session_token)"));
});

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
