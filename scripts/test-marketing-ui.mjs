/**
 * Guards for the Marketing add-on UI (wyfy-specs/guest-marketing-campaigns.md).
 *
 * 1. THE SMS COUNTER IS RIGHT. `src/lib/marketing-template.ts` mirrors the
 *    server's §5.4 rules (GSM-7 160/153, UCS-2 70/67, extension characters
 *    cost two, worst-case ≤ 3 parts, `{{unsubscribe_link}}` required). An
 *    owner decides whether to shorten a message from this number, so it is
 *    executed here, not eyeballed.
 * 2. NO FIXTURES, NO FAKE SUCCESS. This product has shipped a mocked screen
 *    to production twice. Every marketing source file is scanned for
 *    fixture/demo arrays, the hooks for optimistic updates, and every
 *    `toast.success` for an `await` (or an `onSuccess`) before it -- a
 *    success message that can fire before the server answered is the
 *    defect this guard exists for.
 * 3. THE GATE COMES FROM THE BACKEND. The sidebar badge reads
 *    `/me/entitlements`, not the login-role radio; the page treats a 402
 *    `feature_not_entitled` as the upsell, not as an error.
 * 4. EVERY CONTRACT ENDPOINT HAS A CLIENT CALL, and the dashboard's
 *    marketing strings exist in every shipped dashboard locale.
 *
 * Same shape as the repo's other guards (no test runner): the real module is
 * bundled with esbuild and executed; wiring is checked against sources.
 *
 * Run: node scripts/test-marketing-ui.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// ---------------------------------------------------------------------------
// 1. SMS counter
// ---------------------------------------------------------------------------
console.log("\nthe SMS counter matches the contract's rules");

const outdir = mkdtempSync(join(tmpdir(), "marketing-ui-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/lib/marketing-template.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const T = await import(`file://${outfile}`);

const m160 = T.measureSms("a".repeat(160));
check("160 GSM-7 characters are one part", m160.encoding === "gsm7" && m160.segments === 1);
check("161 GSM-7 characters are two parts", T.measureSms("a".repeat(161)).segments === 2);
check(
  "306 GSM-7 characters are two parts (153 each)",
  T.measureSms("a".repeat(306)).segments === 2,
);
check("307 GSM-7 characters are three parts", T.measureSms("a".repeat(307)).segments === 3);
check(
  "an extension character (€) costs two units",
  T.measureSms("€").units === 2 && T.measureSms("€").encoding === "gsm7",
);
const rupee = T.measureSms("₹".repeat(70));
check("₹ switches to UCS-2, 70 per part", rupee.encoding === "ucs2" && rupee.segments === 1);
check("71 UCS-2 characters are two parts", T.measureSms("₹".repeat(71)).segments === 2);
check("Hindi is UCS-2", T.measureSms("नमस्ते").encoding === "ucs2");
check("an empty body is zero parts", T.measureSms("").segments === 0);

// Spec §6: the system templates render in one part typically and two at worst.
const weekend =
  "Weekend plans, {{guest_name}}? Use {{offer_code}} at {{venue_name}} this weekend. Valid till {{offer_expiry}}. Opt out: {{unsubscribe_link}}";
check("T3 'Weekend offer' worst case is within 3 parts", T.worstCaseSms(weekend).segments <= 3);
check(
  "T3 has no client-side issues",
  T.smsBodyIssues(weekend).length === 0,
  T.smsBodyIssues(weekend).join(","),
);

const scan = T.scanVariables("Hi {{guest_name}} {{bogus}} {{ guest_name }} {{guest_name}}");
check("known variables are found once", scan.used.join(",") === "guest_name");
check(
  "unknown and spaced variables are reported",
  scan.unknown.includes("bogus") && scan.unknown.includes(" guest_name "),
);
check("a stray brace is malformed", T.scanVariables("Hi {{guest_name").malformed === true);
check(
  "an SMS without the unsubscribe link is refused",
  T.smsBodyIssues("Hi {{guest_name}}").includes("unsubscribe_link_missing"),
);
check(
  "an email without the unsubscribe link is refused",
  T.emailBodyIssues("Hello", "<p>Hi</p>").includes("unsubscribe_link_missing"),
);
check(
  "DLT ids are 12-30 digits",
  T.isValidDltTemplateId("110716") === false &&
    T.isValidDltTemplateId("1107161234567890123") === true,
);
check(
  "booking_link allows 200, other values 30",
  T.campaignVariableMaxLength("booking_link") === 200 &&
    T.campaignVariableMaxLength("offer_code") === 30,
);

// ---------------------------------------------------------------------------
// 1b. Org-scoped vs location-scoped (founder decision: org-wide campaigns)
// ---------------------------------------------------------------------------
console.log("\norg-scoped callers send no X-Location-Id, location-scoped always do");

async function bundle(name, contents, plugins = [], extra = {}) {
  const e = join(outdir, `${name}-entry.mjs`);
  writeFileSync(e, contents);
  const o = join(outdir, `${name}.mjs`);
  await build({
    entryPoints: [e],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: o,
    logLevel: "silent",
    jsx: "automatic",
    nodePaths: [join(ROOT, "node_modules")],
    // react-dom/server's CJS build requires Node builtins (util, stream).
    banner: {
      js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
    },
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": join(ROOT, "src") },
    plugins,
    ...extra,
  });
  return import(`file://${o}`);
}
const src = (rel) => join(ROOT, rel).replace(/\\/g, "/");

const S = await bundle("scope", `export * from "${src("src/lib/marketing-scope.ts")}";`);
const ORG = "org-1";
const LOC = "loc-1";
const cases = [
  ["organization owner", [{ scopeType: "organization", organizationId: ORG }], null],
  [
    "org admin with a location grant too",
    [
      { scopeType: "location", organizationId: ORG, locationId: LOC },
      { scopeType: "organization", organizationId: ORG },
    ],
    null,
  ],
  ["platform operator (GLOBAL)", [{ scopeType: "global" }], null],
  ["location manager", [{ scopeType: "location", organizationId: ORG, locationId: LOC }], LOC],
  [
    "an org role for a DIFFERENT org",
    [{ scopeType: "organization", organizationId: "org-2" }],
    LOC,
  ],
  ["no role information at all (fails narrow)", [], LOC],
  ["roles missing entirely (fails narrow)", undefined, LOC],
];
for (const [who, roles, expected] of cases) {
  const header = S.marketingLocationHeader(S.resolveMarketingScope(roles, ORG, LOC));
  check(`${who} -> X-Location-Id ${expected ?? "(none)"}`, header === expected, String(header));
}
check(
  "the login-role radio is not an input to the scope decision",
  !/cg_login_role|getCustomerLoginRole/.test(strip(read("src/lib/marketing-scope.ts"))) &&
    !/cg_login_role|getCustomerLoginRole/.test(strip(read("src/hooks/useMarketing.ts"))),
);

const f = S.campaignLocationFields;
check(
  "all venues -> location_id null, location_ids omitted",
  JSON.stringify(f(null)) === '{"location_id":null,"location_ids":null}',
);
check(
  "one venue -> that venue is the campaign's location",
  JSON.stringify(f(["a"])) === '{"location_id":"a","location_ids":["a"]}',
);
check(
  "several venues -> org-wide campaign, audience lists them",
  JSON.stringify(f(["a", "b", "a"])) === '{"location_id":null,"location_ids":["a","b"]}',
);

// The real service, with the transport stubbed to record what would be sent.
const captured = [];
const apiStub = {
  name: "stub-api",
  setup(b) {
    b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: "api", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      loader: "js",
      contents: `
        const rec = (method) => async (url, a, b) => {
          const config = (method === "get" || method === "delete") ? a : b;
          globalThis.__captured.push({ method, url, headers: (config && config.headers) || {} });
          return { data: { items: [], page: 1 } };
        };
        export const api = { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };
        export const requestErrorOf = () => null;
      `,
    }));
  },
};
globalThis.__captured = captured;
const M = await bundle("svc", `export * from "${src("src/services/marketing.service.ts")}";`, [
  apiStub,
]);
const svcApi = M.marketingService;
async function callsWith(loc) {
  captured.length = 0;
  await svcApi.getStatus(loc);
  await svcApi.listCampaigns({}, loc);
  await svcApi.listContacts({ channel: "sms" }, loc);
  await svcApi.previewAudience({ channel: "sms" }, loc);
  await svcApi.listTemplates({}, loc);
  await svcApi.listDeliveries({}, loc);
  await svcApi.createCampaign({ name: "x" }, loc);
  await svcApi.scheduleCampaign("c1", { scheduled_at: null, idempotency_key: "k" }, loc);
  await svcApi.testSend("c1", { to: ["a@b.co"] }, loc);
  await svcApi.cancelCampaign("c1", loc);
  return captured.map((c) => ({ url: c.url, loc: c.headers["X-Location-Id"] ?? null }));
}
const orgCalls = await callsWith(
  S.marketingLocationHeader(
    S.resolveMarketingScope([{ scopeType: "organization", organizationId: ORG }], ORG, LOC),
  ),
);
check(
  `org-scoped: none of ${orgCalls.length} calls carries X-Location-Id`,
  orgCalls.length === 10 && orgCalls.every((c) => c.loc === null),
  JSON.stringify(orgCalls.filter((c) => c.loc)),
);
const locCalls = await callsWith(
  S.marketingLocationHeader(
    S.resolveMarketingScope(
      [{ scopeType: "location", organizationId: ORG, locationId: LOC }],
      ORG,
      LOC,
    ),
  ),
);
check(
  `location-scoped: all ${locCalls.length} calls carry X-Location-Id ${LOC}`,
  locCalls.length === 10 && locCalls.every((c) => c.loc === LOC),
  JSON.stringify(locCalls.filter((c) => c.loc !== LOC)),
);

const hooksSrc = strip(read("src/hooks/useMarketing.ts"));
check(
  "every marketing hook sends the scope's header (useScope -> useMarketingLocationId -> marketingLocationHeader)",
  /const loc = useMarketingLocationId\(\)/.test(hooksSrc) &&
    /return marketingLocationHeader\(useMarketingScope\(\)\)/.test(hooksSrc) &&
    !/useCustomerStore\(\(s\) => s\.activeLocationId\) \?\? null;\s*\n\s*return \{/.test(hooksSrc),
);

// The venue picker, actually rendered, under each scope.
let scopeForRender = { kind: "organization", organizationId: ORG };
globalThis.__scope = () => scopeForRender;
const hookStub = {
  name: "stub-hooks",
  setup(b) {
    b.onResolve({ filter: /^@\/hooks\/useMarketing$/ }, () => ({
      path: "hooks",
      namespace: "stubh",
    }));
    b.onResolve({ filter: /^@\/stores\/customerStore$/ }, () => ({
      path: "store",
      namespace: "stubh",
    }));
    b.onLoad({ filter: /^hooks$/, namespace: "stubh" }, () => ({
      loader: "js",
      contents: `export const useMarketingScope = () => globalThis.__scope();
        export const useOrgVenues = () => ({ venues: [{ id: "v1", name: "Koramangala" }, { id: "v2", name: "Indiranagar" }], isLoading: false, isError: false });`,
    }));
    b.onLoad({ filter: /^store$/, namespace: "stubh" }, () => ({
      loader: "js",
      contents: `export const useCustomerStore = (sel) => sel({ activeLocation: { name: "Koramangala" }, activeLocationId: "v1" });`,
    }));
  },
};
const R = await bundle(
  "picker",
  `import { renderToStaticMarkup } from "react-dom/server";
   import { createElement } from "react";
   import { VenuePicker } from "${src("src/components/marketing/audience/VenuePicker.tsx")}";
   export const render = (value) => renderToStaticMarkup(createElement(VenuePicker, { value, onChange: () => {} }));`,
  [hookStub],
);
const orgHtml = R.render(null);
check(
  "org-scoped: the venue picker renders with 'All venues' and every venue",
  /data-testid="venue-picker"/.test(orgHtml) &&
    /All venues/.test(orgHtml) &&
    /Indiranagar/.test(orgHtml),
);
scopeForRender = { kind: "location", locationId: "v1" };
const locHtml = R.render(null);
check(
  "location-scoped: no picker, the venue as fixed text",
  !/venue-picker/.test(locHtml) &&
    /data-testid="venue-fixed"/.test(locHtml) &&
    /Koramangala/.test(locHtml) &&
    !/Indiranagar/.test(locHtml) &&
    !/checkbox/i.test(locHtml),
);
for (const [file, re] of [
  ["src/components/marketing/campaigns/CampaignList.tsx", /orgScoped && <TableHead[^>]*>Venues/],
  ["src/components/marketing/audience/ContactsTable.tsx", /\{orgScoped && \(\s*<Select/],
  [
    "src/components/marketing/audience/AudienceTab.tsx",
    /scope\.kind === "organization" \? \(\s*<OrgPortalConsent/,
  ],
]) {
  check(`${file.split("/").pop()}: venue controls are org-scoped only`, re.test(read(file)));
}

// ---------------------------------------------------------------------------
// 2. No fixtures, no fake success
// ---------------------------------------------------------------------------
console.log("\nno fixture data and no success before the server answers");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const marketingFiles = [
  ...walk(join(ROOT, "src/components/marketing")),
  join(ROOT, "src/components/master/CustomerAddonsPanel.tsx"),
  join(ROOT, "src/services/marketing.service.ts"),
  join(ROOT, "src/services/entitlements.service.ts"),
  join(ROOT, "src/hooks/useMarketing.ts"),
  join(ROOT, "src/types/marketing.ts"),
  join(ROOT, "src/routes/marketing.tsx"),
];

const FIXTURE_RE =
  /\b(DEMO_[A-Z_]+|[A-Z_]*SEED[A-Z_]*|MOCK_[A-Z_]+|mock[A-Z]\w*|fixture\w*|fake[A-Z]\w*|sample(Campaigns|Templates|Contacts|Guests))\b/;
for (const f of marketingFiles) {
  const code = strip(readFileSync(f, "utf8"));
  const hit = code.match(FIXTURE_RE);
  check(`${relative(ROOT, f)} holds no fixture/demo data`, !hit, hit?.[0]);
}

const hooks = strip(read("src/hooks/useMarketing.ts"));
check("the marketing hooks make no optimistic updates", !/onMutate/.test(hooks));
check("the marketing hooks never toast (screens own their messages)", !/\btoast\b/.test(hooks));
check(
  "every marketing query is disabled for the demo workspace",
  (hooks.match(/useQuery\(/g) ?? []).length - 1 === (hooks.match(/enabled: !demo/g) ?? []).length,
);

for (const f of marketingFiles) {
  const code = strip(readFileSync(f, "utf8"));
  let idx = code.indexOf("toast.success(");
  while (idx !== -1) {
    const before = code.slice(0, idx);
    const tryAt = before.lastIndexOf("try {");
    const onSuccessAt = before.lastIndexOf("onSuccess");
    const anchor = Math.max(tryAt, onSuccessAt);
    const ok =
      anchor !== -1 && (onSuccessAt === anchor || /\bawait\b/.test(code.slice(tryAt, idx)));
    const line = before.split("\n").length;
    check(`${relative(ROOT, f)}:${line} toasts success only after an awaited request`, ok);
    idx = code.indexOf("toast.success(", idx + 1);
  }
}

// ---------------------------------------------------------------------------
// 3. The gate comes from the backend
// ---------------------------------------------------------------------------
console.log("\nlock state comes from the backend, not the login radio");

const nav = read("src/lib/customerNav.ts");
check(
  "the Marketing row is offered to both login roles",
  /id: "marketing", label: "Marketing", icon: Send, roles: \["owner", "agent"\]/.test(nav),
);
const perms = read("src/lib/customerNavPermissions.ts");
check(
  "the Marketing row is gated on marketing.read",
  /marketing: \["marketing\.read"\]/.test(perms),
);
const sidebar = strip(read("src/components/customer/CustomerSidebar.tsx"));
check(
  "the sidebar lock badge reads /me/entitlements",
  /useFeatureEntitled\(GUEST_MARKETING_FEATURE_KEY\)/.test(sidebar) &&
    /marketingEntitled === false/.test(sidebar),
);
const view = strip(read("src/components/marketing/MarketingView.tsx"));
check(
  "402 feature_not_entitled renders the upsell, not an error",
  /code === "feature_not_entitled"[\s\S]{0,120}MarketingLockedUpsell/.test(view),
);
check(
  "402 license_not_active renders the licence banner",
  /license_not_active[\s\S]{0,80}MarketingLicenceLapsed/.test(view),
);
check("the demo workspace gets an honest panel", /if \(demo\)/.test(view));
check("no tab mounts before /marketing/status answered", /if \(!status\.data\) return/.test(view));
const upsell = strip(read("src/components/marketing/MarketingLockedUpsell.tsx"));
check("the upsell files a real support ticket", /ticketService\.create\(/.test(upsell));

const detail = strip(read("src/components/marketing/campaigns/CampaignDetailSheet.tsx"));
check(
  "Delivered is shown only when the provider tracks it",
  /delivered_is_tracked \?/.test(detail) && !/Delivered %/.test(detail),
);

// ---------------------------------------------------------------------------
// 4. Contract coverage and locales
// ---------------------------------------------------------------------------
console.log("\nevery contract endpoint has a client call");

const svc = read("src/services/marketing.service.ts");
for (const path of [
  '"/marketing/status"',
  '"/marketing/portal-consent"',
  '"/marketing/contacts"',
  "/opt-out`",
  '"/marketing/audience/preview"',
  '"/marketing/templates"',
  "/duplicate`",
  '"/marketing/templates/preview"',
  '"/marketing/campaigns"',
  "/test-send`",
  "/schedule`",
  "/unschedule`",
  "/cancel`",
  "/recipients`",
  '"/marketing/deliveries"',
  "/addons`",
]) {
  check(`client calls ${path.replace(/["`]/g, "")}`, svc.includes(path));
}
check("schedule sends an idempotency key", /idempotency_key/.test(svc));
check("organization_id is never sent in a body", !/organization_id:/.test(strip(svc)));

console.log("\nmarketing strings exist in every dashboard locale");
const flat = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`],
  );
const en = JSON.parse(read("src/lib/i18n/locales/en/marketing.json"));
const hi = JSON.parse(read("src/lib/i18n/locales/hi/marketing.json"));
const enKeys = flat(en).sort();
const hiKeys = flat(hi).sort();
check(
  "hi carries every en marketing key",
  enKeys.every((k) => hiKeys.includes(k)),
  enKeys.filter((k) => !hiKeys.includes(k)).join(", "),
);
check(
  "hi carries no extra marketing keys",
  hiKeys.every((k) => enKeys.includes(k)),
);
const get = (o, k) => k.split(".").reduce((a, p) => a?.[p], o);
const untranslated = enKeys.filter(
  (k) => !/SMS|WhatsApp/.test(get(en, k)) && !/[ऀ-ॿ]/.test(get(hi, k)),
);
check("hi marketing strings are in Devanagari", untranslated.length === 0, untranslated.join(", "));

console.log(
  failures === 0
    ? "\nall marketing UI checks passed\n"
    : `\n${failures} marketing UI check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
