/**
 * Partner console forgot / reset password (founder ask 2026-10-23).
 * src/lib/isp-partner/password-reset.ts + the pages and routes around it.
 * Run: node scripts/test-isp-partner-password-reset.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-pwreset-"));
const entry = join(dir, "e.ts");
writeFileSync(entry, `export * from "${join(ROOT, "src/lib/isp-partner/password-reset.ts")}";`);
const outfile = join(dir, "b.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: "api", namespace: "stub" }));
        b.onResolve({ filter: /^axios$/ }, () => ({ path: "axios", namespace: "stubaxios" }));
        b.onLoad({ filter: /.*/, namespace: "stubaxios" }, () => ({
          contents:
            "const isAxiosError = (e) => Boolean(e && e.isAxiosError); export default { isAxiosError, post: async (url, body) => { (globalThis.__bare ??= []).push([url, body]); if (globalThis.__bareFail) { const e = new Error('x'); e.isAxiosError = true; e.response = { status: globalThis.__bareFail }; throw e; } return { data: {} }; } };",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents:
            'export const toAppError = (e) => ({ status: e.response?.status }); export const api = { defaults: { baseURL: "/api/v1" }, post: async (url, body) => { (globalThis.__calls ??= []).push([url, body]); return { data: {} }; } };',
        }));
      },
    },
  ],
});
const m = await import(outfile);
let failures = 0;
let checks = 0;
const check = (name, ok, extra = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? ` -- ${extra}` : ""}`);
};
const src = (p) => readFileSync(join(ROOT, p), "utf8");

for (const p of ["/partner/login", "/partner/forgot-password", "/partner/reset-password"]) {
  check(`${p} is public`, m.isPartnerPublicPath(p) && m.isPartnerPublicPath(`${p}/`));
}
for (const p of ["/partner", "/partner/", "/partner/users", "/partner/login-x", "/login"]) {
  check(`${p} is not public`, !m.isPartnerPublicPath(p));
}

await m.requestPartnerPasswordReset("  owner@isp.example.com ");
const [url, body] = globalThis.__calls?.[0] ?? [];
check("request goes to the ISP wrapper", url === "/isp/auth/forgot-password", String(url));
check("request trims the email", body?.email === "owner@isp.example.com", JSON.stringify(body));

await m.resetPartnerPassword("tok-1", "Pw-123456789aA!");
const [rurl, rbody] = globalThis.__bare?.[0] ?? [];
check(
  "reset posts to /api/v1/auth/reset-password",
  rurl === "/api/v1/auth/reset-password",
  String(rurl),
);
check(
  "reset body is {token, new_password}",
  rbody?.token === "tok-1" && rbody?.new_password === "Pw-123456789aA!",
);
check(
  "reset never goes through the shared api instance",
  !(globalThis.__calls ?? []).some(([u]) => u.includes("reset-password")),
);
globalThis.__bareFail = 401;
let thrown = null;
try {
  await m.resetPartnerPassword("spent", "Pw-123456789aA!");
} catch (e) {
  thrown = e;
}
check(
  "a spent link surfaces as status 401 to the page",
  thrown?.status === 401,
  JSON.stringify(thrown),
);

const layout = src("src/components/isp-partner/PartnerLayout.tsx");
const route = src("src/routes/partner.tsx");
check(
  "layout decides 'public page' from the rendered leaf match, not the location",
  /isLogin = isPartnerPublicPath\(leafRouteId\)/.test(layout) &&
    /s\.matches\[s\.matches\.length - 1\]\?\.routeId/.test(layout),
);
check(
  "layout latches the not-ISP screen across logout",
  /setEnded\(\{ suspended, platform: platformAccount \}\)/.test(layout) &&
    /if \(ended \|\| notPartner \|\| suspended\)/.test(layout),
);
check(
  "route guard lets public pages through",
  /isLogin = isPartnerPublicPath\(location\.pathname\)/.test(route),
);
const reset = src("src/routes/partner.reset-password.tsx");
check("reset route reads ?token=", /search\.token/.test(reset));
check("reset route sends no Referer (token in URL)", /no-referrer/.test(reset));
const resetPage = src("src/components/isp-partner/auth/PartnerResetPasswordPage.tsx");
check(
  "reset page uses resetPartnerPassword (bare client), not authService",
  /resetPartnerPassword\(/.test(resetPage) && !/authService/.test(resetPage),
);
check(
  "reset lands on /partner/login?reset=done",
  /to: "\/partner\/login", search: \{ reset: RESET_DONE \}/.test(resetPage),
);
const forgot = src("src/components/isp-partner/auth/PartnerForgotPasswordPage.tsx");
check("forgot page keeps the ask-your-admin path", /AskYourAdmin/.test(forgot));
check(
  "forgot reply is account-agnostic",
  /If <span[^>]*>\{sentTo\}<\/span> belongs to an ISP Partner/.test(forgot.replace(/\s+/g, " ")),
);
const login = src("src/components/isp-partner/PartnerLoginPage.tsx");
check("login links to forgot password", /to="\/partner\/forgot-password"/.test(login));
check("login keeps the ask-your-admin path", /<AskYourAdmin/.test(login));
check("login shows the reset success note", /justReset &&/.test(login));
check("login is branded ISP Partner", /ISP Partner Console/.test(login));
for (const [name, text] of [
  ["login", login],
  ["forgot", forgot],
  ["reset", resetPage],
  ["frame", src("src/components/isp-partner/auth/PartnerAuthFrame.tsx")],
]) {
  check(
    `${name} page does not advertise the Master console`,
    !/Master console|master-login|masterLoginUrl/i.test(text),
  );
}
const tree = src("src/routeTree.gen.ts");
check(
  "route tree has both new routes",
  tree.includes("'/partner/forgot-password'") && tree.includes("'/partner/reset-password'"),
);

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
