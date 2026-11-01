/**
 * Regression test: the captive portal sends ONE spelling of a guest's email.
 *
 * Run: `node scripts/test-portal-guest-identifier-case.mjs`
 *
 * The defect (backend fix: cloud-guest `fix(guest): match portal email
 * identifiers case-insensitively`): mobile keyboards capitalise the first
 * letter of the portal's plain-text "Mobile or email" field, so a guest who
 * signed up as `guest@gmail.com` came back as `Guest@gmail.com`, and the
 * backend -- which compared identifiers exactly -- rejected their correct
 * password or made them a second guest. The backend now folds email case;
 * this pins the portal half:
 *
 *   1. `normalizeGuestIdentifier`: trims, lower-cases emails, leaves phones
 *      alone.
 *   2. The real `portal-runtime.service.ts` (axios stubbed) sends the
 *      normalised identifier on every guest-identity call -- OTP request,
 *      OTP/voucher/password/PIN login, team join -- and never touches the
 *      password or voucher code.
 *   3. Every identifier input turns off auto-capitalisation (source check;
 *      the attributes are plain JSX props).
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "guest-identifier-case-"));

const failures = [];
let passed = 0;
const check = (name, ok, detail) => {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}`);
  }
};

const aliasPlugin = (stubs) => ({
  name: "portal-aliases",
  setup(b) {
    for (const [spec, file] of Object.entries(stubs)) {
      const filter = new RegExp(`^${spec.replace(/[/@.]/g, (c) => `\\${c}`)}$`);
      b.onResolve({ filter }, () => ({ path: file }));
    }
    b.onResolve({ filter: /^@\// }, (args) => {
      const base = join(ROOT, "src", args.path.slice(2));
      for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
        if (existsSync(p) && extname(p)) return { path: p };
      }
      return { errors: [{ text: `cannot resolve ${args.path}` }] };
    });
  },
});

const API_STUB = `
export const calls = [];
const record = (method) => async (url, body, opts) => {
  calls.push({ method, url, body, opts });
  return { data: RESPONSE };
};
const RESPONSE = {
  guest_id: "g-1", identifier: "guest@gmail.com", is_new_guest: false,
  has_password: true, has_profile: false, has_opened_review_link: false,
  is_new_membership: true,
  session: {
    id: "s-1", guest_id: "g-1", device_id: null, router_id: "r-1",
    location_id: "l-1", organization_id: "o-1", auth_method: "otp_email",
    status: "active", started_at: "2026-10-31T00:00:00Z", ended_at: null,
    last_activity_at: "2026-10-31T00:00:00Z", ip_address: null,
    bytes_uploaded: 0, bytes_downloaded: 0, data_limit_mb: null,
    session_timeout_minutes: null,
  },
  device: null,
};
export const guestPortalApi = { get: record("get"), post: record("post") };
export default guestPortalApi;
`;
writeFileSync(join(work, "api-stub.js"), API_STUB);
writeFileSync(
  join(work, "entry.ts"),
  `export { portalRuntimeService } from "@/services/portal-runtime.service";
   export * as api from "@/services/guest-portal-api";
   export { normalizeGuestIdentifier } from "@/lib/portal-guest-identifier";`,
);
await build({
  entryPoints: [join(work, "entry.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "bundle.mjs"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [aliasPlugin({ "@/services/guest-portal-api": join(work, "api-stub.js") })],
});
const M = await import(pathToFileURL(join(work, "bundle.mjs")).href);

// --- 1. the pure rule --------------------------------------------------
console.log("\nnormalizeGuestIdentifier:");
for (const [raw, want] of [
  ["Guest@Gmail.com", "guest@gmail.com"],
  ["  GUEST@EXAMPLE.COM \n", "guest@example.com"],
  ["guest@gmail.com", "guest@gmail.com"],
  [" +919876543210 ", "+919876543210"],
  ["Room12", "Room12"],
]) {
  const got = M.normalizeGuestIdentifier(raw);
  check(
    `${JSON.stringify(raw)} -> ${JSON.stringify(want)}`,
    got === want,
    `got ${JSON.stringify(got)}`,
  );
}

// --- 2. the wire -------------------------------------------------------
console.log("\nWire (real portal-runtime.service.ts):");
const S = M.portalRuntimeService;
const venue = { organizationId: "o-1", locationId: "l-1", routerId: "r-1" };
const lastBody = () => M.api.calls[M.api.calls.length - 1].body;

await S.requestOtp({
  identifier: " Guest@Gmail.com",
  channel: "email",
  organizationId: "o-1",
  locationId: "l-1",
});
check(
  "requestOtp sends lower-cased email",
  lastBody().identifier === "guest@gmail.com",
  JSON.stringify(lastBody()),
);

await S.loginWithOtp({
  identifier: "Guest@Gmail.com",
  code: "123456",
  authMethod: "otp_email",
  ...venue,
});
check(
  "loginWithOtp sends lower-cased email",
  lastBody().identifier === "guest@gmail.com",
  JSON.stringify(lastBody()),
);

await S.loginWithPassword({
  identifier: "Guest@Gmail.com",
  password: "Correct-Horse-1!",
  ...venue,
});
check(
  "loginWithPassword sends lower-cased email",
  lastBody().identifier === "guest@gmail.com",
  JSON.stringify(lastBody()),
);
check(
  "loginWithPassword leaves the password's case alone",
  lastBody().password === "Correct-Horse-1!",
  JSON.stringify(lastBody()),
);

await S.loginWithVoucher({ identifier: "Guest@Gmail.com", code: "AbC-123", ...venue });
check(
  "loginWithVoucher sends lower-cased email",
  lastBody().identifier === "guest@gmail.com",
  JSON.stringify(lastBody()),
);
check(
  "loginWithVoucher leaves the code to the backend",
  lastBody().code === "AbC-123",
  JSON.stringify(lastBody()),
);

await S.joinTeam({ teamCode: "T1", identifier: "Guest@Gmail.com" });
check(
  "joinTeam sends lower-cased email",
  lastBody().identifier === "guest@gmail.com",
  JSON.stringify(lastBody()),
);

await S.loginWithOtp({
  identifier: "+919876543210",
  code: "123456",
  authMethod: "otp_sms",
  ...venue,
});
check(
  "a phone number is sent unchanged",
  lastBody().identifier === "+919876543210",
  JSON.stringify(lastBody()),
);

// --- 3. the inputs -----------------------------------------------------
console.log("\nIdentifier inputs turn off auto-capitalisation:");
for (const [rel, marker] of [
  ["src/components/portal-runtime/PasswordSignInForm.tsx", 'autoComplete="username"'],
  ["src/components/portal-runtime/AuthMethodForms.tsx", 'autoComplete="username"'],
  ["src/components/portal-runtime/VoucherForm.tsx", 'autoComplete="username"'],
  ["src/components/portal-runtime/AuthFields.tsx", 'autoComplete="email"'],
]) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const at = src.indexOf(marker);
  const tag = at < 0 ? "" : src.slice(src.lastIndexOf("<Input", at), src.indexOf("/>", at));
  check(
    `${rel}`,
    /autoCapitalize="none"/.test(tag),
    'identifier <Input> lacks autoCapitalize="none"',
  );
}

// The context setter is what the hotspot login posts as the RADIUS username.
const ctx = readFileSync(join(ROOT, "src/context/PortalRuntimeContext.tsx"), "utf8");
const setter = ctx.slice(
  ctx.indexOf("const setGuestIdentifier = useCallback"),
  ctx.indexOf("}, []);", ctx.indexOf("const setGuestIdentifier = useCallback")),
);
check(
  "setGuestIdentifier normalises before storing",
  /normalizeGuestIdentifier\(/.test(setter),
  "setter does not normalise",
);

if (failures.length) {
  console.error(`\n${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} checks`);
