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
    b.onResolve({ filter: /^@\/services\/ticket\.service$/ }, () => ({
      path: "ticket",
      namespace: "stubticket",
    }));
    b.onLoad({ filter: /.*/, namespace: "stubticket" }, () => ({
      loader: "js",
      contents: `export const ticketService = {
        list: async () => { globalThis.__captured.push({ method: "get", url: "/support-tickets", headers: {} }); return []; },
        create: async () => ({ id: "t" }),
      };`,
    }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      loader: "js",
      contents: `
        const rec = (method) => async (url, a, b) => {
          const config = (method === "get" || method === "delete") ? a : b;
          globalThis.__captured.push({ method, url, headers: (config && config.headers) || {} });
          return { data: { items: [], page: 1 } };
        };
        export const api = { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };
        export const requestErrorOf = (e) => (e && typeof e === "object" && "status" in e ? e : null);
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
   import { VenuePicker, VenueFilterSelect } from "${src("src/components/marketing/audience/VenuePicker.tsx")}";
   export const render = (value) => renderToStaticMarkup(createElement(VenuePicker, { value, onChange: () => {} }));
   export const renderFilter = () => renderToStaticMarkup(createElement(VenueFilterSelect, { value: "all", onChange: () => {} }));`,
  [hookStub],
);
const orgHtml = R.render(null);
check(
  "org-scoped: the list venue filter renders",
  /data-testid="venue-filter"/.test(R.renderFilter()),
);
check(
  "org-scoped: the venue picker renders with 'All venues' and every venue",
  /data-testid="venue-picker"/.test(orgHtml) &&
    /All venues/.test(orgHtml) &&
    /Indiranagar/.test(orgHtml),
);
scopeForRender = { kind: "location", locationId: "v1" };
const locHtml = R.render(null);
check("location-scoped: the list venue filter renders nothing", R.renderFilter() === "");
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
  ["src/components/marketing/audience/ContactsTable.tsx", /<VenueFilterSelect/],
  ["src/components/marketing/campaigns/CampaignList.tsx", /<VenueFilterSelect/],
  ["src/components/marketing/deliveries/DeliveryLogTable.tsx", /<VenueFilterSelect/],
  [
    "src/components/marketing/deliveries/DeliveryLogTable.tsx",
    /orgScoped && <TableHead[^>]*>Venue/,
  ],
  [
    "src/components/marketing/audience/AudienceTab.tsx",
    /scope\.kind === "organization" \? \(\s*<OrgPortalConsent/,
  ],
]) {
  check(`${file.split("/").pop()}: venue controls are org-scoped only`, re.test(read(file)));
}

// ---------------------------------------------------------------------------
// 1c. Review fixes (PR #357 review)
// ---------------------------------------------------------------------------
console.log("\nreview fixes: consent wording, unsubscribe budget, labels, scope strictness");

const C = await bundle("consent", `export * from "${src("src/lib/marketing-consent.ts")}";`);
const DEFAULT_TXT =
  "Send me offers and updates from Third Wave Coffee by SMS, WhatsApp and email. I can unsubscribe any time.";
check(
  "toggle on the default wording sends null (keeps the default, no new version)",
  C.consentTextForToggle(DEFAULT_TXT) === null,
);
check(
  "toggle on a custom wording sends it back verbatim (no reset, no new version)",
  C.consentTextForToggle("Get our weekly deals!") === "Get our weekly deals!",
);
check("toggle with no wording sends null", C.consentTextForToggle(null) === null);
const card = strip(read("src/components/marketing/audience/PortalConsentCard.tsx"));
check(
  "the opt-in switch always sends `text`",
  /onCheckedChange=\{\(v\) => void write\(v, consentTextForToggle\(consent\.text\)\)\}/.test(
    card,
  ) &&
    /mutateAsync\(\{ location_id: locationId, enabled, text: nextText \}\)/.test(card) &&
    !/nextText !== undefined/.test(card),
);

check(
  "the unsubscribe link is budgeted at 60 by default",
  T.DEFAULT_UNSUBSCRIBE_LINK_BUDGET === 60,
);
const justLink = "{{unsubscribe_link}}";
check(
  "worst case uses max(30, budget) for the link",
  T.worstCaseSms(justLink).units === 60 &&
    T.worstCaseSms(justLink, 10).units === 30 &&
    T.worstCaseSms(justLink, 52).units === 52,
);

const editor = strip(read("src/components/marketing/templates/TemplateEditorDialog.tsx"));
check(
  "the editor preview sends a DLT id only when it is well-formed",
  /dlt_template_id: isValidDltTemplateId\(dlt\.trim\(\)\) \? dlt\.trim\(\) : null/.test(editor),
);
check(
  "the editor reseeds on template id, not on every refetched object",
  /\}, \[open, templateKey\]\)/.test(editor),
);
check(
  "a template version conflict re-reads the server version",
  /version_conflict[\s\S]{0,200}getTemplate\([\s\S]{0,120}setVersion\(fresh\.version\)/.test(
    editor,
  ),
);

for (const f of [
  "src/components/marketing/templates/TemplateGallery.tsx",
  "src/components/marketing/templates/TemplateViewDialog.tsx",
  "src/components/marketing/campaigns/CampaignComposerSheet.tsx",
]) {
  check(
    `${f.split("/").pop()}: the server's SMS length is not labelled "characters"`,
    !/sms\.length\}? characters/.test(read(f)) && !/\.sms\.length/.test(strip(read(f))),
  );
}

check(
  "an organization role without an org id is NOT org-wide (fails narrow)",
  S.resolveMarketingScope([{ scopeType: "organization", organizationId: null }], ORG, LOC).kind ===
    "location",
);
check(
  "an organization role with no active org to compare is NOT org-wide",
  S.resolveMarketingScope([{ scopeType: "organization", organizationId: ORG }], null, LOC).kind ===
    "location",
);

const dash = read("src/hooks/useCustomerDashboard.ts");
check(
  "entitlements are cached per organization",
  /entitlements: \(orgId: string \| null\) => \["customer", "entitlements", orgId\]/.test(dash),
);
check(
  "support requests (add-on upsells, top-ups) are cached per organization",
  /const key = \["marketing", scope\.org, scope\.loc, "support-request", subject\]/.test(
    read("src/hooks/useMarketing.ts"),
  ),
);

const composer = strip(read("src/components/marketing/campaigns/CampaignComposerSheet.tsx"));
check(
  "the composer seeds on open + draft id only",
  /\}, \[open, draftId\]\)/.test(composer) && !/\}, \[open, draft\]\)/.test(composer),
);
check(
  "closing never claims 'Saved' without a 2xx",
  !/Saved as a draft/.test(composer) && /Draft last saved/.test(composer),
);
const actions = strip(read("src/components/marketing/campaigns/CampaignActions.tsx"));
check(
  "the schedule key is regenerated only on a definitive 4xx",
  /if \(isDefinitiveRefusal\(err\)\) setKey\(newIdempotencyKey\(\)\)/.test(actions),
);

// ---------------------------------------------------------------------------
// 1d. Bring-your-own providers (spec §12)
// ---------------------------------------------------------------------------
console.log("\nBYO providers: secrets never round-trip, fallback needs an acknowledgement");

const P = await bundle("providers", `export * from "${src("src/lib/marketing-providers.ts")}";`);
const ping = P.providerTypeDef("ping4sms");
const stored = {
  provider_type: "ping4sms",
  display: {
    route: "4",
    sender_id: "ACMECF",
    dlt_entity_id: "1101",
    api_key: { set: true, hint: "…c81d" },
  },
};
const init = P.initialProviderValues(ping, stored.display);
check("a stored secret is never prefilled", init.api_key === "", JSON.stringify(init));
check(
  "non-secret fields are prefilled from display",
  init.sender_id === "ACMECF" && init.route === "4",
);
check(
  "the secret placeholder shows only the hint",
  P.secretPlaceholder(stored.display.api_key) === "Saved (…c81d). Leave blank to keep.",
);
const keep = P.buildProviderPut(ping, { ...init }, stored);
check(
  "an untouched form sends an empty config (nothing to change)",
  keep.body && Object.keys(keep.body.config).length === 0,
  JSON.stringify(keep),
);
const edit = P.buildProviderPut(ping, { ...init, sender_id: "ACMEXY" }, stored);
check(
  "an edit sends only the changed field, and omits the blank secret",
  JSON.stringify(edit.body?.config) === '{"sender_id":"ACMEXY"}',
  JSON.stringify(edit.body),
);
const rotate = P.buildProviderPut(ping, { ...init, api_key: "new-secret-value-1234" }, stored);
check("a typed secret is sent", rotate.body?.config.api_key === "new-secret-value-1234");
const create = P.buildProviderPut(
  ping,
  { route: "4", sender_id: "X", dlt_entity_id: "1", api_key: "" },
  null,
);
check(
  "creating without the secret is refused client-side",
  create.body === null && create.errors.api_key === "Required.",
);
const smtp = P.providerTypeDef("smtp");
const smtpNew = P.buildProviderPut(
  smtp,
  {
    host: "mail.acme.in",
    port: "587",
    use_tls: "true",
    username: "u",
    password: "p4ssword-long",
    from_address: "a@acme.in",
    from_name: "Acme",
    reply_to: "",
  },
  null,
);
check(
  "port is sent as a number and TLS as a boolean",
  smtpNew.body?.config.port === 587 && smtpNew.body?.config.use_tls === true,
);
check(
  "switching provider type requires every secret again",
  P.buildProviderPut(
    P.providerTypeDef("exotel"),
    {
      account_sid: "a",
      subdomain: "api.exotel.com",
      sender_id: "s",
      dlt_entity_id: "d",
      api_key: "",
      api_token: "",
    },
    stored,
  ).body === null,
);
check(
  "WhatsApp (meta_cloud) is listed but not offered until BE-11b",
  P.providerTypeDef("meta_cloud").available === false,
);

check(
  "no own row -> no acknowledgement",
  !P.needsFallbackAcknowledgement({ provider_source: "wyfy", own_provider_status: null }),
);
check(
  "own row failed -> acknowledgement required",
  P.needsFallbackAcknowledgement({ provider_source: "wyfy", own_provider_status: "failed" }),
);
check(
  "own row effective -> no acknowledgement",
  !P.needsFallbackAcknowledgement({ provider_source: "own", own_provider_status: "verified" }),
);
check(
  "an older backend without the fields -> no acknowledgement",
  !P.needsFallbackAcknowledgement({}),
);
check(
  "a verified row the venue switched off -> no acknowledgement (backend deviation #20)",
  !P.needsFallbackAcknowledgement({
    provider_source: "wyfy",
    own_provider_status: "verified",
    byo_entitled: true,
  }),
);
check(
  "a verified row while BYO is locked -> acknowledgement",
  P.needsFallbackAcknowledgement({
    provider_source: "wyfy",
    own_provider_status: "verified",
    byo_entitled: false,
  }),
);
const smtpStored = {
  provider_type: "smtp",
  display: {
    host: "mail.acme.in",
    port: 587,
    use_tls: true,
    username: "u",
    from_address: "a@acme.in",
    from_name: "Acme",
    reply_to: "r@acme.in",
    password: { set: true, hint: "…9x2a" },
  },
};
const cleared = P.buildProviderPut(
  P.providerTypeDef("smtp"),
  { ...P.initialProviderValues(P.providerTypeDef("smtp"), smtpStored.display), reply_to: "" },
  smtpStored,
);
check(
  "emptying an optional field sends null to clear it (backend deviation #26)",
  JSON.stringify(cleared.body?.config) === '{"reply_to":null}',
  JSON.stringify(cleared.body),
);

const hooksSrc2 = strip(read("src/hooks/useMarketing.ts"));
check(
  "acknowledge_wyfy_fallback is sent only when ticked",
  /\.\.\.\(v\.acknowledgeWyfyFallback \? \{ acknowledge_wyfy_fallback: true \} : \{\}\)/.test(
    hooksSrc2,
  ),
);
const sched = strip(read("src/components/marketing/campaigns/CampaignActions.tsx"));
check(
  "Schedule / Send now stay disabled until the fallback is acknowledged",
  /const canGo =\s*\(!needsAck \|\| ack\) &&/.test(sched) &&
    /acknowledgeWyfyFallback: needsAck && ack/.test(sched),
);
check(
  "provider writes are never optimistic",
  !/onMutate/.test(hooksSrc2) &&
    /invalidate\("providers", "status", "templates", "credits", "estimate"\)/.test(hooksSrc2),
);
const form = strip(read("src/components/marketing/channels/ProviderForm.tsx"));
check(
  "secret inputs are password fields with no autofill of the stored value",
  /type=\{f\.secret \? "password"/.test(form) &&
    /autoComplete=\{f\.secret \? "new-password"/.test(form),
);
check(
  "the form never reads a secret from display into state",
  /initialProviderValues\(def, storedDisplay\)/.test(form) && !/display\[f\.key\]/.test(form),
);
const helpersSrc = strip(read("src/components/marketing/marketing-helpers.ts"));
check(
  "a BYO 402 is told apart from the Marketing lock by feature_key",
  /feature_key === "guest_marketing_byo"/.test(helpersSrc),
);
const viewSrc = strip(read("src/components/marketing/MarketingView.tsx"));
check(
  "the Marketing page lock ignores the BYO lock (status is not BYO-gated)",
  !/isByoLocked/.test(viewSrc),
);
const svc2 = read("src/services/marketing.service.ts");
for (const path of [
  '"/marketing/providers"',
  "/marketing/providers/${",
  "/verify`",
  "/marketing-providers`",
]) {
  check(`client calls ${path.replace(/["`$]/g, "")}`, svc2.includes(path));
}
const panel = strip(read("src/components/master/CustomerAddonsPanel.tsx"));
check(
  "Master: a blocked add-on's switch is disabled",
  /disabled=\{!canWrite \|\| busy \|\| !!addon\.blocked_by\}/.test(panel),
);
check(
  "Master: the providers list shows no hints (reads only sender_label)",
  /sender_label/.test(panel) && !/display\./.test(panel) && !/hint/.test(panel),
);

// ---------------------------------------------------------------------------
// 1e. Credits (spec §13)
// ---------------------------------------------------------------------------
console.log("\ncredits: integer formatting, 402 told apart, ledger gated");

const K = await bundle("credits", `export * from "${src("src/lib/marketing-credits.ts")}";`);
check(
  "125040 minor formats as 1,25,040? no: 1,250.40",
  K.formatCredits(125040) === "1,250.40",
  K.formatCredits(125040),
);
check(
  "indian grouping for large balances",
  K.formatCredits(123456789) === "12,34,567.89",
  K.formatCredits(123456789),
);
check("negative and zero", K.formatCredits(-60) === "-0.60" && K.formatCredits(0) === "0.00");
check(
  "signed deltas",
  K.formatSignedCredits(50000) === "+500.00" && K.formatSignedCredits(-30) === "-0.30",
);
check(
  "typed credits parse exactly to minor units",
  K.parseCreditsInput("2,000") === 200000 &&
    K.parseCreditsInput("0.3") === 30 &&
    K.parseCreditsInput("-12.05") === -1205,
);
check(
  "more than two decimals is refused, not rounded",
  K.parseCreditsInput("1.005") === null && K.parseCreditsInput("abc") === null,
);
check(
  "chip tone: red at 0, amber when low, else ok",
  K.creditTone(0, false) === "empty" &&
    K.creditTone(500, true) === "low" &&
    K.creditTone(500, false) === "ok",
);
check(
  "the cost sentence matches the spec's wording",
  K.estimateSentence({
    provider_source: "wyfy",
    reachable: 412,
    unit: "segment",
    unit_price_minor: 30,
    units_per_recipient_max: 2,
    estimated_max_minor: 24720,
  }) ===
    "Estimated cost: up to 247.20 credits (412 guests × 2 segments × 0.30). Unused credits are returned after sending.",
);
check(
  "own provider: no credits",
  K.estimateSentence({
    provider_source: "own",
    reachable: 1,
    unit: "message",
    unit_price_minor: 0,
    units_per_recipient_max: 1,
    estimated_max_minor: 0,
  }) === "Sent via your own provider: no Wyfy credits used.",
);

const insufficient = {
  status: 402,
  code: "x",
  message: "m",
  data: { error_code: "insufficient_credits", needed_minor: 24720, available_minor: 1000 },
};
const locked402 = {
  status: 402,
  code: "x",
  message: "m",
  data: { error_code: "feature_not_entitled" },
};
check(
  "402 insufficient_credits is NOT read as the add-on lock",
  M.isEntitlementError(insufficient) === false,
);
check("402 feature_not_entitled still is", M.isEntitlementError(locked402) === true);
check("its code comes through", M.marketingErrorCode(insufficient) === "insufficient_credits");
const helpersSrc3 = strip(read("src/components/marketing/marketing-helpers.ts"));
check(
  "insufficient_credits copy names what is needed and what is available",
  /code === "insufficient_credits"[\s\S]{0,300}needed_minor[\s\S]{0,200}available_minor/.test(
    helpersSrc3,
  ),
);
const creditsTab = strip(read("src/components/marketing/credits/CreditsTab.tsx"));
check(
  "the ledger renders only with billing.read at org level",
  /scope\.kind === "organization" && has\("billing\.read"\)/.test(creditsTab) &&
    /mayReadLedger \? \(\s*<CreditLedgerTable/.test(creditsTab),
);
check(
  "top-up is a real support request with the spec's subject",
  /useSupportRequest\(TOPUP_REQUEST_SUBJECT\)/.test(creditsTab) &&
    /TOPUP_REQUEST_SUBJECT = "Marketing credits top-up"/.test(helpersSrc3),
);
const chip = strip(read("src/components/marketing/credits/CreditsChip.tsx"));
check(
  "the chip renders nothing until the server answered",
  /if \(!q\.data\) return null;/.test(chip),
);
const composer2 = strip(read("src/components/marketing/campaigns/CampaignComposerSheet.tsx"));
check(
  "the composer blocks scheduling when the estimate says insufficient",
  /estimate\.data && !estimate\.data\.sufficient/.test(composer2),
);
const hooks3 = strip(read("src/hooks/useMarketing.ts")).replace(/\s+/g, " ");
check(
  "balances are re-read after every send-shaped action (never optimistic)",
  /invalidate\( ?"campaigns", "campaign", "recipients", "deliveries", "credits", "estimate", "ledger",? ?\)/.test(
    hooks3,
  ) && /onSettled: \(\) => invalidate\("credits", "ledger", "estimate"\)/.test(hooks3),
);
const creditsPanel = strip(read("src/components/master/CustomerCreditsPanel.tsx"));
check(
  "Master adjustments carry one idempotency key per dialog opening",
  /setKey\(newKey\(\)\)/.test(creditsPanel) && /idempotency_key: key/.test(creditsPanel),
);
check(
  "Master credit controls need the addons cap (billing.manage)",
  /const canWrite = caps\.has\("addons"\)/.test(creditsPanel),
);
const shell = read("src/components/master/MasterShell.tsx");
check(
  "the price book is in the Master nav, gated by the pricing cap",
  /to: "\/master\/marketing-pricing"[\s\S]{0,120}cap: "pricing"/.test(shell) &&
    /pricing: \["billing\.read"\]/.test(shell),
);
const svc3 = read("src/services/marketing.service.ts");
for (const path of [
  '"/marketing/credits"',
  '"/marketing/credits/ledger"',
  "/estimate`",
  "/credits/adjustments`",
  "/credits/settings`",
  '"/platform/marketing/price-book"',
  "/marketing-prices`",
]) {
  check(`client calls ${path.replace(/["`]/g, "")}`, svc3.includes(path));
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
// The demo backend (src/components/marketing/demo) is the ONE place sample
// data may live, and only because it is fenced behind isDemo() -- checked
// in section 2b below. Everything else stays fixture-free.
const DEMO_DIR = join(ROOT, "src/components/marketing/demo");
const marketingFiles = [
  ...walk(join(ROOT, "src/components/marketing")).filter((f) => !f.startsWith(DEMO_DIR)),
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
  "every marketing query and mutation goes through the session's API (useMarketingApi), never the client directly",
  !/\bmarketingService\./.test(hooks) && (hooks.match(/\bapi\.\w+\(/g) ?? []).length >= 23,
);

// ---------------------------------------------------------------------------
// 2b. The demo fence: fixtures only behind isDemo()
// ---------------------------------------------------------------------------
console.log("\nthe demo backend is reachable only from a demo session");

const allSrc = walk(join(ROOT, "src"));
const importersOfDemo = allSrc.filter(
  (f) => !f.startsWith(DEMO_DIR) && /marketing\/demo\//.test(strip(readFileSync(f, "utf8"))),
);
check(
  "only hooks/useMarketing.ts refers to the demo module",
  importersOfDemo.length === 1 && importersOfDemo[0].endsWith("src/hooks/useMarketing.ts"),
  importersOfDemo.map((f) => relative(ROOT, f)).join(", "),
);
const hooksRaw = read("src/hooks/useMarketing.ts");
const valueImports = [...hooksRaw.matchAll(/^import (?!type)[^;]*marketing\/demo[^;]*;/gm)];
check(
  "it never imports the demo module statically (type-only or lazy import())",
  valueImports.length === 0,
);
check(
  "the lazy import lives only in loadDemoMarketingApi",
  (hooks.match(/import\("@\/components\/marketing\/demo\//g) ?? []).length === 1 &&
    /function loadDemoMarketingApi\(\)[\s\S]{0,200}import\("@\/components\/marketing\/demo\/demo-backend"\)/.test(
      hooks,
    ),
);
check(
  "loadDemoMarketingApi is reached only through the demo proxy",
  (hooks.match(/loadDemoMarketingApi\(/g) ?? []).length === 2 &&
    /const demoMarketingApi = new Proxy[\s\S]{0,400}loadDemoMarketingApi\(\)/.test(hooks),
);
check(
  "the demo proxy is chosen only when useIsDemo() is true",
  (hooks.match(/\bdemoMarketingApi\b/g) ?? []).length === 2 &&
    /return useIsDemo\(\) \? demoMarketingApi : marketingService;/.test(hooks),
);
check(
  "no other marketing module talks to marketingService directly",
  marketingFiles
    .filter((f) => !/services\/marketing\.service\.ts$|hooks\/useMarketing\.ts$/.test(f))
    .every((f) => !/\bmarketingService\./.test(strip(readFileSync(f, "utf8")))),
);
const demoSrc = walk(DEMO_DIR)
  .map((f) => strip(readFileSync(f, "utf8")))
  .join("\n");
check(
  "the demo backend makes no network request of any kind",
  !/import (?!type)[^;]*@\/services\/|\bfetch\(|axios|XMLHttpRequest|guestPortalApi/.test(demoSrc),
);
check(
  "every demo write says nothing was actually sent",
  /DEMO_SENT_NOTE = "Demo: nothing was actually sent\."/.test(demoSrc) &&
    (demoSrc.match(/note\(DEMO_(SENT|SAVED)_NOTE\)/g) ?? []).length >= 11,
);
check(
  "demo templates are the backend seed, all ten",
  (readFileSync(join(DEMO_DIR, "system-templates.ts"), "utf8").match(/system_key: "/g) ?? [])
    .length === 10,
);

// Built output (when a build is present): the fixtures ship in their own
// lazily-loaded chunk, which no chunk imports statically.
{
  const assetsDir = join(ROOT, ".output/public/assets");
  let files = [];
  try {
    files = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
  } catch {
    files = [];
  }
  if (files.length === 0) {
    console.log("  skip no build output; run `bun run build` to check the demo chunk");
  } else {
    const holders = files.filter((f) =>
      readFileSync(join(assetsDir, f), "utf8").includes("Monsoon chai special"),
    );
    check(
      "the demo fixtures are in exactly one built chunk",
      holders.length === 1,
      holders.join(", "),
    );
    const chunk = holders[0];
    const staticImporters = files.filter((f) => {
      const code = readFileSync(join(assetsDir, f), "utf8");
      return (
        f !== chunk &&
        new RegExp(`(from|import)\\s*"\\./${chunk.replace(/[.]/g, "\\.")}"`).test(code)
      );
    });
    check(
      "no chunk imports the demo chunk statically",
      staticImporters.length === 0,
      staticImporters.join(", "),
    );
  }
}

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
check(
  "the demo workspace is never locked and says it is sample data",
  /if \(!demo && \(code === "feature_not_entitled"/.test(view) &&
    /marketing-demo-banner/.test(view),
);
check("no tab mounts before /marketing/status answered", /if \(!status\.data\) return/.test(view));
const upsell = strip(read("src/components/marketing/MarketingLockedUpsell.tsx"));
check(
  "the upsell files a real support ticket",
  /useSupportRequest\(MARKETING_REQUEST_SUBJECT\)/.test(upsell) &&
    /async requestSupport\([\s\S]{0,300}ticketService\.create\(/.test(
      read("src/services/marketing.service.ts"),
    ),
);

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
